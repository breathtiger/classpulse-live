/** 單一課程互動系統：將此專案綁定到試算表，或設定 SPREADSHEET_ID。 */
const SHEETS = {
  Questions: ['id', 'page', 'type', 'question', 'options', 'answer', 'points', 'enabled'],
  Responses: ['timestamp', 'participantId', 'participantName', 'questionId', 'answer', 'correct', 'score'],
  Settings: ['key', 'value']
};
let requestSpreadsheet_;
let requestResponses_;
let requestNamespace_ = 'main';
function cacheKey_() { return 'CLASS_PULSE_DISPLAY_' + requestNamespace_; }
function responses_() { return requestResponses_ || (requestResponses_ = sheet_('Responses').getDataRange().getValues().slice(1)); }
function invalidate_(metadata) { requestResponses_ = null; const c=CacheService.getScriptCache();c.remove(cacheKey_());if(metadata)c.remove('META_'+requestNamespace_); }
function epoch_() { return getSetting_('resetEpoch') || 'initial'; }
function checkEpoch_(value) { if (value && String(value) !== epoch_()) throw new Error('課堂已重置，請重新報到。'); }

/** POST keeps passwords and responses out of URLs. */
function doPost(e) {
  let result;
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.testToken) useLoadTest_(p.testToken);
    if (['state','display','adminDashboard','adminReport'].indexOf(p.api)>=0) flushPending_();
    let data;
    switch (p.api) {
      case 'ping': data = {version:'report-batch2-20260921'}; break;
      case 'login': data = {token:createAdminSession_(p.password)}; break;
      case 'state': data = getStudentState(p.participantId); break;
      case 'display': data = getDisplayState(); break;
      case 'checkin': data = p.protocol==='batch1'?submitQueued_(p,true):submitCheckin(p); break;
      case 'submit': data = p.protocol==='batch1'?submitQueued_(p,false):submitResponse(p); break;
      case 'adminDashboard': data = getAdminDashboard(p.token); break;
      case 'adminReport': data = getAdminReport(p.token); break;
      case 'startLoadTest': data = startLoadTest_(p.token); break;
      case 'finishLoadTest': data = finishLoadTest_(p.token,p.testToken); break;
      case 'seedLoadHistory': data = seedLoadHistory_(p.token); break;
      case 'adminSetActive': data = adminSetActive(p.token,p.questionId); break;
      case 'adminNavigate': data = adminNavigate(p.token,p.direction); break;
      case 'deleteTestResponses': data = deleteTestResponses(p.token); break;
      default: throw new Error('不支援的請求。');
    }
    result = {ok:true,data:data};
  } catch(err) {
    const message = String(err.message || '');
    const safe = ['講師驗證失敗。','此題已關閉或尚未開放。','你已經送出這一題。','請完整填寫報到資料。','請選擇有效選項。','請輸入回答。','請至少選擇一個選項。','課堂已重置，請重新報到。'];
    result = {ok:false,retryable:safe.indexOf(message)<0,error:safe.indexOf(message)>=0?message:'服務暫時無法完成，請稍後重試。'};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/** 首次設定用：將本課程試算表記錄為專案資料庫。 */
function configureClassPulseSpreadsheet() {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', '1U1fC3doBVEX4pQOgUtxoAqPzEMzZst718dLG7zzyh7k');
  return '已設定課程試算表。';
}

function doGet(e) {
  if (e && e.parameter && e.parameter.api) return apiGet_(e.parameter);
  const key = String((e && e.parameter && e.parameter.adminKey) || '');
  const isAdmin = key && key === getAdminKey_();
  const file = isAdmin ? 'AdminApp' : 'Student';
  const t = HtmlService.createTemplateFromFile(file);
  t.adminKey = isAdmin ? createAdminSession_(key) : '';
  return t.evaluate().setTitle(isAdmin ? '講師控制台' : '課堂互動').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** GitHub Pages 展示前端使用的 JSONP 介面；僅開放學員讀題與送答。 */
function apiGet_(p) {
  const callback = String(p.callback || '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(callback)) return ContentService.createTextOutput('/* invalid request */');
  try {
    let data;
    if (p.api === 'state') data = getStudentState(p.participantId);
    else if (p.api === 'display') data = getDisplayState();
    else if (p.api === 'setup') { assertAdmin_(p.adminKey); data = setupSpreadsheet(); }
    else if (p.api === 'installWorkshop') { assertAdmin_(p.adminKey); data = installWorkshopQuestionBank(); }
    else if (p.api === 'adminDashboard') data = getAdminDashboard(p.adminKey);
    else if (p.api === 'adminSetActive') data = adminSetActive(p.adminKey, p.questionId);
    else if (p.api === 'adminNavigate') data = adminNavigate(p.adminKey, p.direction);
    else if (p.api === 'deleteTestResponses') data = deleteTestResponses(p.adminKey);
    else if (p.api === 'checkin') {
      const profile = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(String(p.profile || ''))).getDataAsString());
      data = submitCheckin({participantId:p.participantId, participantName:p.participantName, profile:profile});
    }
    else if (p.api === 'submit') {
      const answer = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(String(p.answer || ''))).getDataAsString());
      data = submitResponse({participantId:p.participantId, participantName:p.participantName, questionId:p.questionId, answer:answer});
    } else throw new Error('不支援的請求。');
    return jsonp_(callback, {ok:true, data:data});
  } catch (err) { return jsonp_(callback, {ok:false, error:'操作未完成，請重新整理後再試。'}); }
}
function jsonp_(callback, payload) { return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT); }

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

