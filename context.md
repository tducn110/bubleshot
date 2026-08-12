This file is a merged representation of the entire codebase, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
.figma/
  make/
    analyze-routes
    deploy
    deploy-preview
    dev
    dev.json
    format
    install
    langserver
    site.json
src/
  components/
    BubbleGame.tsx
  game/
    render/
      game.ts
      hud.ts
      layers.ts
      overlays.ts
      pools.ts
      textures.ts
    board.ts
    config.ts
    engine.ts
    fx.ts
    layout.ts
    types.ts
  App.tsx
  index.css
  main.tsx
  vite-env.d.ts
.gitattributes
.gitignore
.mise.toml
AGENTS.md
CLAUDE.md
index.html
package.json
tsconfig.json
vite.config.ts
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path=".figma/make/analyze-routes">
#!/usr/bin/env bash
set -euo pipefail

exec figma-analyze routes "$@"
</file>

<file path=".figma/make/deploy">
#!/usr/bin/env bash
set -euo pipefail
pnpm run build
figma make deploy --build-dir dist
</file>

<file path=".figma/make/deploy-preview">
#!/usr/bin/env bash
set -euo pipefail
# Build in development mode to emit sourcemaps.
pnpm run build --mode development
figma make deploy-preview --build-dir dist
</file>

<file path=".figma/make/dev">
#!/usr/bin/env bash
set -euo pipefail

pnpm run dev
</file>

<file path=".figma/make/dev.json">
{
  // Files whose changes trigger the install script + dev server restart.
  // Glob syntax: doublestar (supports **, *, ?, [abc], {a,b}). Paths are
  // repo-relative and case-sensitive. `.mise.toml` and the scripts under
  // `.figma/make/` are always watched regardless of these lists.
  //
  // Each key accepts a shorthand array of globs:
  //   "installOn": ["package.json"]
  // or an object with includes/excludes:
  //   "installOn": { "includes": ["**/*.json"], "excludes": ["test/**"] }
  //
  // Only list files that affect the *toolchain or dependency tree* here —
  // NOT application source files. Vite's dev server already watches
  // application code (src/**/*) and config (vite.config.ts) via its own HMR
  // pipeline, so including them here would cause a redundant full restart.
  "installOn": [
    "package.json",
    "pnpm-lock.yaml"
  ],
  // Files whose changes trigger only a dev server restart (no install).
  "restartOn": []
}
</file>

<file path=".figma/make/format">
#!/usr/bin/env bash
set -euo pipefail

pnpm run format -- "$@"
</file>

<file path=".figma/make/install">
#!/usr/bin/env bash
set -euo pipefail

pnpm install --prefer-offline --no-frozen-lockfile
</file>

<file path=".figma/make/langserver">
#!/usr/bin/env bash
set -euo pipefail
exec pnpm dlx --package=@vtsls/language-server@^0.3.0 vtsls --stdio
</file>

<file path=".figma/make/site.json">
{
  "title": "Hyper Bubble Shooter",
  "description": "Experience a polished Bubble Shooter game with engaging mechanics and hyper-casual visuals, designed for players seeking fun and challenging arcade gameplay.",
  "robots": {
    "index": false
  },
  "accessibility": {
    "addBypassLinks": false,
    "ignoreReducedMotion": false
  }
}
</file>

<file path="src/components/BubbleGame.tsx">
import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { BubbleShooterEngine } from "../game/engine";
import { PixiGame } from "../game/render/game";

export default function BubbleGame() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let engine: BubbleShooterEngine | null = null;
    let game: PixiGame | null = null;

    void (async () => {
      const pixiApp = new Application();
      try {
        await pixiApp.init({
          preference: "webgl",
          antialias: true,
          resolution: 1,
          backgroundAlpha: 0,
          resizeTo: hostRef.current!,
        });
        if (disposed) {
          pixiApp.destroy(
            { removeView: true },
            { children: true, texture: true, textureSource: true },
          );
          return;
        }
        pixiApp.canvas.className = "game-canvas-canvas";
        hostRef.current!.appendChild(pixiApp.canvas);
        engine = new BubbleShooterEngine(pixiApp.canvas);
        game = new PixiGame(pixiApp, engine);
        await game.init();
      } catch {
        game?.destroy();
        engine?.destroy();
        pixiApp.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true },
        );
      }
    })();

    return () => {
      disposed = true;
      game?.destroy();
      engine?.destroy();
    };
  }, []);

  return (
    <div ref={hostRef} className="game-canvas" aria-label="Bubble Shooter game" />
  );
}
</file>

<file path="src/game/render/game.ts">
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
    this.hud = new HudLayer(this.shake, this.textures);
    this.overlays = new OverlaysLayer(this.shake, this.textures);
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
</file>

<file path="src/game/render/hud.ts">
import { Container, NineSliceSprite, Sprite, Text, type TextStyleFontWeight, type Texture } from "pixi.js";
import { ROW_EVERY } from "../config";
import type { GameView } from "../types";
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

export class HudLayer {
  private root = new Container();
  private islandL!: NineSliceSprite;
  private islandR!: NineSliceSprite;
  private stageT!: Text;
  private stageVal!: Text;
  private scoreT!: Text;
  private movesT!: Text;
  private comboLabel!: Text;
  private comboVal!: Text;
  private nextRowT!: Text;
  private remainingT!: Text;
  private barTrack!: Sprite;
  private barFill!: Sprite;
  private nextLabel!: Text;
  private nextBubble!: Sprite;
  private pausePill!: Sprite;
  private pauseT!: Text;
  private combo: Text;
  private last = {
    stage: -1,
    score: "",
    moves: "",
    movesColor: "",
    combo: -1,
    comboOn: false,
    remaining: -1,
    barW: -1,
    barColor: "",
    next: -1,
  };

