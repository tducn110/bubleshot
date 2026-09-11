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
    void Promise.allSettled([criticalPromise]).then(() => {
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