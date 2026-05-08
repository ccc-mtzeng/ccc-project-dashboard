# Solution Tracker — Roadmap

## Current: v0.1 — Static Prototype
- [x] Dashboard overview with stats
- [x] Solution list with status + process area filters
- [x] Timeline / Gantt view
- [x] Solution detail with task breakdown
- [x] NetSuite process area tag taxonomy
- [ ] Wire up GitHub API for CRUD (read/write JSON to private data repo)
- [ ] Add/edit solution form
- [ ] Add/edit task form
- [ ] GitHub OAuth or PAT-based auth

## Backlog

### Outlook Calendar Integration
**Priority:** High
**Effort:** Medium

Integrate with Microsoft Graph API to auto-pull hours from Outlook calendar events.

**Approach:**
- Register an Azure AD app (free) for Graph API access
- Add MSAL.js to the React app for OAuth login
- Query `GET /me/calendarView` with date range filters
- Aggregate event durations by solution tag

**Tagging convention (proposed):**
- Calendar events use a prefix: `[USAV]`, `[Relay]`, `[Zehnder]`
- Or use Outlook categories mapped to solution IDs
- Event subject optionally includes task type: `[USAV] Testing invoice request flow`

**Hour types:**
- **Testing / Solutioning:** Pulled from Outlook (variable, meeting-heavy)
- **Development:** Manual entry or formula-based (controlled burn across date range)

**Sync behavior:**
- Dashboard has a "Sync hours" button that pulls recent calendar data
- Computes actual_hours per solution per task category
- Writes updated totals back to the GitHub data repo
- Shows last-synced timestamp

### Future Ideas
- PDF generation of solution status reports
- Customer-level rollup view (all solutions for a given client)
- Team member workload view (hours across solutions per person)
- Burndown charts per solution
- Slack/Teams notifications for approaching go-live dates
- CSV/Excel export of hours data
- Solution design PDF upload + link storage
