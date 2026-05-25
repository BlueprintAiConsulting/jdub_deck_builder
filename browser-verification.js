import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Bounding box mapping for mock project:
// x: -72, y: -60, width: 144, depth: 120
// Under SCALE = 3, ox = 400, oy = 300:
// left: -72 * 3 + 400 = 184
// top: -60 * 3 + 300 = 120
// right: 72 * 3 + 400 = 616
// bottom: 60 * 3 + 300 = 480
// center: (400, 300)
// point outside (under hypotenuse / corner of bounding box): (100, 300)

const mockProject = {
  schemaVersion: 2,
  projectName: 'VerifyProject',
  sections: [
    {
      id: 'sec-verify-deck',
      x: -72, y: -60, width: 144, depth: 120, height: 36,
      ledgerAttached: true,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
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
  fs.mkdirSync(outputDir);
}

// 1. Start Vite dev server in background
console.log('Starting Vite dev server...');
const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
});

let serverUrl = 'http://localhost:5173'; // Default Vite port

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
  
  // Fail-safe timeout of 8 seconds
  setTimeout(() => resolve(serverUrl), 8000);
});

try {
  await serverReady;
  console.log(`Vite dev server is ready at: ${serverUrl}`);

  // Launch Playwright Chromium
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set window viewport size
  await page.setViewportSize({ width: 1280, height: 960 });

  // Navigate to application
  console.log('Navigating to app...');
  await page.goto(serverUrl);
  await page.waitForSelector('.canvas-2d__canvas');

  // Load the rectangular project via window.useDeckStore
  console.log('Loading rectangular project into store...');
  await page.evaluate((proj) => {
    window.useDeckStore.getState().loadProject(proj.sections, proj.materials);
  }, mockProject);
  
  // Let the canvas render
  await page.waitForTimeout(1000);

  // ─── STEP 1: Screenshot 2D and 3D Viewports ───
  console.log('Step 1: Capturing 2D and 3D viewports...');
  
  // Capture 2D view
  await page.screenshot({ path: path.join(outputDir, 'c2-rectangle-2d.png') });
  console.log('Screenshot saved: c2-rectangle-2d.png');

  // Switch to 3D Viewport
  await page.evaluate(() => window.useDeckStore.getState().setViewMode('3d'));
  await page.waitForTimeout(1000); // Allow WebGL context to compile
  await page.screenshot({ path: path.join(outputDir, 'c2-rectangle-3d.png') });
  console.log('Screenshot saved: c2-rectangle-3d.png');

  // Switch back to 2D
  await page.evaluate(() => window.useDeckStore.getState().setViewMode('2d'));
  await page.waitForTimeout(500);

  // Get canvas element bounding box to compute click positions
  const canvasElement = await page.$('.canvas-2d__canvas');
  const rect = await canvasElement.boundingBox();
  const canvasX = rect.x;
  const canvasY = rect.y;

  // ─── STEP 2: Click OUTSIDE ───
  console.log('Step 2: Clicking OUTSIDE deck boundary...');
  // Click at coordinate (100, 300) relative to canvas (outside of [184, 120, 616, 480])
  await page.mouse.click(canvasX + 100, canvasY + 300);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, 'c3-click-outside.png') });
  
  const selectionOutside = await page.evaluate(() => window.useDeckStore.getState().selectedSectionId);
  console.log(`Click Outside Selection State: ${selectionOutside ? `Selected ID "${selectionOutside}"` : 'No section selected (correct)'}`);

  // ─── STEP 3: Click INSIDE ───
  console.log('Step 3: Clicking INSIDE deck boundary...');
  // Click at coordinate (400, 300) relative to canvas (inside of [184, 120, 616, 480])
  await page.mouse.click(canvasX + 400, canvasY + 300);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, 'c3-click-inside.png') });

  const selectionInside = await page.evaluate(() => window.useDeckStore.getState().selectedSectionId);
  console.log(`Click Inside Selection State: ${selectionInside ? `Selected ID "${selectionInside}" (correct)` : 'No section selected'}`);

  // ─── STEP 4: Drag Selected Section ───
  console.log('Step 4: Performing rigid drag translation...');
  // Screenshot before drag
  await page.screenshot({ path: path.join(outputDir, 'c3-drag-before.png') });
  
  // Drag from center (400, 300) to (500, 400) relative to canvas
  await page.mouse.move(canvasX + 400, canvasY + 300);
  await page.mouse.down();
  await page.mouse.move(canvasX + 500, canvasY + 400, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: path.join(outputDir, 'c3-drag-after.png') });
  console.log('Screenshot saved: c3-drag-after.png');

  const dragPos = await page.evaluate(() => {
    const sec = window.useDeckStore.getState().sections[0];
    return { x: sec.x, y: sec.y, vertices: sec.vertices };
  });
  console.log(`Dragged position in store: x: ${dragPos.x}, y: ${dragPos.y}`);
  console.log(`Dragged vertices: ${JSON.stringify(dragPos.vertices)}`);

  // ─── STEP 5: Save, Reload, and Load ───
  console.log('Step 5: Saving and round-tripping project file...');
  
  // Click open Save As modal
  await page.click('#btn-save');
  await page.waitForSelector('#modalProjectName');
  await page.fill('#modalProjectName', 'VerifyProject');
  
  // Setup file download interception
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.toolbar-modal__card .btn--primary')
  ]);
  
  const downloadPath = path.join(process.cwd(), 'VerifyProject.deck');
  await download.saveAs(downloadPath);
  console.log(`Project file downloaded successfully to: ${downloadPath}`);

  // Reload the page
  console.log('Reloading browser tab...');
  await page.reload();
  await page.waitForSelector('.canvas-2d__canvas');
  
  // Verify state reset
  const resetPos = await page.evaluate(() => {
    const sec = window.useDeckStore.getState().sections[0];
    return { x: sec.x, y: sec.y };
  });
  console.log(`Position after reload: x: ${resetPos.x}, y: ${resetPos.y} (reset to origin)`);

  // Upload and load the .deck file
  console.log('Uploading saved project file...');
  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles(downloadPath);
  await page.waitForTimeout(1000); // Allow file parsing and state load
  
  await page.screenshot({ path: path.join(outputDir, 'c3-save-reload-load.png') });
  
  const restoredPos = await page.evaluate(() => {
    const sec = window.useDeckStore.getState().sections[0];
    return { x: sec.x, y: sec.y, vertices: sec.vertices };
  });
  console.log(`Restored position after loading: x: ${restoredPos.x}, y: ${restoredPos.y}`);
  console.log(`Restored vertices: ${JSON.stringify(restoredPos.vertices)}`);

  // Write a text report of selection-state and positions
  const reportPath = path.join(process.cwd(), 'browser-verification-report.txt');
  const reportContent = `DeckForge Browser Verification Report
==================================================
Date: ${new Date().toISOString()}

Step 1: Loaded Rectangular Project
- Rendered 2D: c2-rectangle-2d.png
- Rendered 3D: c2-rectangle-3d.png

Step 2: Click OUTSIDE Deck (at screen 100, 300)
- Section selected (ID): ${selectionOutside || 'None (Correct)'}
- Screenshot: c3-click-outside.png

Step 3: Click INSIDE Deck (at screen 400, 300)
- Section selected (ID): ${selectionInside || 'None'} (Expected: "sec-verify-deck")
- Screenshot: c3-click-inside.png

Step 4: Rigid Drag Translation (dx: +100px, dy: +100px on screen)
- Initial Position: x: -72, y: -60
- Dragged Position in Store: x: ${dragPos.x}, y: ${dragPos.y} (Expected: x: -36, y: -24)
- Dragged Vertices: ${JSON.stringify(dragPos.vertices)}
- Screenshots: c3-drag-before.png, c3-drag-after.png

Step 5: Save, Reload, and Re-load
- Reload Position: x: ${resetPos.x}, y: ${resetPos.y} (Expected: x: 0, y: 0)
- Restored Position: x: ${restoredPos.x}, y: ${restoredPos.y} (Expected: x: -36, y: -24)
- Restored Vertices: ${JSON.stringify(restoredPos.vertices)}
- Screenshot: c3-save-reload-load.png
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`Report successfully written to: ${reportPath}`);

  // Cleanup
  await browser.close();
  viteProcess.kill();
  console.log('Browser closed and Vite process terminated.');
  process.exit(0);

} catch (err) {
  console.error('An error occurred during verification:', err);
  viteProcess.kill();
  process.exit(1);
}
