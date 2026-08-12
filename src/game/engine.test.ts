import { describe, expect, it } from "vitest";
import { BubbleShooterEngine } from "./engine";

// The engine registers keydown/resize on `window`; stub it for node tests.
(globalThis as unknown as { window: { addEventListener: () => void; removeEventListener: () => void } }).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

function fakeCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 0,
    clientHeight: 0,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

/** Aims at a specific board column so shots spread horizontally (no danger stack). */
function aimAt(engine: BubbleShooterEngine, col: number) {
  const e = engine as unknown as { plx: number; ply: number };
  e.plx = engine.layout.gToW(0, col).x;
  e.ply = 0;
}

function shoot(engine: BubbleShooterEngine) {
  (engine as unknown as { doShoot: () => void }).doShoot();
}

function runUntilReady(engine: BubbleShooterEngine) {
  for (let f = 0; f < 500; f++) {
    engine.tick(0.04);
    if (engine.phase === "READY") break;
  }
  expect(engine.phase).toBe("READY");
}

function completeShots(engine: BubbleShooterEngine, n: number) {
  for (let i = 0; i < n; i++) {
    aimAt(engine, 1 + (i % 6) * 1.2);
    shoot(engine);
    runUntilReady(engine);
  }
}

describe("Row pressure timing", () => {
  it("spawns no pressure row while a shot is in flight", () => {
    const e = new BubbleShooterEngine(fakeCanvas());
    const before = e.board.rows.length;
    shoot(e);
    expect(e.phase).toBe("SHOOTING");
    for (let f = 0; f < 4; f++) {
      e.tick(0.04);
      expect(e.board.rows.length).toBe(before);
    }
  });

  it("counts down rowRemaining only after a shot completes", () => {
    const e = new BubbleShooterEngine(fakeCanvas());
    expect(e.rowRemaining).toBe(e.rowEvery);
    completeShots(e, 1);
    expect(e.rowRemaining).toBe(e.rowEvery - 1);
  });

  it("spawns a pressure row after rowEvery completed shots", () => {
    const e = new BubbleShooterEngine(fakeCanvas());
    e.board.rows.length = 0; // empty board: shots land in row 0, no danger stack
    let spawns = 0;
    const orig = e.board.spawnTopRow.bind(e.board);
    (e.board as unknown as { spawnTopRow: (c?: number) => void }).spawnTopRow = (c?: number) => {
      spawns++;
      return orig(c);
    };
    completeShots(e, e.rowEvery);
    expect(spawns).toBe(1);
    expect(e.rowRemaining).toBe(e.rowEvery);
  });

  it("counts failed shots (no match) as completed shots", () => {
    const e = new BubbleShooterEngine(fakeCanvas());
    e.board.rows.length = 0; // shot lands alone -> no match, shot still counts
    let spawns = 0;
    const orig = e.board.spawnTopRow.bind(e.board);
    (e.board as unknown as { spawnTopRow: (c?: number) => void }).spawnTopRow = (c?: number) => {
      spawns++;
      return orig(c);
    };
    completeShots(e, e.rowEvery);
    expect(spawns).toBe(1); // no-match shots still drive the pressure cycle
    expect(e.rowRemaining).toBe(e.rowEvery);
  });
});
