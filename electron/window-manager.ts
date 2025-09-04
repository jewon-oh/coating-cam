import { BrowserWindow } from 'electron';
import path from 'path';
import serve from 'electron-serve';
import isDev from 'electron-is-dev';

const appServe = serve({
    directory: path.join(__dirname, '../renderer'),
});

let win: BrowserWindow | null = null;

function getPreloadPath() {
    return path.join(__dirname, 'preload.js');
}

export function createWindow() {
    if (win) {
        win.focus();
        return;
    }

    win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1280,
        minHeight: 720,
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: getPreloadPath(),
        },
    });

    console.log('--- DEBUG INFO ---');
    console.log(`isDev: ${isDev}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log('------------------');

    if (process.env.NODE_ENV === 'development' ) {
        console.log('Running in Development mode. Loading from http://localhost:3000');

        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools({ mode: 'detach' });

        win.webContents.on('did-fail-load', (_e, code, desc) => {
            console.error(`Failed to load dev server: ${desc}. Retrying...`);
            setTimeout(() => {
                win?.webContents.reloadIgnoringCache();
            }, 1000);
        });
    } else {
        console.log('Running in Production mode. Loading from app://- via electron-serve');
        appServe(win).then(() => {
            win?.loadURL('app://-');
        });
    }

    win.once('ready-to-show', () => win?.show());
    win.on('closed', () => (win = null));
}
