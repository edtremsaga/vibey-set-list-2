import {chromium,expect} from '@playwright/test';
const b=await chromium.launch({channel:'chrome',timeout:10000});
try{
const p=await b.newPage();p.setDefaultTimeout(7000);await p.goto(process.env.APP_URL??'http://localhost:3055');
await p.evaluate(()=>{
const song={videoId:'abcdefghijk',title:'Recovered Song',thumbnailUrl:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',url:'https://www.youtube.com/watch?v=abcdefghijk'};
const rows=[{id:'valid-row',videoId:song.videoId},null];
localStorage.setItem('sl_savedSongs_v2',JSON.stringify([song,null]));
localStorage.setItem('sl_setListDraft_v2',JSON.stringify(rows));
localStorage.setItem('sl_savedSetLists_v2',JSON.stringify([{id:'gig',name:'Recovered Gig',createdAt:'2026-01-01',items:rows},null]));
});
await p.reload();await expect(p.getByRole('button',{name:'Add Recovered Song to set list',exact:true})).toBeVisible();
await p.getByRole('button',{name:'Saved Set Lists (1)',exact:true}).click();await p.getByRole('button',{name:'Load',exact:true}).click();
await expect(p.locator('.set-list-row')).toHaveCount(1);
await p.getByRole('button',{name:'Save Set List',exact:true}).click();await p.getByRole('button',{name:'Save',exact:true}).click();await p.getByRole('button',{name:'Save changes',exact:true}).click();
const originals=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sl_savedSetLists_v2_recovery_')).map(k=>localStorage.getItem(k)));
if(!originals.some(raw=>JSON.parse(raw).length===2&&JSON.parse(raw)[0].items.length===2))throw Error('Original not preserved');
await p.reload();await expect(p.locator('.set-list-row')).toHaveCount(1);await expect(p.getByRole('button',{name:'Add Recovered Song to set list',exact:true})).toBeVisible();
console.log('PASS Chrome: recover valid entries, load/save recovered list, exact original backup, reload');
}finally{await b.close()}
