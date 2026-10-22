/** 2026-10-22. Teaching scenarios only; do not collect real employee records. */
const HR_COURSE_ID='hr-20261022';
const HR_COURSE_TITLE='人資讀心術－數據驅動人才管理';
function hrQuestions_(){
  const row=(id,page,type,text,options,answer)=>[id,page,type,text,JSON.stringify(options||[]),answer?JSON.stringify(answer):'',type==='quiz'?1:0,true];
  return [
    row('hr_impression',6,'open_text','想到「AI 用在人資」，你第一個想到的詞是什麼？請填 1–3 個關鍵詞，不要填寫真實人名或公司機密。'),
    row('genai_feature',26,'quiz','與其他形式的 AI 相比，生成式 AI 的關鍵特徵是什麼？',['驅動 AI 的實體硬體','能生成文字、圖像或音樂等新內容','AI 必須遵守的一套規則','專門分析現有資料'],'能生成文字、圖像或音樂等新內容'),
    row('genai_type',27,'quiz','能夠生成文字、圖像或影片等新內容的 AI 類型稱為什麼？',['生成式人工智慧','大型語言模型','機器學習'],'生成式人工智慧'),
    row('ai_sentiment',30,'single','面對工作導入 AI，你目前的感受比較接近哪一種？',['期待減少重複工作','期待但也有疑慮','擔心工作被取代','還不確定']),
    row('genai_difference',32,'quiz','生成式 AI 與分類模型的差異，只是訓練資料量大小，基本任務相同。這個說法對嗎？',['對','錯'],'錯'),
    row('ai_hallucination',36,'quiz','AI 聊天機器人產生看似可信，實際錯誤、荒謬或誤導的內容，這稱為什麼？',['偏見','幻覺','錯誤訊息','故障'],'幻覺'),
    row('recruitment_funnel',43,'quiz','招募漏斗有 100 封履歷、30 人初篩、8 人面試、1 人報到。「面試到報到」的轉換率是多少？',['1%','8%','12.5%','30%'],'12.5%'),
    row('structured_interview',46,'quiz','哪一題比較符合「過去真實行為」的結構化行為面試？',['你覺得自己擅長溝通嗎？','如果遇到衝突，你會怎麼做？','請描述一次跨部門衝突，以及你當時如何處理。','你是哪個星座？'],'請描述一次跨部門衝突，以及你當時如何處理。'),
    row('training_bias',50,'quiz','AI 因訓練資料而系統性產生帶有偏頗的結果，這稱為什麼？',['偏見','特徵','無法取得更新後的資訊','幻覺'],'偏見'),
    row('perspective_bias',52,'quiz','Gemini 回答歷史問題時，總是強調某些國家的觀點、輕視其他地區的貢獻，這屬於哪一類問題？',['故障／問題','演算法偏見','數據透明度','數位責任'],'演算法偏見'),
    row('suitability_score',53,'single','情境討論：AI 給求職者很低的適配度分數，你會先怎麼做？（無標準答案）',['直接淘汰','查看依據並由人類複核','只憑主管直覺決定','先補充資訊再判斷']),
    row('learning_challenges',57,'multiple','你遇過哪些培訓問題？（可複選）',['內容太淺或太深','課程與實際工作不符','需要時沒有合適課程','學完缺少實作機會','和職涯發展連結不清楚','暫時沒有／不適用']),
    row('monitoring_boundaries',69,'single','若公司用穿戴裝置偵測疲勞，協助安排休息，你的接受程度是？（不需透露健康狀況）',['可以接受','須先說明用途、存取權限與保存期限','不願意提供這類資料','還不確定']),
    row('trust_scores',75,'single','「只要是 AI 算出來的分數，就比人類判斷客觀。」你同意嗎？',['同意','不同意','不確定']),
    row('data_guarantee',76,'quiz','生成式 AI 使用大量資料訓練，所以可以保證輸出沒有事實錯誤或偏見。對或錯？',['對','錯'],'錯'),
    row('hallucination_cause',78,'quiz','關於大型語言模型產生幻覺的原因，哪個說法最準確？',['只因為資料庫損壞','只因為訓練資料過時','模型生成可能的文字，不保證每次都查證事實','模型被刻意設定為欺騙所有使用者'],'模型生成可能的文字，不保證每次都查證事實'),
    row('bias_definition',83,'quiz','生成式 AI 的「偏見」，哪個描述最準確？',['開發者刻意植入的個人觀點才算偏見','AI 缺乏創造力、只能輸出客觀資訊','偶發、隨機的錯誤或幻覺','訓練資料或設計中的偏差被系統性重現，使某些群體受到不公平對待'],'訓練資料或設計中的偏差被系統性重現，使某些群體受到不公平對待'),
    row('privacy_first',94,'quiz','依本課程的資料保護原則，想用 AI 整理離職面談主題，哪一個起手式較合適？',['直接上傳完整姓名、薪資與面談原文','只刪姓名，保留電話與所有可識別細節','先確認工具與用途獲允許，再移除識別資訊、改寫細節，只提供必要資料','把真實資料貼在公開聊天室，請大家一起分析'],'先確認工具與用途獲允許，再移除識別資訊、改寫細節，只提供必要資料'),
    row('first_pilot',99,'multiple','若從小型試驗開始，你想優先嘗試哪些 AI 人資任務？（可複選）',['改寫職缺說明 JD','起草結構化面試題與評分表','依已核准規章草擬 FAQ','整理去識別化意見的主題','規劃培訓內容','尚未決定']),
    row('next_action',101,'open_text','課後你想先嘗試哪一件事？請用一句話說明，不要填寫真實員工資料。'),
    row('audience_questions',103,'open_text','課後提問：請留下問題或心得；沒有問題可填「無」。請勿填寫真實人名、聯絡方式或公司機密。')
  ];
}
function hrCheckinFields_(){
  return [
    {id:'job',label:'工作職務',required:true,options:['人資／招募','教育訓練／人才發展','主管／經營管理','行政／營運','資訊／數據','其他']},
    {id:'ai_experience',label:'AI 使用經驗',required:true,options:['尚未使用','偶爾嘗試','每週使用','幾乎每天使用']},
    {id:'goal',label:'今晚最想學的主題',required:true,options:['智慧招募','培訓與職涯發展','績效與薪酬','留任與員工關懷','AI 偏見與資料保護']},
    ...marketCheckinFields_().filter(f=>['gender','age','city'].includes(f.id))
  ];
}
/** Idempotent creation. Existing course content, answers and settings are never replaced. */
function createHRCourse_(adminKey){
  assertAdmin_(adminKey);
  if(requestNamespace_!=='main')throw new Error('不支援的請求。');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const props=PropertiesService.getScriptProperties(),key='COURSE_'+HR_COURSE_ID;
    const stored=props.getProperty(key);let record=stored?JSON.parse(stored):null;
    if(!record){const created=SpreadsheetApp.create('ClassPulse｜2026-10-22｜'+HR_COURSE_TITLE);record={id:created.getId(),ready:false};props.setProperty(key,JSON.stringify(record));}
    const ss=SpreadsheetApp.openById(record.id);
    if(!record.ready){
      Object.keys(SHEETS).forEach(name=>{const sh=ss.getSheetByName(name)||ss.insertSheet(name);if(!sh.getLastRow())sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);sh.setFrozenRows(1);});
      const qs=ss.getSheetByName('Questions');if(qs.getLastRow()===1){const rows=hrQuestions_();qs.getRange(2,1,rows.length,8).setValues(rows);}
      const settings=ss.getSheetByName('Settings');if(settings.getLastRow()===1)settings.getRange(2,1,4,2).setValues([['activeQuestionId',''],['openedQuestionIds','[]'],['resetEpoch',Utilities.getUuid()],['courseId',HR_COURSE_ID]]);
      SpreadsheetApp.flush();record.ready=true;props.setProperty(key,JSON.stringify(record));
    }
    return {courseId:HR_COURSE_ID,title:HR_COURSE_TITLE,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+record.id+'/edit',questionCount:ss.getSheetByName('Questions').getLastRow()-1};
  }finally{lock.releaseLock();}
}
