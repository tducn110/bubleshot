import { describe, expect, it } from "vitest"
import { BubbleShooterEngine } from "./engine"

const windowStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
}
;(globalThis as unknown as { window: typeof windowStub }).window = windowStub

function fakeCanvas(): HTMLCanvasElement {
  return {
    isConnected: true,
    clientWidth: 390,
    clientHeight: 844,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 390,
      height: 844,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  } as unknown as HTMLCanvasElement
}

function pointer(pointerId: number) {
  return {
    pointerId,
    pointerType: "touch",
    clientX: 195,
    clientY: 300,
    preventDefault: () => {},
  } as PointerEvent
}

describe("BubbleShooterEngine aim input", () => {
  it("fires only when the pointer that started the aim gesture is released", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.activate()
    const input = engine as unknown as {
      onDown: (event: PointerEvent) => void
      onUp: (event: PointerEvent) => void
    }

    input.onDown(pointer(1))
    input.onUp(pointer(2))

    expect(engine.phase).toBe("READY")
    expect(engine.shots).toHaveLength(0)

    input.onUp(pointer(1))

    expect(engine.phase).toBe("VOLLEY_FLYING")
    expect(engine.shots).toHaveLength(1)
    engine.destroy()
  })
})
