// Run with a local dev server and a short MP3 fixture:
// RECORDING_FIXTURE=/absolute/path/sample.mp3 node tests/recordings.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixture = process.env.RECORDING_FIXTURE;
if (!fixture) throw new Error('Set RECORDING_FIXTURE to a short playable MP3.');
const buffer = await readFile(fixture);
const browser = await chromium.launch({ headless: true, timeout: 10000 });
const page = await browser.newPage();
page.setDefaultTimeout(7000);
page.setDefaultNavigationTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Model the YouTube API, avoiding network/embedding variability in mixed-source tests.
await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
  contentType: 'application/javascript', body: `
    window.__ytCalls = [];
    window.YT = { Player: class {
      constructor(element, options) { this.options = options; this.state = -1; setTimeout(() => options.events.onReady(), 0); }
      cueVideoById(id) { this.state = 5; window.__ytCalls.push(['cue', id]); }
      loadVideoById(id) { window.__ytCalls.push(['load', id]); }
      playVideo() { this.state = 1; this.options.events.onStateChange({data:1}); }
      stopVideo() { this.state = -1; }
      getPlayerState() { return this.state; }
      destroy() {}
    }};
    window.onYouTubeIframeAPIReady();
  `
}));
try {
  console.log('CHECK: legacy data and import');
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:3048');
  await page.evaluate(() => {
    localStorage.setItem('sl_savedSongs_v1', JSON.stringify([{videoId:'abcdefghijk',title:'Legacy YouTube',thumbnailUrl:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',url:'https://www.youtube.com/watch?v=abcdefghijk'}]));
    localStorage.setItem('sl_savedSetLists_v1', JSON.stringify([{id:'legacy',name:'Legacy set',createdAt:'2026-01-01',items:[{id:'legacy-row',videoId:'abcdefghijk'}]}]));
  });
  await page.reload();
  await page.getByRole('button', {name:'Add Legacy YouTube to set list', exact:true}).waitFor();
  const upload = page.locator('#recording-files');
  const sample = {name:'Band take.mp3',mimeType:'audio/mpeg',buffer};
  await upload.setInputFiles(sample);
  await page.getByRole('status').filter({hasText:'1 recording added.'}).waitFor();
  await page.getByRole('button', {name:'Add Band take to set list',exact:true}).click();
  await upload.setInputFiles({...sample,name:'Renamed copy.mp3'});
  await page.getByRole('status').filter({hasText:'1 already saved'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Add Band take to set list',exact:true}).count(),1);
  await upload.setInputFiles({name:'Broken.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('not audio')});
  await page.getByText('Broken.mp3: This file could not be decoded as audio.').waitFor();
  console.log('CHECK: title editing');
  await page.getByRole('button',{name:'Rename Band take',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Recording title').fill('Slow Moving Bird rehearsal');
  await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Add Slow Moving Bird rehearsal to set list',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'Add Slow Moving Bird rehearsal to set list',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add Legacy YouTube to set list',exact:true}).click();
  console.log('CHECK: playback');
  await page.getByRole('button',{name:'Play Set List',exact:true}).click();
  await page.waitForFunction(() => { const a=document.querySelector('audio'); return a && !a.paused && a.currentTime>0; });
  // Seek to the end of a real decoded MP3, then verify the existing countdown advances to YouTube.
  await page.evaluate(() => { const a=document.querySelector('audio'); a.currentTime=Math.max(0,a.duration-0.15); });
  await page.waitForFunction(() => window.__ytCalls?.some(([action,id]) => action==='load' && id==='abcdefghijk') || document.body.innerText.includes('Tap to continue'));
  if (await page.getByText('Tap to continue', {exact:true}).isVisible()) {
    console.log('OBSERVED: first YouTube transition requires Tap to continue');
    await page.getByText('Tap to continue', {exact:true}).click();
  }
  await page.waitForFunction(() => window.__ytCalls?.some(([action,id]) => action==='load' && id==='abcdefghijk'));
  assert.equal(await page.locator('audio').evaluate(a=>a.paused),true);
  await page.getByRole('button',{name:'Stop Set List',exact:true}).click();
  console.log('CHECK: reverse transition');
  // Reorder persisted draft to check the opposite source transition.
  await page.evaluate(() => { const rows=JSON.parse(localStorage.getItem('sl_setListDraft_v2')); localStorage.setItem('sl_setListDraft_v2',JSON.stringify(rows.reverse())); });
  await page.reload();
  await page.getByRole('button',{name:'Play Set List',exact:true}).click();
  await page.waitForFunction(() => window.__ytCalls?.some(([action]) => action==='load') || document.body.innerText.includes('Tap to continue'));
  if (await page.getByText('Tap to continue', {exact:true}).isVisible()) {
    console.log('OBSERVED: first YouTube playback requires Tap to continue');
    await page.getByText('Tap to continue', {exact:true}).click();
  }
  await page.waitForFunction(() => window.__ytCalls?.some(([action]) => action==='load'));
  // Clicking the MP3 set-list row jumps from the playing video to audio.
  await page.locator('.set-list-row').filter({hasText:'Slow Moving Bird rehearsal'}).click();
  await page.waitForFunction(() => {const a=document.querySelector('audio'); return a && !a.paused && a.currentTime>0;});
  await page.getByRole('button',{name:'Stop Set List',exact:true}).click();
  assert.equal(await page.locator('audio').evaluate(a=>a.paused),true);
  console.log('CHECK: persistence');
  const persisted=await page.evaluate(()=>({songs:JSON.parse(localStorage.getItem('sl_savedSongs_v2')),legacy:JSON.parse(localStorage.getItem('sl_savedSongs_v1')),sets:JSON.parse(localStorage.getItem('sl_savedSetLists_v1'))}));
  assert.equal(persisted.songs.length,2);
  assert.equal(persisted.legacy.length,1);
  assert.equal(persisted.sets[0].name,'Legacy set');
  console.log('CHECK: MP3-only sequencing and save/reload');
  await page.evaluate(() => {
    const song = JSON.parse(localStorage.getItem('sl_savedSongs_v2')).find(s => s.source === 'local');
    localStorage.setItem('sl_setListDraft_v2',JSON.stringify([{id:'first',videoId:song.videoId},{id:'second',videoId:song.videoId}]));
  });
  await page.reload();
  await page.getByRole('button',{name:'Save Set List',exact:true}).click();
  await page.getByRole('button',{name:'Save As New Set List',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Set list name').fill('Recording gig test');
  await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sl_savedSetLists_v2')).find(s=>s.name==='Recording gig test').items.length),2);
  await page.getByRole('button',{name:'Play Set List',exact:true}).click();
  await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused && a.currentTime>0;});
  await page.evaluate(()=>{const a=document.querySelector('audio');a.currentTime=a.duration-0.15;});
  await page.getByText('Next up:',{exact:true}).waitFor();
  await page.waitForFunction(()=>{const rows=document.querySelectorAll('.set-list-row');return rows[1]?.className.includes('border-green') && !document.querySelector('audio').paused;});
  await page.evaluate(()=>{const a=document.querySelector('audio');a.currentTime=a.duration-0.15;});
  await page.getByRole('button',{name:'Play Set List',exact:true}).waitFor();
  console.log('PASS: MP3→MP3 countdown, end of list, saved recording list survives reload');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/set-list-recordings-preview.png',fullPage:true});
  console.log('PASS: legacy data, MP3 import, duplicate detection, invalid audio, rename, reload, audio→YouTube auto-advance, YouTube→audio jump, stop.');
} catch (error) {
  console.error('FAILURE STATE', await page.evaluate(() => ({
    audio: (() => { const a = document.querySelector('audio'); return { paused: a.paused, time: a.currentTime, duration: a.duration }; })(),
    youtubeCalls: window.__ytCalls,
    playerText: document.querySelector('audio')?.parentElement?.parentElement?.innerText,
    messages: document.body.innerText.slice(-1800),
  })));
  throw error;
} finally { await browser.close(); }
