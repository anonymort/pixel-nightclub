import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import {
  TOUR_KEYFRAMES,
  VISUAL_QA_BASE_URL,
  resolveArtifactPath,
} from './src/config/experience.js';

const outDir = resolveArtifactPath('tour_frames');

function withQaSeed(baseUrl, seed) {
  const url = new URL(baseUrl);
  url.searchParams.set('visualQaSeed', seed);
  return url.toString();
}

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
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
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Set to HD 720p viewport
  await page.setViewport({ width: 1280, height: 720 });

  const qaUrl = withQaSeed(VISUAL_QA_BASE_URL, 'tour');
  console.log(`Navigating to ${qaUrl}...`);
  await page.goto(qaUrl, { waitUntil: 'networkidle2' });

  console.log('Waiting for entrance button...');
  await page.waitForSelector('#btn-start');
  console.log('Clicking entrance button...');
  await page.click('#btn-start');
  await enableVisualQaMode(page);

  // Wait 4 seconds for procedural geometry and audio nodes to spin up
  await new Promise((resolve) => setTimeout(resolve, 4000));

  for (const frame of TOUR_KEYFRAMES) {
    console.log(`\nFrame ${frame.num}: Positioning camera for ${frame.name}...`);

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
      frame.pos,
      frame.target
    );

    // Wait 1.5 seconds for Three.js render loop to draw at the new camera angle
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const screenshotPath = path.join(outDir, `frame_${frame.num}.png`);
    console.log(`Taking screenshot: ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
  }

  console.log('\nClosing browser...');
  await browser.close();
  console.log('Tour recording captured successfully!');
}

run().catch((err) => {
  console.error('Error running tour recording:', err);
  process.exit(1);
});
