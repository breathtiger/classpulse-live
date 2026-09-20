const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let capturedBlob,downloaded=false;
const context=vm.createContext({console,Blob,URL:{createObjectURL:b=>(capturedBlob=b,'blob:test'),revokeObjectURL(){}},setTimeout:f=>f(),document:{createElement:()=>({click(){downloaded=true;}})}});
vm.runInContext(fs.readFileSync('assets/client.js','utf8')+'\n'+fs.readFileSync('assets/report.js','utf8')+'\nglobalThis.report=CPReport;',context);
const container={innerHTML:'',querySelectorAll:()=>[]};
const data={generatedAt:'now',epoch:'1',participantCount:50,respondentCount:50,answerCount:100,profileStats:{},questions:[
 {question:{id:'q1',page:5,type:'single',question:'題目<script>',options:['是','否']},stats:{count:50,counts:{是:25,否:25},correct:0,correctRate:0,texts:[]}},
 {question:{id:'q2',page:63,type:'open_text',question:'所有文字',options:[]},stats:{count:50,counts:{},correct:0,correctRate:0,texts:Array.from({length:50},(_,i)=>({answer:i===0?'=HYPERLINK("x")':i===1?'<img onerror=alert(1)>':'回答'+i}))}}
]};
context.report.render(container,data);
assert.match(container.innerHTML,/全題統計總覽/);
assert.match(container.innerHTML,/全螢幕展示/);
assert.match(container.innerHTML,/展開全部 50 則文字回答/);
assert.match(container.innerHTML,/25 票 · 50%/);
assert.match(container.innerHTML,/題目&lt;script&gt;/);
assert.doesNotMatch(container.innerHTML,/<img onerror/);
assert.match(container.innerHTML,/回答49/);
context.report.csv();
(async()=>{const csv=await capturedBlob.text();assert.equal(downloaded,true);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/回答49/);assert.equal(csv.split('\r\n').length,53);console.log('PASS: full report charts, all 50 text replies, escaped HTML, CSV completeness and formula protection.');})().catch(e=>{console.error(e);process.exitCode=1;});
