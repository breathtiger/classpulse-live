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
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>properties[k]=v,deleteProperty:k=>delete properties[k]})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},
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
assert.equal(reset.activeQuestionId,'');assert.equal(reset.opened.length,0);
assert.equal(tables.Responses.getLastRow(),1);
assert.equal(Object.keys(reset.profileStats.profile_city.counts).length,0);
assert.equal(invoke('getStudentState',p.participantId).checkinRequired,true);
assert.throws(()=>invoke('submitCheckin',p),/重新報到/);
const response=invoke('doPost',{postData:{contents:JSON.stringify({api:'adminDashboard',token:'bad'})}});
assert.equal(JSON.parse(response.text).error,'講師驗證失敗。');
assert.equal(locked,false);
console.log('PASS: authentication, check-in, idempotent retry, votes, multiple, quiz, text privacy, close, reset and stale-session protection.');
