#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const MEDIA_DIR = path.join(ROOT_DIR, 'docs', 'media');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'umlens-docs-'));
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

function assertFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('Error: ffmpeg is required on PATH to encode animated WebP clips.');
    process.exit(1);
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.error(
      'Error: playwright is not installed.\nRun: npm install --no-save playwright && npx playwright install chromium'
    );
    process.exit(1);
  }
}

function runSync(cmd, args, extraEnv = {}) {
  execFileSync(cmd, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for preview server at ${url}`);
}

function encodeWebpFromFrames(frameSpecs, outputFilePath) {
  const clipDir = fs.mkdtempSync(path.join(TMP_DIR, 'clip-'));
  const concatLines = [];

  for (let i = 0; i < frameSpecs.length; i++) {
    const filePath = path.join(clipDir, `frame-${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(filePath, frameSpecs[i].buffer);
    concatLines.push(`file '${filePath.replace(/'/g, "'\\''")}'`);
    concatLines.push(`duration ${frameSpecs[i].duration.toFixed(2)}`);
  }

  // Concat demuxer expects the final frame repeated without a duration line
  const lastPath = path.join(clipDir, `frame-${String(frameSpecs.length - 1).padStart(2, '0')}.png`);
  concatLines.push(`file '${lastPath.replace(/'/g, "'\\''")}'`);

  const listPath = path.join(clipDir, 'frames.txt');
  fs.writeFileSync(listPath, `${concatLines.join('\n')}\n`, 'utf8');

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-vf',
      'fps=4,pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v',
      'libwebp_anim',
      '-lossless',
      '1',
      '-loop',
      '0',
      outputFilePath,
    ],
    { stdio: 'pipe' }
  );
}

