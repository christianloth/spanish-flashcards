import { contextBridge, ipcRenderer } from 'electron'

// Voice info type
interface VoiceInfo {
  id: string
  name: string
  gender: string
}

// Expose protected methods to the renderer process via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  getInputFiles: (): Promise<string[]> => {
    return ipcRenderer.invoke('get-input-files')
  },

  loadFile: (filename: string): Promise<string> => {
    return ipcRenderer.invoke('load-file', filename)
  },

  getInputDirectory: (): Promise<string> => {
    return ipcRenderer.invoke('get-input-directory')
  },

  // TTS operations (ElevenLabs)
  tts: {
    setApiKey: (key: string): Promise<boolean> => {
      return ipcRenderer.invoke('tts-set-api-key', key)
    },

    getApiKey: (): Promise<string | null> => {
      return ipcRenderer.invoke('tts-get-api-key')
    },

    isConfigured: (): Promise<boolean> => {
      return ipcRenderer.invoke('tts-is-configured')
    },

    synthesize: (text: string, language: 'en' | 'es', voiceId?: string): Promise<string> => {
      return ipcRenderer.invoke('tts-synthesize', text, language, voiceId)
    },

    cleanup: (filePath: string): Promise<void> => {
      return ipcRenderer.invoke('tts-cleanup', filePath)
    },

    testConnection: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('tts-test-connection')
    },

    getVoices: (): Promise<VoiceInfo[]> => {
      return ipcRenderer.invoke('tts-get-voices')
    }
  }
})

// Type declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getInputFiles: () => Promise<string[]>
      loadFile: (filename: string) => Promise<string>
      getInputDirectory: () => Promise<string>
      tts: {
        setApiKey: (key: string) => Promise<boolean>
        getApiKey: () => Promise<string | null>
        isConfigured: () => Promise<boolean>
        synthesize: (text: string, language: 'en' | 'es', voiceId?: string) => Promise<string>
        cleanup: (filePath: string) => Promise<void>
        testConnection: () => Promise<{ success: boolean; error?: string }>
        getVoices: () => Promise<VoiceInfo[]>
      }
    }
  }
}
