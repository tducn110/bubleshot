import {
  Circle,
  Container,
  Graphics,
  Sprite,
  Text,
  type TextStyleOptions,
} from "pixi.js"
import { COLORS } from "../../config"
import type {
  AnimationKind,
  GameView,
  PowerUpId,
  PowerUpStatus,
  VisualBubble,
} from "../../types"
import { endDevMeasure, measureDev, startDevMeasure } from "../../perf"
import { SpritePool } from "./pools"
import { BubblePool, BubbleVisual } from "../hud/bubbleVisual"
import { GameplayAnimations, type ClaimedBubble } from "../fx/animations"
import { GameplayParticleLayer } from "../fx/particleLayer"
import { reconcilePersistentVisuals } from "../hud/boardReconcile"
import {
  TEX_BR,
  TRAJ_R,
  makeDangerLineTexture,
  type GameTextures,
} from "./textures"
import { GAME_FONT_STACK } from "./typography"
import { LEADERBOARD_PALETTE } from "./colors"

const DEBUG_LAYOUT =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("debugLayout")

interface BoardShiftMotion {
  sx: number
  sy: number
  tx: number
  ty: number
}

function popupStyle(big: boolean, color: string): TextStyleOptions {
  return {
    fontFamily: GAME_FONT_STACK,
    fontWeight: "900",
    fontSize: big ? 34 : 20,
    fill: color,
    stroke: { color: 0x134872, width: big ? 5 : 3, alpha: 0.48 },
    dropShadow: { color, blur: 12, distance: 0, alpha: 1 },
    textBaseline: "middle",
  }
}

class CannonContainer extends Container {
  private readonly shadow = new Graphics()
  private readonly base = new Graphics()
  private readonly body = new Graphics()
  private readonly barrel = new Graphics()
  private readonly socket = new Graphics()
  private readonly muzzle = new Graphics()
  readonly loadedBubble: BubbleVisual
  readonly nextBubble: BubbleVisual
  private readonly nextSlot = new Container({ label: "NextSlot" })
  private readonly nextLabel = new Text({
    text: "SWAP",
    style: {
      fontFamily: GAME_FONT_STACK,
      fontSize: 9,
      fontWeight: "800",
      fill: "#ffffff",
      letterSpacing: 1,
    },
    anchor: { x: 0.5, y: 0.5 },
  })

  constructor(
    t: GameTextures,
    consumePointerDown?: () => void,
    onSwapNext?: () => void,
  ) {
    super({ label: "Cannon" })
    this.loadedBubble = new BubbleVisual(t)
    this.nextBubble = new BubbleVisual(t)
    this.nextSlot.addChild(this.nextBubble, this.nextLabel)
    this.nextSlot.eventMode = "static"
    this.nextSlot.cursor = "pointer"
    if (consumePointerDown) {
      this.nextSlot.on("pointerdown", consumePointerDown)
    }
    if (onSwapNext) {
      this.nextSlot.on("pointertap", onSwapNext)
    }
    this.addChild(
      this.shadow,
      this.barrel,
      this.body,
      this.base,
      this.socket,
      this.muzzle,
      this.loadedBubble,
      this.nextSlot,
    )
  }

  relayout(l: GameView["layout"], current: string, next: string) {
    this.position.set(l.SHOOTER_X, l.SHOOTER_Y)
    this.shadow
      .clear()
      .ellipse(0, 38, 54, 10)
      .fill({ color: 0x063c66, alpha: 0.48 })
    this.base
      .clear()
      .roundRect(-48, 12, 96, 28, 14)
      .fill({ color: 0x0b6594, alpha: 0.96 })
    this.base.roundRect(-37, 16, 74, 7, 4).fill({ color: 0xa7f6ff, alpha: 0.3 })
    this.body
      .clear()
      .roundRect(-31, -3, 62, 34, 18)
      .fill({ color: 0x116da3, alpha: 1 })
    this.body.roundRect(-23, 1, 46, 9, 5).fill({ color: 0x54c7e7, alpha: 0.5 })
    this.barrel
      .clear()
      .roundRect(-14, -42, 28, 45, 13)
      .fill({ color: 0x0a4c7c, alpha: 1 })
    this.barrel
      .roundRect(-8, -37, 16, 29, 8)
      .fill({ color: 0x2e9ec4, alpha: 0.8 })
    this.socket.clear().circle(0, -5, 17).fill({ color: 0x063b6a, alpha: 1 })
    this.socket.circle(0, -5, 10).fill({ color: 0x8cefff, alpha: 0.75 })
    this.muzzle.clear().circle(0, -48, 9).fill({ color: 0xfff7cf, alpha: 0.92 })
    this.muzzle.circle(0, -48, 16).fill({ color: 0xffd43b, alpha: 0.2 })
    this.muzzle.visible = false
    this.loadedBubble.position.set(0, -5)
    this.loadedBubble.setScale((l.R / TEX_BR) * 1.05)
    this.loadedBubble.setColor(current)
    this.nextSlot.position.set(72, 18)
    this.nextSlot.hitArea = new Circle(0, 0, Math.max(26, l.R))
    this.nextBubble.position.set(0, 0)
    this.nextBubble.setScale((l.R / TEX_BR) * 0.7)
    this.nextBubble.setColor(next)
    this.nextLabel.position.set(0, 22)
  }

