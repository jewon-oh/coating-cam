import { contextBridge, ipcRenderer } from 'electron';
import {SettingsType} from "@common/types/settings";

contextBridge.exposeInMainWorld('api', {
    ping: () => 'pong',
});

// Window Control API
contextBridge.exposeInMainWorld('windowApi', {
    minimize: () => ipcRenderer.send('minimize-window'),
    maximize: () => ipcRenderer.send('maximize-window'),
    close: () => ipcRenderer.send('close-window'),
});

// settings Api
contextBridge.exposeInMainWorld('settingsApi', {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (data: SettingsType) => ipcRenderer.send('settings:save', data),
});

// 파일 관련 API
contextBridge.exposeInMainWorld('projectApi', {
    showOpenDialog: (opts?: any) => ipcRenderer.invoke('project:showOpenDialog', opts),
    showSaveDialog: (opts?: any) => ipcRenderer.invoke('project:showSaveDialog', opts),
    readFile: (filePath: string, encoding: BufferEncoding = 'utf8') =>
        ipcRenderer.invoke('project:readFile', filePath, encoding),
    writeFile: (filePath: string, content: string, encoding: BufferEncoding = 'utf8') =>
        ipcRenderer.invoke('project:writeFile', filePath, content, encoding),
});
