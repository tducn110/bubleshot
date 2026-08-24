import { Assets, Texture } from "pixi.js"
import type { Layout } from "../layout"

// bubble.webp is a 256px square neutral lighting/gloss overlay.
export const TEX_BR = 128
export const DOT_R = 14
export const TRAJ_R = 6

function canvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas")
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  return [cv, cv.getContext("2d")!]
}

function rr(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}

function roundRectTexture(
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: { color: string width: number },
): Texture {
  const [cv, g] = canvas(w, h)
  rr(g, 0.5, 0.5, w - 1, h - 1, r)
  g.fillStyle = fill
  g.fill()
  if (stroke) {
    g.strokeStyle = stroke.color
    g.lineWidth = stroke.width
    g.stroke()
  }
  return Texture.from(cv)
}

function dotTexture(size: number, radius: number): Texture {
  const [cv, g] = canvas(size, size)
  const c = size / 2
  const grad = g.createRadialGradient(c, c, 0, c, c, radius)
  grad.addColorStop(0, "rgba(255,255,255,.95)")
  grad.addColorStop(0.65, "rgba(255,255,255,.55)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.beginPath()
  g.arc(c, c, radius, 0, Math.PI * 2)
  g.fill()
  return Texture.from(cv)
}

function bubbleColorTexture(size: number): Texture {
  const [cv, g] = canvas(size, size)
  const c = size / 2
  g.fillStyle = "#ffffff"
  g.beginPath()
  g.arc(c, c, c - 1, 0, Math.PI * 2)
  g.fill()
  return Texture.from(cv)
}

function pillTopTexture(): Texture {
  const [cv, g] = canvas(36, 36)
  rr(g, 0.5, 0.5, 35, 35, 18)
  g.fillStyle = "#FFFFFF"
  g.fill()
  g.clearRect(0, 18, 36, 18)
  return Texture.from(cv)
}

export class GameTextures {
  readonly glossOverlay: Texture
  readonly colorBase: Texture
  readonly background: Texture
  readonly whiteDot: Texture
  readonly trajDot: Texture
  readonly dot: Texture
  readonly panel: Texture
  readonly pause: Texture
  readonly pill: Texture
  readonly pillTop: Texture
  readonly card: Texture
  readonly cardRed: Texture
  readonly dangerLabel: Texture
  readonly dim: Texture
  readonly dimSoft: Texture

  private constructor(glossOverlay: Texture, background: Texture) {
    this.glossOverlay = glossOverlay
    this.background = background
    this.colorBase = bubbleColorTexture(256)
    this.whiteDot = dotTexture(32, DOT_R)
    this.trajDot = dotTexture(24, TRAJ_R)
    this.dot = roundRectTexture(32, 32, 16, "#FFFFFF")
    this.panel = roundRectTexture(32, 32, 16, "rgba(8,91,142,.24)", {
      color: "rgba(255,255,255,.42)",
      width: 1,
    })
    this.pause = roundRectTexture(80, 32, 16, "rgba(8,91,142,.50)", {
      color: "rgba(255,255,255,.44)",
      width: 1,
    })
    this.pill = roundRectTexture(36, 36, 18, "#FFFFFF")
    this.pillTop = pillTopTexture()
    this.card = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", {
      color: "rgba(100,140,255,.4)",
      width: 2,
    })
    this.cardRed = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", {
      color: "rgba(255,80,80,.4)",
      width: 2,
    })
    this.dangerLabel = textTexture(
      "DANGER",
      "900 12px Outfit, sans-serif",
      "#E95574",
      90,
      18,
    )
    this.dim = roundRectTexture(8, 8, 0, "rgba(5,12,38,.88)")
    this.dimSoft = roundRectTexture(8, 8, 0, "rgba(5,12,38,.82)")
  }

  static async create(): Promise<GameTextures> {
    try {
      const [bubbleBase, background] = await Promise.all([
        Assets.load<Texture>("/bubble.webp"),
        Assets.load<Texture>("/background.webp"),
      ])
      return new GameTextures(bubbleBase, background)
    } catch (error) {
      throw new Error(
        `Unable to load Bubble Shooter core textures: ${String(error)}`,
      )
    }
  }

  /** Fully initialized texture-only warmup set; safe for PrepareSystem. */
  criticalWarmupTextures(): Texture[] {
    return [
      this.background,
      this.colorBase,
      this.glossOverlay,
      this.whiteDot,
      this.trajDot,
      this.dot,
      this.panel,
      this.pause,
      this.pill,
      this.pillTop,
      this.card,
      this.cardRed,
      this.dangerLabel,
      this.dim,
      this.dimSoft,
    ]
  }

  destroy() {
    for (const t of [
      this.whiteDot,
      this.colorBase,
      this.trajDot,
      this.dot,
      this.panel,
      this.pause,
      this.pill,
      this.pillTop,
      this.card,
      this.cardRed,
      this.dangerLabel,
      this.dim,
      this.dimSoft,
    ]) {
      t.destroy(true)
    }
  }
}

function textTexture(
  text: string,
  font: string,
  color: string,
  w: number,
  h: number,
): Texture {
  const [cv, g] = canvas(w, h)
  g.font = font
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = color
  g.fillText(text, w / 2, h / 2)
  return Texture.from(cv)
}

export function makeDangerLineTexture(l: Layout, near: boolean): Texture {
  const w = l.COLS * l.R * 2 + 4
  const [cv, g] = canvas(w, 24)
  g.strokeStyle = "rgba(255,75,107,1)"
  g.lineWidth = near ? 4 : 3
  g.shadowColor = "#FF4D6D"
  g.shadowBlur = near ? 20 : 8
  g.setLineDash([16, 9])
  g.beginPath()
  g.moveTo(2, 12)
  g.lineTo(w - 2, 12)
  g.stroke()
  return Texture.from(cv)
}
