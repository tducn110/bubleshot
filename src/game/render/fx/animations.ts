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
import { gameAudio } from "../../audio"

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
  onDropBounced?: (bubble: VisualBubble, x: number, y: number) => void
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
    gameAudio.playPop(Math.max(0, command.members.length - 3))
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
    gameAudio.playDrop()
    const group = this.takeGroup(command.originX, command.originY)
    const claims = this.claimMembers(
      command.members,
      "drop",
      group,
      command.originX,
      command.originY,
    )

    const dangerY = command.targetY
    const timeline = gsap.timeline({
      paused: this.paused,
      delay: this.duration(command.delay),
      onComplete: () => this.finish(command),
    })

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i]
      const member = command.members[i]
      const initialLocalX = member.x - command.originX
      const initialLocalY = member.y - command.originY

      // Stagger slightly so bubbles cascade naturally (bubbo-bubbo dynamic cluster feel)
      const stagger = this.duration(Math.min(0.08, (i % 6) * 0.015))

      // Initial impulse: slight random lateral spread + upward hop
      const seed = Math.sin(member.id * 12.9898 + i)
      const spreadX = seed * 30
      const hopY = -12 - Math.abs(Math.cos(member.id * 78.233)) * 8

      // Target bounce location on the danger line
      const targetLocalY = dangerY - command.originY
      const bounceX = initialLocalX + spreadX
      const bounceHeight = Math.max(
        32,
        Math.min(58, (dangerY - member.y) * 0.15),
      )

      // Dynamic fall time based on distance
      const fallTime = this.duration(0.25)
      const bounceUpTime = this.duration(0.12)
      const fallOffTime = this.duration(0.15)

      const bubbleTl = gsap.timeline()

      // 1. Pop loose: slight upward hop and lateral expansion
      bubbleTl.to(claim.visual, {
        x: initialLocalX + spreadX * 0.25,
        y: initialLocalY + hopY,
        duration: this.duration(0.06),
        ease: "power1.out",
      })

      // 2. Accelerate down under gravity to the danger line
      bubbleTl.to(claim.visual, {
        x: bounceX,
        y: targetLocalY,
        duration: fallTime,
        ease: "power2.in",
        onComplete: () => {
          // Impact on the danger line: pulses danger line and plays cheerful bounce sfx
          this.hooks.onDropBounced?.(member, command.originX + bounceX, dangerY)
        },
      })

      // 3. Bounce upward from the danger line with damping
      bubbleTl.to(claim.visual, {
        x: bounceX + spreadX * 0.35,
        y: targetLocalY - bounceHeight,
        duration: bounceUpTime,
        ease: "power2.out",
      })

      // 4. Final descent past the bottom of the screen
      bubbleTl.to(claim.visual, {
        x: bounceX + spreadX * 0.65,
        y: targetLocalY + 120,
        duration: fallOffTime,
        ease: "power2.in",
      })

      // 5. Fade out and scale down during final descent
      bubbleTl.to(
        claim.visual,
        {
          pixi: { alpha: 0, scale: 0.72 },
          duration: fallOffTime * 0.85,
          ease: "power1.in",
        },
        `-=${fallOffTime * 0.85}`,
      )

      timeline.add(bubbleTl, stagger)
    }

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
