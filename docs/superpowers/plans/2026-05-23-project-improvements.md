# Project Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the previously identified project improvements: identity cleanup, quality scripts, portable visual QA, shared room/keyframe config, lifecycle cleanup, and performance-minded structure.

**Architecture:** Keep behavior intact while extracting pure shared configuration and testable orchestration. Avoid broad geometry rewrites; preserve the existing `MapBuilder` user edit and use focused changes around config consumers, scripts, and names.

**Tech Stack:** Vite 8, Three.js, browser Web Audio, Puppeteer, Vitest, ESLint, Prettier.

---

### Task 1: Test and Quality Tooling

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`

- [ ] **Step 1: Install dev dependencies**

Run:

```bash
npm install -D vitest eslint prettier globals
```

Expected: `package.json` and `package-lock.json` include the dev dependencies.

- [ ] **Step 2: Add package scripts**

Update `package.json` scripts to include:

```json
"test": "vitest run",
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check .",
"qa:screenshots": "node take_screenshots.js",
"qa:tour": "node record_tour.js",
"qa:video": "node record_video.js"
```

- [ ] **Step 3: Add lint and format config**

Create `eslint.config.js` with browser/node globals and no semicolon churn. Create `.prettierrc.json` with two-space indentation and single quotes.

- [ ] **Step 4: Run baseline**

Run:

```bash
npm run build
npm run test
```

Expected: build exits 0 and tests run even if there are initially no tests.

### Task 2: Shared Config and Tests

**Files:**

- Create: `src/config/experience.js`
- Create: `src/config/experience.test.js`
- Modify: `src/core/AudioManager.js`
- Modify: `src/core/SceneManager.js`
- Modify: `take_screenshots.js`
- Modify: `record_tour.js`
- Modify: `record_video.js`

- [ ] **Step 1: Write failing tests**

Create tests that import `ROOMS`, `TOUR_KEYFRAMES`, `resolveArtifactPath`, and `getRoomForPosition`. Assert that exterior, lobby, bar, lounge, and hall coordinates map correctly; assert screenshot artifact paths default under `artifacts/visual-qa`; assert tour keyframes include the expected first and last names.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/config/experience.test.js
```

Expected: fail because `src/config/experience.js` does not exist yet.

- [ ] **Step 3: Implement shared config**

Create `src/config/experience.js` exporting `APP_BRAND`, `ROOMS`, `TOUR_KEYFRAMES`, `SCREENSHOT_ROOMS`, `getRoomForPosition(x, z)`, `resolveArtifactPath(...segments)`, and `VISUAL_QA_BASE_URL`.

- [ ] **Step 4: Wire consumers**

Update `AudioManager` to import `ROOMS` and `getRoomForPosition`. Update visual QA scripts to import shared keyframes, base URL, and artifact path helpers.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- src/config/experience.test.js
```

Expected: pass.

### Task 3: Lifecycle and Naming Cleanup

**Files:**

- Create: `src/core/AppController.js`
- Create: `src/core/AppController.test.js`
- Rename: `src/world/DiscoBall.js` to `src/world/Chandelier.js`
- Modify: `src/main.js`
- Modify: `src/core/SceneManager.js`
- Modify: `DEVELOPER_GUIDE.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing controller tests**

Test that `createAppController` starts systems in order, registers updatables, exposes debug globals only when requested, and calls `dispose()` on each disposable plus cancels the animation frame.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/core/AppController.test.js
```

Expected: fail because `src/core/AppController.js` does not exist yet.

- [ ] **Step 3: Implement controller**

Create a testable controller that accepts factory functions for scene, audio, controls, map, lighting, chandelier, NPCs, and UI. Production `main.js` uses the real factories.

- [ ] **Step 4: Add resize disposal**

Store `SceneManager` resize handler and add `dispose()` that removes it and disposes renderer resources when present.

- [ ] **Step 5: Rename chandelier class**

Rename `DiscoBall` class/file to `Chandelier`, update imports and docs. Do not alter visual behavior.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- src/core/AppController.test.js
```

Expected: pass.

### Task 4: Portable Visual QA Scripts

**Files:**

- Modify: `take_screenshots.js`
- Modify: `record_tour.js`
- Modify: `record_video.js`
- Modify: `.gitignore`

- [ ] **Step 1: Replace hardcoded paths**

Use `resolveArtifactPath()` so outputs go to `artifacts/visual-qa/...` by default. Support `VISUAL_QA_OUT_DIR` override.

- [ ] **Step 2: Replace fixed base URL**

Use `VISUAL_QA_BASE_URL` from env, defaulting to `http://localhost:5173/`.

- [ ] **Step 3: Ignore artifacts**

Add `artifacts/` to `.gitignore`.

- [ ] **Step 4: Smoke-check script syntax**

Run:

```bash
node --check take_screenshots.js
node --check record_tour.js
node --check record_video.js
```

Expected: all exit 0.

### Task 5: Branding, Docs, and Polish

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: `DEVELOPER_GUIDE.md`
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/core/SceneManager.js`
- Modify: `src/core/ControlsManager.js`
- Modify: `src/world/MapBuilder.js`
- Modify: `src/utils/TextureGenerator.js`
- Delete if unused: `src/counter.js`

- [ ] **Step 1: Align product naming**

Use `hearthside-lounge` for package name and “Hearthside Lounge” for user-facing product copy.

- [ ] **Step 2: Remove stale cyber/disco/neon wording where behavior is no longer cyber-themed**

Update comments, docs, HUD labels, and console text. Keep internal material keys only when renaming would create needless churn.

- [ ] **Step 3: Fix favicon**

Change `index.html` to use `/favicon.svg`.

- [ ] **Step 4: Remove unused starter file**

Delete `src/counter.js` if no import references it.

- [ ] **Step 5: Run text scan**

Run:

```bash
rg -n "Cyber|cyber|disco|DiscoBall|pixel-hospital|vite.svg|AUDIO FREQ MATRIX|DJSYNC|RAVE" src README.md DEVELOPER_GUIDE.md index.html package.json
```

Expected: no stale references except intentional historical notes, if any are explicitly justified.

### Task 6: Verification and Review

**Files:**

- All changed files

- [ ] **Step 1: Full verification**

Run:

```bash
npm run lint
npm run test
npm run build
node --check take_screenshots.js
node --check record_tour.js
node --check record_video.js
```

Expected: all exit 0.

- [ ] **Step 2: Final review**

Dispatch a final reviewer with model `gpt-5.5` and reasoning `xhigh` to review all changes against this plan and the original improvement list.

- [ ] **Step 3: Fix review findings**

Apply any actionable findings, rerun the relevant verification, then rerun full verification.
