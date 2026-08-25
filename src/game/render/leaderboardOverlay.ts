import {
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type TextStyleFontWeight,
  type Texture,
} from "pixi.js"
import type { GameView } from "../types"
import {
  DEMO_LEADERBOARD_DATA,
  formatLeaderboardRank,
  formatLeaderboardScore,
  leaderboardLayout,
  rankTone,
  topLeaderboardEntries,
  truncateLeaderboardName,
  type LeaderboardData,
  type LeaderboardEntry,
  type RankTone,
} from "../leaderboard"
import type { GameTextures } from "./textures"
import { GAME_FONT_STACK } from "./typography"

const C = {
  bg: 0xfaf7ff,
  frame: 0xfffbff,
  white: 0xffffff,
  purple: 0x5524bd,
  dark: "#24105e",
  text: "#4f2bb1",
  muted: "#7769a8",
  border: 0xd7b9ff,
  gold: 0xffc52f,
  silver: 0xb7c4df,
  bronze: 0xd9895b,
} as const
const TONES: Record<RankTone, number> = {
  gold: C.gold,
  silver: C.silver,
  bronze: C.bronze,
  plain: C.border,
}

function label(
  value: string,
  size: number,
  weight: number,
  fill: string,
  anchor: 0 | 0.5 | 1 = 0,
) {
  return new Text({
    text: value,
    style: {
      fontFamily: GAME_FONT_STACK,
      fontSize: size,
      fontWeight: weight as unknown as TextStyleFontWeight,
      fill,
    },
    anchor: { x: anchor, y: 0.5 },
  })
}
function rounded(
  g: Graphics,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1,
  border?: number,
  borderAlpha = 0,
) {
  g.clear().roundRect(0, 0, w, h, r).fill({ color, alpha })
  if (border !== undefined && borderAlpha > 0)
    g.stroke({ color: border, alpha: borderAlpha, width: 1 })
}

interface Avatar {
  readonly root: Container
  setSource(source?: string | null): void
  layout(
    size: number,
    background: number,
    iconTint: number,
    border: number,
  ): void
  dispose(): void
}
function avatar(textures: GameTextures, name: string): Avatar {
  const root = new Container({ label: name })
  const fill = new Graphics({ label: `${name}Background` })
  const mask = new Graphics({ label: `${name}Mask` })
  const fallback = new Sprite({
    texture: textures.icons.userRound,
    anchor: 0.5,
    label: `${name}Fallback`,
  })
  let picture: Sprite | null = null
  let source: string | null = null
  let request = 0
  let size = 24
  root.addChild(fill, fallback, mask)
  mask.renderable = false
  const draw = (bg: number, tint: number, border: number) => {
    fill
      .clear()
      .circle(0, 0, size / 2)
      .fill({ color: bg })
      .stroke({ color: border, alpha: 0.45, width: 1 })
    mask
      .clear()
      .circle(0, 0, size / 2)
      .fill({ color: 0xffffff })
    fallback.width = size * 0.54
    fallback.height = size * 0.54
    fallback.tint = tint
    fallback.position.set(0, 0)
    if (picture) {
      picture.width = size
      picture.height = size
      picture.position.set(0, 0)
    }
  }
  return {
    root,
    setSource(next) {
      const clean = next?.trim() || null
      if (clean === source) return
      source = clean
      const id = ++request
      fallback.visible = !clean
      if (!clean) {
        picture?.destroy()
        picture = null
        return
      }
      void Assets.load<Texture>(clean)
        .then((texture) => {
          if (id !== request) return
          picture?.destroy()
          picture = new Sprite({
            texture,
            anchor: 0.5,
            label: `${name}Image`,
            mask,
          })
          root.addChildAt(picture, 1)
          fallback.visible = false
          draw(C.purple, 0xffffff, C.border)
        })
        .catch(() => {
          if (id === request) fallback.visible = true
        })
    },
    layout(next, bg, tint, border) {
      size = Math.max(12, next)
      draw(bg, tint, border)
    },
    dispose() {
      request += 1
      picture?.destroy()
      picture = null
    },
  }
}

