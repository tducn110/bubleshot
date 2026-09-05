import { gsap } from "gsap"
import { PixiPlugin } from "gsap/PixiPlugin"
import { Container, Sprite } from "pixi.js"
import type {
  AnimationCommand,
  AnimationKind,
  ImpactAnimationCommand,
  LandingAnimationCommand,
  MatchAnimationCommand,
  DropAnimationCommand,
  VisualBubble,
} from "../../types"
import type { BubbleVisual } from "../hud/bubbleVisual"
import type { GameTextures } from "../core/textures"

gsap.registerPlugin(PixiPlugin)
PixiPlugin.registerPIXI({ Container, Sprite })

export interface ClaimedBubble {
  visual: BubbleVisual
  release: () => void
}

interface AnimationHooks {
  claimBubble: (
    bubble: VisualBubble,
    kind: "match" | "drop",
    parent: Container,
  ) => ClaimedBubble
  getBoardBubble: (id: number) => BubbleVisual | undefined
  complete: (commandId: number, actionId: number, kind: AnimationKind) => void
}

interface ActiveAnimation {
  animation: gsap.core.Animation
  command: AnimationCommand
  cleanup: () => void
}

interface ImpactVisual {
  root: Container
  flash: Sprite
}

/**
 * Presentation-only animation consumer. It may reparent visuals and tween
 * Pixi transforms, but it never mutates Board or Engine phase directly.
 */
export class GameplayAnimations {
  private readonly active = new Map<number, ActiveAnimation>()
  private readonly seen = new Set<number>()
  private readonly pendingLandings: LandingAnimationCommand[] = []
  private readonly groupFree: Container[] = []
  private readonly impactFree: ImpactVisual[] = []
  private epoch = -1
  private paused = false
  private readonly reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  constructor(
    private readonly parent: Container,
    private readonly textures: GameTextures,
    private readonly hooks: AnimationHooks,
    groupCapacity: number,
  ) {
    for (let i = 0; i < groupCapacity + 1; i++) {
      const group = new Container()
      group.visible = false
      this.parent.addChild(group)
      this.groupFree.push(group)
    }
    for (let i = 0; i < 4; i++) {
      const root = new Container()
      const flash = new Sprite({
        texture: textures.whiteDot,
        anchor: 0.5,
        blendMode: "screen",
      })
      root.addChild(flash)
      root.visible = false
      this.parent.addChild(root)
      this.impactFree.push({ root, flash })
    }
  }

  prepare(commands: readonly AnimationCommand[], epoch: number) {
    if (epoch !== this.epoch) {
      this.reset()
      this.epoch = epoch
    }
    for (const command of commands) {
      if (this.seen.has(command.id)) continue
      this.seen.add(command.id)
      if (command.kind === "impact") this.startImpact(command)
      else if (command.kind === "match") this.startMatch(command)
      else if (command.kind === "drop") this.startDrop(command)
      else this.pendingLandings.push(command)
    }
  }

  startPendingLandings() {
    while (this.pendingLandings.length) {
      const command = this.pendingLandings.shift()!
      const bubble = this.hooks.getBoardBubble(command.bubble.id)
      if (!bubble) {
        this.hooks.complete(command.id, command.actionId, command.kind)
        continue
      }
      const duration = this.duration(command.duration)
      const timeline = gsap.timeline({
        paused: this.paused,
        onComplete: () => {
          bubble.scale.set(1)
          this.finish(command)
        },
      })
      timeline
        .fromTo(bubble, { pixi: { scaleX: 1.08, scaleY: 0.78 } }, {
          pixi: { scaleX: 0.94, scaleY: 1.1 },
          duration: duration * 0.45,
          ease: "power2.out",
        })
        .to(bubble, {
          pixi: { scaleX: 1, scaleY: 1 },
          duration: duration * 0.55,
          ease: "back.out(2)",
        })
      this.active.set(command.id, {
        animation: timeline,
        command,
        cleanup: () => bubble.scale.set(1),
      })
    }
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return
    this.paused = paused
    for (const { animation } of this.active.values()) {
      if (paused) animation.pause()
      else animation.resume()
    }
  }

  private duration(value: number) {
    return this.reducedMotion ? Math.min(0.01, value) : value
  }

  private takeGroup(x: number, y: number) {
    const group = this.groupFree.pop() ?? new Container()
    if (group.parent !== this.parent) this.parent.addChild(group)
    group.visible = true
    group.alpha = 1
    group.position.set(x, y)
    group.scale.set(1)
    group.rotation = 0
    return group
  }

