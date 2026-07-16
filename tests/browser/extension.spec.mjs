import { AxeBuilder } from "@axe-core/playwright";
import { chromium, expect, test } from "@playwright/test";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const productionExtension = path.join(projectRoot, "chrome-extension");
const fixtureHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Unicode caption fixture</title></head>
  <body>
    <h1>Local video fixture</h1>
    <video id="video"></video>
    <script>
      const track = document.querySelector("video").addTextTrack("captions", "Fixture", "vi");
      track.mode = "hidden";
      track.addCue(new VTTCue(1, 2.5, "Xin chào 世界"));
      track.addCue(new VTTCue(1, 2.5, "Xin chào 世界"));
    </script>
  </body>
</html>`;

let server;
let fixtureOrigin;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/fixture") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixtureHtml);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  fixtureOrigin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function extensionPath(outputDir, grantOptionalPermissions) {
  if (!grantOptionalPermissions) return productionExtension;
  const directory = await mkdtemp(path.join(tmpdir(), "subtitle-extension-browser-"));
  await cp(productionExtension, directory, { recursive: true });
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.name = `${manifest.name} Browser Fixture`;
  manifest.permissions = [...manifest.permissions, "debugger"];
  manifest.optional_permissions = manifest.optional_permissions.filter((permission) => permission !== "debugger");
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return directory;
}

async function launchExtension(testInfo, { grantOptionalPermissions = true } = {}) {
  const unpacked = await extensionPath(testInfo.outputDir, grantOptionalPermissions);
  const context = await chromium.launchPersistentContext(testInfo.outputPath("profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${unpacked}`, `--load-extension=${unpacked}`],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  return { context, extensionId, worker };
}

async function openPopup(context, extensionId, activePage) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await activePage.bringToFront();
  return popup;
}

async function expectAccessible(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

test("extracts one canonical Unicode cue from a real tab", async ({}, testInfo) => {
  const { context, extensionId } = await launchExtension(testInfo);
  try {
    const fixture = context.pages()[0] ?? (await context.newPage());
    await fixture.goto(`${fixtureOrigin}/fixture`);
    const popup = await openPopup(context, extensionId, fixture);
    await expectAccessible(popup);

    await popup.getByRole("button", { name: "Extract From Active Tab" }).click();
    await expect(popup.getByRole("status")).toHaveText("Copied 1 loaded cues as SRT.");
    await expect(popup.locator("#output-count")).toHaveText("1 cue");
    await expect(popup.locator("#output")).toHaveValue(
      "1\n00:00:01,000 --> 00:00:02,500\nXin chào 世界",
    );
    await expectAccessible(popup);
  } finally {
    await context.close();
  }
});

test("reports restricted pages without exposing stale output", async ({}, testInfo) => {
  const { context, extensionId } = await launchExtension(testInfo);
  try {
    const restricted = context.pages()[0] ?? (await context.newPage());
    await restricted.goto("chrome://settings/");
    const popup = await openPopup(context, extensionId, restricted);
    await popup.getByRole("button", { name: "Extract From Active Tab" }).click();
    await expect(popup.getByRole("status")).toContainText("Extraction failed:");
    await expect(popup.locator("#output-count")).toHaveText("Error");
    await expect(popup.locator("#output")).toHaveValue("");
    await expectAccessible(popup);
  } finally {
    await context.close();
  }
});

test("tracks debugger stop and unexpected detach in the MV3 worker", async ({}, testInfo) => {
  const { context, extensionId, worker } = await launchExtension(testInfo);
  try {
    const fixture = context.pages()[0] ?? (await context.newPage());
    await fixture.goto(`${fixtureOrigin}/fixture`);
    const popup = await openPopup(context, extensionId, fixture);

    await popup.getByRole("button", { name: "Start Scan" }).click();
    await expect(popup.getByRole("status")).toContainText("Advanced scan attached.");
    await popup.getByRole("button", { name: "Stop" }).click();
    await expect(popup.getByRole("status")).toHaveText("Deep scan stopped.");

    await popup.getByRole("button", { name: "Start Scan" }).click();
    await expect(popup.getByRole("status")).toContainText("Advanced scan attached.");
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.debugger.detach({ tabId: tab.id });
    });
    await popup.getByRole("button", { name: "Refresh" }).click();
    await expect(popup.getByRole("status")).toHaveText("Deep scan is not running.");
  } finally {
    await context.close();
  }
});

test("keeps popup controls keyboard reachable with an explicit live region", async ({}, testInfo) => {
  const { context, extensionId } = await launchExtension(testInfo);
  try {
    const fixture = context.pages()[0] ?? (await context.newPage());
    await fixture.goto(`${fixtureOrigin}/fixture`);
    const popup = await openPopup(context, extensionId, fixture);
    await expect(popup.getByRole("status")).toHaveAttribute("aria-live", "polite");
    await popup.locator("body").click({ position: { x: 1, y: 1 } });
    const order = ["extract", "start-scan", "refresh-scan", "stop-scan", "output"];
    for (const id of order) {
      await popup.keyboard.press("Tab");
      await expect(popup.locator(`#${id}`)).toBeFocused();
    }
    await expectAccessible(popup);
  } finally {
    await context.close();
  }
});

test("shows a deterministic denial state for optional debugger access", async ({}, testInfo) => {
  const { context, extensionId } = await launchExtension(testInfo, { grantOptionalPermissions: false });
  try {
    const fixture = context.pages()[0] ?? (await context.newPage());
    await fixture.goto(`${fixtureOrigin}/fixture`);
    const popup = await openPopup(context, extensionId, fixture);
    await popup.getByRole("button", { name: "Start Scan" }).click({ noWaitAfter: true });
    await expect(popup.getByRole("status")).toHaveText("Advanced scan needs Chrome debugger permission.");
  } finally {
    await context.close();
  }
});
