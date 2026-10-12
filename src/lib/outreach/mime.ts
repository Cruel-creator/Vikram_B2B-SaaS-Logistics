/**
 * Builds an RFC 822 / MIME message (optionally with the deck attached) for the
 * "Download .eml" option, which opens as a ready draft in Outlook / Apple Mail.
 * Gmail itself is reached through its compose URL in the outreach panel, no API.
 */

const b64 = (s: string | Uint8Array) => Buffer.from(s).toString("base64");
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (s: string) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export interface Mail {
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; content: Uint8Array; mime: string };
  draftHeader?: boolean; // X-Unsent so mail clients open the file as an editable draft
}

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
