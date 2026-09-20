'use strict';
const CPReport=(()=>{
  let latest=null,lastSignature='';
  function render(container,data){
    latest=data;
    const signature=JSON.stringify({...data,generatedAt:undefined});
    if(signature===lastSignature)return;
    lastSignature=signature;
    const expanded=new Set([...container.querySelectorAll('details[open]')].map(x=>x.id));
    const summary=data.questions.map(({question:q,stats:s},i)=>'<tr><td><a href="#report-q-'+i+'">'+(i+1)+'</a></td><td>P'+CP.esc(q.page)+'</td><td>'+CP.esc(q.question)+'</td><td>'+s.count+'</td><td>'+(q.type==='quiz'?s.correctRate+'%':'—')+'</td></tr>').join('');
    const cards=data.questions.map(({question:q,stats:s},i)=>{
      const text=q.type==='open_text'?'<details id="report-text-'+i+'" '+(expanded.has('report-text-'+i)?'open':'')+'><summary>展開全部 '+s.texts.length+' 則文字回答</summary>'+s.texts.map((t,j)=>'<div class="answer"><b>'+(j+1)+'.</b> '+CP.esc(t.answer)+'</div>').join('')+'</details>':CP.bars(s.counts,s.count);
      return '<section class="card report-question" id="report-q-'+i+'"><div class="report-kicker">第 '+(i+1)+' 題 · P'+CP.esc(q.page)+' · '+({single:'單選',multiple:'複選',rating:'評分',open_text:'文字回答',quiz:'測驗'}[q.type]||CP.esc(q.type))+'</div><h2>'+CP.esc(q.question)+'</h2><p><b>'+s.count+'</b> 人回答'+(q.type==='quiz'?' · '+s.correct+' 人答對 · 答對率 <b>'+s.correctRate+'%</b>':'')+'</p>'+(s.count?text:'<p class="muted">尚無回答</p>'+text)+(q.type==='multiple'?'<p class="muted">比例以本題作答人數為分母；複選合計可能超過 100%。</p>':'')+'</section>';
    }).join('');
    const profiles=Object.values(data.profileStats).map(s=>{const count=Object.values(s.counts).reduce((n,x)=>n+x,0);return '<section class="card"><h3>'+CP.esc(s.label)+'</h3>'+CP.bars(s.counts,count)+'</section>';}).join('');
    container.innerHTML='<section class="card"><div class="report-kicker">COURSE REPORT · 全程保留</div><h1>全題統計總覽</h1><p class="muted">從第一題到最後一題，關閉作答仍保留統計。清除全部測試資料才會歸零。</p><div class="report-metrics"><div><b>'+data.participantCount+'</b><span>報到人數</span></div><div><b>'+data.respondentCount+'</b><span>參與作答人數</span></div><div><b>'+data.answerCount+'</b><span>累計作答筆數</span></div><div><b>'+data.questions.length+'</b><span>題庫總題數</span></div></div><div class="row report-actions"><button class="btn" data-report="present">全螢幕展示</button><button class="btn" data-report="csv">匯出全題統計 CSV</button><button class="btn alt" data-report="print">列印／儲存 PDF</button></div></section><section class="card"><h2>全部題目一覽</h2><div class="report-table"><table><thead><tr><th>序</th><th>投影片</th><th>題目</th><th>人數</th><th>答對率</th></tr></thead><tbody>'+summary+'</tbody></table></div></section>'+cards+'<details id="report-profiles" '+(expanded.has('report-profiles')?'open':'')+'><summary>課前報到分布</summary>'+profiles+'</details>';
  }
  function csv(){
    if(!latest)return;
    const rows=[['題序','投影片','題型','題目','回答人數','選項／文字回答','票數','比例','答對人數','答對率']];
    latest.questions.forEach(({question:q,stats:s},i)=>{
      const tail=q.type==='quiz'?[s.correct,s.correctRate+'%']:['',''];
      const base=[i+1,q.page,q.type,q.question,s.count];
      if(q.type==='open_text'){
        if(!s.texts.length)rows.push([...base,'尚無回答','','',...tail]);
        else s.texts.forEach(t=>rows.push([...base,t.answer,'','',...tail]));
      }else Object.entries(s.counts).forEach(([o,n])=>rows.push([...base,o,n,(s.count?Math.round(n/s.count*100):0)+'%',...tail]));
    });
    const cell=v=>{let text=String(v??'');if(/^[=+\-@\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ClassPulse-全題統計-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return {render,csv};
})();
