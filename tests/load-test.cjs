// Real HTTP load test. No framework/dependency; synthetic data only in an isolated database.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const endpoint='https://script.google.com/macros/s/AKfycbw2DmpkxEYlN89Y4zhDgYtf8T9ZrUGDWgO4wHF0ec1eUTB7RjW5XNq69kDHzdfL9erW/exec';
const label=process.argv[2]||'baseline';
const course=process.env.CLASSPULSE_COURSE||'';
const participants=Number(process.env.CLASSPULSE_PARTICIPANTS||50);
if(!Number.isInteger(participants)||participants<1||participants>500)throw new Error('CLASSPULSE_PARTICIPANTS must be 1–500');
const clientContext=vm.createContext({fetch,AbortController,setTimeout,clearTimeout,console,SyntaxError,TypeError,window:{CLASS_PULSE_COURSE:course?{id:course}:null}});
vm.runInContext(fs.readFileSync('assets/client.js','utf8')+';globalThis.clientCall=CP.call;',clientContext);
async function studentCall(api,payload){let attempts=0;try{const result=await clientContext.clientCall(api,payload,{onAttempt:n=>attempts=n});return {...result,attempts};}catch(e){e.attempts=attempts;throw e;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function callOnce(api,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({api,...payload,...(course?{course}: {})}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  let result;try{result=await response.json();}catch(_){throw new Error('Non-JSON response');}
  if(!result.ok)throw new Error(result.error||'API failure');
  return result.data;
}
const controlRetries=[];
async function call(api,payload={}){
  const safe=['ping','adminReport','adminDashboard','adminSetActive','display'].includes(api);
  for(let n=0;n<4;n++){
    try{return await callOnce(api,payload);}catch(e){if(!safe||n===3)throw e;controlRetries.push({api,error:e.message});await sleep(1500+Math.random()*2000);}
  }
}
function metrics(rows){const success=rows.filter(r=>r.ok),times=success.map(r=>r.ms).sort((a,b)=>a-b);const p=n=>times.length?Math.round(times[Math.min(times.length-1,Math.ceil(times.length*n)-1)]):null;return {requests:rows.length,success:success.length,failed:rows.length-success.length,p50ms:p(.5),p95ms:p(.95),p99ms:p(.99),maxMs:p(1),failures:rows.filter(r=>!r.ok).map(r=>({index:r.index,error:r.error,ms:r.ms})),attempts:rows.reduce((n,r)=>n+r.attempts,0)};}
async function wave(name,fn){console.log('Stage: '+participants+' '+name);const start=Date.now();const rows=await Promise.all(Array.from({length:participants},async(_,index)=>{const t=Date.now();try{const result=await fn(index);return {index,ok:true,ms:Date.now()-t,attempts:result?.attempts||1};}catch(e){return {index,ok:false,ms:Date.now()-t,attempts:e.attempts||1,error:e.message};}}));const result={name,wallMs:Date.now()-start,...metrics(rows)};console.log(JSON.stringify(result));return result;}
(async()=>{
  if(!process.env.CLASSPULSE_ADMIN_KEY)throw new Error('Set CLASSPULSE_ADMIN_KEY');
  const version=await call('ping');
  if(participants>50&&!(version.loadTestMax>=participants))throw new Error('500-person test backend not deployed');
  if(label!=='baseline'&&!['report-batch2-20260921','newsletter-20260921','courses-20261013','hr-20261022'].includes(version.version))throw new Error('Latest deployment has not propagated yet');
  console.log('Stage: login');
  const {token}=await call('login',{password:process.env.CLASSPULSE_ADMIN_KEY});
  console.log('Stage: read formal baseline');
  const before=await call('adminReport',{token});
  const dashboardBefore=await call('adminDashboard',{token});
  console.log('Stage: create isolated test database');
  const scope=await call('startLoadTest',{token});
  const testToken=scope.testToken,epoch=scope.epoch;
  fs.mkdirSync('work',{recursive:true});
  fs.writeFileSync('work/load-session.json',JSON.stringify({token,...scope}),{mode:0o600});
  const p=i=>({testToken,epoch,participantId:'load_'+i,participantName:'壓測學員'+(i+1)});
  const send=label==='baseline'?call:studentCall;
  const report={startedAt:new Date().toISOString(),label,serverVersion:version.version,participants,isolated:true,phases:[]};
  try {
  const checkinState=course?await call('state',{testToken,participantId:'load_0'}):null;
  const courseProfile=checkinState?Object.fromEntries(checkinState.checkinFields.filter(f=>f.required).map(f=>[f.id,f.options[0]])):null;
  report.phases.push(await wave('simultaneous check-ins',i=>send('checkin',{...p(i),profile:courseProfile||{gender:i%2?'女性':'男性',age:'36-45 歲',job:'模擬壓測',city:'新竹縣'}})));
  const q=dashboardBefore.questions.find(q=>q.enabled&&q.type==='single');
  await call('adminSetActive',{testToken,token,questionId:q.id});
  report.phases.push(await wave('simultaneous answers',i=>send('submit',{...p(i),questionId:q.id,answer:q.options[i%q.options.length]})));
  report.phases.push(await wave('simultaneous state reads',i=>send('state',p(i))));
  const projection=await call('display',{testToken});
  report.projectedCount=projection.stats.count;report.optionCounts=projection.stats.counts;
  if(label!=='baseline'){
    const history=await call('seedLoadHistory',{testToken,token,participants});report.seededHistoryRows=history.seededRows;
    const quiz=history.quiz,wrong=quiz.options.find(o=>o!==history.correctOption);
    if(!quiz.options.includes(history.correctOption))throw new Error('Quiz answer key does not match an option');
    await call('adminSetActive',{testToken,token,questionId:quiz.id});
    report.phases.push(await wave('simultaneous quiz answers with course history',i=>send('submit',{...p(i),questionId:quiz.id,answer:i%2?wrong:history.correctOption})));
    const quizState=await call('display',{testToken});report.quizCorrectRate=quizState.stats.correctRate;
    await call('adminSetActive',{testToken,token,questionId:history.text.id});
    report.phases.push(await wave('simultaneous text answers with course history',i=>send('submit',{...p(i),questionId:history.text.id,answer:'人才培訓、資料保護、壓測 '+i})));
    report.phases.push(await wave('duplicate-answer retries',i=>send('submit',{...p(i),questionId:history.text.id,answer:'人才培訓、資料保護、壓測 '+i})));
    await call('adminSetActive',{testToken,token,questionId:''});
  }
  } catch(e) {report.fatalError=e.message;console.error('Test phase stopped:',e.message);} finally {
  try {
  await call('adminReport',{token,testToken});
  const end=await call('finishLoadTest',{token,testToken});
  report.recordedRows=end.rows;report.duplicateRows=end.duplicates;report.recordedCheckins=end.report.participantCount;report.recordedAnswers=end.report.answerCount;report.testAccessRevoked=end.accessRevoked;
  const after=await call('adminReport',{token});const dashboardAfter=await call('adminDashboard',{token});
  report.formalDataUnchanged=JSON.stringify(before.questions)===JSON.stringify(after.questions)&&JSON.stringify(before.profileStats)===JSON.stringify(after.profileStats)&&dashboardBefore.activeQuestionId===dashboardAfter.activeQuestionId&&JSON.stringify(dashboardBefore.opened)===JSON.stringify(dashboardAfter.opened);
  } catch(e) {report.cleanupError=e.message;console.error('Cleanup needs follow-up:',e.message);}
  report.controlRetries=controlRetries;report.finishedAt=new Date().toISOString();fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync(path.join('outputs','load-test-'+label+'.json'),JSON.stringify(report,null,2));
  console.log('FINAL '+JSON.stringify(report));
  if(report.fatalError||report.cleanupError||report.phases.some(p=>p.failed)||report.duplicateRows||!report.formalDataUnchanged||!report.testAccessRevoked||report.projectedCount!==participants||(label!=='baseline'&&report.quizCorrectRate!==Math.round(Math.ceil(participants/2)/participants*100)))process.exitCode=1;
  }
})().catch(e=>{console.error('Load test stopped:',e.message);process.exitCode=1;});
