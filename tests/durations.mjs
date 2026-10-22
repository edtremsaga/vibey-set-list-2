import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',timeout:10000});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(15000);
 let requests=0;
 await page.route('**/api/youtube/durations?*',async route=>{requests++;await route.fulfill({json:{durations:{abcdefghijk:180,lmnopqrstuv:240}}});});
 await page.goto(process.env.APP_URL??'http://localhost:3058');
 await page.evaluate(()=>{
 localStorage.setItem('sl_savedSongs_v2',JSON.stringify(['abcdefghijk','lmnopqrstuv','zzzzzzzzzzz'].map((id,i)=>({videoId:id,title:'Song '+(i+1),url:'https://www.youtube.com/watch?v='+id,thumbnailUrl:'/favicon.ico'}))));
 localStorage.setItem('sl_setListDraft_v2',JSON.stringify([{id:'one',videoId:'abcdefghijk'},{id:'two',videoId:'lmnopqrstuv'},{id:'three',videoId:'abcdefghijk'},{id:'four',videoId:'zzzzzzzzzzz'}]));
 });await page.reload();
 const set=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Set List',exact:true})});
 await expect(set.getByTestId('set-list-duration')).toHaveText('Known time: 10:00 · 1 duration unknown');
 await expect(set.getByLabel('Duration: 3:00',{exact:true})).toHaveCount(2);
 await set.getByRole('button',{name:'Actions for Song 3',exact:true}).click();await set.getByRole('button',{name:'Remove Song 3 from set list',exact:true}).click();
 await expect(set.getByTestId('set-list-duration')).toHaveText('Total time: 10:00');
 const saved=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Saved Songs',exact:true})});
 await saved.getByRole('button',{name:'Add Song 2 to set list',exact:true}).click();
 await expect(set.getByTestId('set-list-duration')).toHaveText('Total time: 14:00');
 await page.reload();await expect(set.getByTestId('set-list-duration')).toHaveText('Total time: 14:00');
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await expect(set.getByRole('button',{name:'Practice Song 1',exact:true}).first()).toBeVisible();
 await page.setViewportSize({width:1600,height:1000});
 await page.locator('#recording-files').setInputFiles(process.env.RECORDING_FIXTURE);
 await expect(saved.locator('.song-title').filter({hasText:'Biggie'})).toBeVisible();
 await saved.getByRole('button',{name:'Add Biggie 10.2 to set list',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sl_savedSongs_v2')).find(s=>s.source==='local')?.durationSeconds)).toBeGreaterThan(0);
 await expect(set.getByTestId('set-list-duration')).not.toContainText('unknown');
 // Remove stored metadata only, retaining the original imported bytes to test backfill.
 await page.evaluate(()=>{const songs=JSON.parse(localStorage.getItem('sl_savedSongs_v2'));for(const song of songs)if(song.source==='local')delete song.durationSeconds;localStorage.setItem('sl_savedSongs_v2',JSON.stringify(songs));});
 await page.reload();await expect(set.getByTestId('set-list-duration')).not.toContainText('unknown');
 console.log('PASS: YouTube duration backfill, duplicate count, unknown handling, add/remove totals, reload persistence, mobile layout, MP3 import and legacy metadata backfill; batched requests:',requests);
}finally{await browser.close();}
