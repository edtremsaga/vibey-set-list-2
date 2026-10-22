/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness. */
const ts=require('typescript'), fs=require('node:fs'), assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
function compile(path,req=require){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m.exports,m);return m.exports;}
const duration=compile('lib/duration.ts');
assert.equal(duration.parseDuration('PT1H2M3S'),3723);assert.equal(duration.parseDuration('3:18'),198);assert.equal(duration.parseDuration('--:--'),undefined);assert.equal(duration.formatDuration(3723),'1:02:03');
const get=compile('app/api/youtube/durations/route.ts',n=>n==='@/lib/duration'?duration:require(n)).GET;
const req=ids=>new NextRequest('http://localhost/api/youtube/durations?ids='+encodeURIComponent(ids));
const original=global.fetch;process.env.YOUTUBE_API_KEY='test';let calls=0;
global.fetch=async()=>{calls++;return Response.json({items:[{id:'abcdefghijk',contentDetails:{duration:'PT3M18S'}}]});};
(async()=>{try{
assert.equal((await get(req('invalid'))).status,400);
const results=await Promise.all([get(req('abcdefghijk')),get(req('abcdefghijk'))]);
assert.equal(calls,1);assert.deepEqual(await results[0].json(),{durations:{abcdefghijk:198}});
await get(req('abcdefghijk'));assert.equal(calls,1);
console.log('PASS: duration parsing/format, API validation, batching coalescence, cache');
}finally{global.fetch=original;}})().catch(e=>{console.error(e);process.exitCode=1;});
