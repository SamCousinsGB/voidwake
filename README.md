# Voidwake: The Outer Reach

An original single-player space sandbox inspired by the trading, travel, and combat of classic Flash-era space games.

## Play

- W / Up: thrust; A and D / Left and Right: steer; S / Down: brake.
- Shift: boost; Space: fire pulse cannons; T: cycle hostile targets.
- Click empty space to set an autopilot waypoint. Click a contact to select it.
- E: approach and dock automatically. M: galaxy map. Escape: pause or close a panel.
- Scroll or use the on-screen buttons to zoom. Touch controls appear on small screens.
- Enable audio with the speaker control. Audio starts muted.

Start by docking at Port Meridian. Accept a supplied freight contract or buy food in Solace and sell it in Cinder. Use the galaxy map to compare actual destination resale prices and fuel costs. Bounties offer a more dangerous source of credits.

## Implemented

Seven connected systems, each with a local economy, security level, station, inhabited planet, moon, ringed gas giant, star, asteroid belt and local ships. Three player ship classes and four upgrade tracks. Real-time flight and combat run on a 2D plane with Three.js orthographic rendering of procedural 3D assets. No downloaded images, runtime asset services, or external game art are required.

Markets enforce stock, cargo capacity, available credits, a resale spread, and reserved contract cargo. Freight, bounty, and exploration contracts can be accepted at stations. Pirates drop credits and salvage. Defeat recovers the player at a station for lost cargo and 10% of credits. Emergency towing supplies reserve fuel even when credits run out.

Progress saves locally every five seconds and after transactions. It is specific to the current browser and site origin. The save includes the ship, position, credits, cargo, local market stocks, upgrades, contracts, reputation, and visited systems. Local contacts respawn on system entry and reloading. Navigation, the manifest, the log, and the flight manual pause the simulation; hiding the browser tab also pauses it.

## Development

Requires Node 24 or later for the test runner's native TypeScript support. Run `npm install`, then `npm run dev`.

- `npm test`: deterministic simulation and action-contract checks.
- `npx tsc --noEmit`: TypeScript validation.
- `npm run build`: Cloudflare-compatible production build.
- `npm start`: local production worker.

Primary implementation lives in `app/game/engine.ts`, `SpaceView.tsx`, `Game.tsx`, `Panels.tsx`, and `webmcp.ts`. The optional WebMCP surface shares the exact simulation actions used by the interface. Browser support is feature-detected; normal controls work independently.

The tests validate the simulation and optional tool action contracts. They are not browser interaction or screenshot tests. The current browser tooling did not expose a WebMCP invocation context, so live browser tool registration was not verified.
