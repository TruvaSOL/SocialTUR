# Sociativeworld (working title)

A browser stadium: people who get a ticket code on Instagram enter through a web link, make a character and take their seat in a 50,000-seat football stadium. First come, best seats. Chat is the only interaction.

Status: **stadium.** Ticket codes, seats by arrival order, character editor, chat (presets only under 18). See `docs/DECISIONS.md` #34-#41.

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
Add `?demo` to fill the stands with made-up fans (nothing is sent to the server), `?kod=XXXX-XXXX` to pre-fill a ticket code, `?stats` (or press the Stats button) for the measurement overlay, and `?quality=1` (1-6) to hold one quality step while measuring.

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
