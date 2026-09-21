import type { Point } from "./types"

/** A board bubble expressed in the same logical coordinates as the shooter. */
export interface TrajectoryBubble {
  row: number
  col: number
  x: number
  y: number
}

export interface TrajectorySegment {
  readonly from: Point
  readonly to: Point
  readonly distance: number
}

export type TrajectoryTerminal = { readonly kind: "ceiling" } | {
  readonly kind: "bubble"
  readonly row: number
  readonly col: number
} | { readonly kind: "limit" }

export interface TrajectoryResult {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly distance: number
  readonly wallBounces: number
  readonly lastWallX: number | null
  readonly lastWallY: number | null
  readonly terminal: TrajectoryTerminal
}

export interface TraceTrajectoryOptions {
  readonly origin: Point
  readonly velocity: Point
  readonly maxDistance: number
  /** Logical x-coordinate of the bubble centre at the left wall. */
  readonly wallLeft: number
  /** Logical x-coordinate of the bubble centre at the right wall. */
  readonly wallRight: number
  /** Logical y-coordinate of the bubble centre at the ceiling. */
  readonly ceilingY: number
  /** Centres closer than this collide. */
  readonly collisionRadius: number
  readonly maxBounces: number
  readonly bubbles: readonly TrajectoryBubble[]
  readonly bubbleCount: number
  readonly onSegment?: (segment: TrajectorySegment) => void
}

const EPSILON = 0.0001

type EventKind = "limit" | "wall" | "ceiling" | "bubble"

/**
 * Trace a shot with the same wall, ceiling, and expanded-circle collision
 * geometry used by the live projectile. The caller owns board lookup and may
 * render segments or simply consume the final state.
 */
export function traceTrajectory(
  options: TraceTrajectoryOptions,
): TrajectoryResult {
  let x = options.origin.x
  let y = options.origin.y
  let vx = options.velocity.x
  let vy = options.velocity.y
  let remaining = Math.max(0, options.maxDistance)
  let travelled = 0
  let wallBounces = 0
  let lastWallX: number | null = null
  let lastWallY: number | null = null
  let terminal: TrajectoryTerminal = { kind: "limit" }

  // A normal game shot cannot exhaust this guard. It only protects callers
  // from a malformed zero-distance configuration.
  for (let guard = 0; guard < 32 && remaining > EPSILON; guard++) {
    const speed = Math.hypot(vx, vy)
    if (speed <= EPSILON) break
    const dx = vx / speed
    const dy = vy / speed

    let distance = remaining
    let event: EventKind = "limit"
    let hitBubble: TrajectoryBubble | null = null

    if (dx < -EPSILON) {
      const candidate = (options.wallLeft - x) / dx
      if (candidate > EPSILON && candidate < distance) {
        distance = candidate
        event = "wall"
      }
    } else if (dx > EPSILON) {
      const candidate = (options.wallRight - x) / dx
      if (candidate > EPSILON && candidate < distance) {
        distance = candidate
        event = "wall"
      }
    }

    if (dy < -EPSILON) {
      const candidate = (options.ceilingY - y) / dy
      if (candidate > EPSILON && candidate < distance) {
        distance = candidate
        event = "ceiling"
      }
    }

    const bubbleCount = Math.min(options.bubbleCount, options.bubbles.length)
    for (let index = 0; index < bubbleCount; index++) {
      const bubble = options.bubbles[index]
      const relX = x - bubble.x
      const relY = y - bubble.y
      const projection = -(relX * dx + relY * dy)
      if (projection <= EPSILON) continue
      const closestSquared = relX * relX + relY * relY - projection * projection
      const radiusSquared = options.collisionRadius * options.collisionRadius
      if (closestSquared > radiusSquared) continue
      const contact = projection - Math.sqrt(radiusSquared - closestSquared)
      if (contact <= EPSILON || contact >= distance) continue
      distance = contact
      event = "bubble"
      hitBubble = bubble
    }

    const from = { x, y }
    x += dx * distance
    y += dy * distance
    travelled += distance
    remaining = Math.max(0, remaining - distance)
    options.onSegment?.({ from, to: { x, y }, distance })

    if (event === "wall") {
      lastWallX = x
      lastWallY = y
      vx = -vx
      wallBounces++
      if (wallBounces >= options.maxBounces) {
        terminal = { kind: "limit" }
        break
      }
      continue
    }
    if (event === "ceiling") {
      terminal = { kind: "ceiling" }
      break
    }
    if (event === "bubble" && hitBubble) {
      terminal = {
        kind: "bubble",
        row: hitBubble.row,
        col: hitBubble.col,
      }
      break
    }
    terminal = { kind: "limit" }
    break
  }

  return {
    x,
    y,
    vx,
    vy,
    distance: travelled,
    wallBounces,
    lastWallX,
    lastWallY,
    terminal,
  }
}
