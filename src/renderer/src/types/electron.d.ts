// Type declarations for Electron API exposed via contextBridge

interface VoiceInfo {
  id: string
  name: string
  gender: string
}

interface FlashcardEntry {
  englishWord: string
  spanishWord: string
  spanishSentence: string
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
  exportAudio: (
    entries: FlashcardEntry[],
    filename: string,
    speed: number
  ) => Promise<{ success: boolean; path?: string; error?: string }>
  onExportProgress: (callback: (data: { phase: string; percent: number }) => void) => void
  checkFFmpeg: () => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
