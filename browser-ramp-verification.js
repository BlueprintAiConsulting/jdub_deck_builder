import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const mockProject = {
  schemaVersion: 2,
  projectName: 'RampVerifyProject',
  sections: [
    {
      id: 'sec-verify-deck',
      x: -72, y: -60, width: 144, depth: 120, height: 36,
      ledgerAttached: true,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      ramp: null,
      type: 'deck',
      vertices: [
        { x: -72, y: -60 },
        { x: 72, y: -60 },
        { x: 72, y: 60 },
        { x: -72, y: 60 }
      ]
    }
  ],
  materials: {
    joistSize: '2x8',
    joistSpacing: 16,
    species: 'SYP',
    beamConfig: '2-2x10',
    postSize: '6x6',
    deckBoardSize: '5/4x6',
    deckMaterial: 'PT-SYP',
    soilCapacity: 2000
  }
};

const outputDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Starting Vite dev server...');
const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
});

let serverUrl = 'http://localhost:5173';

const serverReady = new Promise((resolve) => {
  viteProcess.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(str.trim());
    const match = str.match(/(http:\/\/localhost:\d+\/[^\s]*)/);
    if (match) {
      serverUrl = match[1].trim().replace(/\u001b\[[0-9;]*m/g, '');
      resolve(serverUrl);
    }
  });
  // Fallback timeout of 8 seconds
  setTimeout(() => resolve(serverUrl), 8000);
});

