import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({timeout:10000});
try {
 const page=await browser.newPage(); page.setDefaultTimeout(7000);
 await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:`window.calls=[];window.YT={Player:class{constructor(el,o){this.o=o;this.state=-1;window.finish=()=>o.events.onStateChange({data:0});setTimeout(()=>o.events.onReady(),0)}cueVideoById(){}loadVideoById(id){window.calls.push(id)}playVideo(){this.state=1;this.o.events.onStateChange({data:1})}stopVideo(){this.state=-1}getPlayerState(){return this.state}destroy(){}}};window.onYouTubeIframeAPIReady();`}));
 await page.goto(process.env.APP_URL ?? 'http://localhost:3051');
 await page.evaluate(()=>{
 localStorage.setItem('sl_savedSongs_v2',JSON.stringify(['abcdefghijk','lmnopqrstuv'].map((id,i)=>({videoId:id,title:'Song '+(i+1),url:'https://www.youtube.com/watch?v='+id,thumbnailUrl:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'}))));
 const items=[{id:'one',videoId:'abcdefghijk'},{id:'two',videoId:'lmnopqrstuv'}];
 localStorage.setItem('sl_setListDraft_v2',JSON.stringify(items));
 localStorage.setItem('sl_savedSetLists_v2',JSON.stringify([{id:'gig',name:'Gig',createdAt:'2026-01-01',items}]));
 }); await page.reload();
 await page.getByRole('button',{name:'Saved Set Lists (1)',exact:true}).click();
 await page.getByRole('button',{name:'Load',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('sl_savedSetLists_v2'));
 await page.getByRole('button',{name:'Practice Song 2',exact:true}).click();
 if(await page.getByText('Tap to continue',{exact:true}).isVisible()) await page.getByText('Tap to continue',{exact:true}).click();
 await expect(page.getByText('Practicing: Song 2',{exact:true})).toBeVisible();
 await page.waitForFunction(()=>typeof window.finish==='function');
 await page.evaluate(()=>window.finish());
 await expect(page.getByRole('button',{name:'Stop Practice',exact:true})).toHaveCount(0);
 await page.getByLabel('Repeat song (practice only)').check();
 await page.getByRole('button',{name:'Practice Song 2',exact:true}).click();
 const count=await page.evaluate(()=>window.calls.length);
 await page.evaluate(()=>window.finish());
 await page.waitForFunction(c=>window.calls.length>c,count);
 await expect(page.getByText('Practicing: Song 2',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Play Set List',exact:true}).click();
 await page.waitForFunction(()=>window.calls.at(-1)==='abcdefghijk');
 await expect(page.getByRole('button',{name:'Stop Practice',exact:true})).toHaveCount(0);
 if(await page.evaluate(()=>localStorage.getItem('sl_savedSetLists_v2'))!==before)throw Error('Saved list changed');
 await page.getByRole('button',{name:'Stop Set List',exact:true}).click();
 for(const width of [1200,1600]) {
   await page.setViewportSize({width,height:1000});
   const panels=await page.locator('.song-panel').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
   if(panels[0].y!==panels[1].y || panels[0].x>=panels[1].x)throw Error('Desktop panels must be side by side');
 }
 await page.screenshot({path:'/tmp/practice-side-by-side.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 console.log('PASS: practice stops, repeat restarts same song, full list starts from top, saved list unchanged');
}finally{await browser.close()}
