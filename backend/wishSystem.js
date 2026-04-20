// Whispered Wishes / Wish Jar System
// Lets each of the two registered players hide a short "wish" at a pre-defined
// spot in the nest. When the partner interacts with that spot the wish is
// revealed. When BOTH partners have had a wish discovered within the last 24h
// a joint-tap Wish Jar materializes and requires a simultaneous two-finger tap
// (within a 3-second server-validated sync window) for a shared reward.
//
// Sibling of memoriesSystem.js / rewardsSystem.js / miniGames.js — same
// class shape, serialize/deserialize, and in-process Map storage. State that
// needs to survive restarts lives on `gameState.wishSystem` (see server.js
// initializeGameState / loadSavedGameState); this module is stateless logic +
// small rolling caches and is constructed per-room style.

const VALID_SPOT_IDS = ['bowl', 'garden', 'pad', 'pile', 'shelf', 'shadow', 'cave'];

// Spot -> list of gameplay actions that can reveal a wish at that spot.
// Used to reject obvious discovery-enumeration probes.
// V4.1 (B-1): widened to match the frontend's ACTION_SPOT_MAP so every spot
// the UI lets players hide a wish at is discoverable through at least one
// natural gameplay interaction. Includes cave's natural triggers
// (sleep/pet) in addition to the explicit cave_enter/cave_exit signals.
const SPOT_TRIGGER_ACTIONS = {
    bowl:   ['feed'],
    garden: ['harvest', 'water', 'play'],
    pad:    ['sleep', 'pet'],
    pile:   ['harvest', 'pet', 'feed'],
    shelf:  ['pet', 'play'],
    shadow: ['pet', 'play'],
    cave:   ['sleep', 'pet', 'cave_enter', 'cave_exit']
};

// Curated pool of wearables that can drop from the Wish Jar. Kept intentionally
// small and narrative; entries must match item ids known to the shop /
// customization system (see GAME_CONFIG.SHOP in server.js). If an entry is
// unknown to the shop the reward still emits the id but the equip step will
// silently no-op, matching the existing behavior for unknown wearables.
const WISH_WEARABLE_POOL = [
    'toy_ball',
    'soft_blanket',
    'golden_carrot_decoration',
    'sync_hearts',
    'harmony_decoration',
    'sparkle_brush'
];

const DEFAULTS = {
    WISH_TTL_MS:         48 * 60 * 60 * 1000, // 48h
    JAR_WINDOW_MS:       24 * 60 * 60 * 1000, // jar eligibility window
    JAR_SYNC_MS:         3000,                 // 3s two-tap sync window
    JAR_EXPIRE_MS:       10 * 60 * 1000,       // 10 min jar life
    JAR_COOLDOWN_MS:     60 * 1000,            // 60s cooldown after a miss
    MAX_MESSAGE_LEN:     140,
    MAX_RECENT_DISCOVERIES: 20
};

function defaultState() {
    return {
        activeWishes: {},       // playerId -> { wishId, spotId, message, createdAt, expiresAt }
        recentDiscoveries: [],  // [{ wishId, discoveredBy, discoveredAt, authorId }]
        currentJar: null,       // { jarId, readyAt, expiresAt, pendingTaps: { [pid]: ts } }
        jarCooldownUntil: 0,
        wishJarsOpenedTotal: 0
    };
}

class WishSystem {
    constructor() {
        // Rolling hide-wish rate-limit (1 per 10s per player). The global
        // rateLimits map handles the big-picture per-minute cap; this one
        // enforces the tighter spec-mandated spacing on hide_wish.
        this.hideCooldowns = new Map(); // playerId -> lastHideTs
    }

    // --- Defaults / migration -------------------------------------------------

    static defaultState() {
        return defaultState();
    }

