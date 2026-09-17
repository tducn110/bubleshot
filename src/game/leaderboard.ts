import i18n from "../i18n"

export interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  avatar?: string | null
}

export interface CurrentPlayer {
  name?: string
  score: number
  rank?: number | null
  avatar?: string | null
}

export interface LeaderboardData {
  entries: readonly LeaderboardEntry[]
  currentPlayer?: CurrentPlayer | null
}

/** Public data/callback shape for a future React or Wink adapter. */
export interface LeaderboardScreenProps extends LeaderboardData {
  onBack: () => void
}

/**
 * Local presentation data until a Wink leaderboard provider is available.
 * Keeping this as data rather than constructing rows in the renderer makes
 * the future provider replacement a one-file integration change.
 */
export const DEMO_LEADERBOARD_ENTRIES: readonly LeaderboardEntry[] = [
  { rank: 1, name: "PLAYER_01", score: 32780, avatar: null },
  { rank: 2, name: "PLAYER_02", score: 30120, avatar: null },
  { rank: 3, name: "PLAYER_03", score: 28760, avatar: null },
  { rank: 4, name: "PLAYER_04", score: 26440, avatar: null },
  { rank: 5, name: "PLAYER_05", score: 24990, avatar: null },
  { rank: 6, name: "PLAYER_06", score: 23310, avatar: null },
  { rank: 7, name: "PLAYER_07", score: 21880, avatar: null },
  { rank: 8, name: "PLAYER_08", score: 20240, avatar: null },
  { rank: 9, name: "PLAYER_09", score: 19100, avatar: null },
  { rank: 10, name: "PLAYER_10", score: 17650, avatar: null },
]

export const DEMO_LEADERBOARD_DATA: LeaderboardData = {
  entries: DEMO_LEADERBOARD_ENTRIES,
  currentPlayer: { name: i18n.t("leaderboard.you", "YOU"), score: 0, rank: null, avatar: null },
}

export function topLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
  limit = 10,
): LeaderboardEntry[] {
  return entries.slice(0, Math.max(0, Math.floor(limit)))
}

export function formatLeaderboardScore(score: number): string {
  return new Intl.NumberFormat("vi-VN").format(
    Math.max(0, Math.floor(Number.isFinite(score) ? score : 0)),
  )
}

export function formatLeaderboardRank(rank?: number | null): string {
  return rank == null || !Number.isFinite(rank) ? "—" : String(rank)
}

export function truncateLeaderboardName(
  name: string | undefined,
  maxCharacters = 18,
): string {
  const safeName = name?.trim() || i18n.t("leaderboard.anonymous", "ANONYMOUS")
  const limit = Math.max(2, Math.floor(maxCharacters))
  return safeName.length > limit ? `${safeName.slice(0, limit - 1)}…` : safeName
}

export type RankTone = "gold" | "silver" | "bronze" | "plain"

export function rankTone(rank: number): RankTone {
  if (rank === 1) return "gold"
  if (rank === 2) return "silver"
  if (rank === 3) return "bronze"
  return "plain"
}

export interface LeaderboardLayout {
  width: number
  height: number
  currentX: number
  currentY: number
  currentWidth: number
  currentHeight: number
  currentPadding: number
  currentAvatarSize: number
  currentInfoX: number
  currentInfoWidth: number
  currentRankX: number
  currentRankWidth: number
  frameX: number
  frameY: number
  frameWidth: number
  frameHeight: number
  framePadding: number
  rowsHeight: number
  podiumX: number
  podiumY: number
  podiumWidth: number
  podiumHeight: number
  podiumGap: number
  podiumCardWidth: number
  podiumCardHeight: number
  rowsX: number
  rowsY: number
  rowsWidth: number
  rowHeight: number
  rowGap: number
  rowCount: number
  contentBottom: number
  headerTop: number
  headerHeight: number
  compact: boolean
}

/**
 * One geometry function keeps the reference composition in a single scene:
 * header, current-player card, three-card podium, then rows 4-10. It scales
 * down in short viewports so the complete leaderboard remains visible.
 */
