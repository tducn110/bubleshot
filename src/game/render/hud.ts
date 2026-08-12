import { Container, NineSliceSprite, Rectangle, Sprite, Text, type TextStyleFontWeight, type Texture } from "pixi.js";
import type { GameView } from "../types";
import type { BubbleShooterEngine } from "../engine";
import { TEX_BR, type GameTextures } from "./textures";

type Fill = string | { color: string; alpha: number };

function island(t: Texture, x: number, y: number, w: number, h: number): NineSliceSprite {
  return new NineSliceSprite({
    texture: t,
    leftWidth: 16,
    rightWidth: 16,
    topHeight: 16,
    bottomHeight: 16,
    x,
    y,
    width: w,
    height: h,
  });
}

function label(
  text: string,
  family: string,
  size: number,
  weight: number,
  fill: Fill,
  x: number,
  y: number,
  align: 0 | 0.5 | 1 = 0,
): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: family,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fontSize: size,
      fill,
      textBaseline: "middle",
    },
    anchor: { x: align, y: 0.5 },
  });
  t.position.set(x, y);
  return t;
}

const PRESSURE_DOTS = 4;

export class HudLayer {
  private root = new Container();
  private islandL!: NineSliceSprite;
  private islandR!: NineSliceSprite;
  private stageVal!: Text;
  private scoreT!: Text;
  private movesT!: Text;
  private nextBubble!: Sprite;
  private pausePill!: Sprite;
  private dots: Sprite[] = [];
  private combo: Text;
  private last = {
    stage: -1,
    score: "",
    moves: "",
    movesColor: "",
    remaining: -1,
    next: -1,
    combo: -1,
  };

  constructor(parent: Container, t: GameTextures, private engine: BubbleShooterEngine) {
    parent.addChild(this.root);
    this.combo = this.makeCombo();
  }

  private makeCombo(): Text {
    return new Text({
      text: "",
      style: {
        fontFamily: "Bungee",
        fontWeight: "900",
        fontSize: 36,
        fill: { color: "#ffdd6e", alpha: 0.96 },
        dropShadow: { color: "#000000", blur: 12, distance: 2, angle: Math.PI / 2 },
        textBaseline: "middle",
      },
      anchor: { x: 0.5, y: 0.5 },
    });
  }

  relayout(v: GameView, t: GameTextures) {
    for (const c of this.root.children) c.destroy();
    this.combo = this.makeCombo();
    const l = v.layout;
    const wide = l.LW > 700;
    const lx = wide ? 30 : l.BOARD_LEFT;
    const lw = wide ? 128 : 130;
    const rx = wide ? l.LW - 164 : l.NEXT_X - 65;
    const rw = wide ? 134 : 130;
    const nbR = l.R * 0.86;
    const px = wide ? l.LW - 118 : l.BOARD_LEFT + l.COLS * l.R * 2 - 76;
    const py = wide ? 300 : 278;

    this.islandL = island(t.panel, lx, 26, lw, 138);
    this.islandR = island(t.panel, rx, 26, rw, 186);
    this.stageVal = label(
      String(v.stage).padStart(2, "0"),
      "Bungee",
      24,
      900,
      "#FFCB3D",
      lx + 18,
      78,
    );
    this.scoreT = label(
      String(v.score).padStart(5, "0"),
      "Bungee",
      wide ? 30 : 22,
      900,
      "#ffffff",
      lx + 18,
      132,
    );
    this.movesT = label(
      String(v.moves).padStart(2, "0"),
      "Bungee",
      22,
      900,
      "#ffffff",
      rx + rw / 2,
      82,
      0.5,
    );

    // Pressure dots: light up as the pressure row approaches.
    this.dots = [];
    for (let i = 0; i < PRESSURE_DOTS; i++) {
      const d = new Sprite({
        texture: t.dot,
        anchor: 0.5,
        alpha: 0.18,
        scale: 0.34,
      });
      d.position.set(rx + rw / 2 + (i - (PRESSURE_DOTS - 1) / 2) * 24, 126);
      this.dots.push(d);
    }

    const ring = new Sprite({ texture: t.dot, anchor: 0.5, alpha: 0.24, width: 2 * (nbR + 7), height: 2 * (nbR + 7) });
    ring.position.set(rx + rw / 2, 176);
    this.nextBubble = new Sprite({
      texture: t.bubble[v.nxt],
      anchor: 0.5,
      scale: nbR / TEX_BR,
    });
    this.nextBubble.position.set(rx + rw / 2, 176);

    // Pause pill owns its own hitbox; the engine never sees these pixels.
    this.pausePill = new Sprite({ texture: t.pause, x: px, y: py });
    this.pausePill.eventMode = "static";
    this.pausePill.hitArea = new Rectangle(-8, -18, 96, 44);
    this.pausePill.cursor = "pointer";
    this.pausePill.on("pointerdown", () => {
      this.engine.consumeNextDown();
      this.engine.togglePause();
    });

    this.root.addChild(
      this.islandL,
      label("STAGE", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.6 }, lx + 18, 48),
      this.stageVal,
      this.scoreT,
      this.islandR,
      label("SHOTS", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.6 }, rx + rw / 2, 50, 0.5),
      this.movesT,
      ...this.dots,
      ring,
      this.nextBubble,
      this.pausePill,
      this.combo,
    );

    this.last.stage = -1;
    this.last.score = "";
    this.last.moves = "";
    this.last.movesColor = "";
    this.last.remaining = -1;
    this.last.next = -1;
    this.last.combo = -1;
  }

  sync(v: GameView, t: GameTextures) {
    if (v.stage !== this.last.stage) {
      this.stageVal.text = String(v.stage).padStart(2, "0");
      this.last.stage = v.stage;
    }
    const score = String(v.score).padStart(5, "0");
    if (score !== this.last.score) {
      this.scoreT.text = score;
      this.last.score = score;
    }
    const moves = String(v.moves).padStart(2, "0");
    if (moves !== this.last.moves) {
      this.movesT.text = moves;
      this.last.moves = moves;
    }
    const movesColor = v.moves < 7 ? "#FF7188" : "#ffffff";
    if (movesColor !== this.last.movesColor) {
      this.movesT.style.fill = movesColor;
      this.last.movesColor = movesColor;
    }
    // Pressure dots: lit dots = completed shots since the last row.
    const remaining = Math.max(0, v.rowRemaining);
    if (remaining !== this.last.remaining) {
      this.last.remaining = remaining;
      const lit = Math.max(0, v.rowEvery - remaining);
      const urgent = remaining <= 2;
      for (let i = 0; i < this.dots.length; i++) {
        const on = i < lit;
        this.dots[i].alpha = on ? 1 : 0.18;
        this.dots[i].tint = on ? (urgent ? "#FF4D6D" : "#FFCB3D") : "#ffffff";
      }
    }
    if (v.nxt !== this.last.next) {
      this.nextBubble.texture = t.bubble[v.nxt];
      this.last.next = v.nxt;
    }
    // Combo badge lives on the gameplay, positioned where the pop happened.
    const combo = Math.max(1, v.combo);
    if (combo !== this.last.combo) {
      this.last.combo = combo;
    }
    const ca = v.fx.comboA;
    this.combo.text = `COMBO x${combo}`;
    this.combo.visible = ca.alpha > 0;
    if (ca.alpha > 0) {
      this.combo.position.set(ca.x, ca.y);
      this.combo.alpha = ca.alpha;
      this.combo.scale.set(1 + (1 - ca.alpha) * 0.25);
    }
  }
}