    // Ensure the gameState.wishSystem sub-object is well-formed. Mutates and
    // returns the sanitized state so callers in loadSavedGameState can use the
    // same idiom as the other systems.
    static sanitize(state) {
        const base = defaultState();
        if (!state || typeof state !== 'object') return base;

        const out = base;
        if (state.activeWishes && typeof state.activeWishes === 'object') {
            for (const [pid, w] of Object.entries(state.activeWishes)) {
                if (!w || typeof w !== 'object') continue;
                // P2-1: reject tampered keys. The author's playerId is the
                // activeWishes key, so a malformed key cannot be trusted.
                if (typeof pid !== 'string') continue;
                if (pid === '__proto__' || pid === 'constructor' || pid === 'prototype') continue;
                if (!/^player_[a-z0-9]+_[a-z0-9]+$/.test(pid)) continue;
                if (typeof w.wishId !== 'string' || typeof w.spotId !== 'string') continue;
                if (!VALID_SPOT_IDS.includes(w.spotId)) continue;
                if (typeof w.message !== 'string') continue;
                // P2-1: strip control chars defensively on load in case an old
                // save was written before validateWishMessage existed.
                let msg = w.message.replace(/[\x00-\x1F\x7F]/g, '');
                msg = msg.substring(0, DEFAULTS.MAX_MESSAGE_LEN);
                if (msg.length === 0) continue;
                // B-5: preserve authorId — downstream consumers (memory
                // enrichment, checkJarCondition) read it explicitly.
                const authorId = (typeof w.authorId === 'string' &&
                    /^player_[a-z0-9]+_[a-z0-9]+$/.test(w.authorId)) ? w.authorId : pid;
                out.activeWishes[pid] = {
                    wishId:    w.wishId,
                    spotId:    w.spotId,
                    message:   msg,
                    authorId,
                    createdAt: Number(w.createdAt) || Date.now(),
                    expiresAt: Number(w.expiresAt) || (Date.now() + DEFAULTS.WISH_TTL_MS)
                };
            }
        }
        if (Array.isArray(state.recentDiscoveries)) {
            out.recentDiscoveries = state.recentDiscoveries
                .filter(d => d && typeof d === 'object' &&
                    typeof d.wishId === 'string' &&
                    typeof d.authorId === 'string')
                .slice(-DEFAULTS.MAX_RECENT_DISCOVERIES);
        }
        if (state.currentJar && typeof state.currentJar === 'object' &&
            typeof state.currentJar.jarId === 'string') {
            out.currentJar = {
                jarId:       state.currentJar.jarId,
                readyAt:     Number(state.currentJar.readyAt) || Date.now(),
                expiresAt:   Number(state.currentJar.expiresAt) || (Date.now() + DEFAULTS.JAR_EXPIRE_MS),
                pendingTaps: {}
            };
        }
        out.jarCooldownUntil    = Number(state.jarCooldownUntil) || 0;
        out.wishJarsOpenedTotal = Math.max(0, Number(state.wishJarsOpenedTotal) || 0);
        return out;
    }

    // --- Helpers --------------------------------------------------------------

    static isValidSpotId(spotId) {
        return typeof spotId === 'string' && VALID_SPOT_IDS.includes(spotId);
    }

    static getValidSpotIds() {
        return VALID_SPOT_IDS.slice();
    }

    generateWishId() {
        return 'wish_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateJarId() {
        return 'jar_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    _ensure(gameState) {
        if (!gameState.wishSystem) gameState.wishSystem = defaultState();
        return gameState.wishSystem;
    }

    // V4.1 (P1-2): hideCooldowns is a process-wide Map keyed by playerId
    // (singleton wishSystem instance across all rooms). Without pruning it
    // grows forever — one entry per player who ever hid a wish. Called from
    // hideWish and expireWishes (every 8s from the decay loop) so the map
    // never holds entries past the widest cooldown window.
    _pruneHideCooldowns(now) {
        const stale = now - 60000; // widest cooldown we care about
        for (const [pid, ts] of this.hideCooldowns) {
            if (ts < stale) this.hideCooldowns.delete(pid);
        }
    }

    // Registered-player gate: the Wish Jar must only ever be influenced by the
    // two registered player IDs in the room. Guests / unknown sockets are
    // rejected here so every entry-point can share the same check.
    _requireRegisteredPlayer(playerId, registeredPlayerIds) {
        if (!playerId || typeof playerId !== 'string') return false;
        if (!Array.isArray(registeredPlayerIds)) return false;
        return registeredPlayerIds.includes(playerId);
    }

    // --- Hide --------------------------------------------------------------------

