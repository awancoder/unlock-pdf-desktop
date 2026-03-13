import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

// ============================================
// QPDF binary path resolver
// ============================================
function getQpdfPath() {
  // In production (packaged), qpdf.exe is in resources/bin/
  // In development, it's in src/bin/
  const possiblePaths = [
    path.join(process.resourcesPath, 'bin', 'qpdf.exe'),           // packaged
    path.join(app.getAppPath(), 'src', 'bin', 'qpdf.exe'),         // dev with forge
    path.join(__dirname, '..', '..', 'src', 'bin', 'qpdf.exe'),    // dev fallback
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  // Fallback: hope it's in system PATH
  return 'qpdf';
}

// Custom decrypt function using bundled qpdf binary
function decryptPdf(inputPath, outputPath, password) {
  return new Promise((resolve, reject) => {
    const qpdfPath = getQpdfPath();
    const args = ['--decrypt'];

    if (password) {
      args.push(`--password=${password}`);
    }
    args.push(inputPath);
    args.push(outputPath);

    const proc = spawn(qpdfPath, args);
    const stderr = [];

    proc.stderr.on('data', (data) => {
      stderr.push(data.toString());
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to run qpdf: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.join('') || `qpdf exited with code ${code}`));
      }
    });
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 720,
    height: 680,
    minWidth: 520,
    minHeight: 500,
    backgroundColor: '#0c0c14',
    titleBarStyle: 'default',
    icon: 'src/assets/icon.png',
    title: 'Unlock PDF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove default menu
  mainWindow.setMenuBarVisibility(false);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
};

// ============================================
// IPC Handlers
// ============================================

// Handle file dialog
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (result.canceled) return [];
  return result.filePaths;
});

// Handle PDF unlock
ipcMain.handle('pdf:unlock', async (event, filePaths, password) => {
  const results = [];

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const outputPath = path.join(dir, `${baseName}_unlock${ext}`);

    // Send progress update
    event.sender.send('pdf:unlock-progress', {
      index: i,
      total: filePaths.length,
      fileName: path.basename(filePath),
      status: 'processing',
    });

    try {
      await decryptPdf(filePath, outputPath, password);

      results.push({
        index: i,
        fileName: path.basename(filePath),
        outputPath: outputPath,
        success: true,
      });

      // Send success update
      event.sender.send('pdf:unlock-progress', {
        index: i,
        total: filePaths.length,
        fileName: path.basename(filePath),
        status: 'success',
      });
    } catch (error) {
      console.error(`Error unlocking ${path.basename(filePath)}:`, error);
      const errorMsg = error.stderr || error.message || String(error);
      results.push({
        index: i,
        fileName: path.basename(filePath),
        success: false,
        error: errorMsg,
      });

      // Send error update
      event.sender.send('pdf:unlock-progress', {
        index: i,
        total: filePaths.length,
        fileName: path.basename(filePath),
        status: 'error',
        error: errorMsg,
      });
    }
  }

  return results;
});

// ============================================
// App lifecycle
// ============================================

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