  constructor(parent: Container, t: GameTextures) {
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
    const lw = wide ? 138 : 130;
    const rx = wide ? l.LW - 154 - 30 : l.NEXT_X - 65;
    const rw = wide ? 154 : 130;
    const bw = rw - 36;
    const bx = rx + 18;
    const nbR = l.R * 0.86;
    const px = wide ? l.LW - 110 : l.BOARD_LEFT + l.COLS * l.R * 2 - 76;

    this.islandL = island(t.panel, lx, 26, lw, 200);
    this.islandR = island(t.panel, rx, 26, rw, 238);
    this.stageT = label("STAGE", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, lx + 18, 52);
    this.stageVal = label(
      String(v.stage).padStart(2, "0"),
      "Bungee",
      30,
      900,
      "#FFCB3D",
      lx + 17,
      83,
    );
    this.scoreT = label(
      String(v.score).padStart(5, "0"),
      "Bungee",
      24,
      900,
      "#ffffff",
      lx + 17,
      140,
    );
    this.movesT = label(
      String(v.moves).padStart(2, "0"),
      "Bungee",
      25,
      900,
      v.moves < 7 ? "#FF7188" : "#ffffff",
      lx + 17,
      201,
    );
    this.comboLabel = label("COMBO", "Outfit", 12, 800, "#FFCB3D", lx + 18, 258);
    this.comboVal = label(`x${Math.max(1, v.combo)}`, "Bungee", 27, 900, "#FFCB3D", lx + 17, 289);

    this.nextRowT = label("NEXT ROW", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, rx + rw / 2, 53, 0.5);
    this.remainingT = label("", "Bungee", 22, 900, "#ffffff", rx + rw / 2, 83, 0.5);
    this.barTrack = new Sprite({
      texture: t.dot,
      x: bx,
      y: 128,
      anchor: { x: 0, y: 0.5 },
      width: bw,
      height: 12,
      alpha: 0.22,
    });
    this.barFill = new Sprite({
      texture: t.dot,
      x: bx,
      y: 128,
      anchor: { x: 0, y: 0.5 },
      height: 12,
    });
    this.nextLabel = label("NEXT", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, rx + rw / 2, 174, 0.5);
    this.nextBubble = new Sprite({
      texture: t.bubble[v.nxt],
      anchor: 0.5,
      scale: nbR / TEX_BR,
    });
    this.nextBubble.position.set(rx + rw / 2, 211);
    const ring = new Sprite({ texture: t.dot, anchor: 0.5, alpha: 0.24, width: 2 * (nbR + 7), height: 2 * (nbR + 7) });
    ring.position.copyFrom(this.nextBubble.position);
    this.pausePill = new Sprite({ texture: t.pause, x: px, y: 278 });
    this.pauseT = label("PAUSE", "Outfit", 12, 800, "#ffffff", px + 40, 294, 0.5);

    this.root.addChild(
      this.islandL,
      label("SCORE", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, lx + 18, 112),
      label("SHOTS", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, lx + 18, 169),
      this.stageT,
      this.stageVal,
      this.scoreT,
      this.movesT,
      this.comboLabel,
      this.comboVal,
      this.islandR,
      this.nextRowT,
      this.remainingT,
      this.barTrack,
      this.barFill,
      label("PRESSURE", "Outfit", 12, 800, { color: "#e0f9ff", alpha: 0.82 }, rx + rw / 2, 116, 0.5),
      this.nextLabel,
      ring,
      this.nextBubble,
      this.pausePill,
      this.pauseT,
      this.combo,
    );

    this.combo.position.set(l.LW / 2, 260);
    this.combo.visible = false;
    this.last.stage = -1;
    this.last.score = "";
    this.last.moves = "";
    this.last.movesColor = "";
    this.last.remaining = -1;
    this.last.barW = -1;
    this.last.barColor = "";
    this.last.next = -1;
    this.last.comboOn = false;
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
    const remaining = Math.max(0, v.shotsToRow);
    if (remaining !== this.last.remaining) {
      this.remainingT.text = `${remaining} ${remaining === 1 ? "SHOT" : "SHOTS"}`;
      const size = remaining === 0 ? 25 : 22;
      const fill =
        remaining === 0 ? "#FF607C" : remaining <= 2 ? "#FFCB3D" : "#ffffff";
      this.remainingT.style.fontSize = size;
      this.remainingT.style.fill = fill;
      this.last.remaining = remaining;
    }
    const progress = ROW_EVERY > 0 ? remaining / ROW_EVERY : 0;
    const barW = Math.max(7, this.barTrack.width * progress);
    if (barW !== this.last.barW) {
      this.barFill.width = barW;
      this.last.barW = barW;
    }
    const barColor =
      remaining === 0 ? "#FF4D6D" : remaining <= 2 ? "#FFB703" : "#3ABFF8";
    if (barColor !== this.last.barColor) {
      this.barFill.tint = barColor;
      this.last.barColor = barColor;
    }
    if (v.nxt !== this.last.next) {
      this.nextBubble.texture = t.bubble[v.nxt];
      this.last.next = v.nxt;
    }
    const comboOn = v.combo >= 2;
    if (comboOn !== this.last.comboOn) {
      const fill = comboOn ? "#FFCB3D" : { color: "#e0f9ff", alpha: 0.9 };
      const alpha = comboOn ? 1 : 0.42;
      this.comboLabel.style.fill = fill;
      this.comboVal.style.fill = fill;
      this.comboLabel.alpha = alpha;
      this.comboVal.alpha = alpha;
      this.last.comboOn = comboOn;
    }
    const combo = Math.max(1, v.combo);
    if (combo !== this.last.combo) {
      this.comboVal.text = `x${combo}`;
      this.last.combo = combo;
    }
    const ca = v.fx.comboA;
    this.combo.text = `COMBO x${combo}`;
    this.combo.visible = ca.alpha > 0;
    if (ca.alpha > 0) {
      this.combo.alpha = ca.alpha;
      this.combo.scale.set(1 + (1 - ca.alpha) * 0.25);
    }
  }
}
</file>

<file path="src/game/render/layers.ts">
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
</file>

