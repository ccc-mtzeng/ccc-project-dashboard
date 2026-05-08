# Solution Tracker

A project management dashboard for tracking NetSuite solution designs — built with React + Vite, deployed on GitHub Pages, with data stored in a private GitHub repo.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173/solution-tracker/](http://localhost:5173/solution-tracker/) in your browser.

## Project structure

```
src/
├── components/
│   ├── shared/          # Badge, ProgressBar, StatCard
│   ├── Dashboard.jsx    # Overview stats, hours by phase, upcoming deadlines
│   ├── SolutionList.jsx # Filterable solution cards
│   ├── SolutionDetail.jsx # Full task table + hours breakdown
│   └── Timeline.jsx     # Gantt-style view
├── data/
│   ├── constants.js     # Status configs, category colors, nav items
│   ├── taxonomy.js      # NetSuite process area tag taxonomy
│   ├── solutions.js     # Seed data (replaced by GitHub API reads)
│   └── utils.js         # Date helpers
├── services/
│   └── github.js        # GitHub API CRUD layer (ready to wire up)
├── App.jsx              # Root component with navigation
├── App.css              # Design tokens + global styles
└── main.jsx             # Entry point
```

## Deploying to GitHub Pages

1. Create a GitHub repo for this app (e.g. `solution-tracker`)
2. Update `base` in `vite.config.js` to match your repo name
3. Push to `main` — the GitHub Action builds and deploys automatically
4. Enable Pages in repo Settings → Pages → Source: GitHub Actions

## Data repo setup

Create a separate **private** repo for your solution data:

```
data-repo/
├── solutions/
│   ├── usav-invoice-request-upgrade.json
│   ├── relay-vendor-landed-costs.json
│   └── zehnder-rfq-pdf.json
├── meta/
│   ├── tags.json
│   ├── customers.json
│   └── team-members.json
└── index.json
```

Generate a fine-grained PAT scoped to that repo with `Contents: Read and write`.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features including Outlook calendar integration.