  private putGroup(group: Container) {
    group.visible = false
    group.alpha = 0
    group.position.set(0, 0)
    group.scale.set(1)
    group.rotation = 0
    if (group.parent !== this.parent) this.parent.addChild(group)
    this.groupFree.push(group)
  }

  private claimMembers(
    members: readonly VisualBubble[],
    kind: "match" | "drop",
    group: Container,
    originX: number,
    originY: number,
  ) {
    const claims: ClaimedBubble[] = []
    for (const member of members) {
      const claim = this.hooks.claimBubble(member, kind, group)
      claim.visual.position.set(member.x - originX, member.y - originY)
      claim.visual.scale.set(1)
      claim.visual.alpha = 1
      claims.push(claim)
    }
    return claims
  }

  private startImpact(command: ImpactAnimationCommand) {
    const visual = this.impactFree.pop()
    if (!visual) {
      this.hooks.complete(command.id, command.actionId, command.kind)
      return
    }
    const { root, flash } = visual
    root.visible = true
    root.position.set(command.x, command.y)
    root.alpha = 1
    root.scale.set(0.7)
    flash.tint = command.color
    const tween = gsap.to(root, {
      pixi: { scale: 2.9, alpha: 0 },
      delay: this.duration(command.delay),
      duration: this.duration(command.duration),
      ease: "power3.out",
      paused: this.paused,
      onComplete: () => this.finish(command),
    })
    this.active.set(command.id, {
      animation: tween,
      command,
      cleanup: () => {
        root.visible = false
        root.alpha = 0
        this.impactFree.push(visual)
      },
    })
  }

  private startMatch(command: MatchAnimationCommand) {
    const group = this.takeGroup(command.originX, command.originY)
    const claims = this.claimMembers(
      command.members,
      "match",
      group,
      command.originX,
      command.originY,
    )
    const duration = this.duration(command.duration)
    const timeline = gsap.timeline({
      paused: this.paused,
      delay: this.duration(command.delay),
      onComplete: () => this.finish(command),
    })
    timeline
      .to(group, {
        pixi: { scaleX: 1.12, scaleY: 0.86 },
        duration: duration * 0.28,
        ease: "power2.out",
      })
      .to(group, {
        pixi: { scale: 1.17 },
        duration: duration * 0.28,
        ease: "back.out(2.4)",
      })
      .to(group, {
        pixi: { scale: 0.08, alpha: 0 },
        duration: duration * 0.44,
        ease: "power3.in",
      })
    this.active.set(command.id, {
      animation: timeline,
      command,
      cleanup: () => {
        for (const claim of claims) claim.release()
        this.putGroup(group)
      },
    })
  }

  private startDrop(command: DropAnimationCommand) {
    const group = this.takeGroup(command.originX, command.originY)
    const claims = this.claimMembers(
      command.members,
      "drop",
      group,
      command.originX,
      command.originY,
    )
    const duration = this.duration(command.duration)
    const timeline = gsap.timeline({
      paused: this.paused,
      delay: this.duration(command.delay),
      onComplete: () => this.finish(command),
    })
    timeline
      .to(group, {
        pixi: { y: command.targetY, rotation: command.rotation },
        duration,
        ease: "power2.in",
      })
      .to(
        group,
        {
          pixi: { alpha: 0 },
          duration: duration * 0.24,
          ease: "power1.in",
        },
        `-=${duration * 0.24}`,
      )
    this.active.set(command.id, {
      animation: timeline,
      command,
      cleanup: () => {
        for (const claim of claims) claim.release()
        this.putGroup(group)
      },
    })
  }

  private finish(command: AnimationCommand) {
    const active = this.active.get(command.id)
    if (!active) return
    this.active.delete(command.id)
    active.cleanup()
    this.hooks.complete(command.id, command.actionId, command.kind)
  }

  reset() {
    for (const [commandId, { animation, command, cleanup }] of this.active) {
      animation.kill()
      cleanup()
      this.active.delete(commandId)
      // Killing a presentation timeline is still a terminal lifecycle event.
      // The Engine owns the phase transition and treats this signal exactly
      // like completion, guarded by actionId and commandId.
      this.hooks.complete(command.id, command.actionId, command.kind)
    }
    this.seen.clear()
    this.pendingLandings.length = 0
  }

  destroy() {
    this.reset()
  }
}