/** 建立三張工作表與可立即測試的題目；可重複安全執行。 */
function setupSpreadsheet() {
  const ss = getSpreadsheet_();
  Object.keys(SHEETS).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    else sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  const q = sheet_('Questions');
  if (q.getLastRow() < 2) {
    q.getRange(2, 1, 5, 8).setValues([
      ['q1', 1, 'single', '今天的心情如何？', '["很棒","不錯","普通","需要咖啡"]', '', 0, true],
      ['q2', 2, 'multiple', '你想深入哪些主題？（可複選）', '["AI","設計","資料分析","自動化"]', '', 0, true],
      ['q3', 3, 'rating', '請為本節課評分', '["1","2","3","4","5"]', '', 0, true],
      ['q4', 4, 'open_text', '請留下你的問題或想法', '[]', '', 0, true],
      ['q5', 5, 'quiz', 'Google Apps Script 最常搭配哪項 Google 服務？', '["Google Sheets","Photoshop","Steam","Spotify"]', 'Google Sheets', 10, true]
    ]);
  }
  setSetting_('activeQuestionId', '');
  return '初始化完成。請在 Script Properties 設定 ADMIN_KEY。';
}

/** 安裝「智慧零售升級」講座題庫；保留既有 Responses，方便課後匯出。 */
function installWorkshopQuestionBank() {
  setupSpreadsheet();
  const rows = [
    ['ad_repeat', 5, 'single', '曾經點過某個廣告後，就一直看到類似的廣告嗎？', '["是","否"]', '', 0, true],
    ['youtube_use', 40, 'single', '你平常是否使用 YouTube？', '["是","否"]', '', 0, true],
    ['youtube_follow', 40, 'single', '你是否追蹤過某些 YouTube 頻道？', '["是","否"]', '', 0, true],
    ['google_maps', 40, 'single', '你是否使用 Google Maps？', '["是","否"]', '', 0, true],
    ['facebook_use', 56, 'single', '你是否使用 Facebook？', '["是","否"]', '', 0, true],
    ['instagram_use', 56, 'single', '你是否使用 Instagram？', '["是","否"]', '', 0, true],
    ['threads_use', 56, 'single', '你是否使用 Threads？', '["是","否"]', '', 0, true],
    ['linepay_use', 61, 'single', '你是否使用 LINE Pay？', '["是","否"]', '', 0, true],
    ['line_sticker', 61, 'single', '你是否購買過 LINE 貼圖？', '["是","否"]', '', 0, true],
    ['dcard_use', 63, 'single', '你是否使用 Dcard？', '["是","否"]', '', 0, true],
    ['dcard_topics', 63, 'open_text', '你在 Dcard 都瀏覽哪些主題？', '[]', '', 0, true],
    ['data_trust', 66, 'single', '你認為可以全然相信數據嗎？', '["可以","需要先檢查來源與脈絡","不可以"]', '', 0, true],
    ['ai_trust', 66, 'single', '你認為可以全然相信 AI 嗎？', '["可以","需要查證與判斷","不可以"]', '', 0, true],
    ['ai_bias', 67, 'quiz', 'Gemini 的回答強調特定國家觀點、輕視其他地區貢獻，違反哪項重要倫理原則？', '["故障／問題","演算法偏見","數據透明度","數位責任"]', '演算法偏見', 10, true],
    ['ai_hallucination', 68, 'quiz', 'AI 聊天機器人產生看似可信但錯誤、荒謬或誤導的輸出，稱為什麼？', '["偏見","幻覺","錯誤訊息","故障"]', '幻覺', 10, true],
    ['ga_engagement', 119, 'open_text', 'GA 報表實操：今年 1 月至今，哪個流量管道參與度最高？哪個工作階段來源／媒介平均參與時間最長？多久？', '[]', '', 0, true],
    ['ga_pageviews', 126, 'open_text', 'GA 報表實操：過去一整年，哪一天單頁瀏覽量最多？請寫下日期、網頁標題與瀏覽量。', '[]', '', 0, true],
    ['ga_purchase_city', 135, 'open_text', 'GA 報表實操：今年第 1 季，哪個國家的城市 Purchase 轉換最高？', '[]', '', 0, true],
    ['ga_audience', 142, 'open_text', 'GA 報表實操：今年 1 至 5 月，Likely 7-day purchasers 的男性與女性，誰的實際交易次數較多？誰的總收益最多？收益多少？', '[]', '', 0, true],
    ['audience_questions', 145, 'open_text', '課後提問箱：請留下你的問題或想法', '[]', '', 0, true]
  ];
  const sh = sheet_('Questions');
  sh.clearContents();
  sh.getRange(1, 1, 1, SHEETS.Questions.length).setValues([SHEETS.Questions]);
  sh.getRange(2, 1, rows.length, SHEETS.Questions.length).setValues(rows);
  sh.setFrozenRows(1);
  setSetting_('activeQuestionId', '');
  return '講座題庫已安裝，共 ' + rows.length + ' 題。';
}

