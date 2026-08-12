import { describe, expect, it } from "vitest";
import { Layout } from "./layout";

describe("Layout wide mode fills the viewport", () => {
  it.each([[1366, 768], [1440, 900], [1920, 1080], [2560, 1080]])(
    "board occupies 72–82% of width at %ipx",
    (w, h) => {
      const l = new Layout(w, h);
      const frac = (l.COLS * l.R * 2) / w;
      expect(frac).toBeGreaterThanOrEqual(0.72);
      expect(frac).toBeLessThanOrEqual(0.82);
      expect(l.COLS).toBeGreaterThanOrEqual(12);
      expect(l.WALL_R).toBeLessThanOrEqual(l.LW);
      expect(l.DANGER_Y).toBeLessThan(l.SHOOTER_Y);
    },
  );

  it("keeps HUD margins clear of the board", () => {
    const l = new Layout(1366, 768);
    const boardRight = l.BOARD_LEFT + l.COLS * l.R * 2;
    expect(boardRight).toBeLessThanOrEqual(l.LW - 160);
  });
});

describe("Layout portrait mode", () => {
  it("keeps the phone layout", () => {
    const l = new Layout(390, 844);
    expect(l.LW).toBe(560);
    expect(l.LH).toBe(800);
    expect(l.COLS).toBe(9);
    expect(l.R).toBe(22);
  });
});

describe("Layout grid math", () => {
  it("gToW/wToG roundtrip", () => {
    for (const [w, h] of [[560, 800], [1920, 1080]]) {
      const l = new Layout(w, h);
      const cells: [number, number][] = [
        [0, 0],
        [1, 0],
        [2, 1],
        [3, 7],
        [5, l.COLS - 1],
      ];
      for (const [r, c] of cells) {
        const p = l.gToW(r, c);
        const g = l.wToG(p.x, p.y);
        expect(g).toEqual({ row: r, col: c });
      }
    }
  });

  it("neighbors never go out of bounds", () => {
    const l = new Layout(560, 800);
    for (const n of l.nbrs(0, 0)) {
      expect(n.row).toBeGreaterThanOrEqual(0);
      expect(n.col).toBeGreaterThanOrEqual(0);
      expect(n.col).toBeLessThan(l.COLS);
    }
  });
});
