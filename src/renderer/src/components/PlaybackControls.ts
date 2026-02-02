import { PlaybackState } from '../types'

export class PlaybackControls {
  private container: HTMLElement
  private playBtn: HTMLButtonElement
  private pauseBtn: HTMLButtonElement
  private prevBtn: HTMLButtonElement
  private nextBtn: HTMLButtonElement
  private speedSelect: HTMLSelectElement
  private exportSpeedInput: HTMLInputElement
  private exportBtn: HTMLButtonElement
  private exportStatus: HTMLDivElement

  public onPlay: (() => void) | null = null
  public onPause: (() => void) | null = null
  public onPrev: (() => void) | null = null
  public onNext: (() => void) | null = null
  public onSpeedChange: ((rate: number) => void) | null = null
  public onExportAudio: ((speed: number) => void) | null = null

  constructor() {
    this.container = document.createElement('div')
    this.container.className = 'playback-controls'

    // Previous button
    this.prevBtn = this.createButton('btn-prev', '\u23EE', 'Previous')
    this.prevBtn.addEventListener('click', () => this.onPrev?.())

    // Play button
    this.playBtn = this.createButton('btn-play', '\u25B6', 'Play')
    this.playBtn.addEventListener('click', () => this.onPlay?.())

    // Pause button (hidden by default)
    this.pauseBtn = this.createButton('btn-pause', '\u23F8', 'Pause')
    this.pauseBtn.style.display = 'none'
    this.pauseBtn.addEventListener('click', () => this.onPause?.())

    // Next button
    this.nextBtn = this.createButton('btn-next', '\u23ED', 'Next')
    this.nextBtn.addEventListener('click', () => this.onNext?.())

    // Speed control
    const speedContainer = document.createElement('div')
    speedContainer.className = 'speed-container'

    const speedLabel = document.createElement('label')
    speedLabel.textContent = 'Speed:'
    speedLabel.htmlFor = 'speed-select'

    this.speedSelect = document.createElement('select')
    this.speedSelect.id = 'speed-select'
    this.speedSelect.className = 'speed-control'

    const speeds = [
      { value: 0.5, label: '0.5x' },
      { value: 0.75, label: '0.75x' },
      { value: 1, label: '1x' },
      { value: 1.25, label: '1.25x' },
      { value: 1.5, label: '1.5x' },
      { value: 2, label: '2x' }
    ]

    for (const speed of speeds) {
      const option = document.createElement('option')
      option.value = speed.value.toString()
      option.textContent = speed.label
      if (speed.value === 1) option.selected = true
      this.speedSelect.appendChild(option)
    }

    this.speedSelect.addEventListener('change', () => {
      const rate = parseFloat(this.speedSelect.value)
      this.onSpeedChange?.(rate)
    })

    speedContainer.appendChild(speedLabel)
    speedContainer.appendChild(this.speedSelect)

    // Export controls
    const exportContainer = document.createElement('div')
    exportContainer.className = 'export-container'

    const exportSpeedLabel = document.createElement('label')
    exportSpeedLabel.textContent = 'Export Speed:'
    exportSpeedLabel.htmlFor = 'export-speed-input'

    this.exportSpeedInput = document.createElement('input')
    this.exportSpeedInput.id = 'export-speed-input'
    this.exportSpeedInput.type = 'text'
    this.exportSpeedInput.className = 'export-speed-input'
    this.exportSpeedInput.value = '1.0'
    this.exportSpeedInput.placeholder = '1.0'

    this.exportBtn = document.createElement('button')
    this.exportBtn.className = 'preload-cache-button'
    this.exportBtn.textContent = 'Export Audio File'
    this.exportBtn.addEventListener('click', () => this.handleExportClick())

    this.exportStatus = document.createElement('div')
    this.exportStatus.className = 'export-status'

    exportContainer.appendChild(exportSpeedLabel)
    exportContainer.appendChild(this.exportSpeedInput)
    exportContainer.appendChild(this.exportBtn)
    exportContainer.appendChild(this.exportStatus)

    // Assemble controls
    this.container.appendChild(this.prevBtn)
    this.container.appendChild(this.playBtn)
    this.container.appendChild(this.pauseBtn)
    this.container.appendChild(this.nextBtn)
    this.container.appendChild(speedContainer)
    this.container.appendChild(exportContainer)
  }

  private createButton(className: string, icon: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = className
    btn.textContent = icon
    btn.title = title
    return btn
  }

  private handleExportClick(): void {
    const speedText = this.exportSpeedInput.value.trim()
    const speed = parseFloat(speedText)

    if (isNaN(speed) || speed < 0.1 || speed > 3.0) {
      this.exportStatus.textContent = 'Error: Speed must be between 0.1 and 3.0'
      this.exportStatus.style.color = '#ff6b6b'
      setTimeout(() => {
        this.exportStatus.textContent = ''
      }, 3000)
      return
    }

    this.onExportAudio?.(speed)
  }

  public setExportButtonState(
    state: 'idle' | 'exporting' | 'success' | 'error',
    message?: string
  ): void {
    switch (state) {
      case 'idle':
        this.exportBtn.disabled = false
        this.exportBtn.textContent = 'Export Audio'
        this.exportStatus.textContent = ''
        break
      case 'exporting':
        this.exportBtn.disabled = true
        this.exportBtn.textContent = 'Exporting...'
        this.exportStatus.textContent = message || 'Processing...'
        this.exportStatus.style.color = '#888'
        break
      case 'success':
        this.exportBtn.disabled = false
        this.exportBtn.textContent = '✓ Complete!'
        this.exportStatus.textContent = message || 'Export complete'
        this.exportStatus.style.color = '#4caf50'
        setTimeout(() => {
          this.exportBtn.textContent = 'Export Audio File'
          this.exportStatus.textContent = ''
        }, 3000)
        break
      case 'error':
        this.exportBtn.disabled = false
        this.exportBtn.textContent = 'Failed'
        this.exportStatus.textContent = message || 'Export failed'
        this.exportStatus.style.color = '#ff6b6b'
        setTimeout(() => {
          this.exportBtn.textContent = 'Export Audio File'
          this.exportStatus.textContent = ''
        }, 5000)
        break
    }
  }

  updateState(state: PlaybackState): void {
    if (state.isPlaying && !state.isPaused) {
      this.playBtn.style.display = 'none'
      this.pauseBtn.style.display = 'inline-flex'
    } else {
      this.playBtn.style.display = 'inline-flex'
      this.pauseBtn.style.display = 'none'
    }
  }

  setEnabled(enabled: boolean): void {
    this.playBtn.disabled = !enabled
    this.pauseBtn.disabled = !enabled
    this.prevBtn.disabled = !enabled
    this.nextBtn.disabled = !enabled
    this.speedSelect.disabled = !enabled
    this.exportBtn.disabled = !enabled
    this.exportSpeedInput.disabled = !enabled
  }

  getElement(): HTMLElement {
    return this.container
  }
}
