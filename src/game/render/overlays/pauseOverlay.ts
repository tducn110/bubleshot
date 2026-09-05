import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type TextStyleFontWeight,
} from "pixi.js"
import type { GameView } from "../../types"
import type { BubbleShooterEngine } from "../../engine"
import { GameSettingsStore, type GameSettingKey } from "../../settings"
import type { PixiIconName } from "../hud/icons"
import type { GameTextures } from "../core/textures"
import { GAME_FONT_STACK } from "../core/typography"
import i18n from "../../../i18n"
import { LEADERBOARD_PALETTE } from "../core/colors"

interface ToggleVisual {
  readonly root: Container
  readonly setEnabled: (enabled: boolean) => void
}

interface SettingRowVisual {
  readonly root: Container
  readonly icon: Sprite
  readonly label: Text
  readonly separator: Graphics
  readonly toggle: ToggleVisual
}

interface LanguageRowVisual {
  readonly root: Container
  readonly icon: Sprite
  readonly label: Text
  readonly value: Text
  readonly separator: Graphics
}

function makeText(
  text: string,
  fontSize: number,
  weight: number,
  color: string | number,
  anchor: 0 | 0.5 = 0,
) {
  return new Text({
    text,
    style: {
      fontFamily: GAME_FONT_STACK,
      fontSize,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fill: color,
    },
    anchor: { x: anchor, y: 0.5 },
  })
}

function currentLanguageCode() {
  return i18n.resolvedLanguage?.startsWith("en") ? "en" : "vi"
}

function currentLanguageLabel() {
  return currentLanguageCode() === "vi" ? "Tiếng Việt" : "English"
}

function makeToggle(): ToggleVisual {
  const root = new Container({ label: "Toggle" })
  const track = new Graphics({ label: "ToggleTrack" })
  const knob = new Graphics({ label: "ToggleKnob" })
  let current: boolean | undefined
  root.addChild(track, knob)

  return {
    root,
    setEnabled(enabled) {
      if (current === enabled) return
      current = enabled
      track
        .clear()
        .roundRect(-20, -10, 40, 20, 10)
        .fill({
          color: enabled
            ? LEADERBOARD_PALETTE.border
            : LEADERBOARD_PALETTE.text,
          alpha: 0.98,
        })
        .stroke({
          color: LEADERBOARD_PALETTE.border,
          alpha: 0.64,
          width: 1,
        })
      knob
        .clear()
        .circle(enabled ? 10 : -10, 0, 7)
        .fill({ color: LEADERBOARD_PALETTE.white, alpha: 0.98 })
        .stroke({ color: LEADERBOARD_PALETTE.white, alpha: 0.35, width: 1 })
    },
  }
}

function makeContinueButton(
  engine: BubbleShooterEngine,
  textures: GameTextures,
  consumePointerDown: () => void,
) {
  const root = new Container({ label: "ContinueButton" })
  const background = new Graphics({ label: "ContinueBackground" })
  const highlight = new Graphics({ label: "ContinueHighlight" })
  const icon = new Sprite({
    texture: textures.icons.play,
    anchor: 0.5,
    label: "ContinueIcon",
  })
  const text = makeText("TIẾP TỤC", 16, 800, "#ffffff", 0.5)
  root.addChild(background, highlight, icon, text)
  root.eventMode = "static"
  root.cursor = "pointer"
  root.on("pointerdown", consumePointerDown)
  root.on("pointertap", () => {
    consumePointerDown()
    engine.resume()
  })

  return {
    root,
    setText(value: string) {
      text.text = value
    },
    layout(width: number, height: number) {
      background
        .clear()
        .roundRect(-width / 2, -height / 2, width, height, height / 2)
        .fill({ color: LEADERBOARD_PALETTE.purple, alpha: 0.98 })
        .stroke({ color: LEADERBOARD_PALETTE.border, alpha: 0.72, width: 1 })
      highlight
        .clear()
        .roundRect(
          -width / 2 + 3,
          -height / 2 + 3,
          width - 6,
          Math.max(4, height * 0.34),
          height / 2,
        )
        .fill({ color: LEADERBOARD_PALETTE.border, alpha: 0.2 })
      icon.width = 16
      icon.height = 16
      icon.position.set(-width * 0.25, 0)
      text.position.set(width * 0.08, 0)
      root.hitArea = new Rectangle(-width / 2, -height / 2, width, height)
    },
  }
}