    // Deposit a wish. Validator has already range-checked the message and
    // spotId; we enforce the 1-per-10s hide cadence and single-active-wish rule.
    hideWish(gameState, playerId, spotId, message, registeredPlayerIds) {
        if (!this._requireRegisteredPlayer(playerId, registeredPlayerIds)) {
            return { success: false, code: 'not_registered', message: 'Only room members can hide wishes' };
        }
        if (!WishSystem.isValidSpotId(spotId)) {
            return { success: false, code: 'invalid_spot', message: 'Invalid hiding spot' };
        }
        if (typeof message !== 'string' || message.length === 0) {
            return { success: false, code: 'empty_message', message: 'Wish cannot be empty' };
        }

        const now = Date.now();
        this._pruneHideCooldowns(now);
        const lastHide = this.hideCooldowns.get(playerId) || 0;
        if (now - lastHide < 10000) {
            return {
                success: false,
                code: 'rate_limited',
                message: 'Please wait before hiding another wish',
                retryAfterMs: 10000 - (now - lastHide)
            };
        }

        const state = this._ensure(gameState);
        const wishId = this.generateWishId();
        const wish = {
            wishId,
            spotId,
            message: message.substring(0, DEFAULTS.MAX_MESSAGE_LEN),
            authorId: playerId,
            createdAt: now,
            expiresAt: now + DEFAULTS.WISH_TTL_MS
        };

        // Single active wish per player — editing replaces the old one.
        state.activeWishes[playerId] = wish;
        this.hideCooldowns.set(playerId, now);

        return {
            success: true,
            wishId,
            spotId,
            expiresAt: wish.expiresAt
        };
    }

    // Cancel / remove the caller's own active wish.
    cancelWish(gameState, playerId, registeredPlayerIds) {
        if (!this._requireRegisteredPlayer(playerId, registeredPlayerIds)) {
            return { success: false, code: 'not_registered' };
        }
        const state = this._ensure(gameState);
        const existing = state.activeWishes[playerId];
        if (!existing) return { success: false, code: 'no_wish' };
        delete state.activeWishes[playerId];
        return { success: true, wishId: existing.wishId };
    }

    // Fetch caller's own hidden-but-undiscovered wish (UI re-render).
    getMyWishes(gameState, playerId, registeredPlayerIds) {
        if (!this._requireRegisteredPlayer(playerId, registeredPlayerIds)) {
            return { success: false, code: 'not_registered', wishes: [] };
        }
        const state = this._ensure(gameState);
        const own = state.activeWishes[playerId];
        return {
            success: true,
            wishes: own ? [{
                wishId: own.wishId,
                spotId: own.spotId,
                message: own.message,
                createdAt: own.createdAt,
                expiresAt: own.expiresAt
            }] : []
        };
    }

    // --- Discovery --------------------------------------------------------------

    // Attempt to reveal a partner-hidden wish at `spotId` triggered by
    // `triggerAction`. Returns { success, discovered, wish? }.
    // If discovered: removes the wish from activeWishes, records the discovery,
    // and re-checks whether the jar condition is newly satisfied.
    tryDiscoverAt(gameState, playerId, spotId, triggerAction, registeredPlayerIds) {
        if (!this._requireRegisteredPlayer(playerId, registeredPlayerIds)) {
            return { success: false, code: 'not_registered' };
        }
        if (!WishSystem.isValidSpotId(spotId)) {
            return { success: false, code: 'invalid_spot' };
        }
        // triggerAction must be one of the whitelisted gameplay actions for
        // this spot. Prevents a client from spamming attempt_wish_discovery
        // with bogus actions to enumerate partner wishes.
        const allowed = SPOT_TRIGGER_ACTIONS[spotId] || [];
        if (!allowed.includes(triggerAction)) {
            return { success: false, code: 'invalid_trigger' };
        }

        const state = this._ensure(gameState);
        this.expireWishes(gameState);

        // Find a partner-authored wish hidden at this spot.
        let discoveredEntry = null;
        let authorId = null;
        for (const [pid, w] of Object.entries(state.activeWishes)) {
            if (pid === playerId) continue;                  // don't echo own wish
            if (w.spotId !== spotId) continue;
            discoveredEntry = w;
            authorId = pid;
            break;
        }
        if (!discoveredEntry) return { success: true, discovered: false };

        // Remove & record the discovery.
        delete state.activeWishes[authorId];
        const discovery = {
            wishId:        discoveredEntry.wishId,
            discoveredBy:  playerId,
            discoveredAt:  Date.now(),
            authorId
        };
        state.recentDiscoveries.push(discovery);
        if (state.recentDiscoveries.length > DEFAULTS.MAX_RECENT_DISCOVERIES) {
            state.recentDiscoveries = state.recentDiscoveries.slice(-DEFAULTS.MAX_RECENT_DISCOVERIES);
        }

        return {
            success: true,
            discovered: true,
            wish: {
                wishId:  discoveredEntry.wishId,
                message: discoveredEntry.message,
                spotId:  discoveredEntry.spotId,
                authorId,
                createdAt: discoveredEntry.createdAt
            },
            discovery
        };
    }

