const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const previewUrl = 'http://127.0.0.1:4183';
const debuggingPort = 9339;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local process may still be starting.
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
      (this.listeners.get(message.method) ?? []).forEach((handler) => handler(message.params));
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, handler) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), handler]);
  }

  once(method) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 15_000);
      const handler = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function navigate(client, path) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url: `${previewUrl}${path}` });
  await loaded;
  await delay(500);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`artifacts/${name}`, Buffer.from(result.data, 'base64'));
}

async function pageFacts(client) {
  return evaluate(client, `({
    path: location.pathname,
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    heading: document.querySelector('h1')?.textContent ?? '',
    alert: document.querySelector('[role="alert"]')?.textContent ?? null
  })`);
}

async function run() {
  mkdirSync('artifacts', { recursive: true });
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4183', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${process.cwd()}\\artifacts\\chrome-cycle3-${Date.now()}`,
    '--no-first-run',
    '--disable-default-apps',
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });

  try {
    await waitForUrl(previewUrl);
    await waitForUrl(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('Chrome page target was not found');
    const client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    const errors = [];
    client.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails.text));
    client.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') errors.push(event.args.map((argument) => argument.value ?? argument.description).join(' '));
    });
    client.on('Log.entryAdded', (event) => {
      if (event.entry.level === 'error') errors.push(event.entry.text);
    });
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable')]);

    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate(client, '/');
    const dashboardDesktop = await pageFacts(client);
    await screenshot(client, 'cycle3-dashboard-desktop.png');
    await evaluate(client, `document.querySelector('button[aria-label*="справку"]')?.click()`);
    await delay(100);
    const help = await evaluate(client, `({
      opened: Boolean(document.querySelector('[role="dialog"]')),
      focusedOnOpen: document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false
    })`);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await delay(100);
    help.closedWithEscape = await evaluate(client, `!document.querySelector('[role="dialog"]')`);
    help.returnedAfterClose = await evaluate(client, `document.activeElement?.getAttribute('aria-label')?.includes('справку') ?? false`);

    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(client, '/');
    const dashboardMobile = await pageFacts(client);
    await screenshot(client, 'cycle3-dashboard-mobile.png');
    await navigate(client, '/analysis');
    await evaluate(client, `([...document.querySelectorAll('button')].find((button) => button.textContent.includes('Ручной драфт'))?.click(), true)`);
    await delay(800);
    const draftFormMobile = {
      ...await pageFacts(client),
      catalogStatus: await evaluate(client, `document.querySelector('.draft-form__source')?.textContent ?? ''`),
      selectedHeroes: await evaluate(client, `document.querySelectorAll('.hero-picker__chip').length`),
    };
    await screenshot(client, 'cycle3-draft-form-mobile.png');
    for (let team = 0; team < 2; team += 1) {
      for (let hero = 0; hero < 5; hero += 1) {
        await evaluate(client, `(() => {
          const input = document.querySelectorAll('.hero-picker__search input')[${team}];
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'a');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`);
        await delay(100);
        await evaluate(client, `document.querySelectorAll('.hero-picker')[${team}]?.querySelector('.hero-picker__results button')?.click()`);
        await delay(100);
      }
    }
    const selectedDraftHeroes = await evaluate(client, `document.querySelectorAll('.hero-picker__chip').length`);
    await evaluate(client, `document.querySelector('.new-analysis__workspace')?.requestSubmit()`);
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const finished = await evaluate(client, `location.pathname === '/analysis/draft/result' || Boolean(document.querySelector('.new-analysis__error[role="alert"]'))`);
      if (finished) break;
      await delay(250);
    }
    await delay(800);
    const draftResultMobile = {
      ...await pageFacts(client),
      selectedDraftHeroes,
      hasChart: await evaluate(client, `Boolean(document.querySelector('.draft-power-chart'))`),
      warningCount: await evaluate(client, `document.querySelectorAll('.draft-analysis-result__warnings li').length`),
    };
    await screenshot(client, 'cycle3-draft-result-mobile.png');
    await navigate(client, '/analysis/draft/result');
    const draftEmptyMobile = await pageFacts(client);
    await screenshot(client, 'cycle3-draft-empty-mobile.png');
    await navigate(client, '/settings');
    const settingsMobile = await pageFacts(client);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const ready = await evaluate(client, `Boolean(document.querySelector('.data-deletion__summary'))`);
      if (ready) break;
      await delay(100);
    }
    settingsMobile.dataSummary = await evaluate(client, `document.querySelector('.data-deletion__summary')?.textContent ?? ''`);
    await screenshot(client, 'cycle3-settings-mobile.png');
    await evaluate(client, `(() => {
      const input = document.querySelector('#delete-all-confirmation');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'УДАЛИТЬ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await delay(100);
    await evaluate(client, `document.querySelector('.data-deletion__delete')?.click()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const done = await evaluate(client, `Boolean(document.querySelector('.data-deletion__message:not(.data-deletion__message--error)'))`);
      if (done) break;
      await delay(100);
    }
    const dataDeletion = {
      path: await evaluate(client, `location.pathname`),
      message: await evaluate(client, `document.querySelector('.data-deletion__message')?.textContent ?? ''`),
      alert: await evaluate(client, `document.querySelector('.data-deletion__message--error')?.textContent ?? null`),
    };

    client.socket.close();
    process.stdout.write(JSON.stringify({ dashboardDesktop, help, dashboardMobile, draftFormMobile, draftResultMobile, draftEmptyMobile, settingsMobile, dataDeletion, errors }, null, 2));
  } finally {
    chrome.kill();
    preview.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
