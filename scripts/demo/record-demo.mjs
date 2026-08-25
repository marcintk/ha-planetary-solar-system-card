#!/usr/bin/env node
// Drives record-harness.html — a standalone dark-theme, 4-source-gallery rig, NOT the
// committed docs/index.html demo page — over Chromium, sampling real screenshots at fixed
// intervals so the card's own transitions (zoom animator, replay flourish) read as continuous
// motion. No synthetic cursor: the motion is the UI's own, not a pointer's.
//
// Landscape framing trick: the harness renders the card 1000px wide with `height: 560` capping
// the square orbit view — the view letterboxes inside generous side padding, and the gallery
// strip (position: overlay, the default) floats over the view rather than adding height, so
// the box stays landscape whether the strip is open or not.
//
// Read-only against the app: navigates and clicks real buttons exactly as a visitor would.
// Never writes to docs/index.html, docs/card.js, or any src/ file.
//
// Usage: node scripts/demo/record-demo.mjs [--out <gif-path>] [--at <ISO datetime>]
// Prereqs: npm run build:prod (docs/card.js must be current), ffmpeg on PATH.

import { chromium } from "playwright";
import http from "node:http";
import { createReadStream, existsSync, mkdtempSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../..", import.meta.url).pathname;
const HARNESS_URL_PATH = "/scripts/demo/record-harness.html";
const WIDTH = 1000;
const FPS = 10;
const OUT_WIDTH = 640; // final encoded gif width; height follows the card's own landscape box

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function serveRoot() {
  const server = http.createServer((req, res) => {
    const filePath = join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDriver(page, framesDir, clip) {
  let frame = 0;
  const shoot = async () => {
    await page.screenshot({ path: join(framesDir, `f${String(frame++).padStart(4, "0")}.png`), clip });
  };
  const hold = async (n) => {
    for (let i = 0; i < n; i++) await shoot();
  };
  const clickSel = (sel) =>
    page.evaluate(
      (s) => document.getElementById("demo-card").shadowRoot.querySelector(s).click(),
      sel
    );
  const click = (action) => clickSel(`[data-action="${action}"]`);
  const step = async (action, times, framesEach = 1) => {
    for (let i = 0; i < times; i++) {
      await click(action);
      await sleep(120);
      await hold(framesEach);
    }
  };
  return { hold, click, clickSel, step, frameCount: () => frame };
}

async function runScenario(page, d) {
  // gallery.mode is "off" in the harness so the strip starts closed and the click below is a
  // real, on-camera open — not just an already-open strip from load. Warm it up off-camera
  // first (open, wait for the NASA thumbnails to load, close) so the recorded open beat never
  // shows a "loading…" tile.
  await d.clickSel('[data-action="gallery"]');
  for (let i = 0; i < 60; i++) {
    const loaded = await page.evaluate(() =>
      [...document.getElementById("demo-card").shadowRoot.querySelectorAll(".gallery-thumb img")].filter(
        (n) => n.src && n.complete && n.naturalWidth > 0
      ).length
    );
    if (loaded >= 2) break;
    await sleep(500);
  }
  await d.clickSel('[data-action="gallery"]');
  await sleep(300);

  await d.hold(6); // closed beat
  await d.clickSel('[data-action="gallery"]'); // the on-camera open
  await d.hold(25); // opening beat: all 4 tiles on camera for ~2.5s
  await d.clickSel('[data-action="gallery"]'); // close, then continue into the nav demo
  await sleep(500);

  await d.hold(8); // settle on today
  await d.step("hour-forward", 14, 2); // Earth turns: the twilight cone sweeps round
  await d.hold(5);
  await d.step("day-forward", 12, 3); // Moon swings through its orbit, planets creep
  await d.hold(5);
  await d.click("today");
  await sleep(400);
  await d.hold(6);

  await d.step("zoom-out", 2, 5); // pull back to the outer planets
  await d.hold(6);
  await d.step("zoom-in", 2, 5);
  await d.hold(10); // resting frame before loop
}

async function main() {
  const outArg = process.argv.indexOf("--out");
  const outPath = outArg !== -1 ? process.argv[outArg + 1] : join(ROOT, "docs", "demo.gif");
  const atArg = process.argv.indexOf("--at");
  // Card always uses the real clock (new Date()) — no config override — so a fixed recording
  // time is injected by overriding Date globally before the page's own scripts run. Useful for
  // picking a moment when mymoon isn't below the observer's horizon (a real, expected state —
  // see record-demo.json's known_risk — but not one you want landing in the opening beat).
  const fixedTime = atArg !== -1 ? new Date(process.argv[atArg + 1]).getTime() : null;

  if (!existsSync(join(ROOT, "docs", "card.js"))) {
    throw new Error("docs/card.js missing — run `npm run build:prod` first");
  }

  const framesDir = mkdtempSync(join(tmpdir(), "record-demo-frames-"));
  const server = await serveRoot();
  const port = server.address().port;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 900 },
    deviceScaleFactor: 2,
  });
  if (fixedTime !== null) {
    await context.addInitScript((fixed) => {
      const RealDate = Date;
      class FakeDate extends RealDate {
        constructor(...args) {
          super(...(args.length === 0 ? [fixed] : args));
        }
        static now() {
          return fixed;
        }
      }
      globalThis.Date = FakeDate;
    }, fixedTime);
  }
  const page = await context.newPage();

  let clip;
  try {
    await page.goto(`http://127.0.0.1:${port}${HARNESS_URL_PATH}`);
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => window.__ready === true)) break;
      await sleep(250);
    }
    await sleep(2000);

    const box = await page.evaluate(() => document.getElementById("wrap").getBoundingClientRect().toJSON());
    clip = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width / 2) * 2,
      height: Math.round(box.height / 2) * 2,
    };
    console.log("clip", clip);

    const d = makeDriver(page, framesDir, clip);
    await runScenario(page, d);
    console.log("frames", d.frameCount());
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }

  const palettePath = join(framesDir, "palette.png");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", join(framesDir, "f%04d.png"),
    "-vf", `scale=${OUT_WIDTH}:-2:flags=lanczos,palettegen=max_colors=48:stats_mode=diff`,
    palettePath,
  ]);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", join(framesDir, "f%04d.png"),
    "-i", palettePath,
    "-lavfi", `scale=${OUT_WIDTH}:-2:flags=lanczos[s];[s][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    outPath,
  ]);

  rmSync(framesDir, { recursive: true, force: true });
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
