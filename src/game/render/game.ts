import { Application, Container, UPDATE_PRIORITY, type Ticker } from "pixi.js";
import type { BubbleShooterEngine } from "../engine";
import { GameTextures } from "./textures";
import { SceneLayers } from "./layers";
import { HudLayer } from "./hud";
import { OverlaysLayer } from "./overlays";

const FONT_SAMPLES = [
  "900 40px Bungee",
  "900 30px Bungee",
  "700 30px Outfit",
  "800 30px Outfit",
  "800 25px Bungee",
  "400 12px Outfit",
];

async function loadFonts() {
  try {
    await Promise.all(FONT_SAMPLES.map((f) => document.fonts.load(f)));
  } catch {
    // fonts are decorative; rendering continues with fallbacks
  }
}

export class PixiGame {
  private root: Container;
  private shake: Container;
  private textures: GameTextures | null = null;
  private layers!: SceneLayers;
  private hud!: HudLayer;
  private overlays!: OverlaysLayer;
  private lastW = 0;
  private lastH = 0;
  private readonly engineTick = (t: Ticker) => this.engine.tick(t.deltaMS / 1000);
  private readonly syncTick = () => this.sync();

  constructor(
    private app: Application,
    private engine: BubbleShooterEngine,
  ) {
    this.root = new Container();
    this.shake = new Container();
    this.root.addChild(this.shake);
    this.app.stage.addChild(this.root);
  }

  async init() {
    await loadFonts();
    this.textures = GameTextures.create();
    this.layers = new SceneLayers(this.shake, this.textures);
    this.hud = new HudLayer(this.shake, this.textures, this.engine);
    this.overlays = new OverlaysLayer(this.shake, this.textures, this.engine);
    this.app.ticker.add(this.engineTick, undefined, UPDATE_PRIORITY.HIGH);
    this.app.ticker.add(this.syncTick);
  }

  private sync() {
    const v = this.engine;
    const l = v.layout;
    if (l.LW !== this.lastW || l.LH !== this.lastH) {
      this.lastW = l.LW;
      this.lastH = l.LH;
      this.relayout();
    }
    this.root.position.set(v.ox, v.oy);
    this.root.scale.set(v.sc);
    this.shake.position.set(v.fx.csx, v.fx.csy);
    const t = this.textures!;
    this.layers.sync(v, t);
    this.hud.sync(v, t);
    this.overlays.sync(v);
  }

  private relayout() {
    const t = this.textures!;
    this.layers.relayout(this.engine, t);
    this.hud.relayout(this.engine, t);
    this.overlays.relayout(this.engine, t);
  }

  destroy() {
    this.app.ticker.remove(this.engineTick);
    this.app.ticker.remove(this.syncTick);
    this.root.destroy({ children: true });
    this.textures?.destroy();
  }
}
