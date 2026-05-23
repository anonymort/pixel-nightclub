import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import {
  SCREENSHOT_ROOMS,
  VISUAL_QA_BASE_URL,
  resolveArtifactPath,
} from './src/config/experience.js';

const outDir = resolveArtifactPath('screenshots');
const visualQaSeed = process.env.VISUAL_QA_SEED || 'hearthside-screenshots';

async function installSeededRandom(page, seed) {
  await page.evaluateOnNewDocument((seedValue) => {
    function hashSeed(value) {
      let hash = 2166136261;
      const text = String(value);
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    let state = hashSeed(seedValue) || 0x9e3779b9;
    Math.random = () => {
      state += 0x6d2b79f5;
      let next = state;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

function withQaSeed(baseUrl, seed) {
  const url = new URL(baseUrl);
  url.searchParams.set('visualQaSeed', seed);
  return url.toString();
}

async function enableVisualQaMode(page) {
  await page.addStyleTag({
    content: `
      #hud,
      .hud,
      .navigation-panel,
      .audio-panel,
      .room-indicator,
      .room-notification,
      .toast,
      .pointer-lock-hint,
      [class*="hud"],
      [class*="panel"],
      [class*="indicator"],
      [class*="notification"] {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `,
  });
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await installSeededRandom(page, visualQaSeed);

  // Set to HD 720p viewport
  await page.setViewport({ width: 1280, height: 720 });

  const qaUrl = withQaSeed(VISUAL_QA_BASE_URL, 'screenshots');
  console.log(`Navigating to ${qaUrl}...`);
  await page.goto(qaUrl, { waitUntil: 'networkidle2' });

  console.log('Waiting for entrance button...');
  await page.waitForSelector('#btn-start');
  console.log('Clicking entrance button...');
  await page.click('#btn-start');
  await enableVisualQaMode(page);

  // Wait 4 seconds for procedural geometry and audio nodes to spin up
  await new Promise((resolve) => setTimeout(resolve, 4000));

  for (const room of SCREENSHOT_ROOMS) {
    console.log(`\nPositioning camera for ${room.name}...`);

    // Inject camera placement code into the browser context
    await page.evaluate(
      (pos, target) => {
        if (window.sceneManager && window.sceneManager.camera) {
          // Position camera
          window.sceneManager.camera.position.set(pos.x, pos.y, pos.z);

          // Use lookAt with three numeric coordinates
          window.sceneManager.camera.lookAt(target.x, target.y, target.z);

          // Force projection and matrix updates
          window.sceneManager.camera.updateMatrixWorld(true);
          window.sceneManager.camera.updateProjectionMatrix();

          console.log(
            `Placed camera at (${pos.x}, ${pos.y}, ${pos.z}) looking at (${target.x}, ${target.y}, ${target.z})`
          );
        } else {
          console.error('window.sceneManager or camera not found!');
        }
      },
      room.pos,
      room.target
    );

    // Wait 1.5 seconds for Three.js render loop to draw at the new camera angle
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const screenshotPath = path.join(outDir, `${room.name}_after.png`);
    console.log(`Taking screenshot for ${room.name} saved to ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
  }

  console.log('\nClosing browser...');
  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error running screenshot tool:', err);
  process.exit(1);
});
