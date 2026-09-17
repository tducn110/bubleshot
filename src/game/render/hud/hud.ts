import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type TextStyleFontWeight,
} from "pixi.js"
import type { LayoutRect } from "../../layout"
import type { GameView } from "../../types"
import type { GameTextures } from "../core/textures"
import { GAME_FONT_STACK } from "../core/typography"
import { LEADERBOARD_PALETTE } from "../core/colors"
import i18n from "../../../i18n"

export interface HudActions {
  /** Notify the application shell that the player requested the dashboard. */
  requestDashboard: () => void
  /** Ask the game owner to toggle the current pause state. */
  requestPause: () => void
  /** Prevent the canvas gameplay pointer listener from handling this UI tap. */
  consumePointerDown: () => void
}

export interface HudDebugMetrics {
  readonly hud: LayoutRect
  readonly scoreLabelFontSize: number
  readonly scoreValueFontSize: number
  readonly trophyButton: LayoutRect
  readonly pauseButton: LayoutRect
  readonly trophyIcon: LayoutRect
  readonly pauseIcon: LayoutRect
  readonly horizontalPadding: number
  readonly verticalPadding: number
  readonly scoreToButtonsGap: number
  readonly buttonsGap: number
  readonly bubbleDiameter: number
}

function makeText(
  value: string,
  size: number,
  weight: number,
  fill: string | number,
  anchor: 0 | 0.5 = 0,
) {
  return new Text({
    text: value,
    style: {
      fontFamily: GAME_FONT_STACK,
      fontSize: size,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fill,
      letterSpacing: 0.4,
      dropShadow: {
        color: LEADERBOARD_PALETTE.dark,
        alpha: 0.2,
        blur: 2,
        distance: 1,
        angle: Math.PI / 2,
      },
    },
    anchor: { x: anchor, y: 0.5 },
  })
}

interface ActionButtonVisual {
  button: Container
  background: Graphics
  icon: Sprite
}

function makeActionButton(
  label: string,
  iconTexture: GameTextures["icons"][keyof GameTextures["icons"]],
): ActionButtonVisual {
  const button = new Container({ label })
  const background = new Graphics()
  const icon = new Sprite({ texture: iconTexture, anchor: 0.5 })
  background.label = `${label}Background`
  icon.label = `${label}Icon`
  button.addChild(background, icon)
  button.eventMode = "static"
  button.cursor = "pointer"
  return { button, background, icon }
}

function drawActionButton(
  visual: ActionButtonVisual,
  rect: LayoutRect,
  iconSize: number,
) {
  const radius = Math.min(rect.width, rect.height) / 2
  visual.button.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2)
  visual.background
    .clear()
    .circle(0, 0, radius)
    .fill({ color: LEADERBOARD_PALETTE.border, alpha: 0.98 })
    .stroke({ color: LEADERBOARD_PALETTE.purple, alpha: 0.22, width: 1 })
  visual.button.hitArea = new Rectangle(
    -radius - 7,
    -radius - 7,
    (radius + 7) * 2,
    (radius + 7) * 2,
  )
  visual.icon.tint = LEADERBOARD_PALETTE.purple
  visual.icon.width = iconSize
  visual.icon.height = iconSize
  visual.icon.position.set(0, 0)
}

export class HudLayer {
  readonly root = new Container({ label: "HudLayer" })
  private readonly panel = new Container({ label: "HudPanel" })
  private readonly backgroundFill = new Graphics()
  private readonly backgroundBorder = new Graphics()
  private readonly content = new Container({ label: "Content" })
  private readonly scoreRegion = new Container({ label: "ScoreRegion" })
  private readonly actionRegion = new Container({ label: "ActionRegion" })
  private readonly scoreLabel = makeText(
    i18n.t("game.score", "SCORE").toUpperCase(),
    10,
    900,
    LEADERBOARD_PALETTE.text,
  )
  private readonly scoreValue = makeText("0", 22, 900, LEADERBOARD_PALETTE.dark)
  private readonly dashboard: ActionButtonVisual
  private readonly pause: ActionButtonVisual
  private lastScore = ""
  private suppressed = false