function submitCheckin(payload) {
  payload = payload || {};
  const participantId = cleanId_(payload.participantId);
  const participantName = cleanText_(payload.participantName, 60);
  const p = payload.profile || {};
  const values = {
    profile_gender: cleanText_(p.gender, 30),
    profile_age: cleanText_(p.age, 30),
    profile_job: cleanText_(p.job, 60),
    profile_city: cleanText_(p.city, 60)
  };
  if (!participantId || !participantName || !values.profile_gender || !values.profile_age || !values.profile_job || !values.profile_city) throw new Error('請完整填寫報到資料。');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    checkEpoch_(payload.epoch);
    if (hasResponded_(participantId, 'profile_gender')) return {ok:true, already:true};
    const rows = Object.keys(values).map(id => [new Date(), participantId, participantName, id, JSON.stringify(values[id]), '', 0]);
    sheet_('Responses').getRange(sheet_('Responses').getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    SpreadsheetApp.flush(); invalidate_();
    return {ok:true};
  } finally { lock.releaseLock(); }
}

/** Durable burst buffer. Never acknowledges success until the Sheet write is committed. */
function courseMetadata_() {
  const cache=CacheService.getScriptCache(),key='META_'+requestNamespace_,cached=cache.get(key);
  if(cached)return JSON.parse(cached);
  const data={epoch:epoch_(),active:getSetting_('activeQuestionId'),questions:getQuestions_()};
  cache.put(key,JSON.stringify(data),30);
  return data;
}
function receiptKey_(epoch,pid,qid) {return 'ACK_'+requestNamespace_+'_'+epoch+'_'+pid+'_'+qid;}
function submitQueued_(p,checkin) {
  const pid=cleanId_(p.participantId),name=cleanText_(p.participantName,60);
  const qid=checkin?'profile_gender':cleanId_(p.questionId);
  if(!pid||!name||!qid)throw new Error('請完整填寫報到資料。');
  const meta=courseMetadata_();
  if(String(p.epoch||'')!==meta.epoch)throw new Error('課堂已重置，請重新報到。');
  const cache=CacheService.getScriptCache(),receipt=receiptKey_(meta.epoch,pid,qid);
  const acknowledged=cache.get(receipt);if(acknowledged)return JSON.parse(acknowledged);
  let rows;
  if(checkin){
    const values=p.profile||{},keys=['gender','age','job','city'];
    const valuesClean=keys.map(k=>cleanText_(values[k],60));
    if(valuesClean.some(v=>!v))throw new Error('請完整填寫報到資料。');
    rows=keys.map((k,i)=>[new Date().toISOString(),pid,name,'profile_'+k,JSON.stringify(valuesClean[i]),'',0]);
  }else{
    // Lost acknowledgements remain safe to retry even after a question is closed.
    if(meta.active!==qid){if(hasResponded_(pid,qid))return {ok:true,already:true};throw new Error('此題已關閉或尚未開放。');}
    const q=meta.questions.find(q=>q.id===qid&&q.enabled);
    if(!q)throw new Error('此題已關閉或尚未開放。');
    const answer=validateAnswer_(q,p.answer),correct=q.type==='quiz'?answersEqual_(answer,q.answer):'';
    rows=[[new Date().toISOString(),pid,name,qid,JSON.stringify(answer),correct,correct?Number(q.points||0):0]];
  }
  const key='CPQ_'+requestNamespace_+'_'+meta.epoch+'_'+pid+'_'+qid;
  PropertiesService.getScriptProperties().setProperty(key,JSON.stringify({epoch:meta.epoch,pid:pid,qid:qid,rows:rows}));
  flushPending_();
  const done=cache.get(receipt);
  return done?JSON.parse(done):{pending:true};
}
function flushPending_() {
  const props=PropertiesService.getScriptProperties(),prefix='CPQ_'+requestNamespace_+'_';
  if(!Object.keys(props.getProperties()).some(k=>k.indexOf(prefix)===0))return;
  const lock=LockService.getScriptLock();if(!lock.tryLock(100))return;
  try{
    const values=props.getProperties(),keys=Object.keys(values).filter(k=>k.indexOf(prefix)===0).slice(0,100);
    if(!keys.length)return;
    const currentEpoch=epoch_();requestResponses_=null;
    const existing=responses_(),seen=new Map(existing.map(r=>[String(r[1])+'|'+String(r[3]),r]));
    const additions=[],receipts={};
    keys.forEach(k=>{
      const item=JSON.parse(values[k]);
      if(item.epoch!==currentEpoch)return;
      item.rows.forEach(raw=>{
        const id=raw[1]+'|'+raw[3];
        if(!seen.has(id)){const row=raw.slice();row[0]=new Date(row[0]);if(/^[=+\-@]/.test(row[2]))row[2]="'"+row[2];seen.set(id,row);additions.push(row);}
      });
      const row=seen.get(item.pid+'|'+item.qid);
      receipts[receiptKey_(currentEpoch,item.pid,item.qid)]=JSON.stringify({ok:true,correct:row[5],score:row[6]});
    });
    if(additions.length){const sh=sheet_('Responses');sh.getRange(sh.getLastRow()+1,1,additions.length,7).setValues(additions);SpreadsheetApp.flush();invalidate_();}
    // In a crash after flush but before receipts, the next drain deduplicates against Sheets.
    if(Object.keys(receipts).length)CacheService.getScriptCache().putAll(receipts,600);
    keys.forEach(k=>props.deleteProperty(k));
  }finally{lock.releaseLock();}
}

