import { FlashcardEntry, PlaybackState, PlaybackPhase, TimeWindow, PlaybackCallbacks } from '../types'
import { TTSService } from './TTSService'
import { PAUSE_AFTER_ENGLISH, PAUSE_AFTER_SPANISH_WORD, PAUSE_BETWEEN_ENTRIES } from '../utils/timeUtils'

export class PlaybackEngine {
  private tts: TTSService
  private entries: FlashcardEntry[] = []
  private timeWindow: TimeWindow = { startTime: 0, endTime: Infinity }
  private state: PlaybackState
  private callbacks: Partial<PlaybackCallbacks> = {}
  private abortController: AbortController | null = null
  private timeUpdateInterval: number | null = null

  constructor(tts: TTSService) {
    this.tts = tts
    this.state = this.createInitialState()
  }

  private createInitialState(): PlaybackState {
    return {
      isPlaying: false,
      isPaused: false,
      currentEntryIndex: 0,
      currentPhase: 'idle',
      elapsedTime: 0,
      playbackRate: 1.0
    }
  }

  // Set callback handlers
  setCallbacks(callbacks: Partial<PlaybackCallbacks>): void {
    this.callbacks = callbacks
  }

  // Set the vocabulary entries
  setEntries(entries: FlashcardEntry[]): void {
    this.entries = entries
    this.state.currentEntryIndex = 0
    this.notifyStateChange()
  }

  // Set the time window for playback
  setTimeWindow(window: TimeWindow): void {
    this.timeWindow = window
    // Find first entry that starts within window
    const startIndex = this.entries.findIndex(
      e => e.cumulativeStartTime >= window.startTime &&
        e.cumulativeStartTime < window.endTime
    )
    if (startIndex >= 0 && !this.state.isPlaying) {
      this.state.currentEntryIndex = startIndex
      this.notifyEntryChange()
    }
  }

  // Set playback speed
  setRate(rate: number): void {
    this.state.playbackRate = Math.max(0.5, Math.min(2.0, rate))
    this.notifyStateChange()
  }

  // Get current state
  getState(): PlaybackState {
    return { ...this.state }
  }

  // Get current entry
  getCurrentEntry(): FlashcardEntry | null {
    return this.entries[this.state.currentEntryIndex] || null
  }

