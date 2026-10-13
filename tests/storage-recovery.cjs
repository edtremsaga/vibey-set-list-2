/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const data=new Map();let fail=false;
global.window={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail&&k.includes('_recovery_'))throw Error('quota');data.set(k,v)}}};
const compiled=ts.transpileModule(fs.readFileSync('lib/storage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('require','exports','module',compiled)(n=>n==='./recordings'?{RECORDING_ID_PATTERN:/^audio:[a-f0-9]{64}$/}:require(n),m.exports,m);const s=m.exports;
const song={videoId:'abcdefghijk',title:'Song',thumbnailUrl:'https://example.com/a.jpg',url:'https://www.youtube.com/watch?v=abcdefghijk'};
const row={id:'row',videoId:song.videoId};
for(const [key,load,save,valid] of [['sl_savedSongs_v2',s.loadSavedSongs,s.saveSavedSongs,song],['sl_setListDraft_v2',s.loadSetListDraft,s.saveSetListDraft,row],['sl_savedSetLists_v2',s.loadSavedSetLists,s.saveSavedSetLists,{id:'gig',name:'Gig',createdAt:'2026-01-01',items:[row,null]}]]){
 const raw=JSON.stringify([valid,null]);data.set(key,raw);
 const recovered=load();assert.equal(recovered.length,1);assert.equal(data.get(key),raw);
 load();assert.equal(data.get(key),raw);
 fail=true;assert.throws(()=>save(recovered));assert.equal(data.get(key),raw);fail=false;
 save(recovered);assert.ok([...data].some(([k,v])=>k.startsWith(key+'_recovery_')&&v===raw));assert.equal(load().length,1);
 if(key.includes('SavedSetLists'))assert.deepEqual(load()[0].items,[row]);
 for(const bad of ['{broken','{}','']){data.set(key,bad);assert.deepEqual(load(),[]);assert.equal(data.get(key),bad);save([]);assert.ok([...data].some(([k,v])=>k.startsWith(key+'_recovery_')&&v===bad));}
}
data.delete('sl_savedSongs_v2');data.set('sl_savedSongs_v1',JSON.stringify([song,null]));assert.equal(s.loadSavedSongs().length,1);s.saveSavedSongs([song]);assert.equal(JSON.parse(data.get('sl_savedSongs_v1')).length,2);
console.log('PASS: partial recovery, nested rows, original bytes, repeated loads, quota failure, invalid JSON, empty data, legacy preservation');
