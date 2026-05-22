# 🪵 Hearthside Lounge & Botanist Bar: 3D Interactive Cozy Retreat

An immersive, explorable 3D miniature voxel-art cozy retreat built from scratch using **Three.js** and **Vite**. The project features a fully procedural, asset-free pipeline, incorporating real-time Web Audio API synthesizers, smooth acoustic room-based lowpass filtering, localized flickering candle sconces, hanging lanterns, and an inertial sliding collision physics engine.

---

## 🚀 Key Features

* **Multi-Room Voxel Layout**: Walk past the doorman's podium and VIP velvet rope queue barriers on the cobblestone pavement, through the transitionary Reception & Coatroom lobby, and into the main lounge. Explore a fully-stocked mahogany Botanist Bar, relax by the crackling brick fireplace in the Hearthside Lounge, or wander into the high-ceiling Acoustic Hall.
* **Golden Hour & Dynamic Atmosphere Engine**: Features a gorgeous, procedural golden-hour sunset casting long, low-angle shadows on the sidewalk. As the player crosses room thresholds, the environment's sky and fog colors seamlessly interpolate (lerp) in real time: transitioning from a warm sunset copper-orange (`0x4c2b1a` with $0.018$ density) outside, to a rich timber/copper glow in the reception (`0x16100d` with $0.024$ density), to a cozy warm charcoal (`0x0a0807` with $0.028$ density) inside.
* **Procedural Acoustic Sound**: 100% synthesized in code using the Web Audio API. Generates a live, relaxed 80BPM acoustic/jazz score containing a wood stomp-box heartbeat kick, brushed shaker hi-hats, a syncopated walking acoustic double-bass line, and warm, multi-layered Rhodes electric piano chord progressions playing a C Minor 7 and G Minor 7 progression with elegant filler notes.
* **Room-Based Acoustic Occlusion**: Uses dynamic `BiquadFilterNode` low-pass filters to recreate authentic sound absorption. Volume and frequency cutoffs smoothly slide (lerp) as you walk through doors, muffling the high-frequency notes when you are in the lounge, reception, or outside waiting in the queue.
* **Smooth Sliding Collision Physics**: An intuitive first-person character controller tracking acceleration and friction. Bounding boxes (`THREE.Box3`) check collisions independently on the X and Z axes against the solid world meshes, letting you slide smoothly along walls instead of sticking.
* **Warm Wrought-Iron Chandelier**: A slow-rotating dark wrought-iron candle ring chandelier with 6 spokes, brass drip pans, white candles, and glowing orange flame boxes. Features subtle bobbing, with flames and amber spark particles flaring in sync with the audio beat before smoothly decaying.
* **Lively Localized Gas & Candle Flickering**: Hanging brass-rod lanterns with glowing orange glass boxes and wall-mounted candle sconces flanking the fireplace with flickering flame animations, fully illuminating the cloakroom and lounge.
* **Rich Ambient Gradients**: Built with a global warm-toned `AmbientLight` paired with localized physical lighting fixtures (lanterns, sconces, and fireplace point lights) to eliminate overly dark room corners and ensure architectural details remain beautifully visible.
* **Procedural Canvas Textures**: Zero image files loaded! Textures (interlocking oak hardwood planks, exposed clay bricks with mortar, walnut wood turntable console with analog VU meters, fabric speaker grilles, skin details, cozy clothing textures) are generated dynamically on HTML5 canvas elements at startup using pixelated `NearestFilter` sampling.
* **Relaxed Conversational NPCs**: Spawns procedural voxel characters dressed in cozy casual styles (cable-knit cardigans, lumberjack plaid flannels, argyle sweaters, corduroy trousers) with natural hair and gold spectacles. Features 4 highly expressive relaxing motion loops (The Chill Chatterer, The Cozy Swayer, The Rhythmic Nodder, and The Conversationalist) with gentle sways, torso sways, head nods, and active hand gestures.
* **Cozy Wood & Brass HUD**: A responsive glassmorphic overlay containing a real-time room transition notifier, key-mapping panels, a pulsing beat status indicator, and a 12-bar audio equalizer spectrum.

---

## 🕹️ Keyboard & Mouse Controls

The interface relies on the HTML5 Pointer Lock API for smooth camera lookups:

