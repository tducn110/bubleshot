// ─── Colors ────────────────────────────────────────────────────────────────
// COLORS[5] (purple) sits outside stage-1 gameplay by design: it is a
// difficulty knob that stages with colors: 6 bring into play, and it is
// reserved for a future special-bubble type.
export const COLORS = [
  "#FF4D6D",
  "#FF9F1C",
  "#FFE04B",
  "#2DC653",
  "#3ABFF8",
  "#C77DFF",
] as const;

export const NC = COLORS.length;

// ─── Default tuning (stage 1 baseline; per-stage overrides live in
// STAGE_TABLE) ─────────────────────────────────────────────────────────────
export const INIT_COLOR_COUNT = 5; // colors in play; COLORS[5] is reserved
export const SPEED = 900; // projectile speed in logical px/s
export const INIT_ROWS = 6; // rows filled at level start
export const MATCH_MIN = 3; // minimum same-color cluster to pop
export const PTS_POP = 10; // score per popped bubble
export const PTS_DROP = 20; // score per floating (dropped) bubble
export const INIT_MOVES = 25; // shots granted at level start
export const ROW_EVERY = 4; // completed shots before a pressure row spawns

export function rndColor(n: number): number {
  return Math.floor(Math.random() * n);
}

// ─── Stage progression ─────────────────────────────────────────────────────
// Later stages push rows faster, use more colors, and grant fewer shots.
export interface StageParams {
  rows: number; // initial rows on the board
  colors: number; // colors in play for this stage
  moves: number; // shots granted
  rowEvery: number; // completed shots per pressure row
}

export const STAGE_TABLE: StageParams[] = [
  { rows: 6, colors: 5, moves: 25, rowEvery: 4 },
  { rows: 6, colors: 5, moves: 24, rowEvery: 3 },
  { rows: 7, colors: 6, moves: 24, rowEvery: 3 },
  { rows: 7, colors: 6, moves: 22, rowEvery: 2 },
];

/** Returns tuning for a 1-based stage; stages beyond the table reuse the last entry. */
export function stageParams(stage: number): StageParams {
  const i = Math.min(Math.max(1, Math.floor(stage)), STAGE_TABLE.length) - 1;
  return STAGE_TABLE[i];
}