function makeSettingRow(
  iconName: PixiIconName,
  label: string,
  key: GameSettingKey,
  textures: GameTextures,
  settings: GameSettingsStore,
  consumePointerDown: () => void,
): SettingRowVisual {
  const root = new Container({ label: `${key}SettingRow` })
  const icon = new Sprite({
    texture: textures.icons[iconName],
    anchor: 0.5,
    label: `${key}Icon`,
  })
  const text = makeText(label, 15, 600, LEADERBOARD_PALETTE.frame)
  const separator = new Graphics({ label: `${key}Separator` })
  const toggle = makeToggle()
  root.addChild(separator, icon, text, toggle.root)
  root.eventMode = "static"
  root.cursor = "pointer"
  root.on("pointerdown", consumePointerDown)
  root.on("pointertap", () => {
    consumePointerDown()
    settings.toggle(key)
  })

  return {
    root,
    icon,
    label: text,
    separator,
    toggle,
  }
}

function makeLanguageRow(
  textures: GameTextures,
  consumePointerDown: () => void,
): LanguageRowVisual {
  const root = new Container({ label: "LanguageSettingRow" })
  const icon = new Sprite({
    texture: textures.icons.languages,
    anchor: 0.5,
    label: "LanguageIcon",
  })
  const label = makeText(
    i18n.t("settings.language"),
    15,
    600,
    LEADERBOARD_PALETTE.frame,
  )
  const value = makeText(
    currentLanguageLabel(),
    13,
    800,
    LEADERBOARD_PALETTE.border,
    0.5,
  )
  const separator = new Graphics({ label: "LanguageSeparator" })
  root.addChild(separator, icon, label, value)
  root.eventMode = "static"
  root.cursor = "pointer"
  root.on("pointerdown", consumePointerDown)
  root.on("pointertap", () => {
    consumePointerDown()
    void i18n.changeLanguage(currentLanguageCode() === "vi" ? "en" : "vi")
  })
  return { root, icon, label, value, separator }
}

export class PauseOverlay {
  readonly root = new Container({ label: "PauseOverlay" })
  private readonly scrim = new Graphics({ label: "DimScrim" })
  private readonly panel = new Container({ label: "PausePanel" })
  private readonly panelFill = new Graphics({ label: "PausePanelFill" })
  private readonly panelBorder = new Graphics({ label: "PausePanelBorder" })
  private readonly title = makeText(
    "TẠM DỪNG",
    24,
    800,
    LEADERBOARD_PALETTE.white,
    0.5,
  )
  private readonly continueButton
  private readonly musicRow
  private readonly sfxRow
  private readonly hapticsRow
  private readonly languageRow
  private readonly icons: GameTextures["icons"]
  private suppressed = false

  constructor(
    parent: Container,
    textures: GameTextures,
    engine: BubbleShooterEngine,
    private readonly settings: GameSettingsStore,
    private readonly consumePointerDown: () => void,
  ) {
    this.icons = textures.icons
    parent.addChild(this.root)
    this.root.visible = false
    this.root.eventMode = "static"
    this.scrim.eventMode = "static"
    this.scrim.on("pointerdown", this.consumePointerDown)

    this.continueButton = makeContinueButton(
      engine,
      textures,
      this.consumePointerDown,
    )
    this.musicRow = makeSettingRow(
      "music",
      i18n.t("settings.music"),
      "bgmEnabled",
      textures,
      settings,
      this.consumePointerDown,
    )
    this.sfxRow = makeSettingRow(
      "volume",
      i18n.t("settings.sfx"),
      "sfxEnabled",
      textures,
      settings,
      this.consumePointerDown,
    )
    this.hapticsRow = makeSettingRow(
      "vibration",
      i18n.t("settings.haptics", "Rung"),
      "hapticsEnabled",
      textures,
      settings,
      this.consumePointerDown,
    )
    this.languageRow = makeLanguageRow(textures, this.consumePointerDown)

    this.panel.addChild(
      this.panelFill,
      this.panelBorder,
      this.title,
      this.continueButton.root,
      this.musicRow.root,
      this.sfxRow.root,
      this.hapticsRow.root,
      this.languageRow.root,
    )
    this.root.addChild(this.scrim, this.panel)
  }