function getStudentState(participantId) {
  participantId = cleanId_(participantId);
  const checkinRequired = !hasResponded_(participantId, 'profile_gender');
  const id = getSetting_('activeQuestionId');
  if (!id) return { epoch:epoch_(), activeQuestion: null, submitted: false, checkinRequired: checkinRequired };
  const question = findQuestion_(id);
  if (!question || !question.enabled) return { epoch:epoch_(), activeQuestion: null, submitted: false, checkinRequired: checkinRequired };
  return { epoch:epoch_(), activeQuestion: publicQuestion_(question), submitted: hasResponded_(participantId, id), checkinRequired: checkinRequired };
}

/** 投影畫面使用：只傳送公開題目與匿名化統計，不傳參與者名稱。 */
function getDisplayState() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey_());
  if (cached) return JSON.parse(cached);
  const id = getSetting_('activeQuestionId');
  if (!id) {
    const empty = {activeQuestion:null, stats:null};
    cache.put(cacheKey_(), JSON.stringify(empty), 2);
    return empty;
  }
  const question = findQuestion_(id);
  if (!question || !question.enabled) return {activeQuestion:null, stats:null};
  const stats = getStats_(question);
  const result = {
    activeQuestion: publicQuestion_(question),
    stats: {count:stats.count, counts:stats.counts, correctRate:stats.correctRate, texts:stats.texts.map(t => ({answer:t.answer}))}
  };
  cache.put(cacheKey_(), JSON.stringify(result), 2);
  return result;
}

