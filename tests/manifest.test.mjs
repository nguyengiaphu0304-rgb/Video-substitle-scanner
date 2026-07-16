import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../chrome-extension/manifest.json", import.meta.url), "utf8"),
);

test("keeps high-risk access optional and user initiated", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(!manifest.permissions.includes("debugger"));
  assert.ok(manifest.optional_permissions.includes("debugger"));
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
});

test("loads a module service worker and module popup", async () => {
  assert.equal(manifest.background.type, "module");
  const popup = await readFile(new URL("../chrome-extension/popup.html", import.meta.url), "utf8");
  assert.match(popup, /<script type="module" src="popup\.js"><\/script>/u);
});
