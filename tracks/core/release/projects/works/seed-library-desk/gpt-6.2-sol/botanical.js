(() => {
  const canvas = document.querySelector('#botanical');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(2, 2);

  function stroke(color, width, draw) {
    ctx.beginPath();
    draw(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function leaf(x, y, angle, size, width, wash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * .19, -width, size * .68, -width * 1.19, size, -width * .24);
    ctx.bezierCurveTo(size * .74, width * .58, size * .27, width * .9, 0, 0);
    ctx.fillStyle = wash;
    ctx.fill();
    ctx.strokeStyle = '#587953';
    ctx.lineWidth = .85;
    ctx.stroke();
    stroke('#567451', .65, p => {
      p.moveTo(0, 0);
      p.quadraticCurveTo(size * .46, -width * .13, size, -width * .24);
      for (let n = .22; n < .83; n += .105) {
        p.moveTo(size * n, -width * .13);
        p.quadraticCurveTo(size * (n + .06), -width * .35, size * (n + .15), -width * (.7 - Math.abs(n - .46)));
        p.moveTo(size * n, -width * .13);
        p.quadraticCurveTo(size * (n + .07), width * .23, size * (n + .15), width * (.41 - Math.abs(n - .46) * .55));
      }
    });
    ctx.restore();
  }

  function flower(x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    for (let n = 0; n < 13; n++) {
      ctx.rotate(Math.PI * 2 / 13);
      ctx.beginPath();
      ctx.moveTo(r * .22, 0);
      ctx.bezierCurveTo(r * .59, -r * .20, r, -r * .18, r, 0);
      ctx.bezierCurveTo(r, r * .18, r * .62, r * .21, r * .22, 0);
      ctx.fillStyle = n % 2 ? '#dcbd76' : '#e6cf92';
      ctx.fill();
      ctx.strokeStyle = '#a27c41';
      ctx.lineWidth = .65;
      ctx.stroke();
      stroke('#b48d4f', .55, p => {
        p.moveTo(r * .31, 0);
        p.quadraticCurveTo(r * .7, -.05 * r, r * .94, 0);
      });
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * .29, 0, Math.PI * 2);
    ctx.fillStyle = '#a17b42';
    ctx.fill();
    for (let n = 0; n < 21; n++) {
      const a = n * 2.39996;
      const d = Math.sqrt(n / 21) * r * .24;
      ctx.fillStyle = n % 2 ? '#ead5a0' : '#775f38';
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.3, 1.3);
    }
    ctx.restore();
  }

  function peaPod(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(22, -23, 67, -22, 112, -2);
    ctx.bezierCurveTo(94, 3, 82, 16, 59, 19);
    ctx.bezierCurveTo(32, 23, 12, 14, 0, 0);
    const fill = ctx.createLinearGradient(0, -20, 0, 20);
    fill.addColorStop(0, '#b7c89c');
    fill.addColorStop(1, '#86a276');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#587851';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    for (let n = 0; n < 5; n++) {
      const cx = 21 + n * 16;
      const cy = n < 3 ? 3 : 3 - (n - 2) * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 8 - n * .4, 9 - n * .7, -.2, -.6, 2.75);
      ctx.strokeStyle = '#64845a';
      ctx.lineWidth = .65;
      ctx.stroke();
      stroke('#698760', .45, p => {
        for (let k = 0; k < 5; k++) {
          p.moveTo(cx - 7 + k * 2.5, cy + 6);
          p.lineTo(cx - 3 + k * 2.8, cy + 11 - n * .62);
        }
      });
    }
    stroke('#57774f', .9, p => {
      p.moveTo(-13, -5);
      p.quadraticCurveTo(1, 0, 11, 3);
      p.bezierCurveTo(39, 15, 81, 10, 112, -2);
    });
    ctx.restore();
  }

  // The curves follow a loose botanical plate, with engraved veins and seed pods.
  stroke('#5b7852', 1.4, p => {
    p.moveTo(159, 225); p.bezierCurveTo(219, 136, 327, 113, 384, 43);
    p.moveTo(185, 205); p.bezierCurveTo(279, 185, 337, 184, 436, 140);
    p.moveTo(268, 145); p.bezierCurveTo(263, 114, 260, 72, 285, 39);
    p.moveTo(328, 102); p.bezierCurveTo(366, 111, 408, 86, 423, 61);
    p.moveTo(297, 126); p.bezierCurveTo(310, 111, 311, 96, 323, 77);
    p.moveTo(235, 169); p.bezierCurveTo(208, 166, 198, 144, 208, 131);
    p.bezierCurveTo(218, 118, 233, 133, 221, 140);
    p.bezierCurveTo(215, 144, 211, 138, 217, 135);
    p.moveTo(384, 43); p.bezierCurveTo(392, 22, 411, 26, 411, 34);
    p.bezierCurveTo(411, 43, 397, 44, 400, 35);
    p.moveTo(360, 168); p.bezierCurveTo(392, 175, 425, 184, 464, 166);
    p.moveTo(409, 150); p.bezierCurveTo(417, 120, 439, 102, 462, 91);
  });

  leaf(207, 180, -2.88, 90, 19, '#b8cbaa');
  leaf(229, 170, -1.68, 65, 17, '#a6bc97');
  leaf(264, 145, .43, 87, 22, '#a8c09c');
  leaf(276, 75, -2.41, 54, 13, '#c2d2b2');
  leaf(270, 105, -2.8, 77, 19, '#b4c9a7');
  leaf(313, 115, -.09, 62, 14, '#c3d1ad');
  leaf(355, 77, -1.85, 67, 15, '#b5caa6');
  leaf(373, 61, -.18, 83, 16, '#9fb996');
  leaf(351, 109, .35, 57, 12, '#bdcfac');
  leaf(407, 81, -.13, 59, 12, '#c1d0af');
  leaf(322, 180, -.96, 48, 11, '#bccfad');
  leaf(369, 165, -1.04, 44, 9, '#a8bf9b');
  leaf(401, 174, .72, 45, 10, '#b9cba9');
  leaf(441, 106, -.08, 50, 9, '#b2c6a5');
  peaPod(321, 80, -1.02);
  peaPod(242, 177, .23);

  flower(285, 38, 22, .2);
  flower(425, 58, 16, -.14);
  flower(465, 91, 19, .45);
  flower(464, 165, 13, -.2);

  let seed = 203;
  for (let n = 0; n < 2700; n++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const x = seed / 4294967296 * 530;
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const y = seed / 4294967296 * 210;
    ctx.fillStyle = n % 2 ? '#3b533311' : '#ffffff3a';
    ctx.fillRect(x, y, .58, .58);
  }
})();
