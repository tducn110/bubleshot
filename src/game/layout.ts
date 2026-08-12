import type { GridPos, Point } from "./types";

export class Layout {
  LW = 560;
  LH = 800;
  COLS = 9;
  R = 22;
  BOARD_LEFT = 37;
  BOARD_TOP = 108;
  ROW_H = 22 * Math.sqrt(3);
  BOARD_CENTER_X = 37 + (9 * 22 * 2) / 2;
  SHOOTER_X = this.BOARD_CENTER_X;
  SHOOTER_Y = 710;
  NEXT_X = 112;
  NEXT_Y = 712;
  WALL_L = this.BOARD_LEFT + this.R;
  WALL_R = this.BOARD_LEFT + this.COLS * this.R * 2 - this.R;
  DANGER_ROW = 11;
  DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H;
  MAX_ROWS = 15;

  constructor(width: number, height: number) {
    this.configure(width, height);
  }

  configure(width: number, height: number) {
    const wide = width / Math.max(height, 1) >= 1.08;
    if (wide) {
      // Full-bleed logical space; the board occupies ~72–82% of viewport width
      // so gameplay uses the whole screen instead of a capped 1080px strip.
      this.LW = Math.round(width);
      this.LH = Math.round(height);
      const targetW = Math.min(width * 0.78, width - 380); // keep HUD margins
      const dia = Math.min(88, Math.max(60, width / 24)); // bubble diameter target
      this.COLS = Math.max(12, Math.round(targetW / dia));
      this.R = targetW / (2 * this.COLS);
      this.BOARD_TOP = 96;
    } else {
      this.LW = 560;
      this.LH = 800;
      this.COLS = 9;
      this.R = 22;
      this.BOARD_TOP = 108;
    }
    this.ROW_H = this.R * Math.sqrt(3);
    const boardW = this.COLS * this.R * 2;
    this.BOARD_LEFT = (this.LW - boardW) / 2;
    this.BOARD_CENTER_X = this.LW / 2;
    this.SHOOTER_X = this.BOARD_CENTER_X;
    this.SHOOTER_Y = wide ? this.LH - Math.max(76, Math.min(112, this.LH * 0.12)) : 710;
    this.NEXT_X = wide ? this.LW - Math.max(92, this.LW * 0.075) : this.SHOOTER_X - 150;
    this.NEXT_Y = wide ? Math.min(this.LH - 142, 294) : this.SHOOTER_Y + 2;
    this.DANGER_ROW = wide ? Math.max(8, Math.floor((this.SHOOTER_Y - this.BOARD_TOP - 105) / this.ROW_H)) : 11;
    this.DANGER_Y = this.BOARD_TOP + this.DANGER_ROW * this.ROW_H;
    this.MAX_ROWS = this.DANGER_ROW + 4;
    this.WALL_L = this.BOARD_LEFT + this.R;
    this.WALL_R = this.BOARD_LEFT + boardW - this.R;
  }

  gToW(row: number, col: number): Point {
    return {
      x: this.BOARD_LEFT + this.R + col * this.R * 2 + (row % 2 === 1 ? this.R : 0),
      y: this.BOARD_TOP + this.R + row * this.ROW_H,
    };
  }

  wToG(x: number, y: number): GridPos {
    const row = Math.max(0, Math.round((y - this.BOARD_TOP - this.R) / this.ROW_H));
    const offsetX = row % 2 === 1 ? this.R : 0;
    const col = Math.max(
      0,
      Math.min(this.COLS - 1, Math.round((x - this.BOARD_LEFT - this.R - offsetX) / (this.R * 2)))
    );
    return { row, col };
  }

  nbrs(row: number, col: number): GridPos[] {
    const odd = row % 2 === 1;
    return [
      { row, col: col - 1 },
      { row, col: col + 1 },
      { row: row - 1, col: odd ? col : col - 1 },
      { row: row - 1, col: odd ? col + 1 : col },
      { row: row + 1, col: odd ? col : col - 1 },
      { row: row + 1, col: odd ? col + 1 : col },
    ].filter((p) => p.row >= 0 && p.col >= 0 && p.col < this.COLS);
  }
}