<file path="src/game/render/overlays.ts">
import { Container, NineSliceSprite, Sprite, Text, type TextStyleFontWeight } from "pixi.js";
import type { GameView } from "../types";
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

  constructor(parent: Container, t: GameTextures) {
    parent.addChild(this.root);
  }

  relayout(v: GameView, t: GameTextures) {
    for (const c of this.root.children) c.destroy();
    const l = v.layout;
    const cx = l.LW / 2;
    const cy = l.LH / 2;

    this.win = new Container();
    const dimW = new Sprite({ texture: t.dim, width: l.LW, height: l.LH });
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
      button(t, -40, 78, 68, 36, "RETRY", "#E94560"),
      button(t, 40, 78, 68, 36, "NEXT", "#2DC653"),
      line("tap anywhere to continue", 11, 400, "rgba(255,255,255,.3)", 115),
    );
    this.win.addChild(winCard, winBox);
    this.win.visible = false;
    this.win.position.set(0, 0);

    this.lose = new Container();
    const dimL = new Sprite({ texture: t.dim, width: l.LW, height: l.LH });
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
      button(t, -38, 46, 64, 36, "RETRY", "#E94560"),
      button(t, 38, 46, 64, 36, "MENU", "#3ABFF8"),
      line("tap anywhere to retry", 11, 400, "rgba(255,255,255,.3)", 88),
    );
    this.lose.addChild(loseCard, loseBox);
    this.lose.visible = false;
    this.lose.position.set(0, 0);

    this.pause = new Container();
    const dimP = new Sprite({ texture: t.dimSoft, width: l.LW, height: l.LH });
    this.pause.addChild(dimP);
    const pauseCard = card(t, 220, 140, false);
    pauseCard.position.set(cx, cy);
    const pauseBox = new Container();
    pauseBox.position.set(cx, cy);
    pauseBox.addChild(
      title("PAUSED", 30, "#FFFFFF", -22),
      button(t, 0, 30, 112, 40, "RESUME", "#3ABFF8"),
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
</file>

<file path="src/game/render/pools.ts">
import { Sprite, type Container, type Texture } from "pixi.js";

export class SpritePool {
  private free: Sprite[] = [];

  constructor(private readonly parent: Container) {}

  take(texture: Texture): Sprite {
    let s = this.free.pop();
    if (s) {
      s.texture = texture;
      s.visible = true;
      s.alpha = 1;
      s.scale.set(1);
      s.tint = 0xffffff;
    } else {
      s = new Sprite({ texture, anchor: 0.5 });
      this.parent.addChild(s);
    }
    return s;
  }

  put(s: Sprite) {
    s.visible = false;
    this.free.push(s);
  }
}
</file>

<file path="src/game/render/textures.ts">
import { Texture } from "pixi.js";
import { COLORS } from "../config";
import type { Layout } from "../layout";

export const TEX_BR = 32;
export const TEX_BUBBLE = 96;
export const DOT_R = 14;
export const TRAJ_R = 6;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  return [cv, cv.getContext("2d")!];
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function roundRectTexture(w: number, h: number, r: number, fill: string, stroke?: { color: string; width: number }): Texture {
  const [cv, g] = canvas(w, h);
  rr(g, 0.5, 0.5, w - 1, h - 1, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke.color;
    g.lineWidth = stroke.width;
    g.stroke();
  }
  return Texture.from(cv);
}

function dotTexture(size: number, radius: number): Texture {
  const [cv, g] = canvas(size, size);
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, radius);
  grad.addColorStop(0, "rgba(255,255,255,.95)");
  grad.addColorStop(0.65, "rgba(255,255,255,.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, radius, 0, Math.PI * 2);
  g.fill();
  return Texture.from(cv);
}

function bubbleTexture(hex: string, glow: boolean): Texture {
  const [cv, g] = canvas(TEX_BUBBLE, TEX_BUBBLE);
  const c = TEX_BUBBLE / 2;
  g.save();
  g.shadowColor = "rgba(13,73,120,.32)";
  g.shadowBlur = TEX_BR * 0.26;
  g.shadowOffsetY = TEX_BR * 0.14;
  g.beginPath();
  g.arc(c, c, TEX_BR, 0, Math.PI * 2);
  g.fillStyle = hex;
  g.fill();
  g.restore();
  const grad = g.createRadialGradient(c - TEX_BR * 0.34, c - TEX_BR * 0.42, TEX_BR * 0.04, c, c, TEX_BR * 1.06);
  grad.addColorStop(0, "rgba(255,255,255,.86)");
  grad.addColorStop(0.18, "rgba(255,255,255,.32)");
  grad.addColorStop(0.55, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(23,43,97,.3)");
  g.beginPath();
  g.arc(c, c, TEX_BR, 0, Math.PI * 2);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = "rgba(255,255,255,.66)";
  g.lineWidth = 1.6;
  g.stroke();
  if (glow) {
    g.save();
    g.shadowColor = hex;
    g.shadowBlur = 18;
    g.beginPath();
    g.arc(c, c, TEX_BR * 0.92, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,.82)";
    g.stroke();
    g.restore();
  }
  return Texture.from(cv);
}

function pillTopTexture(): Texture {
  const [cv, g] = canvas(36, 36);
  rr(g, 0.5, 0.5, 35, 35, 18);
  g.fillStyle = "#FFFFFF";
  g.fill();
  g.clearRect(0, 18, 36, 18);
  return Texture.from(cv);
}

export class GameTextures {
  readonly bubble: Texture[];
  readonly bubbleGlow: Texture[];
  readonly whiteDot: Texture;
  readonly trajDot: Texture;
  readonly dot: Texture;
  readonly panel: Texture;
  readonly pause: Texture;
  readonly pill: Texture;
  readonly pillTop: Texture;
  readonly card: Texture;
  readonly cardRed: Texture;
  readonly dangerLabel: Texture;
  readonly dim: Texture;
  readonly dimSoft: Texture;

  private constructor() {
    this.bubble = COLORS.map((hex) => bubbleTexture(hex, false));
    this.bubbleGlow = COLORS.map((hex) => bubbleTexture(hex, true));
    this.whiteDot = dotTexture(32, DOT_R);
    this.trajDot = dotTexture(24, TRAJ_R);
    this.dot = roundRectTexture(32, 32, 16, "#FFFFFF");
    this.panel = roundRectTexture(32, 32, 16, "rgba(8,91,142,.24)", { color: "rgba(255,255,255,.42)", width: 1 });
    this.pause = roundRectTexture(80, 32, 16, "rgba(8,91,142,.50)", { color: "rgba(255,255,255,.44)", width: 1 });
    this.pill = roundRectTexture(36, 36, 18, "#FFFFFF");
    this.pillTop = pillTopTexture();
    this.card = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", { color: "rgba(100,140,255,.4)", width: 2 });
    this.cardRed = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", { color: "rgba(255,80,80,.4)", width: 2 });
    this.dangerLabel = textTexture("DANGER", "900 12px Outfit, sans-serif", "#E95574", 90, 18);
    this.dim = roundRectTexture(8, 8, 0, "rgba(5,12,38,.88)");
    this.dimSoft = roundRectTexture(8, 8, 0, "rgba(5,12,38,.82)");
  }

  static create(): GameTextures {
    return new GameTextures();
  }

  destroy() {
    for (const t of [
      ...this.bubble,
      ...this.bubbleGlow,
      this.whiteDot,
      this.trajDot,
      this.dot,
      this.panel,
      this.pause,
      this.pill,
      this.pillTop,
      this.card,
      this.cardRed,
      this.dangerLabel,
      this.dim,
      this.dimSoft,
    ]) {
      t.destroy(true);
    }
  }
}

function textTexture(text: string, font: string, color: string, w: number, h: number): Texture {
  const [cv, g] = canvas(w, h);
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  return Texture.from(cv);
}

export function makeBackgroundTexture(l: Layout): Texture {
  const [cv, g] = canvas(l.LW, l.LH);
  const sky = g.createLinearGradient(0, 0, 0, l.LH);
  sky.addColorStop(0, "#70D9F5");
  sky.addColorStop(0.5, "#78CDEF");
  sky.addColorStop(1, "#BFE9E2");
  g.fillStyle = sky;
  g.fillRect(0, 0, l.LW, l.LH);
  g.globalAlpha = 0.28;
  g.fillStyle = "#4C9EB6";
  g.beginPath();
  g.moveTo(0, 270);
  g.quadraticCurveTo(95, 210, 188, 260);
  g.quadraticCurveTo(292, 190, 378, 258);
  g.quadraticCurveTo(470, 205, l.LW, 256);
  g.lineTo(l.LW, 445);
  g.lineTo(0, 445);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.2;
  g.fillStyle = "#238BAE";
  g.beginPath();
  g.moveTo(0, 330);
  g.quadraticCurveTo(130, 254, 252, 340);
  g.quadraticCurveTo(380, 270, l.LW, 326);
  g.lineTo(l.LW, 490);
  g.lineTo(0, 490);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  const water = g.createLinearGradient(0, 585, 0, l.LH);
  water.addColorStop(0, "rgba(255,255,255,.3)");
  water.addColorStop(1, "rgba(20,151,192,.14)");
  g.fillStyle = water;
  g.fillRect(0, 565, l.LW, l.LH - 565);
  const lane = g.createLinearGradient(0, l.BOARD_TOP, 0, l.SHOOTER_Y + 54);
  lane.addColorStop(0, "rgba(255,255,255,.10)");
  lane.addColorStop(0.58, "rgba(255,255,255,.025)");
  lane.addColorStop(1, "rgba(255,255,255,.10)");
  g.fillStyle = lane;
  g.fillRect(0, l.BOARD_TOP - 16, l.LW, l.SHOOTER_Y - l.BOARD_TOP + 76);

  const sx = l.SHOOTER_X;
  const sy = l.SHOOTER_Y;
  g.save();
  g.shadowColor = "rgba(16,83,133,.48)";
  g.shadowBlur = 20;
  g.fillStyle = "rgba(9,79,133,.82)";
  rr(g, sx - 52, sy - 13, 104, 46, 23);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,.30)";
  rr(g, sx - 43, sy - 8, 86, 13, 7);
  g.fill();
  g.fillStyle = "#176FA4";
  g.beginPath();
  g.ellipse(sx, sy + 27, 68, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.38)";
  g.beginPath();
  g.ellipse(sx, sy + 22, 50, 6, 0, 0, Math.PI * 2);
  g.fill();
  return Texture.from(cv);
}

export function makeDangerLineTexture(l: Layout, near: boolean): Texture {
  const w = l.COLS * l.R * 2 + 4;
  const [cv, g] = canvas(w, 24);
  g.strokeStyle = "rgba(255,75,107,1)";
  g.lineWidth = near ? 4 : 3;
  g.shadowColor = "#FF4D6D";
  g.shadowBlur = near ? 20 : 8;
  g.setLineDash([16, 9]);
  g.beginPath();
  g.moveTo(2, 12);
  g.lineTo(w - 2, 12);
  g.stroke();
  return Texture.from(cv);
}
</file>

<file path="src/game/board.ts">
import { INIT_COLOR_COUNT, INIT_ROWS, rndColor } from "./config";
import type { Layout } from "./layout";
import type { GridPos } from "./types";

export class Board {
  readonly rows: (number | null)[][] = [];
  version = 0;

  constructor(private readonly layout: Layout) {}

  cell(row: number, col: number): number | null {
    return this.rows[row]?.[col] ?? null;
  }

  set(row: number, col: number, v: number | null) {
    if (!this.rows[row]) this.rows[row] = new Array(this.layout.COLS).fill(null);
    this.rows[row][col] = v;
    this.version++;
  }

  fillInitial() {
    this.rows.length = 0;
    for (let row = 0; row < INIT_ROWS; row++) {
      this.rows[row] = new Array(this.layout.COLS).fill(null);
      for (let col = 0; col < this.layout.COLS; col++) this.rows[row][col] = rndColor(INIT_COLOR_COUNT);
    }
    this.version++;
  }

  spawnTopRow() {
    const newRow: (number | null)[] = new Array(this.layout.COLS).fill(null);
    for (let col = 0; col < this.layout.COLS; col++) {
      if (Math.random() > 0.18) newRow[col] = rndColor(INIT_COLOR_COUNT);
    }
    this.rows.unshift(newRow);
    this.version++;
  }

  bfsColor(row: number, col: number, c: number): GridPos[] {
    const vis = new Set<string>();
    const q = [{ row, col }];
    const res: GridPos[] = [];
    while (q.length) {
      const cur = q.shift()!;
      const k = `${cur.row},${cur.col}`;
      if (vis.has(k)) continue;
      vis.add(k);
      if (this.cell(cur.row, cur.col) !== c) continue;
      res.push(cur);
      for (const n of this.layout.nbrs(cur.row, cur.col)) {
        if (!vis.has(`${n.row},${n.col}`)) q.push(n);
      }
    }
    return res;
  }

  findFloating(): GridPos[] {
    const conn = new Set<string>();
    const q: GridPos[] = [];
    for (let col = 0; col < this.layout.COLS; col++) {
      if (this.cell(0, col) !== null) {
        conn.add(`0,${col}`);
        q.push({ row: 0, col });
      }
    }
    while (q.length) {
      const cur = q.shift()!;
      for (const n of this.layout.nbrs(cur.row, cur.col)) {
        const k = `${n.row},${n.col}`;
        if (!conn.has(k) && this.cell(n.row, n.col) !== null) {
          conn.add(k);
          q.push(n);
        }
      }
    }
    const floating: GridPos[] = [];
    for (let r = 0; r < this.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.cell(r, col) !== null && !conn.has(`${r},${col}`)) floating.push({ row: r, col });
      }
    }
    return floating;
  }

  isClear(): boolean {
    for (let r = 0; r < this.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.cell(r, col) !== null) return false;
      }
    }
    return true;
  }
}
</file>

