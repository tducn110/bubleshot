import { Container, Sprite } from "pixi.js"
import type { GameTextures } from "./textures"

/** A pooled material: white color base plus an untinted neutral gloss overlay. */
export class BubbleVisual extends Container {
  private readonly colorLayer: Sprite
  private readonly glossLayer: Sprite
  private colorKey: string | number | null = null

  constructor(t: GameTextures) {
    super({ label: "Bubble" })
    this.colorLayer = new Sprite({ texture: t.colorBase, anchor: 0.5 })
    this.glossLayer = new Sprite({
      texture: t.glossOverlay,
      anchor: 0.5,
      blendMode: "screen",
    })
    this.addChild(this.colorLayer, this.glossLayer)
  }

  setColor(color: string | number) {
    const key = typeof color === "string" ? color.toLowerCase() : color
    if (this.colorKey === key) return
    this.colorLayer.tint = color
    this.colorKey = key
  }

  setScale(scale: number) {
    this.colorLayer.scale.set(scale)
    this.glossLayer.scale.set(scale)
  }

  reset(color: string | number = 0xffffff) {
    this.visible = true
    this.alpha = 1
    this.rotation = 0
    this.scale.set(1)
    this.setScale(1)
    this.setColor(color)
  }
}

export class BubblePool {
  private readonly free: BubbleVisual[] = []
  private created = 0

  constructor(
    private readonly parent: Container,
    private readonly textures: GameTextures,
  ) {}

  prewarm(count: number) {
    while (this.created < count) {
      const bubble = new BubbleVisual(this.textures)
      bubble.visible = false
      bubble.alpha = 0
      this.parent.addChild(bubble)
      this.free.push(bubble)
      this.created++
    }
  }

  take(color: string | number = 0xffffff) {
    let bubble = this.free.pop()
    if (!bubble) {
      bubble = new BubbleVisual(this.textures)
      this.created++
    }
    if (bubble.parent !== this.parent) this.parent.addChild(bubble)
    bubble.reset(color)
    return bubble
  }

  put(bubble: BubbleVisual) {
    bubble.visible = false
    bubble.alpha = 0
    bubble.rotation = 0
    bubble.scale.set(1)
    if (bubble.parent !== this.parent) this.parent.addChild(bubble)
    this.free.push(bubble)
  }
}
