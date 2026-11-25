contextBridge.exposeInMainWorld('wildgridWindow', {
  getState: () => ipcRenderer.invoke('wildgrid:window-state'),
  setFullscreen: value => ipcRenderer.invoke('wildgrid:window-fullscreen', value),
  close: () => ipcRenderer.invoke('wildgrid:window-close'),
  onChange: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('wildgrid:window-changed', listener);
    return () => ipcRenderer.removeListener('wildgrid:window-changed', listener);
  },
});
const updateWindowStyle = (_event, value) => {
  document.documentElement.toggleAttribute('data-steam-windowed', !value.fullscreen);
};
ipcRenderer.on('wildgrid:window-changed', updateWindowStyle);
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('wildgrid:window-state').then(value => updateWindowStyle(null, value));
});
