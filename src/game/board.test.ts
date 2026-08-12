import { describe, expect, it } from "vitest";
import { Board } from "./board";
import { Layout } from "./layout";

const layout = new Layout(560, 800);

describe("Board.fillInitial", () => {
  it("fills rows × cols with colors", () => {
    const b = new Board(layout);
    b.fillInitial(6, 5);
    expect(b.rows.length).toBe(6);
    for (const row of b.rows) expect(row.length).toBe(layout.COLS);
    expect(b.rows.every((r) => r.every((c) => c !== null))).toBe(true);
  });
});

describe("Board.bfsColor", () => {
  it("finds a connected same-color cluster", () => {
    const b = new Board(layout);
    b.set(0, 0, 2);
    b.set(0, 1, 2);
    b.set(0, 2, 2);
    b.set(1, 1, 1);
    expect(b.bfsColor(0, 1, 2)).toHaveLength(3);
    expect(b.bfsColor(1, 1, 1)).toHaveLength(1);
  });
});

describe("Board.findFloating", () => {
  it("detects bubbles disconnected from the top row", () => {
    const b = new Board(layout);
    b.set(0, 0, 1);
    b.set(3, 0, 1);
    const f = b.findFloating();
    expect(f).toHaveLength(1);
    expect(f[0]).toEqual({ row: 3, col: 0 });
  });

  it("returns nothing when everything is anchored", () => {
    const b = new Board(layout);
    b.set(0, 0, 1);
    b.set(1, 0, 1);
    expect(b.findFloating()).toHaveLength(0);
  });
});

describe("Board.spawnTopRow", () => {
  it("prepends a row of the same width", () => {
    const b = new Board(layout);
    b.fillInitial(1, 5);
    b.spawnTopRow(5);
    expect(b.rows.length).toBe(2);
    expect(b.rows[0].length).toBe(layout.COLS);
  });
});
