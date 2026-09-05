import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  ArrowLeft,
  AlertTriangle,
  Bomb,
  Languages,
  Medal,
  Music,
  Pause,
  Play,
  Rainbow,
  RotateCcw,
  Rows3,
  Trophy,
  UserRound,
  Vibrate,
  Volume2,
  VolumeX,
  type LucideIcon,
  Waypoints,
} from "lucide-react"
import { Assets, Texture } from "pixi.js"

/**
 * Standard UI icons have one source of truth: the Lucide component itself.
 * Pixi cannot mount a React SVG component, so the component is serialized to
 * an SVG data URI once and loaded as a cached texture. No icon geometry is
 * recreated with Pixi Graphics here.
 */
export type PixiIconName = "arrowLeft" | "alertTriangle" | "bomb" | "languages" | "medal" | "trophy" | "userRound" | "pause" | "play" | "rainbow" | "rotateCcw" | "rows3" | "music" | "volume" | "volumeX" | "vibration" | "waypoints"

const ICON_SIZE = 64

const ICON_COMPONENTS: Record<PixiIconName, LucideIcon> = {
  arrowLeft: ArrowLeft,
  alertTriangle: AlertTriangle,
  bomb: Bomb,
  languages: Languages,
  medal: Medal,
  trophy: Trophy,
  userRound: UserRound,
  pause: Pause,
  play: Play,
  rainbow: Rainbow,
  music: Music,
  volume: Volume2,
  volumeX: VolumeX,
  vibration: Vibrate,
  rotateCcw: RotateCcw,
  rows3: Rows3,
  waypoints: Waypoints,
}

const textureCache = new Map<string, Promise<Texture>>()

function makeSvgDataUri(name: PixiIconName): string {
  const svg = renderToStaticMarkup(
    createElement(ICON_COMPONENTS[name], {
      color: "#ffffff",
      height: ICON_SIZE,
      size: ICON_SIZE,
      strokeWidth: 2,
      width: ICON_SIZE,
    }),
  )
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Load one official Lucide SVG as a shared Pixi texture. */
export function loadLucideIconTexture(name: PixiIconName): Promise<Texture> {
  const existing = textureCache.get(name)
  if (existing) return existing

  const texture = Assets.load<Texture>({
    src: makeSvgDataUri(name),
    parser: "svg",
    data: { resolution: 2 },
  })
  textureCache.set(name, texture)
  return texture
}

/** Load the complete icon set before the scene is made visible. */
export async function loadLucideIconTextures(): Promise<Readonly<Record<PixiIconName, Texture>>> {
  const names = Object.keys(ICON_COMPONENTS) as PixiIconName[]
  const textures = await Promise.all(
    names.map(
      async (name) => [name, await loadLucideIconTexture(name)] as const,
    ),
  )
  return Object.fromEntries(textures) as Readonly<Record<PixiIconName, Texture>>
}
