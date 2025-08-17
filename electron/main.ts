import {app, BrowserWindow, ipcMain, dialog} from 'electron';
import path from 'path';
import {promises as fs} from 'fs';
import writeFileAtomic from 'write-file-atomic';
import {DEFAULT_SETTINGS, SettingsType} from "../src/types/settings";

const baseDir = path.join(app.getPath('userData'), 'settings');
const settingsPath = path.join(baseDir, 'settings.json');

async function ensureDir() {
    await fs.mkdir(baseDir, {recursive: true});
}

function migrateSettings(raw: any): SettingsType {
    const ver = typeof raw?.version === 'number' ? raw.version : 0;
    const next = DEFAULT_SETTINGS;

    if (ver < 1) {
        // 필요 시 마이그레이션 로직 추가
    }
    return next;
}

async function loadSettingsFile(): Promise<SettingsType> {
    await ensureDir();
    try {
        const raw = await fs.readFile(settingsPath, 'utf-8');
        return migrateSettings(JSON.parse(raw));
    } catch {
        const initial = migrateSettings({});
        await saveSettingsFile(initial);
        return initial;
    }
}

async function saveSettingsFile(data: SettingsType) {
    await ensureDir();
    const normalized = migrateSettings(data);
    try {
        await fs.copyFile(settingsPath, settingsPath + '.bak');
    } catch {
    }
    await writeFileAtomic(settingsPath, JSON.stringify(normalized, null, 2));
}

// ------------------------------
// BrowserWindow 생성
// ------------------------------
const isDev = process.env.NODE_ENV !== 'production';
const DEV_URL = process.env.APP_URL || 'http://localhost:3000';
const PROD_URL = process.env.APP_URL || 'http://localhost:3000';

let win: BrowserWindow | null = null;

function getPreloadPath() {
    // 개발 중 ts-node로 실행하고, 배포 시 빌드 산출물을 로드한다는 가정
    return isDev
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, 'preload.js');
}

function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: getPreloadPath(),
        },
    });

    const urlToLoad = isDev ? DEV_URL : PROD_URL;

    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
        console.error('[did-fail-load]', {code, desc, url});
    });
    win.webContents.on('dom-ready', () => {
        console.log('[dom-ready] loaded:', urlToLoad);
    });
    win.once('ready-to-show', () => win?.show());

    win.loadURL(urlToLoad).catch(err => console.error('loadURL error:', err));

    if (isDev) {
        win.webContents.openDevTools({mode: 'detach'});
    }

    win.on('closed', () => {
        win = null;
    });
}

// ------------------------------
// settingsApi 구현 (IPC)
// ------------------------------
let bootSettings: SettingsType | null = null;

// 앱 시작 시 한 번 로드해 캐시
app.whenReady().then(async () => {
    try {
        bootSettings = await loadSettingsFile();
    } catch (e) {
        console.error('[settings] initial load failed:', e);
        bootSettings = migrateSettings({});
    }
});

// 렌더러: settingsApi.load() -> preload: invoke('settings:load')
ipcMain.handle('settings:load', async () => {
    try {
        // 캐시가 있으면 우선 반환, 없으면 파일에서 로드
        return bootSettings ?? (await loadSettingsFile());
    } catch (e) {
        console.error('[settings] load failed:', e);
        // 실패 시에도 기본값 반환
        return migrateSettings({});
    }
});

// 렌더러: settingsApi.save(data) -> preload: send('settings:save', data)
// fire-and-forget 저장(디바운스는 렌더러에서)
ipcMain.on('settings:save', async (_evt, next: SettingsType) => {
    try {
        const normalized = migrateSettings(next);
        await saveSettingsFile(normalized);
        bootSettings = normalized;
    } catch (e) {
        console.error('[settings] save failed:', e);
    }
});


// ------------------------------
// 프로젝트 파일 다이얼로그/파일 I/O
// ------------------------------
ipcMain.handle('project:showOpenDialog', async (_e, options) => {
    return dialog.showOpenDialog({properties: ['openFile'], ...options});
});
ipcMain.handle('project:showSaveDialog', async (_e, options) => {
    return dialog.showSaveDialog({...options});
});
ipcMain.handle('project:readFile', async (_e, filePath: string, encoding: BufferEncoding = 'utf8') => {
    const buf = await fs.readFile(filePath);
    return encoding ? buf.toString(encoding) : buf;
});
ipcMain.handle('project:writeFile', async (_e, filePath: string, content: string, encoding: BufferEncoding = 'utf8') => {
    await fs.writeFile(filePath, content, {encoding});
    return true;
});


// ------------------------------
// 앱 라이프사이클
// ------------------------------
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (!win) createWindow();
});