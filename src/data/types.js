/**
 * Central JSDoc type definitions for the Solution Tracker data model.
 *
 * These give editors (VS Code etc.) type checking and autocomplete on
 * the core shapes without a TypeScript migration. Reference them from
 * other files with:
 *
 *   /** @param {import("../data/types").Solution} solution *​/
 *
 * The shapes mirror the JSON stored in the GitHub data repo.
 */

/**
 * @typedef {Object} Task
 * @property {string} name
 * @property {"scoping"|"development"|"testing"|"training"|"deployment"} category
 * @property {"not_started"|"in_progress"|"complete"} status
 * @property {number} [percent_complete] 0–100
 * @property {number} estimated_hours
 * @property {number} actual_hours      Deprecated for display — actuals
 *                                      derive from tagged time entries.
 * @property {string} [due_date]        ISO date (YYYY-MM-DD)
 */

/**
 * @typedef {Object} NoteLogEntry
 * @property {string} id
 * @property {string} author      GitHub username
 * @property {string} created_at  ISO timestamp
 * @property {string} text
 */

/**
 * @typedef {Object} Solution
 * @property {string} id            Slug, also the filename: solutions/{id}.json
 * @property {string} title
 * @property {string} customer      Display fallback — the linked engagement's
 *                                  customer is authoritative when present.
 * @property {string} author
 * @property {string} version
 * @property {string} status        Workflow code from STATUS_CONFIG ("1.1"–"7").
 * @property {string[]} tags        "category:subtag" taxonomy keys.
 * @property {Task[]} tasks
 * @property {number} total_hours   Estimated hours (sum of task estimates).
 * @property {string} [date_created]  ISO date
 * @property {string|null} [go_live_date] ISO date
 * @property {string} [design_url]
 * @property {string} [notes]       Free-text description.
 * @property {NoteLogEntry[]} [notes_log] Timestamped status log.
 * @property {string|null} [activity_id]  Linked engagement (Activity.id).
 * @property {boolean} [excluded]
 * @property {string} [excluded_note]
 */

/**
 * @typedef {Object} Entry
 * Time entry, stored in weekly files: timesheets/{ISO week}.json.
 * @property {string} id
 * @property {string} [parent_id]   Set on split children. A parent with
 *                                  children is hidden everywhere; the
 *                                  children represent it.
 * @property {string} activity_id   Engagement this time was billed to.
 *                                  Immutable after import by design.
 * @property {string} date          ISO date (YYYY-MM-DD)
 * @property {number} hours
 * @property {string} [notes]
 * @property {string|null} [solution_id] Manual tag linking to a Solution.
 * @property {string} [task_category]
 * @property {string} [engagement_task]
 * @property {string} [source]      e.g. "kantata-csv"
 * @property {string[]} [kantata_ids]
 */

/**
 * @typedef {Object} Activity
 * Engagement record, stored in config/activities.json.
 * @property {string} id        Lowercase slug (e.g. "usav-ns-ps").
 * @property {string} code      Kantata activity code.
 * @property {string} customer  Billing-truth customer name.
 * @property {string} [label]
 * @property {string} [default_task]
 * @property {boolean} [archived]
 */

export {};
