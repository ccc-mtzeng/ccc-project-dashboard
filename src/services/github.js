/**
 * GitHub API service for reading/writing solution JSON files
 * to a private data repository.
 *
 * Configuration:
 *   REPO_OWNER  — your GitHub username
 *   REPO_NAME   — the private data repo name
 *   TOKEN       — a fine-grained PAT with Contents read/write scope on that repo
 *
 * File layout in the data repo:
 *   solutions/{id}.json   — one file per solution
 *   meta/tags.json         — tag taxonomy
 *   meta/customers.json    — customer list
 *   meta/team-members.json — team member list
 *   index.json             — lightweight manifest of all solutions
 */

import { isoWeekKey } from "../data/utils";

const API_BASE = "https://api.github.com";

let config = {
  owner: "",
  repo: "",
  token: "",
};

export function configure({ owner, repo, token }) {
  config = { owner, repo, token };
}

export function isConfigured() {
  return !!(config.owner && config.repo && config.token);
}

function headers() {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function repoUrl(path) {
  return `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
}

// ─── UTF-8 safe base64 helpers ────────────────────────────────────
// btoa/atob only handle Latin1. These handle full Unicode (em-dashes,
// curly quotes, etc. from SharePoint/Word paste).

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  return btoa(binString);
}

function fromBase64(b64) {
  const binString = atob(b64);
  const bytes = Uint8Array.from(binString, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Read a JSON file from the data repo.
 * Returns { data, sha } where sha is needed for updates.
 */
export async function readFile(path) {
  const res = await fetch(repoUrl(path), { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  const content = fromBase64(json.content.replace(/\n/g, ""));
  return {
    data: JSON.parse(content),
    sha: json.sha,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True for sha-conflict responses (409, and 422 "sha mismatch"). */
function isConflictError(err) {
  return /\b(409|422)\b/.test(String(err?.message || err));
}

/** Raw Contents-API PUT — no retry. Internal; use writeFile/updateJsonFile. */
async function putFile(path, data, sha = null, message = "") {
  const body = {
    message: message || `Update ${path}`,
    content: toBase64(JSON.stringify(data, null, 2)),
  };
  if (sha) body.sha = sha;

  const res = await fetch(repoUrl(path), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return { sha: json.content.sha };
}

/**
 * Write (create or update) a JSON file in the data repo.
 * Pass sha from a previous readFile to update; omit for create.
 *
 * Self-heals sha conflicts once: the Contents API is eventually
 * consistent, so a write issued right after another commit can 409
 * even with a freshly read sha. On conflict we back off, re-read the
 * current sha, and retry the same content (last-write-wins — fine for
 * whole-file writes by a single user). Content that must MERGE with
 * the current file belongs in updateJsonFile instead.
 */
export async function writeFile(path, data, sha = null, message = "") {
  try {
    return await putFile(path, data, sha, message);
  } catch (err) {
    if (!isConflictError(err)) throw err;
    await sleep(750);
    const fresh = await readFile(path);
    return await putFile(path, data, fresh?.sha, message);
  }
}

/**
 * Read-modify-write a JSON file with conflict retry — for files that
 * get PATCHED rather than replaced (index.json, weekly timesheets,
 * activities). On a sha conflict the mutation is re-applied to a
 * freshly read copy, so no concurrent patch is lost.
 *
 * @param {string} path
 * @param {(current: any|null) => any} mutate  receives current contents
 *   (null if the file doesn't exist yet), returns the new contents
 * @param {string} message  commit message
 */
export async function updateJsonFile(path, mutate, message, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(700 * attempt);
    const existing = await readFile(path);
    const next = mutate(existing ? existing.data : null);
    try {
      return await putFile(path, next, existing?.sha, message);
    } catch (err) {
      if (!isConflictError(err)) throw err;
      lastErr = err;
    }
  }
  throw new Error(
    `Save conflict persisted after ${maxAttempts} attempts (${lastErr.message}). Please try again.`
  );
}

/**
 * Delete a file from the data repo.
 */
export async function deleteFile(path, sha, message = "") {
  const res = await fetch(repoUrl(path), {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
    }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
}

// ─── Solution-specific helpers ───────────────────────────────────────

/**
 * Load the index manifest (lightweight list of all solutions).
 */
export async function loadIndex() {
  const result = await readFile("index.json");
  return result ? result : { data: [], sha: null };
}

/**
 * Load a single solution's full data.
 */
export async function loadSolution(id) {
  return readFile(`solutions/${id}.json`);
}

/**
 * Save a solution and update the index manifest.
 */
/** Build the lightweight index.json entry for a solution. */
function indexEntryFor(solution) {
  return {
    id: solution.id,
    title: solution.title,
    customer: solution.customer,
    status: solution.status,
    go_live_date: solution.go_live_date,
    total_hours: solution.total_hours,
    tags: solution.tags,
  };
}

/** Upsert solutions into an index array (mutation-safe copy). */
function patchIndex(index, solutions) {
  const next = [...(index || [])];
  for (const solution of solutions) {
    const entry = indexEntryFor(solution);
    const idx = next.findIndex((s) => s.id === solution.id);
    if (idx >= 0) next[idx] = entry;
    else next.push(entry);
  }
  return next;
}

export async function saveSolution(solution) {
  // Save the full solution file (writeFile self-heals sha conflicts)
  const existing = await readFile(`solutions/${solution.id}.json`);
  const { sha: newSha } = await writeFile(
    `solutions/${solution.id}.json`,
    solution,
    existing?.sha,
    `Update solution: ${solution.title}`
  );

  // Patch index.json with conflict retry — the read-modify-write loop
  // re-applies the patch to a fresh copy if a 409 hits.
  await updateJsonFile(
    "index.json",
    (index) => patchIndex(index, [solution]),
    "Update index"
  );

  return { sha: newSha };
}

/**
 * Batch-save multiple solutions: reads all SHAs in parallel,
 * @param {import("../data/types").Solution[]} solutions
 *
 * then writes each file sequentially (GitHub commits update branch HEAD,
 * so parallel writes to the same branch 409 even on different files).
 * Reads and writes index.json once at the end.
 */
export async function saveSolutionsBatch(solutions) {
  // Read all current SHAs in parallel (reads don't conflict)
  const existing = await Promise.all(
    solutions.map((s) => readFile(`solutions/${s.id}.json`))
  );

  // Write solution files sequentially (each creates a commit on the branch)
  for (let i = 0; i < solutions.length; i++) {
    await writeFile(
      `solutions/${solutions[i].id}.json`,
      solutions[i],
      existing[i]?.sha,
      `Update solution: ${solutions[i].title}`
    );
  }

  // Patch index once, with conflict retry
  await updateJsonFile(
    "index.json",
    (index) => patchIndex(index, solutions),
    "Update index (batch)"
  );
}

// ─── Timesheet helpers ─────────────────────────────────────────────

/**
 * Load the Kantata activities config.
 */
export async function loadActivities() {
  const result = await readFile("config/activities.json");
  return result ? result : { data: [], sha: null };
}

/**
 * Save the Kantata activities config.
 */
export async function saveActivities(activities, _sha = null) {
  // sha param kept for call-site compatibility but ignored — the
  // update loop always reads fresh and retries conflicts.
  return updateJsonFile(
    "config/activities.json",
    () => activities,
    "Update activities"
  );
}

/**
 * Load a weekly timesheet. weekKey is ISO format: "2026-W19"
 */
export async function loadTimesheet(weekKey) {
  const result = await readFile(`timesheets/${weekKey}.json`);
  return result ? result : { data: { week: weekKey, entries: [] }, sha: null };
}

/**
 * Save a weekly timesheet.
 */
export async function saveTimesheet(weekKey, data, sha = null) {
  if (!sha) {
    const existing = await readFile(`timesheets/${weekKey}.json`);
    sha = existing?.sha || null;
  }
  return writeFile(`timesheets/${weekKey}.json`, data, sha, `Update timesheet ${weekKey}`);
}

/**
 * Delete a solution and remove it from the index.
 */
export async function deleteSolution(id) {
  const existing = await readFile(`solutions/${id}.json`);
  if (existing) {
    await deleteFile(
      `solutions/${id}.json`,
      existing.sha,
      `Delete solution: ${id}`
    );
  }

  await updateJsonFile(
    "index.json",
    (index) => (index || []).filter((s) => s.id !== id),
    "Update index"
  );
}

// ─── Timesheet aggregation helpers ───────────────────────────────────

const ENTRIES_CACHE_KEY = "st_entries_cache_v1";

function readEntriesCache() {
  try {
    const raw = localStorage.getItem(ENTRIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : { files: {} };
  } catch {
    return { files: {} };
  }
}

function writeEntriesCache(cache) {
  try {
    localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded or storage unavailable — caching is best-effort.
  }
}

/**
 * List every timesheet file in the repo with its blob sha, using one
 * recursive Git Trees call (works past the Contents API's 1000-file
 * directory limit, and the shas drive the local cache below).
 *
 * @returns {Promise<Array<{path: string, sha: string}>>}
 */
export async function listTimesheetFiles() {
  const res = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/git/trees/HEAD?recursive=1`,
    { headers: headers() }
  );
  if (res.status === 404 || res.status === 409) return []; // empty repo
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const tree = await res.json();
  return (tree.tree || [])
    .filter(
      (f) =>
        f.type === "blob" &&
        f.path.startsWith("timesheets/") &&
        f.path.endsWith(".json")
    )
    .map((f) => ({ path: f.path, sha: f.sha }));
}

