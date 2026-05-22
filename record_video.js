import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const outPath = '/Users/matt/.gemini/antigravity/brain/36faef96-870a-4f97-9dd8-8980282109da/walkthrough.webm';

async function run() {
  console.log('Launching headless browser for cinematic video recording...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream']
  });
  const page = await browser.newPage();
  
  // Set to HD 720p viewport
  await page.setViewport({ width: 1280, height: 720 });
  
  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  console.log('Waiting for entrance button...');
  await page.waitForSelector('#btn-start');
  console.log('Clicking entrance button to activate scene and audio...');
  await page.click('#btn-start');
  
  // Wait 4 seconds for procedural geometry to compile and materials to initialize
  console.log('Allowing scene to initialize (4 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  console.log('Starting smooth cinematic canvas recording...');
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const canvas = window.sceneManager.renderer.domElement;
      if (!canvas) {
        console.error('Canvas element not found!');
        resolve();
        return;
      }
      
      // Stop the standard FPS player controller updatable to let cinematic camera take over
      if (window.controlsManager) {
        window.sceneManager.removeUpdatable(window.controlsManager);
      }
      
      // Capture stream from canvas at solid 30 fps
      const stream = canvas.captureStream(30);
      
      // Initialize MediaRecorder
      let mediaRecorder;
      const options = { mimeType: 'video/webm;codecs=vp9' };
      try {
        mediaRecorder = new MediaRecorder(stream, options);
        console.log('Using vp9 codec for video recording.');
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        console.log('Falling back to standard webm codec for video recording.');
      }
      
      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped. Compiling final video Blob...');
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          window.recordedVideoBase64 = reader.result;
          console.log('Video compilation complete. Base64 payload stored.');
        };
      };
      
      // Cinematic Keyframes corresponding exactly to the 12 tour viewpoints
      const keyframes = [
        {
          pos: { x: -14.0, y: 1.7, z: -3.5 },
          target: { x: -5.0, y: 1.7, z: -3.5 }
        },
        {
          pos: { x: -8.0, y: 1.7, z: -1.0 },
          target: { x: -4.0, y: 1.7, z: 0.0 }
        },
        {
          pos: { x: -4.5, y: 1.7, z: 0.0 },
          target: { x: -1.0, y: 1.7, z: 3.0 }
        },
        {
          pos: { x: -3.5, y: 1.7, z: 6.0 },
          target: { x: 1.0, y: 1.7, z: 6.0 }
        },
        {
          pos: { x: -1.5, y: 1.7, z: 6.0 },
          target: { x: -4.2, y: 1.7, z: 6.0 }
        },
        {
          pos: { x: -1.0, y: 1.7, z: 1.0 },
          target: { x: 4.0, y: 1.7, z: 0.0 }
        },
        {
          pos: { x: 5.5, y: 1.7, z: 8.5 },
          target: { x: 12.0, y: 1.7, z: 8.5 }
        },
        {
          pos: { x: 8.5, y: 1.7, z: -2.5 },
          target: { x: 8.5, y: 3.5, z: -2.5 }
        },
        {
          pos: { x: 9.0, y: 1.7, z: -11.0 },
          target: { x: 13.0, y: 1.7, z: -16.0 }
        },
        {
          pos: { x: 10.0, y: 1.7, z: -15.0 },
          target: { x: 13.0, y: 1.7, z: -20.5 }
        },
        {
          pos: { x: 15.0, y: 1.7, z: -15.0 },
          target: { x: 19.5, y: 1.7, z: -15.0 }
        },
        {
          pos: { x: 14.0, y: 1.7, z: 0.0 },
          target: { x: 18.0, y: 1.7, z: 0.0 }
        }
      ];
      
      const segmentDuration = 2.5; // 2.5 seconds per transition segment
      const totalDuration = segmentDuration * (keyframes.length - 1);
      let elapsed = 0;
      
      // Add a custom cinematic camera updatable into the render loop
      const cinematicController = {
        update: (dt) => {
          elapsed += dt;
          
          if (elapsed >= totalDuration) {
            elapsed = totalDuration;
            // Unregister and stop recorder once target is hit
            window.sceneManager.removeUpdatable(cinematicController);
            mediaRecorder.stop();
            return;
          }
          
          const u = (elapsed / totalDuration) * (keyframes.length - 1);
          const idx = Math.floor(u);
          const nextIdx = Math.min(idx + 1, keyframes.length - 1);
          const fraction = u - idx;
          
          // Cosine interpolation for ultra-smooth easing
          const f = (1 - Math.cos(fraction * Math.PI)) / 2;
          
          const k1 = keyframes[idx];
          const k2 = keyframes[nextIdx];
          
          const pos = {
            x: k1.pos.x * (1 - f) + k2.pos.x * f,
            y: k1.pos.y * (1 - f) + k2.pos.y * f,
            z: k1.pos.z * (1 - f) + k2.pos.z * f
          };
          
          const target = {
            x: k1.target.x * (1 - f) + k2.target.x * f,
            y: k1.target.y * (1 - f) + k2.target.y * f,
            z: k1.target.z * (1 - f) + k2.target.z * f
          };
          
          window.sceneManager.camera.position.set(pos.x, pos.y, pos.z);
          window.sceneManager.camera.lookAt(target.x, target.y, target.z);
          window.sceneManager.camera.updateMatrixWorld(true);
          window.sceneManager.camera.updateProjectionMatrix();
        }
      };
      
      // Start recording and inject controllers
      mediaRecorder.start();
      window.sceneManager.addUpdatable(cinematicController);
      console.log(`Cinematic sweep started. Sweeping through 12 keyframes over ${totalDuration} seconds...`);
      resolve();
    });
  });
  
  // Wait for recording duration plus some buffer for the FileReader compilation
  console.log('Sweeping club... Please wait while video is recorded...');
  // 11 transitions * 2.5s = 27.5s total duration. Let's wait 31 seconds.
  await new Promise(resolve => setTimeout(resolve, 31000));
  
  console.log('Retrieving compiled video from browser memory...');
  const base64Data = await page.evaluate(async () => {
    // Poll for the base64 string to be ready
    for (let i = 0; i < 50; i++) {
      if (window.recordedVideoBase64) {
        return window.recordedVideoBase64;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  });
  
  if (!base64Data) {
    throw new Error('Failed to retrieve compiled video base64 string within timeout.');
  }
  
  console.log('Saving video file...');
  // Strip standard base64 data header e.g. "data:video/webm;base64,"
  const base64Content = base64Data.replace(/^data:video\/[a-zA-Z0-9]+;base64,/, "");
  const videoBuffer = Buffer.from(base64Content, 'base64');
  
  // Ensure the directory exists
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outPath, videoBuffer);
  console.log(`\nSuccess! Cinematic walkthrough video recorded and saved to:\n${outPath}\n`);
  
  console.log('Closing browser...');
  await browser.close();
}

run().catch(err => {
  console.error('Error recording cinematic video:', err);
  process.exit(1);
});