  constructor(
    parent: Container,
    textures: GameTextures,
    private readonly actions: HudActions,
  ) {
    this.root.zIndex = 10
    this.dashboard = makeActionButton("DashboardButton", textures.icons.trophy)
    this.pause = makeActionButton("PauseButton", textures.icons.pause)
    this.backgroundFill.label = "BackgroundFill"
    this.backgroundBorder.label = "BackgroundBorder"
    this.scoreLabel.label = "ScoreLabel"
    this.scoreValue.label = "ScoreValue"
    parent.addChild(this.root)
    this.root.addChild(this.panel)
    this.panel.addChild(
      this.backgroundFill,
      this.backgroundBorder,
      this.content,
    )
    this.content.addChild(this.scoreRegion, this.actionRegion)
    this.scoreRegion.addChild(this.scoreLabel, this.scoreValue)
    this.actionRegion.addChild(this.dashboard.button, this.pause.button)

    this.dashboard.button.on("pointerdown", () => {
      this.actions.consumePointerDown()
    })
    this.dashboard.button.on("pointertap", () => {
      this.actions.requestDashboard()
    })
    this.pause.button.on("pointerdown", () => {
      this.actions.consumePointerDown()
      this.actions.requestPause()
    })
  }

  relayout(view: GameView) {
    const l = view.layout
    const panel = l.hudRect
    const hud = l.hud
    const radius = Math.max(16, Math.min(18, panel.height * 0.28))

    this.backgroundFill
      .clear()
      .roundRect(panel.x, panel.y, panel.width, panel.height, radius)
      .fill({ color: LEADERBOARD_PALETTE.frame, alpha: 0.96 })
    this.backgroundBorder
      .clear()
      .roundRect(panel.x, panel.y, panel.width, panel.height, radius)
      .stroke({ color: LEADERBOARD_PALETTE.border, alpha: 0.42, width: 1 })

    const scoreFontSize = Math.max(18, Math.min(24, hud.scoreRect.width * 0.24))
    this.scoreLabel.style.fontSize = Math.max(
      10,
      Math.min(12, hud.scoreRect.width * 0.1),
    )
    this.scoreValue.style.fontSize = scoreFontSize
    this.scoreLabel.position.set(
      hud.scoreRect.x,
      hud.scoreRect.y + hud.scoreRect.height * 0.25,
    )
    this.scoreValue.position.set(
      hud.scoreRect.x,
      hud.scoreRect.y + hud.scoreRect.height * 0.73,
    )
    this.fitScoreValue(hud.scoreRect.width)

    drawActionButton(
      this.dashboard,
      hud.dashboardRect,
      Math.min(hud.dashboardRect.width, hud.dashboardRect.height) * 0.56,
    )
    drawActionButton(
      this.pause,
      hud.pauseRect,
      Math.min(hud.pauseRect.width, hud.pauseRect.height) * 0.38,
    )

    this.lastScore = ""
  }

  sync(view: GameView) {
    this.scoreLabel.text = i18n.t("game.score", "SCORE").toUpperCase()
    const score = view.score.toLocaleString()
    if (score !== this.lastScore) {
      this.scoreValue.text = score
      this.fitScoreValue(view.layout.hud.scoreRect.width)
      this.lastScore = score
    }
  }

  /** Keep the leaderboard header free from the gameplay HUD underneath it. */
  setSuppressed(suppressed: boolean) {
    if (this.suppressed === suppressed) return
    this.suppressed = suppressed
    this.root.visible = !suppressed
  }

  debugMetrics(view: GameView): HudDebugMetrics {
    const l = view.layout
    const hud = l.hud
    const trophyIconBounds = this.dashboard.icon.getLocalBounds()
    const pauseIconBounds = this.pause.icon.getLocalBounds()

    return {
      hud: { ...l.hudRect },
      scoreLabelFontSize: Number(this.scoreLabel.style.fontSize),
      scoreValueFontSize: Number(this.scoreValue.style.fontSize),
      trophyButton: { ...hud.dashboardRect },
      pauseButton: { ...hud.pauseRect },
      trophyIcon: {
        x: trophyIconBounds.x,
        y: trophyIconBounds.y,
        width: trophyIconBounds.width,
        height: trophyIconBounds.height,
      },
      pauseIcon: {
        x: pauseIconBounds.x,
        y: pauseIconBounds.y,
        width: pauseIconBounds.width,
        height: pauseIconBounds.height,
      },
      horizontalPadding: hud.contentRect.x - l.hudRect.x,
      verticalPadding: hud.contentRect.y - l.hudRect.y,
      scoreToButtonsGap:
        hud.dashboardRect.x - (hud.scoreRect.x + hud.scoreRect.width),
      buttonsGap:
        hud.pauseRect.x - (hud.dashboardRect.x + hud.dashboardRect.width),
      bubbleDiameter: l.R * 2,
    }
  }

  private fitScoreValue(maxWidth: number) {
    const localWidth = this.scoreValue.getLocalBounds().width
    this.scoreValue.scale.set(
      localWidth > 0 ? Math.min(1, Math.max(0, maxWidth / localWidth)) : 1,
      1,
    )
  }
}
