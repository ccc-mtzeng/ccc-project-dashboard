# Authentication Setup Guide

This guide walks you through setting up GitHub OAuth for the Solution Tracker.

## Overview

The auth flow uses three pieces:

1. **GitHub OAuth App** — handles the "Sign in with GitHub" redirect
2. **Cloudflare Worker** — exchanges the OAuth code for a token (keeps your client secret safe)
3. **Frontend config** — points the app at the right OAuth App and Worker

Total setup time: ~10 minutes. Everything is on free tiers.

---

## Step 1: Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name:** `Solution Tracker`
   - **Homepage URL:** `https://ccc-mtzeng.github.io/ccc-project-dashboard/`
   - **Authorization callback URL:** `https://ccc-mtzeng.github.io/ccc-project-dashboard/`
4. Click **Register application**
5. Copy the **Client ID** (you'll need it in two places)
6. Click **Generate a new client secret** and copy it (you'll need it for the Worker)

---

## Step 2: Deploy the Cloudflare Worker

1. Install Wrangler (Cloudflare's CLI):
   ```bash
   npm install -g wrangler
   ```

2. Log in to Cloudflare:
   ```bash
   wrangler login
   ```

3. Navigate to the worker directory:
   ```bash
   cd worker/
   ```

4. Set the three secrets:
   ```bash
   wrangler secret put GITHUB_CLIENT_ID
   # paste your Client ID from Step 1

   wrangler secret put GITHUB_CLIENT_SECRET
   # paste your Client Secret from Step 1

   wrangler secret put ALLOWED_ORIGIN
   # enter: https://ccc-mtzeng.github.io
   ```

5. Deploy:
   ```bash
   wrangler deploy
   ```

6. Note the worker URL it prints (e.g. `https://solution-tracker-auth.your-subdomain.workers.dev`)

---

## Step 3: Update Frontend Config

Edit `src/data/config.js`:

```js
export const AUTH_CONFIG = {
  clientId: "your_client_id_from_step_1",
  workerUrl: "https://solution-tracker-auth.your-subdomain.workers.dev",
  redirectUri: "https://ccc-mtzeng.github.io/ccc-project-dashboard/",
  allowedUsers: ["ccc-mtzeng"],  // your GitHub username, lowercase
};

export const DATA_CONFIG = {
  owner: "ccc-mtzeng",
  repo: "ccc-solution-data",     // your private data repo name
};
```

Commit and push. The GitHub Action will rebuild and deploy.

---

## Step 4: Test

1. Visit `https://ccc-mtzeng.github.io/ccc-project-dashboard/`
2. Click **"Sign in with GitHub"**
3. Authorize the OAuth App on GitHub
4. You'll be redirected back and logged in
5. Your session persists in localStorage — no need to log in again until you click Sign Out

---

## Security Notes

- The **client secret** never touches the frontend — it lives only in the Cloudflare Worker's encrypted secrets.
- The **OAuth token** is stored in localStorage. It has `repo` and `read:user` scope.
- The **allowedUsers** list is checked client-side after auth. An unauthorized user can see the login page but gets an error after GitHub redirects back.
- The Cloudflare Worker's `ALLOWED_ORIGIN` CORS header ensures only your Pages domain can call the token exchange endpoint.

---

## Revoking Access

To revoke a session:
- Click **Sign Out** in the dashboard, or
- Go to [github.com/settings/applications](https://github.com/settings/applications) and revoke the OAuth App token.
