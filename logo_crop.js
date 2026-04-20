const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/br0dysseu5/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000); // let 3D/font load
  // Full page screenshot
  await page.screenshot({ path: '/home/br0dysseu5/Downloads/katabased_nav.png', clip: { x: 0, y: 0, width: 500, height: 70 } });
  // Also full page
  await page.screenshot({ path: '/home/br0dysseu5/Downloads/katabased_full.png', fullPage: false });
  await browser.close();
  console.log('done');
})();
