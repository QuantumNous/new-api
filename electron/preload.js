const { contextBridge } = require('electron');

// Get the data directory path (for display to the user)
// Give priority to using the real path set by the main process. If not, fall back to manual splicing.
function getDataDirPath() {
  // If the main process has set the real path, use it directly
  if (process.env.ELECTRON_DATA_DIR) {
    return process.env.ELECTRON_DATA_DIR;
  }
}

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  version: process.versions.electron,
  platform: process.platform,
  versions: process.versions,
  dataDir: getDataDirPath()
});