  relayout(view: GameView) {
    const l = view.layout
    const minAxis = Math.min(l.LW, l.LH)
    const panelWidth = Math.min(320, Math.max(260, l.LW - 32))
    const padding = Math.max(16, Math.min(20, Math.round(minAxis * 0.05)))
    const titleHeight = 28
    const titleGap = 12
    const continueHeight = 42
    const continueGap = 16
    const rowHeight = 34
    const rowGap = 8
    const panelHeight =
      padding * 2 +
      titleHeight +
      titleGap +
      continueHeight +
      continueGap +
      rowHeight * 4 +
      rowGap * 3
    const panelX = Math.round((l.LW - panelWidth) / 2)
    const panelY = Math.round((l.LH - panelHeight) / 2)
    const radius = Math.max(16, Math.min(20, minAxis * 0.05))
    const rowWidth = panelWidth - padding * 2

    this.scrim
      .clear()
      .rect(0, 0, l.LW, l.LH)
      .fill({ color: LEADERBOARD_PALETTE.dark, alpha: 0.52 })
    this.scrim.hitArea = new Rectangle(0, 0, l.LW, l.LH)

    this.panel.position.set(panelX, panelY)
    this.panelFill
      .clear()
      .roundRect(0, 0, panelWidth, panelHeight, radius)
      .fill({ color: LEADERBOARD_PALETTE.dark, alpha: 0.98 })
    this.panelBorder
      .clear()
      .roundRect(0, 0, panelWidth, panelHeight, radius)
      .stroke({ color: LEADERBOARD_PALETTE.border, alpha: 0.72, width: 1 })
    this.panel.hitArea = new Rectangle(0, 0, panelWidth, panelHeight)

    this.title.position.set(panelWidth / 2, padding + titleHeight / 2)
    this.continueButton.root.position.set(
      panelWidth / 2,
      padding + titleHeight + titleGap + continueHeight / 2,
    )
    this.continueButton.layout(Math.min(176, rowWidth), continueHeight)

    const rowsY =
      padding + titleHeight + titleGap + continueHeight + continueGap
    this.layoutRow(this.musicRow, rowWidth, padding, rowsY, rowHeight, 20)
    this.layoutRow(
      this.sfxRow,
      rowWidth,
      padding,
      rowsY + rowHeight + rowGap,
      rowHeight,
      20,
    )
    this.layoutRow(
      this.hapticsRow,
      rowWidth,
      padding,
      rowsY + (rowHeight + rowGap) * 2,
      rowHeight,
      20,
    )
    this.layoutLanguageRow(
      this.languageRow,
      rowWidth,
      padding,
      rowsY + (rowHeight + rowGap) * 3,
      rowHeight,
      20,
    )
  }

  sync(view: GameView) {
    const paused = view.phase === "PAUSED"
    this.root.visible = paused && !this.suppressed
    this.settings.setGameplayPaused(paused)
    this.title.text = i18n.t("common.pause").toUpperCase()
    this.continueButton.setText(i18n.t("common.resume").toUpperCase())
    this.musicRow.label.text = i18n.t("settings.music")
    this.sfxRow.label.text = i18n.t("settings.sfx")
    this.hapticsRow.label.text = i18n.t("settings.haptics", "Rung")
    this.musicRow.toggle.setEnabled(this.settings.value.bgmEnabled)
    this.sfxRow.toggle.setEnabled(this.settings.value.sfxEnabled)
    this.hapticsRow.toggle.setEnabled(this.settings.value.hapticsEnabled)
    this.languageRow.label.text = i18n.t("settings.language")
    this.languageRow.value.text = currentLanguageLabel()
    this.sfxRow.icon.texture = this.settings.value.sfxEnabled
      ? this.icons.volume
      : this.icons.volumeX
  }

  setSuppressed(suppressed: boolean) {
    this.suppressed = suppressed
    if (suppressed) this.root.visible = false
  }

  private layoutRow(
    row: SettingRowVisual,
    width: number,
    x: number,
    y: number,
    height: number,
    iconSize: number,
  ) {
    row.root.position.set(x, y)
    row.separator
      .clear()
      .moveTo(0, height - 1)
      .lineTo(width, height - 1)
      .stroke({ color: LEADERBOARD_PALETTE.border, alpha: 0.18, width: 1 })
    row.icon.width = iconSize
    row.icon.height = iconSize
    row.icon.position.set(16, height / 2)
    row.label.position.set(36, height / 2)
    row.toggle.root.position.set(width - 20, height / 2)
  }

  private layoutLanguageRow(
    row: LanguageRowVisual,
    width: number,
    x: number,
    y: number,
    height: number,
    iconSize: number,
  ) {
    row.root.position.set(x, y)
    row.separator
      .clear()
      .moveTo(0, height - 1)
      .lineTo(width, height - 1)
      .stroke({ color: LEADERBOARD_PALETTE.border, alpha: 0.18, width: 1 })
    row.icon.width = iconSize
    row.icon.height = iconSize
    row.icon.position.set(16, height / 2)
    row.label.position.set(36, height / 2)
    row.value.position.set(width - 20, height / 2)
  }
}