  setAim(angle: number) {
    this.barrel.rotation = angle
  }

  recoil(amount: number) {
    this.barrel.position.set(0, amount)
  }

  setMuzzle(active: boolean, angle: number) {
    this.muzzle.visible = active
    this.muzzle.rotation = angle
    this.muzzle.alpha = active ? 0.9 : 0
    this.muzzle.scale.set(active ? 1.15 : 0.7)
  }
}

export class SceneLayers {
  private bg: Sprite
  private wallGuides = new Graphics({ label: "WallGuides" })
  private trajectory = new Graphics({ label: "Trajectory" })
  private dangerLine: Sprite
  private dangerMarker: Sprite
  private readonly powerUps = ["rows3", "bomb", "rainbow", "waypoints"] as const
  private readonly powerUpButtons: Array<{
    root: Container
    bg: Graphics
    icon: Sprite
  }> = []
  private powerUpStateKey = ""
  private boardLayer = new Container({ label: "BoardLayer" })
  private fxLayer = new Container({ label: "FxLayer" })
  private shotLayer = new Container({ label: "ShotLayer" })
  private boardSprites = new Map<number, BubbleVisual>()
  private boardColors = new Map<number, number>()
  private boardPool: BubblePool
  private popPool: BubblePool
  private dropPool: BubblePool
  private dotSprites: Sprite[] = []
  private impactSprite: Sprite
  private dotPool = new SpritePool(this.shotLayer)
  private animations: GameplayAnimations
  private particleLayer: GameplayParticleLayer
  private popupTexts: Text[] = []
  private popupTextKeys: string[] = []
  private popupBigKeys: boolean[] = []
  private popupColorKeys: string[] = []
  private popupFree: Text[] = []
  private shotSprites: BubbleVisual[]
  private dangerTex: ReturnType<typeof makeDangerLineTexture> | null = null
  private cannon: CannonContainer
  private debugLayout: Graphics | null = DEBUG_LAYOUT ? new Graphics() : null
  private lastBoardVersion = -1
  private lastNear = false
  private lastShotC = -1
  private lastCur = -1
  private lastRowShiftVersion = 0
  private boardShiftMotion: Map<number, BoardShiftMotion> | null = null
  private boardSyncGeneration = 0
  private readonly boardSeen = new Map<number, number>()
  private currentBaseScale = 1

