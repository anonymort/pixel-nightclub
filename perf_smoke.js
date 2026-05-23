import puppeteer from 'puppeteer';
import { VISUAL_QA_BASE_URL } from './src/config/experience.js';

function withPerfParams(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set('visualQaSeed', 'perf-smoke');
  url.searchParams.set('perf', '1');
  return url.toString();
}

async function samplePerf(page, label, cameraPosition, lookAt) {
  await page.evaluate(
    (position, target) => {
      window.sceneManager.camera.position.set(position.x, position.y, position.z);
      window.sceneManager.camera.lookAt(target.x, target.y, target.z);
      window.sceneManager.camera.updateMatrixWorld(true);
      window.sceneManager.camera.updateProjectionMatrix();
    },
    cameraPosition,
    lookAt
  );

  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const startedAt = performance.now();
        function tick() {
          if (performance.now() - startedAt >= 1500) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })
  );

  return page.evaluate((sampleLabel) => {
    const metrics = window.hearthsideApp.performance.getMetrics();
    return {
      label: sampleLabel,
      fps: metrics.fps,
      frameTimeMs: metrics.frameTimeMs,
      drawCalls: metrics.drawCalls,
      triangles: metrics.triangles,
      activeMeshes: metrics.activeMeshes,
      activeLights: metrics.activeLights,
      qualityTier: metrics.qualityTier,
      activeSections: [...window.hearthsideApp.mapBuilder.activeSections],
    };
  }, label);
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.setViewport({ width: 1280, height: 720 });

  await page.goto(withPerfParams(VISUAL_QA_BASE_URL), { waitUntil: 'networkidle2' });
  await page.waitForSelector('#btn-start');
  await page.click('#btn-start');
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const samples = [
    {
      expectedSection: 'exteriorDecor',
      sample: await samplePerf(
        page,
        'exterior',
        { x: -13, y: 1.7, z: -2.5 },
        { x: -5.2, y: 1.4, z: -2.8 }
      ),
    },
    {
      expectedSection: 'cloakroomDecor',
      sample: await samplePerf(
        page,
        'cloakroom',
        { x: -1.7, y: 1.7, z: 5.7 },
        { x: -0.1, y: 1.5, z: 7.8 }
      ),
    },
    {
      expectedSection: 'barDecor',
      sample: await samplePerf(page, 'bar', { x: 8.5, y: 1.7, z: 3.4 }, { x: 9, y: 1.3, z: 9.5 }),
    },
    {
      expectedSection: 'loungeDecor',
      sample: await samplePerf(
        page,
        'lounge',
        { x: 10.5, y: 1.7, z: -12 },
        { x: 13, y: 1.2, z: -18.5 }
      ),
    },
    {
      expectedSection: 'musicBoothDecor',
      sample: await samplePerf(
        page,
        'music_booth',
        { x: 13, y: 1.7, z: -1.4 },
        { x: 18, y: 1.55, z: 0 }
      ),
    },
  ];

  console.table(samples.map(({ sample }) => sample));

  const brokenSample = samples.find(
    ({ expectedSection, sample }) =>
      sample.drawCalls <= 0 ||
      sample.activeMeshes <= 0 ||
      !sample.activeSections.includes(expectedSection)
  );
  if (brokenSample) {
    throw new Error(`Invalid perf sample for ${brokenSample.sample.label}`);
  }

  await browser.close();
}

run().catch(async (error) => {
  console.error('Perf smoke failed:', error);
  process.exit(1);
});
