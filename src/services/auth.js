/**
 * GitHub OAuth service for the Solution Tracker.
 *
 * Flow:
 *   1. User clicks "Sign in with GitHub"
 *   2. Redirect to GitHub OAuth authorize URL
 *   3. GitHub redirects back with ?code=xxx
 *   4. Frontend sends code to Cloudflare Worker
 *   5. Worker exchanges code for access_token using client_secret
 *   6. Frontend stores token in localStorage, fetches user profile
 *
 * Config (set in src/data/config.js):
 *   GITHUB_CLIENT_ID   — from your GitHub OAuth App
 *   WORKER_URL         — your Cloudflare Worker URL
 *   ALLOWED_USERS      — GitHub usernames allowed to access the dashboard
 *   DATA_REPO_OWNER    — owner of the private data repo
 *   DATA_REPO_NAME     — name of the private data repo
 */

import { AUTH_CONFIG } from "../data/config";

const STORAGE_KEY = "st_auth";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Redirect the user to GitHub's OAuth authorize page.
 */
export function redirectToGitHub() {
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.clientId,
    redirect_uri: AUTH_CONFIG.redirectUri,
    scope: "repo read:user",
  });
  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Handle the OAuth callback — exchange the code for a token,
 * fetch user info, and verify the user is allowed.
 *
 * Returns { token, username, avatar } on success.
 * Throws on failure.
 */
export async function handleOAuthCallback(code) {
  // Exchange code for token via Cloudflare Worker
  const tokenRes = await fetch(`${AUTH_CONFIG.workerUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.error) {
    throw new Error(tokenData.error || "Token exchange failed");
  }

  const token = tokenData.access_token;

  // The Worker verifies the allowlist server-side and returns the
  // verified identity. Fall back to fetching the profile directly if
  // an older Worker deployment doesn't include it.
  let username = tokenData.username;
  let avatar = tokenData.avatar;

  if (!username) {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!userRes.ok) {
      throw new Error("Failed to fetch user profile");
    }
    const user = await userRes.json();
    username = user.login;
    avatar = user.avatar_url;
  }

  // Client-side check is UX only — real enforcement lives in the Worker.
  if (
    AUTH_CONFIG.allowedUsers.length > 0 &&
    !AUTH_CONFIG.allowedUsers.includes(username.toLowerCase())
  ) {
    throw new Error(`User ${username} is not authorized to access this dashboard.`);
  }

  const auth = {
    token,
    username,
    avatar,
  };

  storeAuth(auth);
  return auth;
}
