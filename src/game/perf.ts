/**
 * Opt-in development instrumentation for the impact/drop hot path.
 *
 * Enable with `?perf=1`. The production bundle keeps the calls as no-ops and
 * never emits console logging. Chrome Performance can inspect the resulting
 * `performance.measure()` entries by their `bubble/` names.
 */
const enabled =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("perf")
let measureId = 0

export function startDevMeasure(name: string): string | null {
  if (!enabled || typeof performance === "undefined") return null
  const token = `${name}:${measureId++}`
  performance.mark(`${token}:start`)
  return token
}

export function endDevMeasure(name: string, token: string | null) {
  if (token === null || typeof performance === "undefined") return
  const start = `${token}:start`
  const end = `${token}:end`
  performance.mark(end)
  performance.measure(`bubble/${name}`, start, end)
  performance.clearMarks(start)
  performance.clearMarks(end)
}

export function markDev(name: string) {
  if (enabled && typeof performance !== "undefined")
    performance.mark(`bubble/${name}`)
}

export function measureDev<T>(name: string, fn: () => T): T {
  if (!enabled || typeof performance === "undefined") return fn()

  const id = `${name}:${measureId++}`
  const start = `${id}:start`
  const end = `${id}:end`
  performance.mark(start)
  try {
    return fn()
  } finally {
    performance.mark(end)
    performance.measure(`bubble/${name}`, start, end)
    performance.clearMarks(start)
    performance.clearMarks(end)
  }
}

export async function measureAsyncDev<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled || typeof performance === "undefined") return fn()

  const id = `${name}:${measureId++}`
  const start = `${id}:start`
  const end = `${id}:end`
  performance.mark(start)
  try {
    return await fn()
  } finally {
    performance.mark(end)
    performance.measure(`bubble/${name}`, start, end)
    performance.clearMarks(start)
    performance.clearMarks(end)
  }
}
