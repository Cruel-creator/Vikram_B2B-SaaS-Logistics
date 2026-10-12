import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const SRC = files("src").concat(files("scripts"));

test("only /api/notes may call the manual-column RPC (pipeline can't touch notes)", () => {
  const callers = SRC.filter((f) => /rpc\(\s*["']update_vc_manual["']/.test(readFileSync(f, "utf8"))).map((f) => f.replace(/\\/g, "/"));
  assert.deepEqual(callers, ["src/app/api/notes/route.ts"]);
});

test("nothing updates vcs directly (signals go through update_vc_signals; seeding is insert-only)", () => {
  for (const f of SRC) {
    const src = readFileSync(f, "utf8");
    if (f.replace(/\\/g, "/") === "scripts/verify-e2e.ts") {
      // The e2e check proves the column GRANTs by attempting updates that must be refused;
      // every attempt targets the nil UUID, so even a broken GRANT could not change a row.
      const updates = src.match(/from\(["']vcs["']\)\s*\.update\([^\n]*/g) ?? [];
      assert.ok(src.includes(`const nil = "00000000-0000-0000-0000-000000000000"`), "verify-e2e must probe only the nil UUID");
      for (const u of updates) assert.match(u, /\.eq\("id", nil\)/, `verify-e2e update not pinned to nil UUID: ${u}`);
      assert.doesNotMatch(src, /from\(["']vcs["']\)\s*\.delete\(/);
      continue;
    }
    assert.doesNotMatch(src, /from\(["']vcs["']\)\s*\.(update|delete)\(/, `${f} updates/deletes vcs directly`);
    // Upserts are allowed only as insert-only (ON CONFLICT DO NOTHING).
    assert.doesNotMatch(src, /from\(["']vcs["']\)\s*\.upsert\((?![^;]*ignoreDuplicates:\s*true)/, `${f} upserts vcs without ignoreDuplicates`);
  }
});

test("no Claude/OpenAI SDKs anywhere (all AI = Gemini Flash)", () => {
  const pkg = readFileSync("package.json", "utf8");
  assert.doesNotMatch(pkg, /anthropic|openai/i);
  for (const f of SRC) assert.doesNotMatch(readFileSync(f, "utf8"), /@anthropic-ai|from ["']openai["']/, f);
});
