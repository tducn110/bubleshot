import {
  COLORS,
  PTS_DROP,
  PTS_POP,
  FEVER_SHOTS,
  FEVER_SCORE_MULTIPLIER,
  MULTISHOT_SPREAD_RAD,
  SHOT_SPEED,
  shotCountForCombo,
  rndColor,
  stageParams,
} from "./config"
import { Board } from "./board"
import { Fx } from "./fx"
import { Layout } from "./layout"
import {
  CANONICAL_HEIGHT,
  CANONICAL_WIDTH,
  fitViewport,
  screenToGame,
} from "./viewport"
import { endDevMeasure, markDev, startDevMeasure } from "./perf"
import {
  traceTrajectory,
  type TrajectoryBubble,
  type TrajectorySegment,
} from "./trajectory"
import { gameAudio } from "./audio"
import { winkGame, type WinkRound } from "../integrations/wink/client"
import type {
  AnimationCommand,
  AnimationCompletion,
  AnimationKind,
  Phase,
  Point,
  PowerUpId,
  PowerUpStatus,
  ResolveResult,
  Shot,
  ShotMode,
  VisualBubble,
  VolleyPlacement,
} from "./types"

const CELL_STRIDE = 9
const CELL_CAPACITY = 64 * CELL_STRIDE
const POWER_UP_IDS = ["rows3", "bomb", "rainbow", "waypoints"] as const

export class BubbleShooterEngine {
  readonly layout = new Layout()
  readonly board = new Board(this.layout)
  readonly fx = new Fx()

  private currentRound: WinkRound | null = null

  phase: Phase = "LOADING"
  actionId = 0
  cur = 0
  nxt = 0
  score = 0
  combo = 0
  moves = 0
  stage = 1
  starsEarned = 0
  rowRemaining = 0
  rowEvery = 4
  shots: Shot[] = []
  feverProgress = 0
  feverActive = false
  feverShots = 0
  traj: Point[] = []
  private armedPowerUp: PowerUpId | null = null
  private readonly powerUpStates: PowerUpStatus[] = POWER_UP_IDS.map((id) => ({
    id,
    available: true,
    armed: false,
  }))

  sc = 1
  ox = 0
  oy = 0

  private cv: HTMLCanvasElement
  private plx = this.layout.SHOOTER_X
  private ply = this.layout.SHOOTER_Y - 100
  private pp: Phase = "LOADING"
  private phaseTimer = 0
  private lastWatchedPhase: Phase = "LOADING"
  private colorsInPlay = 5
  private uiEat = false
  private recoilT = 0
  private activated = false
  private inputAttached = false
  private activeBoardVersion = 0
  private readonly pendingAnimations = new Map<number, AnimationKind>()
  private readonly commandRemaining = new Map<number, number>()
  private readonly completionQueue: AnimationCompletion[] = []
  private readonly headlessAnimations: boolean
  private viewport = fitViewport(1, 1)
  private measuredW = 0
  private measuredH = 0
  private readonly shotFree: Shot[] = [
    {
      actionId: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      c: 0,
      settled: false,
      row: -1,
      col: -1,
      power: null,
    },
    {
      actionId: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      c: 0,
      settled: false,
      row: -1,
      col: -1,
      power: null,
    },
    {
      actionId: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      c: 0,
      settled: false,
      row: -1,
      col: -1,
      power: null,
    },
    {
      actionId: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      c: 0,
      settled: false,
      row: -1,
      col: -1,
      power: null,
    },
  ]
  private readonly trajFree: Point[] = Array.from({ length: 40 }, () => ({
    x: 0,
    y: 0,
  }))
  private readonly trajectoryBubbles: TrajectoryBubble[] = Array.from(
    { length: CELL_CAPACITY },
    () => ({ row: -1, col: -1, x: 0, y: 0 }),
  )
  private trajectoryBubbleCount = 0
  private readonly snapSeen = new Uint32Array(CELL_CAPACITY)
  private readonly snapReserved = new Uint32Array(CELL_CAPACITY)
  private snapGeneration = 0
  private reservedGeneration = 0
  private snapBestCell = -1
  private snapBestDistance = Number.POSITIVE_INFINITY