export function leaderboardLayout(
  width: number,
  height: number,
  entryCount = 10,
): LeaderboardLayout {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const compact = h < 620 || w > h
  const sideMargin = compact
    ? Math.max(10, Math.round(w * 0.045))
    : Math.max(14, Math.round(w * 0.055))
  const contentWidth = Math.min(640, Math.max(1, w - sideMargin * 2))
  const contentX = Math.round((w - contentWidth) / 2)
  const headerTop = compact ? 7 : Math.max(12, Math.min(22, h * 0.026))
  const headerHeight = compact ? 58 : Math.min(132, Math.max(98, h * 0.145))
  const gap = compact ? 6 : Math.max(8, Math.round(h * 0.012))
  const podiumY = headerTop + headerHeight + gap
  const podiumHeight = compact ? 92 : Math.min(286, Math.max(210, h * 0.305))
  const podiumGap = compact ? 5 : Math.max(7, Math.round(contentWidth * 0.018))
  const podiumCardWidth = Math.floor((contentWidth - podiumGap * 4) / 3)
  const podiumCardHeight = podiumHeight - (compact ? 16 : 24)
  const rowsY = podiumY + podiumHeight + gap
  const rowCount = Math.max(
    0,
    Math.min(7, entryCount - Math.min(3, entryCount)),
  )
  const rowGap = compact ? 2 : 3
  const currentHeight = compact ? 44 : Math.min(88, Math.max(72, h * 0.095))
  const currentPadding = compact
    ? 8
    : Math.max(12, Math.min(18, Math.round(contentWidth * 0.04)))
  const currentAvatarSize = compact
    ? Math.min(28, currentHeight - currentPadding * 2)
    : Math.min(56, currentHeight - currentPadding * 2)
  const currentRankWidth = compact
    ? Math.max(52, Math.min(64, Math.round(contentWidth * 0.2)))
    : Math.max(72, Math.min(96, Math.round(contentWidth * 0.22)))
  const currentRankX = contentWidth - currentPadding - currentRankWidth
  const currentInfoX = currentPadding + currentAvatarSize + (compact ? 8 : 12)
  const currentInfoWidth = Math.max(
    24,
    currentRankX - currentInfoX - (compact ? 8 : 12),
  )
  const availableRowsHeight = Math.max(
    1,
    h - rowsY - gap - currentHeight - Math.max(8, sideMargin),
  )
  const rowHeight = Math.max(
    16,
    Math.min(
      compact ? 22 : 42,
      Math.floor(
        (availableRowsHeight - rowGap * Math.max(0, rowCount - 1)) /
          Math.max(1, rowCount),
      ),
    ),
  )
  const rowsHeight =
    rowCount > 0 ? rowCount * rowHeight + (rowCount - 1) * rowGap : 0
  const framePadding = compact
    ? 8
    : Math.max(12, Math.round(contentWidth * 0.035))
  const frameY = podiumY - framePadding
  const currentY = rowsY + rowsHeight + gap
  const frameHeight = currentY + currentHeight + framePadding - frameY

  return {
    width: w,
    height: h,
    currentX: contentX,
    currentY,
    currentWidth: contentWidth,
    currentHeight,
    currentPadding,
    currentAvatarSize,
    currentInfoX,
    currentInfoWidth,
    currentRankX,
    currentRankWidth,
    frameX: contentX,
    frameY,
    frameWidth: contentWidth,
    frameHeight,
    framePadding,
    rowsHeight,
    podiumX: contentX,
    podiumY,
    podiumWidth: contentWidth,
    podiumHeight,
    podiumGap,
    podiumCardWidth,
    podiumCardHeight,
    rowsX: contentX,
    rowsY,
    rowsWidth: contentWidth,
    rowHeight,
    rowGap,
    rowCount,
    contentBottom: currentY + currentHeight,
    headerTop,
    headerHeight,
    compact,
  }
}
