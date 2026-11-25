'use strict';

const icons = {
  cupboard: 'M3 3h18v16H3z M12 3v16 M3 19v2m18-2v2 M9 10v3m6-3v3',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  loan: 'M4 9h16v12H4z M3 4h18v5H3z M9 13h6',
  calendar: 'M4 6h16v15H4z M8 3v6m8-6v6 M4 11h16 M8 15h2m4 0h2m-8 3h2',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm-2 5 6 6',
  print: 'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v7H6z M7 11h1',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
};

function paintArt(root) {
  for (const canvas of root.querySelectorAll('canvas[data-icon], canvas[data-art]')) {
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.dataset.painted && canvas.dataset.painted === getComputedStyle(canvas).color) continue;
    canvas.width = Math.round((canvas.dataset.width || width) * ratio);
    canvas.height = Math.round((canvas.dataset.height || height) * ratio);
    canvas.dataset.width ||= width;
    canvas.dataset.height ||= height;
    canvas.dataset.painted = getComputedStyle(canvas).color;
    context.scale(ratio, ratio);
    context.strokeStyle = canvas.dataset.painted;
    context.fillStyle = context.strokeStyle;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (canvas.dataset.icon) {
      const size = Number(canvas.dataset.width);
      context.scale(size / 24, size / 24);
      context.lineWidth = 1.65;
      context.stroke(new Path2D(icons[canvas.dataset.icon]));
      continue;
    }
    const type = canvas.dataset.art;
    if (type === 'shelf') {
      context.lineWidth = 1.4;
      context.stroke(new Path2D('M78 199H340 M111 191V36h151v155 M107 36h159v-9H107z M111 111h151 M111 184h151 M123 184v16m126-16v16 M124 170h125 M280 196l30-36m-16 36 29-36m-43 36h41m-11-36h22m-30 17h24 M95 202v-54m0 26c-28 1-35-12-34-24 19 0 32 12 34 24zm0-11c1-20 14-31 27-32-1 15-10 26-27 32z M89 192h12l-2 10H91z'));
      context.save();
      context.translate(135, 59);
      context.scale(.9, .9);
      gear(context, 'projector');
      context.restore();
      context.save();
      context.translate(135, 130);
      context.scale(.82, .82);
      gear(context, 'cords');
      context.restore();
      context.save();
      context.translate(197, 129);
      context.scale(.9, .9);
      gear(context, 'table');
      context.restore();
    } else {
      context.lineWidth = 1.65;
      gear(context, type);
    }
  }
}

function gear(context, type) {
  const paths = {
    table: 'M8 20h45l7 9H3z M4 29v4h55v-4 M15 33l-6 15m38-15 6 15 M19 33l-3 8h30m-3-8 3 8 M9 48h5m34 0h5 M12 24h36',
    projector: 'M8 19h45a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V24a5 5 0 0 1 5-5z M11 43v4m39-4v4 M15 24a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M30 27h18m-18 5h18m-18 5h11',
    cords: 'M45 41c-4 6-13 8-22 6C9 45 4 34 7 24c3-10 13-14 23-12 12 2 17 11 15 20-2 8-10 11-19 10-8-1-13-6-12-13 1-7 8-11 15-10 7 1 11 6 10 11s-6 8-12 7c-4-1-7-4-6-8 1-3 4-5 8-4 3 0 5 3 3 6 M45 41l5-5 M50 36l-3-4 8-6 5 6-8 6z M56 27l4-4m-1 8 4-3',
  };
  context.stroke(new Path2D(paths[type]));
}
