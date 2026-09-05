import {
  Container,
  Particle as PixiParticle,
  ParticleContainer,
  Rectangle,
} from "pixi.js"
import type { Particle, Trail } from "../../types"
import { DOT_R, type GameTextures } from "../core/textures"

const PARTICLE_CAPACITY = 192
const TRAIL_CAPACITY = 28

function makeParticles(count: number, t: GameTextures) {
  return Array.from(
    { length: count },
    () =>
      new PixiParticle({
        texture: t.whiteDot,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 0,
      }),
  )
}

/** Fixed-capacity Pixi v8 particle batches; no Sprite allocation in FX sync. */
export class GameplayParticleLayer {
  private readonly particles: PixiParticle[]
  private readonly trails: PixiParticle[]
  private readonly particleBounds = new Rectangle()
  private readonly trailBounds = new Rectangle()
  private readonly particleContainer: ParticleContainer<PixiParticle>
  private readonly trailContainer: ParticleContainer<PixiParticle>
  private lastParticleCount = 0
  private lastTrailCount = 0

  constructor(parent: Container, textures: GameTextures) {
    this.particles = makeParticles(PARTICLE_CAPACITY, textures)
    this.trails = makeParticles(TRAIL_CAPACITY, textures)
    this.particleContainer = new ParticleContainer({
      texture: textures.whiteDot,
      particles: this.particles,
      boundsArea: this.particleBounds,
      dynamicProperties: {
        position: true,
        vertex: true,
        color: true,
        rotation: false,
        uvs: false,
      },
    })
    this.trailContainer = new ParticleContainer({
      texture: textures.whiteDot,
      particles: this.trails,
      boundsArea: this.trailBounds,
      dynamicProperties: {
        position: true,
        vertex: true,
        color: true,
        rotation: false,
        uvs: false,
      },
    })
    parent.addChild(this.trailContainer, this.particleContainer)
  }

  relayout(width: number, height: number) {
    this.particleBounds.set(-64, -64, width + 128, height + 192)
    this.trailBounds.copyFrom(this.particleBounds)
  }

  sync(parts: readonly Particle[], trails: readonly Trail[]) {
    const particleCount = Math.max(parts.length, this.lastParticleCount)
    for (let i = 0; i < particleCount; i++) {
      const target = this.particles[i]
      const source = parts[i]
      if (!source) {
        target.alpha = 0
        continue
      }
      target.x = source.x
      target.y = source.y
      target.scaleX = source.r / DOT_R
      target.scaleY = source.r / DOT_R
      target.tint = source.color
      target.alpha = source.alpha
    }
    this.lastParticleCount = parts.length
    const trailCount = Math.max(trails.length, this.lastTrailCount)
    for (let i = 0; i < trailCount; i++) {
      const target = this.trails[i]
      const source = trails[i]
      if (!source) {
        target.alpha = 0
        continue
      }
      target.x = source.x
      target.y = source.y
      const scale = 0.22 + source.alpha * 0.16
      target.scaleX = scale
      target.scaleY = scale
      target.tint = source.color
      target.alpha = source.alpha * 0.55
    }
    this.lastTrailCount = trails.length
  }
}
