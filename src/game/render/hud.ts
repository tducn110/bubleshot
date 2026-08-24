import {
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Text,
  type TextStyleFontWeight,
  type Texture,
} from "pixi.js"
import type { GameView } from "../types"
import type { BubbleShooterEngine } from "../engine"
import type { LayoutRect } from "../layout"
import type { GameTextures } from "./textures"

type Fill = string | { color: string alpha: number }

function island(t: Texture, rect: LayoutRect): NineSliceSprite {
  return new NineSliceSprite({
    texture: t,
    leftWidth: 14,
    rightWidth: 14,
    topHeight: 14,
    bottomHeight: 14,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  })
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
  const result = new Text({
    text,
    style: {
      fontFamily: family,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fontSize: size,
      fill,
      textBaseline: "middle",
    },
    anchor: { x: align, y: 0.5 },
  })
  result.position.set(x, y)
  return result
}

const PRESSURE_DOTS = 4

export class HudLayer {
  private root = new Container()
  private levelPanel: NineSliceSprite
  private movesPanel: NineSliceSprite
  private levelVal: Text
  private scoreLabel: Text
  private scoreVal: Text
  private movesLabel: Text
  private movesVal: Text
  private pausePill: Sprite
  private pauseLabel: Text
  private dots: Sprite[] = []
  private combo: Text
  private feverBg: Graphics
  private feverFill: Graphics
  private feverLabel: Text
  private mode: Text
  private last = {
    stage: -1,
    score: "",
    moves: "",
    movesColor: "",
    remaining: -1,
    combo: -1,
    fever: -1,
    mode: -1,
  }

  constructor(
    parent: Container,
    _t: GameTextures,
    private engine: BubbleShooterEngine,
  ) {
    parent.addChild(this.root)
    this.combo = this.makeCombo()
  }

  private makeCombo(): Text {
    return new Text({
      text: "",
      style: {
        fontFamily: "Bungee",
        fontWeight: "900",
        fontSize: 30,
        fill: { color: "#ffdd6e", alpha: 0.96 },
        dropShadow: {
          color: "#000000",
          blur: 12,
          distance: 2,
          angle: Math.PI / 2,
        },
        textBaseline: "middle",
      },
      anchor: { x: 0.5, y: 0.5 },
    })
  }

  relayout(v: GameView, t: GameTextures) {
    for (const child of this.root.removeChildren()) child.destroy()
    this.combo = this.makeCombo()
    const l = v.layout
    const level = l.hud.level
    const score = l.hud.score
    const moves = l.hud.moves
    const pause = l.hud.pause
    const centerX = l.LW / 2

    this.levelPanel = island(t.panel, level)
    this.levelVal = label(
      String(v.stage).padStart(2, "0"),
      "Bungee",
      21,
      900,
      "#ffcf43",
      level.x + level.width / 2,
      level.y + 29,
      0.5,
    )
    this.scoreLabel = label(
      "SCORE",
      "Outfit",
      10,
      800,
      { color: "#e8fbff", alpha: 0.72 },
      centerX,
      score.y + 10,
      0.5,
    )
    this.scoreVal = label(
      "0",
      "Bungee",
      22,
      900,
      "#ffffff",
      centerX,
      score.y + 32,
      0.5,
    )
    this.movesPanel = island(t.panel, moves)
    this.movesLabel = label(
      "MOVES",
      "Outfit",
      9,
      800,
      { color: "#e8fbff", alpha: 0.72 },
      moves.x + 10,
      moves.y + 12,
    )
    this.movesVal = label(
      String(v.moves).padStart(2, "0"),
      "Bungee",
      19,
      900,
      "#ffffff",
      moves.x + 10,
      moves.y + 31,
    )

    this.dots = []
    for (let i = 0; i < PRESSURE_DOTS; i++) {
      const dot = new Sprite({
        texture: t.dot,
        anchor: 0.5,
        alpha: 0.2,
        scale: 0.22,
      })
      dot.position.set(
        moves.x + moves.width - 13 - (PRESSURE_DOTS - 1 - i) * 10,
        moves.y + 29,
      )
      this.dots.push(dot)
    }

    this.pausePill = new Sprite({
      texture: t.pause,
      x: pause.x,
      y: pause.y,
      width: pause.width,
      height: pause.height,
    })
    this.pausePill.eventMode = "static"
    this.pausePill.hitArea = new Rectangle(
      -6,
      -6,
      pause.width + 12,
      pause.height + 12,
    )
    this.pausePill.cursor = "pointer"
    this.pausePill.on("pointerdown", () => {
      this.engine.consumeNextDown()
      this.engine.togglePause()
    })
    this.pauseLabel = label(
      "Ⅱ",
      "Outfit",
      14,
      900,
      "#ffffff",
      pause.x + pause.width / 2,
      pause.y + pause.height / 2,
      0.5,
    )

    const fever = l.fever
    this.feverBg = new Graphics()
      .roundRect(fever.x, fever.y, fever.width, 8, 4)
      .fill({ color: 0x0a4f78, alpha: 0.72 })
    this.feverFill = new Graphics()
    this.feverLabel = label(
      "FEVER",
      "Outfit",
      8,
      900,
      { color: "#fff5bd", alpha: 0.9 },
      fever.x - 8,
      fever.y + 4,
      1,
    )
    this.mode = label(
      "x1",
      "Bungee",
      13,
      900,
      "#ffffff",
      fever.x + fever.width + 8,
      fever.y + 4,
    )

    this.root.addChild(
      this.levelPanel,
      label(
        "LEVEL",
        "Outfit",
        9,
        800,
        { color: "#e0f9ff", alpha: 0.72 },
        level.x + level.width / 2,
        level.y + 11,
        0.5,
      ),
      this.levelVal,
      this.scoreLabel,
      this.scoreVal,
      this.movesPanel,
      this.movesLabel,
      this.movesVal,
      ...this.dots,
      this.pausePill,
      this.pauseLabel,
      this.feverBg,
      this.feverFill,
      this.feverLabel,
      this.mode,
      this.combo,
    )
    this.last = {
      stage: -1,
      score: "",
      moves: "",
      movesColor: "",
      remaining: -1,
      combo: -1,
      fever: -1,
      mode: -1,
    }
  }

