'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const cities=['新竹縣','新竹市','桃園市','苗栗縣','新北市','臺北市','臺中市','基隆市','宜蘭縣','彰化縣','南投縣','花蓮縣','雲林縣','嘉義市','嘉義縣','臺南市','臺東縣','高雄市','屏東縣','澎湖縣','金門縣','連江縣'];
  const ages=['18 歲以下','19-25 歲','26-35 歲','36-45 歲','46-55 歲','56-65 歲','65-75 歲','75 歲以上'];
  let profile=CP.read('classPulseProfile',null), epoch=CP.read('classPulseEpoch',''), question=null, view='', busy=false, reading=false, revision=0;
  const confirmed=new Set();
  const notice=document.createElement('p');notice.id='connectionNotice';notice.setAttribute('role','status');$('question').after(notice);
  const refresh=document.createElement('button');refresh.className='button';refresh.textContent='立即更新題目';refresh.addEventListener('click',()=>load());notice.after(refresh);
  function options(values){return '<option value="">請選擇</option>'+values.map(x=>'<option>'+CP.esc(x)+'</option>').join('');}
  function showCheckin(){if(view==='checkin')return;view='checkin';$('success').style.display='none';$('question').style.display='block';$('question').innerHTML='<span class="eyebrow">CHECK-IN</span><h2>先完成課前報到</h2><p>資料僅供本次課程統計，可使用匿名名稱。</p><form id="checkinForm"><label>性別<select class="input" id="gender" required>'+options(['女性','男性','非二元／其他','不透露'])+'</select></label><label>年齡<select class="input" id="age" required>'+options(ages)+'</select></label><label>職業<input class="input" id="job" maxlength="60" required placeholder="例如：零售業／學生／服務業"></label><label>居住縣市<select class="input" id="city" required>'+options(cities)+'</select></label><button class="button" type="submit">完成報到 →</button><p id="sendStatus" role="status" aria-live="polite"></p></form>';$('checkinForm').addEventListener('submit',checkin);}
  function success(){view='sent:'+question.id;$('question').innerHTML='<div class="check">✓</div><h2 style="text-align:center">答案已送出</h2><p style="text-align:center" role="status">系統已成功記錄你的答案，請等待下一題開放。</p>';}
  function render(d){
    if(epoch&&epoch!==d.epoch){confirmed.clear();view='';profile=null;CP.save('classPulseProfile',null);$('name').value='';$('login').style.display='block';$('success').style.display='none';$('question').style.display='none';notice.textContent='課堂已重置，請重新輸入姓名並報到。';epoch=d.epoch;CP.save('classPulseEpoch',epoch);return;}
    epoch=d.epoch;CP.save('classPulseEpoch',epoch);question=d.activeQuestion;
    if(d.checkinRequired){showCheckin();return;}
    if(!question){view='waiting';$('question').style.display='none';$('success').style.display='block';$('status').textContent='請等待講師開放下一題';return;}
    $('success').style.display='none';$('question').style.display='block';
    if(d.submitted||confirmed.has(question.id)){confirmed.add(question.id);if(view!=='sent:'+question.id)success();return;}
    const signature=JSON.stringify(question);if(view===signature)return;view=signature;
    const fields=question.type==='open_text'?'<textarea class="input" id="answer" maxlength="500" required placeholder="輸入你的回答…"></textarea>':question.options.map((o,i)=>'<label class="answer-option" style="display:flex;gap:12px;padding:16px;border:1px solid #dce4f3;border-radius:12px;margin:10px 0"><input name="answer" type="'+(question.type==='multiple'?'checkbox':'radio')+'" value="'+i+'">'+CP.esc(o)+'</label>').join('');
    $('question').innerHTML='<span class="eyebrow">SLIDE '+CP.esc(question.page)+'</span><h2>'+CP.esc(question.question)+'</h2><form id="answerForm">'+fields+'<button class="button" type="submit">送出答案 →</button><p id="sendStatus" role="status" aria-live="polite"></p></form>';$('answerForm').addEventListener('submit',answer);
  }
  async function load(){if(!profile||busy||reading)return;reading=true;const r=revision;refresh.disabled=true;notice.textContent='正在更新…';try{const d=await CP.call('state',{participantId:profile.id});if(!busy&&r===revision){notice.textContent='已更新 · 每 60 秒同步題目';render(d);}}catch(e){notice.textContent=e.message;}finally{reading=false;refresh.disabled=false;}}
  async function send(form,api,payload,onSuccess){if(busy)return;busy=true;revision++;const controls=[...form.querySelectorAll('input,select,textarea,button')];controls.forEach(e=>e.disabled=true);const button=form.querySelector('button'),status=$('sendStatus');button.textContent='送出中…';status.textContent='傳輸中... 請稍候';try{const result=await CP.call(api,{participantId:profile.id,participantName:profile.name,epoch,...payload});onSuccess(result);}catch(e){status.textContent=e.message;button.textContent='重新送出／確認結果';controls.forEach(x=>x.disabled=false);}finally{busy=false;}}
  async function checkin(event){event.preventDefault();const p={gender:$('gender').value,age:$('age').value,job:$('job').value.trim(),city:$('city').value};await send(event.target,'checkin',{profile:p},()=>{view='';$('question').style.display='none';$('success').style.display='block';$('status').textContent='報到已完成';});if(view==='')load();}
  async function answer(event){event.preventDefault();let value;if(question.type==='open_text')value=$('answer').value.trim();else{const selected=[...event.target.querySelectorAll('input:checked')].map(e=>question.options[Number(e.value)]);value=question.type==='multiple'?selected:selected[0];}if(!value||(Array.isArray(value)&&!value.length)){$('sendStatus').textContent='請先選擇或輸入答案。';return;}const q=question;await send(event.target,'submit',{questionId:q.id,answer:value},()=>{confirmed.add(q.id);success();});}
  function start(){if(!profile)return;$('shown').textContent=profile.name;$('login').style.display='none';$('success').style.display='block';load();}
  window.join=()=>{const name=$('name').value.trim();if(!name){$('name').focus();return;}profile={name:name.slice(0,60),id:'p_'+crypto.randomUUID().replaceAll('-','')};CP.save('classPulseProfile',profile);view='';start();};
  $('name').addEventListener('keydown',e=>{if(e.key==='Enter')window.join();});
  window.addEventListener('load',start,{once:true});setInterval(()=>load(),60000);
})();
