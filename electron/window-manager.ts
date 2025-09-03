import { BrowserWindow } from 'electron';
import path from 'path';
import url from 'url';

import isDev from 'electron-is-dev'; // 👈 electron-is-dev를 import 합니다.

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
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: getPreloadPath(),
            // webSecurity: false // 이 옵션은 보안상 주의가 필요합니다.
        },
    });

    if (isDev) {
        // 개발 모드에서는 Next.js 개발 서버 주소를 직접 사용합니다.
        win.loadURL('http://localhost:3000').catch(err => console.error('loadURL error:', err));
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        // ✅ loadFile을 loadURL과 url.format을 사용하는 방식으로 변경했습니다.
        const prodUrl = url.format({
            pathname: path.join(__dirname, '../renderer/index.html'),
            protocol: 'file:',
            slashes: true,
        });
        win.loadURL(prodUrl).catch(err => console.error('loadURL error:', err));
    }

    win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
        console.error('[did-fail-load]', { code, desc, url: failedUrl });
    });

    win.once('ready-to-show', () => win?.show());
    win.on('closed', () => (win = null));
}