const el = (selector) => document.querySelector(selector);
const menu = el('#menu'), story = el('#story'), player = el('audio');
const time = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
let ticket;
function finish() {
  player.pause();
  player.removeAttribute('src');
  player.load();
  story.hidden = true;
  menu.hidden = false;
  ticket.focus();
  window.scrollTo(0, 0);
}
function openInterview(item, button) {
  ticket = button;
  el('#number').textContent = item.id;
  el('#title').textContent = item.title;
  el('#role').textContent = item.role + ' · ' + time(item.duration);
  el('#tease').textContent = item.tease;
  el('#status').textContent = '';
  el('details').open = false;
  el('dl').textContent = '';
  item.lines.forEach((line, i) => {
    const who = document.createElement('dt'), speech = document.createElement('dd');
    who.textContent = i % 2 ? item.role : 'Interviewer';
    speech.textContent = line;
    el('dl').append(who, speech);
  });
  player.src = 'audio/' + item.id + '.mp3';
  menu.hidden = true;
  story.hidden = false;
  el('#title').focus();
  window.scrollTo(0, 0);
}
for (const item of interviews) {
  const button = document.createElement('button');
  button.className = 'ticket';
  button.innerHTML = '<span class="num"></span><span class="copy"><strong></strong><small></small><span class="meta"></span></span>';
  button.querySelector('.num').textContent = item.id;
  button.querySelector('strong').textContent = item.title;
  button.querySelector('small').textContent = item.tease;
  button.querySelector('.meta').textContent = item.role + ' · ' + time(item.duration);
  button.onclick = () => openInterview(item, button);
  el('#tickets').append(button);
}
el('#back').onclick = finish;
player.onended = () => { el('#status').textContent = 'Interview finished. If someone is waiting, select All topics and offer your seat.'; };
player.onplay = () => { el('#status').textContent = ''; };
player.onerror = () => { if (player.hasAttribute('src')) el('#status').textContent = 'Audio unavailable. Open Read the interview below.'; };