function backButton(texture: Texture, consume: () => void, onBack: () => void) {
  const root = new Container({ label: "LeaderboardBackButton" })
  const fill = new Graphics({ label: "LeaderboardBackButtonBackground" })
  const icon = new Sprite({
    texture,
    anchor: 0.5,
    label: "LeaderboardBackIcon",
  })
  root.addChild(fill, icon)
  root.eventMode = "static"
  root.cursor = "pointer"
  root.on("pointerdown", consume)
  root.on("pointertap", () => {
    consume()
    onBack()
  })
  return {
    root,
    layout(size: number) {
      rounded(fill, size, size, size * 0.28, C.purple, 1)
      icon.width = size * 0.52
      icon.height = size * 0.52
      icon.position.set(size / 2, size / 2)
      root.hitArea = new Rectangle(0, 0, size, size)
    },
  }
}

interface Podium {
  readonly root: Container
  readonly avatar: Avatar
  readonly name: Text
  readonly score: Text
  setEntry(entry: LeaderboardEntry): void
  layout(w: number, h: number, compact: boolean): void
  dispose(): void
}
function podium(entry: LeaderboardEntry, textures: GameTextures): Podium {
  const root = new Container({ label: `LeaderboardPodiumRank${entry.rank}` })
  const fill = new Graphics({ label: `PodiumRank${entry.rank}Background` })
  const badge = new Graphics({ label: `PodiumRank${entry.rank}Badge` })
  const rank = label(String(entry.rank), 16, 800, "#ffffff", 0.5)
  const av = avatar(textures, `PodiumRank${entry.rank}Avatar`)
  const name = label("", 12, 700, C.dark, 0.5)
  const score = label("", 15, 800, C.text, 0.5)
  root.addChild(fill, badge, rank, av.root, name, score)
  const result: Podium = {
    root,
    avatar: av,
    name,
    score,
    setEntry(next) {
      entry = next
      rank.text = String(next.rank)
      name.text = truncateLeaderboardName(next.name, 12)
      score.text = formatLeaderboardScore(next.score)
      av.setSource(next.avatar)
      rank.style.fill = next.rank === 1 ? "#6a3a00" : "#ffffff"
    },
    layout(w, h, compact) {
      const tone = rankTone(entry.rank)
      const badgeW = Math.min(54, w * 0.42)
      const badgeH = compact ? 22 : 30
      rounded(fill, w, h, compact ? 12 : 20, C.white, 0.98, TONES[tone], 0.72)
      rounded(badge, badgeW, badgeH, 7, TONES[tone], 1)
      badge.position.set((w - badgeW) / 2, -badgeH * 0.26)
      rank.style.fontSize = compact ? 13 : 17
      rank.position.set(w / 2, badge.position.y + badgeH / 2)
      const avSize = Math.min(w * 0.54, compact ? 46 : 74)
      av.root.position.set(w / 2, h * (compact ? 0.4 : 0.43))
      av.layout(avSize, TONES[tone], 0xffffff, TONES[tone])
      name.style.fontSize = compact ? 9 : 12
      name.position.set(w / 2, h * 0.69)
      score.style.fontSize = compact ? 11 : 16
      score.position.set(w / 2, h * 0.86)
    },
    dispose() {
      av.dispose()
      root.destroy({ children: true })
    },
  }
  result.setEntry(entry)
  return result
}

interface Row {
  readonly root: Container
  readonly avatar: Avatar
  readonly name: Text
  readonly score: Text
  entry: LeaderboardEntry
  layout(w: number, h: number, compact: boolean): void
  dispose(): void
}
function row(entry: LeaderboardEntry, textures: GameTextures): Row {
  const root = new Container({ label: `LeaderboardRow${entry.rank}` })
  const bg = new Graphics({ label: `LeaderboardRow${entry.rank}Background` })
  const rank = label(String(entry.rank), 13, 800, C.text, 0.5)
  const av = avatar(textures, `LeaderboardRow${entry.rank}Avatar`)
  const name = label(truncateLeaderboardName(entry.name, 18), 12, 700, C.dark)
  const score = label(formatLeaderboardScore(entry.score), 12, 800, C.text, 1)
  root.addChild(bg, rank, av.root, name, score)
  return {
    root,
    avatar: av,
    name,
    score,
    entry,
    layout(w, h, compact) {
      rounded(bg, w, h, Math.min(14, h / 2), C.white, 0.94, C.border, 0.42)
      const s = Math.max(16, Math.min(h - 4, compact ? 24 : 34))
      rank.style.fontSize = compact ? 10 : 13
      rank.position.set(compact ? 18 : 25, h / 2)
      av.root.position.set(compact ? 47 : 68, h / 2)
      av.layout(s, 0xe6d8ff, 0xffffff, C.border)
      name.style.fontSize = compact ? 9 : 12
      name.position.set(compact ? 66 : 92, h / 2)
      score.style.fontSize = compact ? 9 : 12
      score.position.set(w - (compact ? 8 : 14), h / 2)
    },
    dispose() {
      av.dispose()
      root.destroy({ children: true })
    },
  }
}

