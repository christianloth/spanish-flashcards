import { VocabularyFile, PlaybackState, PlaybackPhase, FlashcardEntry } from './types'
import { TTSService } from './services/TTSService'
import { PlaybackEngine } from './services/PlaybackEngine'
import { parseVocabularyFile, getTotalDuration, recalculateDurations } from './services/FileParser'
import { FileSelector } from './components/FileSelector'
import { PlaybackControls } from './components/PlaybackControls'
import { TimelineSlider } from './components/TimelineSlider'
import { FlashCard } from './components/FlashCard'
import { Settings } from './components/Settings'

export class App {
  private fileSelector: FileSelector
  private playbackControls: PlaybackControls
  private timelineSlider: TimelineSlider
  private flashCard: FlashCard
  private settings: Settings

  private ttsService: TTSService
  private playbackEngine: PlaybackEngine
  private currentFile: VocabularyFile | null = null

  private mainContainer: HTMLElement | null = null
  private settingsContainer: HTMLElement | null = null

  constructor() {
    // Initialize services
    this.ttsService = new TTSService()
    this.playbackEngine = new PlaybackEngine(this.ttsService)

    // Initialize components
    this.fileSelector = new FileSelector()
    this.playbackControls = new PlaybackControls()
    this.timelineSlider = new TimelineSlider()
    this.flashCard = new FlashCard()
    this.settings = new Settings(this.ttsService)

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // File selection
    this.fileSelector.onFileSelect = (filename) => this.loadFile(filename)
    this.fileSelector.onPreloadCache = () => this.preloadCache()

    // Playback controls
    this.playbackControls.onPlay = () => this.playbackEngine.play()
    this.playbackControls.onPause = () => this.playbackEngine.pause()
    this.playbackControls.onNext = () => this.playbackEngine.next()
    this.playbackControls.onPrev = () => this.playbackEngine.prev()
    this.playbackControls.onSpeedChange = (rate) => this.handleSpeedChange(rate)
    this.playbackControls.onExportAudio = (speed) => this.exportAudioFile(speed)

    // Timeline window changes
    this.timelineSlider.onWindowChange = (window) => {
      this.playbackEngine.setTimeWindow(window)
    }

    // Timeline seek
    this.timelineSlider.onSeek = (time) => {
      this.playbackEngine.seekToTime(time)
    }

    // Playback engine callbacks
    this.playbackEngine.setCallbacks({
      onStateChange: (state) => this.handleStateChange(state),
      onEntryChange: (entry, index) => this.handleEntryChange(entry, index),
      onPhaseChange: (phase) => this.handlePhaseChange(phase),
      onTimeUpdate: (time) => this.handleTimeUpdate(time),
      onComplete: () => this.handlePlaybackComplete()
    })

    // Settings callback
    this.settings.onConfigured = () => this.showMainApp()
  }

  async initialize(): Promise<void> {
    // Render the app shell
    this.render()

    // Check if FFmpeg is available
    const ffmpegAvailable = await window.electronAPI.checkFFmpeg()
    if (!ffmpegAvailable) {
      console.warn('FFmpeg not found - audio export will be unavailable')
      // Optionally show a warning to user
    }

    // Check if TTS is configured
    const isConfigured = await this.ttsService.checkReady()

    if (isConfigured) {
      // Show main app directly
      this.showMainApp()
    } else {
      // Show settings panel
      this.showSettings()
    }
  }

  private render(): void {
    const app = document.getElementById('app')
    if (!app) return

    app.innerHTML = ''

    // Header
    const header = document.createElement('header')
    header.className = 'app-header'

    const title = document.createElement('h1')
    title.textContent = 'Spanish Flashcards'

    const subtitle = document.createElement('p')
    subtitle.className = 'subtitle'
    subtitle.textContent = 'Auditory learning with high-quality Castilian Spanish pronunciation'

    header.appendChild(title)
    header.appendChild(subtitle)

    // Settings container
    this.settingsContainer = document.createElement('div')
    this.settingsContainer.id = 'settings-container'
    this.settingsContainer.appendChild(this.settings.getElement())

    // Main content container
    this.mainContainer = document.createElement('main')
    this.mainContainer.className = 'app-main'
    this.mainContainer.style.display = 'none'

    this.mainContainer.appendChild(this.fileSelector.getElement())
    this.mainContainer.appendChild(this.flashCard.getElement())
    this.mainContainer.appendChild(this.playbackControls.getElement())
    this.mainContainer.appendChild(this.timelineSlider.getElement())

    // Settings link
    const settingsLink = document.createElement('button')
    settingsLink.className = 'settings-link'
    settingsLink.textContent = 'Change API Key'
    settingsLink.addEventListener('click', () => this.showSettings())
    this.mainContainer.appendChild(settingsLink)

    app.appendChild(header)
    app.appendChild(this.settingsContainer)
    app.appendChild(this.mainContainer)
  }

  private async showMainApp(): Promise<void> {
    if (this.settingsContainer) {
      this.settingsContainer.style.display = 'none'
    }
    if (this.mainContainer) {
      this.mainContainer.style.display = 'flex'
    }

    // Load available files
    await this.fileSelector.loadFiles()

    // Disable controls until a file is loaded
    this.playbackControls.setEnabled(false)
  }

  private showSettings(): void {
    if (this.mainContainer) {
      this.mainContainer.style.display = 'none'
    }
    if (this.settingsContainer) {
      this.settingsContainer.style.display = 'block'
    }
  }

