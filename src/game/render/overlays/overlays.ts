import {
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Text,
  type Texture,
  type TextStyleFontWeight,
} from "pixi.js"
import type { GameView } from "../../types"
import type { BubbleShooterEngine } from "../../engine"
import type { GameTextures } from "../core/textures"
import { GameSettingsStore } from "../../settings"
import { LeaderboardOverlay } from "./leaderboardOverlay"
import { PauseOverlay } from "./pauseOverlay"
import { GAME_FONT_STACK } from "../core/typography"
import i18n from "../../../i18n"

function card(
  t: GameTextures,
  w: number,
  h: number,
  red: boolean,
): NineSliceSprite {
  return new NineSliceSprite({
    texture: red ? t.cardRed : t.card,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 18,
    bottomHeight: 18,
    width: w,
    height: h,
    anchor: 0.5,
  })
}

function title(text: string, size: number, color: string, y: number): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: GAME_FONT_STACK,
      fontWeight: "800",
      fontSize: size,
      fill: color,
      // Pixi's blurred drop shadow can rasterize Vietnamese combining marks
      // as stray dark pixels above the title. A tight stroke keeps the title
      // readable without producing artefacts on the loss dialog.
      stroke: { color: "#061946", width: 1 },
      // Keep the canvas baseline at Pixi's font default. Combining this with
      // anchor.y = 0.5 was clipping the lower edge of Vietnamese glyphs.
    },
    anchor: 0.5,
  })
  t.position.set(0, y)
  return t
}

function line(
  text: string,
  size: number,
  weight: number,
  fill: string,
  y: number,
): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: GAME_FONT_STACK,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fontSize: size,
      fill,
    },
    anchor: 0.5,
  })
  t.position.set(0, y)
  return t
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
  iconTexture?: Texture,
): Container {
  const c = new Container()
  const base = new NineSliceSprite({
    texture: t.pill,
    leftWidth: 18,
    rightWidth: 18,
    topHeight: 18,
    bottomHeight: 18,
    width: w,
    height: h,
    anchor: 0.5,
  })
  base.tint = color
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
  })
  top.position.set(0, -h / 4)
  const txt = new Text({
    text: labelText,
    label: "ButtonText",
    style: {
      fontFamily: GAME_FONT_STACK,
      fontWeight: "800",
      fontSize: 13,
      fill: "#FFFFFF",
    },
    anchor: 0.5,
  })
  const icon = iconTexture
    ? new Sprite({ texture: iconTexture, anchor: 0.5, label: "ButtonIcon" })
    : null
  // The button container is positioned by its centre. Keeping the label at
  // local y=0 prevents it from sinking below the pill's visible surface.
  if (icon) {
    icon.width = 17
    icon.height = 17
    icon.position.set(-w * 0.24, 0)
    txt.position.set(w * 0.13, 0)
    c.addChild(base, top, icon, txt)
  } else {
    txt.position.set(0, 0)
    c.addChild(base, top, txt)
  }
  c.position.set(x, y)
  c.eventMode = "static"
  c.hitArea = new Rectangle(-w / 2, -h / 2, w, h)
  c.cursor = "pointer"
  c.on("pointertap", onTap)
  c.on("pointerover", () => {
    base.tint = "#FFFFFF"
    txt.style.fill = "#ffffff"
  })
  c.on("pointerout", () => {
    base.tint = color
    txt.style.fill = "#FFFFFF"
  })
  return c
}

export class OverlaysLayer {
  private root = new Container({
    label: "OverlaysLayer",
    sortableChildren: true,
  })
  private win: Container = new Container()
  private lose: Container = new Container()
  private readonly pauseOverlay: PauseOverlay
  private readonly leaderboard: LeaderboardOverlay
  private winScore: Text = new Text()
  private winRank: Text = new Text()
  private winTitle: Text = new Text()
  private winScoreLabel: Text = new Text()
  private winRetryBtn: Container | null = null
  private winNextBtn: Container | null = null
  private loseTitle: Text = new Text()
  private loseScoreLabel: Text = new Text()
  private loseScore: Text = new Text()
  private loseRetryBtn: Container | null = null
  private winDim: Graphics | null = null
  private loseDim: Graphics | null = null
  private winCard: NineSliceSprite | null = null
  private loseCard: NineSliceSprite | null = null
  private winBox: Container | null = null
  private loseBox: Container | null = null
  private endOverlaysBuilt = false
  private lastWinScore = ""
  private lastRank = ""
  private lastLoseScore = ""
  private transitionPending = false
  private leaderboardPausedGame = false
  private leaderboardWasPaused = false

