const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const previewUrl = 'http://127.0.0.1:4181';
const debuggingPort = 9337;
const artifactDirectory = 'artifacts';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForUrl(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const handlers = this.listeners.get(message.method) ?? [];
      handlers.forEach((handler) => handler(message.params));
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  once(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const handler = (params) => {
        clearTimeout(timeout);
        const handlers = this.listeners.get(method) ?? [];
        this.listeners.set(method, handlers.filter((item) => item !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function navigate(client, url) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;
  await delay(500);
}

async function screenshot(client, path) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

async function run() {
  mkdirSync(artifactDirectory, { recursive: true });
  const preview = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4181', '--strictPort'],
    { cwd: process.cwd(), windowsHide: true, stdio: 'ignore' },
  );
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${process.cwd()}\\artifacts\\chrome-cycle2-${Date.now()}`,
      '--no-first-run',
      '--disable-default-apps',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );

  try {
    await waitForUrl(previewUrl);
    await waitForUrl(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
    const pageTarget = targets.find((target) => target.type === 'page');
    if (!pageTarget) throw new Error('Chrome page target was not found');
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.open();
    const errors = [];
    client.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails.text));
    client.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') errors.push(event.args.map((argument) => argument.value ?? argument.description).join(' '));
    });
    client.on('Log.entryAdded', (event) => {
      if (event.entry.level === 'error') errors.push(event.entry.text);
    });
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
    ]);

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(client, `${previewUrl}/analysis`);
    await screenshot(client, 'artifacts/cycle2-analysis-desktop.png');
    const desktop = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('h1')?.textContent ?? ''
    })`);

    await evaluate(client, `(() => {
      const mode = [...document.querySelectorAll('button')]
        .find((button) => button.textContent.includes('По Match ID'));
      mode?.click();
      return Boolean(mode);
    })()`);
    await delay(200);
    await evaluate(client, `(() => {
      const input = document.querySelector('input[inputmode="numeric"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '8936275660');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.closest('form').requestSubmit();
      return true;
    })()`);

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const done = await evaluate(client, `location.pathname === '/analysis/match/result'
        || Boolean(document.querySelector('[role="alert"]'))`);
      if (done) break;
      await delay(250);
    }
    await delay(800);
    const match = await evaluate(client, `({
      path: location.pathname,
      alert: document.querySelector('[role="alert"]')?.textContent ?? null,
      heading: document.querySelector('h1')?.textContent ?? '',
      hasChart: Boolean(document.querySelector('.match-advantage-chart'))
    })`);
    await screenshot(client, 'artifacts/cycle2-match-result-desktop.png');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(300);
    const mobileMatch = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    })`);
    await screenshot(client, 'artifacts/cycle2-match-result-mobile.png');

    await navigate(client, `${previewUrl}/analysis/result`);
    const mobileEmpty = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      heading: document.querySelector('h1')?.textContent ?? ''
    })`);
    await screenshot(client, 'artifacts/cycle2-handicap-empty-mobile.png');

    await navigate(client, `${previewUrl}/analysis`);
    const mobileForm = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      heading: document.querySelector('h1')?.textContent ?? ''
    })`);
    await screenshot(client, 'artifacts/cycle2-analysis-mobile.png');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(client, `${previewUrl}/bets`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const ready = await evaluate(client, `document.querySelector('.bets-journal')?.getAttribute('aria-busy') === 'false'`);
      if (ready) break;
      await delay(100);
    }
    const betsDesktop = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      busy: document.querySelector('.bets-journal')?.getAttribute('aria-busy'),
      description: document.querySelector('.page-heading__description')?.textContent ?? '',
      alert: document.querySelector('[role="alert"]')?.textContent ?? null
    })`);
    await screenshot(client, 'artifacts/cycle2-bets-desktop.png');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(300);
    const betsMobile = await evaluate(client, `({
      path: location.pathname,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      busy: document.querySelector('.bets-journal')?.getAttribute('aria-busy')
    })`);
    await screenshot(client, 'artifacts/cycle2-bets-mobile.png');
    client.close();

    process.stdout.write(JSON.stringify({
      desktop,
      match,
      mobileMatch,
      mobileEmpty,
      mobileForm,
      betsDesktop,
      betsMobile,
      errors,
    }, null, 2));
  } finally {
    chrome.kill();
    preview.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
