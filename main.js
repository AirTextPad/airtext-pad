const { app, BrowserWindow } = require('electron');
const path = require('path');

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
    app.quit();
    return;
}

const { serverReady } = require('./server.js');

let mainWindow = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.airtextpad.app');
}

async function createWindow() {
    const activePort = await serverReady;
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'public/icon.ico'), // Optional icon
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    mainWindow = win;

    // Point to the local server
    win.loadURL(`http://localhost:${activePort}`);

    // Remove the default menu bar
    win.setMenu(null);

    win.on('closed', () => {
        if (mainWindow === win) mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
