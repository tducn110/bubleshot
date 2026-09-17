import type { Board } from "./board"
import type { Fx } from "./fx"
import type { Layout } from "./layout"

export type Phase = "LOADING" | "READY" | "VOLLEY_FLYING" | "RESOLVE_VOLLEY" | "POPPING" | "DROPPING" | "BOARD_DESCENDING" | "WIN" | "LOSE" | "PAUSED"

export type GridParity = 0 | 1

export interface Point {
  x: number
  y: number
}

export interface GridPos {
  row: number
  col: number
}

export interface Shot {
  actionId: number
  x: number
  y: number
  vx: number
  vy: number
  c: number
  settled: boolean
  row: number
  col: number
  /** Optional so existing test fixtures remain valid while pooled shots reset it. */
  power?: ShotPower | null
}

export type ShotMode = 1 | 2 | 3 | 4
export type PowerUpId = "rows3" | "bomb" | "rainbow" | "waypoints"
export type ShotPower = "bomb" | "rainbow"

export interface PowerUpStatus {
  id: PowerUpId
  available: boolean
  armed: boolean
}

export interface ResolvedBubble {
  id: number
  c: number
  row: number
  col: number
}

export interface VolleyPlacement {
  row: number
  col: number
  c: number
}

export interface FloatingGroupResult {
  groupId: number
  members: ResolvedBubble[]
}

export interface ResolveResult {
  actionId: number
  expectedBoardVersion: number
  boardVersion: number
  stale: boolean
  placed: ResolvedBubble[]
  matched: ResolvedBubble[]
  /** Bubbles removed by a bomb before normal match resolution. */
  detonated: ResolvedBubble[]
  floatingGroups: FloatingGroupResult[]
}

export interface VisualBubble {
  id: number
  c: number
  x: number
  y: number
}

export type AnimationKind = "impact" | "landing" | "match" | "drop"

interface AnimationCommandBase {
  id: number
  actionId: number
  kind: AnimationKind
  delay: number
  duration: number
}

export interface ImpactAnimationCommand extends AnimationCommandBase {
  kind: "impact"
  x: number
  y: number
  color: string
}

export interface LandingAnimationCommand extends AnimationCommandBase {
  kind: "landing"
  bubble: VisualBubble
}

export interface MatchAnimationCommand extends AnimationCommandBase {
  kind: "match"
  members: VisualBubble[]
  originX: number
  originY: number
}

export interface DropAnimationCommand extends AnimationCommandBase {
  kind: "drop"
  groupId: number
  members: VisualBubble[]
  originX: number
  originY: number
  targetY: number
  rotation: number
}

export type AnimationCommand = ImpactAnimationCommand | LandingAnimationCommand | MatchAnimationCommand | DropAnimationCommand

export interface AnimationCompletion {
  commandId: number
  actionId: number
  kind: AnimationKind
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  r: number
  life: number
  max: number
}

export interface Trail {
  x: number
  y: number
  color: string
  alpha: number
  life: number
}

export interface Popup {
  x: number
  y: number
  text: string
  alpha: number
  vy: number
  big: boolean
  color: string
}

export interface GameView {
  readonly layout: Layout
  readonly board: Board
  readonly fx: Fx
  readonly phase: Phase
  readonly actionId: number
  readonly cur: number
  readonly nxt: number
  readonly shots: Shot[]
  readonly aimAngle: number
  readonly recoil: number
  readonly shotMode: ShotMode
  readonly powerUps: readonly PowerUpStatus[]
  readonly feverProgress: number
  readonly feverActive: boolean
  readonly feverShots: number
  readonly traj: Point[]
  readonly score: number
  readonly combo: number
  readonly moves: number
  readonly stage: number
  readonly starsEarned: number
  /** Completed shots left before a pressure row spawns (countdown). */
  readonly rowRemaining: number
  /** Pressure cadence (completed shots per row) for the current stage. */
  readonly rowEvery: number
}