function submitResponse(payload) {
  payload = payload || {};
  const participantId = cleanId_(payload.participantId);
  const participantName = cleanText_(payload.participantName, 60);
  const questionId = cleanId_(payload.questionId);
  if (!participantId || !participantName || !questionId) throw new Error('資料不完整，請重新整理後再試。');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    checkEpoch_(payload.epoch);
    // Retrying after a lost acknowledgement must not create another row.
    if (hasResponded_(participantId, questionId)) return {ok:true,already:true};
    const active = getSetting_('activeQuestionId');
    if (active !== questionId) throw new Error('此題已關閉或尚未開放。');
    if (hasResponded_(participantId, questionId)) throw new Error('你已經送出這一題。');
    const q = findQuestion_(questionId);
    if (!q || !q.enabled) throw new Error('此題目前無法作答。');
    const answer = validateAnswer_(q, payload.answer);
    let correct = '';
    let score = 0;
    if (q.type === 'quiz') { correct = answersEqual_(answer, q.answer); score = correct ? Number(q.points || 0) : 0; }
    sheet_('Responses').appendRow([new Date(), participantId, participantName, questionId, JSON.stringify(answer), correct, score]);
    SpreadsheetApp.flush(); invalidate_();
    return { ok: true, correct: correct, score: score };
  } finally { lock.releaseLock(); }
}

function getAdminDashboard(adminKey) {
  assertAdmin_(adminKey);
  const questions = getQuestions_();
  const activeId = getSetting_('activeQuestionId');
  const active = activeId ? findQuestion_(activeId) : null;
  return {epoch:epoch_(), opened:JSON.parse(getSetting_('openedQuestionIds')||'[]'), questions: questions.map(publicQuestion_), activeQuestionId: activeId, stats: active ? getStats_(active) : null, profileStats: getProfileStats_() };
}

