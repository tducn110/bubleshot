import { describe, expect, it } from "vitest"
import {
  DEMO_LEADERBOARD_ENTRIES,
  formatLeaderboardRank,
  formatLeaderboardScore,
  leaderboardLayout,
  rankTone,
  topLeaderboardEntries,
  truncateLeaderboardName,
} from "./leaderboard"

const VIEWPORTS = [
  [360, 800],
  [390, 844],
  [412, 915],
  [844, 390],
  [768, 1024],
  [1440, 900],
] as const

describe("leaderboard data helpers", () => {
  it("keeps the list data-driven and caps the rendered list at Top 10", () => {
    expect(topLeaderboardEntries(DEMO_LEADERBOARD_ENTRIES)).toHaveLength(10)
    expect(topLeaderboardEntries(DEMO_LEADERBOARD_ENTRIES, 3)).toEqual(
      DEMO_LEADERBOARD_ENTRIES.slice(0, 3),
    )
  })

  it("uses Vietnamese score formatting and never invents an unknown rank", () => {
    expect(formatLeaderboardScore(32780)).toBe("32.780")
    expect(formatLeaderboardRank(null)).toBe("—")
    expect(formatLeaderboardRank(undefined)).toBe("—")
  })

  it("ellipsizes long player names instead of allowing them to clip the score", () => {
    expect(truncateLeaderboardName("A_PLAYER_WITH_A_VERY_LONG_NAME", 12)).toBe(
      "A_PLAYER_WI…",
    )
  })

  it("keeps special rank treatment limited to the top three", () => {
    expect(rankTone(1)).toBe("gold")
    expect(rankTone(2)).toBe("silver")
    expect(rankTone(3)).toBe("bronze")
    expect(rankTone(4)).toBe("plain")
    expect(rankTone(10)).toBe("plain")
  })
})

describe("leaderboard layout", () => {
  it.each(VIEWPORTS)(
    "keeps Top 10 and the current-player card inside %dx%d",
    (width, height) => {
      const layout = leaderboardLayout(width, height, 10)

      expect(layout.podiumX).toBeGreaterThanOrEqual(0)
      expect(layout.podiumX + layout.podiumWidth).toBeLessThanOrEqual(width)
      expect(layout.podiumY).toBeGreaterThanOrEqual(0)
      expect(layout.rowsY).toBeGreaterThan(layout.podiumY + layout.podiumHeight)
      expect(layout.currentY).toBeGreaterThan(layout.rowsY)
      expect(layout.frameX).toBeGreaterThanOrEqual(0)
      expect(layout.frameY).toBeGreaterThanOrEqual(0)
      expect(layout.frameX + layout.frameWidth).toBeLessThanOrEqual(width)
      expect(layout.frameY + layout.frameHeight).toBeLessThanOrEqual(height)
      expect(layout.podiumY).toBeGreaterThan(layout.frameY)
      expect(layout.currentY + layout.currentHeight).toBeLessThan(
        layout.frameY + layout.frameHeight,
      )
      expect(layout.currentX + layout.currentWidth).toBeLessThanOrEqual(width)
      expect(layout.currentY + layout.currentHeight).toBeLessThanOrEqual(height)
      expect(layout.currentInfoX).toBeGreaterThan(layout.currentPadding)
      expect(layout.currentInfoX + layout.currentInfoWidth).toBeLessThanOrEqual(
        layout.currentRankX,
      )
      expect(layout.currentRankX + layout.currentRankWidth).toBeLessThanOrEqual(
        layout.currentWidth - layout.currentPadding,
      )
      expect(
        layout.currentAvatarSize + layout.currentPadding * 2,
      ).toBeLessThanOrEqual(layout.currentHeight)
    },
  )
})
