import type { GridParity, GridPos, Point } from "./types"
import { CANONICAL_HEIGHT, CANONICAL_WIDTH } from "./viewport"

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

/** One measured-host coordinate system for every phone portrait size. */
export class Layout {
  LW = CANONICAL_WIDTH
  LH = CANONICAL_HEIGHT
  readonly COLS = 9
  R = 22
  BOARD_LEFT = 82
  BOARD_TOP = 170
  BOARD_RIGHT = 478
  BOARD_BOTTOM = 640
  ROW_H = 22 * Math.sqrt(3)
  BOARD_CENTER_X = CANONICAL_WIDTH / 2
  SHOOTER_X = this.BOARD_CENTER_X
  SHOOTER_Y = 710
  NEXT_X = this.SHOOTER_X - 150
  NEXT_Y = 712
  WALL_L = this.BOARD_LEFT
  WALL_R = this.BOARD_RIGHT
  DANGER_ROW = 11
  DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H
  MAX_ROWS = this.DANGER_ROW + 4
  safeTop = 0
  safeBottom = CANONICAL_HEIGHT
  sideInset = 16
  hudTop = 16
  hudBottom = 64
  hudToBoardGap = 10
  shooterTop = 650
  hud = {
    level: { x: 16, y: 16, width: 72, height: 48 } as LayoutRect,
    score: { x: 180, y: 16, width: 120, height: 44 } as LayoutRect,
    moves: { x: 390, y: 16, width: 64, height: 44 } as LayoutRect,
    pause: { x: 464, y: 18, width: 80, height: 32 } as LayoutRect,
  }
  fever = { x: 196, y: 628, width: 168, height: 24 } as LayoutRect

  constructor(
    width: number = CANONICAL_WIDTH,
    height: number = CANONICAL_HEIGHT,
  ) {
    this.configure(width, height)
  }

  configure(width: number, height: number) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    this.LW = w
    this.LH = h
    this.safeTop = Math.max(8, Math.min(24, h * 0.025))
    this.safeBottom = h
    this.sideInset = Math.max(3, Math.min(6, w * 0.012))
    this.hudTop = this.safeTop
    this.hud = {
      level: { x: this.sideInset, y: this.hudTop + 6, width: 72, height: 48 },
      score: { x: w / 2 - 60, y: this.hudTop + 5, width: 120, height: 44 },
      moves: {
        x: w - this.sideInset - 64 - 44,
        y: this.hudTop + 6,
        width: 64,
        height: 44,
      },
      pause: {
        x: w - this.sideInset - 36,
        y: this.hudTop + 7,
        width: 36,
        height: 32,
      },
    }
    this.hudBottom = this.hudTop + 54
    // HUD is a floating overlay. Board placement is anchored to the safe top
    // and a compact gameplay lead-in, so a future HUD visual cannot reserve a
    // full horizontal band above the board.
    this.BOARD_TOP = this.safeTop + 20
    this.hudToBoardGap = this.BOARD_TOP - this.hudBottom
    const shooterHeight = Math.max(112, Math.min(150, h * 0.17))
    this.shooterTop = h - shooterHeight
    this.SHOOTER_Y = h - Math.max(52, shooterHeight * 0.42)
    this.SHOOTER_X = w / 2
    this.BOARD_CENTER_X = this.SHOOTER_X
    this.NEXT_X = Math.min(w - 44, this.SHOOTER_X + Math.min(92, w * 0.22))
    this.NEXT_Y = this.SHOOTER_Y + 4
    const usableBoardWidth = w - this.sideInset * 2
    this.R = usableBoardWidth / (this.COLS * 2)
    this.BOARD_LEFT = this.sideInset
    this.BOARD_RIGHT = w - this.sideInset
    this.ROW_H = this.R * Math.sqrt(3)
    this.WALL_L = this.BOARD_LEFT
    this.WALL_R = this.BOARD_RIGHT
    this.DANGER_ROW = Math.max(
      5,
      Math.floor(
        (this.shooterTop - this.BOARD_TOP - this.R * 1.5) / this.ROW_H,
      ),
    )
    this.DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H
    this.BOARD_BOTTOM = Math.min(this.shooterTop, this.DANGER_Y)
    this.fever = {
      x: Math.max(12, this.SHOOTER_X - 84),
      y: this.SHOOTER_Y - 86,
      width: 168,
      height: 24,
    }
    this.MAX_ROWS = this.DANGER_ROW + 4
  }

  effectiveParity(row: number, gridParity: GridParity = 0): GridParity {
    return ((row + gridParity) & 1) as GridParity
  }
  rowCapacity(row: number, gridParity: GridParity = 0) {
    return this.effectiveParity(row, gridParity) === 0
      ? this.COLS
      : this.COLS - 1
  }
  cellValid(row: number, col: number, gridParity: GridParity = 0) {
    return row >= 0 && col >= 0 && col < this.rowCapacity(row, gridParity)
  }
  /**
   * Structural upper bound for simultaneous floating bubbles in a legal
   * resolve. `findFloating()` always marks row 0 as ceiling-connected, so a
   * drop can only contain cells from rows below it. `checkEnd()` rejects any
   * occupied row whose bubble reaches DANGER_Y; the remaining row capacities
   * are therefore the maximum drop pool requirement for this layout.
   */
  maxFloatingBubbleCount(gridParity: GridParity = 0) {
    let count = 0
    for (let row = 1; row < this.MAX_ROWS; row++) {
      if (this.gToW(row, 0, gridParity).y + this.R >= this.DANGER_Y) break
      count += this.rowCapacity(row, gridParity)
    }
    return count
  }
  maxBoardBubbleCount(gridParity: GridParity = 0) {
    let count = 0
    for (let row = 0; row < this.MAX_ROWS; row++)
      count += this.rowCapacity(row, gridParity)
    return count
  }
  gToW(row: number, col: number, gridParity: GridParity = 0): Point {
    return {
      x: this.worldX(row, col, gridParity),
      y: this.worldY(row),
    }
  }
  worldX(row: number, col: number, gridParity: GridParity = 0) {
    const offsetX = this.effectiveParity(row, gridParity) === 1 ? this.R : 0
    return this.BOARD_LEFT + this.R + col * this.R * 2 + offsetX
  }
  worldY(row: number) {
    return this.BOARD_TOP + this.R + row * this.ROW_H
  }
  wToG(x: number, y: number, gridParity: GridParity = 0): GridPos {
    const row = Math.max(
      0,
      Math.round((y - this.BOARD_TOP - this.R) / this.ROW_H),
    )
    const offsetX = this.effectiveParity(row, gridParity) === 1 ? this.R : 0
    const col = Math.max(
      0,
      Math.min(
        this.rowCapacity(row, gridParity) - 1,
        Math.round((x - this.BOARD_LEFT - this.R - offsetX) / (this.R * 2)),
      ),
    )
    return { row, col }
  }
  nbrs(row: number, col: number, gridParity: GridParity = 0): GridPos[] {
    if (!this.cellValid(row, col, gridParity)) return []
    const odd = this.effectiveParity(row, gridParity) === 1
    return [
      { row, col: col - 1 },
      { row, col: col + 1 },
      { row: row - 1, col: odd ? col : col - 1 },
      { row: row - 1, col: odd ? col + 1 : col },
      { row: row + 1, col: odd ? col : col - 1 },
      { row: row + 1, col: odd ? col + 1 : col },
    ].filter((p) => this.cellValid(p.row, p.col, gridParity))
  }
}