try {
  await serverReady;
  console.log(`Vite dev server is ready at: ${serverUrl}`);

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 960 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating to app...');
  await page.goto(serverUrl);
  await page.waitForSelector('.canvas-2d__canvas');

  console.log('Loading rectangular project...');
  await page.evaluate((proj) => {
    window.useDeckStore.getState().loadProject(proj.sections, proj.materials);
  }, mockProject);
  await page.waitForTimeout(500);

  // Select the section so its properties and ramp configuration are rendered in the DOM
  console.log('Selecting deck section...');
  await page.evaluate(() => {
    window.useDeckStore.getState().selectSection('sec-verify-deck');
  });
  await page.waitForTimeout(300);

  console.log('Attaching ramp to south edge...');
  await page.evaluate(() => {
    window.useDeckStore.getState().attachRamp('sec-verify-deck', 's');
  });
  await page.waitForTimeout(1000); // Allow canvas re-rendering

  console.log('Running Ramp Assertions...');
  const assertions = [];

  function assert(desc, pass, measured, expected) {
    assertions.push({ desc, pass, measured, expected });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${desc}`);
    console.log(`  - Measured: ${measured}`);
    console.log(`  - Expected: ${expected}`);
    if (!pass) {
      console.error(`CRITICAL FAILURE: ${desc} failed!`);
    }
  }

  // 1. 2D Canvas checks
  const canvasElement = await page.$('.canvas-2d__canvas');
  const canvasExists = !!canvasElement;
  assert('2D: Canvas2D element exists', canvasExists, canvasExists ? 'Exists' : 'Not Found', 'Exists');

  let canvasSizeValid = false;
  let canvasW = 0, canvasH = 0;
  if (canvasElement) {
    const box = await canvasElement.boundingBox();
    canvasW = box.width;
    canvasH = box.height;
    canvasSizeValid = canvasW > 0 && canvasH > 0;
  }
  assert('2D: Canvas2D element has non-zero size', canvasSizeValid, `${canvasW}x${canvasH}`, 'non-zero width & height');

  // Verify ramp UI controls appear in Properties Panel as DOM presence of the ramp
  const removeBtn = await page.$('#btn-remove-ramp');
  const removeBtnExists = !!removeBtn;
  assert('2D: Ramp UI controls DOM element exists', removeBtnExists, removeBtnExists ? 'Exists' : 'Not Found', 'Exists');

  let btnSizeValid = false;
  let btnW = 0, btnH = 0;
  if (removeBtn) {
    const box = await removeBtn.boundingBox();
    btnW = box.width;
    btnH = box.height;
    btnSizeValid = btnW > 0 && btnH > 0;
  }
  assert('2D: Ramp UI element has non-zero size', btnSizeValid, `${btnW}x${btnH}`, 'non-zero width & height');

  // Capture 2D view screenshot
  console.log('Capturing 2D viewport screenshot...');
  const path2D = path.join(outputDir, 'ramp-verification-2d.png');
  await page.screenshot({ path: path2D });
  console.log(`2D Screenshot saved to: ${path2D}`);

  // Switch to 3D mode
  console.log('Switching to 3D ViewMode...');
  await page.evaluate(() => window.useDeckStore.getState().setViewMode('3d'));
  
  // Wait for the 3D canvas to exist in DOM
  await page.waitForSelector('.scene3d-container canvas', { timeout: 8000 });

  // Dispatch resize event to trigger ResizeObserver layout pass in headless mode
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
  });

  // Allow layout calculations and Three.js textures compile
  await page.waitForTimeout(1500);

  // Query Three.js scene graph for the ramp mesh
  console.log('Querying Three.js Scene Graph...');
  const ramp3DData = await page.evaluate(async () => {
    try {
      const canvas3D = document.querySelector('.scene3d-container canvas');
      if (!canvas3D) return { error: '3D Canvas element not found' };

      const resources = performance.getEntriesByType('resource').map(r => r.name);
      const chunks = resources.filter(url => url.includes('/node_modules/.vite/deps/chunk-'));
      
      let foundScene = null;

      for (const chunkUrl of chunks) {
        try {
          const mod = await import(chunkUrl);
          for (const key of Object.keys(mod)) {
            const val = mod[key];
            if (val instanceof Map && val.has(canvas3D)) {
              const root = val.get(canvas3D);
              if (root && root.store) {
                foundScene = root.store.getState().scene;
                break;
              }
            }
          }
        } catch (e) {
          // ignore
        }
        if (foundScene) break;
      }

      if (!foundScene) return { error: 'Three.js scene not found in any chunk roots Map' };

      let rampMesh = null;
      foundScene.traverse((obj) => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'BoxGeometry') {
          const params = obj.geometry.parameters;
          // Ramp width: 36 inches -> 3.0 feet in Three.js scene
          if (Math.abs(params.width - 3.0) < 0.1 && params.depth > 10.0) {
            rampMesh = obj;
          }
        }
      });

      if (!rampMesh) return { error: 'Ramp mesh not found in scene graph traverse' };

      // Compute bounding box in local and world space
      rampMesh.geometry.computeBoundingBox();
      const min = rampMesh.geometry.boundingBox.min;
      const max = rampMesh.geometry.boundingBox.max;
      
      const corners = [
        { x: min.x, y: min.y, z: min.z },
        { x: min.x, y: min.y, z: max.z },
        { x: min.x, y: max.y, z: min.z },
        { x: min.x, y: max.y, z: max.z },
        { x: max.x, y: min.y, z: min.z },
        { x: max.x, y: min.y, z: max.z },
        { x: max.x, y: max.y, z: min.z },
        { x: max.x, y: max.y, z: max.z }
      ];

      rampMesh.updateMatrixWorld(true);
      const m = rampMesh.matrixWorld.elements;
      let minWorldY = Infinity;
      let maxWorldY = -Infinity;

      for (const c of corners) {
        // matrixWorld is column-major:
        // wy = x * m[1] + y * m[5] + z * m[9] + m[13]
        const worldY = c.x * m[1] + c.y * m[5] + c.z * m[9] + m[13];
        if (worldY < minWorldY) minWorldY = worldY;
        if (worldY > maxWorldY) maxWorldY = worldY;
      }

      return {
        found: true,
        widthInches: rampMesh.geometry.parameters.width * 12,
        heightInches: rampMesh.geometry.parameters.height * 12,
        depthInches: rampMesh.geometry.parameters.depth * 12,
        minWorldYInches: minWorldY * 12,
        maxWorldYInches: maxWorldY * 12,
        verticalExtentInches: (maxWorldY - minWorldY) * 12
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  const meshExists = !!(ramp3DData && ramp3DData.found);
  assert('3D: Ramp mesh exists in Three.js scene graph', meshExists, meshExists ? 'Found' : (ramp3DData.error || 'Not Found'), 'Found');

  let verticalExtentValid = false;
  let measuredExtent = 0;
  if (meshExists) {
    measuredExtent = ramp3DData.verticalExtentInches;
    verticalExtentValid = measuredExtent > 1.0;
  }
  assert('3D: Ramp mesh bounding box has non-zero vertical extent (is sloped)', verticalExtentValid, `${measuredExtent.toFixed(2)} inches`, 'non-zero extent (> 1.0 inches)');

  let positionsValid = false;
  let measuredMinY = 0, measuredMaxY = 0;
  if (meshExists) {
    measuredMinY = ramp3DData.minWorldYInches;
    measuredMaxY = ramp3DData.maxWorldYInches;
    // Top edge Y is at or near deck surface (37.0 = 36" deck height + 1" board thickness)
    // Bottom edge Y is at or near ground plane (0.0)
    positionsValid = measuredMaxY >= 35.0 && measuredMaxY <= 39.0 && measuredMinY >= -1.0 && measuredMinY <= 2.0;
  }
  assert('3D: Ramp top edge is near deck surface (36-37") and bottom edge is near ground (0")', positionsValid, `top Y: ${measuredMaxY.toFixed(2)}", bottom Y: ${measuredMinY.toFixed(2)}"`, 'top Y ~ 36-37", bottom Y ~ 0-1"');

  // 3. State checks
  const stateRun = await page.evaluate(() => {
    const sec = window.useDeckStore.getState().sections[0];
    const calcs = window.useDeckStore.getState().sectionCalcs[sec.id];
    return calcs.ramp ? calcs.ramp.run : null;
  });
  const stateRunValid = stateRun === 432;
  assert('State: Placed ramp computed run is correct', stateRunValid, `${stateRun} inches`, '432 inches (36ft)');

  // Capture 3D view screenshot
  console.log('Capturing 3D viewport screenshot...');
  const path3D = path.join(outputDir, 'ramp-verification-3d.png');
  await page.screenshot({ path: path3D });
  console.log(`3D Screenshot saved to: ${path3D}`);

  // Write a text report of selection-state and positions
  const reportPath = path.join(process.cwd(), 'browser-ramp-verification-report.txt');
  let reportContent = `DeckForge Ramp Browser Verification Report\n`;
  reportContent += `==================================================\n`;
  reportContent += `Date: ${new Date().toISOString()}\n\n`;
  reportContent += `Ramp Verification Results:\n`;
  let allPassed = true;
  for (const a of assertions) {
    if (!a.pass) allPassed = false;
    reportContent += `[${a.pass ? 'PASS' : 'FAIL'}] ${a.desc}\n`;
    reportContent += `  - Measured: ${a.measured}\n`;
    reportContent += `  - Expected: ${a.expected}\n\n`;
  }
  reportContent += `==================================================\n`;
  reportContent += `Final Result: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}\n`;
  reportContent += `Screenshots captured:\n`;
  reportContent += `  - 2D: screenshots/ramp-verification-2d.png\n`;
  reportContent += `  - 3D: screenshots/ramp-verification-3d.png\n`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`Report successfully written to: ${reportPath}`);

  // Cleanup
  await browser.close();
  viteProcess.kill();
  console.log('Browser closed and Vite process terminated.');
  
  if (allPassed) {
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('VERIFICATION FAILED!');
    process.exit(1);
  }

} catch (err) {
  console.error('An error occurred during verification:', err);
  if (typeof viteProcess !== 'undefined') {
    viteProcess.kill();
  }
  process.exit(1);
}
