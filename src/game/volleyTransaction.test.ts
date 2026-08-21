import { describe, expect, it, vi } from "vitest"
import { Board } from "./board"
import { BubbleShooterEngine } from "./engine"
import { Layout } from "./layout"

const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
}
;(globalThis as unknown as { window: typeof windowStub }).window = windowStub

function fakeCanvas(connected = false): HTMLCanvasElement {
  return {
    isConnected: connected,
    clientWidth: connected ? 390 : 0,
    clientHeight: connected ? 844 : 0,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: connected ? 390 : 0,
      height: connected ? 844 : 0,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement
}

describe("Board.resolveVolley", () => {
  it("places and matches an entire volley in one board version", () => {
    const board = new Board(new Layout(390, 844))
    const before = board.version
    const result = board.resolveVolley(7, before, [
      { row: 0, col: 0, c: 2 },
      { row: 0, col: 1, c: 2 },
      { row: 0, col: 2, c: 2 },
    ])

    expect(result.stale).toBe(false)
    expect(result.placed).toHaveLength(3)
    expect(result.matched).toHaveLength(3)
    expect(result.floatingGroups).toHaveLength(0)
    expect(board.version).toBe(before + 1)
    expect(board.isClear()).toBe(true)
  })

  it("partitions floating bubbles into connected rigid groups", () => {
    const board = new Board(new Layout(390, 844))
    board.set(0, 0, 0)
    board.set(1, 0, 1)
    board.set(1, 1, 1)
    board.set(2, 1, 4)
    board.set(3, 1, 4)
    const before = board.version

    const result = board.resolveVolley(8, before, [{ row: 2, col: 0, c: 1 }])

    expect(result.matched).toHaveLength(3)
    expect(result.floatingGroups).toHaveLength(1)
    expect(result.floatingGroups[0].members).toHaveLength(2)
    expect(board.version).toBe(before + 1)
    expect(board.cell(0, 0)).toBe(0)
    expect(board.cell(2, 1)).toBeNull()
    expect(board.cell(3, 1)).toBeNull()
  })

  it("rejects a stale board revision without partial mutation", () => {
    const board = new Board(new Layout(390, 844))
    board.set(0, 0, 1)
    const version = board.version
    const result = board.resolveVolley(9, version - 1, [
      { row: 0, col: 1, c: 1 },
    ])

    expect(result.stale).toBe(true)
    expect(board.version).toBe(version)
    expect(board.cell(0, 1)).toBeNull()
  })
})

describe("BubbleShooterEngine lifecycle and volley transaction", () => {
  it("keeps a connected canvas locked in LOADING until activate", () => {
    const engine = new BubbleShooterEngine(fakeCanvas(true))
    const shoot = engine as unknown as { doShoot: () => void }

    expect(engine.phase).toBe("LOADING")
    shoot.doShoot()
    expect(engine.shots).toHaveLength(0)

    engine.activate()
    expect(engine.phase).toBe("READY")
    engine.destroy()
  })

  it("does not mutate the board when only part of an x3 volley has settled", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++
    engine.combo = 6
    engine.cur = 2
    const version = engine.board.version
    const shoot = engine as unknown as { doShoot: () => void }
    shoot.doShoot()

    expect(engine.phase).toBe("VOLLEY_FLYING")
    expect(engine.shots).toHaveLength(3)
    const first = engine.shots[0]
    first.settled = true
    first.row = 0
    first.col = 0
    first.x = engine.layout.worldX(0, 0, engine.board.gridParity)
    first.y = engine.layout.worldY(0)
    const transaction = engine as unknown as {
      snapReserved: Uint32Array
      reservedGeneration: number
    }
    transaction.snapReserved[0] = transaction.reservedGeneration
    engine.tick(1 / 240)
    expect(engine.shots.filter((shot) => shot.settled)).toHaveLength(1)
    expect(engine.board.version).toBe(version)

    for (
      let frame = 0;
      frame < 600 && engine.board.version === version;
      frame++
    )
      engine.tick(1 / 120)
    expect(engine.board.version).toBe(version + 1)
    expect(engine.shots).toHaveLength(0)
    expect(engine.blockingAnimations).toBeGreaterThan(0)
    expect(["RESOLVE_VOLLEY", "POPPING", "DROPPING"]).toContain(engine.phase)

    for (
      let frame = 0;
      frame < 600 && engine.phase !== "READY" && engine.phase !== "WIN";
      frame++
    )
      engine.tick(1 / 120)
    expect(["READY", "WIN"]).toContain(engine.phase)
    engine.destroy()
  })

  it("keeps POPPING and DROPPING locked until presentation completions arrive", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++
    engine.board.set(0, 0, 0)
    engine.board.set(1, 0, 1)
    engine.board.set(1, 1, 1)
    engine.board.set(2, 1, 4)
    engine.board.set(3, 1, 4)
    engine.board.set(3, 5, 4)
    engine.board.set(3, 6, 4)
    engine.actionId++
    const actionId = engine.actionId
    const version = engine.board.version
    engine.phase = "RESOLVE_VOLLEY"
    engine.shots = [
      {
        actionId,
        x: engine.layout.worldX(2, 0, engine.board.gridParity),
        y: engine.layout.worldY(2),
        vx: 0,
        vy: 0,
        c: 1,
        settled: true,
        row: 2,
        col: 0,
      },
    ]
    const transaction = engine as unknown as {
      activeBoardVersion: number
      resolveActiveVolley: () => void
    }
    transaction.activeBoardVersion = version
    transaction.resolveActiveVolley()

    expect(engine.board.version).toBe(version + 1)
    expect(engine.phase).toBe("POPPING")
    expect(engine.blockingAnimations).toBe(3)
    expect(engine.fx.commands.map((command) => command.kind).sort()).toEqual([
      "drop",
      "drop",
      "match",
    ])

    engine.tick(0.17)
    expect(engine.phase).toBe("DROPPING")
    expect(engine.blockingAnimations).toBe(2)

    engine.tick(0.6)
    expect(engine.phase).toBe("READY")
    expect(engine.blockingAnimations).toBe(0)
    engine.destroy()
  })

  it("freezes resolution while paused and resumes the same blocking command set", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++
    engine.board.set(0, 0, 0)
    engine.board.set(1, 0, 1)
    engine.board.set(1, 1, 1)
    engine.actionId++
    const actionId = engine.actionId
    const version = engine.board.version
    engine.phase = "RESOLVE_VOLLEY"
    engine.shots = [
      {
        actionId,
        x: engine.layout.worldX(2, 0, engine.board.gridParity),
        y: engine.layout.worldY(2),
        vx: 0,
        vy: 0,
        c: 1,
        settled: true,
        row: 2,
        col: 0,
      },
    ]
    const transaction = engine as unknown as {
      activeBoardVersion: number
      resolveActiveVolley: () => void
    }
    transaction.activeBoardVersion = version
    transaction.resolveActiveVolley()

    expect(engine.phase).toBe("POPPING")
    const blockers = engine.blockingAnimations
    const commands = engine.fx.commands.length

    engine.togglePause()
    engine.tick(1)
    expect(engine.phase).toBe("PAUSED")
    expect(engine.blockingAnimations).toBe(blockers)
    expect(engine.fx.commands.length).toBe(commands)

    engine.resume()
    engine.tick(0.2)
    expect(engine.phase).toBe("READY")
    expect(engine.blockingAnimations).toBe(0)
    engine.destroy()
  })

  it("uses only the danger line for LOSE, not exhausted moves", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 1
    engine.board.ids.length = 1
    engine.board.set(0, 0, 0)
    engine.moves = 0
    const checkEnd = engine as unknown as { checkEnd: () => void }

    checkEnd.checkEnd()
    expect(engine.phase).not.toBe("LOSE")

    engine.board.rows.length = engine.layout.DANGER_ROW + 1
    engine.board.ids.length = engine.layout.DANGER_ROW + 1
    engine.board.set(engine.layout.DANGER_ROW, 0, 0)
    checkEnd.checkEnd()
    expect(engine.phase).toBe("LOSE")
    engine.destroy()
  })

  it("recovers stale transaction and no-snap fallback without entering LOSE", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++
    engine.board.set(0, 0, 0)
    engine.actionId++
    engine.phase = "RESOLVE_VOLLEY"
    engine.shots = [
      {
        actionId: engine.actionId,
        x: engine.layout.worldX(0, 1, engine.board.gridParity),
        y: engine.layout.worldY(0),
        vx: 0,
        vy: 0,
        c: 1,
        settled: true,
        row: 0,
        col: 1,
      },
    ]
    const transaction = engine as unknown as {
      activeBoardVersion: number
      resolveActiveVolley: () => void
      abortVolleyWithoutPlacement: () => void
    }
    transaction.activeBoardVersion = engine.board.version - 1
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    transaction.resolveActiveVolley()
    error.mockRestore()
    expect(engine.phase).toBe("READY")
    expect(engine.phase).not.toBe("LOSE")

    engine.phase = "VOLLEY_FLYING"
    engine.shots = [
      {
        actionId: engine.actionId,
        x: engine.layout.SHOOTER_X,
        y: engine.layout.SHOOTER_Y,
        vx: 0,
        vy: 0,
        c: 1,
        settled: false,
        row: -1,
        col: -1,
      },
    ]
    transaction.abortVolleyWithoutPlacement()
    expect(engine.phase).not.toBe("LOSE")
    expect(["READY", "BOARD_DESCENDING", "WIN"]).toContain(engine.phase)
    engine.destroy()
  })
})
