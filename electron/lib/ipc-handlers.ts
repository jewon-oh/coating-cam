import { ipcMain, dialog } from 'electron';
import { loadSettingsFile, saveSettingsFile } from './settings-manager';
import { promises as fs } from 'fs';
// electron 환경을 위해 @ 사용 안함
import {SettingsType} from "../../common/types/settings";

export function setupIpcHandlers() {
    // Settings API
    ipcMain.handle('settings:load', async () => {
        try {
            return await loadSettingsFile();
        } catch (e) {
            console.error('[settings] load failed:', e);
            return null; // 실패 시 null 반환
        }
    });

    ipcMain.on('settings:save', async (_evt, next: SettingsType) => {
        try {
            await saveSettingsFile(next);
        } catch (e) {
            console.error('[settings] save failed:', e);
        }
    });

    // Project File I/O API
    ipcMain.handle('project:showOpenDialog', async (_e, options) => {
        return dialog.showOpenDialog({ properties: ['openFile'], ...options });
    });

    ipcMain.handle('project:showSaveDialog', async (_e, options) => {
        return dialog.showSaveDialog({ ...options });
    });

    ipcMain.handle('project:readFile', async (_e, filePath: string, encoding: BufferEncoding = 'utf8') => {
        const buf = await fs.readFile(filePath);
        return encoding ? buf.toString(encoding) : buf;
    });

    ipcMain.handle('project:writeFile', async (_e, filePath: string, content: string, encoding: BufferEncoding = 'utf8') => {
        await fs.writeFile(filePath, content, { encoding });
        return true;
    });
}
