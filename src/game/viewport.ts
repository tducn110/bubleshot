export const CANONICAL_WIDTH = 560
export const CANONICAL_HEIGHT = 800
export const CANONICAL_ASPECT = CANONICAL_WIDTH / CANONICAL_HEIGHT

export interface ViewportTransform {
  hostWidth: number
  hostHeight: number
  scale: number
  offsetX: number
  offsetY: number
}

export function fitViewport(
  hostWidth: number,
  hostHeight: number,
): ViewportTransform {
  const safeWidth = Math.max(hostWidth, 1)
  const safeHeight = Math.max(hostHeight, 1)
  return {
    hostWidth: safeWidth,
    hostHeight: safeHeight,
    // Layout is configured in host pixels, so the stage does not need a
    // second contain/letterbox transform. Keeping this explicit makes input
    // conversion and rendering share one coordinate system.
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
}

export function screenToGame(
  viewport: ViewportTransform,
  screenX: number,
  screenY: number,
  rect: Pick<DOMRect, "left" | "top">,
) {
  return {
    x: (screenX - rect.left - viewport.offsetX) / viewport.scale,
    y: (screenY - rect.top - viewport.offsetY) / viewport.scale,
  }
}
