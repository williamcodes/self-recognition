// A screen-print still life drawn entirely on the local canvas.
(() => {
  const ctx = document.querySelector('#pottery').getContext('2d');
  ctx.scale(2, 2);
  let seed = 29;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function ellipse(x,y,rx,ry,color,angle=0) {
    ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2); ctx.fill();
  }
  function pot(path,base,decorate) {
    ctx.save(); ctx.clip(new Path2D(path)); ctx.fillStyle=base; ctx.fillRect(0,0,400,205);
    decorate();
    for(let i=0;i<16000;i++) {
      ctx.fillStyle=random()>.5?'#fff5d941':'#311e1628';
      ctx.fillRect(random()*400,random()*205,random()*1.3+.4,random()*1.3+.4);
    }
    ctx.restore();
  }
  function line(path,color,width) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(new Path2D(path));}
  ellipse(236,178,146,10,'#c8c9b5');
  // Olive branches, tucked into the narrow-necked ochre vessel.
  for(const [x,y,lean] of [[280,14,-1],[332,9,1],[350,42,1]]) {
    line('M306 102 Q305 62 '+x+' '+y,'#535d45',1.8);
    for(let j=1;j<=5;j++) {
      const t=j/6, px=306+(x-306)*t*t, py=100+(y-100)*t;
      ellipse(px-6,py-3,9,3,'#657153',.55);
      ellipse(px+5,py-7,9,3,'#77815f',-.92);
    }
  }
  pot('M290 85 Q306 82 321 85 L319 106 C321 118 348 118 344 146 Q342 171 322 175 L292 176 Q270 168 272 143 Q272 126 290 116 Q297 111 290 85Z','#bd703f',()=>{
    for(let x=275;x<350;x+=7) line('M'+x+' 113 q-8 29 1 63','#a65e36',1.3);
  });
  pot('M174 37 Q195 32 218 37 L213 59 C216 78 256 80 253 117 Q251 151 231 166 Q205 175 173 166 Q152 151 149 118 C144 81 177 81 180 60Z','#ac583c',()=>{
    for(let y=64;y<178;y+=5) line('M143 '+y+' Q202 '+(y+13)+' 257 '+(y-1),'#e5ac84',.8);
  });
  ellipse(196,37,22,3.5,'#793e30');
  pot('M85 134 Q138 125 198 136 Q192 163 160 174 L156 180 Q142 183 126 179 L123 174 Q93 164 85 134Z','#5b7161',()=>{
    for(let x=78;x<200;x+=9) line('M'+x+' 131 q1 18 11 39','#d8dfc8',2.7);
  });
  ellipse(141,135,56,6,'#364e43');ellipse(141,134,54,3,'#879282');
  pot('M213 139 Q245 135 275 140 L270 174 Q261 182 226 180 Q216 175 213 139Z','#e4c697',()=>{
    for(let i=0;i<180;i++) ellipse(214+random()*62,140+random()*42,.75,.6,'#876c4c');
  });
  line('M273 146 C296 136 293 166 271 166','#c4a170',5);
  ellipse(244,139,31,4,'#876847');ellipse(244,138,29,2,'#a68960');
})();
