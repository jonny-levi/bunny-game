import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
export const redisSub = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });

redis.on('error', (err) => console.error('Redis error:', err.message));
redisSub.on('error', (err) => console.error('Redis sub error:', err.message));

export async function connectRedis() {
  await redis.connect();
  await redisSub.connect();
  console.log('✅ Redis connected');
}

export async function disconnectRedis() {
  redis.disconnect();
  redisSub.disconnect();
}

// Publish family event
export function publishEvent(familyId: string, data: object) {
  redis.publish(`family:${familyId}:events`, JSON.stringify(data));
}
