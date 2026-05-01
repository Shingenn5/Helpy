const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { createDockerService } = require('./src/backend/services/dockerService')
const { createHealthService } = require('./src/backend/services/healthService')
const { createSessionLogger } = require('./src/backend/services/sessionLogger')

const isDev = !app.isPackaged
const docker = createDockerService()
const health = createHealthService('http://127.0.0.1:8080/v1')
const logger = createSessionLogger()

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101217',
    title: 'Helpy',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  wireIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function wireIpc() {
  ipcMain.handle('backend:health', async () => health.check())
  ipcMain.handle('docker:status', async () => docker.status())
  ipcMain.handle('docker:start', async () => docker.start())
  ipcMain.handle('docker:stop', async () => docker.stop())
  ipcMain.handle('docker:logs', async () => docker.logs())
  ipcMain.handle('docker:config', async () => docker.config())
  ipcMain.handle('session:start', async (_event, payload) => logger.start(payload))
  ipcMain.handle('session:log', async (_event, payload) => logger.append(payload))

  ipcMain.handle('agent:mock-stream', async (event, prompt) => {
    // baby stream for ui smoke test
    const chunks = ['Thinking...', ' checking local backend...', ' planning edits...', ` prompt: ${prompt || 'empty'}`]

    chunks.forEach((chunk, index) => {
      setTimeout(() => {
        event.sender.send('agent:stream-chunk', { chunk, done: index === chunks.length - 1 })
      }, 300 * (index + 1))
    })

    return { ok: true }
  })
}
