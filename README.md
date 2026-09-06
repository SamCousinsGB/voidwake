# Voidwake — The Outer Reach

Play: https://samcousinsgb.github.io/voidwake/

A single-player space sandbox with top-down flight, procedural 3D fleets and planets, layered parallax, 48 systems, 240 interactive worlds, six factions, 24 flyable ship classes, trading, combat, contracts, and ship upgrades.

## Controls

W / Up thrusts, A and D steer, S brakes, Shift boosts, Space fires, 1–5 selects a weapon, T cycles hostile targets, H hails the selected contact, E approaches and docks, and M opens the galaxy map. Click empty space for autopilot. Click a planet to open its communications; click a ship to select it, then Hail or H to interact. Scroll to zoom. Touch controls and weapon selection are available on small screens.

## Fleets and territory

Each faction initially owns eight systems and four ship classes, with its own flag, hull palette, model architecture, station, and procedural nebula pattern. The original seven systems and three ships retain their save identifiers. Civilian traffic, military patrols, and unaffiliated pirates inhabit every system.

| Faction | Fleet design | Capital |
| --- | --- | --- |
| Concord Union | Layered saucers, drive hulls, separated nacelles | Solace |
| Free Traders | Modular cargo stacks and convoy carriers | Carina |
| Ashen Syndicate | Swept wings and dark warbirds | Nyx |
| Helios Ascendancy | Solar rings and beam cruisers | Aurelia |
| Pelagic Accord | Curved organic hulls and shield carriers | Thalassa |
| Iron Dominion | Armoured gunships and siege dreadnoughts | Ferrum |

Faction standing starts at 25. Below 0, that faction's patrols and stations attack on sight in all its systems, ports deny docking, and civilians refuse trade and flee. At 50, its advanced ship classes become available. The starter courier and second-hand Atlas remain available across friendly ports; other fleets are sold locally.

An unprovoked hit on a civilian or security vessel costs 12 standing and creates a 180-second local alert with a 600-credit fine. Repeated hits on the same provoked ship do not re-charge that first offence. Destroying a civilian costs another 30 standing; destroying security costs another 22. Destruction adds a 2,400-credit fine and extends the local alert to 300 seconds. Civilian kills never pay bounties. Patrol reinforcements respond, and destroyed ships and ports stay destroyed across visits and reloads.

Paying fines clears local alerts but does not restore faction standing. Medical aid gives +8 standing, completed contracts +5, and surveys or pirate kills +2. Survey payouts can only be claimed once per planet. Bounty contracts spawn replacement targets when earlier pirates were already destroyed, so they remain completable. Recovery finds a usable friendly port when the current faction denies docking.

## Planets and weapons

Each system contains an inhabited primary, a mining moon, a ringed gas giant, and two outer worlds. Planet communications provide orbital approaches, one-time paid surveys, medical-aid shuttles, resource extraction on uninhabited worlds, and gas-giant fuel skimming. Surface operations require proximity and share a 120-second shuttle recharge. Civilian hails allow nearby cargo purchases and sales with real stock, credit, cargo, and reputation checks.

- **Phaser array:** hold Space or the Fire control for one continuous target-tracking beam. 820 m range, 24 energy per second, 3.2× base damage per second. Energy starvation stops the beam until the capacitor recovers.
- **Heavy laser:** longer 1,050 m beams with higher damage and energy use.
- **Siege torpedoes:** 14× base damage, shield-breaking ordnance, a 180 m blast, shockwaves and deep impact audio. Point defence cannot intercept them.
- **Seeker missiles:** 7× base damage, curved launches, bounded-turn guidance, target leading, persistent exhaust trails, and 95 m area blasts. Point defence can destroy them before impact.
- **Antimatter torpedoes:** rare ammunition creates a 350 m singularity, annihilating every ship and station inside, regardless of shields. Collateral casualties still count as crimes. Planets remain intact.

Celestial objects render in a separate pass. Their depth buffer is cleared before ships, stations, weapons, and flight indicators are drawn, so no planet, atmosphere, or ring can obscure a ship. Hull detail is merged per material to bound draw calls. Shipyard and communications portraits use the same 3D models as flight.

## Living galaxy

Pirates choose civilian prey, traders flee, escorts fight back, and planetary defence grids launch three-missile salvos at attackers. Wars link opposing factions throughout the galaxy: offensives advance, local battle losses change assault pressure, territory can change hands, and ceasefires end hostilities. Captured systems change their flag, station allegiance, shipyard access, and space palette.

