import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const outDir = '/Users/matt/.gemini/antigravity/brain/36faef96-870a-4f97-9dd8-8980282109da/tour_frames';

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
    `
  });
}

async function run() {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set to HD 720p viewport
  await page.setViewport({ width: 1280, height: 720 });
  
  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  console.log('Waiting for entrance button...');
  await page.waitForSelector('#btn-start');
  console.log('Clicking entrance button...');
  await page.click('#btn-start');
  await enableVisualQaMode(page);
  
  // Wait 4 seconds for procedural geometry and audio nodes to spin up
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  const tourKeyframes = [
    {
      num: '01',
      name: 'street_entrance',
      pos: { x: -16.0, y: 1.75, z: -5.4 },
      target: { x: -5.6, y: 1.85, z: -2.2 },
      desc: 'Exterior facade, sidewalk queue, sedan curb edge, trellis, brass HEARTHSIDE sign, and copper sconce lantern.'
    },
    {
      num: '02',
      name: 'approaching_door',
      pos: { x: -8.8, y: 1.7, z: -1.6 },
      target: { x: -3.8, y: 1.75, z: 0.4 },
      desc: 'Approaching the double-door entrance with brick framing.'
    },
    {
      num: '03',
      name: 'entering_lobby',
      pos: { x: -4.5, y: 1.7, z: 0.0 },
      target: { x: -1.0, y: 1.7, z: 3.0 },
      desc: 'Entering the warm charcoal-toned lobby area.'
    },
    {
      num: '04',
      name: 'cloakroom_counter',
      pos: { x: -3.5, y: 1.7, z: 6.0 },
      target: { x: 1.0, y: 1.7, z: 6.0 },
      desc: 'Looking directly at the mahogany cloakroom counter, the rustic oak coat shelf with wool jackets, and the glowing warm-amber COATS sign on the back wall.'
    },
    {
      num: '05',
      name: 'cloakroom_seating',
      pos: { x: -0.6, y: 1.7, z: 5.4 },
      target: { x: -4.4, y: 1.55, z: 7.0 },
      desc: 'Looking back at the cozy wool bench seating cushions and potted clay plants.'
    },
    {
      num: '06',
      name: 'entering_club',
      pos: { x: -1.0, y: 1.7, z: 1.0 },
      target: { x: 4.0, y: 1.7, z: 0.0 },
      desc: 'Stepping through the portal partition wall onto the acoustic parquet dancefloor.'
    },
    {
      num: '07',
      name: 'botanist_bar',
      pos: { x: 4.2, y: 1.7, z: 7.8 },
      target: { x: 12.0, y: 1.75, z: 8.8 },
      desc: 'Looking down the mahogany Botanist Bar counter with glowing honey shelves and velvet stools.'
    },
    {
      num: '08',
      name: 'dancefloor_chandelier',
      pos: { x: 5.8, y: 1.7, z: 1.4 },
      target: { x: 11.6, y: 2.7, z: -2.4 },
      desc: 'Looking up at the exposed oak timber rafters and the candle chandelier.'
    },
    {
      num: '09',
      name: 'entering_lounge',
      pos: { x: 9.0, y: 1.7, z: -11.0 },
      target: { x: 13.0, y: 1.7, z: -16.0 },
      desc: 'Stepping into the intimate Chillout Lounge.'
    },
    {
      num: '10',
      name: 'fireplace_and_sconces',
      pos: { x: 8.2, y: 1.7, z: -13.0 },
      target: { x: 13.0, y: 1.45, z: -20.2 },
      desc: 'Looking at the cozy brick fireplace flanked by the newly corrected wall-mounted brass candle sconces and the back-wall music poster.'
    },
    {
      num: '11',
      name: 'botanical_art_wall',
      pos: { x: 13.2, y: 1.7, z: -14.0 },
      target: { x: 19.5, y: 1.65, z: -15.0 },
      desc: 'Viewing the newly fixed, wall-mounted botanical art frame in perfect 3D relief on the lounge side wall.'
    },
    {
      num: '12',
      name: 'dj_booth',
      pos: { x: 13.0, y: 1.7, z: -1.4 },
      target: { x: 18.0, y: 1.55, z: 0.0 },
      desc: 'The DJ Turntable Console and massive walnut-veneered subwoofer speaker towers.'
    }
  ];
  
  for (const frame of tourKeyframes) {
    console.log(`\nFrame ${frame.num}: Positioning camera for ${frame.name}...`);
    
    // Inject camera placement code into the browser context
    await page.evaluate((pos, target) => {
      if (window.sceneManager && window.sceneManager.camera) {
        // Position camera
        window.sceneManager.camera.position.set(pos.x, pos.y, pos.z);
        
        // Use lookAt with three numeric coordinates
        window.sceneManager.camera.lookAt(target.x, target.y, target.z);
        
        // Force projection and matrix updates
        window.sceneManager.camera.updateMatrixWorld(true);
        window.sceneManager.camera.updateProjectionMatrix();
        
        console.log(`Placed camera at (${pos.x}, ${pos.y}, ${pos.z}) looking at (${target.x}, ${target.y}, ${target.z})`);
      } else {
        console.error('window.sceneManager or camera not found!');
      }
    }, frame.pos, frame.target);
    
    // Wait 1.5 seconds for Three.js render loop to draw at the new camera angle
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const screenshotPath = path.join(outDir, `frame_${frame.num}.png`);
    console.log(`Taking screenshot: ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
  }
  
  console.log('\nClosing browser...');
  await browser.close();
  console.log('Tour recording captured successfully!');
}

run().catch(err => {
  console.error('Error running tour recording:', err);
  process.exit(1);
});
