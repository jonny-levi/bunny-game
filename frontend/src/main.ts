import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { HUDScene } from './scenes/HUDScene';
import { LivingRoomScene } from './scenes/LivingRoomScene';
import { KitchenScene } from './scenes/KitchenScene';
import { BathroomScene } from './scenes/BathroomScene';
import { GardenScene } from './scenes/GardenScene';
import { BedroomScene } from './scenes/BedroomScene';
import { VetScene } from './scenes/VetScene';
import { NestScene } from './scenes/NestScene';
import { OnboardingNestScene } from './scenes/OnboardingNestScene';
import { MinigamesScene } from './scenes/MinigamesScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 520 },
    max: { width: 1280, height: 900 },
  },
  scene: [
    BootScene,
    LoginScene,
    OnboardingNestScene,
    LivingRoomScene,
    KitchenScene,
    BathroomScene,
    GardenScene,
    BedroomScene,
    VetScene,
    NestScene,
    MinigamesScene,
    HUDScene,
  ],
};

function showRendererFallback(message: string) {
  const container = document.getElementById('game-container');
  if (!container || document.getElementById('renderer-fallback')) return;

  container.innerHTML = '';
  const fallback = document.createElement('div');
  fallback.id = 'renderer-fallback';
  fallback.setAttribute('role', 'alert');
  fallback.style.cssText = [
    'width:100%',
    'height:100%',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'background:#ffe6c8',
    'color:#5f315c',
    'font-family:Nunito,Arial,sans-serif',
    'text-align:center',
  ].join(';');
  fallback.innerHTML = '<div><h1 style="margin:0 0 12px;font-size:28px;color:#f15f9b">Bunny Family</h1><p style="margin:0;font-size:16px;line-height:1.4">' + message + '</p></div>';
  container.appendChild(fallback);
}

try {
  const game = new Phaser.Game(config);
  game.events.once(Phaser.Core.Events.READY, () => {
    const canvas = game.canvas;
    canvas?.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      showRendererFallback('The graphics renderer stopped responding. Refresh the page to restart the game.');
    });
  });
} catch (error) {
  console.error('Failed to start Bunny Family renderer', error);
  showRendererFallback('The game could not start its graphics renderer. Refresh the page or try another browser.');
}
