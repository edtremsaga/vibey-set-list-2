import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({timeout:10000});
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(10000);
  await page.goto(process.env.APP_URL ?? 'http://localhost:3050');
  const localId='audio:'+'a'.repeat(64);
  await page.evaluate(({localId}) => {
    localStorage.setItem('sl_savedSongs_v2',JSON.stringify([
      {videoId:'abcdefghijk',title:'Country YouTube',url:'https://www.youtube.com/watch?v=abcdefghijk',thumbnailUrl:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'},
      {videoId:'lmnopqrstuv',source:'youtube',title:'Zebra YouTube',url:'https://www.youtube.com/watch?v=lmnopqrstuv',thumbnailUrl:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'},
      {videoId:localId,source:'local',title:'Country rehearsal',url:'',thumbnailUrl:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}
    ]));
  },{localId});
  await page.reload();
  const panel=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Saved Songs',exact:true})});
  const search=panel.getByRole('searchbox',{name:'Search saved songs'});
  await expect(panel.getByRole('status')).toHaveText('3 songs');
  await search.fill('  COUNTRY  ');
  await expect(panel.getByRole('status')).toHaveText('2 of 3 songs');
  await panel.getByRole('button',{name:'MP3',exact:true}).click();
  await expect(panel.getByRole('status')).toHaveText('1 of 3 songs');
  await expect(panel.getByRole('button',{name:'Add Country rehearsal to set list',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'YouTube',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Add Country YouTube to set list',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Clear saved songs search'}).click();
  await expect(panel.getByRole('status')).toHaveText('2 of 3 songs');
  await panel.getByRole('button',{name:'Sort saved songs by name descending'}).click();
  await expect(panel.locator('.song-title')).toHaveText(['Zebra YouTube','Country YouTube']);
  await search.fill('no match');
  await expect(panel.getByText('No songs match your filters.')).toBeVisible();
  await panel.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(panel.getByRole('status')).toHaveText('3 songs');
  await expect(panel.getByRole('button',{name:'All',exact:true})).toHaveAttribute('aria-pressed','true');
  await panel.getByRole('button',{name:'MP3',exact:true}).click();
  await panel.getByRole('button',{name:'Rename Country rehearsal',exact:true}).click();
  await page.getByLabel('Recording title',{exact:true}).fill('Band practice');
  await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  await search.fill('band');
  await expect(panel.getByRole('status')).toHaveText('1 of 3 songs');
  await page.setViewportSize({width:390,height:844});
  await expect(search).toBeVisible();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Mobile overflow');
  await page.screenshot({path:'/tmp/saved-song-filters-mobile.png',fullPage:true});
  await page.setViewportSize({width:1600,height:1000});
  await page.screenshot({path:'/tmp/saved-song-filters-desktop.png',fullPage:true});
  await page.reload();
  await expect(search).toHaveValue('');
  await expect(panel.getByRole('status')).toHaveText('3 songs');
  console.log('PASS: title search, combined sources, legacy YouTube, clear controls, counts, sort, rename, mobile overflow, reload reset');
} finally { await browser.close(); }
