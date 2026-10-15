import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({channel: process.env.TEST_BROWSER_CHANNEL, timeout:10000});
try {
 const context = await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1600,height:1000}});
 const page = await context.newPage(); page.setDefaultTimeout(7000); page.setDefaultNavigationTimeout(15000);
 await page.goto(process.env.APP_URL ?? 'http://localhost:3056');
 await page.evaluate(()=>{
  localStorage.setItem('sl_savedSongs_v2',JSON.stringify([
   {videoId:'abcdefghijk',title:'YouTube song',url:'https://www.youtube.com/watch?v=abcdefghijk',thumbnailUrl:'/favicon.ico'},
   {videoId:'audio:'+'a'.repeat(64),source:'local',title:'MP3 song',url:'',thumbnailUrl:'/favicon.ico'}]));
  localStorage.setItem('sl_setListDraft_v2',JSON.stringify([{id:'one',videoId:'abcdefghijk'},{id:'two',videoId:'audio:'+'a'.repeat(64)}]));
 }); await page.reload();
 const saved=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Saved Songs',exact:true})});
 const set=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Set List',exact:true})});
 const before=await page.evaluate(()=>localStorage.getItem('sl_setListDraft_v2'));
 await saved.getByRole('button',{name:'Actions for YouTube song',exact:true}).click();
 await saved.getByRole('button',{name:'Copy YouTube link',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('https://www.youtube.com/watch?v=abcdefghijk');
 await expect(saved.getByText('Link copied',{exact:true})).toBeVisible();
 if(await page.evaluate(()=>localStorage.getItem('sl_setListDraft_v2'))!==before)throw Error('Copy altered draft');
 await set.getByRole('button',{name:'Actions for YouTube song',exact:true}).click();
 await expect(set.getByRole('button',{name:'Copy YouTube link',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(set.getByRole('button',{name:'Actions for YouTube song',exact:true})).toBeFocused();
 await saved.getByRole('button',{name:'Actions for MP3 song',exact:true}).click();
 await expect(saved.getByRole('button',{name:'Copy YouTube link',exact:true})).toHaveCount(0);
 await saved.getByRole('button',{name:'Rename MP3 song',exact:true}).click();
 await page.getByLabel('Recording title',{exact:true}).fill('Renamed MP3');
 await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
 await expect(set.locator('.song-title').filter({hasText:'Renamed MP3'})).toBeVisible();
 // Reorder with the original drag handle.
 const handle=set.getByRole('button',{name:'Reorder Renamed MP3',exact:true});
 const a=await handle.boundingBox(), b=await set.getByRole('button',{name:'Reorder YouTube song',exact:true}).boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15}); await page.mouse.up();
 await expect(set.locator('.song-title').first()).toHaveText('Renamed MP3');
 // Clipboard denial provides a selectable link instead of a browser prompt.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
 await set.getByRole('button',{name:'Actions for YouTube song',exact:true}).click();
 await set.getByRole('button',{name:'Copy YouTube link',exact:true}).click();
 await expect(set.getByRole('textbox',{name:'YouTube link',exact:true})).toHaveValue('https://www.youtube.com/watch?v=abcdefghijk');
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await set.getByRole('button',{name:'Actions for YouTube song',exact:true}).click();
 const box=await set.locator('[popover]:popover-open').boundingBox();
 if(box.x<0 || box.x+box.width>390)throw Error('Menu outside viewport');
 await set.getByRole('button',{name:'Remove YouTube song from set list',exact:true}).click();
 await expect(set.locator('.song-title')).toHaveText(['Renamed MP3']);
 await expect(saved.getByText('YouTube song',{exact:true}).first()).toBeVisible();
 await saved.getByRole('button',{name:'Actions for YouTube song',exact:true}).click();
 await saved.getByRole('button',{name:'Delete YouTube song',exact:true}).click();
 await expect(saved.locator('.song-title')).toHaveText(['Renamed MP3']);
 console.log('PASS: canonical copy, clipboard fallback, MP3 edit/no link, Escape/focus, mobile menu, drag reorder, independent removal, unchanged draft on copy');
} finally { await browser.close(); }