  constructor(
    parent: Container,
    t: GameTextures,
    dropPoolCapacity: number,
    boardPoolCapacity: number,
    onAnimationComplete: (
      commandId: number,
      actionId: number,
      kind: AnimationKind,
    ) => void,
    consumePointerDown: () => void,
    onPowerUp: (id: PowerUpId) => void,
    onSwapNext?: () => void,
  ) {
    this.bg = new Sprite({ label: "Background" })
    this.bg.anchor.set(0.5)
    this.dangerLine = new Sprite({ label: "DangerLine" })
    this.dangerMarker = new Sprite({
      texture: t.icons.alertTriangle,
      anchor: 0.5,
      label: "DangerMarker",
    })
    parent.addChild(
      this.bg,
      this.wallGuides,
      this.boardLayer,
      this.fxLayer,
      this.shotLayer,
      this.dangerLine,
      this.dangerMarker,
    )
    if (this.debugLayout) parent.addChild(this.debugLayout)
    this.shotSprites = Array.from({ length: 4 }, () => new BubbleVisual(t))
    this.impactSprite = new Sprite({
      texture: t.whiteDot,
      anchor: 0.5,
      tint: "#FFE04B",
    })
    this.cannon = new CannonContainer(t, consumePointerDown, onSwapNext)
    for (const [index, iconName] of this.powerUps.entries()) {
      const root = new Container({ label: `PowerUp${index + 1}` })
      const bg = new Graphics({ label: `PowerUp${index + 1}Background` })
      const icon = new Sprite({
        texture: t.icons[iconName],
        anchor: 0.5,
        label: `PowerUp${index + 1}Icon`,
      })
      root.addChild(bg, icon)
      root.eventMode = "static"
      root.cursor = "pointer"
      root.on("pointerdown", consumePointerDown)
      root.on("pointertap", () => onPowerUp(iconName))
      this.powerUpButtons.push({ root, bg, icon })
    }
    this.boardPool = new BubblePool(this.boardLayer, t)
    this.popPool = new BubblePool(this.fxLayer, t)
    this.dropPool = new BubblePool(this.fxLayer, t)
    // A legal board resolve must only activate existing scene objects. The
    // capacity is derived from the measured danger line, not a magic number.
    measureDev("startup/drop-pool-prewarm", () =>
      this.dropPool.prewarm(dropPoolCapacity),
    )
    measureDev("startup/gameplay-pools-prewarm", () => {
      this.boardPool.prewarm(boardPoolCapacity)
      this.popPool.prewarm(boardPoolCapacity)
      this.dotPool.prewarm(38, t.trajDot)
      for (let i = 0; i < 12; i++) {
        const popup = new Text({
          text: "",
          style: popupStyle(false, "#ffffff"),
          anchor: { x: 0.5, y: 0.5 },
        })
        popup.visible = false
        this.fxLayer.addChild(popup)
        this.popupFree.push(popup)
      }
    })
    this.particleLayer = new GameplayParticleLayer(this.fxLayer, t)
    this.animations = new GameplayAnimations(
      this.fxLayer,
      t,
      {
        claimBubble: (bubble, kind, parent) =>
          this.claimAnimationBubble(bubble, kind, parent),
        getBoardBubble: (id) => this.boardSprites.get(id),
        complete: onAnimationComplete,
      },
      dropPoolCapacity,
    )
    this.shotLayer.addChild(
      this.trajectory,
      this.cannon,
      this.impactSprite,
      ...this.shotSprites,
      ...this.powerUpButtons.map(({ root }) => root),
    )
  }

  relayout(v: GameView, t: GameTextures) {
    const l = v.layout
    this.dropPool.prewarm(l.maxFloatingBubbleCount(v.board.gridParity))
    this.boardPool.prewarm(l.maxBoardBubbleCount(v.board.gridParity))
    this.popPool.prewarm(l.maxBoardBubbleCount(v.board.gridParity))
    this.bg.texture = t.background
    const coverScale = Math.max(
      l.LW / t.background.width,
      l.LH / t.background.height,
    )
    this.bg.scale.set(coverScale)
    this.bg.position.set(l.LW / 2, l.LH / 2)
    this.wallGuides
      .clear()
      .moveTo(l.WALL_L, l.BOARD_TOP)
      .lineTo(l.WALL_L, l.DANGER_Y)
      .moveTo(l.WALL_R, l.BOARD_TOP)
      .lineTo(l.WALL_R, l.DANGER_Y)
      .stroke({ color: 0x7feeff, alpha: 0.22, width: 1.5 })
    this.lastNear = this.near(v)
    this.rebuildDanger(v, t)
    this.layoutPowerUps(v)
    const baseScale = l.R / TEX_BR
    this.currentBaseScale = baseScale
    this.particleLayer.relayout(l.LW, l.LH)
    for (let r = 0; r < v.board.rows.length; r++) {
      for (let c = 0; c < l.rowCapacity(r, v.board.gridParity); c++) {
        const id = v.board.id(r, c)
        const s = id === null ? undefined : this.boardSprites.get(id)
        if (!s) continue
        const p = l.gToW(r, c, v.board.gridParity)
        s.position.set(p.x, p.y)
        s.setScale(baseScale)
      }
    }
    this.lastBoardVersion = -1
    this.boardShiftMotion = null
    this.cannon.relayout(l, COLORS[v.cur], COLORS[v.nxt])
    if (this.debugLayout) {
      this.debugLayout.clear()
      this.debugLayout
        .rect(0, 0, l.LW, l.LH)
        .stroke({ color: 0x22ddff, alpha: 0.5, width: 1 })
      this.debugLayout
        .rect(l.hudRect.x, l.hudRect.y, l.hudRect.width, l.hudRect.height)
        .stroke({ color: 0xffcc33, alpha: 0.8, width: 1 })
      this.debugLayout
        .rect(
          l.gameplayRect.x,
          l.gameplayRect.y,
          l.gameplayRect.width,
          l.gameplayRect.height,
        )
        .stroke({ color: 0x44ff88, alpha: 0.8, width: 1 })
      this.debugLayout
        .moveTo(l.WALL_L, l.DANGER_Y)
        .lineTo(l.WALL_R, l.DANGER_Y)
        .stroke({ color: 0xff4477, alpha: 0.9, width: 2 })
      for (let row = 0; row < l.MAX_ROWS; row++)
        for (let col = 0; col < l.rowCapacity(row, v.board.gridParity); col++) {
          const p = l.gToW(row, col, v.board.gridParity)
          this.debugLayout
            .circle(p.x, p.y, 2)
            .fill({ color: row % 2 ? 0xffaa44 : 0x44ddff, alpha: 0.75 })
        }
      this.debugLayout
        .circle(l.SHOOTER_X, l.SHOOTER_Y, 5)
        .fill({ color: 0xffffff, alpha: 0.95 })
    }
  }