/** Whole-course report: all questions remain visible after closing or moving on. */
function getAdminReport(adminKey) {
  assertAdmin_(adminKey);
  const questions=getQuestions_().sort((a,b)=>Number(a.page)-Number(b.page));
  const rows=responses_();
  const questionIds=new Set(questions.map(q=>q.id));
  const answers=rows.filter(r=>questionIds.has(String(r[3])));
  return {
    epoch:epoch_(), generatedAt:new Date().toISOString(),
    participantCount:new Set(rows.filter(r=>String(r[3])==='profile_gender').map(r=>String(r[1]))).size,
    respondentCount:new Set(answers.map(r=>String(r[1]))).size,
    answerCount:answers.length,
    profileStats:getProfileStats_(),
    questions:questions.map(q=>({question:publicQuestion_(q),stats:getStats_(q,true)}))
  };
}

/** Admin-only isolated database, on the same deployment and execution limits. */
function startLoadTest_(adminKey) {
  assertAdmin_(adminKey);
  if(requestNamespace_!=='main')throw new Error('不支援的請求。');
  const questionRows=sheet_('Questions').getDataRange().getValues();
  const ss=SpreadsheetApp.create('ClassPulse 隔離壓力測試 '+new Date().toISOString());
  Object.keys(SHEETS).forEach(name=>{
    const sh=ss.insertSheet(name);
    const rows=name==='Questions'?questionRows:[SHEETS[name]];
    sh.getRange(1,1,rows.length,rows[0].length).setValues(rows);
  });
  const testToken=Utilities.getUuid().replace(/-/g,'');
  const testEpoch=Utilities.getUuid();
  ss.getSheetByName('Settings').getRange(2,1,3,2).setValues([['activeQuestionId',''],['openedQuestionIds','[]'],['resetEpoch',testEpoch]]);
  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().setProperty('LOAD_TEST_'+testToken,JSON.stringify({id:ss.getId(),expires:Date.now()+3600000}));
  return {testToken:testToken,epoch:testEpoch,questionCount:questionRows.length-1};
}
function useLoadTest_(token) {
  if(!/^[a-f0-9]{32}$/.test(String(token)))throw new Error('不支援的請求。');
  const value=PropertiesService.getScriptProperties().getProperty('LOAD_TEST_'+token);
  const context=value?JSON.parse(value):null;
  if(!context||context.expires<Date.now())throw new Error('不支援的請求。');
  requestNamespace_='test_'+token;
  requestSpreadsheet_=SpreadsheetApp.openById(context.id);
  requestResponses_=undefined;
}
function finishLoadTest_(adminKey,token) {
  assertAdmin_(adminKey);
  if(requestNamespace_!=='test_'+token)throw new Error('不支援的請求。');
  const rows=responses_();
  const unique=new Set(rows.map(r=>String(r[1])+'|'+String(r[3])));
  const report=getAdminReport(adminKey);
  PropertiesService.getScriptProperties().deleteProperty('LOAD_TEST_'+token);
  CacheService.getScriptCache().remove(cacheKey_());
  return {rows:rows.length,duplicates:rows.length-unique.size,report:report,accessRevoked:true};
}
function seedLoadHistory_(adminKey) {
  assertAdmin_(adminKey);
  if(requestNamespace_.indexOf('test_')!==0)throw new Error('不支援的請求。');
  const questions=getQuestions_(),quiz=questions.find(q=>q.type==='quiz'),text=questions.filter(q=>q.type==='open_text').slice(-1)[0];
  const seen=new Set(responses_().map(r=>r[1]+'|'+r[3])),rows=[];
  questions.filter(q=>q.id!==quiz.id&&q.id!==text.id).forEach(q=>{
    for(let i=0;i<50;i++){
      const pid='load_'+i;if(seen.has(pid+'|'+q.id))continue;
      const answer=q.type==='open_text'?'壓測歷史回答 '+i:q.type==='multiple'?[q.options[0]]:q.options[i%q.options.length];
      const correct=q.type==='quiz'?answersEqual_(answer,q.answer):'';
      rows.push([new Date(),pid,'壓測學員'+(i+1),q.id,JSON.stringify(answer),correct,correct?q.points:0]);
    }
  });
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const sh=sheet_('Responses');if(rows.length)sh.getRange(sh.getLastRow()+1,1,rows.length,7).setValues(rows);SpreadsheetApp.flush();invalidate_();}finally{lock.releaseLock();}
  return {seededRows:rows.length,quiz:publicQuestion_(quiz),correctOption:quiz.options.find(o=>answersEqual_(o,quiz.answer)),text:publicQuestion_(text)};
}

