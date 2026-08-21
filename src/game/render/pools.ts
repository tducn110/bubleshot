import { Sprite, type Container, type Texture } from "pixi.js"

export class SpritePool {
  private free: Sprite[] = []

  constructor(private readonly parent: Container) {}

  prewarm(count: number, texture: Texture) {
    while (this.free.length < count) {
      const sprite = new Sprite({ texture, anchor: 0.5 })
      sprite.visible = false
      sprite.alpha = 0
      this.parent.addChild(sprite)
      this.free.push(sprite)
    }
  }

  take(texture: Texture): Sprite {
    let s = this.free.pop()
    if (s) {
      s.texture = texture
      s.visible = true
      s.alpha = 1
      s.scale.set(1)
      s.tint = 0xffffff
    } else {
      s = new Sprite({ texture, anchor: 0.5 })
      this.parent.addChild(s)
    }
    return s
  }

  put(s: Sprite) {
    s.visible = false
    this.free.push(s)
  }
}
