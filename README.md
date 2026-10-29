# SolarPulse

Real-time dashboard for a residential hybrid solar installation. It aggregates Hoymiles (PV), Victron (inverter + battery) and Shelly (energy meter) data, pushes it over WebSocket and stores a per-minute history in PostgreSQL.

## Screenshots

### Dark mode

![Overview Dark](docs/screenshots/dark-1.png)

### Light mode

![Batteries Light](docs/screenshots/white-2.png)

## Hardware

| Device | Role | Protocol |
|---|---|---|
| **Solar panels, 5 kWc** + Hoymiles micro-inverters | PV production | Hoymiles Cloud REST API |
| **Victron MultiPlus** | Inverter/charger; ON = the house runs on battery + PV, isolated from the grid by a switch | MQTT (Venus OS, LAN) |
| **LiFePO4 battery, 32 kWh** | Storage, managed by the Victron | MQTT through Venus OS (BMS) |
| **Shelly Pro 3EM** | Three-phase meter: measures the Linky when the Victron is OFF, the Victron line when ON | REST (LAN) |

## Stack

- **Backend:** Node.js 22, TypeScript, Express 4, PostgreSQL 16, `ws`, `mqtt`
- **Frontend:** React 18, Vite 6, Tailwind CSS 3.4, shadcn/ui, Recharts
- **Infrastructure:** Docker Compose (PostgreSQL, Cloudflare WARP, backend, frontend) behind Traefik

```
┌──────────────────────────── Docker Compose ─────────────────────────────┐
│  Frontend (nginx) ◄─WS── Backend (Express) ───► PostgreSQL              │
│        │                   │        │                                   │
│     Traefik                │      WARP ──► Hoymiles Cloud               │
└────────────────────────────┼────────────────────────────────────────────┘
                     LAN: Shelly (REST), Venus OS (MQTT)
```

## Collectors

| Collector | Source | Interval |
|---|---|---|
| **Hoymiles PV** | Cloud API, through WARP | Every 5 min between sunrise and sunset; daily yield every 15 min |
| **Shelly Pro 3EM** | REST, LAN | Every 10 s |
| **Victron MultiPlus** | MQTT, Venus OS | Real time |
| **LiFePO4 BMS** | MQTT, Venus OS | Real time |

Hoymiles blocks IPs that poll too often, so its collector is deliberately slow:

- **Daylight only.** Sunrise and sunset are computed from `SITE_LATITUDE` / `SITE_LONGITUDE`. At night no call is made, and the dashboard keeps today's yield until midnight.
- **One login per session.** The token is kept until Hoymiles rejects it; a rejection triggers one retry with a fresh token.
- **Backoff.** After a failure the collector waits 30 min, then 1 h, 2 h, 4 h, up to 6 h, and makes no call meanwhile. `/api/health` shows `nextAttempt`.
- **Separate egress IP.** In Docker, Hoymiles calls go through the `warp` service (`HOYMILES_PROXY_URL=http://warp:1080`). If the proxy is down, the call fails and backs off; it never falls back to a direct call.

When another collector fails, the dashboard keeps its last known values.

## Consumption and the Linky

The PV feeds the house side of the Shelly, so the house consumption is **PV + Shelly** in both Victron modes. What changes is where the energy comes from:

| Victron | Shelly measures | House is supplied by | Paid (Linky) |
|---|---|---|---|
| OFF | the Linky | Linky + PV | Shelly import |
| ON (island) | the Victron line | PV + battery | nothing |

The daily table counts Linky import/export from the Shelly energy counters, only over the minutes where the Victron was OFF. Self-consumption = share of the PV not exported to the Linky; self-sufficiency = share of the consumption not imported from the Linky.

## Configuration (`.env`)

| Variable | Meaning |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` | Database |
| `JWT_SECRET` | Token signing secret |
| `REGISTER_SECRET` | Code required to create the first account |
| `SITE_LATITUDE`, `SITE_LONGITUDE` | Site position, used for sunrise/sunset (required unless `DEMO_MODE=true`) |
| `SHELLY_IP` | Shelly Pro 3EM address on the LAN |
| `HOYMILES_API_URL` | Hoymiles Cloud base URL (required unless `DEMO_MODE=true`) |
| `HOYMILES_PROXY_URL` | HTTP proxy for Hoymiles calls; empty = direct. Docker Compose sets it to the `warp` service |
| `HOYMILES_EMAIL`, `HOYMILES_PASSWORD`, `HOYMILES_STATION_ID` | Hoymiles account and PV station |
| `VICTRON_VENUS_IP`, `VICTRON_MQTT_PORT` | Venus OS MQTT broker |
| `BACKEND_PORT`, `WS_HEARTBEAT_MS` | Backend port, WebSocket heartbeat |
| `DEMO_MODE` | `true` = simulated data, no device or cloud call |
| `TRAEFIK_HOST` | Public host name |

## Development

```bash
cd "$(git rev-parse --show-toplevel)"
cp .env.example .env          # DEMO_MODE=true needs no device
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
# in .env: DATABASE_URL=postgresql://solarpulse:solarpulse_secret@localhost:5432/solarpulse

cd backend && npm install && npm run dev      # API on :3001
cd frontend && npm install && npm run dev     # Vite proxies /api and /ws to :3001
cd backend && npm test                        # Hoymiles schedule tests
```

Never run with `DEMO_MODE=false` against the real `HOYMILES_API_URL` from a dev machine: every call counts against the Hoymiles rate limit.

## Deployment (local-nolan-sarl)

The stack runs on the product host, which is on the same LAN as the Shelly and the Venus OS. Only Hoymiles traffic leaves through WARP.

1. **Clone and configure** in `~/docker/project/solar-pulse`, then fill `.env` from `.env.example` (`DEMO_MODE=false`).
2. **Check the LAN**: `curl -s http://<SHELLY_IP>/rpc/Shelly.GetStatus` answers JSON and `nc -vz <VICTRON_VENUS_IP> 1883` succeeds.
3. **Start WARP and prove its egress**:
   ```bash
   docker compose up -d warp
   docker compose ps warp        # healthy
   docker compose exec warp curl -s -x http://127.0.0.1:1080 https://www.cloudflare.com/cdn-cgi/trace | grep -E 'ip=|warp='
   ```
   `warp=on` and an IP that is not the home IP.
4. **Stop any other SolarPulse instance first.** Two instances double the Hoymiles traffic. To keep its history, `pg_dump` the old database and restore it into the new `postgres` service before step 5. The Compose project is named `solarpulse`, so its volume is `solarpulse_pgdata`.
5. **Start**: `docker compose up -d --build`.
6. **Watch**: `docker compose logs -f backend | grep Hoymiles` shows `(proxy)` on every call. After 24 h, `docker compose logs --since 24h backend | grep -c '\[Hoymiles\] POST'` should stay around 200 or less, with none between sunset and sunrise.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Log in (email, password) |
| `/api/auth/register` | POST | Create the first account (`secret` = `REGISTER_SECRET`) |
| `/api/status` | GET | Full system state |
| `/api/history?range=24h` | GET | Per-minute history |
| `/api/history/daily?period=7d\|30d\|6m` | GET | Daily totals |
| `/api/health` | GET | Collector status, including Hoymiles `nextAttempt` |
| `/api/victron/mode` | POST | Set the Victron mode (on/off/charger/inverter) |
| `/ws` | WS | Real-time `SystemState` every 10 s |

## License

MIT
