'use strict';
const CP = (() => {
  const endpoint = 'https://script.google.com/macros/s/AKfycbw2DmpkxEYlN89Y4zhDgYtf8T9ZrUGDWgO4wHF0ec1eUTB7RjW5XNq69kDHzdfL9erW/exec';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  async function once(api, payload = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({api,...payload}),signal:controller.signal,credentials:'omit',redirect:'follow'});
      if (!response.ok) throw Object.assign(new Error('服務暫時忙碌，請稍後重試。'),{retryable:[404,408,429].includes(response.status)||response.status>=500});
      const result = await response.json();
      if (!result.ok) throw Object.assign(new Error(result.error || '操作未完成，請重試。'),{retryable:!!result.retryable});
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('尚未收到確認；資料可能已送達，請按重試確認，不會重複計票。'),{retryable:true});
      if (error.name === 'SyntaxError' || error.name === 'TypeError') throw Object.assign(new Error('暫時無法連線，請稍後重試。'),{retryable:true});
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function call(api,payload={},options={}) {
    const writing=api==='submit'||api==='checkin';
    const retryable=writing||['state','display','adminReport','adminDashboard','adminSetActive'].includes(api);
    const maxAttempts=writing||api==='state'?12:3;
    const started=Date.now();
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      if(options.onAttempt)options.onAttempt(attempt);
      try{
        const data=await once(api,writing?{...payload,protocol:'batch1'}:payload);
        if(!data.pending)return data;
      }catch(e){if(!retryable||!e.retryable||attempt===maxAttempts||Date.now()-started>75000)throw e;}
      if(Date.now()-started>75000)break;
      if(options.onProgress)options.onProgress('傳輸中... 多人同時送出，正在排隊確認，請勿關閉頁面。');
      await new Promise(resolve=>setTimeout(resolve,1000+Math.random()*2000+Math.min(attempt,4)*400));
    }
    throw new Error('尚未收到寫入確認，請按重新送出／確認結果；系統不會重複計票。');
  }
  function read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) || fallback;}catch (_) {return fallback;}}
  function save(key,value) {try {localStorage.setItem(key,JSON.stringify(value));}catch (_) {}}
  function bars(counts,total) {return Object.entries(counts).map(([label,n]) => '<div class="barrow"><div class="barlabel label"><span>'+esc(label)+'</span><b>'+n+' 票 · '+(total?Math.round(n/total*100):0)+'%</b></div><div class="bar track"><span class="fill" style="display:block;width:'+Math.min(100,total?n/total*100:0)+'%"></span></div></div>').join('');}
  return {call,esc,read,save,bars};
})();
