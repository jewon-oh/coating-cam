"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    ping: () => 'pong',
});
// settings Api
electron_1.contextBridge.exposeInMainWorld('settingsApi', {
    load: () => electron_1.ipcRenderer.invoke('settings:load'),
    save: (data) => electron_1.ipcRenderer.send('settings:save', data),
});
// 파일 관련 API
electron_1.contextBridge.exposeInMainWorld('projectApi', {
    showOpenDialog: (opts) => electron_1.ipcRenderer.invoke('project:showOpenDialog', opts),
    showSaveDialog: (opts) => electron_1.ipcRenderer.invoke('project:showSaveDialog', opts),
    readFile: (filePath, encoding = 'utf8') => electron_1.ipcRenderer.invoke('project:readFile', filePath, encoding),
    writeFile: (filePath, content, encoding = 'utf8') => electron_1.ipcRenderer.invoke('project:writeFile', filePath, content, encoding),
});
