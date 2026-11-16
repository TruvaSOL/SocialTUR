# Sociativeworld (working title)

A browser-based social city game: one shared low-poly 3D city where players work, earn a home, decorate it, visit each other and build shared landmarks together.

Status: **Stage 3 — arrival (in progress).** Welcome, age gate, character editor and the ferry arrival work for guests; linking an account by e-mail link gives the permanent resident number (schema in `supabase/migrations`). A modern coastal town on an island: 52 plots that fill with three house models as the town grows, four staged shared buildings (harbour, town hall, cafe, park), a ferry pier, forest camp and fishing hut, a free camera, an eye-level view and up to 200 walking characters.

Live build: https://socialtur.pages.dev (Cloudflare Pages, deploys automatically from `main`).

## Run

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` type-checks, builds to `dist/` and fails if the output exceeds the 6 MB first-load budget.
Add `?stats` to the address (or press the Stats button) for the measurement overlay, and `?quality=1` (1-6) to hold one quality step while measuring.

## Documents

| File | Contents |
|------|----------|
| [docs/PRD.md](docs/PRD.md) | The owner's original brief (Turkish) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Dated decisions; overrides the PRD where they differ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture summary |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Database model draft |
| [docs/PERF_BUDGET.md](docs/PERF_BUDGET.md) | Performance and content budgets |
| [docs/ACCOUNTS.md](docs/ACCOUNTS.md) | Accounts the owner needs to create |
| [docs/IDEAS.md](docs/IDEAS.md) | Out-of-scope ideas, not to be built |
| [ASSETS.md](ASSETS.md) | Third-party assets and verified licences |

Code and comments are written in English; project documents for the owner are in Turkish.
