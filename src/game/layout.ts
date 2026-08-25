import type { GridParity, GridPos, Point } from "./types"
import { CANONICAL_HEIGHT, CANONICAL_WIDTH } from "./viewport"

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface HudLayout {
  contentRect: LayoutRect
  scoreRect: LayoutRect
  actionRect: LayoutRect
  dashboardRect: LayoutRect
  pauseRect: LayoutRect
}

// Keep the six-row stage-1 opening below the danger threshold even when
// landscape height, rather than width, is the board's limiting dimension.
const MIN_DANGER_ROWS = 7
// The danger line is a gameplay boundary, so it stays close to the shooter
// instead of being capped at an arbitrary row and leaving dead space below it.
const DANGER_TO_SHOOTER_TOP = 2.4

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
  safeLeft = 0
  safeWidth = CANONICAL_WIDTH
  hudRect: LayoutRect = {
    x: 12,
    y: 28,
    width: CANONICAL_WIDTH - 24,
    height: 80,
  }
  gameplayRect: LayoutRect = {
    x: 0,
    y: 118,
    width: CANONICAL_WIDTH,
    height: CANONICAL_HEIGHT - 118,
  }
  sideInset = 12
  hudTop = 28
  hudBottom = 108
  hudToBoardGap = 10
  shooterTop = 650
  hud: HudLayout = {
    contentRect: { x: 24, y: 40, width: 512, height: 56 },
    scoreRect: { x: 24, y: 40, width: 124, height: 56 },
    actionRect: { x: 432, y: 47, width: 96, height: 44 },
    dashboardRect: { x: 432, y: 47, width: 44, height: 44 },
    pauseRect: { x: 484, y: 47, width: 44, height: 44 },
  }

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
    this.safeLeft = Math.max(12, Math.min(20, w * 0.03))
    this.safeWidth = Math.max(1, w - this.safeLeft * 2)
    this.sideInset = this.safeLeft
    this.hudTop = this.safeTop + 8
    const landscape = w > h
    const uiBase = landscape
      ? Math.max(34, Math.min(40, Math.min(w, h) * 0.09))
      : Math.max(38, Math.min(42, Math.min(w, h) * 0.105))
    const hudHeight = landscape
      ? Math.max(42, Math.min(54, uiBase + 7))
      : Math.max(55, Math.min(64, uiBase + 17))
    const gameplayHudHeight = Math.max(76, Math.min(84, h * 0.095))
    const gameplayGap = Math.max(8, Math.min(12, h * 0.012))
    const gameplayTop = this.hudTop + gameplayHudHeight + gameplayGap
    this.hudRect = {
      x: this.safeLeft,
      y: this.hudTop,
      width: this.safeWidth,
      height: hudHeight,
    }
    this.hudBottom = this.hudRect.y + this.hudRect.height
    this.hudToBoardGap = gameplayTop - this.hudBottom

    const contentPadding = Math.max(7, Math.min(10, this.hudRect.width * 0.035))
    const contentRect: LayoutRect = {
      x: this.hudRect.x + contentPadding,
      y: this.hudRect.y + contentPadding,
      width: Math.max(1, this.hudRect.width - contentPadding * 2),
      height: Math.max(1, this.hudRect.height - contentPadding * 2),
    }
    const buttonSize = landscape
      ? Math.max(30, Math.min(uiBase, h * 0.075))
      : uiBase
    const actionGap = Math.max(6, Math.min(8, contentRect.width * 0.03))
    const actionWidth = buttonSize * 2 + actionGap
    const scoreWidth = Math.min(136, Math.max(96, contentRect.width * 0.34))
    const actionX = contentRect.x + contentRect.width - actionWidth
    const centerY = this.hudRect.y + this.hudRect.height / 2
    this.hud = {
      contentRect,
      scoreRect: {
        x: contentRect.x,
        y: contentRect.y,
        width: scoreWidth,
        height: contentRect.height,
      },
      actionRect: {
        x: actionX,
        y: centerY - buttonSize / 2,
        width: actionWidth,
        height: buttonSize,
      },
      dashboardRect: {
        x: actionX,
        y: centerY - buttonSize / 2,
        width: buttonSize,
        height: buttonSize,
      },
      pauseRect: {
        x: actionX + buttonSize + actionGap,
        y: centerY - buttonSize / 2,
        width: buttonSize,
        height: buttonSize,
      },
    }
    // Gameplay owns the full space below HUD. Board, danger and shooter are
    // all derived from this rectangle so resize has one geometry truth.
    this.gameplayRect = {
      x: 0,
      y: gameplayTop,
      width: w,
      height: Math.max(1, h - gameplayTop),
    }
    this.BOARD_TOP = this.gameplayRect.y
    this.hudToBoardGap = this.BOARD_TOP - this.hudBottom
    const shooterHeight = Math.max(
      112,
      Math.min(150, this.gameplayRect.height * 0.19),
    )
    this.shooterTop =
      this.gameplayRect.y + this.gameplayRect.height - shooterHeight
    this.SHOOTER_Y =
      this.gameplayRect.y +
      this.gameplayRect.height -
      Math.max(52, shooterHeight * 0.42)
    this.SHOOTER_X = w / 2
    this.BOARD_CENTER_X = this.SHOOTER_X
    this.NEXT_X = Math.min(w - 44, this.SHOOTER_X + Math.min(92, w * 0.22))
    this.NEXT_Y = this.SHOOTER_Y + 4
    const widthLimitedRadius = (w - this.sideInset * 2) / (this.COLS * 2)
    const heightLimitedRadius =
      (this.shooterTop - this.gameplayRect.y) /
      (MIN_DANGER_ROWS * Math.sqrt(3) + 1.5)
    this.R = Math.max(6, Math.min(widthLimitedRadius, heightLimitedRadius))
    const boardWidth = this.R * this.COLS * 2
    this.BOARD_LEFT = Math.max(0, (w - boardWidth) / 2)
    this.BOARD_RIGHT = this.BOARD_LEFT + boardWidth
    this.ROW_H = this.R * Math.sqrt(3)
    this.WALL_L = this.BOARD_LEFT
    this.WALL_R = this.BOARD_RIGHT
    const dangerFromShooter = this.shooterTop - this.R * DANGER_TO_SHOOTER_TOP
    const minimumDanger = this.BOARD_TOP + MIN_DANGER_ROWS * this.ROW_H
    this.DANGER_Y = Math.max(minimumDanger, dangerFromShooter)
    this.DANGER_ROW = Math.max(
      MIN_DANGER_ROWS,
      Math.round((this.DANGER_Y - this.BOARD_TOP) / this.ROW_H),
    )
    this.BOARD_BOTTOM = Math.min(this.shooterTop, this.DANGER_Y)
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
