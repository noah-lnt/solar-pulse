> STATUS: ACTIVE
@~/.claude/rules/nolan/org.md
@~/.claude/conventions/docker-compose.md

# SolarPulse — real-time dashboard for a home PV + Victron battery installation

## Commands

```bash
cd "$(git rev-parse --show-toplevel)/backend" && npm test          # Hoymiles schedule tests
cd "$(git rev-parse --show-toplevel)/backend" && npm run build     # tsc
cd "$(git rev-parse --show-toplevel)/frontend" && npm run build    # tsc + vite
cd "$(git rev-parse --show-toplevel)" && docker compose config --quiet
```

Dev servers and deployment: `README.md`.

## Structure

- `backend/src/collectors/<device>.collector.ts`: one collector per device, each with a demo branch (`DEMO_MODE=true`) and a real one.
- `backend/src/aggregator.ts`: builds `SystemState` every 10 s, writes one `history` row per minute.
- `backend/src/db.ts`: schema created and migrated at startup (`ADD COLUMN IF NOT EXISTS`).
- `frontend/src/pages/*`: one page per tab, fed by the WebSocket `SystemState`.

## Specifics

- **Hoymiles blacklisted the home IP for over-polling (2026-10).** Its schedule lives in `collectors/hoymiles.schedule.ts`: daylight only, 5 min, backoff 30 min → 6 h. Never shorten it without a rate agreed with Hoymiles, and never call the real API from dev.
- Hoymiles calls go through `HOYMILES_PROXY_URL` (the `warp` service in Compose) and fail closed when it is down.
- The app runs on **local-nolan-sarl**, on the same LAN as the Shelly and the Venus OS; it cannot run on a remote server without a tunnel.
- **Victron ON = island**: a switch isolates the house from the Linky. The Shelly measures the Linky when the Victron is OFF and the Victron line when ON; consumption = PV + Shelly in both modes, Linky energy only when OFF (`src/energy.ts`, `routes/daily.ts`).
- Battery sign convention: positive = discharging, negative = charging (Victron and Hoymiles are inverted on read).
- `history.ms2a_*` columns are kept for past days (the MS-2A was removed in 1.1.0); new rows write 0.
- Daily dates leave SQL as `TO_CHAR(..., 'YYYY-MM-DD')` strings: the backend runs on `Europe/Paris`.
- UI strings are French.

## Verify

- Hoymiles changes: `npm test`, then run the backend with `DEMO_MODE=false`, `HOYMILES_API_URL` pointing at a local mock and a throwaway `DATABASE_URL`; count the mock's calls (first poll = login, sd_uri, data, daily yield; every next poll 5 min later = sd_uri + data, no login).
- UI changes: `DEMO_MODE=true` backend + `npm run dev` in `frontend/`, checked in a browser.
- On the server: count `[Hoymiles] POST` lines over 24 h (README, Deployment step 6).
