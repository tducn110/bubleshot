import { Container, Sprite, Text, type TextStyleOptions } from "pixi.js";
import type { GameView } from "../types";
import { SpritePool } from "./pools";
import {
  DOT_R,
  TEX_BR,
  TRAJ_R,
  makeBackgroundTexture,
  makeDangerLineTexture,
  type GameTextures,
} from "./textures";

function popupStyle(big: boolean, color: string): TextStyleOptions {
  return {
    fontFamily: big ? "Bungee" : "Outfit",
    fontWeight: "900",
    fontSize: big ? 38 : 20,
    fill: color,
    stroke: { color: 0x134872, width: big ? 5 : 3, alpha: 0.48 },
    dropShadow: { color, blur: 12, distance: 0, alpha: 1 },
    textBaseline: "middle",
  };
}

export class SceneLayers {
  private bg: Sprite;
  private dangerLine: Sprite;
  private dangerLabel: Sprite;
  private boardLayer = new Container();
  private fxLayer = new Container();
  private shotLayer = new Container();
  private boardSprites = new Map<string, Sprite>();
  private boardPool = new SpritePool(this.boardLayer);
  private popSprites: Sprite[] = [];
  private popPool = new SpritePool(this.fxLayer);
  private dropSprites: Sprite[] = [];
  private dropPool = new SpritePool(this.fxLayer);
  private partSprites: Sprite[] = [];
  private partPool = new SpritePool(this.fxLayer);
  private dotSprites: Sprite[] = [];
  private dotPool = new SpritePool(this.shotLayer);
  private popupTexts: Text[] = [];
  private popupKeys: string[] = [];
  private popupFree: Text[] = [];
  private shotSprite: Sprite;
  private shooterSprite: Sprite;
  private bgTex: ReturnType<typeof makeBackgroundTexture> | null = null;
  private dangerTex: ReturnType<typeof makeDangerLineTexture> | null = null;
  private lastBoardVersion = -1;
  private lastNear = false;
  private freshKey: string | null = null;
  private freshColor = 0;
  private lastShotC = -1;
  private lastCur = -1;

  constructor(parent: Container, t: GameTextures) {
    this.bg = new Sprite();
    this.dangerLine = new Sprite();
    this.dangerLabel = new Sprite({ texture: t.dangerLabel, anchor: 0.5 });
    parent.addChild(
      this.bg,
      this.boardLayer,
      this.fxLayer,
      this.shotLayer,
      this.dangerLine,
      this.dangerLabel,
    );
    this.shotSprite = new Sprite({ anchor: 0.5 });
    this.shooterSprite = new Sprite({ anchor: 0.5 });
    this.shotLayer.addChild(this.shotSprite, this.shooterSprite);
  }

  relayout(v: GameView, t: GameTextures) {
    const l = v.layout;
    this.bgTex?.destroy(true);
    this.bgTex = makeBackgroundTexture(l);
    this.bg.texture = this.bgTex;
    this.lastNear = this.near(v);
    this.rebuildDanger(v, t);
    const baseScale = l.R / TEX_BR;
    for (const [key, s] of this.boardSprites) {
      const [r, c] = key.split(",").map(Number);
      const p = l.gToW(r, c);
      s.position.set(p.x, p.y);
      s.scale.set(baseScale);
    }
    this.lastBoardVersion = -1;
    this.freshKey = null;
    this.shooterSprite.position.set(l.SHOOTER_X, l.SHOOTER_Y - 2);
  }

  sync(v: GameView, t: GameTextures) {
    const l = v.layout;
    const baseScale = l.R / TEX_BR;
    if (v.board.version !== this.lastBoardVersion) this.syncBoard(v, t, baseScale);
    const nb = v.fx.newBubble;
    if (nb) {
      const key = `${nb.row},${nb.col}`;
      const s = this.boardSprites.get(key);
      if (s) {
        const color = v.board.cell(nb.row, nb.col) ?? 0;
        if (this.freshKey && this.freshKey !== key) {
          const old = this.boardSprites.get(this.freshKey);
          if (old) {
            old.texture = t.bubble[this.freshColor];
            old.scale.set(baseScale);
          }
        }
        s.texture = t.bubbleGlow[color];
        s.scale.set(baseScale * (1 + Math.sin(nb.t * Math.PI) * 0.16));
        this.freshKey = key;
        this.freshColor = color;
      }
    } else if (this.freshKey) {
      const s = this.boardSprites.get(this.freshKey);
      if (s) {
        s.texture = t.bubble[this.freshColor];
        s.scale.set(baseScale);
      }
      this.freshKey = null;
    }
    this.syncPops(v, t, baseScale);
    this.syncDrops(v, t, baseScale);
    this.syncParts(v, t);
    this.syncPopups(v);
    this.syncShot(v, t, baseScale);
    this.syncTraj(v, t);
    this.syncDanger(v, t);
  }

  private near(v: GameView): boolean {
    return v.board.rows.some(
      (row, r) => r >= v.layout.DANGER_ROW - 2 && row.some((c) => c !== null),
    );
  }

  private rebuildDanger(v: GameView, t: GameTextures) {
    this.dangerTex?.destroy(true);
    this.dangerTex = makeDangerLineTexture(v.layout, this.lastNear);
    this.dangerLine.texture = this.dangerTex;
    this.dangerLine.position.set(v.layout.BOARD_LEFT, v.layout.DANGER_Y);
    this.dangerLabel.position.set(v.layout.BOARD_CENTER_X, v.layout.DANGER_Y - 10);
  }

