const { app, BrowserWindow, dialog, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverProcess;
let tray = null;
const PORT = 3000;

function getBinaryPath() {
  const isDev = process.env.NODE_ENV === 'development';
  const platform = process.platform;

  if (isDev) {
    const binaryName = platform === 'win32' ? 'new-api.exe' : 'new-api';
    return path.join(__dirname, '..', binaryName);
  }

  let binaryName;
  switch (platform) {
    case 'win32':
      binaryName = 'new-api.exe';
      break;
    case 'darwin':
      binaryName = 'new-api';
      break;
    case 'linux':
      binaryName = 'new-api';
      break;
    default:
      binaryName = 'new-api';
  }

  return path.join(process.resourcesPath, 'bin', binaryName);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const binaryPath = getBinaryPath();
    const isDev = process.env.NODE_ENV === 'development';

    console.log('Starting server from:', binaryPath);

    const env = { ...process.env, PORT: PORT.toString() };

    let dataDir;
    if (isDev) {
      dataDir = path.join(__dirname, '..', 'data');
    } else {
      const userDataPath = app.getPath('userData');
      dataDir = path.join(userDataPath, 'data');
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    env.SQLITE_PATH = path.join(dataDir, 'new-api.db');

    const workingDir = isDev
      ? path.join(__dirname, '..')
      : process.resourcesPath;

    serverProcess = spawn(binaryPath, [], {
      env,
      cwd: workingDir
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    });

    waitForServer(resolve, reject);
  });
}

function waitForServer(resolve, reject, retries = 30) {
  if (retries === 0) {
    reject(new Error('Server failed to start within timeout'));
    return;
  }

  const req = http.get(`http://localhost:${PORT}`, (res) => {
    console.log('Server is ready');
    resolve();
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(resolve, reject, retries - 1), 1000);
  });

  req.end();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'New API',
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Close to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Use template icon for macOS (black with transparency, auto-adapts to theme)
  // Use colored icon for Windows
  const trayIconPath = process.platform === 'darwin'
    ? path.join(__dirname, 'tray-iconTemplate.png')
    : path.join(__dirname, 'tray-icon-windows.png');

  tray = new Tray(trayIconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show New API',
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('New API');
  tray.setContextMenu(contextMenu);

  // On macOS, clicking the tray icon shows the window
  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      if (mainWindow.isVisible() && process.platform === 'darwin') {
        app.dock.show();
      }
    }
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createTray();
    createWindow();
  } catch (err) {
    console.error('Failed to start application:', err);
    dialog.showErrorBox('Startup Error', `Failed to start server: ${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Don't quit when window is closed, keep running in tray
  // Only quit when explicitly choosing Quit from tray menu
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', (event) => {
  if (serverProcess) {
    event.preventDefault();

    console.log('Shutting down server...');
    serverProcess.kill('SIGTERM');

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
      app.exit();
    }, 5000);

    serverProcess.on('close', () => {
      serverProcess = null;
      app.exit();
    });
  }
});