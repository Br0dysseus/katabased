const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/br0dysseu5/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000); // let animations settle
  await page.screenshot({ path: '/home/br0dysseu5/Downloads/katabased.png', fullPage: false });
  await browser.close();
  console.log('done');
})();
