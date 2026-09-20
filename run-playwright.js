import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(msg.text()));
  await page.goto('http://localhost:4000/test-lamejs-browser.html');
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
