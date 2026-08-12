import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { BubbleShooterEngine } from "../game/engine";
import { PixiGame } from "../game/render/game";

export default function BubbleGame() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let destroyed = false;
    let engine: BubbleShooterEngine | null = null;
    let game: PixiGame | null = null;
    let pixiApp: Application | null = null;

    const destroyApp = () => {
      if (pixiApp && !destroyed) {
        destroyed = true;
        pixiApp.destroy(
          { removeView: true },
          { children: true, texture: true, textureSource: true },
        );
      }
    };

    void (async () => {
      pixiApp = new Application();
      try {
        await pixiApp.init({
          preference: "webgl",
          antialias: true,
          resolution: 1,
          backgroundAlpha: 0,
          resizeTo: hostRef.current!,
        });
        if (disposed) {
          destroyApp();
          return;
        }
        pixiApp.canvas.className = "game-canvas-canvas";
        hostRef.current!.appendChild(pixiApp.canvas);
        engine = new BubbleShooterEngine(pixiApp.canvas);
        game = new PixiGame(pixiApp, engine);
        await game.init();
      } catch {
        game?.destroy();
        engine?.destroy();
        destroyApp();
      }
    })();

    return () => {
      disposed = true;
      game?.destroy();
      engine?.destroy();
      destroyApp();
    };
  }, []);

  return (
    <div ref={hostRef} className="game-canvas" aria-label="Bubble Shooter game" />
  );
}