  sync(v: GameView, t: GameTextures) {
    const l = v.layout
    const baseScale = l.R / TEX_BR
    this.currentBaseScale = baseScale
    this.animations.setPaused(v.phase === "PAUSED")
    // Match/drop commands claim their stable-ID visuals before board
    // reconciliation releases cells removed by the atomic commit.
    this.animations.prepare(v.fx.commands, v.fx.commandEpoch)
    if (v.board.version !== this.lastBoardVersion)
      this.syncBoard(v, t, baseScale)
    this.animations.startPendingLandings()
    this.updateBoardMotion(v)
    this.particleLayer.sync(v.fx.parts, v.fx.trails)
    this.syncPopups(v)
    this.syncShots(v, t, baseScale)
    this.syncTraj(v, t)
    this.syncDanger(v, t)
    this.syncPowerUps(v)
  }

  private claimAnimationBubble(
    bubble: VisualBubble,
    kind: "match" | "drop",
    parent: Container,
  ): ClaimedBubble {
    let visual = this.boardSprites.get(bubble.id)
    let release: () => void
    if (visual) {
      this.boardSprites.delete(bubble.id)
      this.boardColors.delete(bubble.id)
      this.boardSeen.delete(bubble.id)
      const claimed = visual
      release = () => this.boardPool.put(claimed)
    } else {
      const pool = kind === "match" ? this.popPool : this.dropPool
      visual = pool.take(COLORS[bubble.c])
      const claimed = visual
      release = () => pool.put(claimed)
    }
    parent.addChild(visual)
    visual.visible = true
    visual.alpha = 1
    visual.scale.set(1)
    visual.setScale(this.currentBaseScale)
    visual.setColor(COLORS[bubble.c])
    return { visual, release }
  }

  destroy() {
    this.animations.destroy()
  }

  private near(v: GameView): boolean {
    const start = Math.max(0, v.layout.DANGER_ROW - 2)
    for (let row = start; row < v.board.rows.length; row++) {
      const capacity = v.layout.rowCapacity(row, v.board.gridParity)
      for (let col = 0; col < capacity; col++)
        if (v.board.cell(row, col) !== null) return true
    }
    return false
  }

  private rebuildDanger(v: GameView, t: GameTextures) {
    this.dangerTex?.destroy(true)
    this.dangerTex = makeDangerLineTexture(v.layout, this.lastNear)
    this.dangerLine.texture = this.dangerTex
    this.dangerLine.position.set(v.layout.BOARD_LEFT, v.layout.DANGER_Y)
    this.dangerMarker.position.set(v.layout.BOARD_CENTER_X, v.layout.DANGER_Y)
    this.dangerMarker.width = Math.max(18, Math.min(26, v.layout.R * 1.15))
    this.dangerMarker.height = this.dangerMarker.width
    this.dangerMarker.tint = 0xff4d6d
  }