function adminSetActive(adminKey, questionId) {
  assertAdmin_(adminKey);
  questionId = cleanId_(questionId);
  if (questionId && !findQuestion_(questionId)) throw new Error('找不到指定題目。');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    setSetting_('activeQuestionId', questionId);
    const opened=JSON.parse(getSetting_('openedQuestionIds')||'[]');
    if(questionId && opened.indexOf(questionId)<0) {opened.push(questionId);setSetting_('openedQuestionIds',JSON.stringify(opened));}
    SpreadsheetApp.flush(); invalidate_(true);
  } finally {lock.releaseLock();}
  return getAdminDashboard(adminKey);
}

function adminNavigate(adminKey, direction) {
  assertAdmin_(adminKey);
  const list = getQuestions_().filter(q => q.enabled).sort((a,b) => Number(a.page) - Number(b.page));
  if (!list.length) throw new Error('沒有可開放的題目。');
  const current = getSetting_('activeQuestionId');
  let i = list.findIndex(q => q.id === current);
  i = direction === 'prev' ? Math.max(0, i - 1) : Math.min(list.length - 1, i + 1);
  if (i < 0) i = 0;
  return adminSetActive(adminKey,list[i].id);
}

function deleteTestResponses(adminKey) {
  assertAdmin_(adminKey);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = sheet_('Responses');
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS.Responses.length).clearContent();
    setSetting_('activeQuestionId', '');
    setSetting_('openedQuestionIds','[]');
    setSetting_('resetEpoch',Utilities.getUuid());
    SpreadsheetApp.flush(); invalidate_(true);
  } finally { lock.releaseLock(); }
  return getAdminDashboard(adminKey);
}

