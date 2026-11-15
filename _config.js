// Percorsi comuni delle prove. Si possono cambiare con variabili d'ambiente:
//   APP_DIR    cartella con i file dell'app da provare (predefinita: ../next-libris, il ramo main estratto accanto)
//   PROVE_OUT  dove finiscono schermate, PDF e file di prova (predefinita: <tmp>/next-libris-prove)
//   CHROME     percorso di Chrome o Chromium
//   PROVE_SLOT  0, 1, … sposta le porte (lo imposta esegui.js quando fa girare piu' prove insieme)
const path = require('path'), fs = require('fs'), os = require('os');
const APP = path.resolve(process.env.APP_DIR || path.join(__dirname, '..', 'next-libris'));   // ramo main accanto a questo
const IMG = path.join(__dirname, 'img');
const OUT = path.resolve(process.env.PROVE_OUT || path.join(os.tmpdir(), 'next-libris-prove'));
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
// Porte: ogni prova ha la sua; quando girano due prove insieme (esegui.js) la seconda usa le porte spostate di 1000 (PROVE_SLOT=1)
const SLOT = Number(process.env.PROVE_SLOT || 0);
const port = (n) => n + SLOT * 1000;
module.exports = { APP, IMG, OUT, CHROME, port, SLOT };