  sync(v: GameView, _t: GameTextures) {
    if (v.stage !== this.last.stage) {
      this.levelVal.text = String(v.stage).padStart(2, "0")
      this.last.stage = v.stage
    }
    const score = v.score.toLocaleString()
    if (score !== this.last.score) {
      this.scoreVal.text = score
      this.last.score = score
    }
    const moves = String(v.moves).padStart(2, "0")
    if (moves !== this.last.moves) {
      this.movesVal.text = moves
      this.last.moves = moves
    }
    const movesColor = v.moves < 7 ? "#ff7188" : "#ffffff"
    if (movesColor !== this.last.movesColor) {
      this.movesVal.style.fill = movesColor
      this.last.movesColor = movesColor
    }
    const remaining = Math.max(0, v.rowRemaining)
    if (remaining !== this.last.remaining) {
      this.last.remaining = remaining
      const lit = Math.max(0, v.rowEvery - remaining)
      const urgent = remaining <= 2
      for (let i = 0; i < this.dots.length; i++) {
        this.dots[i].alpha = i < lit ? 1 : 0.2
        this.dots[i].tint =
          i < lit ? (urgent ? "#ff4d6d" : "#ffcb3d") : "#ffffff"
      }
    }
    const combo = Math.max(1, v.combo)
    if (combo !== this.last.combo) this.last.combo = combo
    const comboA = v.fx.comboA
    this.combo.text = `COMBO x${combo}`
    this.combo.visible = comboA.alpha > 0 && combo >= 2
    if (comboA.alpha > 0) {
      this.combo.position.set(comboA.x, comboA.y)
      this.combo.alpha = comboA.alpha
      this.combo.scale.set(1 + (1 - comboA.alpha) * 0.25)
    }

    if (v.feverProgress !== this.last.fever) {
      this.last.fever = v.feverProgress
      const fever = v.layout.fever
      this.feverFill
        .clear()
        .roundRect(
          fever.x,
          fever.y,
          fever.width * (v.feverActive ? 1 : v.feverProgress),
          8,
          4,
        )
        .fill({ color: v.feverActive ? 0xffe038 : 0x40e9ff, alpha: 0.96 })
    }
    if (v.shotMode !== this.last.mode || v.feverActive) {
      this.last.mode = v.shotMode
      this.mode.text = v.feverActive ? `x${v.shotMode} FEVER` : `x${v.shotMode}`
      this.mode.style.fill = v.feverActive ? "#ffe038" : "#ffffff"
    }
  }
}
