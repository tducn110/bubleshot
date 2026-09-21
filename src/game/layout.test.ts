import { describe, expect, it } from "vitest"
import { Layout } from "./layout"

const VIEWPORTS = [
  [320, 568],
  [360, 800],
  [390, 844],
  [412, 915],
  [844, 390],
  [915, 412],
  [768, 1024],
  [1440, 900],
] as const

describe("compact HUD layout", () => {
  it.each(VIEWPORTS)(
    "keeps HUD controls contained at %dx%d",
    (width, height) => {
      const layout = new Layout(width, height)
      const { hud, hudRect } = layout

      expect(hudRect.x).toBeGreaterThanOrEqual(0)
      expect(hudRect.x + hudRect.width).toBeLessThanOrEqual(width)
      expect(hudRect.y).toBeGreaterThanOrEqual(0)
      expect(hudRect.y + hudRect.height).toBeLessThanOrEqual(height)
      expect(hud.scoreRect.x + hud.scoreRect.width).toBeLessThanOrEqual(
        hud.dashboardRect.x,
      )
      expect(hud.dashboardRect.x + hud.dashboardRect.width).toBeLessThanOrEqual(
        hud.pauseRect.x,
      )
      expect(hud.pauseRect.x + hud.pauseRect.width).toBeLessThanOrEqual(
        hudRect.x + hudRect.width,
      )
    },
  )

  it("meets the compact portrait target at 390x844", () => {
    const layout = new Layout(390, 844)

    expect(layout.hudRect.height).toBeGreaterThanOrEqual(55)
    expect(layout.hudRect.height).toBeLessThanOrEqual(64)
    expect(layout.hudRect.height / (layout.R * 2)).toBeGreaterThan(1.4)
    expect(layout.hudRect.height / (layout.R * 2)).toBeLessThan(1.65)
    expect(layout.DANGER_ROW).toBeGreaterThan(10)
    expect(layout.shooterTop - layout.DANGER_Y).toBeCloseTo(layout.R * 2.4, 4)
    expect(layout.DANGER_Y).toBeLessThan(layout.SHOOTER_Y - layout.R * 2)
  })

  it("keeps landscape HUD compact without changing the gameplay lead-in", () => {
    const layout = new Layout(844, 390)
    const expectedGameplayTop =
      layout.hudTop +
      Math.max(76, Math.min(84, 390 * 0.095)) +
      Math.max(8, Math.min(12, 390 * 0.012))

    expect(layout.hudRect.height).toBeLessThan(50)
    expect(layout.hud.dashboardRect.width).toBeLessThanOrEqual(30)
    expect(layout.gameplayRect.y).toBeCloseTo(expectedGameplayTop)
  })
})
