const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const previewUrl = 'http://127.0.0.1:4192';
const debuggingPort = 9348;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local preview or browser may still be starting.
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
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(client, expression, message) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await evaluate(client, expression)) return;
    await delay(125);
  }
  throw new Error(`Timed out: ${message}`);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync(`artifacts/${name}`, Buffer.from(result.data, 'base64'));
}

async function setInput(client, selector, value) {
  await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}

async function selectOption(client, selector, value) {
  await evaluate(client, `(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function run() {
  mkdirSync('artifacts', { recursive: true });
  const preview = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4192',
    '--strictPort',
  ], { windowsHide: true, stdio: 'ignore' });
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${process.cwd()}\\artifacts\\chrome-selection-${Date.now()}`,
    '--no-first-run',
    '--disable-default-apps',
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });

  try {
    await waitForUrl(previewUrl);
    await waitForUrl(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
      .then((response) => response.json());
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('Chrome page target was not found');
    const client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();

    const errors = [];
    const teamRequests = [];
    client.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails.text));
    client.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') {
        errors.push(event.args.map((argument) => argument.value ?? argument.description).join(' '));
      }
    });
    client.on('Log.entryAdded', (event) => {
      if (event.entry.level === 'error') errors.push(event.entry.text);
    });
    client.on('Network.requestWillBeSent', (event) => {
      if (/\/leagues\/\d+\/teams(?:\?|$)/.test(event.request.url)) {
        teamRequests.push(event.request.url);
      }
    });
    client.on('Fetch.requestPaused', (event) => {
      const url = new URL(event.request.url);
      let fixture = null;
      if (url.origin === 'https://api.opendota.com' && url.pathname === '/api/leagues') {
        fixture = [
          { leagueid: 65006, name: 'The International 2026', tier: 'premium' },
          { leagueid: 16935, name: 'The International 2024', tier: 'premium' },
        ];
      } else if (url.origin === 'https://api.opendota.com'
        && /^\/api\/leagues\/\d+\/teams$/.test(url.pathname)) {
        fixture = [
          { team_id: 1, name: 'Team Yandex', tag: 'YDX', logo_url: null },
          { team_id: 2, name: 'Team Liquid', tag: 'TL', logo_url: null },
          { team_id: 3, name: 'Gaimin Gladiators', tag: 'GG', logo_url: null },
        ];
      }
      if (fixture) {
        const body = Buffer.from(JSON.stringify(fixture)).toString('base64');
        void client.send('Fetch.fulfillRequest', {
          requestId: event.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'content-type', value: 'application/json' },
            { name: 'access-control-allow-origin', value: '*' },
          ],
          body,
        });
      } else {
        void client.send('Fetch.continueRequest', { requestId: event.requestId });
      }
    });
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Network.enable'),
      client.send('Fetch.enable', {
        patterns: [{ urlPattern: 'https://api.opendota.com/api/leagues*' }],
      }),
    ]);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: `${previewUrl}/analysis` });
    await loaded;

    const yearSelector = '.team-picker__league-filter select[aria-label*="году"]';
    const leagueInput = '.team-picker__league-picker [role="combobox"]';
    await waitFor(client, `document.querySelector(${JSON.stringify(yearSelector)})?.options.length > 1`, 'league years');
    const availableYears = await evaluate(client, `Array.from(document.querySelector(${JSON.stringify(yearSelector)}).options).map((option) => option.value).filter(Boolean)`);
    const year = availableYears.includes('2026') ? '2026' : availableYears[0];
    await selectOption(client, yearSelector, year);
    await setInput(client, leagueInput, `The International ${year}`);
    await waitFor(client, `Boolean([...document.querySelectorAll('.team-picker__option strong')].find((item) => item.textContent === ${JSON.stringify(`The International ${year}`)}))`, 'International release option');
    await evaluate(client, `([...document.querySelectorAll('.team-picker__option')].find((item) => item.querySelector('strong')?.textContent === ${JSON.stringify(`The International ${year}`)})?.click(), true)`);
    await waitFor(client, `document.querySelectorAll('.team-picker__teams [role="combobox"]:not(:disabled)').length === 2`, 'team comboboxes');

    await setInput(client, '.team-picker__teams .team-picker__field:nth-child(1) [role="combobox"]', 'Team');
    await waitFor(client, `document.querySelectorAll('.team-picker__teams .team-picker__field:nth-child(1) .team-picker__option').length > 0`, 'team A options');
    await evaluate(client, `document.querySelector('.team-picker__teams .team-picker__field:nth-child(1) .team-picker__option')?.click()`);
    await setInput(client, '.team-picker__teams .team-picker__field:nth-child(2) [role="combobox"]', 'Team');
    await waitFor(client, `document.querySelectorAll('.team-picker__teams .team-picker__field:nth-child(2) .team-picker__option').length > 0`, 'team B options');
    await evaluate(client, `document.querySelector('.team-picker__teams .team-picker__field:nth-child(2) .team-picker__option')?.click()`);
    await delay(250);

    const beforeSwitch = await evaluate(client, `({
      year: document.querySelector(${JSON.stringify(yearSelector)}).value,
      league: document.querySelector(${JSON.stringify(leagueInput)}).value,
      teams: [...document.querySelectorAll('.team-picker__teams [role="combobox"]')].map((input) => input.value),
      selectedTeam: document.querySelector('.new-analysis__fields select').value
    })`);
    const requestsBeforeSwitch = teamRequests.length;
    await evaluate(client, `([...document.querySelectorAll('[role="tab"]')].find((button) => button.textContent.includes('Match ID'))?.click(), true)`);
    await delay(150);
    const hiddenSemantics = await evaluate(client, `(() => {
      const panel = document.querySelector('.new-analysis__form > div[hidden]');
      const control = panel?.querySelector('input, select, button');
      control?.focus();
      return {
        hidden: Boolean(panel?.hidden),
        visible: control?.checkVisibility() ?? false,
        receivedFocus: document.activeElement === control
      };
    })()`);
    await evaluate(client, `([...document.querySelectorAll('[role="tab"]')].find((button) => button.textContent.includes('Фора по убийствам'))?.click(), true)`);
    await delay(250);

    const afterSwitch = await evaluate(client, `({
      year: document.querySelector(${JSON.stringify(yearSelector)}).value,
      league: document.querySelector(${JSON.stringify(leagueInput)}).value,
      teams: [...document.querySelectorAll('.team-picker__teams [role="combobox"]')].map((input) => input.value),
      selectedTeam: document.querySelector('.new-analysis__fields select').value
    })`);
    const controlLayout = await evaluate(client, `(() => {
      const outer = document.querySelector('.team-picker__teams .team-picker__combobox');
      const inner = outer.querySelector('input');
      const controls = [...document.querySelectorAll('.new-analysis__fields .new-analysis__control')];
      const outerStyle = getComputedStyle(outer);
      const innerStyle = getComputedStyle(inner);
      return {
        outerHeight: outer.getBoundingClientRect().height,
        outerBorder: outerStyle.borderTopWidth,
        innerHeight: inner.getBoundingClientRect().height,
        innerBorder: innerStyle.borderTopWidth,
        fieldHeights: controls.map((control) => control.getBoundingClientRect().height),
        pageScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth
      };
    })()`);
    await screenshot(client, 'selection-state-desktop.png');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(250);
    const mobileLayout = await evaluate(client, `({
      pageScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      comboboxHeights: [...document.querySelectorAll('.team-picker__combobox')].map((control) => control.getBoundingClientRect().height),
      fieldHeights: [...document.querySelectorAll('.new-analysis__fields .new-analysis__control')].map((control) => control.getBoundingClientRect().height)
    })`);
    await evaluate(client, `window.scrollTo({
      top: document.querySelector('.team-picker__teams')?.getBoundingClientRect().top + window.scrollY - 16,
      behavior: 'instant'
    })`);
    await delay(100);
    await screenshot(client, 'selection-state-mobile.png');

    const result = {
      selectedYear: year,
      beforeSwitch,
      afterSwitch,
      statePreserved: JSON.stringify(beforeSwitch) === JSON.stringify(afterSwitch),
      teamRequestsBeforeSwitch: requestsBeforeSwitch,
      teamRequestsAfterSwitch: teamRequests.length,
      noReloadOnModeSwitch: requestsBeforeSwitch === teamRequests.length,
      hiddenSemantics,
      controlLayout,
      mobileLayout,
      errors,
    };
    writeFileSync('artifacts/selection-state-smoke.json', JSON.stringify(result, null, 2));
    client.socket.close();
    process.stdout.write(JSON.stringify(result, null, 2));

    if (!result.statePreserved || !result.noReloadOnModeSwitch || errors.length > 0) {
      process.exitCode = 1;
    }
    if (!hiddenSemantics.hidden || hiddenSemantics.visible || hiddenSemantics.receivedFocus) {
      process.exitCode = 1;
    }
    if (controlLayout.pageScrollWidth > controlLayout.viewportWidth
      || mobileLayout.pageScrollWidth > mobileLayout.viewportWidth
      || mobileLayout.bodyScrollWidth > mobileLayout.viewportWidth) {
      process.exitCode = 1;
    }
  } finally {
    chrome.kill();
    preview.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
