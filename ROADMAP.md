# Solution Tracker — Roadmap

## Current: v0.2 — Live Data + Timesheet

### Done
- [x] Dashboard overview with stats
- [x] Solution list with status + process area filters
- [x] Timeline / Gantt view
- [x] Solution detail with task breakdown + inline editing
- [x] NetSuite process area tag taxonomy
- [x] GitHub API CRUD (read/write JSON to private data repo)
- [x] PDF upload + AI parsing via GitHub Models
- [x] GitHub OAuth + Cloudflare Worker auth
- [x] Exclude/restore solutions
- [x] Overage indicators (red progress bars, stat cards)
- [x] design_url field for Word doc links
- [x] Duplicate detection on upload

### Timesheet Module (in progress)
- [x] Kantata activity lookup (CRUD in data repo)
- [x] Weekly timesheet view with day-grouped entries
- [x] Controlled burn blocks (date range, auto-distributed hours)
- [x] Quick-add inline entry form with advanced fields (solution link, task category, engagement task, ticket)
- [x] Submitted/pending toggle per entry
- [x] Pending-only filter
- [x] Copy-to-clipboard per entry and per day (tab-separated for Kantata grid paste)
- [x] Kantata export preview table (burns decomposed into daily rows)
- [x] Activity manager (add/edit/archive activities)
- [x] Sticky save bar with dirty tracking
- [x] Week navigation with ISO week keys
- [ ] Solution-linked time entries → computed actual_hours rollup on solution detail
- [ ] Time entries tab on solution detail view
- [ ] Customer-level time rollup view

### Backlog
- [ ] Auto-status: derive solution top-level status from subtask statuses
  - If any task is `in_progress` → solution becomes `in_progress`
  - If all tasks are `complete` → solution becomes `deployed` (or `complete`)
  - Starts as `draft` when no tasks have started
  - User can still manually override top-level status at any time
  - Client-side logic in SolutionDetail — compute suggested status on task change, apply if user hasn't overridden
- [ ] Move `allowedUsers` check from frontend to Cloudflare Worker
- [ ] Solution version history view (git commits per solution file)

## Backlog — Future

### Outlook Calendar Integration
**Priority:** Medium (lower now that Timesheet module handles manual entry)
**Effort:** Medium

Import Outlook calendar events as draft time entries. Useful as a convenience layer for days where time is already tracked in calendar events.

**Approach:**
- Microsoft Graph API via Azure AD app (MSAL.js)
- Pull `GET /me/calendarView` for a date range
- Present events in Timesheet view as "suggested" entries
- User assigns each to an activity and confirms
- No auto-mapping unless event subjects follow a convention

### Additional Views
- Customer-level rollup view (all solutions + time for a given client)
- Team member workload view (hours across solutions per person)
- Burndown charts per solution
- PDF generation of solution status reports
- CSV/Excel export of hours data
