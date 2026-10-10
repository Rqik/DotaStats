const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const previewUrl = 'http://127.0.0.1:4198';
const debuggingPort = 9354;
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

const assert = require('node:assert/strict');

async function clickText(client, caption) {
  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(caption)});
    if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(caption)});
    button.click();
  })()`);
}

async function reload(client) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.reload');
  await loaded;
}

async function run() {
  mkdirSync('artifacts', { recursive: true });
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4198','--strictPort'], {windowsHide:true,stdio:'ignore'});
  const chrome = spawn(chromePath,['--headless=new',`--remote-debugging-port=${debuggingPort}`,`--user-data-dir=${process.cwd()}\\artifacts\\chrome-form-live-${Date.now()}`,'--no-first-run','--disable-default-apps','about:blank'],{windowsHide:true,stdio:'ignore'});
  let client;
  const result = { source: 'controlled API fixtures; real CORS verified separately' };
  try {
    await waitForUrl(previewUrl);
    await waitForUrl(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targets=await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then(r=>r.json());
    client=new CdpClient(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await client.open();
    const errors=[];
    const requests=[];
    let liveScenario='complete';
    client.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.text));
    client.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value??a.description).join(' '));});
    client.on('Log.entryAdded',e=>{if(e.entry.level==='error')errors.push(e.entry.text);});
    client.on('Fetch.requestPaused', event => {
      const url=new URL(event.request.url);
      const path=url.pathname.replace('/api','');
      requests.push(path);
      const now=Math.floor(Date.now()/1000);
      let fixture=[];
      if(path==='/leagues') fixture=[{leagueid:19102,name:'BLAST SLAM VIII',tier:'professional'},{leagueid:65006,name:'The International 2026',tier:'premium'}];
      else if(/^\/leagues\/\d+\/teams$/.test(path)) fixture=[{team_id:1,name:'Team Yandex',tag:'TY',logo_url:null},{team_id:2,name:'Team Liquid',tag:'TL',logo_url:null}];
      else if(path==='/heroStats') fixture=Array.from({length:10},(_,i)=>({id:i+1,name:`npc_dota_hero_test_${i+1}`,localized_name:`Test Hero ${i+1}`,roles:[],pro_pick:1000,pro_win:500}));
      else if(path==='/live') {
        const live={match_id:'9037322346',league_id:19102,deactivate_time:0,last_update_time:now-(liveScenario==='stale'?600:30),game_time:120,delay:120,team_id_radiant:1,team_id_dire:2,team_name_radiant:'Team Yandex',team_name_dire:'Team Liquid',radiant_score:1,dire_score:0,players:Array.from({length:liveScenario==='partial'?9:10},(_,i)=>({team:i<5?0:1,hero_id:i+1}))};
        fixture=liveScenario==='missing'?[]:liveScenario==='malformed'?{unexpected:true}:[live];
      }
      else if(/\/heroes\/\d+\/matchups$/.test(path)) fixture=Array.from({length:10},(_,i)=>({hero_id:i+1,games_played:100,wins:50}));
      else if(/\/heroes\/\d+\/durations$/.test(path)) fixture=[1200,1800,2400,3000].map(duration_bin=>({duration_bin,games_played:100,wins:50}));
      else if(/^\/teams\/\d+\/matches$/.test(path)) fixture=Array.from({length:20},(_,i)=>({match_id:8000000000+i,start_time:now-i*86400,radiant:true,radiant_win:i%2===0,radiant_score:30,dire_score:20,duration:2400,leagueid:19102,radiant_team_id:1,dire_team_id:2}));
      else if(/^\/matches\/\d+$/.test(path)) fixture={match_id:Number(path.split('/').at(-1)),version:21,duration:2400,start_time:now-2400,radiant_score:30,dire_score:20,radiant_win:true,radiant_team:{team_id:1,name:'Team Yandex'},dire_team:{team_id:2,name:'Team Liquid'},players:Array.from({length:10},(_,i)=>({player_slot:i<5?i:i+123,hero_id:i+1,kills:3,deaths:2,assists:4})),radiant_gold_adv:[0,100,300],radiant_xp_adv:[0,200,500]};
      const fulfill=()=>client.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'},{name:'access-control-allow-origin',value:'*'}],body:Buffer.from(JSON.stringify(fixture)).toString('base64')}).catch(error=>errors.push(error.message));
      if(path==='/live') setTimeout(fulfill,200);
      else void fulfill();
    });
    await Promise.all([client.send('Page.enable'),client.send('Runtime.enable'),client.send('Log.enable'),client.send('Network.enable'),client.send('Fetch.enable',{patterns:[{urlPattern:'https://api.opendota.com/api/*'}]})]);
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const loaded=client.once('Page.loadEventFired');
    await client.send('Page.navigate',{url:`${previewUrl}/analysis`});
    await loaded;
    const leagueInput='.team-picker__league-picker [role="combobox"]';
    await waitFor(client,`Boolean(document.querySelector(${JSON.stringify(leagueInput)})&&!document.querySelector(${JSON.stringify(leagueInput)}).disabled)`,'league catalog');
    await selectOption(client,'.team-picker__league-filter select[aria-label*="уровню"]','professional');
    await setInput(client,leagueInput,'BLAST');
    await waitFor(client,`document.querySelectorAll('.team-picker__option').length===1`,'BLAST option');
    await evaluate(client,`document.querySelector('.team-picker__option').click()`);
    await waitFor(client,`document.querySelectorAll('.team-picker__teams [role="combobox"]:not(:disabled)').length===2`,'team catalog');
    for(const side of [1,2]) {
      await setInput(client,`.team-picker__teams .team-picker__field:nth-child(${side}) [role="combobox"]`,'Team');
      await waitFor(client,`document.querySelectorAll('.team-picker__teams .team-picker__field:nth-child(${side}) .team-picker__option').length>0`,'team options');
      await evaluate(client,`document.querySelector('.team-picker__teams .team-picker__field:nth-child(${side}) .team-picker__option').click()`);
    }
    await selectOption(client,'.new-analysis__fields select','2');
    await clickText(client,'−');
    await setInput(client,'.new-analysis__sign-row input','7.5');
    await setInput(client,'.new-analysis__fields > label:last-child input','1.90');
    await clickText(client,'50 карт');
    const choiceExpression=`({league:document.querySelector(${JSON.stringify(leagueInput)}).value,teams:[...document.querySelectorAll('.team-picker__teams [role="combobox"]')].map(i=>i.value),selected:document.querySelector('.new-analysis__fields select').value,line:document.querySelector('.new-analysis__sign-row input').value,odds:document.querySelector('.new-analysis__fields > label:last-child input').value,sample:document.querySelector('.new-analysis__sample-option--active').textContent,tier:document.querySelector('.team-picker__league-filter select[aria-label*="уровню"]').value,sign:document.querySelector('.new-analysis__sign--active').getAttribute('aria-label')})`;
    const before=await evaluate(client,choiceExpression);
    await reload(client);
    await waitFor(client,`document.querySelectorAll('.team-picker__teams [role="combobox"]:not(:disabled)').length===2`,'restored team catalog');
    const after=await evaluate(client,choiceExpression);
    assert.deepEqual(after,before);
    result.persistence={before,after};
    await evaluate(client,`document.querySelector('a[href="/settings"]').click()`);
    await waitFor(client,`Boolean(document.querySelector('.settings-page'))`,'settings route');
    await evaluate(client,`document.querySelector('a[href="/analysis"]').click()`);
    await waitFor(client,`Boolean(document.querySelector('.new-analysis'))`,'analysis route');
    assert.deepEqual(await evaluate(client,choiceExpression),before);
    result.navigationPreservesSelection=true;
    await evaluate(client,`[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent.includes('Match ID')).click()`);
    await setInput(client,'input[inputmode="numeric"]','9037322346');
    await clickText(client,'Загрузить текущий матч');
    await waitFor(client,`Boolean(document.querySelector('.new-analysis__submit:disabled'))`,'loading blocks repeated request');
    await waitFor(client,`Boolean(document.querySelector('.live-match__import:not(:disabled)'))`,'complete live draft');
    result.liveNames=await evaluate(client,`[...document.querySelectorAll('.live-match__team h4')].map(i=>i.textContent)`);
    await evaluate(client,`document.querySelector('.live-match').scrollIntoView({block:'start'})`);
    await screenshot(client,'form-live-desktop.png');
    const desktopOverflow=await evaluate(client,`document.documentElement.scrollWidth>innerWidth`);
    await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await delay(150);
    await evaluate(client,`document.querySelector('.live-match').scrollIntoView({block:'start'})`);
    await screenshot(client,'form-live-mobile.png');
    result.mobileOverflow=await evaluate(client,`document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth`);
    assert.equal(desktopOverflow,false);
    assert.equal(result.mobileOverflow,false);
    await clickText(client,'Подставить драфт в анализ');
    await waitFor(client,`Boolean(document.querySelector('.draft-form'))`,'imported draft form');
    await setInput(client,'.draft-form__market label:nth-of-type(1) input','1.85');
    const readForm=`JSON.parse(localStorage.getItem('dota-pulse-analysis-form:v1')).form`;
    const imported=await evaluate(client,readForm);
    assert.deepEqual(imported.draft.teamAHeroes.map(h=>h.heroId),[1,2,3,4,5]);
    assert.deepEqual(imported.draft.teamBHeroes.map(h=>h.heroId),[6,7,8,9,10]);
    assert.equal(imported.draftOrigin.matchId,9037322346);
    assert.equal(imported.draftOrigin.teamAId,1);
    assert.equal(imported.draftOrigin.teamBId,2);
    assert.equal(imported.draft.teamAOdds,'1.85');
    await reload(client);
    await waitFor(client,`Boolean(document.querySelector('.draft-form')&&!document.querySelector('.new-analysis__submit').disabled)`,'restored complete draft');
    assert.deepEqual(await evaluate(client,readForm),imported);
    result.importedDraftRestored=true;
    await clickText(client,'Запустить анализ');
    await waitFor(client,`location.pathname==='/analysis/draft/result'`,'draft analysis result');
    await waitFor(client,`Boolean(document.querySelector('.draft-power-chart'))`,'draft chart');
    result.draftCalculation=true;
    assert(requests.includes('/teams/1/matches')&&requests.includes('/teams/2/matches'));
    const returned=client.once('Page.loadEventFired');
    await client.send('Page.navigate',{url:`${previewUrl}/analysis`});
    await returned;
    await waitFor(client,`Boolean(document.querySelector('.new-analysis'))`,'analysis screen loaded');
    await evaluate(client,`[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent.includes('Match ID')).click()`);
    for(const scenario of ['partial','missing','malformed','stale']) {
      liveScenario=scenario;
      await clickText(client,'Загрузить текущий матч');
      await waitFor(client,`Boolean(document.querySelector('.new-analysis__submit:disabled'))`,'loading '+scenario);
      await waitFor(client,`!document.querySelector('.new-analysis__submit').disabled`,'live response '+scenario);
      if(scenario==='partial') {
        assert(await evaluate(client,`Boolean(document.querySelector('.live-match__import:disabled'))&&document.querySelector('.live-match').textContent.includes('ещё не вернул десять')`));
      } else if(scenario==='missing') assert(await evaluate(client,`document.body.textContent.includes('не найден среди 0 игр')&&!document.querySelector('.live-match')`));
      else if(scenario==='malformed') assert(await evaluate(client,`Boolean(document.querySelector('.new-analysis__error[role="alert"]'))`));
      else assert(await evaluate(client,`document.querySelector('.live-match').textContent.includes('старше пяти минут')`));
      result[scenario]=true;
    }
    await selectOption(client,'.new-analysis__match-id select','completed');
    await clickText(client,'Загрузить матч');
    await waitFor(client,`location.pathname==='/analysis/match/result'`,'completed match regression');
    result.completedMatch=true;
    await evaluate(client,`document.querySelector('a[href="/settings"]').click()`);
    await waitFor(client,`Boolean(document.querySelector('#delete-all-confirmation'))`,'isolated settings deletion');
    await setInput(client,'#delete-all-confirmation','УДАЛИТЬ');
    await clickText(client,'Удалить все данные');
    await waitFor(client,`document.body.textContent.includes('Удалено записей IndexedDB')`,'confirmed deletion');
    assert.equal(await evaluate(client,`localStorage.getItem('dota-pulse-analysis-form:v1')`),null);
    await evaluate(client,`document.querySelector('a[href="/analysis"]').click()`);
    await waitFor(client,`Boolean(document.querySelector('.new-analysis'))`,'new form after deletion');
    assert.equal(await evaluate(client,`document.querySelector(${JSON.stringify(leagueInput)}).value`),'');
    result.deletionClearsDraft=true;
    assert.deepEqual(errors,[]);
    result.errors=errors;
    result.requests=requests;
    result.status='PASS';
    writeFileSync('artifacts/analysis-form-live-smoke.json',JSON.stringify(result,null,2));
    process.stdout.write(JSON.stringify(result,null,2));
  } catch(error) {
    result.status='FAIL';
    result.error=error.message;
    if(client) {
      result.page=await evaluate(client,`({path:location.pathname,text:document.body.innerText})`);
      await screenshot(client,'form-live-failure.png');
    }
    writeFileSync('artifacts/analysis-form-live-smoke.json',JSON.stringify(result,null,2));
    throw error;
  } finally {client?.socket.close();chrome.kill();preview.kill();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
