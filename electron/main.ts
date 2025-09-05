import { app, BrowserWindow } from 'electron';
import { createWindow } from './window-manager';
import { setupIpcHandlers } from './lib/ipc-handlers';
import { loadInitialSettings } from './lib/settings-manager';

// 앱 시작 시 IPC 핸들러 설정
setupIpcHandlers();

// 앱이 준비되면 초기 설정을 로드하고 메인 윈도우 생성
app.whenReady().then(async () => {
    await loadInitialSettings();
    createWindow();
}).catch(e => {
    // 시작 중 발생한 오류를 로깅합니다.
    console.error('Failed to start the application:', e);
});

// 모든 창이 닫혔을 때 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 앱이 활성화되었을 때 (macOS)
app.on('activate', () => {
    // macOS에서는 독(dock) 아이콘을 클릭했을 때, 열려 있는 창이 없으면 새로 생성하는 것이 일반적입니다.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
