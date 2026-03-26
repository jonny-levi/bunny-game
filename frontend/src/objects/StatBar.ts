import Phaser from 'phaser';

export class StatBar extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private barWidth: number;
  private barColor: number;
  private value = 100;

  constructor(scene: Phaser.Scene, x: number, y: number, labelText: string, color: number, width = 100) {
    super(scene, x, y);
    this.barWidth = width;
    this.barColor = color;

    this.label = scene.add.text(0, 0, labelText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add(this.label);

    this.bg = scene.add.rectangle(50, 0, width, 8, 0x333333, 0.6).setOrigin(0, 0.5);
    this.bg.setStrokeStyle(1, 0x555555, 0.4);
    this.add(this.bg);

    this.fill = scene.add.rectangle(50, 0, width, 8, color).setOrigin(0, 0.5);
    this.add(this.fill);

    scene.add.existing(this);
  }

  setValue(v: number) {
    this.value = Phaser.Math.Clamp(v, 0, 100);
    this.fill.width = (this.value / 100) * this.barWidth;
    if (this.value < 20) {
      this.fill.setFillStyle(0xff3333);
    } else {
      this.fill.setFillStyle(this.barColor);
    }
  }

  getValue() { return this.value; }
}
