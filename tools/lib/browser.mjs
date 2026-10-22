// 找到本机的 Chrome / Chromium 并用 puppeteer-core 打开预览页。不写死路径：
// 依次尝试 CHROME_PATH 环境变量、Playwright 预装的 Chromium、常见安装位置、PATH。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { ROOT } from './util.mjs';

export function findChrome() {
  const c = [];
  if (process.env.CHROME_PATH) c.push(process.env.CHROME_PATH);
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      c.push(path.join(pw, d, 'chrome-linux/chrome'), path.join(pw, d, 'chrome-linux64/chrome'));
    }
  }
  c.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  );
  for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { c.push(execSync(`command -v ${n}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch {}
  }
  const hit = c.find((p) => p && fs.existsSync(p));
  if (!hit) throw new Error('没有找到 Chrome / Chromium。请安装，或用 CHROME_PATH 指定路径。');
  return hit;
}

export async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-accelerated-2d-canvas', // 云端软件 GPU 画 2D 画布会出现斜条瑕疵，改用 CPU 绘制
      '--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    protocolTimeout: 600000,
  });
}

/** 打开预览页的渲染模式，等待就绪，返回 page。 */
export async function openFilm(browser, query = '') {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  const url = pathToFileURL(path.join(ROOT, 'preview.html')).href + '?render=1' + (query ? '&' + query : '');
  await page.goto(url);
  await page.waitForFunction('window.__film && window.__film.ready', { timeout: 120000 });
  return page;
}

/** 在页面里渲染时刻 t 并取回 PNG Buffer。 */
export async function grab(page, t, opts = {}) {
  const b64 = await page.evaluate(async (t, opts) => window.__film.capture(t, opts), t, opts);
  return Buffer.from(b64, 'base64');
}
