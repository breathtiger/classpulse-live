/** 單一課程互動系統：將此專案綁定到試算表，或設定 SPREADSHEET_ID。 */
const SHEETS = {
  Questions: ['id', 'page', 'type', 'question', 'options', 'answer', 'points', 'enabled'],
  Responses: ['timestamp', 'participantId', 'participantName', 'questionId', 'answer', 'correct', 'score'],
  Settings: ['key', 'value']
};

/** 首次設定用：將本課程試算表記錄為專案資料庫。 */
function configureClassPulseSpreadsheet() {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', '1U1fC3doBVEX4pQOgUtxoAqPzEMzZst718dLG7zzyh7k');
  return '已設定課程試算表。';
}

function doGet(e) {
  if (e && e.parameter && e.parameter.api) return apiGet_(e.parameter);
  const key = String((e && e.parameter && e.parameter.adminKey) || '');
  const isAdmin = key && key === getAdminKey_();
  const file = isAdmin ? 'Admin' : 'Student';
  const t = HtmlService.createTemplateFromFile(file);
  t.adminKey = isAdmin ? key : '';
  return t.evaluate().setTitle(isAdmin ? '講師控制台' : '課堂互動').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** GitHub Pages 展示前端使用的 JSONP 介面；僅開放學員讀題與送答。 */
function apiGet_(p) {
  const callback = String(p.callback || '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(callback)) return ContentService.createTextOutput('/* invalid request */');
  try {
    let data;
    if (p.api === 'state') data = getStudentState(p.participantId);
    else if (p.api === 'setup') { assertAdmin_(p.adminKey); data = setupSpreadsheet(); }
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

function getStudentState(participantId) {
  participantId = cleanId_(participantId);
  const id = getSetting_('activeQuestionId');
  if (!id) return { activeQuestion: null, submitted: false };
  const question = findQuestion_(id);
  if (!question || !question.enabled) return { activeQuestion: null, submitted: false };
  return { activeQuestion: publicQuestion_(question), submitted: hasResponded_(participantId, id) };
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
    return { ok: true, correct: correct, score: score };
  } finally { lock.releaseLock(); }
}

function getAdminDashboard(adminKey) {
  assertAdmin_(adminKey);
  const questions = getQuestions_();
  const activeId = getSetting_('activeQuestionId');
  const active = activeId ? findQuestion_(activeId) : null;
  return { questions: questions.map(publicQuestion_), activeQuestionId: activeId, stats: active ? getStats_(active) : null };
}

function adminSetActive(adminKey, questionId) {
  assertAdmin_(adminKey);
  questionId = cleanId_(questionId);
  if (questionId && !findQuestion_(questionId)) throw new Error('找不到指定題目。');
  setSetting_('activeQuestionId', questionId);
  return true;
}

function adminNavigate(adminKey, direction) {
  assertAdmin_(adminKey);
  const list = getQuestions_().filter(q => q.enabled).sort((a,b) => Number(a.page) - Number(b.page));
  if (!list.length) throw new Error('沒有可開放的題目。');
  const current = getSetting_('activeQuestionId');
  let i = list.findIndex(q => q.id === current);
  i = direction === 'prev' ? Math.max(0, i - 1) : Math.min(list.length - 1, i + 1);
  if (i < 0) i = 0;
  setSetting_('activeQuestionId', list[i].id);
  return true;
}

function deleteTestResponses(adminKey) {
  assertAdmin_(adminKey);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = sheet_('Responses');
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS.Responses.length).clearContent();
  } finally { lock.releaseLock(); }
  return true;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '1U1fC3doBVEX4pQOgUtxoAqPzEMzZst718dLG7zzyh7k';
  if (id) return SpreadsheetApp.openById(id);
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (!bound) throw new Error('尚未設定試算表。');
  return bound;
}
function sheet_(name) { const sh = getSpreadsheet_().getSheetByName(name); if (!sh) throw new Error('系統尚未初始化。請先執行 setupSpreadsheet。'); return sh; }
function getAdminKey_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || ''; }
function assertAdmin_(key) { if (!getAdminKey_() || String(key) !== getAdminKey_()) throw new Error('講師驗證失敗。'); }
function getSetting_(key) { const rows = sheet_('Settings').getDataRange().getValues(); const r = rows.slice(1).find(x => String(x[0]) === key); return r ? String(r[1] || '') : ''; }
function setSetting_(key, value) { const sh=sheet_('Settings'), rows=sh.getDataRange().getValues(), i=rows.slice(1).findIndex(x=>String(x[0])===key); if(i>=0) sh.getRange(i+2,2).setValue(value); else sh.appendRow([key,value]); }
function getQuestions_() { const rows=sheet_('Questions').getDataRange().getValues(); return rows.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),page:r[1],type:String(r[2]),question:String(r[3]),options:parseOptions_(r[4]),answer:String(r[5]||''),points:Number(r[6]||0),enabled:r[7] === true || String(r[7]).toLowerCase()==='true'})); }
function findQuestion_(id) { return getQuestions_().find(q => q.id === id); }
function publicQuestion_(q) { return {id:q.id,page:q.page,type:q.type,question:q.question,options:q.options,points:q.points,enabled:q.enabled}; }
function parseOptions_(v) { try { const a=JSON.parse(String(v||'[]')); return Array.isArray(a) ? a.map(x=>cleanText_(x,100)).filter(Boolean) : []; } catch(e) { return String(v||'').split(',').map(x=>cleanText_(x,100)).filter(Boolean); } }
function hasResponded_(pid,qid) { return sheet_('Responses').getDataRange().getValues().slice(1).some(r=>String(r[1])===pid && String(r[3])===qid); }
function validateAnswer_(q, value) { let a=q.type==='multiple' ? (Array.isArray(value)?value:[]) : value; if(q.type==='open_text') { a=cleanText_(a,500); if(!a) throw new Error('請輸入回答。'); return a; } if(q.type==='multiple') { a=[...new Set(a.map(x=>cleanText_(x,100)).filter(x=>q.options.indexOf(x)>=0))]; if(!a.length) throw new Error('請至少選擇一個選項。'); return a.sort(); } a=cleanText_(a,100); if(q.options.indexOf(a)<0) throw new Error('請選擇有效選項。'); return a; }
function answersEqual_(a,b) { let expected; try { expected=JSON.parse(b); } catch(e) { expected=b; } return JSON.stringify(Array.isArray(a)?a.slice().sort():a) === JSON.stringify(Array.isArray(expected)?expected.slice().sort():expected); }
function cleanText_(v,max) { return String(v == null ? '' : v).replace(/[<>]/g,'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max); }
function cleanId_(v) { return cleanText_(v,80).replace(/[^A-Za-z0-9_-]/g,''); }
function getStats_(q) { const rows=sheet_('Responses').getDataRange().getValues().slice(1).filter(r=>String(r[3])===q.id); const counts={}; q.options.forEach(o=>counts[o]=0); let correct=0; const texts=[]; rows.forEach(r=>{ let a;try{a=JSON.parse(r[4]);}catch(e){a=r[4];} (Array.isArray(a)?a:[a]).forEach(x=>{if(counts[x]!==undefined)counts[x]++;}); if(r[5]===true || String(r[5])==='true')correct++; if(q.type==='open_text') texts.push({name:cleanText_(r[2],60),answer:cleanText_(a,500),timestamp:String(r[0])}); }); return {count:rows.length, counts:counts, correct:correct, correctRate:rows.length?Math.round(correct/rows.length*100):0, texts:texts.slice(-30).reverse()}; }