  // Start or resume playback
  async play(): Promise<void> {
    if (this.state.isPaused) {
      this.resume()
      return
    }

    if (this.state.isPlaying) return
    if (this.entries.length === 0) return

    // Wait for TTS to be ready (API key configured)
    await this.tts.waitForReady()

    this.state.isPlaying = true
    this.state.isPaused = false
    this.abortController = new AbortController()

    this.startTimeTracking()
    this.notifyStateChange()

    try {
      await this.playFromCurrent()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Playback error:', error)
      }
    }
  }

  // Pause playback
  pause(): void {
    if (!this.state.isPlaying || this.state.isPaused) return

    this.state.isPaused = true
    this.tts.pause()
    this.stopTimeTracking()
    this.notifyStateChange()
  }

  // Resume paused playback
  resume(): void {
    if (!this.state.isPaused) return

    this.state.isPaused = false
    this.tts.resume()
    this.startTimeTracking()
    this.notifyStateChange()
  }

  // Stop playback completely
  stop(): void {
    this.abortController?.abort()
    this.abortController = null
    this.tts.cancel()
    this.stopTimeTracking()

    this.state.isPlaying = false
    this.state.isPaused = false
    this.state.currentPhase = 'idle'
    this.notifyStateChange()
  }

  // Skip to next entry
  next(): void {
    const nextIndex = this.state.currentEntryIndex + 1
    if (nextIndex >= this.entries.length) return

    const nextEntry = this.entries[nextIndex]
    // Check if next entry is within time window
    if (nextEntry.cumulativeStartTime >= this.timeWindow.endTime) return

    this.tts.cancel()
    this.state.currentEntryIndex = nextIndex
    this.notifyEntryChange()

    if (this.state.isPlaying && !this.state.isPaused) {
      this.restartPlayback()
    }
  }

  // Go to previous entry
  prev(): void {
    const prevIndex = this.state.currentEntryIndex - 1
    if (prevIndex < 0) return

    const prevEntry = this.entries[prevIndex]
    // Check if prev entry is within time window
    if (prevEntry.cumulativeStartTime + prevEntry.estimatedDuration <= this.timeWindow.startTime) return

    this.tts.cancel()
    this.state.currentEntryIndex = prevIndex
    this.notifyEntryChange()

    if (this.state.isPlaying && !this.state.isPaused) {
      this.restartPlayback()
    }
  }

  // Jump to specific entry
  jumpToEntry(index: number): void {
    if (index < 0 || index >= this.entries.length) return

    this.tts.cancel()
    this.state.currentEntryIndex = index
    this.notifyEntryChange()

    if (this.state.isPlaying && !this.state.isPaused) {
      this.restartPlayback()
    }
  }

  private async restartPlayback(): Promise<void> {
    this.abortController?.abort()
    this.abortController = new AbortController()

    try {
      await this.playFromCurrent()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Playback restart error:', error)
      }
    }
  }

  private async playFromCurrent(): Promise<void> {
    while (
      this.state.isPlaying &&
      !this.abortController?.signal.aborted &&
      this.state.currentEntryIndex < this.entries.length
    ) {
      const entry = this.entries[this.state.currentEntryIndex]

      // Check if this entry is within the time window
      if (entry.cumulativeStartTime >= this.timeWindow.endTime) {
        break
      }

      await this.playEntry(entry)

      if (this.abortController?.signal.aborted) break

      // Move to next entry
      const nextIndex = this.state.currentEntryIndex + 1
      if (nextIndex >= this.entries.length) break

      const nextEntry = this.entries[nextIndex]
      if (nextEntry.cumulativeStartTime >= this.timeWindow.endTime) break

      this.state.currentEntryIndex = nextIndex
      this.notifyEntryChange()
    }

    // Playback complete
    if (!this.abortController?.signal.aborted) {
      this.stop()
      this.callbacks.onComplete?.()
    }
  }

  private async playEntry(entry: FlashcardEntry): Promise<void> {
    const rate = this.state.playbackRate
    const signal = this.abortController?.signal

    // Phase 1: English word
    this.setPhase('english')
    await this.speakWithAbort(entry.englishWord, 'en', rate, signal)
    if (signal?.aborted) return

    // Phase 2: Pause after English
    this.setPhase('pause-after-english')
    await this.delayWithAbort(PAUSE_AFTER_ENGLISH * 1000 / rate, signal)
    if (signal?.aborted) return

    // Phase 3: Spanish word
    this.setPhase('spanish-word')
    await this.speakWithAbort(entry.spanishWord, 'es', rate, signal)
    if (signal?.aborted) return

    // Phase 4: Pause after Spanish word
    this.setPhase('pause-after-spanish-word')
    await this.delayWithAbort(PAUSE_AFTER_SPANISH_WORD * 1000 / rate, signal)
    if (signal?.aborted) return

    // Phase 5: Spanish sentence
    this.setPhase('spanish-sentence')
    await this.speakWithAbort(entry.spanishSentence, 'es', rate, signal)
    if (signal?.aborted) return

    // Phase 6: Pause between entries
    this.setPhase('between-entries')
    await this.delayWithAbort(PAUSE_BETWEEN_ENTRIES * 1000 / rate, signal)
  }

  private async speakWithAbort(
    text: string,
    lang: 'en' | 'es',
    rate: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Handle pause during speech
    return new Promise<void>((resolve, reject) => {
      const abortHandler = () => {
        this.tts.cancel()
        reject(new DOMException('Aborted', 'AbortError'))
      }

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      this.tts.speak(text, lang, rate)
        .then(async () => {
          signal?.removeEventListener('abort', abortHandler)
          // Wait while paused
          await this.waitWhilePaused()
          resolve()
        })
        .catch((error) => {
          signal?.removeEventListener('abort', abortHandler)
          reject(error)
        })
    })
  }

  private async delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      const timeoutId = setTimeout(() => {
        signal?.removeEventListener('abort', abortHandler)
        resolve()
      }, ms)

      const abortHandler = () => {
        clearTimeout(timeoutId)
        reject(new DOMException('Aborted', 'AbortError'))
      }

      signal?.addEventListener('abort', abortHandler, { once: true })
    })

    // Wait while paused after delay completes
    await this.waitWhilePaused()
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.state.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  private setPhase(phase: PlaybackPhase): void {
    this.state.currentPhase = phase
    this.callbacks.onPhaseChange?.(phase)
    this.notifyStateChange()
  }

  private startTimeTracking(): void {
    if (this.timeUpdateInterval) return

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.state.isPlaying && !this.state.isPaused) {
        this.state.elapsedTime += 0.1
        this.callbacks.onTimeUpdate?.(this.state.elapsedTime)
      }
    }, 100)
  }

  private stopTimeTracking(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval)
      this.timeUpdateInterval = null
    }
  }

  private notifyStateChange(): void {
    this.callbacks.onStateChange?.({ ...this.state })
  }

  private notifyEntryChange(): void {
    const entry = this.getCurrentEntry()
    if (entry) {
      this.callbacks.onEntryChange?.(entry, this.state.currentEntryIndex)
    }
  }
}
