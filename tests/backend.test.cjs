const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const tables = {};
const properties = {ADMIN_KEY:'test-only-password'};
const cache = new Map();
let locked = false;
class Sheet {
  constructor() {this.rows=[];}
  getLastRow() {return this.rows.findLastIndex(r=>r.some(v=>v!==''))+1;}
  getDataRange() {return {getValues:()=>this.rows.slice(0,this.getLastRow()).map(r=>r.slice())};}
  getRange(row,col,n=1,m=1) {return {
    setValues: values=>{for(let i=0;i<n;i++){this.rows[row-1+i] ||= [];for(let j=0;j<m;j++)this.rows[row-1+i][col-1+j]=values[i][j];}},
    setValue: value=>{this.rows[row-1] ||= [];this.rows[row-1][col-1]=value;},
    clearContent:()=>{for(let i=0;i<n;i++)for(let j=0;j<m;j++)this.rows[row-1+i][col-1+j]='';}
  };}
  appendRow(row) {this.rows[this.getLastRow()]=row;}
  clearContents(){this.rows=[];}
  setFrozenRows(){}
}
const ss={getSheetByName:n=>tables[n],insertSheet:n=>tables[n]=new Sheet()};
const context=vm.createContext({
  Date,JSON,Math,Set,Map,console,
  SpreadsheetApp:{openById:()=>ss,flush(){}},
  PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...properties}),getProperty:k=>properties[k],setProperty:(k,v)=>properties[k]=v,deleteProperty:k=>delete properties[k]})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),putAll:values=>Object.entries(values).forEach(([k,v])=>cache.set(k,v)),remove:k=>cache.delete(k)})},
  LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true;},waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},
  Utilities:{getUuid:()=>crypto.randomUUID()},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}
});
vm.runInContext(fs.readFileSync('Code.gs','utf8'),context);
function invoke(name,...args){vm.runInContext('requestSpreadsheet_=undefined;requestResponses_=undefined;',context);return context[name](...args);}
invoke('setupSpreadsheet');
const token=invoke('createAdminSession_','test-only-password');
assert.throws(()=>invoke('getAdminDashboard','bad'),/驗證失敗/);
assert.throws(()=>invoke('getAdminDashboard','admin_'+'a'.repeat(32)),/驗證失敗/);
assert.equal(invoke('getStudentState','test_student').checkinRequired,true);
const p={participantId:'test_student',participantName:'測試',epoch:'initial',profile:{gender:'不透露',age:'56-65 歲',job:'測試',city:'新竹縣'}};
invoke('submitCheckin',p);invoke('submitCheckin',p);
assert.equal(tables.Responses.getLastRow(),5,'報到重試不能重複新增');
assert.equal(invoke('getStudentState',p.participantId).checkinRequired,false);
invoke('adminSetActive',token,'q1');
const answer={...p,questionId:'q1',answer:'很棒'};
assert.throws(()=>invoke('submitResponse',{...answer,answer:'invalid'}),/有效選項/);
invoke('submitResponse',answer);invoke('submitResponse',answer);
assert.equal(invoke('getDisplayState').stats.count,1);
assert.equal(invoke('getDisplayState').stats.counts['很棒'],1);
assert.equal(invoke('getStudentState',p.participantId).submitted,true);
invoke('adminSetActive',token,'q2');
invoke('submitResponse',{...p,questionId:'q2',answer:['AI','AI','設計']});
assert.equal(invoke('getDisplayState').stats.counts.AI,1);
invoke('adminSetActive',token,'q4');
invoke('submitResponse',{...p,questionId:'q4',answer:'零售，數位行銷'});
assert.equal(invoke('getDisplayState').stats.texts[0].answer,'零售，數位行銷');
assert.equal('name' in invoke('getDisplayState').stats.texts[0],false);
invoke('adminSetActive',token,'q5');
assert.equal(invoke('submitResponse',{...p,questionId:'q5',answer:'Google Sheets'}).score,10);
assert.equal(invoke('getDisplayState').stats.correctRate,100);
invoke('adminSetActive',token,'');
assert.equal(invoke('getDisplayState').activeQuestion,null);
assert.equal(invoke('submitResponse',answer).already,true,'遺失確認後即使關題仍可安全確認舊答案');
const reset=invoke('deleteTestResponses',token);
assert.equal(reset.questions.length,5,'重置不得刪除或重新安裝題庫');
assert.equal(reset.activeQuestionId,'');assert.equal(reset.opened.length,0);
assert.equal(tables.Responses.getLastRow(),1);
assert.equal(Object.keys(reset.profileStats.profile_city.counts).length,0);
assert.equal(invoke('getStudentState',p.participantId).checkinRequired,true);
assert.throws(()=>invoke('submitCheckin',p),/重新報到/);
const response=invoke('doPost',{postData:{contents:JSON.stringify({api:'adminDashboard',token:'bad'})}});
assert.equal(JSON.parse(response.text).error,'講師驗證失敗。');
assert.equal(locked,false);
console.log('PASS: authentication, check-in, idempotent retry, votes, multiple, quiz, text privacy, close, reset and stale-session protection.');
const epoch=invoke('getStudentState','batch_0').epoch;
invoke('adminSetActive',token,'q1');
locked=true;
for(let i=0;i<50;i++)assert.equal(invoke('submitQueued_',{
  participantId:'batch_'+i,participantName:'壓測',epoch,questionId:'q1',answer:i%2?'很棒':'普通'
},false).pending,true);
locked=false;
invoke('flushPending_');
assert.equal(invoke('getDisplayState').stats.count,50);
assert.equal(invoke('getDisplayState').stats.counts['很棒'],25);
assert.equal(Object.keys(properties).filter(k=>k.startsWith('CPQ_')).length,0);
cache.clear();
invoke('submitQueued_',{participantId:'batch_0',participantName:'壓測',epoch,questionId:'q1',answer:'普通'},false);
assert.equal(invoke('getDisplayState').stats.count,50,'快取遺失後重試仍不得重複');
invoke('adminSetActive',token,'q4');
for(let i=0;i<35;i++)invoke('submitResponse',{participantId:'batch_'+i,participantName:'壓測',epoch,questionId:'q4',answer:'內容'+i});
invoke('adminSetActive',token,'');
const all=invoke('getAdminReport',token);
assert.equal(all.questions.length,5);
assert.equal(all.questions.find(x=>x.question.id==='q1').stats.count,50);
assert.equal(all.questions.find(x=>x.question.id==='q4').stats.texts.length,35,'全題報表不可只保留最近 30 則');
assert.equal(all.answerCount,85);
assert.throws(()=>invoke('getAdminReport','bad'),/驗證失敗/);
console.log('PASS: 50 queued submissions, lost receipt retry, all-question report after close, full text retention.');
tables.Questions.appendRow(['audience_questions',145,'open_text','課後提問箱：請留下你的問題或想法','[]','',0,true]);
invoke('adminSetActive',token,'audience_questions');
assert.equal(invoke('getStudentState','newsletter_1').activeQuestion.newsletterSignup,true);
const signup={participantId:'newsletter_1',participantName:'電子報測試',epoch,questionId:'audience_questions',answer:'想了解零售行銷',newsletterEmail:'reader@example.com',newsletterConsent:true};
assert.throws(()=>invoke('submitQueued_',{...signup,newsletterEmail:'bad@email'},false),/有效的電子/);
const invalidEmail=JSON.parse(invoke('doPost',{postData:{contents:JSON.stringify({api:'submit',protocol:'batch1',...signup,newsletterEmail:'bad@email'})}}).text);
assert.equal(invalidEmail.retryable,false,'信箱格式錯誤不能反覆重試造成延遲');
assert.match(invalidEmail.error,/有效的電子/);
assert.throws(()=>invoke('submitQueued_',{...signup,newsletterConsent:false},false),/確認願意/);
assert.equal(tables.Responses.rows.filter(r=>r[3]==='newsletter_email').length,0);
locked=true;
assert.equal(invoke('submitQueued_',signup,false).pending,true);
locked=false;invoke('flushPending_');
cache.clear();invoke('submitQueued_',signup,false);
const emails=tables.Responses.rows.filter(r=>r[3]==='newsletter_email');
assert.equal(emails.length,1,'電子報重試不得重複儲存');
assert.equal(JSON.parse(emails[0][4]).email,'reader@example.com');
assert.equal(JSON.parse(emails[0][4]).consent,true);
for(const result of [invoke('getDisplayState'),invoke('getAdminReport',token),invoke('getAdminDashboard',token),invoke('getStudentState','newsletter_1')])assert.equal(JSON.stringify(result).includes('reader@example.com'),false,'展示、統計和學員 API 不得洩漏信箱');
invoke('submitQueued_',{...signup,participantId:'newsletter_2',newsletterEmail:'',newsletterConsent:false},false);
invoke('submitResponse',{...signup,participantId:'newsletter_3',newsletterEmail:'legacy@example.com'});
assert.equal(tables.Responses.rows.filter(r=>r[3]==='newsletter_email').length,2);
assert.equal(invoke('getAdminReport',token).answerCount,88,'信箱不得算成額外一題答案');
invoke('adminSetActive',token,'q4');
assert.throws(()=>invoke('submitQueued_',{...signup,participantId:'newsletter_4',questionId:'q4'},false),/僅能在課後/);
invoke('deleteTestResponses',token);
assert.equal(tables.Responses.getLastRow(),1,'重置必須一併清除測試信箱');
assert.equal(invoke('getAdminReport',token).questions.length,6,'原有題庫保留');
console.log('PASS: optional newsletter opt-in, validation, queue/legacy persistence, idempotency, privacy and reset.');
