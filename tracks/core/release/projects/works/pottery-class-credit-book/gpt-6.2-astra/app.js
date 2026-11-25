'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=$('#dialog');
let db,state,view=null,working=false,timer;
const dateText=(w,options)=>new Date(w.date+'T12:00:00').toLocaleDateString('en-US',options);
const fullDate=w=>dateText(w,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
const button=(label,action,attrs='',cls='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const person='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4 21v-2c0-7.5 16-7.5 16 0v2"/></svg>';
function report(msg){
  if(dialog.open){$('#status').textContent=msg;return;}
  clearTimeout(timer);$('#notice').textContent=msg;timer=setTimeout(()=>$('#notice').textContent='',6000);
}
// Each edit reads the latest snapshot under the same IndexedDB write transaction.
function access(edit){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('register',edit?'readwrite':'readonly');
    const table=tx.objectStore('register'),request=table.get('studio');
    let next,error;
    request.onsuccess=()=>{
      try {next=request.result||Ledger.initial();if(edit){edit(next);table.put(next,'studio');}}
      catch(e){error=e;tx.abort();}
    };
    tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(error||tx.error||new Error('Could not save this change.'));
  });
}
function render(){
  $('#summary').innerHTML=`<span><b>${state.workshops.length}</b> workshops</span><span><b>${state.students.length}</b> students</span>`;
  $('#workshops').innerHTML=state.workshops.map((w,i)=>{
    const used=w.bookings.length;
    return `<article class="workshop"><div class="top"><div class="tile ${i%2?'sage':''}"><span class="day">${dateText(w,{weekday:'short'})}</span><time>${w.time}</time></div><div><h3>${esc(w.title)}</h3><div class="sub">${fullDate(w)}</div></div></div><div class="bottom"><div><div class="seats" aria-hidden="true">${Array.from({length:8},(_,n)=>'<b class="'+(n<used?'used':'')+'"></b>').join('')}</div><div class="sub">${used} of 8 seats booked</div></div>${button('Open register &nbsp; →','roster','data-id="'+w.id+'"','open')}</div></article>`;
  }).join('');
  $('#students').innerHTML=state.students.map(s=>{
    const n=Ledger.balance(s);
    return button(`<span class="avatar">${person}</span><strong>${esc(s.code)}</strong><span class="amount"><b>${n}</b> ${n===1?'credit':'credits'}</span><span class="arrow">›</span>`,'history','data-code="'+esc(s.code)+'"','student');
  }).join('');
}
function show(kind,id='',code=''){
  view={kind,id,code};
  const w=state.workshops.find(x=>x.id===id),s=state.students.find(x=>x.code===code);
  let title='',html='';
  const submit=label=>`<button class="primary">${label}</button>`;
  if(kind==='new'){
    title='Add workshop';
    html='<form data-op="addWorkshop"><label>Workshop name<input name="title" maxlength="80" required></label><label>Date<input type="date" name="date" required></label><label>Start time<input type="time" name="time" required></label><p class="sub">Each workshop has eight seats.</p>'+submit('Add workshop')+'</form>';
  }else if(kind==='student'){
    title='Add student';
    html='<form data-op="addStudent"><label>Student code<input name="code" maxlength="12" pattern="[A-Za-z0-9\\-]{1,12}" required></label><label>Opening credits<input type="number" name="amount" min="0" max="9999" value="0" required></label>'+submit('Add student')+'</form>';
  }else if(kind==='roster'){
    title=w.title;
    const available=state.students.filter(x=>!w.bookings.some(b=>b.code===x.code));
    html=`<div class="sub">${fullDate(w)} · ${w.time}</div><h3>Attendance register</h3><div class="smallcap">${w.bookings.length} of 8 seats booked</div>`;
    if(!w.bookings.length)html+='<p class="sub">No reservations yet.</p>';
    html+=w.bookings.map(b=>{
      const attr='data-code="'+esc(b.code)+'"';
      return `<div class="row"><div><strong>${esc(b.code)}</strong><span class="badge">${b.status}</span></div><div class="actions">${b.status==='Reserved'?button('Mark attended','attend',attr)+button('Cancel seat','cancel',attr):button('Correct attendance','correction',attr)}</div></div>`;
    }).join('');
    html+='<h3>Reserve a seat</h3>';
    if(w.bookings.length===8)html+='<p>Workshop full.</p>';
    else if(!available.length)html+='<p class="sub">All registered students already hold a seat.</p>';
    else html+=`<form data-op="reserve"><label>Student<select name="code" required><option value="">Choose a student</option>${available.map(s=>`<option value="${s.code}">${s.code} · ${Ledger.balance(s)} credits</option>`).join('')}</select></label><p class="sub">Marking attendance uses one credit. Reserving holds the seat.</p>${submit('Reserve seat')}</form>`;
  }else if(kind==='correction'){
    title='Correct attendance';
    html=`<p>Return ${esc(code)} to reserved and restore one credit for ${esc(w.title)}.</p><form data-op="correct"><label>Reason for adjustment<input name="reason" maxlength="160" required></label>${submit('Restore credit')}</form>`;
  }else if(kind==='history'){
    title=code+' · Balance history';
    let running=0;
    html=`<p><b>${Ledger.balance(s)}</b> available credits</p>`+s.history.map(e=>{
      running+=e.delta;
      return `<div class="row"><div><strong>${esc(e.label)}</strong><div class="sub">${esc(e.detail)}</div><div class="sub">${new Date(e.at).toLocaleString()}</div></div><div><b>${e.delta>=0?'+':''}${e.delta}</b><div class="sub">Balance ${running}</div></div></div>`;
    }).reverse().join('')+'<h3>Add prepaid credits</h3><form data-op="topup"><label>Credits purchased<input type="number" name="amount" min="1" max="9999" required></label>'+submit('Add credits')+'</form>';
  }
  $('#dialog-title').textContent=title;$('#dialog-content').innerHTML=html+'<p id="status" role="status"></p>';
  dialog.setAttribute('aria-labelledby','dialog-title');if(!dialog.open)dialog.showModal();
}
async function apply(op,data){
  if(working)return;
  working=true;
  try{
    state=await access(next=>Ledger.change(next,op,data));render();
    if(op==='addWorkshop'||op==='addStudent'){dialog.close();report(op==='addWorkshop'?'Workshop added.':'Student added.');}
    else {
      if(op==='topup')show('history','',data.code);else show('roster',data.id);
      report(({topup:'Prepaid credits added.',reserve:'Seat reserved.',attend:'Attendance recorded. One credit used.',cancel:'Reservation cancelled. Seat released.',correct:'Attendance adjusted. One credit restored.'})[op]);
    }
  }catch(e){report(e.message);}
  finally{working=false;}
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-action]');if(!btn||working)return;
  const {action,id,code}=btn.dataset;
  if(action==='close'){dialog.close();return;}
  if(!state){report('Studio storage is unavailable. Allow local browser storage and reload.');return;}
  if(action==='attend'||action==='cancel')apply(action,{id:view.id,code});
  else if(action==='correction')show(action,view.id,code);
  else show(action,id,code);
});
document.addEventListener('submit',e=>{
  e.preventDefault();const data={...view,...Object.fromEntries(new FormData(e.target))};
  if('amount' in data)data.amount=Number(data.amount);
  if(data.code)data.code=data.code.trim().toUpperCase();
  apply(e.target.dataset.op,data);
});
dialog.addEventListener('close',()=>{view=null;});
async function start(){
  try{
    db=await new Promise((resolve,reject)=>{
      const open=indexedDB.open('kilnbook-studio-v1',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('register');
      open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
    });
    state=await access(()=>{});render();
    window.addEventListener('focus',async()=>{if(!working){try{state=await access();render();}catch(e){report(e.message);}}});
  }catch(e){$('#notice').textContent='Studio storage is unavailable. Allow local browser storage and reload.';}
}
start();
