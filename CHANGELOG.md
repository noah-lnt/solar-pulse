# Changelog

## 1.1.0 — Unreleased

### Added
- Consumption source on the overview: "Linky (payant)" when the Victron is OFF, "Solaire + batterie" when it is ON.
- Daily consumption column in the history table.

### Changed
- Consumption is PV + Shelly in both Victron modes, and only Victron-OFF minutes count as Linky import/export; self-consumption and self-sufficiency are computed from those Linky figures. Past days are recomputed from the stored Victron mode.
- The overview's daily figures come from the same calculation as the history table.
- Hoymiles is polled only between sunrise and sunset at the site (`SITE_LATITUDE`, `SITE_LONGITUDE`), every 5 minutes, with the daily yield refreshed every 15 minutes: about 150–200 calls a day instead of ~5,900.
- After a Hoymiles failure the backend waits 30 minutes, doubling up to 6 hours, instead of retrying at once; `/api/health` shows the next attempt.
- Hoymiles calls can go through an HTTP proxy (`HOYMILES_PROXY_URL`); the Docker stack routes them through a Cloudflare WARP container. If the proxy is down, the call fails instead of going out directly.
- At night the dashboard keeps today's PV yield instead of resetting it to 0.
- Docker images run on Node 22; the backend container runs on `Europe/Paris` time.

### Fixed
- Consumption no longer counts the battery twice while the Victron is ON.
- The Hoymiles token is kept until Hoymiles rejects it, instead of a new login every 3 minutes.
- Days in the history table no longer shift by one when the backend runs on Paris time.

### Removed
- The unused energy-flow diagram component.
- The Hoymiles MS-2A battery (collector, cards, flow diagram, health entry). Past days in the history table keep its figures.
- Unused settings: `HOYMILES_DTU_IP`, `HOYMILES_POLL_INTERVAL_MS`, `HOYMILES_MS2A_STATION_ID`, `SHELLY_POLL_INTERVAL_MS`, `VICTRON_VRM_TOKEN`, `VICTRON_VRM_INSTALLATION_ID`.
