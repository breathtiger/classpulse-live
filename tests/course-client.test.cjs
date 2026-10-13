const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let body,responseCourse='market-20261015';const storage=new Map([['classPulseProfile',JSON.stringify({id:'old'})]]);
const ctx=vm.createContext({window:{CLASS_PULSE_COURSE:{id:'market-20261015'}},document:{documentElement:{dataset:{course:'market-20261015'}}},AbortController,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async(_u,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({ok:true,course:responseCourse,data:{ok:true}})};}});
vm.runInContext(fs.readFileSync('assets/client.js','utf8')+';globalThis.CPTest=CP;',ctx);
(async()=>{
 assert.equal(ctx.CPTest.read('classPulseProfile',null),null);
 ctx.CPTest.save('classPulseProfile',{id:'new'});
 assert.equal(JSON.parse(storage.get('classPulseProfile')).id,'old');
 await ctx.CPTest.call('state',{course:'wrong'});assert.equal(body.course,'market-20261015');
 responseCourse='';await assert.rejects(()=>ctx.CPTest.call('submit',{}),/課程連線不符/);
 const missing=vm.createContext({document:{documentElement:{dataset:{course:'market-20261015'}}}});
 vm.runInContext(fs.readFileSync('assets/client.js','utf8')+';globalThis.CPTest=CP;',missing);
 await assert.rejects(()=>missing.CPTest.call('state',{}),/課程設定載入失敗/);
 console.log('PASS: isolated storage, pinned request course, response mismatch and missing config fail closed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
