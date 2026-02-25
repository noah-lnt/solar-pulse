# SolarPulse

Dashboard de supervision temps reel pour installation solaire hybride residentielle. Agregation de donnees multi-equipements (Hoymiles, Victron, Shelly) dans une interface moderne avec WebSocket et persistance PostgreSQL.

## Screenshots

### Dark mode

![Overview Dark](docs/screenshots/dark-1.png)

### Light mode

![Batteries Light](docs/screenshots/white-2.png)

## Hardware

L'installation solaire supervisee par SolarPulse est composee de :

| Equipement | Role | Protocole |
|---|---|---|
| **Panneaux solaires** | Production photovoltaique | — |
| **Hoymiles micro-onduleur** | Conversion DC/AC + monitoring PV | REST API (Cloud neapi.hoymiles.com) |
| **Hoymiles MS-2A** | Batterie integree 2,4 kWh + passerelle | REST API (Cloud neapi.hoymiles.com) |
| **Victron MultiPlus** | Onduleur/chargeur hybride | MQTT (Venus OS local) |
| **Batterie LiFePO4 DIY** | Stockage 32 kWh (2x16 cellules) | MQTT via BMS + Venus OS |
| **Shelly Pro 3EM** | Compteur d'energie triphase | REST API (reseau local) |

### Schema de l'installation

```
                    Panneaux PV
                        │
                  Micro-onduleur
                    Hoymiles
                        │
              ┌─────────┼─────────┐
              │                   │
         Hoymiles MS-2A     Shelly Pro 3EM ──── Reseau / Victron
         (batterie 2,4kWh)    (compteur 3 phases)
                                  │
                            Victron MultiPlus
                                  │
                          Batterie LiFePO4 DIY
                            (32kWh, 2x16 cells)
```

## Stack technique

### Backend

- **Runtime :** Node.js 20 + TypeScript
- **Framework :** Express 4
- **Base de donnees :** PostgreSQL 16
- **Temps reel :** WebSocket natif (ws)
- **MQTT :** mqtt.js pour Victron Venus OS
- **Auth :** JWT + bcrypt

### Frontend

- **Framework :** React 18 + TypeScript
- **Build :** Vite 6
- **Styling :** Tailwind CSS 3.4 + shadcn/ui (New York)
- **Graphiques :** Recharts 2
- **Icones :** Lucide React

### Infrastructure