  private syncBoard(v: GameView, t: GameTextures, baseScale: number) {
    const { board, layout } = v;
    const seen = new Set<string>();
    for (let r = 0; r < board.rows.length; r++) {
      for (let c = 0; c < layout.COLS; c++) {
        const col = board.cell(r, c);
        if (col === null) continue;
        const key = `${r},${c}`;
        seen.add(key);
        let s = this.boardSprites.get(key);
        if (!s) {
          s = this.boardPool.take(t.bubble[col]);
          this.boardSprites.set(key, s);
        } else if (s.texture !== t.bubble[col]) {
          s.texture = t.bubble[col];
        }
        const p = layout.gToW(r, c);
        s.position.set(p.x, p.y);
        s.scale.set(baseScale);
      }
    }
    for (const [key, s] of this.boardSprites) {
      if (!seen.has(key)) {
        this.boardSprites.delete(key);
        this.boardPool.put(s);
      }
    }
    this.lastBoardVersion = board.version;
  }

  private syncPops(v: GameView, t: GameTextures, baseScale: number) {
    const pops = v.fx.pops;
    while (this.popSprites.length < pops.length)
      this.popSprites.push(this.popPool.take(t.bubbleGlow[pops[this.popSprites.length].c]));
    while (this.popSprites.length > pops.length) this.popPool.put(this.popSprites.pop()!);
    for (let i = 0; i < pops.length; i++) {
      const b = pops[i];
      const s = this.popSprites[i];
      s.position.set(b.x, b.y);
      s.scale.set(baseScale * b.scale);
      s.alpha = b.alpha;
    }
  }

  private syncDrops(v: GameView, t: GameTextures, baseScale: number) {
    const drops = v.fx.drops;
    while (this.dropSprites.length < drops.length)
      this.dropSprites.push(this.dropPool.take(t.bubble[drops[this.dropSprites.length].c]));
    while (this.dropSprites.length > drops.length) this.dropPool.put(this.dropSprites.pop()!);
    for (let i = 0; i < drops.length; i++) {
      const b = drops[i];
      const s = this.dropSprites[i];
      s.position.set(b.x, b.y);
      s.scale.set(baseScale);
      s.alpha = b.alpha;
    }
  }

  private syncParts(v: GameView, t: GameTextures) {
    const parts = v.fx.parts;
    while (this.partSprites.length < parts.length) this.partSprites.push(this.partPool.take(t.whiteDot));
    while (this.partSprites.length > parts.length) this.partPool.put(this.partSprites.pop()!);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const s = this.partSprites[i];
      s.position.set(p.x, p.y);
      s.scale.set(p.r / DOT_R);
      s.alpha = p.alpha;
      s.tint = p.color;
    }
  }

  private syncPopups(v: GameView) {
    const popups = v.fx.popups;
    while (this.popupTexts.length < popups.length) {
      const tx =
        this.popupFree.pop() ??
        new Text({
          text: "",
          style: popupStyle(false, "#ffffff"),
          anchor: { x: 0.5, y: 0.5 },
        });
      this.fxLayer.addChild(tx);
      this.popupTexts.push(tx);
      this.popupKeys.push("");
    }
    while (this.popupTexts.length > popups.length) {
      const tx = this.popupTexts.pop()!;
      this.popupKeys.pop();
      tx.visible = false;
      this.popupFree.push(tx);
    }
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      const tx = this.popupTexts[i];
      const key = `${p.text}|${p.big}|${p.color}`;
      if (key !== this.popupKeys[i]) {
        this.popupKeys[i] = key;
        tx.text = p.text;
        tx.style = popupStyle(p.big, p.color);
        tx.visible = true;
      }
      tx.position.set(p.x, p.y);
      tx.alpha = p.alpha;
    }
  }

  private syncShot(v: GameView, t: GameTextures, baseScale: number) {
    const sh = v.shot;
    this.shotSprite.visible = !!sh;
    if (sh) {
      if (sh.c !== this.lastShotC) {
        this.shotSprite.texture = t.bubbleGlow[sh.c];
        this.lastShotC = sh.c;
      }
      this.shotSprite.position.set(sh.x, sh.y);
      this.shotSprite.scale.set(baseScale);
    }
    this.shooterSprite.visible = !sh;
    if (v.cur !== this.lastCur) {
      this.shooterSprite.texture = t.bubbleGlow[v.cur];
      this.lastCur = v.cur;
    }
    if (!sh) {
      this.shooterSprite.position.set(v.layout.SHOOTER_X, v.layout.SHOOTER_Y - 2);
      this.shooterSprite.scale.set(baseScale * 1.04);
    }
  }

  private syncTraj(v: GameView, t: GameTextures) {
    const traj = v.traj;
    const count = v.phase === "READY" ? traj.length : 0;
    while (this.dotSprites.length < count) this.dotSprites.push(this.dotPool.take(t.trajDot));
    while (this.dotSprites.length > count) this.dotPool.put(this.dotSprites.pop()!);
    for (let i = 0; i < count; i++) {
      const d = this.dotSprites[i];
      const p = traj[i];
      const tt = i / traj.length;
      d.position.set(p.x, p.y);
      d.alpha = 0.78 - tt * 0.5;
      d.scale.set((4.1 - tt * 1.9) / TRAJ_R);
    }
  }

  private syncDanger(v: GameView, t: GameTextures) {
    const near = this.near(v);
    if (near !== this.lastNear) {
      this.lastNear = near;
      this.rebuildDanger(v, t);
    }
    this.dangerLine.alpha = near ? 0.62 + Math.sin(v.fx.pulse * 6) * 0.18 : 0.42;
  }
}
