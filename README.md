# Voidwake — The Outer Reach

Play: https://samcousinsgb.github.io/voidwake/

A single-player space sandbox with top-down flight, procedural 3D ships and planets, layered parallax, seven systems, trading, combat, contracts, and ship upgrades.

## Controls

W / Up thrusts, A and D steer, S brakes, Shift boosts, Space fires, T cycles hostile targets, E approaches and docks, and M opens the galaxy map. Click empty space for autopilot. Scroll to zoom. Touch controls appear on small screens. The question-mark button opens the controls.

## Saves

All automatic saves use compressed, path-scoped cookies. The save includes ship, docking state, position, motion, resources, cargo, market stocks, upgrades, contracts, visited systems, reputation, flight time, sound preference, and zoom. Cookies use SameSite=Lax, Secure on HTTPS, and a one-year lifetime refreshed on save. There are no localStorage save writes or IndexedDB saves.

Writes use alternating banks, a checksum, read-back verification, and a previous-save fallback. The UI reports blocked cookies instead of claiming success. The legacy version's localStorage record is read once and removed only after it has been saved successfully to cookies on that same origin.

The Log contains optional Export and Import controls. When opened at the previous address, it also offers Continue on GitHub Pages. This carries a compressed save in a URL fragment, which is removed after reading. Existing progress at the destination is protected by a replacement confirmation. Cookies cannot migrate between domains on their own.

## Development

Node 24+ and npm are required.

- `npm ci`
- `npm run dev:pages` — local static application at http://127.0.0.1:4175/
- `npm test` — simulation, cookie persistence, transfer, corruption, and parallax checks
- `npx tsc --noEmit` — type checking
- `npm run build:pages` — static output in `dist-pages/`
- `npm run preview:pages` — serve the production static output locally

Pushing `main` runs the checked GitHub Pages workflow: tests, type checks, static build, then deployment. It uses pinned revisions of the official GitHub Actions. GitHub Pages serves static assets only; there is no application server, account service, or shared gameplay database.

The original Sites configuration and `npm run build` remain available for the private migration address. They are not involved in the GitHub Pages build.

## Implementation

`app/game/engine.ts` owns the simulation; `cookies.ts` owns persistence. `Game.tsx` and `Panels.tsx` implement the interface. `SpaceView.tsx` renders 3D assets, and `SpaceBackground.ts` applies the independent nebula and star layers defined in `parallax.ts`.

The optional WebMCP actions call the same engine operations as the interface. Their action contracts are tested; live WebMCP registration was not tested because the available browser tooling does not expose an invocation context. Verification covers automated logic checks and production asset checks, not a browser interaction or screenshot playtest.