- **Conteneurisation :** Docker Compose (3 services)
- **Reverse proxy :** Traefik v3 (HTTPS Let's Encrypt, reseau `web`) + Nginx (proxy interne API/WS)
- **Base de donnees :** PostgreSQL 16 Alpine avec volume persistant
- **Builds :** Multi-stage Docker (Node builder → production slim)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│                                                       │
│  ┌────────────┐     ┌──────────────┐    ┌──────────┐ │
│  │  Frontend   │     │   Backend    │    │ Postgres │ │
│  │  Nginx/React│◄─WS─┤  Express/TS  ├───►│   16     │ │
│  │  Port 80    │     │  Port 3001   │    │          │ │
│  └─────┬──────┘     └──────┬───────┘    └──────────┘ │
│        │                   │                          │
│    Traefik           Polling / MQTT                   │
│   (externe)                │                          │
└────────────────────────────┼──────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
        │  Shelly   │  │ Hoymiles │  │ Victron  │
        │ Pro 3EM   │  │  Cloud   │  │ Venus OS │
        │  REST     │  │  REST    │  │  MQTT    │
        └──────────┘  └──────────┘  └──────────┘
```

### Collecteurs

Chaque equipement a son propre collecteur independant. Si un collecteur echoue, les autres continuent de fonctionner. Les dernieres valeurs connues sont conservees en cache pour eviter les trous de donnees.

| Collecteur | Source | Intervalle | Donnees |
|---|---|---|---|
| **Hoymiles PV** | Cloud API (HOYMILES_STATION_ID) | ~3s | Puissance, production jour/totale |
| **Hoymiles MS-2A** | Cloud API (HOYMILES_MS2A_STATION_ID) | ~3s | SOC, puissance charge/decharge |
| **Shelly Pro 3EM** | REST local | ~2s | 3 phases (V, A, W, PF, Hz), import/export Wh |
| **Victron MultiPlus** | MQTT Venus OS | Temps reel | Mode, tensions, puissance, charge |
| **LiFePO4 BMS** | MQTT via Venus OS | Temps reel | SOC, tensions cellules (2x16), equilibrage |

### Persistance

- **Historique :** Points minutaires stockes en PostgreSQL (stockage infini)
- **Donnees :** PV, reseau, batteries (SOC, puissance), mode Victron, import/export Wh
- **Memoire :** 24h en RAM pour acces rapide, chargement depuis la BDD au demarrage

## Fonctionnalites

- **Vue d'ensemble** — Production PV, etat des 2 batteries (MS-2A + LiFePO4), echanges reseau/Victron, switch Victron ON/OFF
- **Batteries** — Jauge SOC, puissance, details LiFePO4 (tension, courant, temperature, cycles), grille des cellules (2 packs x 16 cellules), etat Victron
- **Reseau** — Puissance par phase, totaux import/export, contexte Victron (reseau public vs echanges Victron)
- **Panneaux** — Puissance instantanee, production du jour, graphique 24h
- **Temps reel** — WebSocket avec indicateur LIVE et reconnexion automatique
- **Theme** — Mode clair / sombre avec persistance localStorage
- **Auth** — JWT avec inscription/connexion
- **Mode demo** — Donnees simulees realistes pour test sans hardware

## Installation

### Prerequis

- Docker et Docker Compose
- Reseau Traefik (`web`) existant avec HTTPS (Let's Encrypt)

### Mise en place

```bash
git clone https://github.com/votre-username/solar-pulse.git
cd solar-pulse

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos IPs et credentials

# Creer le reseau Traefik si necessaire
docker network create web

# Lancer
docker compose up -d --build
```

### Configuration

Editer le fichier `.env` :

```env
# PostgreSQL
POSTGRES_PASSWORD=votre_mot_de_passe
DATABASE_URL=postgresql://solarpulse:votre_mot_de_passe@postgres:5432/solarpulse

# Auth
JWT_SECRET=votre-secret-aleatoire-32-caracteres-minimum

# Shelly Pro 3EM
SHELLY_IP=192.168.1.XX

# Hoymiles Cloud
HOYMILES_EMAIL=votre@email.com
HOYMILES_PASSWORD=votre_mot_de_passe
HOYMILES_STATION_ID=123456
HOYMILES_MS2A_STATION_ID=789012

# Victron Venus OS
VICTRON_VENUS_IP=192.168.1.XX
VICTRON_MQTT_PORT=1883

# Mode demo (donnees simulees sans hardware)
DEMO_MODE=false

# Traefik
TRAEFIK_HOST=solarpulse.votre-domaine.com
```

### Mode demo

Pour tester sans materiel, activez le mode demo :

```env
DEMO_MODE=true
```

Le backend generera des donnees realistes avec courbe solaire sinusoidale, simulation de charge/decharge des batteries et variations aleatoires.

## Developpement

### Avec Docker (recommande)

Le fichier `docker-compose.dev.yml` expose PostgreSQL sur `localhost:5432` pour le dev local.

```bash
# 1. Lancer PostgreSQL en dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env (DATABASE_URL=postgresql://solarpulse:solarpulse_secret@localhost:5432/solarpulse)

# 3. Lancer le backend
cd backend
npm install
npm run dev

# 4. Lancer le frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

### Sans Docker

```bash
# Prerequis : PostgreSQL installe localement
# Creer la base et l'utilisateur, puis configurer DATABASE_URL dans .env

cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev  # autre terminal
```

Le frontend Vite proxifie automatiquement `/api/*` et `/ws` vers le backend local (port 3001).

## API

| Endpoint | Methode | Description |
|---|---|---|
| `/api/auth/login` | POST | Connexion (email, password) |
| `/api/auth/register` | POST | Inscription |
| `/api/status` | GET | Etat complet du systeme |
| `/api/history?range=24h` | GET | Historique (filtrable par duree) |
| `/api/health` | GET | Sante des collecteurs |
| `/api/victron/mode` | POST | Changer le mode Victron (on/off/charger/inverter) |
| `/ws` | WS | Flux temps reel (SystemState toutes les 2-3s) |

## Structure du projet

```
solar-pulse/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── index.ts              # Serveur Express + boucle polling
│       ├── aggregator.ts         # Agregation + historique + persistance
│       ├── db.ts                 # PostgreSQL init + migrations
│       ├── websocket.ts          # Serveur WebSocket
│       ├── config.ts             # Variables d'environnement
│       ├── auth/                 # JWT + bcrypt
│       ├── collectors/           # Shelly, Hoymiles, Victron
│       └── routes/               # Endpoints REST
└── frontend/
    ├── Dockerfile
    ├── nginx.conf                # Proxy API/WS + cache statique
    └── src/
        ├── App.tsx               # Routing auth
        ├── components/           # UI (shadcn/ui + custom)
        ├── pages/                # Vue d'ensemble, Batteries, Reseau, Panneaux
        ├── hooks/                # useWebSocket, useSystemState, useTheme, useAuth
        └── lib/                  # Types, utilitaires, API client
```

## License

MIT
