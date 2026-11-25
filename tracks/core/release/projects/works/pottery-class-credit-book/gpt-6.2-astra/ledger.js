const Ledger = (() => {
  const capacity = 8;
  function localDate(d) {
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  function nextDay(day,time) {
    const d=new Date(), now=new Date();
    d.setDate(d.getDate()+(day-d.getDay()+7)%7);
    d.setHours(...time.split(':').map(Number),0,0);
    if(d<now) d.setDate(d.getDate()+7);
    return localDate(d);
  }
  function entry(label,delta,detail='') { return {label,delta,detail,at:new Date().toISOString()}; }
  function initial() {
    return {students:[4,2,1].map((n,i)=>({code:'P0'+(i+1),history:[entry('Opening balance',n)]})),
      workshops:[['Tuesday Handbuilding',2,'18:00'],['Saturday Glazing',6,'10:00']].map(([title,day,time],i)=>({id:'w'+i,title,date:nextDay(day,time),time,bookings:[]}))};
  }
  const balance=s=>s.history.reduce((sum,e)=>sum+e.delta,0);
  function requireThat(ok,msg){if(!ok) throw new Error(msg);}
  function change(state,action,data) {
    const {code,id,title,date,time,amount,reason}=data;
    const s=state.students.find(x=>x.code===code);
    if(action==='addWorkshop'){
      requireThat(title?.trim() && title.length<=80 && /^\d{4}-\d\d-\d\d$/.test(date) && localDate(new Date(date+'T12:00:00'))===date && /^([01]\d|2[0-3]):[0-5]\d$/.test(time),'Enter a workshop name, date and time.');
      state.workshops.push({id:crypto.randomUUID(),title:title.trim(),date,time,bookings:[]});return;
    }
    if(action==='addStudent'){
      requireThat(/^[A-Z0-9-]{1,12}$/.test(code) && !s,'Enter a unique student code using letters, numbers or hyphens.');
      requireThat(Number.isSafeInteger(amount)&&amount>=0&&amount<=9999,'Enter 0–9999 opening credits.');
      state.students.push({code,history:[entry('Opening balance',amount)]});return;
    }
    requireThat(s,'Choose a student.');
    if(action==='topup'){
      requireThat(Number.isSafeInteger(amount)&&amount>0&&amount<=9999,'Enter 1–9999 credits.');
      s.history.push(entry('Prepaid credits added',amount));return;
    }
    const w=state.workshops.find(x=>x.id===id);
    requireThat(w,'Choose a workshop.');
    const b=w.bookings.find(x=>x.code===code);
    const detail=w.title+' · '+w.date+' '+w.time;
    if(action==='reserve'){
      requireThat(!b,'This student already holds a seat.');
      requireThat(w.bookings.length<capacity,'All eight seats are taken.');
      w.bookings.push({code,status:'Reserved'});return;
    }
    requireThat(b,'This reservation has changed. Reopen the register.');
    if(action==='correct'){
      requireThat(b.status==='Attended','Attendance has already been corrected.');
      requireThat(reason?.trim(),'Give a reason for the correction.');
      b.status='Reserved';s.history.push(entry('Attendance adjustment',1,detail+' · '+reason.trim()));return;
    }
    requireThat(b.status==='Reserved','Only a reservation can be marked or cancelled.');
    if(action==='cancel'){w.bookings.splice(w.bookings.indexOf(b),1);return;}
    requireThat(action==='attend' && balance(s)>0,'Attendance requires one available credit.');
    b.status='Attended';s.history.push(entry('Attendance',-1,detail));
  }
  return {initial,balance,change,capacity};
})();