| Control | Mapping | Action |
| --- | --- | --- |
| **Walk Forward** | `W` / `Arrow Up` | Moves player forwards with inertia |
| **Walk Backward**| `S` / `Arrow Down` | Moves player backwards |
| **Strafing Left** | `A` / `Arrow Left` | Strafes player left |
| **Strafing Right**| `D` / `Arrow Right` | Strafes player right |
| **Run / Sprint** | `SHIFT` | Increases movement speed (runs at 1.25x speed) |
| **Look Around** | `MOUSE` | Focuses and rotates camera (YXZ order) |
| **Release Mouse**| `ESC` | Releases pointer lock to access desktop |
| **Acquire Mouse**| `LEFT CLICK` | Re-locks mouse cursor back into the retreat |

---

## 📁 Architectural Map & Files

The project features a highly clean, modular, and decoupled file structure:

```
pixel-hospital/
├── index.html              # HTML Shell, warm ambient overlays & HUD nodes
├── style.css               # Design system typography, cozy amber glows, and overlays
├── package.json            # Vite and Three.js dependencies configuration
├── main.js (or src/main)   # Entrypoint launching engines and frame clocks
└── src/
    ├── core/
    │   ├── SceneManager.js    # Sets up WebGLRenderer, Scene, Camera, and Fog
    │   ├── ControlsManager.js # FPS camera controls and wall sliding collisions
    │   └── AudioManager.js    # Synthesizers, step-sequencers, and room filters
    ├── world/
    │   ├── MapBuilder.js      # Procedural room geometry & collision bounding index
    │   ├── LightingManager.js # Candle/gas lantern point lights & beat tile flashes
    │   └── DiscoBall.js       # Grand slow-rotating wrought-iron candle chandelier
    ├── entities/
    │   └── NPCManager.js      # Procedural voxel character rigs & cozy behavior loops
    └── utils/
        └── TextureGenerator.js# Canvas drawing algorithms for pixel-art textures
```

---

## ⚙️ Setup and Installation

Follow these steps to run the application locally:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (version 18+ is recommended).

### 2. Clone the Repository
Clone the project into your local workspace directory.

### 3. Install Dependencies
Open a terminal in the project's root folder and run:
```bash
npm install
```

### 4. Run the Development Server
Launch Vite's hot-reloading server:
```bash
npm run dev
```
This will spin up a local server (typically at `http://localhost:5173`). Click the link in your terminal to explore the lounge in your browser.

### 5. Build for Production
Compiles and tree-shakes the application into a high-performance, single-bundle package in the `/dist` directory:
```bash
npm run build
```

### 6. Preview Production Bundle
Run a local server to test the performance of the production bundle:
```bash
npm run preview
```

---

## 📹 Visual Testing & Cinematic Tour Recording

The codebase is equipped with automated visual inspection and recording systems using headless browser scripts powered by Puppeteer:

* **Capture Room-by-Room Screenshots**:
  Evaluate visual balances and shadows across the 5 primary areas:
  ```bash
  node take_screenshots.js
  ```
* **Capture Tour Snaps**:
  Generate 12 keyframe screenshots traversing a detailed path around the retreat:
  ```bash
  node record_tour.js
  ```
* **Record a Smooth Walkthrough Video**:
  Capture a continuous, high-definition 720p `.webm` cinematic walk-around video. It uses smooth camera interpolation and browser-native canvas streaming via the HTML5 `MediaRecorder` API:
  ```bash
  node record_video.js
  ```

---

## ⚡ Technical Optimization Details

* **Capped Delta Frame rates**: Delta times are clamped to 100ms inside `animate()`. This prevents extreme coordinate displacement jumps (letting players walk through walls) if the browser tab loses focus or frame rate spikes.
* **Canvas Cap limits**: Device Pixel Ratios are clamped at `Math.min(window.devicePixelRatio, 2)`. This maintains high-fidelity resolution on Retina displays without destroying performance on 4K screens.
* **Low-Poly Primitives**: Simple geometric counts (using 8-segment cylinders, 14-segment spheres, and primitive boxes) reduce vertex overhead, allowing a smooth 60fps even on low-end hardware.
* **Audio Interpolation**: Low-pass filters and volume coefficients are linearly interpolated (lerped) instead of snapped. This prevents annoying popping, clicking, or cracking sound bugs during room crossovers.
* **Decoupled Tick-Based Flickers**: Random lighting flickers are computed on strict, clock-based interval polling (70ms intervals for lanterns and candle sconces), saving computational overhead and providing organic, flickering ambient washes.
