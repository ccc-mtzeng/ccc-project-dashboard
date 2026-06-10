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

/**
 * Write (create or update) a JSON file in the data repo.
 * Pass sha from a previous readFile to update; omit for create.
 */
export async function writeFile(path, data, sha = null, message = "") {
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
export async function saveSolution(solution) {
  // Save the full solution file
  const existing = await readFile(`solutions/${solution.id}.json`);
  const { sha: newSha } = await writeFile(
    `solutions/${solution.id}.json`,
    solution,
    existing?.sha,
    `Update solution: ${solution.title}`
  );

  // Update index.json
  const indexResult = await loadIndex();
  const index = indexResult.data;
  const entry = {
    id: solution.id,
    title: solution.title,
    customer: solution.customer,
    status: solution.status,
    go_live_date: solution.go_live_date,
    total_hours: solution.total_hours,
    tags: solution.tags,
  };

  const idx = index.findIndex((s) => s.id === solution.id);
  if (idx >= 0) {
    index[idx] = entry;
  } else {
    index.push(entry);
  }

  await writeFile("index.json", index, indexResult.sha, "Update index");

  return { sha: newSha };
}

/**
 * Batch-save multiple solutions: reads all SHAs in parallel,
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

  // Read index once, patch all entries, write once
  const indexResult = await loadIndex();
  const index = indexResult.data;

  for (const solution of solutions) {
    const entry = {
      id: solution.id,
      title: solution.title,
      customer: solution.customer,
      status: solution.status,
      go_live_date: solution.go_live_date,
      total_hours: solution.total_hours,
      tags: solution.tags,
    };
    const idx = index.findIndex((s) => s.id === solution.id);
    if (idx >= 0) {
      index[idx] = entry;
    } else {
      index.push(entry);
    }
  }

  await writeFile("index.json", index, indexResult.sha, "Update index (batch)");
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
export async function saveActivities(activities, sha = null) {
  if (!sha) {
    const existing = await readFile("config/activities.json");
    sha = existing?.sha || null;
  }
  return writeFile("config/activities.json", activities, sha, "Update activities");
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

  const indexResult = await loadIndex();
  const index = indexResult.data.filter((s) => s.id !== id);
  await writeFile("index.json", index, indexResult.sha, "Update index");
}

// ─── Timesheet aggregation helpers ───────────────────────────────────

/**
 * List all weekly timesheet file keys (e.g. ["2026-W14", "2026-W15", ...]).
 */
export async function listTimesheets() {
  const res = await fetch(repoUrl("timesheets"), { headers: headers() });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const files = await res.json();
  return files
    .filter((f) => f.name.endsWith(".json"))
    .map((f) => f.name.replace(".json", ""));
}

/**
 * Load all timesheet files and return a flat array of all entries.
 */
export async function loadAllEntries() {
  const weeks = await listTimesheets();
  const results = await Promise.all(
    weeks.map((wk) =>
      loadTimesheet(wk).catch(() => ({ data: { entries: [] } }))
    )
  );
  return results.flatMap((r) => r.data?.entries || []);
}
