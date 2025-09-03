import { app } from 'electron';
import { createWindow } from './window-manager';
import { setupIpcHandlers } from './lib/ipc-handlers';
import { loadInitialSettings } from './lib/settings-manager';

// 앱 시작 시 IPC 핸들러 설정
setupIpcHandlers();

// 앱이 준비되면 초기 설정을 로드하고 메인 윈도우 생성
app.whenReady().then(async () => {
    await loadInitialSettings();
    createWindow();
});

// 모든 창이 닫혔을 때 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 앱이 활성화되었을 때 (macOS)
app.on('activate', () => {
    createWindow(); // 윈도우가 없으면 새로 생성
});
