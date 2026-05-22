import puppeteer from 'puppeteer';
import path from 'path';

const outDir = '/Users/matt/.gemini/antigravity/brain/36faef96-870a-4f97-9dd8-8980282109da';

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
  
  const rooms = [
    {
      name: 'exterior',
      pos: { x: -16.0, y: 1.75, z: -5.4 },
      target: { x: -5.6, y: 1.85, z: -2.2 }
    },
    {
      name: 'cloakroom',
      pos: { x: -3.5, y: 1.7, z: 6.0 },
      target: { x: 1.0, y: 1.65, z: 6.0 }
    },
    {
      name: 'bar',
      pos: { x: 4.2, y: 1.7, z: 7.8 },
      target: { x: 12.0, y: 1.75, z: 8.8 }
    },
    {
      name: 'fireplace',
      pos: { x: 8.2, y: 1.7, z: -13.0 },
      target: { x: 13.0, y: 1.45, z: -20.2 }
    },
    {
      name: 'dancefloor',
      pos: { x: 5.8, y: 1.7, z: 1.4 },
      target: { x: 11.6, y: 2.7, z: -2.4 }
    }
  ];
  
  for (const room of rooms) {
    console.log(`\nPositioning camera for ${room.name}...`);
    
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
    }, room.pos, room.target);
    
    // Wait 1.5 seconds for Three.js render loop to draw at the new camera angle
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const screenshotPath = path.join(outDir, `${room.name}_after.png`);
    console.log(`Taking screenshot for ${room.name} saved to ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
  }
  
  console.log('\nClosing browser...');
  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error running screenshot tool:', err);
  process.exit(1);
});