    // --- Jar --------------------------------------------------------------------

    // Returns true if, within the last 24h, BOTH registered players have had a
    // wish of theirs discovered by the partner.
    checkJarCondition(gameState, registeredPlayerIds) {
        if (!Array.isArray(registeredPlayerIds) || registeredPlayerIds.length < 2) return false;
        const state = this._ensure(gameState);
        const now = Date.now();
        const cutoff = now - DEFAULTS.JAR_WINDOW_MS;

        const authorsRecentlyDiscovered = new Set();
        for (const d of state.recentDiscoveries) {
            if (d.discoveredAt >= cutoff && d.authorId) {
                authorsRecentlyDiscovered.add(d.authorId);
            }
        }
        return registeredPlayerIds.every(pid => authorsRecentlyDiscovered.has(pid));
    }

    // If the jar condition is newly met, materialize a jar and return it.
    // Returns null if no new jar was created (condition not met, jar already
    // active, or in cooldown).
    maybeSpawnJar(gameState, registeredPlayerIds) {
        const state = this._ensure(gameState);
        const now = Date.now();
        if (state.currentJar) return null;
        if (now < state.jarCooldownUntil) return null;
        if (!this.checkJarCondition(gameState, registeredPlayerIds)) return null;

        const jar = {
            jarId:       this.generateJarId(),
            readyAt:     now,
            expiresAt:   now + DEFAULTS.JAR_EXPIRE_MS,
            pendingTaps: {}
        };
        state.currentJar = jar;
        return jar;
    }

    // Record a tap for player `playerId`. Always server-time authoritative —
    // client-supplied timestamps are ignored for correctness (used only for
    // debug/display).
    //
    // Returns one of:
    //   { success: true, status: 'waiting', jarId }
    //   { success: true, status: 'opened',  jarId, rewards, syncDeltaMs }
    //   { success: true, status: 'failed',  jarId, reason, cooldownEndsAt }
    //   { success: true, status: 'expired', jarId }
    //   { success: false, code }
    registerTap(gameState, playerId, registeredPlayerIds) {
        if (!this._requireRegisteredPlayer(playerId, registeredPlayerIds)) {
            return { success: false, code: 'not_registered' };
        }
        const state = this._ensure(gameState);
        const jar = state.currentJar;
        if (!jar) return { success: false, code: 'no_jar' };

        const now = Date.now();
        if (now > jar.expiresAt) {
            state.currentJar = null;
            return { success: true, status: 'expired', jarId: jar.jarId };
        }

        // Idempotent: first tap from a given player wins. Later taps from the
        // same player do NOT overwrite the recorded timestamp (protects against
        // the 1/s tap_wish_jar rate-limit being used to bring a player's
        // timestamp back into sync after their partner taps late).
        if (jar.pendingTaps[playerId] == null) {
            jar.pendingTaps[playerId] = now;
        }

        const tappers = Object.keys(jar.pendingTaps);
        const distinct = tappers.filter(pid => registeredPlayerIds.includes(pid));
        if (distinct.length < 2) {
            return { success: true, status: 'waiting', jarId: jar.jarId, tappedBy: playerId };
        }

        // Both registered players have tapped — evaluate the sync window using
        // SERVER timestamps only.
        const t1 = jar.pendingTaps[distinct[0]];
        const t2 = jar.pendingTaps[distinct[1]];
        const delta = Math.abs(t1 - t2);
        // V4.1 (P3-2): capture the actual tap pair so the server can credit
        // the memory to the players who tapped, not just every registered
        // player (which would credit disconnected ghosts).
        const tappedBy = distinct.slice(0, 2);
        if (delta <= DEFAULTS.JAR_SYNC_MS) {
            return this._resolveJarSuccess(gameState, jar, delta, tappedBy);
        } else {
            return this._resolveJarFailure(gameState, jar, delta, tappedBy);
        }
    }

