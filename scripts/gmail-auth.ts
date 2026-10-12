/**
 * One-time Gmail connection (OAuth, scope gmail.compose = create + send drafts only).
 *
 *  1. Google Cloud Console → APIs & Services → enable "Gmail API".
 *  2. OAuth consent screen → External, Testing, add Vikram's Gmail as a test user.
 *  3. Credentials → Create OAuth client ID → "Desktop app". Put GOOGLE_CLIENT_ID and
 *     GOOGLE_CLIENT_SECRET in .env.local.
 *  4. npm run gmail:auth → sign in in the browser → GOOGLE_REFRESH_TOKEN is written to .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const id = process.env.GOOGLE_CLIENT_ID?.trim();
const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
if (!id || !secret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first (see the steps at the top of this file).");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.compose",
    access_type: "offline",
    prompt: "consent",
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") return res.end();
  const code = url.searchParams.get("code");
  if (!code) {
    res.end("No code in callback.");
    return;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const json = (await r.json()) as { refresh_token?: string; error?: string };
  if (!json.refresh_token) {
    res.end(`Failed: ${json.error ?? "no refresh token"}`);
    console.error("Token exchange failed:", json.error);
    process.exit(1);
  }
  const env = readFileSync(".env.local", "utf8");
  const line = `GOOGLE_REFRESH_TOKEN=${json.refresh_token}`;
  writeFileSync(".env.local", /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line) : `${env.trimEnd()}\n${line}\n`);
  res.end("Gmail connected. You can close this tab.");
  console.log("✓ GOOGLE_REFRESH_TOKEN saved to .env.local (value not printed).");
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open this URL and sign in with the Gmail account Vikram sends from:\n\n${authUrl}\n`);
});
