import Phaser from 'phaser';

export class StatBar extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private barWidth: number;
  private value = 100;

  constructor(scene: Phaser.Scene, x: number, y: number, labelText: string, color: number, width = 120) {
    super(scene, x, y);
    this.barWidth = width;

    this.label = scene.add.text(0, 0, labelText, {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#fff4e0',
    }).setOrigin(0, 0.5);
    this.add(this.label);

    this.bg = scene.add.rectangle(60, 0, width, 10, 0x222222, 0.6).setOrigin(0, 0.5);
    this.bg.setStrokeStyle(1, 0x444444);
    this.add(this.bg);

    this.fill = scene.add.rectangle(60, 0, width, 10, color).setOrigin(0, 0.5);
    this.add(this.fill);

    scene.add.existing(this);
  }

  setValue(v: number) {
    this.value = Phaser.Math.Clamp(v, 0, 100);
    this.fill.width = (this.value / 100) * this.barWidth;
    // Color shift when low
    if (this.value < 20) this.fill.setFillStyle(0xff0000);
  }

  getValue() { return this.value; }
}
