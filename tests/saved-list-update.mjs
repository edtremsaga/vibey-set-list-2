import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',timeout:10000});
try {
 const page=await browser.newPage();page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(15000);
 await page.goto(process.env.APP_URL ?? 'http://localhost:3057');
 await page.evaluate(()=>{
 localStorage.setItem('sl_savedSongs_v2',JSON.stringify(['abcdefghijk','lmnopqrstuv'].map((id,i)=>({videoId:id,title:'Song '+(i+1),url:'https://www.youtube.com/watch?v='+id,thumbnailUrl:'/favicon.ico'}))));
 localStorage.setItem('sl_setListDraft_v2','[]');
 localStorage.setItem('sl_savedSetLists_v2',JSON.stringify([{id:'gig',name:'Band gig',createdAt:'2026-01-01',items:[{id:'one',videoId:'abcdefghijk'},{id:'two',videoId:'lmnopqrstuv'}]}]));
 });await page.reload();
 const openSave=async(label='Save')=>{await page.getByRole('button',{name:'Save Set List',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).last().click();};
 await page.getByRole('button',{name:'Saved Set Lists (1)',exact:true}).click();await page.getByRole('button',{name:'Load',exact:true}).click();
 const set=page.locator('section.song-panel').filter({has:page.getByRole('heading',{name:'Set List',exact:true})});
 await set.getByRole('button',{name:'Actions for Song 2',exact:true}).click();await set.getByRole('button',{name:'Remove Song 2 from set list',exact:true}).click();
 await page.reload();await expect(set.getByText('Band gig',{exact:true})).toBeVisible();
 await openSave();await expect(page.getByRole('dialog')).toContainText('Save changes to ‘Band gig’?');
 await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sl_savedSetLists_v2'))[0].items.length)).toBe(2);
 await openSave();await page.getByRole('button',{name:'Save changes',exact:true}).click();
 const lists=await page.evaluate(()=>JSON.parse(localStorage.getItem('sl_savedSetLists_v2')));
 expect(lists).toHaveLength(1);expect(lists[0].id).toBe('gig');expect(lists[0].name).toBe('Band gig');expect(lists[0].items).toHaveLength(1);
 await page.reload();await expect(set.getByText('Band gig',{exact:true})).toBeVisible();
 await openSave('Save As New Set List');await page.getByLabel('Set list name',{exact:true}).fill('New gig');await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sl_savedSetLists_v2')).length)).toBe(2);
 // A missing identity must not overwrite an arbitrary saved list.
 await page.evaluate(()=>localStorage.setItem('sl_loadedSetId_v1','missing'));await page.reload();await openSave();await expect(page.getByLabel('Set list name',{exact:true})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 // Simulate a browser storage failure when updating an existing list.
 await page.evaluate(()=>localStorage.setItem('sl_loadedSetId_v1','gig'));await page.reload();await openSave();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sl_savedSetLists_v2')throw Error('quota');return original.call(this,key,value);};});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not save');await expect(page.getByRole('dialog')).toBeVisible();
 console.log('PASS: loaded identity survives reload, removal updates original, cancel preserves saved list, Save As New creates copy, missing identity asks for name, storage failure keeps dialog open');
}finally{await browser.close();}
