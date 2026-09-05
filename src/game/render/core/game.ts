import { Application, Container, UPDATE_PRIORITY, type Ticker } from "pixi.js"
import "pixi.js/prepare"
import type { BubbleShooterEngine } from "../../engine"
import { GameTextures } from "./textures"
import { SceneLayers } from "./layers"
import { OverlaysLayer } from "../overlays/overlays"
import { HudLayer } from "../hud/hud"
import { GameSettingsStore } from "../../settings"
import { measureAsyncDev, measureDev } from "../../perf"
import { FONT_SAMPLES } from "./typography"

async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return
  try {
    await Promise.all(FONT_SAMPLES.map((f) => document.fonts.load(f)))
    await document.fonts.ready
  } catch {
    // Rendering may continue with the system fallback if the optional remote
    // font host is unavailable, but every Pixi Text still uses the same family.
  }
}

export class PixiGame {
  private root: Container
  private shake: Container
  private uiLayer: Container
  private textures: GameTextures | null = null
  private layers: SceneLayers | null = null
  private overlays: OverlaysLayer | null = null
  private hud: HudLayer | null = null
  readonly settings = new GameSettingsStore()
  private destroyed = false
  private lastW = 0
  private lastH = 0
  private readonly exposePerfState =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("perf")
  private readonly exposeHudDebug =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("debugHud")
  private readonly engineTick = (t: Ticker) =>
    this.engine.tick(t.deltaMS / 1000)
  private readonly syncTick = () => this.sync()

  constructor(
    private app: Application,
    private engine: BubbleShooterEngine,
  ) {
    this.root = new Container({ label: "GameRoot" })
    this.shake = new Container({ label: "ShakeRoot" })
    this.uiLayer = new Container({
      label: "uiLayer",
      sortableChildren: true,
    })
    this.root.addChild(this.shake, this.uiLayer)
    this.app.stage.addChild(this.root)
  }

  async init() {
    await loadFonts()
    if (this.destroyed) return
    this.textures = await measureAsyncDev("startup/textures-create", () =>
      GameTextures.create(),
    )
    if (this.destroyed) {
      this.textures.destroy()
      this.textures = null
      return
    }
    this.layers = measureDev(
      "startup/scene-create",
      () =>
        new SceneLayers(
          this.shake,
          this.textures!,
          this.engine.layout.maxFloatingBubbleCount(
            this.engine.board.gridParity,
          ),
          this.engine.layout.maxBoardBubbleCount(this.engine.board.gridParity),
          (commandId, actionId, kind) =>
            this.engine.notifyAnimationComplete(commandId, actionId, kind),
        ),
    )
    this.hud = new HudLayer(this.uiLayer, this.textures, {
      requestDashboard: () => {
        this.overlays?.openLeaderboard()
      },
      requestPause: () => this.engine.togglePause(),
      consumePointerDown: () => this.engine.consumeNextDown(),
    })
    this.overlays = new OverlaysLayer(
      this.uiLayer,
      this.textures,
      this.engine,
      this.settings,
      () => this.engine.consumeNextDown(),
    )
    // Initialize every Sprite that starts without a texture (background,
    // danger line, board visuals, and overlays) before PrepareSystem is
    // allowed to render the root for an upload pass. Otherwise Pixi's batcher
    // can see an uninitialized Sprite and crash while reading its texture.
    this.sync()
    // Warm only initialized textures, never the full scene tree. The bounded
    // wait prevents a broken/headless PrepareSystem from owning lifecycle;
    // Pixi's normal lazy upload remains the fallback after the deadline.
    const prepare = measureAsyncDev("startup/prepare-upload", async () => {
      await this.app.renderer.prepare?.upload?.(
        this.textures!.criticalWarmupTextures(),
      )
    }).catch(() => undefined)
    await Promise.race([
      prepare,
      new Promise<void>((resolve) => window.setTimeout(resolve, 250)),
    ])
    if (this.destroyed) return
    this.sync()
    this.app.render()
    this.app.ticker.add(this.engineTick, undefined, UPDATE_PRIORITY.HIGH)
    this.app.ticker.add(this.syncTick)
    this.app.start()
    this.engine.activate()
    this.sync()
    this.app.render()
  }

  private sync() {
    const v = this.engine
    const l = v.layout
    if (l.LW !== this.lastW || l.LH !== this.lastH) {
      this.lastW = l.LW
      this.lastH = l.LH
      this.relayout()
    }
    this.root.position.set(v.ox, v.oy)
    this.root.scale.set(v.sc)
    this.shake.position.set(v.fx.csx, v.fx.csy)
    const t = this.textures!
    this.layers?.sync(v, t)
    this.hud?.sync(v)
    this.overlays?.sync(v)
    this.hud?.setSuppressed(this.overlays?.leaderboardOpen ?? false)
    if (this.exposeHudDebug && this.hud) {
      const metrics = this.hud.debugMetrics(v)
      this.app.canvas.dataset.hudDebug = JSON.stringify({
        viewportWidth: l.LW,
        viewportHeight: l.LH,
        hud: metrics.hud,
        buttonDiameter: metrics.trophyButton.width,
        bubbleDiameter: metrics.bubbleDiameter,
      })
    }
    if (this.exposePerfState) {
      const data = this.app.canvas.dataset
      data.gamePhase = v.phase
      data.actionId = String(v.actionId)
      data.boardVersion = String(v.board.version)
      data.shotCount = String(v.shots.length)
      data.settledShotCount = String(
        v.shots.reduce((count, shot) => count + Number(shot.settled), 0),
      )
      data.blockingAnimations = String(this.engine.blockingAnimations)
      data.animationCommands = v.fx.commands
        .map((command) => `${command.id}:${command.kind}:${command.actionId}`)
        .join(",")
    }
  }

  private relayout() {
    const t = this.textures!
    this.layers?.relayout(this.engine, t)
    this.hud?.relayout(this.engine)
    this.overlays?.relayout(this.engine, t)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.app.ticker.remove(this.engineTick)
    this.app.ticker.remove(this.syncTick)
    this.layers?.destroy()
    this.overlays?.dispose()
    this.root.destroy({ children: true })
    this.textures?.destroy()
  }
}
