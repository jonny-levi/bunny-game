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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    LoginScene,
    LivingRoomScene,
    KitchenScene,
    BathroomScene,
    GardenScene,
    BedroomScene,
    VetScene,
    NestScene,
    HUDScene,
  ],
};

new Phaser.Game(config);
