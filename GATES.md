# Gates: Bubble Shooter core refinement and Wink SDK v1 handoff

OWNS: GATES.md, src/game/**, src/components/BubbleGame.tsx, src/integrations/wink/**, src/utils/game-loader.ts, index.html, package.json, wink.game.json

Scope: Keep the existing Bubble Shooter core while delivering tested trajectory and snap behavior, functional power-up controls, coherent pause/leaderboard UI, accurate core-asset loading, and a Wink SDK v1-safe handoff.

- [ ] G1: Core gameplay, trajectory, snap, power-up, settings, and Wink behavior are covered by the repository test suite.
  CHECK: npm test
  EXPECT: Tests
  EVIDENCE: pending

- [ ] G2: The project typechecks after the focused implementation.
  CHECK: npm run typecheck && printf 'typecheck passed\n'
  EXPECT: typecheck passed
  EVIDENCE: pending

- [ ] G3: The Wink SDK v1 static contract has no legacy bridge, custom tracking, or direct transport violation.
  CHECK: bash /home/pro/.codex/skills/wink-minigame-handoff/scripts/verify-static.sh --repo /home/pro/Downloads/intern/onprogress/08_shoot && printf 'wink static contract passed\n'
  EXPECT: wink static contract passed
  EVIDENCE: pending

- [ ] G4: The production bundle builds from the declared Vite script.
  CHECK: npm run build && printf 'production build passed\n'
  EXPECT: production build passed
  EVIDENCE: pending

- [ ] G5: The focused diff has no whitespace errors.
  CHECK: git diff --check && printf 'diff check passed\n'
  EXPECT: diff check passed
  EVIDENCE: pending

- [ ] G6: At 390x844, all four power-up controls are reachable, the pause surface follows the leaderboard visual language, and the app has no observed browser console errors.
  EVIDENCE: pending