  private layoutPowerUps(v: GameView) {
    const size = Math.max(16, v.layout.hud.powerUpRects[0]?.width ?? 36)
    for (let i = 0; i < this.powerUpButtons.length; i++) {
      const visual = this.powerUpButtons[i]
      const rect = v.layout.hud.powerUpRects[i]
      if (!rect) {
        visual.root.visible = false
        continue
      }
      visual.root.visible = true
      visual.root.position.set(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      )
      visual.root.hitArea = new Circle(0, 0, size / 2 + 6)
      visual.icon.width = size * 0.52
      visual.icon.height = size * 0.52
    }
    this.powerUpStateKey = ""
    this.syncPowerUps(v)
  }

  private syncPowerUps(v: GameView) {
    const key = v.powerUps
      .map(
        (power) =>
          `${power.id}:${Number(power.available)}:${Number(power.armed)}`,
      )
      .join("|")
    if (key === this.powerUpStateKey) return
    this.powerUpStateKey = key
    for (let index = 0; index < this.powerUpButtons.length; index++) {
      const visual = this.powerUpButtons[index]
      const status = v.powerUps[index]
      const rect = v.layout.hud.powerUpRects[index]
      if (!visual || !status || !rect) continue
      this.drawPowerUp(visual, status, rect.width)
    }
  }

  private drawPowerUp(
    visual: typeof this.powerUpButtons[number],
    status: PowerUpStatus,
    size: number,
  ) {
    const armed = status.available && status.armed
    visual.root.alpha = status.available ? 1 : 0.38
    visual.root.eventMode = status.available ? "static" : "none"
    visual.bg
      .clear()
      .circle(0, 0, size / 2)
      .fill({
        color: armed ? LEADERBOARD_PALETTE.purple : LEADERBOARD_PALETTE.border,
        alpha: 0.98,
      })
      .stroke({
        color: armed ? LEADERBOARD_PALETTE.white : LEADERBOARD_PALETTE.white,
        alpha: armed ? 0.95 : 0.8,
        width: armed ? 2 : 1.5,
      })
    visual.icon.tint = armed
      ? LEADERBOARD_PALETTE.white
      : LEADERBOARD_PALETTE.purple
  }

  private syncBoard(v: GameView, t: GameTextures, baseScale: number) {
    const token = startDevMeasure("render/board-sync")
    this.syncBoardMeasured(v, t, baseScale)
    endDevMeasure("render/board-sync", token)
  }

  private syncBoardMeasured(v: GameView, _t: GameTextures, baseScale: number) {
    const { board, layout } = v
    const rowShiftStarted = board.rowShiftVersion !== this.lastRowShiftVersion
    const motion = rowShiftStarted ? new Map<number, BoardShiftMotion>() : null
    this.boardSyncGeneration++
    const generation = this.boardSyncGeneration
    reconcilePersistentVisuals(
      (visit) => {
        for (let row = 0; row < board.rows.length; row++) {
          for (
            let col = 0;
            col < layout.rowCapacity(row, board.gridParity);
            col++
          ) {
            const color = board.cell(row, col)
            if (color === null) continue
            const id = board.id(row, col)
            if (id !== null) visit(id, color, row, col)
          }
        }
      },
      this.boardSprites,
      this.boardColors,
      this.boardSeen,
      generation,
      (color) => this.boardPool.take(COLORS[color]),
      (visual) => this.boardPool.put(visual),
      (visual, color) => visual.setColor(COLORS[color]),
      (cell, visual, existed) => {
        visual.setScale(baseScale)
        const x = layout.worldX(cell.row, cell.col, board.gridParity)
        const y = layout.worldY(cell.row)
        if (motion) {
          if (!existed) visual.position.set(x, y - layout.ROW_H)
          motion.set(cell.id, {
            sx: visual.x,
            sy: visual.y,
            tx: x,
            ty: y,
          })
        } else if (!existed) {
          visual.position.set(x, y)
        }
      },
    )
    if (motion) this.boardShiftMotion = motion
    this.lastBoardVersion = board.version
    this.lastRowShiftVersion = board.rowShiftVersion
  }

