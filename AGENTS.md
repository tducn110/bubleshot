# figma-make-app

React + Vite project running inside Figma Make. A Bubble Shooter arcade game rendered with PixiJS on a `<canvas>`.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8444). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/components/BubbleGame.tsx` - Host component; boots/destroys the PixiJS `Application` and the game engine
- `src/game/engine.ts` - Game orchestrator: input, phases, ball physics, scoring, and win/lose flow
- `src/game/layout.ts` - Responsive logical layout and hex-grid math (`gToW`, `wToG`, `nbrs`)
- `src/game/board.ts` - Board state, flood-fill matching, and floating-bubble detection
- `src/game/fx.ts` - Particles, popups, screen shake, combo banner, and pop/drop animations
- `src/game/config.ts` - Tuning constants (colors, speeds, scoring, row pressure)
- `src/game/types.ts` - Shared types plus the read-only `GameView` interface the renderers consume
- `src/game/render/` - PixiJS renderers: `game.ts` (orchestrator), `textures.ts` (pre-rendered textures, nine-slice skins), `layers.ts`, `hud.ts`, `overlays.ts`, `pools.ts`
- `src/index.css` - Global CSS: Google Fonts import, shell, and canvas sizing
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx` (title/lang injected from `.figma/make/site.json`)
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19, React DOM 19, and PixiJS 8
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

All game visuals are rendered by PixiJS via `src/game/render/`; `src/index.css` only holds page-level styles (fonts, `.game-shell`, `.game-canvas` host). Do not reintroduce a CSS framework for the game UI.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.