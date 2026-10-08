const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wildgridClipboard', {
  writeText: text => ipcRenderer.invoke('wildgrid:clipboard-write', text),
  readText: () => ipcRenderer.invoke('wildgrid:clipboard-read'),
});

contextBridge.exposeInMainWorld('wildgridPlayerId', {
  resolve: apiUrl => ipcRenderer.invoke('wildgrid:player-id-resolve', apiUrl),
});