  private updateBoardMotion(v: GameView) {
    if (!this.boardShiftMotion) return
    const progress = Math.min(1, v.fx.boardShift?.t ?? 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    for (const [id, m] of this.boardShiftMotion) {
      const s = this.boardSprites.get(id)
      if (!s) continue
      s.position.set(m.sx + (m.tx - m.sx) * eased, m.sy + (m.ty - m.sy) * eased)
    }
    if (progress >= 1) {
      this.boardShiftMotion = null
    }
  }

  private syncPopups(v: GameView) {
    const popups = v.fx.popups
    while (this.popupTexts.length < popups.length) {
      const tx =
        this.popupFree.pop() ??
        new Text({
          text: "",
          style: popupStyle(false, "#ffffff"),
          anchor: { x: 0.5, y: 0.5 },
        })
      this.fxLayer.addChild(tx)
      this.popupTexts.push(tx)
      this.popupTextKeys.push("")
      this.popupBigKeys.push(false)
      this.popupColorKeys.push("")
    }
    while (this.popupTexts.length > popups.length) {
      const tx = this.popupTexts.pop()!
      this.popupTextKeys.pop()
      this.popupBigKeys.pop()
      this.popupColorKeys.pop()
      tx.visible = false
      this.popupFree.push(tx)
    }
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i]
      const tx = this.popupTexts[i]
      if (
        p.text !== this.popupTextKeys[i] ||
        p.big !== this.popupBigKeys[i] ||
        p.color !== this.popupColorKeys[i]
      ) {
        this.popupTextKeys[i] = p.text
        this.popupBigKeys[i] = p.big
        this.popupColorKeys[i] = p.color
        tx.text = p.text
        tx.style = popupStyle(p.big, p.color)
        tx.visible = true
      }
      tx.position.set(p.x, p.y)
      tx.alpha = p.alpha
    }
  }

  private syncShots(v: GameView, t: GameTextures, baseScale: number) {
    const shots = v.shots
    for (let i = 0; i < this.shotSprites.length; i++) {
      const sprite = this.shotSprites[i]
      const sh = shots[i]
      sprite.visible = !!sh
      if (sh) {
        sprite.setColor(COLORS[sh.c])
        sprite.position.set(sh.x, sh.y)
        sprite.setScale(baseScale)
      }
    }
    this.cannon.setAim(v.aimAngle)
    this.cannon.recoil(v.recoil)
    this.cannon.setMuzzle(v.recoil < -0.15, v.aimAngle)
    this.cannon.loadedBubble.visible = shots.length === 0
    this.cannon.loadedBubble.setColor(COLORS[v.cur])
    this.cannon.nextBubble.setColor(COLORS[v.nxt])
    this.lastShotC = shots[0]?.c ?? -1
    this.lastCur = v.cur
  }

  private syncTraj(v: GameView, t: GameTextures) {
    const traj = v.traj
    const visible = v.phase === "READY" ? traj : []
    this.trajectory.clear()
    if (visible.length) {
      this.trajectory.moveTo(v.layout.SHOOTER_X, v.layout.SHOOTER_Y)
      for (const point of visible) this.trajectory.lineTo(point.x, point.y)
      this.trajectory.stroke({ color: 0xffffff, alpha: 0.52, width: 2 })
    }
    const count = Math.max(0, visible.length - 1)
    while (this.dotSprites.length < count)
      this.dotSprites.push(this.dotPool.take(t.trajDot))
    while (this.dotSprites.length > count)
      this.dotPool.put(this.dotSprites.pop()!)
    for (let i = 0; i < count; i++) {
      const d = this.dotSprites[i]
      const p = visible[i]
      const tt = i / Math.max(1, visible.length - 1)
      d.position.set(p.x, p.y)
      d.alpha = 0.78 - tt * 0.5
      d.scale.set((4.1 - tt * 1.9) / TRAJ_R)
    }
    const impact = visible[visible.length - 1]
    this.impactSprite.visible = !!impact
    if (impact) {
      this.impactSprite.position.set(impact.x, impact.y)
      this.impactSprite.tint = COLORS[v.cur]
      const pulseScale = 1.18 + Math.sin(v.fx.pulse * 8) * 0.16
      this.impactSprite.scale.set(pulseScale)
      this.impactSprite.alpha = 0.86 + Math.sin(v.fx.pulse * 7) * 0.12
    }
  }

  private syncDanger(v: GameView, t: GameTextures) {
    const near = this.near(v)
    if (near !== this.lastNear) {
      this.lastNear = near
      this.rebuildDanger(v, t)
    }
    this.dangerLine.alpha = near ? 0.62 + Math.sin(v.fx.pulse * 6) * 0.18 : 0.42
  }
}