  private async loadFile(filename: string): Promise<void> {
    try {
      const content = await window.electronAPI.loadFile(filename)

      if (!content) {
        console.error('Empty file content')
        return
      }

      const rate = this.playbackEngine.getState().playbackRate
      const entries = parseVocabularyFile(content, rate)

      if (entries.length === 0) {
        console.error('No entries parsed from file')
        return
      }

      const totalDuration = getTotalDuration(entries)

      this.currentFile = {
        name: filename,
        path: filename,
        entries,
        totalDuration
      }

      // Update components
      this.timelineSlider.setDuration(totalDuration)
      this.timelineSlider.setEntries(entries)
      this.playbackEngine.setEntries(entries)

      // Set default time window (first 30 seconds or full duration)
      const defaultWindow = {
        startTime: 0,
        endTime: Math.min(30, totalDuration)
      }
      this.timelineSlider.setWindow(defaultWindow)
      this.playbackEngine.setTimeWindow(defaultWindow)

      // Show first entry
      if (entries.length > 0) {
        this.flashCard.setEntry(entries[0], 0, entries.length)
      }

      // Enable playback controls
      this.playbackControls.setEnabled(true)

      console.log(`Loaded ${entries.length} entries from ${filename}`)
    } catch (error) {
      console.error('Error loading file:', error)
    }
  }

  private handleSpeedChange(rate: number): void {
    this.playbackEngine.setRate(rate)

    // Recalculate durations based on new rate
    if (this.currentFile) {
      const entries = recalculateDurations(this.currentFile.entries, rate)
      this.currentFile.entries = entries
      this.currentFile.totalDuration = getTotalDuration(entries)

      this.timelineSlider.setDuration(this.currentFile.totalDuration)
      this.timelineSlider.setEntries(entries)
      this.playbackEngine.setEntries(entries)
    }
  }

  private handleStateChange(state: PlaybackState): void {
    this.playbackControls.updateState(state)
  }

  private handleEntryChange(entry: FlashcardEntry, index: number): void {
    if (!this.currentFile) return

    this.flashCard.setEntry(entry, index, this.currentFile.entries.length)
    this.timelineSlider.highlightEntry(index)
  }

  private handlePhaseChange(phase: PlaybackPhase): void {
    this.flashCard.setPhase(phase)
  }

  private handleTimeUpdate(time: number): void {
    this.timelineSlider.updatePlaybackPosition(time)
  }

  private handlePlaybackComplete(): void {
    this.flashCard.setPhase('idle')
  }

  private async preloadCache(): Promise<void> {
    if (!this.currentFile) {
      console.error('No file loaded')
      return
    }

    const entries = this.currentFile.entries

    // Prepare all texts to cache
    const textsToCache: Array<{ text: string; lang: 'en' | 'es' }> = []

    for (const entry of entries) {
      textsToCache.push(
        { text: entry.englishWord, lang: 'en' },
        { text: entry.spanishWord, lang: 'es' },
        { text: entry.spanishSentence, lang: 'es' }
      )
    }

    // Update button to show progress
    this.fileSelector.setPreloadButtonState(false, 'Loading...')

    try {
      await this.ttsService.preloadToCache(textsToCache, (current, total, text) => {
        const progress = Math.round((current / total) * 100)
        this.fileSelector.setPreloadButtonState(false, `Loading ${progress}%`)
        console.log(`[Cache] ${current}/${total}: ${text.substring(0, 30)}...`)
      })

      // Reset button
      this.fileSelector.setPreloadButtonState(true, 'Preload to Cache')
      console.log('[Cache] Preload complete!')

      // Show success message briefly
      this.fileSelector.setPreloadButtonState(true, '✓ Cache Loaded!')
      setTimeout(() => {
        this.fileSelector.setPreloadButtonState(true, 'Preload to Cache')
      }, 3000)
    } catch (error) {
      console.error('[Cache] Preload failed:', error)
      this.fileSelector.setPreloadButtonState(true, 'Preload Failed')
      setTimeout(() => {
        this.fileSelector.setPreloadButtonState(true, 'Preload to Cache')
      }, 3000)
    }
  }

  private async exportAudioFile(speed: number): Promise<void> {
    console.log('[Export] Starting export with speed:', speed)

    if (!this.currentFile) {
      console.error('[Export] No file loaded')
      this.playbackControls.setExportButtonState('error', 'No file loaded')
      return
    }

    const entries = this.currentFile.entries.map(entry => ({
      englishWord: entry.englishWord,
      spanishWord: entry.spanishWord,
      spanishSentence: entry.spanishSentence
    }))

    console.log('[Export] Exporting', entries.length, 'entries from', this.currentFile.name)

    this.playbackControls.setExportButtonState('exporting', 'Starting export...')

    // Setup progress listener
    window.electronAPI.onExportProgress((data) => {
      console.log('[Export Progress]', data.phase, data.percent + '%')
      const message = `${data.phase} (${data.percent}%)`
      this.playbackControls.setExportButtonState('exporting', message)
    })

    try {
      const result = await window.electronAPI.exportAudio(entries, this.currentFile.name, speed)
      console.log('[Export] Result:', result)

      if (result.success && result.path) {
        const filename = result.path.split('/').pop()
        this.playbackControls.setExportButtonState('success', `Saved: ${filename}`)
      } else {
        console.error('[Export] Failed:', result.error)
        this.playbackControls.setExportButtonState('error', result.error || 'Export failed')
      }
    } catch (error) {
      console.error('[Export] Exception:', error)
      this.playbackControls.setExportButtonState(
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }
}
