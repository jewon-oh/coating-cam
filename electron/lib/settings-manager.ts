import { app } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import writeFileAtomic from 'write-file-atomic';
import {DEFAULT_SETTINGS, SettingsType} from "../../common/types/settings";

const baseDir = path.join(app.getPath('userData'), 'settings');
const settingsPath = path.join(baseDir, 'settings.json');
let settingsCache: SettingsType | null = null;

async function ensureDir() {
    await fs.mkdir(baseDir, { recursive: true });
}

function migrateSettings(raw: any): SettingsType {
    const ver = typeof raw?.version === 'number' ? raw.version : 0;
    const next = DEFAULT_SETTINGS;
    if (ver < 1) {
        // 필요 시 마이그레이션 로직 추가
    }
    return next;
}

export async function loadSettingsFile(): Promise<SettingsType> {
    if (settingsCache) return settingsCache;

    await ensureDir();
    try {
        const raw = await fs.readFile(settingsPath, 'utf-8');
        settingsCache = migrateSettings(JSON.parse(raw));
        return settingsCache;
    } catch {
        const initial = migrateSettings({});
        await saveSettingsFile(initial);
        return initial;
    }
}

export async function saveSettingsFile(data: SettingsType) {
    await ensureDir();
    const normalized = migrateSettings(data);
    try {
        await fs.copyFile(settingsPath, settingsPath + '.bak');
    } catch {
        // 백업 실패는 무시
    }
    await writeFileAtomic(settingsPath, JSON.stringify(normalized, null, 2));
    settingsCache = normalized;
}

export async function loadInitialSettings() {
    try {
        await loadSettingsFile();
    } catch (e) {
        console.error('[settings] initial load failed:', e);
        settingsCache = migrateSettings({});
    }
}
