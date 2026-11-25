// Small botanical studies drawn in local coordinates so the sheets scale for any display.
function drawStudy(canvas, variety) {
  const kind = /calendula/i.test(variety) ? 'flower' : /pea/i.test(variety) ? 'pea' : /bean/i.test(variety) ? 'bean' : 'leaf';
  const colors = {flower:['#eed4af','#744a32','#df9251'],pea:['#dae0b7','#4b6139','#a6b87c'],bean:['#d5dfd4','#3c5950','#8ea998'],leaf:['#dedec5','#526449','#a6b395']}[kind];
  const w=canvas.clientWidth||340,h=canvas.clientHeight||140,d=Math.min(devicePixelRatio||1,2);
  canvas.width=w*d;canvas.height=h*d;
  const c=canvas.getContext('2d');c.scale(d,d);c.fillStyle=colors[0];c.fillRect(0,0,w,h);
  let seed=173;function random(){seed=seed*16807%2147483647;return seed/2147483647}
  c.fillStyle=colors[1];c.globalAlpha=.15;
  for(let i=0;i<w*h/13;i++)c.fillRect(random()*w,random()*h,random()*1.8+.3,.6);
  c.globalAlpha=1;c.translate(w*.53,h*.54);let s=Math.min(w/290,h/128);c.scale(s,s);c.lineWidth=1.15;c.strokeStyle=colors[1];c.lineCap='round';
  function line(path){c.stroke(new Path2D(path))}
  function shape(path,fill){let p=new Path2D(path);c.fillStyle=fill;c.fill(p);c.stroke(p)}
  function leaf(x,y,length,width,angle){
    c.save();c.translate(x,y);c.rotate(angle);c.scale(length/60,width/15);
    shape('M0 0 Q22 -24 60 0 Q25 22 0 0Z',colors[2]);line('M0 0 Q28 -2 59 0');
    for(let i=8;i<=46;i+=6){let v=10*Math.sin(i*Math.PI/60);line('M'+i+' 0 q4 -1 9 -'+v+' M'+i+' 0 q4 1 9 '+v)}
    c.restore();
  }
  if(kind==='flower'){
    line('M-73 76 Q-38 26 17 -20 M-34 33 Q-42 15 -58 -5 M-17 17 Q23 19 49 6 M-50 51 Q-50 28 -64 19');
    leaf(-30,28,48,11,-2.4);leaf(-16,18,55,11,.12);leaf(-49,52,42,10,-2.05);
    function bloom(x,y,r){c.save();c.translate(x,y);
      for(let ring=0;ring<2;ring++)for(let i=0;i<24;i++){c.save();c.rotate(i*Math.PI/12+ring*.13);let l=r*(ring?.72:1)*(.9+random()*.18);shape('M0 0 Q-9 -'+l*.7+' -2 -'+l+' Q6 -'+(l+5)+' 6 -'+l*.78+' Q5 -'+l*.4+' 0 0Z',ring?'#e9ae65':'#e4a060');line('M1 -6 Q2 -'+l*.54+' 1 -'+l*.9);c.restore()}
      c.fillStyle='#845730';c.beginPath();c.arc(0,0,r*.22,0,7);c.fill();c.fillStyle='#e5b975';for(let i=0;i<55;i++){let a=random()*7,rr=Math.sqrt(random())*r*.21;c.fillRect(Math.cos(a)*rr,Math.sin(a)*rr,1,1)}c.restore()}
    bloom(20,-18,41);bloom(-59,-10,20);
  } else {
    line('M-100 58 Q-45 34 -19 12 Q17 -13 67 -48 M-49 33 Q-58 17 -60 0 M-17 10 Q-5 23 10 29 M15 -10 Q19 -30 17 -42 M42 -31 Q58 -23 76 -22');
    leaf(-50,30,49,20,-2.12);leaf(-21,13,54,22,.4);leaf(16,-12,42,18,-1.57);leaf(37,-27,47,18,.08);
    if(kind==='pea'||kind==='bean'){
      function pod(x,y,a,k){c.save();c.translate(x,y);c.rotate(a);c.scale(k,k);
        shape('M0 0 Q11 -9 28 -5 Q56 -3 78 7 Q87 11 93 9 Q81 19 67 20 Q31 19 7 6Z',colors[2]);line('M3 1 Q45 15 87 12');
        for(let i=0;i<6;i++){let px=13+i*10,py=2+i*1.5;c.beginPath();c.ellipse(px,py,5.1,4,0,Math.PI,2*Math.PI);c.stroke()}
        c.restore()}
      pod(-40,27,kind==='pea'?.31:.72,.93);pod(35,-28,.87,.88);
    }
    line('M63 -45 C79 -53 92 -52 91 -41 C90 -32 77 -34 81 -42 Q84 -47 86 -42 M-60 5 C-69 -10 -76 -12 -80 -7 Q-84 0 -78 0');
  }
}
