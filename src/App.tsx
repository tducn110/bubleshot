import { useEffect } from "react";
import BubbleGame from "./components/BubbleGame"
import { preloadCriticalResources, preloadNonCriticalResources } from "./utils/game-loader";
import { completeGameLoading, onGameLoadingDismiss, setGameLoadingProgress } from "./utils/loading-controller";


export default function App() {
  // Unified PapaStudio loading screen lifecycle barrier
  useEffect(() => {
    setGameLoadingProgress(25);
    const criticalPromise = preloadCriticalResources((pct) => {
      setGameLoadingProgress(Math.min(95, pct));
    });
    const winkPromise = new Promise<void>((resolve) => {
      if (typeof window === "undefined") return resolve();
      let attempts = 0;
      const check = () => {
        if ((window as any).Wink || (window as any).WinkBridge || attempts > 20) resolve();
        else { attempts++; setTimeout(check, 100); }
      };
      check();
    });
    void Promise.allSettled([criticalPromise, winkPromise]).then(() => {
      completeGameLoading();
    });
    const unbind = onGameLoadingDismiss(() => {
      preloadNonCriticalResources();
    });
    return unbind;
  }, []);

  return (
    <main className="game-shell" aria-label="Hyper Bubble Shooter">
      <BubbleGame />
    </main>
  )
}