export class LeaderboardOverlay {
  readonly root = new Container({ label: "LeaderboardScene" })
  private readonly background = new Sprite({
    label: "LeaderboardBackgroundArtwork",
  })
  private readonly content = new Container({ label: "LeaderboardSceneContent" })
  private readonly back
  private readonly trophyBadge = new Graphics({
    label: "LeaderboardTrophyBadge",
  })
  private readonly trophy = new Sprite({
    anchor: 0.5,
    label: "LeaderboardTrophyIcon",
  })
  private readonly title = label("BẢNG XẾP HẠNG", 22, 800, C.text, 0.5)
  private readonly subtitle = label("TOP 10 CAO THỦ", 11, 700, C.muted, 0.5)
  private readonly frame = new Container({ label: "LeaderboardContentFrame" })
  private readonly frameFill = new Graphics({
    label: "LeaderboardContentFrameBackground",
  })
  private readonly podiumRoot = new Container({ label: "LeaderboardPodium" })
  private readonly rowsRoot = new Container({ label: "LeaderboardRows4To10" })
  private readonly current = new Container({
    label: "LeaderboardCurrentPlayerCard",
  })
  private readonly currentFill = new Graphics({
    label: "LeaderboardCurrentPlayerBackground",
  })
  private readonly currentAvatar: Avatar
  private readonly currentName = label("BẠN", 15, 800, C.text)
  private readonly currentScore = label("0", 22, 800, C.text)
  private readonly currentRankLabel = label("HẠNG", 10, 700, C.muted, 0.5)
  private readonly currentRank = label("—", 24, 800, C.text, 0.5)
  private readonly textures: GameTextures
  private cards: Podium[] = []
  private rows: Row[] = []
  private data: LeaderboardData
  private lastView: GameView | null = null
  private openState = false
  private currentNameLimit = 18
  constructor(
    parent: Container,
    textures: GameTextures,
    consume: () => void,
    onBack: () => void,
    data: LeaderboardData = DEMO_LEADERBOARD_DATA,
  ) {
    this.data = data
    this.textures = textures
    this.root.zIndex = 100
    this.root.visible = false
    this.root.eventMode = "static"
    this.background.eventMode = "static"
    this.background.on("pointerdown", consume)
    this.back = backButton(textures.icons.arrowLeft, consume, onBack)
    this.background.texture = textures.background
    this.background.anchor.set(0.5)
    this.trophy.texture = textures.icons.trophy
    this.trophy.tint = C.purple
    this.currentAvatar = avatar(textures, "LeaderboardCurrentAvatar")
    this.current.addChild(
      this.currentFill,
      this.currentAvatar.root,
      this.currentName,
      this.currentScore,
      this.currentRankLabel,
      this.currentRank,
    )
    this.frame.addChild(
      this.frameFill,
      this.podiumRoot,
      this.rowsRoot,
      this.current,
    )
    this.content.addChild(
      this.back.root,
      this.trophyBadge,
      this.trophy,
      this.title,
      this.subtitle,
      this.frame,
    )
    this.root.addChild(this.background, this.content)
    parent.addChild(this.root)
    this.replaceRows(data.entries)
  }
  get isOpen() {
    return this.openState
  }
  open() {
    this.openState = true
    this.root.visible = true
  }
  close() {
    this.openState = false
    this.root.visible = false
  }
  setData(data: LeaderboardData) {
    this.data = data
    this.replaceRows(data.entries)
  }
  private replaceRows(entries: readonly LeaderboardEntry[]) {
    for (const c of this.cards) c.dispose()
    for (const r of this.rows) r.dispose()
    this.cards = []
    this.rows = []
    const top = topLeaderboardEntries(entries)
    const byRank = new Map(top.map((e) => [e.rank, e]))
    for (const n of [2, 1, 3]) {
      const e = byRank.get(n)
      if (e) this.cards.push(podium(e, this.textures))
    }
    this.podiumRoot.addChild(...this.cards.map((c) => c.root))
    this.rows = top.filter((e) => e.rank > 3).map((e) => row(e, this.textures))
    this.rowsRoot.addChild(...this.rows.map((r) => r.root))
    if (this.lastView) this.relayout(this.lastView)
  }
  dispose() {
    for (const c of this.cards) c.dispose()
    for (const r of this.rows) r.dispose()
    this.currentAvatar.dispose()
  }
  relayout(view: GameView) {
    this.lastView = view
    const l = view.layout
    const layout = leaderboardLayout(
      l.LW,
      l.LH,
      this.rows.length + this.cards.length,
    )
    const cx = l.LW / 2
    const compact = layout.compact
    const coverScale = Math.max(
      l.LW / this.background.texture.width,
      l.LH / this.background.texture.height,
    )
    this.background.scale.set(coverScale)
    this.background.position.set(cx, l.LH / 2)
    this.background.alpha = 0.96
    this.back.root.position.set(layout.currentX, layout.headerTop)
    this.back.layout(compact ? 32 : 42)
    const badgeSize = compact ? 34 : 50
    const badgeY = layout.headerTop + badgeSize / 2
    this.trophyBadge
      .clear()
      .circle(cx, badgeY, badgeSize / 2)
      .fill({ color: C.white })
      .stroke({ color: C.border, alpha: 0.9, width: 1 })
    this.trophy.width = compact ? 18 : 28
    this.trophy.height = compact ? 18 : 28
    this.trophy.position.set(cx, badgeY)
    this.title.style.fontSize = compact ? 16 : 22
    this.title.position.set(cx, layout.headerTop + (compact ? 48 : 70))
    this.subtitle.visible = !compact
    this.subtitle.position.set(cx, layout.headerTop + 100)
    this.layoutCurrent(layout)
    this.frame.position.set(layout.frameX, layout.frameY)
    rounded(
      this.frameFill,
      layout.frameWidth,
      layout.frameHeight,
      compact ? 18 : 28,
      C.frame,
      compact ? 0.88 : 0.9,
      C.border,
      0.5,
    )
    this.podiumRoot.position.set(0, layout.podiumY - layout.frameY)
    this.cards.forEach((card, i) => {
      const x =
        i * (layout.podiumCardWidth + layout.podiumGap) + layout.podiumGap
      card.root.position.set(x, (compact ? 14 : 26) + (i === 1 ? -12 : 10))
      card.layout(
        layout.podiumCardWidth,
        layout.podiumCardHeight - (i === 1 ? 0 : 10),
        compact,
      )
    })
    this.rowsRoot.position.set(0, layout.rowsY - layout.frameY)
    this.rows.forEach((r, i) => {
      r.root.position.set(0, i * (layout.rowHeight + layout.rowGap))
      r.layout(layout.rowsWidth, layout.rowHeight, compact)
    })
  }
  private layoutCurrent(l: ReturnType<typeof leaderboardLayout>) {
    const compact = l.compact
    this.current.position.set(0, l.currentY - l.frameY)
    rounded(
      this.currentFill,
      l.currentWidth,
      l.currentHeight,
      compact ? 16 : 24,
      C.frame,
      0,
      C.border,
      0.72,
    )
    this.current.hitArea = new Rectangle(0, 0, l.currentWidth, l.currentHeight)
    const s = l.currentAvatarSize
    this.currentAvatar.root.position.set(
      l.currentPadding + s / 2,
      l.currentHeight / 2,
    )
    this.currentAvatar.layout(s, C.purple, 0xffffff, C.purple)
    const infoFontSize = compact ? 11 : 15
    this.currentNameLimit = Math.max(
      6,
      Math.min(18, Math.floor(l.currentInfoWidth / (infoFontSize * 0.58))),
    )
    this.currentName.style.fontSize = compact ? 11 : 15
    this.currentName.position.set(l.currentInfoX, l.currentHeight * 0.34)
    this.currentScore.style.fontSize = compact ? 16 : 22
    this.currentScore.position.set(l.currentInfoX, l.currentHeight * 0.68)
    this.currentRankLabel.style.fontSize = compact ? 8 : 10
    this.currentRankLabel.position.set(
      l.currentRankX + l.currentRankWidth / 2,
      l.currentHeight * 0.3,
    )
    this.currentRank.style.fontSize = compact ? 16 : 24
    this.currentRank.position.set(
      l.currentRankX + l.currentRankWidth / 2,
      l.currentHeight * 0.66,
    )
  }
  sync(view: GameView) {
    const p = this.data.currentPlayer
    this.currentName.text = truncateLeaderboardName(
      p?.name || "BẠN",
      this.currentNameLimit,
    )
    this.currentScore.text = formatLeaderboardScore(view.score)
    this.currentRank.text = formatLeaderboardRank(p?.rank)
    this.currentAvatar.setSource(p?.avatar)
  }
}
