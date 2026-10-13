/** Additional courses are opt-in. Requests without course keep the original database. */
const MARKET_COURSE_ID = 'market-20261015';
const MARKET_COURSE_TITLE = '市場先知術－客戶行為預測導航';
let requestCourseId_ = '';

function marketQuestions_() {
  const yn=['是','否'],agree=['同意','不同意','不確定'];
  const row=(id,page,type,text,options,answer)=>[id,page,type,text,JSON.stringify(options||[]),answer||'',type==='quiz'?1:0,true];
  return [
    row('ad_repeat',5,'single','曾經點過某個廣告後，就一直看到類似的廣告嗎？',yn),
    row('youtube_use',6,'single','是否使用 YouTube？',yn),
    row('youtube_follow',7,'single','是否追蹤過某些 YouTube 頻道？',yn),
    row('maps_use',8,'single','是否使用 Google Maps？',yn),
    row('basket_confidence',25,'quiz','買牛奶的 3 筆交易中，有 2 筆也買銅鑼燒，信賴度是多少？',['40%','60%','66.7%','100%'],'66.7%'),
    row('inquiry_signals',31,'multiple','若想預測客戶是否會詢價，你會優先觀察哪些行為？（可複選，無唯一正解）',['重複瀏覽商品','查看規格','點擊聯絡方式','下載型錄','其他']),
    row('facebook_use',60,'single','是否使用 Facebook？',yn),
    row('instagram_use',61,'single','是否使用 Instagram？',yn),
    row('threads_use',62,'single','是否使用 Threads？',yn),
    row('linepay_use',68,'single','是否使用 LINE Pay？',yn),
    row('line_stickers',69,'single','是否購買過 LINE 貼圖？',yn),
    row('dcard_use',72,'single','是否使用 Dcard？',yn),
    row('dcard_topics',73,'open_text','在 Dcard 通常瀏覽哪些主題？未使用者可填「未使用」。'),
    row('trust_data',77,'single','因為有數據，所以可以相信',agree),
    row('trust_ai',78,'single','AI不會騙人，所以可以相信',agree),
    row('ai_bias',79,'quiz','學生用 Gemini 研究歷史，發現回答總是強調某些國家的觀點，輕視其他地區的貢獻。這屬於什麼問題？',['故障／問題','演算法偏見','數據透明度','數位責任'],'演算法偏見'),
    row('ai_hallucination',80,'quiz','AI 聊天機器人產生看似可信，實際錯誤、荒謬或誤導的內容，這些錯誤稱為什麼？',['偏見','幻覺','錯誤訊息','故障'],'幻覺'),
    row('ga_acquisition',131,'open_text','GA 練習（2026/1/1–2026/10/14）：哪個流量管道參與率最高？哪個工作階段來源／媒介的平均參與時間最長？多久？請使用講師指定的示範資源。'),
    row('ga_pages',138,'open_text','GA 練習（2025/1/1–2025/12/31）：哪一天、哪個網頁的單日瀏覽量最多？請填寫日期、網頁標題與瀏覽量。'),
    row('ga_city',147,'open_text','GA 練習（2026/1/1–2026/3/31）：哪個國家／城市的 purchase 事件次數最高？請填寫國家、城市與次數。'),
    row('ga_predictive',154,'open_text','GA 練習（2026/1/1–2026/5/31）：在 Likely 7-day purchasers 目標對象中，男性或女性的交易次數較多？誰的總收益最高？收益多少？若資料不足或受眾不可用，請註明，勿猜測。'),
    row('audience_questions',157,'open_text','課後提問：請留下你的問題或想法；沒有問題可填「無」。')
  ];
}

function marketCheckinFields_() {
  return [
    {id:'job',label:'工作職務',required:true,options:['行銷','業務','管理','電商','資訊／數據','其他']},
    {id:'ga_experience',label:'GA4 使用經驗',required:true,options:['沒用過','看過報表','偶爾使用','經常使用']},
    {id:'goal',label:'最想解決的問題',required:true,options:['找新客','提高成交','促進回購','降低廣告浪費','其他']},
    {id:'gender',label:'性別',required:false,options:['女性','男性','非二元／其他','不透露']},
    {id:'age',label:'年齡',required:false,options:['18 歲以下','19-25 歲','26-35 歲','36-45 歲','46-55 歲','56-65 歲','65-75 歲','75 歲以上']},
    {id:'city',label:'居住縣市',required:false,options:['基隆市','臺北市','新北市','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣','海外／其他']}
  ];
}
function checkinFields_() {
  return requestCourseId_===MARKET_COURSE_ID?marketCheckinFields_():[
    {id:'gender',label:'性別',required:true},{id:'age',label:'年齡',required:true},
    {id:'job',label:'職業',required:true},{id:'city',label:'居住縣市',required:true}
  ];
}
function checkinMarker_() { return 'profile_'+checkinFields_()[0].id; }
function checkinValues_(profile) {
  const values={};profile=profile||{};
  checkinFields_().forEach(f=>{
    const value=cleanText_(profile[f.id],60);
    if(f.required&&!value)throw new Error('請完整填寫報到資料。');
    if(value&&f.options&&f.options.indexOf(value)<0)throw new Error('請選擇有效選項。');
    if(value)values['profile_'+f.id]=value;
  });
  return values;
}
function useCourse_(id) {
  if(id!==MARKET_COURSE_ID)throw new Error('找不到此課程，請確認連結。');
  const value=PropertiesService.getScriptProperties().getProperty('COURSE_'+id);
  const record=value?JSON.parse(value):null;
  if(!record||!record.ready)throw new Error('此課程尚未開放，請稍後再試。');
  requestCourseId_=id;requestNamespace_='course_'+id;
  requestSpreadsheet_=SpreadsheetApp.openById(record.id);requestResponses_=undefined;
}
/** One named course, idempotent provisioning; never rewrites any existing question or response. */
function createMarketCourse_(adminKey) {
  assertAdmin_(adminKey);
  if(requestNamespace_!=='main')throw new Error('不支援的請求。');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const props=PropertiesService.getScriptProperties(),key='COURSE_'+MARKET_COURSE_ID;
    const stored=props.getProperty(key);let record=stored?JSON.parse(stored):null;
    if(!record){const created=SpreadsheetApp.create('ClassPulse｜2026-10-15｜'+MARKET_COURSE_TITLE);record={id:created.getId(),ready:false};props.setProperty(key,JSON.stringify(record));}
    const ss=SpreadsheetApp.openById(record.id);
    if(!record.ready){
      Object.keys(SHEETS).forEach(name=>{
        const sh=ss.getSheetByName(name)||ss.insertSheet(name);
        if(!sh.getLastRow())sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
        sh.setFrozenRows(1);
      });
      const qs=ss.getSheetByName('Questions');
      if(qs.getLastRow()===1){const rows=marketQuestions_();qs.getRange(2,1,rows.length,8).setValues(rows);}
      const settings=ss.getSheetByName('Settings');
      if(settings.getLastRow()===1)settings.getRange(2,1,4,2).setValues([['activeQuestionId',''],['openedQuestionIds','[]'],['resetEpoch',Utilities.getUuid()],['courseId',MARKET_COURSE_ID]]);
      SpreadsheetApp.flush();record.ready=true;props.setProperty(key,JSON.stringify(record));
    }
    return {courseId:MARKET_COURSE_ID,title:MARKET_COURSE_TITLE,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+record.id+'/edit',questionCount:ss.getSheetByName('Questions').getLastRow()-1};
  }finally{lock.releaseLock();}
}
