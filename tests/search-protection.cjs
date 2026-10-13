const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const source = fs.readFileSync('app/api/youtube/search/route.ts', 'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(){const m={exports:{}};new Function('require','exports','module',compiled)(require,m.exports,m);return m.exports.GET;}
const request=q=>new NextRequest('http://localhost/api/youtube/search?q='+encodeURIComponent(q));
const oldFetch=global.fetch, oldNow=Date.now, oldTimeout=AbortSignal.timeout;
let now=100000, calls=0;
Date.now=()=>now;
process.env.YOUTUBE_API_KEY='test-key';
global.fetch=async url=>{calls++;return Response.json(url.includes('/search?')?{items:[{id:{videoId:'abcdefghijk'},snippet:{title:'Song',channelTitle:'Band',thumbnails:{medium:{url:'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'}}}}]}:{items:[{id:'abcdefghijk',contentDetails:{duration:'PT3M18S'}}]});};
(async()=>{
try{
let get=load();
assert.equal((await get(request(''))).status,200);
assert.equal((await get(request('x'.repeat(201)))).status,400);assert.equal(calls,0);
const responses=await Promise.all([get(request('  Band song  ')),get(request('band   SONG'))]);
assert.deepEqual(await responses[0].json(),await responses[1].json());assert.equal(calls,2);
await get(request('band song'));assert.equal(calls,2);
now+=900001;await get(request('band song'));assert.equal(calls,4);
get=load();for(let i=0;i<20;i++)assert.equal((await get(request('song '+i))).status,200);
let limited=await get(request('new song'));assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');
assert.equal((await get(request('song 0'))).status,200);
now+=60000;assert.equal((await get(request('new song'))).status,200);
get=load();let attempts=0;global.fetch=async()=>{attempts++;throw Error('network');};
assert.equal((await get(request('error'))).status,502);await get(request('error'));assert.equal(attempts,2);
AbortSignal.timeout=()=>AbortSignal.abort();global.fetch=async(_,options)=>{options.signal.throwIfAborted();};
assert.equal((await get(request('timeout'))).status,504);
console.log('PASS: validation, coalescing, cache normalization/expiry, rate limit/reset, cached requests, uncached failures, deadline');
}finally{global.fetch=oldFetch;Date.now=oldNow;AbortSignal.timeout=oldTimeout;}
})().catch(e=>{console.error(e);process.exitCode=1;});
