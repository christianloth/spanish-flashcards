import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { listInputFiles, readVocabularyFile, getInputDirectory } from './fileHandler'
import {
  setApiKey,
  getApiKey,
  isConfigured,
  synthesizeSpeech,
  cleanupAudioFile,
  testConnection,
  getAvailableVoices,
  initFromEnv
} from './ttsHandler'

// Load API key from .env file on startup
initFromEnv()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hiddenInset',
    show: false
  })

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers for file operations
ipcMain.handle('get-input-files', async () => {
  return listInputFiles()
})

ipcMain.handle('load-file', async (_event, filename: string) => {
  return readVocabularyFile(filename)
})

ipcMain.handle('get-input-directory', async () => {
  return getInputDirectory()
})

// TTS IPC handlers
ipcMain.handle('tts-set-api-key', async (_event, key: string) => {
  return setApiKey(key)
})

ipcMain.handle('tts-get-api-key', async () => {
  return getApiKey()
})

ipcMain.handle('tts-is-configured', async () => {
  return isConfigured()
})

ipcMain.handle('tts-synthesize', async (_event, text: string, language: 'en' | 'es', voiceId?: string) => {
  return synthesizeSpeech(text, language, voiceId)
})

ipcMain.handle('tts-cleanup', async (_event, filePath: string) => {
  cleanupAudioFile(filePath)
})

ipcMain.handle('tts-test-connection', async () => {
  return testConnection()
})

ipcMain.handle('tts-get-voices', async () => {
  return getAvailableVoices()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
