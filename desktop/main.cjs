'use strict';

const { app, BrowserWindow, dialog, Menu, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = 'softneer://app';
const resources = new Map([
  ['/index.html', 'text/html'], ['/styles.css', 'text/css'],
  ...['engine', 'hydro', 'drivetrain', 'cad', 'content', 'advanced', 'draw', 'app']
    .map(name => [`/src/${name}.js`, 'text/javascript'])
]);

protocol.registerSchemesAsPrivileged([{
  scheme: 'softneer',
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}]);

function resource(request) {
  const url = new URL(request.url);
  const mime = resources.get(url.pathname);
  if (request.method !== 'GET' || url.hostname !== 'app' || !mime) return new Response(null, { status: 404 });
  const filename = path.join(root, url.pathname.slice(1));
  return fs.promises.readFile(filename)
    .then(bytes => new Response(bytes, {
      headers: { 'Content-Type': `${mime}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' }
    }))
    .catch(() => new Response(null, { status: 404 }));
}

const data = path.join(path.dirname(app.getPath('exe')), 'SoftneerData');
let ready = true;
try {
  fs.mkdirSync(data, { recursive: true });
  fs.accessSync(data, fs.constants.W_OK);
  app.setPath('userData', data);
  app.setPath('sessionData', data);
} catch {
  ready = false;
}

let window;
function openWindow() {
  window = new BrowserWindow({
    width: 1380, height: 880, minWidth: 720, minHeight: 570, show: false,
    backgroundColor: '#f2f6fa', title: 'Softneer', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = undefined; });
  window.loadURL(origin + '/index.html').catch(error => dialog.showErrorBox('Softneer', error.message));
}

if (!ready) {
  app.whenReady().then(() => {
    dialog.showErrorBox('Softneer', 'Нет доступа к папке SoftneerData. Распакуйте приложение в доступную для записи папку и повторите запуск.');
    app.quit();
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.whenReady().then(() => {
    protocol.handle('softneer', resource);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())) });
    });
    Menu.setApplicationMenu(null);
    openWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
