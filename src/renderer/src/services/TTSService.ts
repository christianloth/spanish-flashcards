type TTSCallback = () => void

interface VoiceInfo {
  id: string
  name: string
  gender: string
}

export class TTSService {
  private audioElement: HTMLAudioElement | null = null
  private isReady: boolean = false
  private onReadyCallbacks: TTSCallback[] = []
  private currentAudioFile: string | null = null
  private selectedVoiceId: string | null = null
  private availableVoices: VoiceInfo[] = []

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    // Check if API key is already configured
    const configured = await window.electronAPI.tts.isConfigured()
    if (configured) {
      this.isReady = true
      this.availableVoices = await window.electronAPI.tts.getVoices()
      this.notifyReady()
    }
  }

  private notifyReady(): void {
    this.onReadyCallbacks.forEach(cb => cb())
    this.onReadyCallbacks = []
  }

  /**
   * Set the ElevenLabs API key
   */
  async setApiKey(key: string): Promise<boolean> {
    const success = await window.electronAPI.tts.setApiKey(key)
    if (success) {
      this.isReady = true
      this.availableVoices = await window.electronAPI.tts.getVoices()
      this.notifyReady()
    }
    return success
  }

  /**
   * Get the current API key (masked)
   */
  async getApiKey(): Promise<string | null> {
    return window.electronAPI.tts.getApiKey()
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.tts.testConnection()
  }

  /**
   * Check if the service is configured and ready
   */
  async checkReady(): Promise<boolean> {
    this.isReady = await window.electronAPI.tts.isConfigured()
    return this.isReady
  }

  /**
   * Wait for the service to be ready
   */
  waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      this.onReadyCallbacks.push(resolve)
    })
  }

  /**
   * Get available voices
   */
  getVoices(): VoiceInfo[] {
    return this.availableVoices
  }

  /**
   * Set the voice to use for speech
   */
  setVoice(voiceId: string): void {
    this.selectedVoiceId = voiceId
  }

  /**
   * Speak text in the specified language
   * Returns a promise that resolves when speech is complete
   */
  async speak(text: string, lang: 'en' | 'es', rate: number = 1.0): Promise<void> {
    if (!this.isReady) {
      throw new Error('TTS service not configured. Please set your ElevenLabs API key.')
    }

    // Clean up previous audio
    this.cleanupAudio()

    try {
      console.log(`[TTSService] Requesting audio for: "${text.substring(0, 30)}..."`)

      // Generate audio using ElevenLabs (via main process)
      // Returns a base64 data URL
      const audioDataUrl = await window.electronAPI.tts.synthesize(
        text,
        lang,
        this.selectedVoiceId || undefined
      )

      console.log(`[TTSService] Received data (${audioDataUrl.length} chars)`)
      console.log(`[TTSService] Data prefix: ${audioDataUrl.substring(0, 50)}...`)

      // Convert data URL to Blob URL for better compatibility
      let audioUrl = audioDataUrl
      if (audioDataUrl.startsWith('data:')) {
        try {
          // Extract base64 data from data URL
          const base64Match = audioDataUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (base64Match) {
            const mimeType = base64Match[1]
            const base64Data = base64Match[2]

            // Convert base64 to binary
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }

            // Create Blob and Object URL
            const blob = new Blob([bytes], { type: mimeType })
            audioUrl = URL.createObjectURL(blob)
            console.log(`[TTSService] Created Blob URL: ${audioUrl}`)
          }
        } catch (e) {
          console.error('[TTSService] Failed to convert to Blob URL:', e)
          // Fall back to using data URL directly
        }
      }

      // Play the audio
      return new Promise((resolve, reject) => {
        this.audioElement = new Audio(audioUrl)
        this.audioElement.playbackRate = rate

        this.audioElement.onended = () => {
          console.log('[TTSService] Audio playback ended')
          // Revoke blob URL if we created one
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl)
          }
          this.cleanupAudio()
          resolve()
        }

        this.audioElement.onerror = (e) => {
          console.error('[TTSService] Audio playback error:', e)
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl)
          }
          this.cleanupAudio()
          reject(new Error('Audio playback failed'))
        }

        console.log('[TTSService] Starting playback...')
        this.audioElement.play().catch(err => {
          console.error('[TTSService] Play failed:', err)
          reject(err)
        })
      })
    } catch (error) {
      console.error('[TTSService] TTS error:', error)
      throw error
    }
  }

  /**
   * Pause ongoing speech
   */
  pause(): void {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause()
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play()
    }
  }

  /**
   * Cancel/stop all speech
   */
  cancel(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.currentTime = 0
    }
    this.cleanup()
  }

  /**
   * Clean up audio element (synchronous)
   */
  private cleanupAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      // Remove event listeners to prevent spurious errors
      this.audioElement.onended = null
      this.audioElement.onerror = null
      this.audioElement = null
    }
  }

  /**
   * Clean up all audio resources
   */
  private async cleanup(): Promise<void> {
    this.cleanupAudio()

    if (this.currentAudioFile) {
      try {
        await window.electronAPI.tts.cleanup(this.currentAudioFile)
      } catch (e) {
        // Ignore cleanup errors
      }
      this.currentAudioFile = null
    }
  }

  /**
   * Check if currently speaking
   */
  get isSpeaking(): boolean {
    return this.audioElement !== null && !this.audioElement.paused
  }

  /**
   * Check if paused
   */
  get isPaused(): boolean {
    return this.audioElement !== null && this.audioElement.paused
  }

  /**
   * Check if configured
   */
  get isConfigured(): boolean {
    return this.isReady
  }
}
