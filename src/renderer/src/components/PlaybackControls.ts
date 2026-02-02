import { PlaybackState } from '../types'

export class PlaybackControls {
  private container: HTMLElement
  private playBtn: HTMLButtonElement
  private pauseBtn: HTMLButtonElement
  private prevBtn: HTMLButtonElement
  private nextBtn: HTMLButtonElement
  private speedSelect: HTMLSelectElement

  public onPlay: (() => void) | null = null
  public onPause: (() => void) | null = null
  public onPrev: (() => void) | null = null
  public onNext: (() => void) | null = null
  public onSpeedChange: ((rate: number) => void) | null = null

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

    // Assemble controls
    this.container.appendChild(this.prevBtn)
    this.container.appendChild(this.playBtn)
    this.container.appendChild(this.pauseBtn)
    this.container.appendChild(this.nextBtn)
    this.container.appendChild(speedContainer)
  }

  private createButton(className: string, icon: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = className
    btn.textContent = icon
    btn.title = title
    return btn
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
  }

  getElement(): HTMLElement {
    return this.container
  }
}