  constructor(
    parent: Container,
    textures: GameTextures,
    private engine: BubbleShooterEngine,
    settings: GameSettingsStore,
    consumePointerDown: () => void,
  ) {
    this.root.zIndex = 20
    parent.addChild(this.root)
    this.pauseOverlay = new PauseOverlay(
      this.root,
      textures,
      engine,
      settings,
      consumePointerDown,
    )
    this.leaderboard = new LeaderboardOverlay(
      this.root,
      textures,
      consumePointerDown,
      () => this.closeLeaderboard(),
    )
  }

  openLeaderboard() {
    if (this.leaderboard.isOpen) return
    this.leaderboardWasPaused = this.engine.phase === "PAUSED"
    this.leaderboardPausedGame = false
    if (!this.leaderboardWasPaused) {
      this.engine.togglePause()
      this.leaderboardPausedGame = this.engine.phase === "PAUSED"
    }
    this.pauseOverlay.setSuppressed(true)
    this.leaderboard.open()
  }

  closeLeaderboard() {
    if (!this.leaderboard.isOpen) return
    this.leaderboard.close()
    this.pauseOverlay.setSuppressed(false)
    if (this.leaderboardPausedGame && this.engine.phase === "PAUSED") {
      this.engine.resume()
    }
    this.leaderboardPausedGame = false
    this.leaderboardWasPaused = false
  }

  get leaderboardOpen() {
    return this.leaderboard.isOpen
  }

  dispose() {
    this.leaderboard.dispose()
  }

  private runTransition(_name: string, action: () => void): void {
    if (this.transitionPending) return
    this.transitionPending = true
    // Ads are temporarily disabled while the core game flow is being tuned.
    // Keep the guard so a future ad hook cannot double-trigger the action.
    try {
      action()
    } finally {
      this.transitionPending = false
    }
  }

  relayout(v: GameView, t: GameTextures) {
    if (!this.endOverlaysBuilt) this.buildEndOverlays(t)
    const l = v.layout
    const cx = l.LW / 2
    const cy = l.LH / 2
    this.pauseOverlay.relayout(v)
    this.leaderboard.relayout(v)
    this.drawScrim(this.winDim, l.LW, l.LH)
    this.drawScrim(this.loseDim, l.LW, l.LH)
    this.winCard!.position.set(cx, cy)
    this.loseCard!.position.set(cx, cy)
    this.winBox!.position.set(cx, cy)
    this.loseBox!.position.set(cx, cy)
    this.win.hitArea = new Rectangle(0, 0, l.LW, l.LH)
    this.lose.hitArea = new Rectangle(0, 0, l.LW, l.LH)
  }

  private drawScrim(scrim: Graphics | null, width: number, height: number) {
    scrim
      ?.clear()
      .rect(0, 0, width, height)
      .fill({ color: 0x050c26, alpha: 0.78 })
  }

  private setButtonText(btn: Container | null, text: string) {
    if (!btn) return
    const txt = btn.getChildByLabel("ButtonText") as Text | null
    if (txt) txt.text = text
  }