/**
 * Load all timesheet entries as one flat array.
 *
 * Strategy: one Trees call lists every file + blob sha; files whose
 * sha matches the localStorage cache are served locally, and only
 * changed/new files are fetched. Cold start = 1 + N requests; warm
 * start with no changes = 1 request total.
 *
 * @returns {Promise<Array<Object>>} flat array of time entries
 */
export async function loadAllEntries() {
  const files = await listTimesheetFiles();
  const cache = readEntriesCache();
  const nextCache = { files: {} };
  const allEntries = [];

  // Fetch only files whose blob sha changed (reads can run in parallel)
  const results = await Promise.all(
    files.map(async ({ path, sha }) => {
      const cached = cache.files[path];
      if (cached && cached.sha === sha) {
        return { path, sha, entries: cached.entries };
      }
      try {
        const result = await readFile(path);
        return { path, sha, entries: result?.data?.entries || [] };
      } catch {
        return { path, sha, entries: [] };
      }
    })
  );

  for (const { path, sha, entries } of results) {
    nextCache.files[path] = { sha, entries };
    allEntries.push(...entries);
  }

  // Deleted files fall out of the cache naturally (nextCache only
  // contains paths present in the current tree).
  writeEntriesCache(nextCache);
  return allEntries;
}

// ─── Entry tagging & splitting (shared by all views) ─────────────────

