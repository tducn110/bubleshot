import { useEffect } from "react"
import BubbleGame from "./components/BubbleGame"
import {
  preloadCriticalResources,
  preloadNonCriticalResources,
} from "./utils/game-loader"
import {
  completeGameLoading,
  onGameLoadingDismiss,
  setGameLoadingProgress,
} from "./utils/loading-controller"

export default function App() {
  // Unified PapaStudio loading screen lifecycle barrier
  useEffect(() => {
    setGameLoadingProgress(25)
    const criticalPromise = preloadCriticalResources((pct) => {
      setGameLoadingProgress(Math.min(95, pct))
    })
    const winkPromise = new Promise<void>((resolve) => {
      if (typeof window === "undefined") return resolve()
      let attempts = 0
      const check = () => {
        if ((window as any).Wink || (window as any).WinkBridge || attempts > 20)
          resolve()
        else {
          attempts++
          setTimeout(check, 100)
        }
      }
      check()
    })
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, 2000),
    )
    void Promise.race([
      Promise.allSettled([criticalPromise, winkPromise]),
      timeoutPromise,
    ]).then(() => {
      completeGameLoading()
    })
    const unbind = onGameLoadingDismiss(() => {
      preloadNonCriticalResources()
    })
    return unbind
  }, [])

  useEffect(() => {
    const blockCopyAction = (event: Event) => {
      event.preventDefault()
    }

    document.addEventListener("copy", blockCopyAction, true)
    document.addEventListener("cut", blockCopyAction, true)
    document.addEventListener("selectstart", blockCopyAction, true)
    document.addEventListener("dragstart", blockCopyAction, true)
    document.addEventListener("contextmenu", blockCopyAction, true)

    return () => {
      document.removeEventListener("copy", blockCopyAction, true)
      document.removeEventListener("cut", blockCopyAction, true)
      document.removeEventListener("selectstart", blockCopyAction, true)
      document.removeEventListener("dragstart", blockCopyAction, true)
      document.removeEventListener("contextmenu", blockCopyAction, true)
    }
  }, [])

  return (
    <main className="game-shell" aria-label="Hyper Bubble Shooter">
      <BubbleGame />
    </main>
  )
}
