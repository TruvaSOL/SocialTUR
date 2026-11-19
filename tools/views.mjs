// Screenshots of the game from fixed spots, to compare looks before and after a change.
//   node tools/views.mjs <outDir> [baseUrl=http://localhost:5173/]
// Each view: name, eye x,y,z, yaw (0 looks towards +z). Needs the dev server and Google Chrome.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [out, base = 'http://localhost:5173/'] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// First-person views: [name, x, y, z, yaw]. Orbit views: [name, 'orbit', camera x,y,z, target x,y,z].
const VIEWS = [
  ['01_tribun_kenari', 9, 6, -49, 0.6],
  ['02_ceza_sahasi_yakin', -38, 2.2, -4, -1.75],
  ['03_on_sira_taraftar', 4.5, 3.4, -41.5, -Math.PI / 2 - 0.75],
  ['04_tunel_sahadan', -3, 2.6, -33, Math.PI - 0.25],
  ['05_on_sira_koltuk3', 0.275, 2.38, -44.25, 0],
  ['06_kus_bakisi', 'orbit', 170, 150, 190, 0, 0, 0],
  ['07_dis_cephe', 'orbit', 150, 22, 120, 0, 18, 0],
  ['08_cati_alti', 'orbit', 20, 30, 20, -40, 30, -60],
  ['09_park', 'orbit', 260, 60, 330, 0, 10, 0],
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
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, x, y, z, yaw, ...rest] of VIEWS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  if (x === 'orbit') {
    await page.evaluate(
      (c, t) => {
        const s = window.__dev.stage;
        s.setMode('overview');
        s.controls.autoRotate = false;
        s.controls.enableDamping = false;
        s.controls.target.set(t[0], t[1], t[2]);
        s.camera.position.set(c[0], c[1], c[2]);
        s.controls.update();
      },
      [y, z, yaw],
      rest,
    );
  } else {
    await page.evaluate((e, a) => window.__dev.stage.enterFirstPerson(e, a), { x, y, z }, yaw);
  }
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
await browser.close();
