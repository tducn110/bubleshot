import type { Application } from "pixi.js"

export async function attachPixiDevtools(app: Application) {
  if (!import.meta.env.DEV) return

  const { initDevtools } = await import("@pixi/devtools")

  initDevtools({
    app,
  })
}
