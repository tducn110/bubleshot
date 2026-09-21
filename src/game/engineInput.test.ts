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

  it("cancels shot when pointer is released in the cancel zone below shooter", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.activate()
    const input = engine as unknown as {
      isAiming: boolean
      onDown: (event: PointerEvent) => void
      onMove: (event: PointerEvent) => void
      onUp: (event: PointerEvent) => void
    }

    // Aim started above
    input.onDown(pointer(1))
    expect(input.isAiming).toBe(true)

    // Dragged below shooter Y (~710)
    input.onMove({
      pointerId: 1,
      pointerType: "touch",
      clientX: 195,
      clientY: 780,
      preventDefault: () => {},
    } as PointerEvent)

    // Releasing in cancel zone cancels the shot
    input.onUp({
      pointerId: 1,
      pointerType: "touch",
      clientX: 195,
      clientY: 780,
      preventDefault: () => {},
    } as PointerEvent)

    expect(engine.phase).toBe("READY")
    expect(engine.shots).toHaveLength(0)
    expect(engine.traj).toHaveLength(0)
    engine.destroy()
  })

  it("clamps aim angle so shots always fly strictly upward", () => {
    const engine = new BubbleShooterEngine(fakeCanvas())
    engine.activate()
    const aimAngleFor = (engine as unknown as {
      aimAngleFor: (x: number, y: number) => number
    }).aimAngleFor.bind(engine)

    // Straight up
    expect(aimAngleFor(195, 200)).toBeCloseTo(0, 2)

    // Far right horizontal
    const rightAngle = aimAngleFor(500, 710)
    expect(rightAngle).toBeLessThanOrEqual(Math.PI * 0.42)
    expect(rightAngle).toBeGreaterThan(0)
    expect(-Math.cos(rightAngle)).toBeLessThan(0) // upward vy

    // Far left horizontal
    const leftAngle = aimAngleFor(0, 710)
    expect(leftAngle).toBeGreaterThanOrEqual(-Math.PI * 0.42)
    expect(leftAngle).toBeLessThan(0)
    expect(-Math.cos(leftAngle)).toBeLessThan(0) // upward vy

    engine.destroy()
  })
})
