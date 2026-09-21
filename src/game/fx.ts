import type {
  AnimationCommand,
  DropAnimationCommand,
  LandingAnimationCommand,
  MatchAnimationCommand,
  Particle,
  Popup,
  Trail,
  VisualBubble,
} from "./types"

const PARTICLE_CAPACITY = 192
const TRAIL_CAPACITY = 28
const POPUP_CAPACITY = 12

export interface BoardShift {
  t: number
  duration: number
}

function swapRemove<T>(active: T[], index: number): T {
  const removed = active[index]
  const last = active.pop()!
  if (index < active.length) active[index] = last
  return removed
}

export class Fx {
  readonly commands: AnimationCommand[] = []
  readonly parts: Particle[] = []
  readonly trails: Trail[] = []
  readonly popups: Popup[] = []
  private readonly partFree: Particle[] = []
  private readonly trailFree: Trail[] = []
  private readonly popupFree: Popup[] = []
  private readonly boardShiftState: BoardShift = { t: 0, duration: 0.22 }
  private nextCommandId = 1
  commandEpoch = 0

  readonly comboA = { v: 0, alpha: 0, scale: 1, x: 0, y: 0 }
  boardShift: BoardShift | null = null
  shakeT = 0
  csx = 0
  csy = 0
  pulse = 0

