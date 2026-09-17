import { useEffect, useRef } from "react"
import { Application } from "pixi.js"
import { BubbleShooterEngine } from "../game/engine"
import { PixiGame } from "../game/render/core/game"
import { winkGame } from "../integrations/wink/client"

export default function BubbleGame() {
  const hostRef = useRef<HTMLDivElement>(null)
  const debugHudRef = useRef<HTMLDivElement>(null)
  const debugHud =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("debugHud")

  useEffect(() => {
    if (!debugHud) return
    let frame = 0
    let disposed = false

    const updateOverlay = () => {
      if (disposed) return
      const canvas = hostRef.current?.querySelector<HTMLCanvasElement>("canvas")
      const overlay = debugHudRef.current
      const raw = canvas?.dataset.hudDebug
      if (overlay && raw) {
        const metrics = JSON.parse(raw) as {
          viewportWidth: number
          viewportHeight: number
          hud: { x: number; y: number; width: number; height: number }
          buttonDiameter: number
          bubbleDiameter: number
        }
        // Keep the audit box below the HUD. Drawing it over the score makes
        // the real Pixi text look blurry and hides the contrast we are
        // trying to verify on the mobile layout.
        overlay.style.left = `${metrics.hud.x}px`
        overlay.style.top = `${metrics.hud.y + metrics.hud.height + 4}px`
        overlay.style.width = `${metrics.hud.width}px`
        overlay.style.height = "auto"
        overlay.textContent = [
          `HUD ${metrics.hud.x.toFixed(1)},${metrics.hud.y.toFixed(1)} ${metrics.hud.width.toFixed(1)}×${metrics.hud.height.toFixed(1)}px`,
          `button Ø ${metrics.buttonDiameter.toFixed(1)}px`,
          `bubble Ø ${metrics.bubbleDiameter.toFixed(1)}px`,
        ].join("  ")
      }
      frame = window.requestAnimationFrame(updateOverlay)
    }

    frame = window.requestAnimationFrame(updateOverlay)
    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
    }
  }, [debugHud])

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
        if (window.__PIXI_DEVTOOLS__?.app === pixiApp)
          window.__PIXI_DEVTOOLS__ = {}
        if (window.__PIXI_APP__ === pixiApp) window.__PIXI_APP__ = undefined
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
          autoDensity: true,
          resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
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
        if (import.meta.env.DEV) {
          const { attachPixiDevtools } = await import("../game/render/core/devtools")
          await attachPixiDevtools(pixiApp)

          // Keep the legacy alias for the unofficial inspector extension.
          window.__PIXI_APP__ = pixiApp
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

    const unbindLifecycle = winkGame.bindLifecycle({
      onPause: () => {
        engine?.pause()
      },
      onResume: () => {
        engine?.resume()
      },
      onMute: () => {
        game?.settings.setParentMuted(true)
      },
      onUnmute: () => {
        game?.settings.setParentMuted(false)
      },
    })

    return () => {
      unbindLifecycle()
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
    <div ref={hostRef} className="game-canvas" aria-label="Bubble Shooter game">
      {debugHud && <div ref={debugHudRef} className="hud-debug-overlay" />}
    </div>
  )
}
