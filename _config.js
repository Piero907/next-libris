// Percorsi comuni delle prove. Si possono cambiare con variabili d'ambiente:
//   APP_DIR    cartella con i file dell'app da provare (predefinita: ../next-libris, il ramo main estratto accanto)
//   PROVE_OUT  dove finiscono schermate, PDF e file di prova (predefinita: <tmp>/next-libris-prove)
//   CHROME     percorso di Chrome o Chromium
const path = require('path'), fs = require('fs'), os = require('os');
const APP = path.resolve(process.env.APP_DIR || path.join(__dirname, '..', 'next-libris'));   // ramo main accanto a questo
const IMG = path.join(__dirname, 'img');
const OUT = path.resolve(process.env.PROVE_OUT || path.join(os.tmpdir(), 'next-libris-prove'));
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
module.exports = { APP, IMG, OUT, CHROME };