async function main() {
  assertFfmpeg();
  const { chromium } = await loadPlaywright();

  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  console.log('Building UMLens bundle for local preview...');
  runSync('npx', ['vite', 'build'], { GITHUB_ACTIONS: 'false' });

  const previewProc = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1', '--strictPort'],
    {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: { ...process.env, GITHUB_ACTIONS: 'false' },
    }
  );

  let browser;
  try {
    await waitForServer(PREVIEW_URL);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 860 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const resetWorkspace = async ({ collapseSource = false } = {}) => {
      await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('svg line');
      await page.waitForTimeout(250);
      if (collapseSource) {
        const collapseBtn = page.locator('button[title="Collapse Source Panel"]');
        if (await collapseBtn.isVisible()) {
          await collapseBtn.click();
          await page.waitForTimeout(200);
        }
      }
    };

    // 1. Hero Workspace Screenshot (3-pane view with Inspector open)
    console.log('Capturing hero-workspace.png...');
    await resetWorkspace({ collapseSource: false });
    await page.locator('svg g.cursor-pointer text').filter({ hasText: 'POST /api/v1/checkout' }).first().click();
    await page.locator('aside').filter({ hasText: 'Arrow & Review Inspector' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('button[title="Fit Diagram Width"]').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(MEDIA_DIR, 'hero-workspace.png') });

    // 2. Group Box Rollups (group-rollup.webp)
    console.log('Capturing group-rollup.webp...');
    await resetWorkspace({ collapseSource: true });
    const mainPane = page.locator('main');
    const groupFrames = [];
    groupFrames.push({ buffer: await mainPane.screenshot(), duration: 1.2 });

    await page.locator('button[title*="Collapse \\"Core Commerce\\""]').click();
    await page.waitForTimeout(250);
    groupFrames.push({ buffer: await mainPane.screenshot(), duration: 1.4 });

    await page.locator('button[title*="Roll up every group box"]').click();
    await page.waitForTimeout(250);
    groupFrames.push({ buffer: await mainPane.screenshot(), duration: 1.4 });

    await page.locator('button[title*="Expand all group boxes"]').click();
    await page.waitForTimeout(250);
    groupFrames.push({ buffer: await mainPane.screenshot(), duration: 1.1 });

    encodeWebpFromFrames(groupFrames, path.join(MEDIA_DIR, 'group-rollup.webp'));

    // 3. Lifeline Hide & Coalescing (lifeline-hide.webp)
    console.log('Capturing lifeline-hide.webp...');
    await resetWorkspace({ collapseSource: true });
    const hideFrames = [];
    hideFrames.push({ buffer: await mainPane.screenshot(), duration: 1.1 });

    await page.locator('button[title="Hide Inventory Service"]').click();
    await page.waitForTimeout(250);
    hideFrames.push({ buffer: await mainPane.screenshot(), duration: 1.3 });

    await page.locator('button[title="Hide Payment Service"]').click();
    await page.waitForTimeout(250);
    hideFrames.push({ buffer: await mainPane.screenshot(), duration: 1.4 });

    await page.locator('button:has-text("Show All")').click();
    await page.waitForTimeout(250);
    hideFrames.push({ buffer: await mainPane.screenshot(), duration: 1.0 });

    encodeWebpFromFrames(hideFrames, path.join(MEDIA_DIR, 'lifeline-hide.webp'));

    // 4. Call-Tree, Branch & Divider Folding (folding-controls.webp)
    console.log('Capturing folding-controls.webp...');
    await resetWorkspace({ collapseSource: true });
    const foldFrames = [];
    foldFrames.push({ buffer: await mainPane.screenshot(), duration: 1.1 });

    await page.locator('svg g.cursor-pointer').filter({ hasText: 'OPT' }).first().click();
    await page.waitForTimeout(250);
    foldFrames.push({ buffer: await mainPane.screenshot(), duration: 1.3 });

    await page.locator('svg g.cursor-pointer').filter({ hasText: 'Checkout & Fraud Check' }).first().click();
    await page.waitForTimeout(250);
    foldFrames.push({ buffer: await mainPane.screenshot(), duration: 1.4 });

    await page.locator('button:has-text("Expand All")').click();
    await page.waitForTimeout(250);
    foldFrames.push({ buffer: await mainPane.screenshot(), duration: 1.0 });

    encodeWebpFromFrames(foldFrames, path.join(MEDIA_DIR, 'folding-controls.webp'));

    // 5. Step-Through Presentation Mode (step-through.webp)
    console.log('Capturing step-through.webp...');
    await resetWorkspace({ collapseSource: true });
    const stepFrames = [];
    await page.locator('button[title*="step-by-step walkthrough"]').click();
    await page.waitForTimeout(250);
    stepFrames.push({ buffer: await mainPane.screenshot(), duration: 0.9 });

    for (let s = 0; s < 4; s++) {
      await page.locator('button:has-text("Next")').click();
      await page.waitForTimeout(220);
      stepFrames.push({ buffer: await mainPane.screenshot(), duration: s === 3 ? 1.3 : 0.8 });
    }

    encodeWebpFromFrames(stepFrames, path.join(MEDIA_DIR, 'step-through.webp'));

    // 6. Full-Width Toggle & Arrow Inspector (inspector-and-fullwidth.webp)
    console.log('Capturing inspector-and-fullwidth.webp...');
    await resetWorkspace({ collapseSource: false });
    const fullFrames = [];
    fullFrames.push({ buffer: await page.screenshot(), duration: 1.1 });

    await page.locator('button[title="Collapse Source Panel"]').click();
    await page.waitForTimeout(250);
    fullFrames.push({ buffer: await page.screenshot(), duration: 1.1 });

    await page.locator('svg g.cursor-pointer text').filter({ hasText: 'POST /api/v1/checkout' }).first().click();
    await page.locator('aside').filter({ hasText: 'Arrow & Review Inspector' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(250);
    fullFrames.push({ buffer: await page.screenshot(), duration: 1.5 });

    await page.locator('main button[title="Show Source Editor"]').click();
    await page.locator('header button[title="Close Inspector Drawer"]').click();
    await page.waitForTimeout(250);
    fullFrames.push({ buffer: await page.screenshot(), duration: 0.9 });

    encodeWebpFromFrames(fullFrames, path.join(MEDIA_DIR, 'inspector-and-fullwidth.webp'));

    console.log(`Captured documentation media in ${path.relative(ROOT_DIR, MEDIA_DIR)}`);
  } finally {
    if (browser) await browser.close();
    previewProc.kill('SIGTERM');
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