  private _pm: (e: PointerEvent) => void
  private _pd: (e: PointerEvent) => void
  private _pu: (e: PointerEvent) => void
  private _pc: (e: PointerEvent) => void
  private _pl: (e: PointerEvent) => void
  private _kd: (e: KeyboardEvent) => void
  private _rs: () => void
  private isAiming = false
  /** Pointer that started the active aim gesture, if any. */
  private aimPointerId: number | null = null
  private lastPointerType = "mouse"

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv
    this.headlessAnimations =
      !("isConnected" in cv) || (!cv.isConnected && cv.clientWidth === 0)
    this._pm = (e) => this.onMove(e)
    this._pd = (e) => this.onDown(e)
    this._pu = (e) => this.onUp(e)
    this._pc = (e) => this.onCancel(e)
    this._pl = (e) => this.onLeave(e)
    this._kd = (e) => this.onKey(e)
    this._rs = () => this.computeTransform()
    this.computeTransform()
    this.plx = this.layout.SHOOTER_X
    this.ply = this.layout.SHOOTER_Y - 100
    this.init()
    if (this.headlessAnimations) this.activate()
  }

  destroy() {
    if (this.inputAttached) {
      this.cv.removeEventListener("pointermove", this._pm)
      this.cv.removeEventListener("pointerdown", this._pd)
      this.cv.removeEventListener("pointerleave", this._pl)
      window.removeEventListener("pointerup", this._pu)
      window.removeEventListener("pointercancel", this._pc)
      window.removeEventListener("keydown", this._kd)
      window.removeEventListener("resize", this._rs)
      this.inputAttached = false
    }
  }

  /** Enables native input only after the renderer has a stable first frame. */
  activate() {
    if (!this.inputAttached) {
      this.cv.addEventListener("pointermove", this._pm)
      this.cv.addEventListener("pointerdown", this._pd, { passive: false })
      this.cv.addEventListener("pointerleave", this._pl)
      window.addEventListener("pointerup", this._pu)
      window.addEventListener("pointercancel", this._pc)
      window.addEventListener("keydown", this._kd)
      window.addEventListener("resize", this._rs)
      this.inputAttached = true
    }
    this.activated = true
    if (this.phase === "LOADING") {
      this.phase = "READY"
      this.calcTraj()
    }
  }

  /**
   * Marks the next native pointerdown as consumed by Pixi UI (pause pill).
   * Pixi's canvas listener is registered before this engine's, so the pill's
   * federated pointerdown handler runs first and sets this flag.
   */
  consumeNextDown() {
    this.uiEat = true
  }

  /** Per-frame logic step; driven by the renderer's ticker. */
  tick(dt: number) {
    this.computeTransform()
    this.update(dt)
  }

  // ─── Layout / input mapping ────────────────────────────────────────────────

  private computeTransform() {
    // A detached canvas has zero client dimensions in unit tests and during
    // the tiny async gap before it is attached. Keep the canonical fallback
    // for that non-rendering state; live canvases always use measured pixels.
    const w = this.cv.clientWidth || CANONICAL_WIDTH
    const h = this.cv.clientHeight || CANONICAL_HEIGHT
    if (w === this.measuredW && h === this.measuredH) return
    this.measuredW = w
    this.measuredH = h
    this.layout.configure(w, h)
    this.viewport = fitViewport(w, h)
    this.sc = this.viewport.scale
    this.ox = this.viewport.offsetX
    this.oy = this.viewport.offsetY
  }

  private sToL(sx: number, sy: number) {
    const rect = this.cv.getBoundingClientRect()
    return screenToGame(this.viewport, sx, sy, rect)
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  // Aiming and shooting only. UI hit testing lives in the HUD/overlay layers;
  // this engine never knows pixel coordinates of any button.

  private onMove(e: PointerEvent) {
    this.lastPointerType = e.pointerType
    const l = this.sToL(e.clientX, e.clientY)
    this.plx = l.x
    this.ply = l.y
    if (this.canShoot) this.calcTraj()
  }

  private onDown(e: PointerEvent) {
    e.preventDefault()
    gameAudio.unlock()
    if (this.uiEat) {
      this.uiEat = false
      return
    }
    // A second finger must not replace the live aim gesture. In particular,
    // its pointerup must never release the first finger's shot.
    if (this.aimPointerId !== null) return
    this.lastPointerType = e.pointerType
    try {
      if (typeof this.cv.setPointerCapture === "function") {
        this.cv.setPointerCapture(e.pointerId)
      }
    } catch {}
    const l = this.sToL(e.clientX, e.clientY)
    this.plx = l.x
    this.ply = l.y
    if (this.canShoot) {
      this.aimPointerId = e.pointerId
      this.isAiming = true
      this.calcTraj()
    }
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId !== this.aimPointerId) return
    this.lastPointerType = e.pointerType
    try {
      if (typeof this.cv.releasePointerCapture === "function") {
        this.cv.releasePointerCapture(e.pointerId)
      }
    } catch {}
    if (!this.isAiming) return
    this.aimPointerId = null
    this.isAiming = false
    const l = this.sToL(e.clientX, e.clientY)
    this.plx = l.x
    this.ply = l.y
    if (this.canShoot) {
      this.doShoot()
    }
    this.clearTrajectory()
  }

  private onCancel(e: PointerEvent) {
    if (e.pointerId !== this.aimPointerId) return
    this.lastPointerType = e.pointerType
    try {
      if (typeof this.cv.releasePointerCapture === "function") {
        this.cv.releasePointerCapture(e.pointerId)
      }
    } catch {}
    this.aimPointerId = null
    this.isAiming = false
    this.clearTrajectory()
  }

  private onLeave(e: PointerEvent) {
    this.lastPointerType = e.pointerType
    if (e.pointerType === "mouse") {
      this.clearTrajectory()
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "p" || e.key === "P") this.togglePause()
  }

  pause() {
    if (this.phase === "PAUSED") return
    if (
      [
        "READY",
        "VOLLEY_FLYING",
        "RESOLVE_VOLLEY",
        "POPPING",
        "DROPPING",
        "BOARD_DESCENDING",
      ].includes(this.phase)
    ) {
      this.pp = this.phase
      this.phase = "PAUSED"
    }
  }

  togglePause() {
    if (this.phase === "PAUSED") {
      this.resume()
      return
    }
    this.pause()
  }

  resume() {
    this.phase = this.pp
    if (this.phase === "READY") this.calcTraj()
  }

  // ─── Public actions (driven by overlay buttons) ────────────────────────────

  retry() {
    if (this.currentRound) {
      winkGame.completeRound(this.currentRound)
      this.currentRound = null
    }
    this.init()
  }

  nextStage() {
    if (this.currentRound) {
      winkGame.completeRound(this.currentRound)
      this.currentRound = null
    }
    this.stage++
    this.init()
  }

  menu() {
    if (this.currentRound) {
      winkGame.completeRound(this.currentRound)
      this.currentRound = null
    }
    this.stage = 1
    this.init()
  }

  /** Arms one HUD power-up for the next semantic shot without touching board state. */
  activatePowerUp(id: PowerUpId): boolean {
    if (!this.canShoot) return false
    const state = this.powerUpStates.find((item) => item.id === id)
    if (!state?.available) return false

    this.armedPowerUp = this.armedPowerUp === id ? null : id
    for (const item of this.powerUpStates)
      item.armed = item.id === this.armedPowerUp
    if (this.armedPowerUp) {
      gameAudio.playPowerUp()
    }
    this.calcTraj()
    return true
  }

  /** Swaps the current shooter bubble with the next upcoming bubble. */
  swapCurrentAndNext(): boolean {
    if (!this.canShoot) return false
    const temp = this.cur
    this.cur = this.nxt
    this.nxt = temp
    gameAudio.playSwap()
    this.calcTraj()
    return true
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  private init() {
    this.actionId = (this.actionId + 1) >>> 0 || 1
    const sp = stageParams(this.stage)
    this.colorsInPlay = sp.colors
    this.rowEvery = sp.rowEvery
    this.board.fillInitial(sp.rows, sp.colors)
    this.fx.clear()
    this.score = 0
    this.combo = 0
    this.moves = sp.moves
    this.starsEarned = 0
    this.rowRemaining = sp.rowEvery
    this.phase = this.activated ? "READY" : "LOADING"
    while (this.shots.length) this.shotFree.push(this.shots.pop()!)
    this.feverProgress = 0
    this.feverActive = false
    this.feverShots = 0
    this.armedPowerUp = null
    for (const power of this.powerUpStates) {
      power.available = true
      power.armed = false
    }
    this.pendingAnimations.clear()
    this.commandRemaining.clear()
    this.completionQueue.length = 0
    this.cur = this.pickNextColor()
    this.nxt = this.pickNextColor()
    if (this.phase === "READY") this.calcTraj()
  }

  private pickNextColor(): number {
    const active = this.board.getActiveColors()
    if (active.length > 0) {
      return active[Math.floor(Math.random() * active.length)]
    }
    return rndColor(this.colorsInPlay)
  }

  private clearTrajectory() {
    while (this.traj.length) this.trajFree.push(this.traj.pop()!)
  }

  private addTrajectoryPoint(x: number, y: number) {
    const point = this.trajFree.pop()
    if (!point) return
    point.x = x
    point.y = y
    this.traj.push(point)
  }

  get shotMode(): ShotMode {
    return shotCountForCombo(this.combo, this.feverActive)
  }
  get powerUps(): readonly PowerUpStatus[] {
    return this.powerUpStates
  }
  get canShoot() {
    return (
      this.activated &&
      this.phase === "READY" &&
      this.pendingAnimations.size === 0
    )
  }
  get blockingAnimations() {
    return this.pendingAnimations.size
  }
  get aimAngle(): number {
    return this.aimAngleFor(this.plx, this.ply)
  }
  get recoil(): number {
    return this.recoilT > 0
      ? -Math.sin((1 - Math.min(1, this.recoilT / 0.12)) * Math.PI) * 9
      : 0
  }

  // ─── Aim / shoot ───────────────────────────────────────────────────────────

  private aimAngleFor(pointerX: number, pointerY: number) {
    const { SHOOTER_X, SHOOTER_Y } = this.layout
    const dx = pointerX - SHOOTER_X
    const dy = pointerY - SHOOTER_Y
    if (Math.hypot(dx, dy) < 35) return 0
    if (dy >= -5) return dx >= 0 ? Math.PI * 0.78 : -Math.PI * 0.78
    const a = Math.atan2(dx, -dy)
    return Math.max(-Math.PI * 0.82, Math.min(Math.PI * 0.82, a))
  }

  private doShoot() {
    if (!this.canShoot) return
    if (this.ply > this.layout.LH) return
    if (!this.currentRound) {
      this.currentRound = winkGame.startRound()
    }
    const selectedPower = this.armedPowerUp
    const count =
      selectedPower === "rows3"
        ? Math.max(3, this.shotMode) as ShotMode
        : this.shotMode
    const projectilePower =
      selectedPower === "bomb" || selectedPower === "rainbow"
        ? selectedPower
        : null
    const center = this.aimAngle
    this.actionId = (this.actionId + 1) >>> 0 || 1
    this.activeBoardVersion = this.board.version
    this.reservedGeneration = this.actionId
    while (this.shots.length) this.shotFree.push(this.shots.pop()!)
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * MULTISHOT_SPREAD_RAD
      const a = center + offset
      const shot = this.shotFree.pop()!
      shot.actionId = this.actionId
      shot.x = this.layout.SHOOTER_X
      shot.y = this.layout.SHOOTER_Y
      shot.vx = Math.sin(a) * SHOT_SPEED
      shot.vy = -Math.cos(a) * SHOT_SPEED
      shot.c = this.cur
      shot.settled = false
      shot.row = -1
      shot.col = -1
      shot.power =
        projectilePower !== null && i === Math.floor((count - 1) / 2)
          ? projectilePower
          : null
      this.shots.push(shot)
    }
    if (selectedPower) {
      const state = this.powerUpStates.find((item) => item.id === selectedPower)
      if (state) {
        state.available = false
        state.armed = false
      }
      this.armedPowerUp = null
    }
    this.cur = this.nxt
    this.nxt = this.pickNextColor()
    this.moves = Math.max(0, this.moves - 1)
    this.recoilT = 0.12
    this.phase = "VOLLEY_FLYING"
    this.clearTrajectory()
    gameAudio.playShoot()
  }

  /**
   * Called exactly once per shot, after the shot fully resolves (hit or miss).
   * Pressure rows must spawn AFTER resolution so the trajectory preview the
   * player just saw still matches the board the projectile flew through.
   */
  private finishShot(): "WIN" | "PRESSURE" | "CONTINUE" {
    this.rowRemaining--
    if (this.feverActive) {
      this.feverShots--
      if (this.feverShots <= 0) this.feverActive = false
    }
    // A completed board wins before the completed-shot pressure counter can
    // prepend a new row. This keeps terminal ordering deterministic.
    if (this.board.isClear()) {
      this.checkEnd()
      return "WIN"
    }
    if (this.rowRemaining <= 0) {
      this.rowRemaining = this.rowEvery
      const token = startDevMeasure("pressure/model-shift")
      this.board.spawnTopRow(this.colorsInPlay)
      endDevMeasure("pressure/model-shift", token)
      this.fx.startBoardShift()
      markDev("pressure/start")
      this.fx.shake(0.18)
      this.fx.spawnPopup(
        this.layout.BOARD_CENTER_X,
        this.layout.BOARD_TOP + 30,
        "NEW ROW!",
        false,
        "#FF4D6D",
      )
      return "PRESSURE"
    }
    return "CONTINUE"
  }

  private finishResolvedShot() {
    if (this.pendingAnimations.size) return
    const outcome = this.finishShot()
    if (outcome === "WIN") {
      this.clearTrajectory()
      return
    }
    if (outcome === "PRESSURE") {
      this.clearTrajectory()
      this.phase = "BOARD_DESCENDING"
      return
    }
    const resolvingPhase = this.phase
    this.checkEnd()
    if (this.phase === resolvingPhase) {
      this.phase = "READY"
      this.calcTraj()
    }
  }

  // ─── Trajectory ──────────────────────────────────────────────────────────

  private rebuildTrajectoryBubbles() {
    let count = 0
    for (let row = 0; row < this.board.rows.length; row++) {
      const rowCapacity = this.layout.rowCapacity(row, this.board.gridParity)
      for (let col = 0; col < rowCapacity; col++) {
        if (this.board.cell(row, col) === null) continue
        const bubble = this.trajectoryBubbles[count]
        if (!bubble) break
        bubble.row = row
        bubble.col = col
        bubble.x = this.layout.worldX(row, col, this.board.gridParity)
        bubble.y = this.layout.worldY(row)
        count++
      }
    }
    this.trajectoryBubbleCount = count
  }

  private addTrajectoryDots(segment: TrajectorySegment, spacing: number) {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const length = Math.hypot(dx, dy)
    if (length <= 0) return
    let distance = spacing
    while (distance < length && this.traj.length < 38) {
      const ratio = distance / length
      this.addTrajectoryPoint(
        segment.from.x + dx * ratio,
        segment.from.y + dy * ratio,
      )
      distance += spacing
    }
  }

  private calcTraj() {
    if (!this.canShoot) {
      this.clearTrajectory()
      return
    }
    const show = this.isAiming || this.lastPointerType === "mouse"
    if (!show) {
      this.clearTrajectory()
      return
    }
    const { WALL_L, WALL_R, BOARD_TOP, R, SHOOTER_X, SHOOTER_Y } = this.layout
    this.clearTrajectory()
    this.rebuildTrajectoryBubbles()
    const angle = this.aimAngle
    const result = traceTrajectory({
      origin: { x: SHOOTER_X, y: SHOOTER_Y },
      velocity: {
        x: Math.sin(angle) * SHOT_SPEED,
        y: -Math.cos(angle) * SHOT_SPEED,
      },
      maxDistance: Math.max(this.layout.LH * 10, 3_000),
      wallLeft: WALL_L + R,
      wallRight: WALL_R - R,
      ceilingY: BOARD_TOP + R,
      collisionRadius: R * 1.95,
      maxBounces: this.armedPowerUp === "waypoints" ? 4 : 2,
      bubbles: this.trajectoryBubbles,
      bubbleCount: this.trajectoryBubbleCount,
      onSegment: (segment) => this.addTrajectoryDots(segment, R * 1.6),
    })
    if (result.terminal.kind !== "limit" && this.traj.length < 38)
      this.addTrajectoryPoint(result.x, result.y)
  }

  // ─── Ball flight ─────────────────────────────────────────────────────────

  private updateShooting(dt: number) {
    if (!this.shots.length) return
    const { WALL_L, WALL_R, BOARD_TOP, R } = this.layout
    const sub = 4
    const sdt = dt / sub
    this.rebuildTrajectoryBubbles()
    let unsettled = 0
    for (let shotIndex = 0; shotIndex < this.shots.length; shotIndex++) {
      const s = this.shots[shotIndex]
      if (s.settled) continue
      let placed = false
      for (let i = 0; i < sub && !placed; i++) {
        const result = traceTrajectory({
          origin: { x: s.x, y: s.y },
          velocity: { x: s.vx, y: s.vy },
          maxDistance: Math.hypot(s.vx, s.vy) * sdt,
          wallLeft: WALL_L + R,
          wallRight: WALL_R - R,
          ceilingY: BOARD_TOP + R,
          collisionRadius: R * 1.95,
          maxBounces: 4,
          bubbles: this.trajectoryBubbles,
          bubbleCount: this.trajectoryBubbleCount,
        })
        s.x = result.x
        s.y = result.y
        s.vx = result.vx
        s.vy = result.vy
        if (result.lastWallX !== null && result.lastWallY !== null) {
          this.fx.spawnWallHit(result.lastWallX, result.lastWallY, COLORS[s.c])
          gameAudio.playBounce()
        }
        this.fx.addTrail(s.x, s.y, COLORS[s.c])
        let snapCell = -1
        if (result.terminal.kind === "ceiling") {
          snapCell = this.findSnapCell(s.x, s.y, -1, -1)
          if (snapCell < 0) {
            // A failed snap is a resolution fallback, not a loss condition.
            // Complete this turn without mutating the board so the engine
            // cannot remain in VOLLEY_FLYING forever. Danger is evaluated
            // separately by checkEnd() after the turn.
            this.abortVolleyWithoutPlacement()
            return
          }
        } else if (result.terminal.kind === "bubble") {
          if (s.power === "rainbow")
            s.c = this.bestRainbowColor(
              result.terminal.row,
              result.terminal.col,
              s.c,
            )
          snapCell = this.findSnapCell(
            s.x,
            s.y,
            result.terminal.row,
            result.terminal.col,
          )
        }
        if (snapCell >= 0) {
          const snapRow = (snapCell / CELL_STRIDE) | 0
          const snapCol = snapCell - snapRow * CELL_STRIDE
          this.snapReserved[snapCell] = this.reservedGeneration
          s.row = snapRow
          s.col = snapCol
          s.x = this.layout.worldX(snapRow, snapCol, this.board.gridParity)
          s.y = this.layout.worldY(snapRow)
          s.vx = 0
          s.vy = 0
          s.settled = true
          this.registerCommand(
            this.fx.spawnImpact(this.actionId, s.x, s.y, COLORS[s.c]),
            false,
          )
          markDev("shot-impact")
          placed = true
        }
      }
      if (!placed) unsettled++
    }
    if (unsettled === 0) {
      this.phase = "RESOLVE_VOLLEY"
      this.resolveActiveVolley()
    }
  }

  /**
   * A rainbow projectile resolves to the strongest adjacent colour group at
   * its actual impact point. This keeps the choice inside the authoritative
   * board model instead of teaching the renderer a second matching rule.
   */
  private bestRainbowColor(row: number, col: number, fallback: number) {
    let bestColor = fallback
    let bestCount = -1
    const candidates = [
      { row, col },
      ...this.layout.nbrs(row, col, this.board.gridParity),
    ]
    for (const candidate of candidates) {
      const color = this.board.cell(candidate.row, candidate.col)
      if (color === null) continue
      const count = this.board.scanColor(candidate.row, candidate.col, color)
      if (count > bestCount || (count === bestCount && color === fallback)) {
        bestColor = color
        bestCount = count
      }
    }
    return bestColor
  }

  private considerSnap(row: number, col: number, bx: number, by: number) {
    if (
      row < 0 ||
      row >= this.layout.MAX_ROWS ||
      !this.layout.cellValid(row, col, this.board.gridParity)
    )
      return
    const cell = row * CELL_STRIDE + col
    if (
      this.snapSeen[cell] === this.snapGeneration ||
      this.snapReserved[cell] === this.reservedGeneration
    )
      return
    this.snapSeen[cell] = this.snapGeneration
    if (this.board.cell(row, col) !== null) return
    const dx = bx - this.layout.worldX(row, col, this.board.gridParity)
    const dy = by - this.layout.worldY(row)
    const distance = dx * dx + dy * dy
    if (distance < this.snapBestDistance) {
      this.snapBestDistance = distance
      this.snapBestCell = cell
    }
  }

  private considerSnapNeighbors(
    row: number,
    col: number,
    bx: number,
    by: number,
  ) {
    const odd = this.layout.effectiveParity(row, this.board.gridParity) === 1
    this.considerSnap(row, col - 1, bx, by)
    this.considerSnap(row, col + 1, bx, by)
    this.considerSnap(row - 1, odd ? col : col - 1, bx, by)
    this.considerSnap(row - 1, odd ? col + 1 : col, bx, by)
    this.considerSnap(row + 1, odd ? col : col - 1, bx, by)
    this.considerSnap(row + 1, odd ? col + 1 : col, bx, by)
  }

  private estimateCol(row: number, x: number) {
    const offset =
      this.layout.effectiveParity(row, this.board.gridParity) === 1
        ? this.layout.R
        : 0
    return Math.max(
      0,
      Math.min(
        this.layout.rowCapacity(row, this.board.gridParity) - 1,
        Math.round(
          (x - this.layout.BOARD_LEFT - this.layout.R - offset) /
            (this.layout.R * 2),
        ),
      ),
    )
  }

  private findSnapCell(bx: number, by: number, hitRow: number, hitCol: number) {
    this.snapGeneration = (this.snapGeneration + 1) >>> 0 || 1
    this.snapBestCell = -1
    this.snapBestDistance = Number.POSITIVE_INFINITY
    if (hitRow >= 0) this.considerSnapNeighbors(hitRow, hitCol, bx, by)

    const estimatedRow = Math.max(
      0,
      Math.round(
        (by - this.layout.BOARD_TOP - this.layout.R) / this.layout.ROW_H,
      ),
    )
    const estimatedCol = this.estimateCol(estimatedRow, bx)
    this.considerSnap(estimatedRow, estimatedCol, bx, by)
    this.considerSnapNeighbors(estimatedRow, estimatedCol, bx, by)
    if (estimatedRow > 0) {
      const aboveRow = estimatedRow - 1
      this.considerSnapNeighbors(
        aboveRow,
        this.estimateCol(aboveRow, bx),
        bx,
        by,
      )
    }
    return this.snapBestCell
  }

  // ─── Atomic volley resolve / presentation commands ───────────────────────

  private registerCommand(command: AnimationCommand, blocking: boolean) {
    this.commandRemaining.set(command.id, command.delay + command.duration)
    if (blocking) this.pendingAnimations.set(command.id, command.kind)
  }

  private toVisualBubble(
    bubble: ResolveResult["placed"][number],
  ): VisualBubble {
    return {
      id: bubble.id,
      c: bubble.c,
      x: this.layout.worldX(bubble.row, bubble.col, this.board.gridParity),
      y: this.layout.worldY(bubble.row),
    }
  }

  private visualCenter(members: readonly VisualBubble[]) {
    let x = 0
    let y = 0
    for (const member of members) {
      x += member.x
      y += member.y
    }
    const n = Math.max(1, members.length)
    return { x: x / n, y: y / n }
  }

  private resolveActiveVolley() {
    const placements: VolleyPlacement[] = this.shots.map((shot) => ({
      row: shot.row,
      col: shot.col,
      c: shot.c,
    }))
    const bombs = this.shots
      .filter((shot) => shot.power === "bomb")
      .map((shot) => ({ row: shot.row, col: shot.col }))
    const token = startDevMeasure("resolve/atomic-volley-commit")
    const result = this.board.resolveVolley(
      this.actionId,
      this.activeBoardVersion,
      placements,
      { bombs },
    )
    endDevMeasure("resolve/atomic-volley-commit", token)
    while (this.shots.length) this.shotFree.push(this.shots.pop()!)

    if (result.stale || result.actionId !== this.actionId) {
      if (import.meta.env.DEV)
        console.error("Volley commit rejected: stale board revision", result)
      this.recoverFromStaleVolley()
      return
    }

    const removed = [...result.matched, ...result.detonated]
    const removedIds = new Set(removed.map((bubble) => bubble.id))
    for (const bubble of result.placed) {
      if (removedIds.has(bubble.id)) continue
      this.registerCommand(
        this.fx.queueLanding(this.actionId, this.toVisualBubble(bubble)),
        true,
      )
    }

    if (removed.length) {
      if (result.matched.length) {
        this.combo++
        this.feverProgress = Math.min(
          1,
          this.feverProgress + 0.18 + Math.min(this.combo, 10) * 0.012,
        )
        if (this.feverProgress >= 1) {
          this.feverActive = true
          this.feverShots = FEVER_SHOTS
          this.feverProgress = 0
          gameAudio.playPowerUp()
          this.fx.spawnPopup(
            this.layout.SHOOTER_X,
            this.layout.LH * 0.32,
            "FEVER!",
            true,
            "#FFDE38",
          )
        }
      } else {
        this.combo = 0
      }

      const removedVisuals = removed.map((bubble) =>
        this.toVisualBubble(bubble),
      )
      const center = this.visualCenter(removedVisuals)
      this.registerCommand(
        this.fx.queueMatch(this.actionId, removedVisuals, center.x, center.y),
        true,
      )

      const pts =
        removed.length *
        PTS_POP *
        (this.feverActive ? FEVER_SCORE_MULTIPLIER : 1)
      this.score += pts
      const label =
        result.matched.length >= 8
          ? "AMAZING!"
          : result.matched.length >= 5
            ? "AWESOME!"
            : result.detonated.length
              ? "BOOM!"
              : ""
      if (label)
        this.fx.spawnPopup(
          this.layout.SHOOTER_X,
          this.layout.LH * 0.42,
          label,
          true,
          result.detonated.length ? "#FF9418" : "#FFE04B",
        )
      this.fx.spawnPopup(center.x, center.y - 24, `+${pts}`, false, "#FFE04B")
      for (const bubble of removedVisuals)
        this.fx.spawnPop(bubble.x, bubble.y, COLORS[bubble.c])
      if (this.combo > 1) this.fx.markCombo(this.combo, center.x, center.y - 70)
    } else {
      this.combo = 0
    }

    let floatingCount = 0
    for (const group of result.floatingGroups) {
      const members = group.members.map((bubble) => this.toVisualBubble(bubble))
      floatingCount += members.length
      const center = this.visualCenter(members)
      let minLocalY = 0
      for (const member of members)
        minLocalY = Math.min(minLocalY, member.y - center.y)
      this.registerCommand(
        this.fx.queueDrop(
          this.actionId,
          group.groupId,
          members,
          center.x,
          center.y,
          this.layout.LH + 100 - minLocalY,
          (group.groupId & 1 ? -1 : 1) * 5,
          removed.length ? 0.16 : 0,
        ),
        true,
      )
    }
    if (floatingCount) {
      const pts = floatingCount * PTS_DROP
      this.score += pts
      if (floatingCount >= 4)
        this.fx.spawnPopup(
          this.layout.SHOOTER_X,
          this.layout.DANGER_Y - 60,
          `+${pts} DROP!`,
          false,
          "#C77DFF",
        )
      this.fx.shake(0.32)
      markDev("drop-animation-ready")
    }

    this.updateResolutionPhase()
  }

  notifyAnimationComplete(
    commandId: number,
    actionId: number,
    kind: AnimationKind,
  ) {
    this.completionQueue.push({ commandId, actionId, kind })
  }

  private drainAnimationCompletions() {
    let blockingChanged = false
    while (this.completionQueue.length) {
      const completion = this.completionQueue.shift()!
      if (completion.actionId !== this.actionId) continue
      this.fx.releaseCommand(completion.commandId)
      this.commandRemaining.delete(completion.commandId)
      if (this.pendingAnimations.delete(completion.commandId))
        blockingChanged = true
    }
    if (blockingChanged) this.updateResolutionPhase()
  }

  private stepHeadlessAnimations(dt: number) {
    for (const [commandId, remaining] of this.commandRemaining) {
      if (!Number.isFinite(remaining)) continue
      const next = remaining - dt
      if (next > 0) {
        this.commandRemaining.set(commandId, next)
        continue
      }
      const command = this.fx.commands.find((item) => item.id === commandId)
      this.commandRemaining.set(commandId, Number.POSITIVE_INFINITY)
      if (command)
        this.notifyAnimationComplete(command.id, command.actionId, command.kind)
    }
  }

  private updateResolutionPhase() {
    let hasMatch = false
    let hasDrop = false
    let hasLanding = false
    for (const kind of this.pendingAnimations.values()) {
      if (kind === "match") hasMatch = true
      else if (kind === "drop") hasDrop = true
      else if (kind === "landing") hasLanding = true
    }
    if (hasMatch) this.phase = "POPPING"
    else if (hasDrop) this.phase = "DROPPING"
    else if (hasLanding) this.phase = "RESOLVE_VOLLEY"
    else if (
      this.phase === "RESOLVE_VOLLEY" ||
      this.phase === "POPPING" ||
      this.phase === "DROPPING"
    )
      this.finishResolvedShot()
  }

  private abortVolleyWithoutPlacement() {
    while (this.shots.length) this.shotFree.push(this.shots.pop()!)
    this.clearTrajectory()
    this.phase = "RESOLVE_VOLLEY"
    this.finishResolvedShot()
  }

  private recoverFromStaleVolley() {
    while (this.shots.length) this.shotFree.push(this.shots.pop()!)
    this.clearTrajectory()
    this.pendingAnimations.clear()
    this.commandRemaining.clear()
    this.phase = "READY"
    this.checkEnd()
    if (this.phase === "READY") this.calcTraj()
  }

  private finishBoardDescend() {
    markDev("pressure/animation-complete")
    this.fx.boardShift = null
    this.checkEnd()
    if (this.phase === "BOARD_DESCENDING") {
      this.phase = "READY"
      this.calcTraj()
    }
  }

  private checkEnd() {
    const { DANGER_Y, R } = this.layout
    if (this.board.isClear()) {
      this.starsEarned = this.moves >= 15 ? 3 : this.moves >= 8 ? 2 : 1
      this.phase = "WIN"
      gameAudio.playWin()
      if (this.currentRound) {
        winkGame.completeRound(this.currentRound)
        winkGame.submitFinalScore({ score: this.score }).catch(() => {})
        this.currentRound = null
      }
      this.fx.shake(0.7)
      return
    }
    for (let r = 0; r < this.board.rows.length; r++) {
      for (
        let col = 0;
        col < this.layout.rowCapacity(r, this.board.gridParity);
        col++
      ) {
        if (this.board.cell(r, col) !== null) {
          const { y } = this.layout.gToW(r, col, this.board.gridParity)
          if (y + R >= DANGER_Y) {
            this.phase = "LOSE"
            gameAudio.playLose()
            if (this.currentRound) {
              winkGame.completeRound(this.currentRound)
              winkGame.submitFinalScore({ score: this.score }).catch(() => {})
              this.currentRound = null
            }
            return
          }
        }
      }
    }
  }

  // ─── Main loop ───────────────────────────────────────────────────────────

  private update(dt: number) {
    // Pause freezes the gameplay clock AND gameplay FX; overlay UI is static.
    if (this.phase !== "PAUSED") {
      if (this.phase === this.lastWatchedPhase) {
        this.phaseTimer += dt
        if (
          this.phaseTimer > 2.5 &&
          (this.phase === "VOLLEY_FLYING" ||
            this.phase === "RESOLVE_VOLLEY" ||
            this.phase === "POPPING" ||
            this.phase === "DROPPING")
        ) {
          this.recoverFromStaleVolley()
          this.phaseTimer = 0
        }
      } else {
        this.lastWatchedPhase = this.phase
        this.phaseTimer = 0
      }

      this.drainAnimationCompletions()
      this.recoilT = Math.max(0, this.recoilT - dt)
      this.fx.step(dt)
      if (this.headlessAnimations) {
        this.stepHeadlessAnimations(dt)
        this.drainAnimationCompletions()
      }
      if (this.phase === "VOLLEY_FLYING") this.updateShooting(dt)
      else if (
        this.phase === "BOARD_DESCENDING" &&
        (this.fx.boardShift?.t ?? 1) >= 1
      )
        this.finishBoardDescend()
    }
  }
}
