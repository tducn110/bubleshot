import type { Board } from "./board";
import type { Fx } from "./fx";
import type { Layout } from "./layout";

export type Phase =
  | "READY"
  | "SHOOTING"
  | "RESOLVING"
  | "DROPPING"
  | "WIN"
  | "LOSE"
  | "PAUSED";

export interface Point {
  x: number;
  y: number;
}

export interface GridPos {
  row: number;
  col: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number;
}

export interface Pop {
  c: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  t: number;
}

export interface Drop {
  c: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  r: number;
  life: number;
  max: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  alpha: number;
  vy: number;
  big: boolean;
  color: string;
}

export interface GameView {
  readonly layout: Layout;
  readonly board: Board;
  readonly fx: Fx;
  readonly phase: Phase;
  readonly cur: number;
  readonly nxt: number;
  readonly shot: Shot | null;
  readonly traj: Point[];
  readonly score: number;
  readonly combo: number;
  readonly moves: number;
  readonly stage: number;
  readonly starsEarned: number;
  /** Completed shots left before a pressure row spawns (countdown). */
  readonly rowRemaining: number;
  /** Pressure cadence (completed shots per row) for the current stage. */
  readonly rowEvery: number;
}