// Type declarations for Electron API exposed via contextBridge

interface VoiceInfo {
  id: string
  name: string
  gender: string
}

interface ElectronAPI {
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
    getCacheStats: () => Promise<{
      totalFiles: number
      totalSize: number
      totalSizeMB: string
      oldestEntry: string | null
      newestEntry: string | null
    }>
    clearCache: () => Promise<{ deleted: number }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