Seven event types can develop locally or elsewhere: pirate incursions, relief convoys, jump-lane blockades, planetary sieges, ion storms, medical shortages, and derelict research vessels. Events occur during play, including while docked; menus and Pause freeze the simulation. There is no offline catch-up or shared multiplayer world. A fresh voyage gets a random seed; saves preserve its subsequent event sequence.

Destroying an interdiction station reopens its blocked route; alternative routes remain usable. Convoys replenish actual market stock and lower prices. Trader losses reduce supply. Shortages raise food and medicine prices; sieges raise material prices. The Galaxy map uses current prices, owners, and route status. Dispatches shows war fronts, active situations, navigation to local threats, and recent news.

Point defence is sold under Shipyard → Special systems on compatible hulls: every cruiser and capital ship, plus Atlas, Anvil, and Aureole. Levels cost 4,500 / 9,000 credits, use 5 energy per interception, and extend interception range from 330 to 470 m. Military cruisers and stations carry their own defences.

Antimatter launchers require a cruiser or capital ship, allied standing (50), and stock at Halo, Aurelia, Talassa Gate, or Triton. Installation costs 32,000 credits and includes one warhead. Additional warheads cost 8,500 credits, stock replenishes every 15 minutes of flight time up to two, and the hold is limited to three warheads. Research wrecks can yield a warhead. Select weapon 5 after fitting the launcher.

Hailing shows one of twelve original human, augmented human, Ashen, Solari, Pelagic, Ferrite, and synthetic captains, with stable identities and faction uniforms. The atlas and generation brief are documented in [ARTWORK.md](ARTWORK.md).

## Saves

All automatic saves use compressed, path-scoped cookies. The save includes ship, docking state, player position and motion, resources, cargo, station and civilian market stocks, upgrades, contracts, visited systems, faction standing, local alerts and fines, destroyed and provoked contacts, surveys, shuttle cooldowns, selected weapon, flight time, sound preference, zoom, equipment, antimatter ammunition, depot stock, war fronts, captured territory, supply conditions, news, and event seed. NPC motion, temporary damage, and weapons in flight are reconstructed when a system reloads. Resolved encounters and permanent local ship or defence-grid losses stay resolved; temporary encounter traffic is replenished by later events. Cookies use SameSite=Lax, Secure on HTTPS, and a one-year lifetime refreshed on save. There are no localStorage save writes or IndexedDB saves.

New saves use a denser DEFLATE codec; the earlier LZ codec remains readable. Writes use alternating banks, a checksum, read-back verification, and a previous-save fallback. The UI reports blocked cookies instead of claiming success. The legacy version's localStorage record is read once and removed only after it has been saved successfully to cookies on that same origin.

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

`app/game/world.ts` defines systems, worlds, factions, ships, and weapons. `engine.ts`, `battle.ts`, and `galaxy.ts` own the simulation; `cookies.ts` owns persistence. `Game.tsx`, `Panels.tsx`, and `Interactions.tsx` implement the interface. `ShipModels.ts` builds fleet geometry; `SpaceView.tsx` renders separate celestial and flight layers through `renderLayers.ts`. `SpaceBackground.ts` applies faction nebula patterns and the independent star layers in `parallax.ts`.

The expansion has 63 automated checks, including all ship geometry, render-pass order, patrol pursuit, civilian trade and crime, cross-system hostility, weapon travel and damage, planet operations, legacy migration, and a complete expanded campaign fitting verified cookie saves. The original trading, flight, contract, corruption, and save-transfer checks remain included. New checks cover NPC combat, planetary volleys, blockades, supply changes, war capture and ceasefires, continuous phasers, point-defence exclusions, antimatter costs and annihilation, captain atlas mapping, effect disposal, and an hour of autonomous simulation.

The optional WebMCP actions call the same engine operations as the interface. Their action contracts are tested; live WebMCP registration was not tested because the available browser tooling does not expose an invocation context. Verification covers automated logic checks and production asset checks, not a browser interaction or screenshot playtest.

## Inspiration

The player-facing sandbox takes inspiration from [Vex Xiang's FlashTrek: Broken Mirror](https://www.newgrounds.com/portal/view/238585). The reputation thresholds were informed by the [community description of Broken Mirror's prestige rules](https://flashtrek.fandom.com/wiki/Flashtrek%3A_Broken_Mirror). Voidwake's factions, artwork, hulls, economy, offence values, and simulation are original implementations; this is not a port of the Flash game.