  private buildEndOverlays(t: GameTextures) {
    this.win = new Container({ label: "WinOverlay" })
    this.winDim = new Graphics({ label: "WinScrim", eventMode: "none" })
    this.winCard = card(t, 280, 240, false)
    this.winBox = new Container({ label: "WinDialog" })
    this.winRank = line("RANK 0 / 3", 12, 800, "rgba(197,235,255,.75)", -40)
    this.winScore = line("0", 26, 700, "#FFFFFF", 40)
    this.winTitle = title(
      i18n.t("game.level_clear", "LEVEL CLEAR!"),
      30,
      "#FFE04B",
      -82,
    )
    this.winScoreLabel = line(
      i18n.t("game.score", "SCORE").toUpperCase(),
      12,
      500,
      "rgba(180,200,255,.72)",
      10,
    )
    this.winRetryBtn = button(
      t,
      -40,
      78,
      68,
      36,
      i18n.t("game.retry", "RETRY").toUpperCase(),
      "#E94560",
      () => this.runTransition("retry_stage", () => this.engine.retry()),
    )
    this.winNextBtn = button(
      t,
      40,
      78,
      68,
      36,
      i18n.t("game.next", "NEXT").toUpperCase(),
      "#2DC653",
      () => this.runTransition("next_stage", () => this.engine.nextStage()),
    )
    this.winBox.addChild(
      this.winTitle,
      this.winRank,
      this.winScoreLabel,
      this.winScore,
      this.winRetryBtn,
      this.winNextBtn,
    )
    this.win.addChild(this.winDim, this.winCard, this.winBox)

    this.lose = new Container({ label: "LoseOverlay" })
    this.loseDim = new Graphics({ label: "LoseScrim", eventMode: "none" })
    this.loseCard = card(t, 292, 260, true)
    this.loseBox = new Container({ label: "LoseDialog" })
    this.loseScore = line("0", 26, 700, "#FFFFFF", 6)
    this.loseTitle = title(
      i18n.t("game.you_lose", "YOU LOST!").toUpperCase(),
      22,
      "#FF4D6D",
      -88,
    )
    this.loseScoreLabel = line(
      i18n.t("game.score", "SCORE").toUpperCase(),
      12,
      700,
      "#dff7ff",
      -35,
    )
    this.loseRetryBtn = button(
      t,
      0,
      72,
      148,
      40,
      i18n.t("game.play_again", "PLAY AGAIN").toUpperCase(),
      "#E94560",
      () => this.runTransition("retry_after_loss", () => this.engine.retry()),
      t.icons.rotateCcw,
    )
    this.loseBox.addChild(
      this.loseTitle,
      this.loseScoreLabel,
      this.loseScore,
      this.loseRetryBtn,
    )
    this.lose.addChild(this.loseDim, this.loseCard, this.loseBox)
    this.win.visible = false
    this.lose.visible = false
    this.root.addChild(this.win, this.lose, this.pauseOverlay.root)
    this.endOverlaysBuilt = true
  }

  sync(v: GameView) {
    const winOn = v.phase === "WIN"
    const loseOn = v.phase === "LOSE"
    this.win.visible = winOn
    this.lose.visible = loseOn
    this.pauseOverlay.sync(v)
    this.leaderboard.sync(v)
    if (winOn) {
      this.winTitle.text = i18n.t("game.level_clear", "LEVEL CLEAR!")
      this.winScoreLabel.text = i18n.t("game.score", "SCORE").toUpperCase()
      this.setButtonText(
        this.winRetryBtn,
        i18n.t("game.retry", "RETRY").toUpperCase(),
      )
      this.setButtonText(
        this.winNextBtn,
        i18n.t("game.next", "NEXT").toUpperCase(),
      )
      const s = v.score.toLocaleString()
      if (s !== this.lastWinScore) {
        this.winScore.text = s
        this.lastWinScore = s
      }
      const r = `RANK ${v.starsEarned} / 3`
      if (r !== this.lastRank) {
        this.winRank.text = r
        this.lastRank = r
      }
    }
    if (loseOn) {
      this.loseTitle.text = i18n.t("game.you_lose", "YOU LOST!").toUpperCase()
      this.loseScoreLabel.text = i18n.t("game.score", "SCORE").toUpperCase()
      this.setButtonText(
        this.loseRetryBtn,
        i18n.t("game.play_again", "PLAY AGAIN").toUpperCase(),
      )
      const s = v.score.toLocaleString()
      if (s !== this.lastLoseScore) {
        this.loseScore.text = s
        this.lastLoseScore = s
      }
    }
  }
}
