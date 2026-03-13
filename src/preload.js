const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get native file path from a dropped File object
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Unlock PDF files with given password
  unlockPdfs: (filePaths, password) =>
    ipcRenderer.invoke('pdf:unlock', filePaths, password),

  // Open file dialog to select PDF files
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),

  // Listen for unlock progress updates
  onUnlockProgress: (callback) => {
    ipcRenderer.on('pdf:unlock-progress', (_event, data) => callback(data));
  },

  // Remove progress listener
  removeUnlockProgressListener: () => {
    ipcRenderer.removeAllListeners('pdf:unlock-progress');
  },
});
