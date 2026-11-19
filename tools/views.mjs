// Screenshots of the game from fixed spots, to compare looks before and after a change.
//   node tools/views.mjs <outDir> [baseUrl=http://localhost:5173/]
// Each view: name, eye x,y,z, yaw (0 looks towards +z). Needs the dev server and Google Chrome.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [out, base = 'http://localhost:5173/'] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VIEWS = [
  ['01_tribun_kenari', 9, 6, -49, 0.6],
  ['02_ceza_sahasi_yakin', -38, 2.2, -4, -1.75],
  ['03_on_sira_taraftar', 4.5, 3.4, -41.5, -Math.PI / 2 - 0.75],
  ['04_tunel_sahadan', -3, 2.6, -33, Math.PI - 0.25],
  ['05_on_sira_koltuk3', 0.275, 2.38, -44.25, 0],
];

fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--lang=tr-TR'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 120000 });
await page.waitForFunction(() => window.__dev?.stage, { timeout: 120000 });
// Close the welcome card and the bottom bar so the view is clear.
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => /Sadece izle|Just watch/i.test(b.textContent ?? ''))?.click();
});
await new Promise((r) => setTimeout(r, 1500));
await page.addStyleTag({ content: '#ui > *:not(canvas){visibility:hidden !important}' });
for (const [name, x, y, z, yaw] of VIEWS) {
  await page.evaluate((e, a) => window.__dev.stage.enterFirstPerson(e, a), { x, y, z }, yaw);
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
await browser.close();