    _resolveJarSuccess(gameState, jar, syncDeltaMs, tappedBy = []) {
        const state = this._ensure(gameState);
        // Atomic null-out BEFORE awarding rewards so repeat taps on the same
        // jarId get 'no_jar' rather than double-minting a payout.
        if (!state.currentJar || state.currentJar.jarId !== jar.jarId) {
            return { success: false, code: 'no_jar' };
        }
        state.currentJar = null;
        state.wishJarsOpenedTotal += 1;

        const rewards = {
            loveTokens:  5,
            gems:        Math.random() < 0.2 ? 1 : 0,
            wearableId:  WISH_WEARABLE_POOL[Math.floor(Math.random() * WISH_WEARABLE_POOL.length)]
        };

        return {
            success: true,
            status:  'opened',
            jarId:   jar.jarId,
            rewards,
            syncDeltaMs,
            tappedBy
        };
    }

    _resolveJarFailure(gameState, jar, syncDeltaMs, tappedBy = []) {
        const state = this._ensure(gameState);
        if (!state.currentJar || state.currentJar.jarId !== jar.jarId) {
            return { success: false, code: 'no_jar' };
        }
        // Clear the jar (wishes retained; a fresh jar must be re-earned via
        // new discoveries per spec). Apply the 60s cooldown to prevent a
        // immediate re-earn spam.
        const now = Date.now();
        state.currentJar = null;
        state.jarCooldownUntil = now + DEFAULTS.JAR_COOLDOWN_MS;

        return {
            success: true,
            status:  'failed',
            jarId:   jar.jarId,
            reason:  `Out of sync by ${syncDeltaMs}ms (window ${DEFAULTS.JAR_SYNC_MS}ms)`,
            cooldownEndsAt: state.jarCooldownUntil,
            tappedBy
        };
    }

    // --- Maintenance -----------------------------------------------------------

    // Expire aged wishes + an expired jar. Called from the decay loop.
    // Returns { expiredWishIds: [...], expiredJarId: string|null } for any
    // downstream broadcasting the caller wants to do.
    expireWishes(gameState) {
        const state = this._ensure(gameState);
        const now = Date.now();
        const expiredWishIds = [];
        // V4.1 (P1-2): prune the process-wide hideCooldowns Map on every
        // decay-loop tick so it cannot grow unbounded.
        this._pruneHideCooldowns(now);

        // V4.1 (B-7): also surface which author each expired wish belonged to
        // so the server can notify them.
        const expiredWishes = [];
        for (const [pid, w] of Object.entries(state.activeWishes)) {
            if (w.expiresAt <= now) {
                expiredWishIds.push(w.wishId);
                expiredWishes.push({ wishId: w.wishId, authorId: pid });
                delete state.activeWishes[pid];
            }
        }

        let expiredJarId = null;
        if (state.currentJar && state.currentJar.expiresAt <= now) {
            expiredJarId = state.currentJar.jarId;
            state.currentJar = null;
        }

        // Trim recentDiscoveries to the 24h window we care about (keeps the
        // array small and ensures jar-condition checks remain correct).
        const jarCutoff = now - DEFAULTS.JAR_WINDOW_MS;
        if (state.recentDiscoveries.length > 0) {
            state.recentDiscoveries = state.recentDiscoveries
                .filter(d => d.discoveredAt >= jarCutoff)
                .slice(-DEFAULTS.MAX_RECENT_DISCOVERIES);
        }

        return { expiredWishIds, expiredJarId, expiredWishes };
    }

    // --- Persistence (sibling-module API) --------------------------------------
    // The authoritative wish state lives on gameState.wishSystem (spec). The
    // in-process hideCooldowns Map is intentionally NOT persisted — it is a
    // rate-limit cache, not state, and persisting it risks an unbounded save
    // payload (see P1-2 / P3-1 fixes).
    serialize() {
        return {};
    }

    deserialize(_data) {
        // No-op: hideCooldowns is intentionally not restored across restarts.
    }
}

module.exports = WishSystem;
module.exports.WishSystem = WishSystem;
module.exports.VALID_SPOT_IDS = VALID_SPOT_IDS;
module.exports.SPOT_TRIGGER_ACTIONS = SPOT_TRIGGER_ACTIONS;
module.exports.WISH_WEARABLE_POOL = WISH_WEARABLE_POOL;
module.exports.WISH_DEFAULTS = DEFAULTS;
