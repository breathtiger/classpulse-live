'use strict';
const CP = (() => {
  const endpoint = 'https://script.google.com/macros/s/AKfycbw2DmpkxEYlN89Y4zhDgYtf8T9ZrUGDWgO4wHF0ec1eUTB7RjW5XNq69kDHzdfL9erW/exec';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  async function call(api, payload = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({api,...payload}),signal:controller.signal,credentials:'omit',redirect:'follow'});
      if (!response.ok) throw new Error('服務暫時忙碌，請稍後重試。');
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '操作未完成，請重試。');
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('尚未收到確認；資料可能已送達，請按重試確認，不會重複計票。');
      if (error instanceof SyntaxError || error instanceof TypeError) throw new Error('暫時無法連線，請稍後重試。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function read(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) || fallback;}catch (_) {return fallback;}}
  function save(key,value) {try {localStorage.setItem(key,JSON.stringify(value));}catch (_) {}}
  function bars(counts,total) {return Object.entries(counts).map(([label,n]) => '<div class="barrow"><div class="barlabel label"><span>'+esc(label)+'</span><b>'+n+' 票 · '+(total?Math.round(n/total*100):0)+'%</b></div><div class="bar track"><span class="fill" style="display:block;width:'+Math.min(100,total?n/total*100:0)+'%"></span></div></div>').join('');}
  return {call,esc,read,save,bars};
})();