  constructor() {
    for (let i = 0; i < PARTICLE_CAPACITY; i++)
      this.partFree.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: "#ffffff",
        alpha: 0,
        r: 0,
        life: 0,
        max: 0,
      })
    for (let i = 0; i < TRAIL_CAPACITY; i++)
      this.trailFree.push({
        x: 0,
        y: 0,
        color: "#ffffff",
        alpha: 0,
        life: 0,
      })
    for (let i = 0; i < POPUP_CAPACITY; i++)
      this.popupFree.push({
        x: 0,
        y: 0,
        text: "",
        alpha: 0,
        vy: 0,
        big: false,
        color: "#ffffff",
      })
  }

  clear() {
    this.commands.length = 0
    this.commandEpoch++
    while (this.parts.length) this.partFree.push(this.parts.pop()!)
    while (this.trails.length) this.trailFree.push(this.trails.pop()!)
    while (this.popups.length) this.popupFree.push(this.popups.pop()!)
    this.comboA.v = 0
    this.comboA.alpha = 0
    this.comboA.scale = 1
    this.comboA.x = 0
    this.comboA.y = 0
    this.boardShift = null
    this.shakeT = 0
    this.csx = 0
    this.csy = 0
    this.pulse = 0
  }

  private pushCommand<T extends AnimationCommand,>(command: T): T {
    this.commands.push(command)
    return command
  }

  releaseCommand(commandId: number) {
    const index = this.commands.findIndex((command) => command.id === commandId)
    if (index >= 0) swapRemove(this.commands, index)
  }

  queueLanding(
    actionId: number,
    bubble: VisualBubble,
    duration = 0.2,
  ): LandingAnimationCommand {
    return this.pushCommand({
      id: this.nextCommandId++,
      actionId,
      kind: "landing",
      bubble,
      delay: 0,
      duration,
    })
  }

  queueMatch(
    actionId: number,
    members: VisualBubble[],
    originX: number,
    originY: number,
    duration = 0.16,
  ): MatchAnimationCommand {
    return this.pushCommand({
      id: this.nextCommandId++,
      actionId,
      kind: "match",
      members,
      originX,
      originY,
      delay: 0,
      duration,
    })
  }

  queueDrop(
    actionId: number,
    groupId: number,
    members: VisualBubble[],
    originX: number,
    originY: number,
    targetY: number,
    rotation: number,
    delay: number,
    duration = 0.58,
    pointsPerBubble?: number,
  ): DropAnimationCommand {
    return this.pushCommand({
      id: this.nextCommandId++,
      actionId,
      kind: "drop",
      groupId,
      members,
      originX,
      originY,
      targetY,
      rotation,
      delay,
      duration,
      pointsPerBubble,
    })
  }

  private acquireParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    alpha: number,
    r: number,
    max: number,
  ) {
    const p = this.partFree.pop()
    if (!p) return
    p.x = x
    p.y = y
    p.vx = vx
    p.vy = vy
    p.color = color
    p.alpha = alpha
    p.r = r
    p.life = 0
    p.max = max
    this.parts.push(p)
  }

  step(dt: number) {
    if (this.shakeT > 0) {
      this.shakeT -= dt
      const intensity = this.shakeT * 8
      this.csx = (Math.random() - 0.5) * intensity
      this.csy = (Math.random() - 0.5) * intensity
    } else {
      this.csx = 0
      this.csy = 0
    }
    this.pulse += dt * 2.8
    if (this.comboA.alpha > 0) {
      this.comboA.alpha -= dt * 1.4
      this.comboA.scale = Math.max(1, this.comboA.scale - dt * 4)
      this.comboA.y -= dt * 18
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 260 * dt
      p.alpha = Math.max(0, 1 - p.life / p.max)
      if (p.alpha <= 0) this.partFree.push(swapRemove(this.parts, i))
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i]
      trail.life += dt
      trail.alpha = Math.max(0, 1 - trail.life / 0.16)
      if (trail.alpha <= 0) this.trailFree.push(swapRemove(this.trails, i))
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const popup = this.popups[i]
      popup.y += popup.vy * dt
      popup.alpha = Math.max(0, popup.alpha - dt * (popup.big ? 1 : 1.3))
      if (popup.alpha <= 0) this.popupFree.push(swapRemove(this.popups, i))
    }
    if (this.boardShift)
      this.boardShift.t = Math.min(
        1,
        this.boardShift.t + dt / this.boardShift.duration,
      )
  }

  shake(dur: number) {
    this.shakeT = Math.max(this.shakeT, dur)
  }

  startBoardShift(duration = 0.22) {
    this.boardShiftState.t = 0
    this.boardShiftState.duration = duration
    this.boardShift = this.boardShiftState
  }

  markCombo(v: number, x: number, y: number) {
    this.comboA.v = v
    this.comboA.alpha = 1
    this.comboA.scale = 1.8
    this.comboA.x = x
    this.comboA.y = y
  }

  spawnImpact(actionId: number, x: number, y: number, color: string) {
    const command = this.pushCommand({
      id: this.nextCommandId++,
      actionId,
      kind: "impact",
      x,
      y,
      color,
      delay: 0,
      duration: 0.09,
    })
    this.shake(0.065)
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5
      const speed = 55 + Math.random() * 85
      this.acquireParticle(
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        color,
        0.75,
        2 + Math.random() * 3,
        0.18 + Math.random() * 0.12,
      )
    }
    return command
  }

  addTrail(x: number, y: number, color: string) {
    let trail = this.trailFree.pop()
    if (!trail) trail = swapRemove(this.trails, 0)
    trail.x = x
    trail.y = y
    trail.color = color
    trail.alpha = 0.72
    trail.life = 0
    this.trails.push(trail)
  }

  spawnWallHit(x: number, y: number, color: string) {
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.8
      const speed = 45 + i * 12
      this.acquireParticle(
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        color,
        0.9,
        2,
        0.12,
      )
    }
  }

  spawnPop(x: number, y: number, color: string) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 70 + Math.random() * 140
      this.acquireParticle(
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed - 50,
        color,
        1,
        2 + Math.random() * 4.5,
        0.32 + Math.random() * 0.22,
      )
    }
  }

  spawnPopup(x: number, y: number, text: string, big: boolean, color: string) {
    const popup = this.popupFree.pop()
    if (!popup) return
    popup.x = x
    popup.y = y
    popup.text = text
    popup.alpha = 1
    popup.vy = big ? -38 : -58
    popup.big = big
    popup.color = color
    this.popups.push(popup)
  }
}
