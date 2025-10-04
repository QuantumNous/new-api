const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  version: process.versions.electron,
  platform: process.platform
});