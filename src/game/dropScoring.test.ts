import { describe, expect, it } from "vitest"
import { BubbleShooterEngine } from "./engine"
import { FEVER_SCORE_MULTIPLIER, PTS_DROP, PTS_POP } from "./config"

const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
}
;(globalThis as unknown as { window: typeof windowStub }).window = windowStub

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 390,
    height: 844,
    clientWidth: 390,
    clientHeight: 844,
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 390,
      height: 844,
      right: 390,
      bottom: 844,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  } as unknown as HTMLCanvasElement
}

describe("Floating Bubbles Drop & Scoring", () => {
  it("queues drop command to danger line and awards PTS_DROP per floating bubble", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++

    // Row 0: ceiling anchor (color 0)
    engine.board.set(0, 0, 0)
    // Row 1: match group of color 1
    engine.board.set(1, 0, 1)
    engine.board.set(1, 1, 1)
    // Row 2: bubble of color 3 attached under the match group -> will float and drop
    engine.board.set(2, 1, 3)

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
    const prevScore = engine.score
    transaction.resolveActiveVolley()

    expect(engine.phase).toBe("POPPING")
    const dropCommand = engine.fx.commands.find((c) => c.kind === "drop")
    expect(dropCommand).toBeDefined()
    expect(dropCommand?.kind).toBe("drop")

    if (dropCommand && dropCommand.kind === "drop") {
      expect(dropCommand.members).toHaveLength(1)
      expect(dropCommand.targetY).toBe(engine.layout.DANGER_Y)
      expect(dropCommand.pointsPerBubble).toBe(PTS_DROP)

      // Score increased by 3 popped bubbles (3 * PTS_POP) + 1 floating bubble (1 * PTS_DROP)
      const expectedScoreGain = 3 * PTS_POP + PTS_DROP
      expect(engine.score - prevScore).toBe(expectedScoreGain)
    }

    // Tick through POPPING (duration ~0.16)
    engine.tick(0.18)
    expect(engine.phase).toBe("DROPPING")

    // Tick through DROPPING (duration ~0.85)
    engine.tick(0.9)
    expect(engine.phase).toBe("READY")

    engine.destroy()
  })

  it("applies fever multiplier (2x) to floating bubble drop points during FEVER", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.board.rows.length = 0
    engine.board.ids.length = 0
    engine.board.version++

    // Set FEVER active
    const feverEngine = engine as unknown as {
      feverActive: boolean
      feverShots: number
      activeBoardVersion: number
      resolveActiveVolley: () => void
    }
    feverEngine.feverActive = true
    feverEngine.feverShots = 3

    engine.board.set(0, 0, 0)
    engine.board.set(1, 0, 1)
    engine.board.set(1, 1, 1)
    engine.board.set(2, 1, 4)

    engine.actionId++
    engine.phase = "RESOLVE_VOLLEY"
    engine.shots = [
      {
        actionId: engine.actionId,
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

    const prevScore = engine.score
    feverEngine.activeBoardVersion = engine.board.version
    feverEngine.resolveActiveVolley()

    const dropCommand = engine.fx.commands.find((c) => c.kind === "drop")
    expect(dropCommand).toBeDefined()
    if (dropCommand && dropCommand.kind === "drop") {
      expect(dropCommand.pointsPerBubble).toBe(
        PTS_DROP * FEVER_SCORE_MULTIPLIER,
      )
      // Fever multiplier doubles both pop and drop scores: (3 * 10 + 20) * 2 = 100
      const expectedScoreGain =
        (3 * PTS_POP + PTS_DROP) * FEVER_SCORE_MULTIPLIER
      expect(engine.score - prevScore).toBe(expectedScoreGain)
    }

    engine.destroy()
  })
})