<file path="src/game/config.ts">
export const COLORS = [
  "#FF4D6D",
  "#FF9F1C",
  "#FFE04B",
  "#2DC653",
  "#3ABFF8",
  "#C77DFF",
] as const;

export const NC = COLORS.length;
export const INIT_COLOR_COUNT = 5;
export const SPEED = 900;
export const INIT_ROWS = 6;
export const MATCH_MIN = 3;
export const PTS_POP = 10;
export const PTS_DROP = 20;
export const INIT_MOVES = 25;
export const ROW_EVERY = 4;

export function rndColor(n: number): number {
  return Math.floor(Math.random() * n);
}
</file>

<file path="src/game/engine.ts">
import {
  COLORS,
  INIT_COLOR_COUNT,
  INIT_MOVES,
  MATCH_MIN,
  PTS_DROP,
  PTS_POP,
  ROW_EVERY,
  SPEED,
  rndColor,
} from "./config";
import { Board } from "./board";
import { Fx } from "./fx";
import { Layout } from "./layout";
import type { GridPos, Phase, Point, Shot } from "./types";

export class BubbleShooterEngine {
  readonly layout = new Layout(560, 800);
  readonly board = new Board(this.layout);
  readonly fx = new Fx();

  phase: Phase = "READY";
  cur = 0;
  nxt = 0;
  score = 0;
  combo = 0;
  moves = INIT_MOVES;
  stage = 1;
  starsEarned = 0;
  shotsToRow = 0;
  shot: Shot | null = null;
  traj: Point[] = [];

  sc = 1;
  ox = 0;
  oy = 0;

  private cv: HTMLCanvasElement;
  private plx = this.layout.SHOOTER_X;
  private ply = this.layout.SHOOTER_Y - 100;
  private pp: Phase = "READY";
  private rt = 0;

