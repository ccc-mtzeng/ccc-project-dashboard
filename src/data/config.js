/**
 * Solution Tracker configuration.
 *
 * Update these values after setting up your GitHub OAuth App
 * and Cloudflare Worker.
 */

export const AUTH_CONFIG = {
  // GitHub OAuth App client ID (public, safe to commit)
  clientId: "Ov23liUqmgzm5WUGJmfu",

  // Cloudflare Worker URL (handles token exchange + PDF parsing)
  workerUrl: "https://solution-tracker-auth.ccc-st.workers.dev",

  // Where GitHub redirects after auth — must match your OAuth App settings
  redirectUri: "https://ccc-mtzeng.github.io/ccc-project-dashboard/",

  // GitHub usernames allowed to access the dashboard (lowercase).
  // Empty array = allow anyone who authenticates.
  // UX-only fast-fail. Real enforcement is the Worker's ALLOWED_USERS
  // secret (checked server-side before the token is ever released) plus
  // the data repo's own permissions.
  allowedUsers: ["ccc-mtzeng"],
};

export const DATA_CONFIG = {
  // The private repo where solution JSON files are stored
  owner: "ccc-mtzeng",
  repo: "ccc-project-data",
};
