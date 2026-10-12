/**
 * Gmail via the REST API with an OAuth refresh token (scope gmail.compose).
 * Creates drafts (with the deck attached) and sends them. No SDK needed.
 * Setup: scripts/gmail-auth.ts → GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.
 */

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!.trim(),
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google auth failed: ${json.error ?? res.status}`);
  return json.access_token;
}

const b64 = (s: string | Uint8Array) => Buffer.from(s).toString("base64");
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (s: string) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export interface Mail {
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; content: Uint8Array; mime: string };
  draftHeader?: boolean; // X-Unsent for .eml files so mail clients open them as drafts
}

/** RFC 822 / MIME message with an optional attachment. */
export function buildMime(m: Mail): string {
  const boundary = `vcpi_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    ...(m.draftHeader ? ["X-Unsent: 1"] : []),
  ];
  if (!m.attachment) {
    return [...headers, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(b64(m.body))].join("\r\n");
  }
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(m.body)),
    `--${boundary}`,
    `Content-Type: ${m.attachment.mime}; name="${m.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${m.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(m.attachment.content)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

const base64url = (s: string) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function createDraft(m: Mail): Promise<{ draftId: string; messageId: string }> {
  const token = await accessToken();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: base64url(buildMime(m)) } }),
  });
  const json = (await res.json()) as { id?: string; message?: { id: string }; error?: { message: string } };
  if (!res.ok || !json.id) throw new Error(`Gmail draft failed: ${json.error?.message ?? res.status}`);
  return { draftId: json.id, messageId: json.message?.id ?? "" };
}

export async function sendDraft(draftId: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftId }),
  });
  const json = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || !json.id) throw new Error(`Gmail send failed: ${json.error?.message ?? res.status}`);
  return json.id;
}
