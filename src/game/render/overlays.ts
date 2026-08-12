import { Container, NineSliceSprite, Rectangle, Sprite, Text, type TextStyleFontWeight } from "pixi.js";
import type { GameView } from "../types";
import type { BubbleShooterEngine } from "../engine";
import type { GameTextures } from "./textures";

function card(t: GameTextures, w: number, h: number, red: boolean): NineSliceSprite {
  return new NineSliceSprite({
    texture: red ? t.cardRed : t.card,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 18,
    bottomHeight: 18,
    width: w,
    height: h,
    anchor: 0.5,
  });
}

function title(text: string, size: number, color: string, y: number): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: "Outfit",
      fontWeight: "700",
      fontSize: size,
      fill: color,
      dropShadow: { color, blur: 16, distance: 0, alpha: 1 },
      textBaseline: "middle",
    },
    anchor: 0.5,
  });
  t.position.set(0, y);
  return t;
}

function line(text: string, size: number, weight: number, fill: string, y: number): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: "Outfit",
      fontWeight: weight as unknown as TextStyleFontWeight,
      fontSize: size,
      fill,
      textBaseline: "middle",
    },
    anchor: 0.5,
  });
  t.position.set(0, y);
  return t;
}

function button(
  t: GameTextures,
  x: number,
  y: number,
  w: number,
  h: number,
  labelText: string,
  color: string,
  onTap: () => void,
): Container {
  const c = new Container();
  const base = new NineSliceSprite({
    texture: t.pill,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 18,
    bottomHeight: 18,
    width: w,
    height: h,
    anchor: 0.5,
  });
  base.tint = color;
  const top = new NineSliceSprite({
    texture: t.pillTop,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 18,
    bottomHeight: 18,
    width: Math.max(1, w - 4),
    height: Math.max(1, h / 2 - 2),
    anchor: 0.5,
    alpha: 0.18,
  });
  top.position.set(0, -h / 4);
  const txt = new Text({
    text: labelText,
    style: {
      fontFamily: "Outfit",
      fontWeight: "800",
      fontSize: 13,
      fill: "#FFFFFF",
      textBaseline: "middle",
    },
    anchor: 0.5,
  });
  txt.position.set(0, h / 2 + 3);
  c.addChild(base, top, txt);
  c.position.set(x, y);
  c.eventMode = "static";
  c.hitArea = new Rectangle(-w / 2, -h / 2, w, h);
  c.cursor = "pointer";
  c.on("pointertap", onTap);
  c.on("pointerover", () => {
    base.tint = "#FFFFFF";
    txt.style.fill = "#0b2c52";
  });
  c.on("pointerout", () => {
    base.tint = color;
    txt.style.fill = "#FFFFFF";
  });
  return c;
}

export class OverlaysLayer {
  private root = new Container();
  private win: Container = new Container();
  private lose: Container = new Container();
  private pause: Container = new Container();
  private winScore!: Text;
  private winRank!: Text;
  private loseScore!: Text;
  private lastWinScore = "";
  private lastRank = "";
  private lastLoseScore = "";

  constructor(
    parent: Container,
    t: GameTextures,
    private engine: BubbleShooterEngine,
  ) {
    parent.addChild(this.root);
  }

  relayout(v: GameView, t: GameTextures) {
    for (const c of this.root.children) c.destroy();
    const l = v.layout;
    const cx = l.LW / 2;
    const cy = l.LH / 2;

    this.win = new Container();
    const dimW = new Sprite({ texture: t.dim, width: l.LW, height: l.LH, eventMode: "none" });
    this.win.addChild(dimW);
    const winCard = card(t, 280, 240, false);
    winCard.position.set(cx, cy);
    const winBox = new Container();
    winBox.position.set(cx, cy);
    winBox.addChild(
      title("LEVEL CLEAR!", 30, "#FFE04B", -82),
    );
    this.winRank = line("RANK 0 / 3", 12, 800, "rgba(197,235,255,.75)", -40);
    this.winScore = line("0", 26, 700, "#FFFFFF", 40);
    winBox.addChild(
      this.winRank,
      line("SCORE", 12, 400, "rgba(180,200,255,.6)", 10),
      this.winScore,
      button(t, -40, 78, 68, 36, "RETRY", "#E94560", () => this.engine.retry()),
      button(t, 40, 78, 68, 36, "NEXT", "#2DC653", () => this.engine.nextStage()),
    );
    this.win.addChild(winCard, winBox);
    this.win.visible = false;
    this.win.position.set(0, 0);

    this.lose = new Container();
    const dimL = new Sprite({ texture: t.dim, width: l.LW, height: l.LH, eventMode: "none" });
    this.lose.addChild(dimL);
    const loseCard = card(t, 260, 220, true);
    loseCard.position.set(cx, cy);
    const loseBox = new Container();
    loseBox.position.set(cx, cy);
    this.loseScore = line("0", 26, 700, "#FFFFFF", 4);
    loseBox.addChild(
      title("GAME OVER", 28, "#FF4D6D", -72),
      line("SCORE", 12, 400, "rgba(180,200,255,.6)", -30),
      this.loseScore,
      button(t, -38, 46, 64, 36, "RETRY", "#E94560", () => this.engine.retry()),
      button(t, 38, 46, 64, 36, "MENU", "#3ABFF8", () => this.engine.menu()),
    );
    this.lose.addChild(loseCard, loseBox);
    this.lose.visible = false;
    this.lose.position.set(0, 0);

    this.pause = new Container();
    const dimP = new Sprite({ texture: t.dimSoft, width: l.LW, height: l.LH, eventMode: "none" });
    this.pause.addChild(dimP);
    const pauseCard = card(t, 220, 140, false);
    pauseCard.position.set(cx, cy);
    const pauseBox = new Container();
    pauseBox.position.set(cx, cy);
    pauseBox.addChild(
      title("PAUSED", 30, "#FFFFFF", -22),
      button(t, 0, 30, 112, 40, "RESUME", "#3ABFF8", () => this.engine.resume()),
    );
    this.pause.addChild(pauseCard, pauseBox);
    this.pause.visible = false;
    this.pause.position.set(0, 0);

    this.root.addChild(this.win, this.lose, this.pause);
  }

  sync(v: GameView) {
    const winOn = v.phase === "WIN";
    const loseOn = v.phase === "LOSE";
    const pauseOn = v.phase === "PAUSED";
    this.win.visible = winOn;
    this.lose.visible = loseOn;
    this.pause.visible = pauseOn;
    if (winOn) {
      const s = v.score.toLocaleString();
      if (s !== this.lastWinScore) {
        this.winScore.text = s;
        this.lastWinScore = s;
      }
      const r = `RANK ${v.starsEarned} / 3`;
      if (r !== this.lastRank) {
        this.winRank.text = r;
        this.lastRank = r;
      }
    }
    if (loseOn) {
      const s = v.score.toLocaleString();
      if (s !== this.lastLoseScore) {
        this.loseScore.text = s;
        this.lastLoseScore = s;
      }
    }
  }
}