  private _pm: (e: PointerEvent) => void;
  private _pd: (e: PointerEvent) => void;
  private _kd: (e: KeyboardEvent) => void;
  private _rs: () => void;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this._pm = (e) => this.onMove(e);
    this._pd = (e) => this.onDown(e);
    this._kd = (e) => this.onKey(e);
    this._rs = () => this.computeTransform();
    cv.addEventListener("pointermove", this._pm);
    cv.addEventListener("pointerdown", this._pd, { passive: false });
    window.addEventListener("keydown", this._kd);
    window.addEventListener("resize", this._rs);
    this.computeTransform();
    this.init();
  }

  destroy() {
    this.cv.removeEventListener("pointermove", this._pm);
    this.cv.removeEventListener("pointerdown", this._pd);
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("resize", this._rs);
  }

  /** Per-frame logic step; driven by the renderer's ticker. */
  tick(dt: number) {
    this.computeTransform();
    this.update(dt);
  }

  // ─── Layout / input mapping ────────────────────────────────────────────────

  private computeTransform() {
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    this.layout.configure(w, h);
    this.sc = Math.min(w / this.layout.LW, h / this.layout.LH);
    this.ox = (w - this.layout.LW * this.sc) / 2;
    this.oy = (h - this.layout.LH * this.sc) / 2;
  }

  private sToL(sx: number, sy: number) {
    const rect = this.cv.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.ox) / this.sc,
      y: (sy - rect.top - this.oy) / this.sc,
    };
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private onMove(e: PointerEvent) {
    const l = this.sToL(e.clientX, e.clientY);
    this.plx = l.x;
    this.ply = l.y;
    if (this.phase === "READY") this.calcTraj();
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    const l = this.sToL(e.clientX, e.clientY);
    this.plx = l.x;
    this.ply = l.y;
    // Pause pill lives at the bottom-right HUD island on widescreen.
    const l2 = this.layout;
    const pillX = l2.LW > 700 ? l2.LW - 110 : l2.BOARD_LEFT + l2.COLS * l2.R * 2 - 76;
    if (
      l.x > pillX - 6 &&
      l.x < pillX + 86 &&
      l.y > 273 &&
      l.y < 315 &&
      this.phase !== "WIN" &&
      this.phase !== "LOSE"
    ) {
      this.togglePause();
      return;
    }
    if (this.phase === "READY") {
      this.doShoot();
      return;
    }
    if (this.phase === "PAUSED") {
      this.resume();
      return;
    }
    if (this.phase === "WIN" || this.phase === "LOSE") {
      this.init();
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "p" || e.key === "P") this.togglePause();
  }

  private togglePause() {
    if (this.phase === "PAUSED") {
      this.resume();
      return;
    }
    if (["READY", "SHOOTING", "RESOLVING", "DROPPING"].includes(this.phase)) {
      this.pp = this.phase;
      this.phase = "PAUSED";
    }
  }

  private resume() {
    this.phase = this.pp;
    if (this.phase === "READY") this.calcTraj();
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  private init() {
    this.board.fillInitial();
    this.fx.clear();
    this.score = 0;
    this.combo = 0;
    this.moves = INIT_MOVES;
    this.starsEarned = 0;
    this.shotsToRow = 0;
    this.phase = "READY";
    this.shot = null;
    this.rt = 0;
    this.cur = rndColor(INIT_COLOR_COUNT);
    this.nxt = rndColor(INIT_COLOR_COUNT);
    this.calcTraj();
  }

  // ─── Aim / shoot ───────────────────────────────────────────────────────────

  private aimAngle() {
    const { SHOOTER_X, SHOOTER_Y } = this.layout;
    const dx = this.plx - SHOOTER_X;
    const dy = this.ply - SHOOTER_Y;
    if (dy >= -5) return dx >= 0 ? Math.PI * 0.82 : -Math.PI * 0.82;
    const a = Math.atan2(dx, -dy);
    return Math.max(-Math.PI * 0.82, Math.min(Math.PI * 0.82, a));
  }

  private doShoot() {
    if (this.ply >= this.layout.SHOOTER_Y - 5) return;
    if (this.moves <= 0) return;
    const a = this.aimAngle();
    this.shot = {
      x: this.layout.SHOOTER_X,
      y: this.layout.SHOOTER_Y,
      vx: Math.sin(a) * SPEED,
      vy: -Math.cos(a) * SPEED,
      c: this.cur,
    };
    this.cur = this.nxt;
    this.nxt = rndColor(INIT_COLOR_COUNT);
    this.moves--;
    this.shotsToRow++;
    if (this.shotsToRow >= ROW_EVERY) {
      this.shotsToRow = 0;
      this.board.spawnTopRow();
      this.fx.shake(0.18);
      this.fx.spawnPopup(this.layout.BOARD_CENTER_X, this.layout.BOARD_TOP + 30, "NEW ROW!", false, "#FF4D6D");
    }
    this.phase = "SHOOTING";
    this.traj = [];
  }

  // ─── Trajectory ──────────────────────────────────────────────────────────

  private calcTraj() {
    const { WALL_L, WALL_R, BOARD_TOP, R, ROW_H, SHOOTER_X, SHOOTER_Y } = this.layout;
    const pts: Point[] = [];
    const a = this.aimAngle();
    let vx = Math.sin(a) * SPEED;
    let vy = -Math.cos(a) * SPEED;
    let x = SHOOTER_X;
    let y = SHOOTER_Y;
    const step = 5;
    let acc = 0;
    const dotEvery = R * 1.6;

    for (let i = 0; i < 2400; i++) {
      const len = Math.hypot(vx, vy);
      x += (vx / len) * step;
      y += (vy / len) * step;
      acc += step;
      if (x < WALL_L) {
        x = WALL_L;
        vx = Math.abs(vx);
      }
      if (x > WALL_R) {
        x = WALL_R;
        vx = -Math.abs(vx);
      }
      if (y <= BOARD_TOP + R) {
        pts.push({ x, y });
        break;
      }
      const nr = Math.floor((y - BOARD_TOP - R) / ROW_H);
      let hit = false;
      for (let row = Math.max(0, nr - 1); row <= Math.min((this.board.rows.length || 0) - 1, nr + 2); row++) {
        for (let col = 0; col < this.layout.COLS; col++) {
          if (this.board.cell(row, col) !== null) {
            const wp = this.layout.gToW(row, col);
            if (Math.hypot(x - wp.x, y - wp.y) < R * 1.95) {
              hit = true;
              break;
            }
          }
        }
        if (hit) break;
      }
      if (hit) {
        pts.push({ x, y });
        break;
      }
      if (acc >= dotEvery) {
        pts.push({ x, y });
        acc = 0;
        if (pts.length >= 38) break;
      }
    }
    this.traj = pts;
  }

  // ─── Ball flight ─────────────────────────────────────────────────────────

  private updateShooting(dt: number) {
    if (!this.shot) return;
    const { WALL_L, WALL_R, BOARD_TOP, R, ROW_H } = this.layout;
    const s = this.shot;
    const sub = 4;
    const sdt = dt / sub;
    let placed = false;

    for (let i = 0; i < sub && !placed; i++) {
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;
      if (s.x < WALL_L) {
        s.x = WALL_L;
        s.vx = Math.abs(s.vx);
      }
      if (s.x > WALL_R) {
        s.x = WALL_R;
        s.vx = -Math.abs(s.vx);
      }
      if (s.y - R <= BOARD_TOP) {
        s.y = BOARD_TOP + R;
        const snap = this.findSnap(s.x, s.y, -1, -1);
        if (snap) {
          this.place(snap.row, snap.col, s.c);
          placed = true;
        } else {
          this.shot = null;
          this.phase = "READY";
          this.calcTraj();
          return;
        }
        break;
      }
      const nr = Math.floor((s.y - BOARD_TOP - R) / ROW_H);
      for (let row = Math.max(0, nr - 1); row <= Math.min((this.board.rows.length || 0) - 1, nr + 2) && !placed; row++) {
        for (let col = 0; col < this.layout.COLS && !placed; col++) {
          if (this.board.cell(row, col) !== null) {
            const wp = this.layout.gToW(row, col);
            if (Math.hypot(s.x - wp.x, s.y - wp.y) < R * 1.95) {
              const snap = this.findSnap(s.x, s.y, row, col);
              if (snap) {
                this.place(snap.row, snap.col, s.c);
                placed = true;
              } else {
                this.shot = null;
                this.phase = "READY";
                this.calcTraj();
                return;
              }
            }
          }
        }
      }
    }
    if (placed) this.shot = null;
  }

  private findSnap(bx: number, by: number, hr: number, hc: number): GridPos | null {
    const { MAX_ROWS, COLS, ROW_H, R } = this.layout;
    const cands: GridPos[] = [];
    if (hr >= 0) cands.push(...this.layout.nbrs(hr, hc));
    const est = this.layout.wToG(bx, by);
    cands.push(est, ...this.layout.nbrs(est.row, est.col));
    if (est.row > 0) {
      const above = this.layout.wToG(bx, by - ROW_H);
      cands.push(above, ...this.layout.nbrs(above.row, above.col));
    }
    const seen = new Set<string>();
    const valid = cands.filter((p) => {
      const k = `${p.row},${p.col}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return p.row >= 0 && p.row < MAX_ROWS && p.col >= 0 && p.col < COLS && this.board.cell(p.row, p.col) === null;
    });
    if (!valid.length) return null;
    valid.sort((a, b) => {
      const wa = this.layout.gToW(a.row, a.col);
      const wb = this.layout.gToW(b.row, b.col);
      return Math.hypot(bx - wa.x, by - wa.y) - Math.hypot(bx - wb.x, by - wb.y);
    });
    return valid[0];
  }

  // ─── Place & match ───────────────────────────────────────────────────────

  private place(row: number, col: number, c: number) {
    this.board.set(row, col, c);
    this.fx.newBubble = { row, col, t: 0 };
    const wp = this.layout.gToW(row, col);
    this.fx.spawnImpact(wp.x, wp.y, COLORS[c]);
    const matched = this.board.bfsColor(row, col, c);

    if (matched.length >= MATCH_MIN) {
      this.combo++;
      const pts = matched.length * PTS_POP;
      this.score += pts;

      const label = matched.length >= 8 ? "AMAZING!" : matched.length >= 5 ? "AWESOME!" : "";
      if (label) this.fx.spawnPopup(this.layout.SHOOTER_X, this.layout.LH * 0.42, label, true, "#FFE04B");
      this.fx.spawnPopup(wp.x, wp.y - 24, `+${pts}`, false, "#FFE04B");

      matched.forEach((p) => {
        const mw = this.layout.gToW(p.row, p.col);
        this.fx.pops.push({ c: this.board.cell(p.row, p.col)!, x: mw.x, y: mw.y, scale: 1, alpha: 1, t: 0 });
        this.board.set(p.row, p.col, null);
      });

      if (this.combo > 1) {
        this.fx.markCombo(
          this.combo,
          this.layout.LW > 700 ? this.layout.BOARD_LEFT - 74 : this.layout.SHOOTER_X,
          this.layout.LH * 0.38
        );
      }
      this.rt = 0;
      this.phase = "RESOLVING";
    } else {
      this.combo = 0;
      this.phase = "READY";
      this.calcTraj();
      this.checkEnd();
    }
  }

  private updateResolving(dt: number) {
    const DUR = 0.38;
    this.rt += dt;
    for (const b of this.fx.pops) {
      b.t += dt / DUR;
      if (b.t < 0.28) {
        b.scale = 1 + b.t * 1.6;
        b.alpha = 1;
      } else {
        b.scale = Math.max(0.01, 1.45 - (b.t - 0.28) * 2.0);
        b.alpha = Math.max(0, 1 - (b.t - 0.28) * 3.2);
      }
      if (b.t > 0.22 && b.t < 0.38) this.fx.spawnPop(b.x, b.y, COLORS[b.c]);
    }
    if (this.rt >= DUR) {
      this.fx.pops = [];
      const floating = this.board.findFloating();
      if (floating.length) {
        const pts = floating.length * PTS_DROP;
        this.score += pts;
        floating.forEach((p) => {
          const wp = this.layout.gToW(p.row, p.col);
          const c = this.board.cell(p.row, p.col)!;
          this.fx.drops.push({
            c,
            x: wp.x,
            y: wp.y,
            vx: (Math.random() - 0.5) * 90,
            vy: -90 + Math.random() * 50,
            alpha: 1,
          });
          this.board.set(p.row, p.col, null);
        });
        if (floating.length >= 4) {
          this.fx.spawnPopup(this.layout.SHOOTER_X, this.layout.DANGER_Y - 60, `+${pts} DROP!`, false, "#C77DFF");
        }
        this.fx.shake(0.32);
        this.phase = "DROPPING";
      } else {
        this.phase = "READY";
        this.calcTraj();
        this.checkEnd();
      }
    }
  }

  private updateDropping(dt: number) {
    const G = 780;
    for (const b of this.fx.drops) {
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.alpha = Math.max(0, b.alpha - dt * 1.4);
    }
    this.fx.drops = this.fx.drops.filter((b) => b.alpha > 0 && b.y < this.layout.LH + 80);
    if (!this.fx.drops.length) {
      this.phase = "READY";
      this.calcTraj();
      this.checkEnd();
    }
  }

  private checkEnd() {
    const { DANGER_Y, R } = this.layout;
    for (let r = 0; r < this.board.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.board.cell(r, col) !== null) {
          const { y } = this.layout.gToW(r, col);
          if (y + R >= DANGER_Y) {
            this.phase = "LOSE";
            return;
          }
        }
      }
    }
    if (this.board.isClear()) {
      this.starsEarned = this.moves >= 15 ? 3 : this.moves >= 8 ? 2 : 1;
      this.phase = "WIN";
      this.fx.shake(0.7);
      return;
    }
    if (this.moves <= 0) this.phase = "LOSE";
  }

  // ─── Main loop ───────────────────────────────────────────────────────────

  private update(dt: number) {
    this.fx.step(dt);
    if (this.phase !== "PAUSED") {
      if (this.phase === "SHOOTING") this.updateShooting(dt);
      else if (this.phase === "RESOLVING") this.updateResolving(dt);
      else if (this.phase === "DROPPING") this.updateDropping(dt);
    }
  }
}
</file>

<file path="src/game/fx.ts">
import type { Drop, Particle, Pop, Popup } from "./types";

export interface NewBubbleAnim {
  row: number;
  col: number;
  t: number;
}

export class Fx {
  pops: Pop[] = [];
  drops: Drop[] = [];
  parts: Particle[] = [];
  popups: Popup[] = [];
  comboA = { v: 0, alpha: 0, scale: 1, x: 0, y: 0 };
  newBubble: NewBubbleAnim | null = null;
  shakeT = 0;
  csx = 0;
  csy = 0;
  pulse = 0;

  clear() {
    this.pops.length = 0;
    this.drops.length = 0;
    this.parts.length = 0;
    this.popups.length = 0;
    this.comboA = { v: 0, alpha: 0, scale: 1, x: 0, y: 0 };
    this.newBubble = null;
    this.shakeT = 0;
    this.csx = 0;
    this.csy = 0;
    this.pulse = 0;
  }

  step(dt: number) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const intensity = this.shakeT * 8;
      this.csx = (Math.random() - 0.5) * intensity;
      this.csy = (Math.random() - 0.5) * intensity;
    } else {
      this.csx = 0;
      this.csy = 0;
    }
    this.pulse += dt * 2.8;
    if (this.comboA.alpha > 0) {
      this.comboA.alpha -= dt * 1.4;
      this.comboA.scale = Math.max(1, this.comboA.scale - dt * 4);
      this.comboA.y -= dt * 18;
    }
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.alpha = Math.max(0, 1 - p.life / p.max);
    }
    this.parts = this.parts.filter((p) => p.alpha > 0);
    for (const sp of this.popups) {
      sp.y += sp.vy * dt;
      sp.alpha = Math.max(0, sp.alpha - dt * (sp.big ? 1.0 : 1.3));
    }
    this.popups = this.popups.filter((sp) => sp.alpha > 0);
    if (this.newBubble) {
      this.newBubble.t += dt * 5;
      if (this.newBubble.t >= 1) this.newBubble = null;
    }
  }

  shake(dur: number) {
    this.shakeT = dur;
  }

  markCombo(v: number, x: number, y: number) {
    this.comboA = { v, alpha: 1, scale: 1.8, x, y };
  }

  spawnImpact(x: number, y: number, color: string) {
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
      const spd = 55 + Math.random() * 85;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        alpha: 0.75,
        r: 2 + Math.random() * 3,
        life: 0,
        max: 0.18 + Math.random() * 0.12,
      });
    }
  }

  spawnPop(x: number, y: number, color: string) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 140;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 50,
        color,
        alpha: 1,
        r: 2 + Math.random() * 4.5,
        life: 0,
        max: 0.32 + Math.random() * 0.22,
      });
    }
  }

  spawnPopup(x: number, y: number, text: string, big: boolean, color: string) {
    this.popups.push({ x, y, text, alpha: 1, vy: big ? -38 : -58, big, color });
  }
}
</file>

<file path="src/game/layout.ts">
import type { GridPos, Point } from "./types";

export class Layout {
  LW = 560;
  LH = 800;
  COLS = 9;
  R = 22;
  BOARD_LEFT = 37;
  BOARD_TOP = 108;
  ROW_H = 22 * Math.sqrt(3);
  BOARD_CENTER_X = 37 + (9 * 22 * 2) / 2;
  SHOOTER_X = this.BOARD_CENTER_X;
  SHOOTER_Y = 710;
  NEXT_X = 112;
  NEXT_Y = 712;
  WALL_L = this.BOARD_LEFT + this.R;
  WALL_R = this.BOARD_LEFT + this.COLS * this.R * 2 - this.R;
  DANGER_ROW = 11;
  DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H;
  MAX_ROWS = 15;

  constructor(width: number, height: number) {
    this.configure(width, height);
  }

  configure(width: number, height: number) {
    const wide = width / Math.max(height, 1) >= 1.08;
    this.LW = wide ? Math.max(960, Math.round(width)) : 560;
    this.LH = wide ? Math.max(620, Math.round(height)) : 800;
    this.COLS = wide
      ? width >= 1780
        ? 20
        : width >= 1500
          ? 19
          : width >= 1410
            ? 18
            : width >= 1180
              ? 17
              : 16
      : 9;
    this.R = wide ? Math.min(27, Math.max(22, width / 53)) : 22;
    this.ROW_H = this.R * Math.sqrt(3);
    this.BOARD_TOP = wide ? 96 : 108;
    const boardW = this.COLS * this.R * 2;
    this.BOARD_LEFT = (this.LW - boardW) / 2;
    this.BOARD_CENTER_X = this.LW / 2;
    this.SHOOTER_X = this.BOARD_CENTER_X;
    this.SHOOTER_Y = wide ? this.LH - Math.max(76, Math.min(112, this.LH * 0.12)) : 710;
    this.NEXT_X = wide ? this.LW - Math.max(92, this.LW * 0.075) : this.SHOOTER_X - 150;
    this.NEXT_Y = wide ? Math.min(this.LH - 142, 294) : this.SHOOTER_Y + 2;
    this.DANGER_ROW = wide ? Math.max(8, Math.floor((this.SHOOTER_Y - this.BOARD_TOP - 105) / this.ROW_H)) : 11;
    this.DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H;
    this.MAX_ROWS = this.DANGER_ROW + 4;
    this.WALL_L = this.BOARD_LEFT + this.R;
    this.WALL_R = this.BOARD_LEFT + boardW - this.R;
  }

  gToW(row: number, col: number): Point {
    return {
      x: this.BOARD_LEFT + this.R + col * this.R * 2 + (row % 2 === 1 ? this.R : 0),
      y: this.BOARD_TOP + this.R + row * this.ROW_H,
    };
  }

  wToG(x: number, y: number): GridPos {
    const row = Math.max(0, Math.round((y - this.BOARD_TOP - this.R) / this.ROW_H));
    const offsetX = row % 2 === 1 ? this.R : 0;
    const col = Math.max(
      0,
      Math.min(this.COLS - 1, Math.round((x - this.BOARD_LEFT - this.R - offsetX) / (this.R * 2)))
    );
    return { row, col };
  }

  nbrs(row: number, col: number): GridPos[] {
    const odd = row % 2 === 1;
    return [
      { row, col: col - 1 },
      { row, col: col + 1 },
      { row: row - 1, col: odd ? col : col - 1 },
      { row: row - 1, col: odd ? col + 1 : col },
      { row: row + 1, col: odd ? col : col - 1 },
      { row: row + 1, col: odd ? col + 1 : col },
    ].filter((p) => p.row >= 0 && p.col >= 0 && p.col < this.COLS);
  }
}
</file>

<file path="src/game/types.ts">
import type { Board } from "./board";
import type { Fx } from "./fx";
import type { Layout } from "./layout";

export type Phase =
  | "READY"
  | "SHOOTING"
  | "RESOLVING"
  | "DROPPING"
  | "WIN"
  | "LOSE"
  | "PAUSED";

export interface Point {
  x: number;
  y: number;
}

export interface GridPos {
  row: number;
  col: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number;
}

export interface Pop {
  c: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  t: number;
}

export interface Drop {
  c: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  r: number;
  life: number;
  max: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  alpha: number;
  vy: number;
  big: boolean;
  color: string;
}

export interface GameView {
  readonly layout: Layout;
  readonly board: Board;
  readonly fx: Fx;
  readonly phase: Phase;
  readonly cur: number;
  readonly nxt: number;
  readonly shot: Shot | null;
  readonly traj: Point[];
  readonly score: number;
  readonly combo: number;
  readonly moves: number;
  readonly stage: number;
  readonly starsEarned: number;
  readonly shotsToRow: number;
}
</file>

<file path="src/App.tsx">
import BubbleGame from "./components/BubbleGame";

export default function App() {
  return (
    <main className="game-shell" aria-label="Hyper Bubble Shooter">
      <BubbleGame />
    </main>
  );
}
</file>

<file path="src/index.css">
@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Outfit:wght@400;600;700;800;900&display=swap');

html, body, #root { width: 100%; height: 100%; margin: 0; }
body { overflow: hidden; background: #73dff4; font-family: 'Outfit', sans-serif; }
button, canvas { -webkit-tap-highlight-color: transparent; }
.game-shell {
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(ellipse 38% 22% at 50% 9%, rgba(255,255,255,.5), transparent 72%),
    radial-gradient(ellipse 34% 25% at 11% 86%, rgba(6,139,177,.24), transparent 70%),
    radial-gradient(ellipse 30% 23% at 90% 80%, rgba(43,178,155,.18), transparent 72%),
    linear-gradient(180deg, #71dff5 0%, #a8e8ec 56%, #7acfc4 100%);
}
.game-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: crosshair;
}
.game-canvas canvas { position: absolute; inset: 0; display: block; }
@media (min-width: 900px) {
  .game-shell {
    background:
      radial-gradient(ellipse 36% 30% at 50% 8%, rgba(255,255,255,.58), transparent 72%),
      radial-gradient(ellipse 25% 40% at 4% 95%, rgba(32,139,167,.30), transparent 70%),
      radial-gradient(ellipse 25% 40% at 96% 93%, rgba(54,162,132,.24), transparent 70%),
      linear-gradient(180deg, #71dff5 0%, #a4e7eb 54%, #78cbbd 100%);
  }
}
</file>

<file path="src/main.tsx">
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
</file>

<file path="src/vite-env.d.ts">
/// <reference types="vite/client" />
</file>

<file path=".gitattributes">
# Git LFS Tracking Rules
# Generated for binary, large, and non-diffable file types

# ---------------------------------------------------------------------------
# Images & Graphics
# ---------------------------------------------------------------------------
*.png                filter=lfs diff=lfs merge=lfs -text
*.jpg                filter=lfs diff=lfs merge=lfs -text
*.jpeg               filter=lfs diff=lfs merge=lfs -text
*.gif                filter=lfs diff=lfs merge=lfs -text
*.bmp                filter=lfs diff=lfs merge=lfs -text
*.tiff               filter=lfs diff=lfs merge=lfs -text
*.tif                filter=lfs diff=lfs merge=lfs -text
*.ico                filter=lfs diff=lfs merge=lfs -text
*.webp               filter=lfs diff=lfs merge=lfs -text
*.psd                filter=lfs diff=lfs merge=lfs -text
*.ai                 filter=lfs diff=lfs merge=lfs -text
*.sketch             filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------
*.mp4                filter=lfs diff=lfs merge=lfs -text
*.mov                filter=lfs diff=lfs merge=lfs -text
*.avi                filter=lfs diff=lfs merge=lfs -text
*.mkv                filter=lfs diff=lfs merge=lfs -text
*.wmv                filter=lfs diff=lfs merge=lfs -text
*.flv                filter=lfs diff=lfs merge=lfs -text
*.webm               filter=lfs diff=lfs merge=lfs -text
*.m4v                filter=lfs diff=lfs merge=lfs -text
*.mpg                filter=lfs diff=lfs merge=lfs -text
*.mpeg               filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------
*.mp3                filter=lfs diff=lfs merge=lfs -text
*.wav                filter=lfs diff=lfs merge=lfs -text
*.flac               filter=lfs diff=lfs merge=lfs -text
*.aac                filter=lfs diff=lfs merge=lfs -text
*.ogg                filter=lfs diff=lfs merge=lfs -text
*.m4a                filter=lfs diff=lfs merge=lfs -text
*.wma                filter=lfs diff=lfs merge=lfs -text
*.aiff               filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# 3D & Game Assets
# ---------------------------------------------------------------------------
*.fbx                filter=lfs diff=lfs merge=lfs -text
*.obj                filter=lfs diff=lfs merge=lfs -text
*.blend              filter=lfs diff=lfs merge=lfs -text
*.dae                filter=lfs diff=lfs merge=lfs -text
*.3ds                filter=lfs diff=lfs merge=lfs -text
*.max                filter=lfs diff=lfs merge=lfs -text
*.unity              filter=lfs diff=lfs merge=lfs -text
*.unitypackage       filter=lfs diff=lfs merge=lfs -text
*.uasset             filter=lfs diff=lfs merge=lfs -text
*.umap               filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Archives & Compressed Files
# ---------------------------------------------------------------------------
*.zip                filter=lfs diff=lfs merge=lfs -text
*.tar                filter=lfs diff=lfs merge=lfs -text
*.gz                 filter=lfs diff=lfs merge=lfs -text
*.bz2                filter=lfs diff=lfs merge=lfs -text
*.7z                 filter=lfs diff=lfs merge=lfs -text
*.rar                filter=lfs diff=lfs merge=lfs -text
*.tgz                filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Documents & Fonts
# ---------------------------------------------------------------------------
*.pdf                filter=lfs diff=lfs merge=lfs -text
*.docx               filter=lfs diff=lfs merge=lfs -text
*.xlsx               filter=lfs diff=lfs merge=lfs -text
*.pptx               filter=lfs diff=lfs merge=lfs -text
*.ttf                filter=lfs diff=lfs merge=lfs -text
*.otf                filter=lfs diff=lfs merge=lfs -text
*.woff               filter=lfs diff=lfs merge=lfs -text
*.woff2              filter=lfs diff=lfs merge=lfs -text
*.eot                filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Data & Machine Learning
# ---------------------------------------------------------------------------
*.parquet            filter=lfs diff=lfs merge=lfs -text
*.hdf5               filter=lfs diff=lfs merge=lfs -text
*.h5                 filter=lfs diff=lfs merge=lfs -text
*.pkl                filter=lfs diff=lfs merge=lfs -text
*.pickle             filter=lfs diff=lfs merge=lfs -text
*.npy                filter=lfs diff=lfs merge=lfs -text
*.npz                filter=lfs diff=lfs merge=lfs -text
*.bin                filter=lfs diff=lfs merge=lfs -text
*.pt                 filter=lfs diff=lfs merge=lfs -text
*.pth                filter=lfs diff=lfs merge=lfs -text
*.onnx               filter=lfs diff=lfs merge=lfs -text
*.pb                 filter=lfs diff=lfs merge=lfs -text
*.safetensors        filter=lfs diff=lfs merge=lfs -text
*.gguf               filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------
*.db                 filter=lfs diff=lfs merge=lfs -text
*.sqlite             filter=lfs diff=lfs merge=lfs -text
*.sqlite3            filter=lfs diff=lfs merge=lfs -text
*.mdb                filter=lfs diff=lfs merge=lfs -text
*.accdb              filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Executables & Libraries
# ---------------------------------------------------------------------------
*.exe                filter=lfs diff=lfs merge=lfs -text
*.dll                filter=lfs diff=lfs merge=lfs -text
*.so                 filter=lfs diff=lfs merge=lfs -text
*.dylib              filter=lfs diff=lfs merge=lfs -text
*.a                  filter=lfs diff=lfs merge=lfs -text
*.lib                filter=lfs diff=lfs merge=lfs -text
*.wasm               filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# Build Artifacts & Packages
# ---------------------------------------------------------------------------
*.jar                filter=lfs diff=lfs merge=lfs -text
*.war                filter=lfs diff=lfs merge=lfs -text
*.ear                filter=lfs diff=lfs merge=lfs -text
*.apk                filter=lfs diff=lfs merge=lfs -text
*.ipa                filter=lfs diff=lfs merge=lfs -text
*.deb                filter=lfs diff=lfs merge=lfs -text
*.rpm                filter=lfs diff=lfs merge=lfs -text
*.dmg                filter=lfs diff=lfs merge=lfs -text
*.iso                filter=lfs diff=lfs merge=lfs -text
*.img                filter=lfs diff=lfs merge=lfs -text

# ---------------------------------------------------------------------------
# CAD & Scientific
# ---------------------------------------------------------------------------
*.dwg                filter=lfs diff=lfs merge=lfs -text
*.dxf                filter=lfs diff=lfs merge=lfs -text
*.step               filter=lfs diff=lfs merge=lfs -text
*.stp                filter=lfs diff=lfs merge=lfs -text
*.iges               filter=lfs diff=lfs merge=lfs -text
*.stl                filter=lfs diff=lfs merge=lfs -text
*.nc                 filter=lfs diff=lfs merge=lfs -text
*.mat                filter=lfs diff=lfs merge=lfs -text
</file>

<file path=".gitignore">
node_modules/
dist/
build/
.cache/
.env*
.vite/
vite.config.*.timestamp-*
*.tsbuildinfo
*-debug.log*
logs/
*.log
.claude-replay.*
.tmp-*
</file>

<file path=".mise.toml">
[tools]
node = "22"
"npm:pnpm" = "10.34.3"
</file>

<file path="AGENTS.md">
# figma-make-app

React + Vite project running inside Figma Make. A Bubble Shooter arcade game rendered with PixiJS on a `<canvas>`.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/components/BubbleGame.tsx` - Host component; boots/destroys the PixiJS `Application` and the game engine
- `src/game/engine.ts` - Game orchestrator: input, phases, ball physics, scoring, and win/lose flow
- `src/game/layout.ts` - Responsive logical layout and hex-grid math (`gToW`, `wToG`, `nbrs`)
- `src/game/board.ts` - Board state, flood-fill matching, and floating-bubble detection
- `src/game/fx.ts` - Particles, popups, screen shake, combo banner, and pop/drop animations
- `src/game/config.ts` - Tuning constants (colors, speeds, scoring, row pressure)
- `src/game/types.ts` - Shared types plus the read-only `GameView` interface the renderers consume
- `src/game/render/` - PixiJS renderers: `game.ts` (orchestrator), `textures.ts` (pre-rendered textures, nine-slice skins), `layers.ts`, `hud.ts`, `overlays.ts`, `pools.ts`
- `src/index.css` - Global CSS: Google Fonts import, shell, and canvas sizing
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx` (title/lang injected from `.figma/make/site.json`)
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19, React DOM 19, and PixiJS 8
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

All game visuals are rendered by PixiJS via `src/game/render/`; `src/index.css` only holds page-level styles (fonts, `.game-shell`, `.game-canvas` host). Do not reintroduce a CSS framework for the game UI.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
</file>

<file path="CLAUDE.md">
@AGENTS.md
</file>

<file path="index.html">
<!doctype html>
<html lang="<!-- figma:lang -->">
  <head>
    <!-- figma:head-start -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><!-- figma:title --></title>
    <!-- figma:head-end -->
  </head>
  <body>
    <!-- figma:body-start -->
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <!-- figma:body-end -->
  </body>
</html>
</file>

<file path="package.json">
{
  "name": "figma-make-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "format": "oxfmt"
  },
  "dependencies": {
    "pixi.js": "^8.19.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "oxfmt": "^0.2.0",
    "typescript": "^5.7.0",
    "vite": "^8.0.0"
  }
}
</file>

<file path="tsconfig.json">
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node"],
    "strict": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts"]
}
</file>

<file path="vite.config.ts">
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

import siteConfiguration from './.figma/make/site.json'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      watch: { ignored: ['**/.figma/**'] },
    },
    preview: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}
</file>

</files>
