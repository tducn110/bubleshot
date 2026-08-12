import { INIT_COLOR_COUNT, INIT_ROWS, rndColor } from "./config";
import type { Layout } from "./layout";
import type { GridPos } from "./types";

export class Board {
  readonly rows: (number | null)[][] = [];
  version = 0;

  constructor(private readonly layout: Layout) {}

  cell(row: number, col: number): number | null {
    return this.rows[row]?.[col] ?? null;
  }

  set(row: number, col: number, v: number | null) {
    if (!this.rows[row]) this.rows[row] = new Array(this.layout.COLS).fill(null);
    this.rows[row][col] = v;
    this.version++;
  }

  fillInitial(rows: number = INIT_ROWS, colors: number = INIT_COLOR_COUNT) {
    this.rows.length = 0;
    for (let row = 0; row < rows; row++) {
      this.rows[row] = new Array(this.layout.COLS).fill(null);
      for (let col = 0; col < this.layout.COLS; col++) this.rows[row][col] = rndColor(colors);
    }
    this.version++;
  }

  spawnTopRow(colors: number = INIT_COLOR_COUNT) {
    const newRow: (number | null)[] = new Array(this.layout.COLS).fill(null);
    for (let col = 0; col < this.layout.COLS; col++) {
      if (Math.random() > 0.18) newRow[col] = rndColor(colors);
    }
    this.rows.unshift(newRow);
    this.version++;
  }

  bfsColor(row: number, col: number, c: number): GridPos[] {
    const vis = new Set<string>();
    const q = [{ row, col }];
    const res: GridPos[] = [];
    while (q.length) {
      const cur = q.shift()!;
      const k = `${cur.row},${cur.col}`;
      if (vis.has(k)) continue;
      vis.add(k);
      if (this.cell(cur.row, cur.col) !== c) continue;
      res.push(cur);
      for (const n of this.layout.nbrs(cur.row, cur.col)) {
        if (!vis.has(`${n.row},${n.col}`)) q.push(n);
      }
    }
    return res;
  }

  findFloating(): GridPos[] {
    const conn = new Set<string>();
    const q: GridPos[] = [];
    for (let col = 0; col < this.layout.COLS; col++) {
      if (this.cell(0, col) !== null) {
        conn.add(`0,${col}`);
        q.push({ row: 0, col });
      }
    }
    while (q.length) {
      const cur = q.shift()!;
      for (const n of this.layout.nbrs(cur.row, cur.col)) {
        const k = `${n.row},${n.col}`;
        if (!conn.has(k) && this.cell(n.row, n.col) !== null) {
          conn.add(k);
          q.push(n);
        }
      }
    }
    const floating: GridPos[] = [];
    for (let r = 0; r < this.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.cell(r, col) !== null && !conn.has(`${r},${col}`)) floating.push({ row: r, col });
      }
    }
    return floating;
  }

  isClear(): boolean {
    for (let r = 0; r < this.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.cell(r, col) !== null) return false;
      }
    }
    return true;
  }
}