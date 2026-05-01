const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('workstation', {
  health: () => ipcRenderer.invoke('backend:health'),
  docker: {
    status: () => ipcRenderer.invoke('docker:status'),
    start: () => ipcRenderer.invoke('docker:start'),
    stop: () => ipcRenderer.invoke('docker:stop')
  },
  session: {
    log: (payload) => ipcRenderer.invoke('session:log', payload)
  },
  agent: {
    mockStream: (prompt) => ipcRenderer.invoke('agent:mock-stream', prompt),
    onStreamChunk: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('agent:stream-chunk', listener)
      return () => ipcRenderer.removeListener('agent:stream-chunk', listener)
    }
  }
})
