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

    // Playback controls
    this.playbackControls.onPlay = () => this.playbackEngine.play()
    this.playbackControls.onPause = () => this.playbackEngine.pause()
    this.playbackControls.onNext = () => this.playbackEngine.next()
    this.playbackControls.onPrev = () => this.playbackEngine.prev()
    this.playbackControls.onSpeedChange = (rate) => this.handleSpeedChange(rate)

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

    // TTS info
    const ttsInfo = document.createElement('div')
    ttsInfo.className = 'voice-info'
    ttsInfo.id = 'tts-info'
    ttsInfo.innerHTML = `
      <strong>TTS Engine:</strong> ElevenLabs (Multilingual v2)<br>
      <strong>Voice:</strong> Bella (Multilingual) - Supports Castilian Spanish
    `
    this.mainContainer.appendChild(ttsInfo)

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
}
