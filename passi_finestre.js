module.exports = [
 { js: `(() => {
  const W = innerWidth, colC = W >= 700 ? W / 2 : null, tabs = document.getElementById('gTabs').getBoundingClientRect();
  const out = [];
  const all = [...document.querySelectorAll('.sheet, [role=dialog]')].map(e => e.classList.contains('sheet') ? e : e.closest('.sheet') || e).filter((e, i, a) => a.indexOf(e) === i);
  for (const s of all) {
    const was = s.hidden; s.hidden = false; const st = s.getAttribute('style'); 
    const inner = s.classList.contains('sheet') ? (s.querySelector(':scope > .sheet-in') || s.firstElementChild) : s;
    const r = inner ? inner.getBoundingClientRect() : s.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    if (r.width) {
      const c = (r.left + r.right) / 2, probs = [];
      if (colC && Math.abs(c - colC) > 4) probs.push('decentrata di ' + Math.round(c - colC));
      if (r.right > tabs.left + 1 && r.left < tabs.right) probs.push('sotto i segnalibri');
      const tb = document.querySelector('#gTabs button').getBoundingClientRect(); const e = document.elementFromPoint(tb.left + tb.width / 2, tb.top + tb.height / 2);
      if (!document.getElementById('gTabs').contains(e)) probs.push('segnalibri coperti da ' + (e && (e.id || e.className)));
      if (probs.length) out.push((s.id || s.className) + ': ' + probs.join(', ') + ' [' + Math.round(r.left) + '-' + Math.round(r.right) + ']');
      else out.push('ok ' + (s.id || s.className));
    } else out.push('vuota ' + (s.id || s.className));
    s.hidden = was;
  }
  return out.join('\\n');
 })()` }
];
