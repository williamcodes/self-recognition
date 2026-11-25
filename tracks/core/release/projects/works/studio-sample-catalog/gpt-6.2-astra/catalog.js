'use strict';
const $ = s => document.querySelector(s);
const icons = {
  download:'M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5', plus:'M12 4v16M4 12h16',
  search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
  layers:'m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5',out:'M13 5h6v6m0-6-9 9M9 5H4v15h15v-5',
  drawer:'M3 6h18v13H3zM9 10h6',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list:'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1',close:'M5 5l14 14M19 5 5 19'
};
const icon = k => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="'+icons[k]+'"/></svg>';
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML=icon(el.dataset.icon));
const palette={Yellow:'#b08a43',Green:'#7c8c6c',Blue:'#526d83',Orange:'#ba7054',Neutral:'#b3a592',Pink:'#ab777c',Brown:'#86614e',Gray:'#797d78',Purple:'#816e86',Red:'#9b504d'};
const fabrics={'Linen':'linen','Bouclé':'boucle','Twill':'twill','Corduroy':'corduroy','Velvet':'velvet','Basketweave':'basketweave'};
const drawers=[...'ABCDEF'];
const seed=[
 ['A-001','Honey Flax','Yellow','Linen'],['B-006','Meadow Loop','Green','Bouclé','Elm House'],['C-014','Indigo Herringbone','Blue','Twill'],['D-003','Clay Rib','Orange','Corduroy'],
 ['E-008','Chalk Basket','Neutral','Basketweave'],['F-012','Dusty Rose','Pink','Velvet','Juniper Studio'],['A-009','Walnut Weave','Brown','Twill'],['B-011','Coastal Mist','Blue','Linen','', '#92a4a8'],
 ['C-002','Moss Cord','Green','Corduroy','','#586648'],['D-010','Ember Velvet','Red','Velvet','Alder House'],['E-015','Silver Flax','Gray','Linen'],['F-004','Plum Loop','Purple','Bouclé'],
 ['A-018','Oatmeal Loop','Neutral','Bouclé','','#c4b59c'],['B-002','Spruce Basket','Green','Basketweave','Pine Cottage','#4d6961'],['C-009','Slate Rib','Gray','Corduroy'],['D-017','Apricot Linen','Orange','Linen','','#ce9474'],
 ['E-001','Midnight Velvet','Blue','Velvet','','#384b62'],['F-020','Russet Twill','Brown','Twill','Birch Loft']
].map(([code,name,color,type,client='',shade=palette[color]])=>({code,name,color,type,drawer:code[0],client,shade}));
const key='selvedge-catalog-v1';
let records=[],view='all', layout='grid', draft=null, noticeTimer, writable=true;
function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function validate(rows){
  if(!Array.isArray(rows)||rows.some(r=>!r||!/^([A-F])-\d{3}$/.test(r.code)||typeof r.name!=='string'||!r.name.trim()||!Object.hasOwn(fabrics,r.type)||!Object.hasOwn(palette,r.color)||!drawers.includes(r.drawer)||typeof r.client!=='string'||!/^#[0-9a-f]{6}$/i.test(r.shade))||new Set(rows.map(r=>r.code)).size!==rows.length)throw Error('Invalid catalog data');
  return rows;
}
function read(){const s=localStorage.getItem(key);return s===null?seed:validate(JSON.parse(s));}
function announce(message,permanent=false){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').hidden=false;if(!permanent)noticeTimer=setTimeout(()=>$('#notice').hidden=true,4200);}
try{records=read();if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(records));}
catch{writable=false;announce('Local storage could not be opened. Check this browser’s storage settings before making changes.',true);}
function options(values,first){return (first?'<option value="">'+first+'</option>':'')+values.map(v=>'<option>'+escapeText(v)+'</option>').join('');}
$('#drawer').innerHTML=options(drawers,'All drawers');$('#color').innerHTML=options(Object.keys(palette).sort(),'All colors');$('#type').innerHTML=options(Object.keys(fabrics).sort(),'All fabrics');
function textile(r){return '<span class="cloth" style="--swatch:'+r.shade+';--texture:url(textures/'+fabrics[r.type]+'.png)"><span class="tag">'+r.code+'</span></span>';}
function badge(r){return '<span class="status '+(r.client?'out':'')+'">'+(r.client?'With client':'In studio')+'</span>';}
function render(){
 const query=$('#search').value.toLowerCase().trim().split(/\s+/);
 const visible=records.filter(r=>{
  const hay=[r.code,r.name,r.color,r.type,'Drawer '+r.drawer,r.client,r.client?'With client':'In studio'].join(' ').toLowerCase();
  return (view==='all'||r.client)&&['drawer','color','type'].every(f=>!$('#'+f).value||r[f]===$('#'+f).value)&&query.every(q=>hay.includes(q));
 });
 document.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',String(view===b.dataset.view));b.querySelector('small').textContent=b.dataset.view==='all'?records.length:records.filter(r=>r.client).length;});
 $('#count').textContent=visible.length+' sample'+(visible.length===1?'':'s');$('#cards').className=layout;
 $('#reset').hidden=!['search','drawer','color','type'].some(k=>$('#'+k).value);
 $('#empty').hidden=!!visible.length;
 $('#cards').innerHTML=visible.map(r=>'<button class="card" data-code="'+r.code+'">'+textile(r)+'<span class="info"><span class="name">'+escapeText(r.name)+'</span><span class="details"><i class="dot" style="--swatch:'+r.shade+'"></i>'+r.color+' · '+r.type+'</span><span class="card-foot"><span class="location">'+icon('drawer')+'Drawer '+r.drawer+'</span>'+badge(r)+'</span></span></button>').join('');
}
for(const id of ['drawer','color','type','search'])$('#'+id).oninput=render;
$('#reset').onclick=()=>{for(const k of ['search','drawer','type','color'])$('#'+k).value='';render();$('#search').focus();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
for(const mode of ['list','grid'])$('#'+mode).onclick=()=>{layout=mode;for(const m of ['list','grid'])$('#'+m).setAttribute('aria-pressed',String(m===mode));render();};
const dialog=$('#dialog'),body=$('#body');
let focusCode=null;
function show(title,html){dialog.setAttribute('aria-labelledby','dialog-title');body.innerHTML='<h2 id="dialog-title">'+escapeText(title)+'</h2>'+html;if(!dialog.open)dialog.showModal();}
$('#close').onclick=()=>dialog.close();
dialog.onclose=()=>{if(focusCode){(document.querySelector('[data-code="'+focusCode+'"]')||$('#search')).focus();focusCode=null;}};
function detail(r){
 draft={...r};focusCode=r.code;
 const fields=[['Color family',r.color],['Fabric type',r.type],['Location','Drawer '+r.drawer],['Status',r.client?'With client':'In studio']];
 if(r.client)fields.push(['Client',r.client]);
 show(r.name,'<div class="preview">'+textile(r)+'</div><dl>'+fields.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+escapeText(v)+'</dd></div>').join('')+'</dl><div class="dialog-actions"><button id="edit">Edit record</button><button id="loan" class="primary">'+(r.client?'Return to studio':'Check out')+'</button></div>');
 $('#edit').onclick=()=>edit(r);$('#loan').onclick=()=>{
  if(r.client){save({...r,client:''},'Returned to drawer '+r.drawer);return;}
  show('Check out '+r.code,'<form><label>Client or project<input name="client" required maxlength="100" autocomplete="off"></label><div class="dialog-actions"><button type="button" id="back">Back</button><button class="primary">Check out</button></div></form>');
  $('#back').onclick=()=>detail(r);const input=body.querySelector('input');input.focus();
  body.querySelector('form').onsubmit=e=>{e.preventDefault();if(trimRequired(input))save({...r,client:input.value.trim()},'Checked out '+r.code);};
 };
}
function trimRequired(el){el.setCustomValidity(el.value.trim()?'':'Enter a value.');el.oninput=()=>el.setCustomValidity('');return el.reportValidity();}
function edit(r){
 draft=r?{...r}:null;
 show(r?'Edit sample':'Add sample','<form><label>Sample name<input name="name" required maxlength="72"></label><div class="pair"><label>Sample code<input name="code" required placeholder="C-014" pattern="[A-Fa-f]-[0-9]{3}" title="Use a letter A–F, a hyphen, and three digits" maxlength="5"></label><label>Drawer<select name="drawer">'+options(drawers)+'</select></label></div><div class="pair"><label>Color family<select name="color">'+options(Object.keys(palette).sort())+'</select></label><label>Fabric type<select name="type">'+options(Object.keys(fabrics).sort())+'</select></label></div><label>Client or project (blank if in studio)<input name="client" maxlength="100"></label><div class="dialog-actions"><button type="button" id="cancel">Cancel</button><button class="primary">Save sample</button></div></form>');
 const form=body.querySelector('form'),els=form.elements;
 if(r)for(const k of ['name','code','drawer','color','type','client'])els[k].value=r[k];
 else els.code.onchange=()=>{if(/^[a-f]-\d{3}$/i.test(els.code.value))els.drawer.value=els.code.value[0].toUpperCase();};
 els.name.focus();$('#cancel').onclick=()=>r?detail(r):dialog.close();
 form.onsubmit=e=>{e.preventDefault();if(!trimRequired(els.name))return;const next=Object.fromEntries(new FormData(form));next.code=next.code.toUpperCase();next.name=next.name.trim();next.client=next.client.trim();next.shade=r&&next.color===r.color?r.shade:palette[next.color];save(next,'Saved '+next.code);};
}
function formError(msg){let el=body.querySelector('[role=alert]');if(!el){el=document.createElement('p');el.setAttribute('role','alert');body.append(el);}el.textContent=msg;}
function save(next,message){
 if(!writable)return formError('Browser storage is unavailable.');
 try{
  const current=read(),index=draft?current.findIndex(r=>r.code===draft.code):-1;
  if(draft&&(index<0||JSON.stringify(current[index])!==JSON.stringify(draft))){records=current;render();return formError('This record changed in another tab. Close and reopen it to continue.');}
  if(current.some((r,i)=>i!==index&&r.code===next.code))return formError('That sample code is already in the catalog. Choose another code.');
  const updated=current.slice();if(index<0)updated.push(next);else updated[index]=next;
  localStorage.setItem(key,JSON.stringify(validate(updated)));records=updated;focusCode=next.code;render();dialog.close();announce(message);
 }catch{formError('Could not save. Check available browser storage and try again.');}
}
$('#cards').onclick=e=>{const b=e.target.closest('[data-code]');if(b)detail(records.find(r=>r.code===b.dataset.code));};
$('#add').onclick=()=>edit(null);$('#add').disabled=!writable;
window.addEventListener('storage',e=>{if(e.key===key||e.key===null){try{records=read();render();}catch{announce('Could not read the latest catalog changes.',true);}}});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||dialog.open||e.target.matches('input,select,textarea'))return;if(e.key==='/'){e.preventDefault();$('#search').focus();}if(e.key.toLowerCase()==='n'&&writable){e.preventDefault();edit(null);}});
$('#search').onkeydown=e=>{if(e.key==='Enter'&&$('#cards .card')){e.preventDefault();$('#cards .card').click();}if(e.key==='ArrowDown'){$('#cards .card')?.focus();e.preventDefault();}};
$('#export').onclick=()=>{
 const rows=[['Sample code','Sample name','Color family','Fabric type','Drawer','Checkout status','Client or project'],...records.map(r=>[r.code,r.name,r.color,r.type,r.drawer,r.client?'With client':'In studio',r.client])];
 const quote=s=>'"'+(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='selvedge-catalog-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);announce('Exported '+records.length+' samples');
};
render();