function getSpreadsheet_() {
  if (requestSpreadsheet_) return requestSpreadsheet_;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '1U1fC3doBVEX4pQOgUtxoAqPzEMzZst718dLG7zzyh7k';
  if (id) return requestSpreadsheet_ = SpreadsheetApp.openById(id);
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (!bound) throw new Error('尚未設定試算表。');
  return bound;
}
function sheet_(name) { const sh = getSpreadsheet_().getSheetByName(name); if (!sh) throw new Error('系統尚未初始化。請先執行 setupSpreadsheet。'); return sh; }
function getAdminKey_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || ''; }
function createAdminSession_(key) {
  if (!getAdminKey_() || String(key) !== getAdminKey_()) throw new Error('講師驗證失敗。');
  const token = 'admin_' + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADMIN_SESSION_' + token, String(Date.now() + 21600000));
  return token;
}
function assertAdmin_(key) {
  const value = String(key || '');
  if (/^admin_[a-f0-9]{32}$/.test(value)) {
    const sessions = PropertiesService.getScriptProperties();
    const sessionKey = 'ADMIN_SESSION_' + value;
    const expiresAt = Number(sessions.getProperty(sessionKey) || 0);
    if (expiresAt > Date.now()) return;
    if (expiresAt) sessions.deleteProperty(sessionKey);
  }
  if (!getAdminKey_() || value !== getAdminKey_()) throw new Error('講師驗證失敗。');
}
function getSetting_(key) { const rows = sheet_('Settings').getDataRange().getValues(); const r = rows.slice(1).find(x => String(x[0]) === key); return r ? String(r[1] || '') : ''; }
function setSetting_(key, value) { const sh=sheet_('Settings'), rows=sh.getDataRange().getValues(), i=rows.slice(1).findIndex(x=>String(x[0])===key); if(i>=0) sh.getRange(i+2,2).setValue(value); else sh.appendRow([key,value]); }
function getQuestions_() { const rows=sheet_('Questions').getDataRange().getValues(); return rows.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),page:r[1],type:String(r[2]),question:String(r[3]),options:parseOptions_(r[4]),answer:String(r[5]||''),points:Number(r[6]||0),enabled:r[7] === true || String(r[7]).toLowerCase()==='true'})); }
function findQuestion_(id) { return getQuestions_().find(q => q.id === id); }
function publicQuestion_(q) { return {id:q.id,page:q.page,type:q.type,question:q.question,options:q.options,points:q.points,enabled:q.enabled}; }
function parseOptions_(v) { try { const a=JSON.parse(String(v||'[]')); return Array.isArray(a) ? a.map(x=>cleanText_(x,100)).filter(Boolean) : []; } catch(e) { return String(v||'').split(',').map(x=>cleanText_(x,100)).filter(Boolean); } }
function hasResponded_(pid,qid) { return responses_().some(r=>String(r[1])===pid && String(r[3])===qid); }
function validateAnswer_(q, value) { let a=q.type==='multiple' ? (Array.isArray(value)?value:[]) : value; if(q.type==='open_text') { a=cleanText_(a,500); if(!a) throw new Error('請輸入回答。'); return a; } if(q.type==='multiple') { a=[...new Set(a.map(x=>cleanText_(x,100)).filter(x=>q.options.indexOf(x)>=0))]; if(!a.length) throw new Error('請至少選擇一個選項。'); return a.sort(); } a=cleanText_(a,100); if(q.options.indexOf(a)<0) throw new Error('請選擇有效選項。'); return a; }
function answersEqual_(a,b) { let expected; try { expected=JSON.parse(b); } catch(e) { expected=b; } return JSON.stringify(Array.isArray(a)?a.slice().sort():a) === JSON.stringify(Array.isArray(expected)?expected.slice().sort():expected); }
function cleanText_(v,max) { return String(v == null ? '' : v).replace(/[<>]/g,'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max); }
function cleanId_(v) { return cleanText_(v,80).replace(/[^A-Za-z0-9_-]/g,''); }
function getProfileStats_() {
  const labels = {profile_gender:'性別', profile_age:'年齡', profile_job:'職業', profile_city:'居住縣市'};
  const rows = responses_();
  const result = {};
  Object.keys(labels).forEach(id => result[id] = {label:labels[id], counts:{}});
  rows.forEach(r => {
    const id = String(r[3]);
    if (!result[id]) return;
    let value; try { value = JSON.parse(r[4]); } catch(e) { value = r[4]; }
    value = cleanText_(value, 60);
    if (value) result[id].counts[value] = (result[id].counts[value] || 0) + 1;
  });
  return result;
}
function getStats_(q,allTexts) { const rows=responses_().filter(r=>String(r[3])===q.id); const counts={}; q.options.forEach(o=>counts[o]=0); let correct=0; const texts=[]; rows.forEach(r=>{ let a;try{a=JSON.parse(r[4]);}catch(e){a=r[4];} (Array.isArray(a)?a:[a]).forEach(x=>{if(counts[x]!==undefined)counts[x]++;}); if(r[5]===true || String(r[5])==='true')correct++; if(q.type==='open_text') texts.push({name:cleanText_(r[2],60),answer:cleanText_(a,500),timestamp:String(r[0])}); }); return {count:rows.length, counts:counts, correct:correct, correctRate:rows.length?Math.round(correct/rows.length*100):0, texts:(allTexts?texts:texts.slice(-30)).reverse()}; }
