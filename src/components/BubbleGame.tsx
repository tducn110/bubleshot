import { useEffect, useRef } from "react"
import { Application } from "pixi.js"
import { BubbleShooterEngine } from "../game/engine"
import { PixiGame } from "../game/render/game"

export default function BubbleGame() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hostRef.current) return
    let disposed = false
    let destroyed = false
    let initialized = false
    let gameDestroyed = false
    let engine: BubbleShooterEngine | null = null
    let game: PixiGame | null = null
    let pixiApp: Application | null = null

    const destroyApp = () => {
      if (pixiApp && !destroyed) {
        destroyed = true
        pixiApp.destroy(
          { removeView: true },
          // Core WebP textures belong to Pixi's Assets cache; GameTextures
          // only owns and destroys the small generated UI textures.
          { children: true, texture: false, textureSource: false },
        )
      }
    }

    const destroyGame = () => {
      if (game && !gameDestroyed) {
        gameDestroyed = true
        game.destroy()
      }
    }

    void (async () => {
      pixiApp = new Application()
      try {
        await pixiApp.init({
          preference: "webgl",
          antialias: true,
          resolution: 1,
          backgroundAlpha: 0,
          resizeTo: hostRef.current!,
        })
        pixiApp.stop()
        initialized = true
        if (disposed) {
          destroyApp()
          return
        }
        pixiApp.canvas.className = "game-canvas-canvas"
        hostRef.current!.appendChild(pixiApp.canvas)
        engine = new BubbleShooterEngine(pixiApp.canvas)
        game = new PixiGame(pixiApp, engine)
        gameDestroyed = false
        await game.init()
        if (disposed || destroyed) {
          destroyGame()
          destroyApp()
          return
        }
        if (
          import.meta.env.DEV &&
          new URLSearchParams(window.location.search).has("perf")
        ) {
          ;(window as Window & {
            __bubbleShooterPerf?: {
              engine: BubbleShooterEngine
              game: PixiGame
            }
          }).__bubbleShooterPerf = { engine, game }
        }
      } catch (error) {
        if (import.meta.env.DEV)
          console.error("Bubble Shooter startup failed", error)
        destroyGame()
        engine?.destroy()
        destroyApp()
      }
    })()

    return () => {
      disposed = true
      destroyGame()
      engine?.destroy()
      const perfWindow = window as Window & {
        __bubbleShooterPerf?: {
          engine: BubbleShooterEngine
          game: PixiGame
        }
      }
      if (perfWindow.__bubbleShooterPerf?.engine === engine)
        delete perfWindow.__bubbleShooterPerf
      if (initialized) destroyApp()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="game-canvas"
      aria-label="Bubble Shooter game"
    />
  )
}