/**
 * Persist solution-tag changes to time entries.
 *
 * @param {Object<string, string|null>} tagEdits  { entryId: solutionId | null }
 * @param {import("../data/types").Entry[]} entries  must contain the edited
 *   entries (used to map entry id -> date -> week file).
 *
 * Groups edits by ISO week and does a sequential read-modify-write per
 * affected week file (parallel writes 409 on branch HEAD).
 */
export async function saveEntryTags(tagEdits, entries) {
  const weekChanges = {};
  for (const [entryId, solutionId] of Object.entries(tagEdits)) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) continue;
    const wk = isoWeekKey(entry.date);
    if (!weekChanges[wk]) weekChanges[wk] = {};
    weekChanges[wk][entryId] = solutionId;
  }
  for (const [weekKey, changes] of Object.entries(weekChanges)) {
    await updateJsonFile(
      `timesheets/${weekKey}.json`,
      (data) => ({
        week: weekKey,
        entries: (data?.entries || []).map((e) =>
          e.id in changes ? { ...e, solution_id: changes[e.id] } : e
        ),
      }),
      `Update tags: ${weekKey}`
    );
  }
}

/**
 * Replace the split children of a parent entry within its week file.
 * Pass children = [] to unsplit (remove all children).
 * @param {import("../data/types").Entry} parentEntry
 * @param {import("../data/types").Entry[]} children
 */
export async function saveSplitChildren(parentEntry, children) {
  const wk = isoWeekKey(parentEntry.date);
  await updateJsonFile(
    `timesheets/${wk}.json`,
    (data) => {
      const existing = data?.entries || [];
      const cleaned = existing.filter((e) => e.parent_id !== parentEntry.id);
      return {
        week: wk,
        entries: children.length > 0 ? [...cleaned, ...children] : cleaned,
      };
    },
    `Update splits: ${wk}`
  );
}
