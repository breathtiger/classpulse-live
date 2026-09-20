const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let responses=[],requests=[];
const context=vm.createContext({AbortController,console,
 setTimeout(fn,ms){if(ms<10000)queueMicrotask(fn);return 1;},clearTimeout(){},
 fetch:async(url,options)=>{requests.push(JSON.parse(options.body));const r=responses.shift();if(r instanceof Error)throw r;return {ok:true,json:async()=>r};}
});
vm.runInContext(fs.readFileSync('assets/client.js','utf8')+';globalThis.call=CP.call;',context);
(async()=>{
 responses=[{ok:true,data:{pending:true}},{ok:true,data:{pending:true}},{ok:true,data:{ok:true}}];
 let notices=0;
 const result=await context.call('submit',{questionId:'q1',participantId:'p1',epoch:'e',answer:'是'},{onProgress:()=>notices++});
 assert.equal(result.ok,true);assert.equal(requests.length,3);assert.equal(notices,2);
 assert.equal(requests[0].protocol,'batch1');assert.deepEqual(requests[0],requests[2]);
 responses=[new SyntaxError('non-json from service'),{ok:true,data:{ok:true}}];requests=[];
 assert.equal((await context.call('checkin',{})).ok,true);assert.equal(requests.length,2);
 responses=[{ok:false,retryable:false,error:'此題已關閉或尚未開放。'}];requests=[];
 await assert.rejects(()=>context.call('submit',{}),/此題已關閉/);assert.equal(requests.length,1);
 responses=Array.from({length:12},()=>({ok:true,data:{pending:true}}));requests=[];
 await assert.rejects(()=>context.call('submit',{}),/尚未收到寫入確認/);assert.equal(requests.length,12);
 console.log('PASS: queued responses are not success; idempotent retry body; non-JSON retry; permanent errors; bounded retries.');
})().catch(e=>{console.error(e);process.exitCode=1;});
