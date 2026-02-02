import { FlashcardEntry, TimeWindow } from '../types'
import { formatTime } from '../utils/timeUtils'

export class TimelineSlider {
  private container: HTMLElement
  private track: HTMLElement
  private windowEl: HTMLElement
  private leftHandle: HTMLElement
  private rightHandle: HTMLElement
  private entriesContainer: HTMLElement
  private currentMarker: HTMLElement
  private timeLabels: HTMLElement
  private startLabel: HTMLElement
  private endLabel: HTMLElement
  private windowStartLabel: HTMLElement
  private windowEndLabel: HTMLElement

  private totalDuration: number = 0
  private window: TimeWindow = { startTime: 0, endTime: 30 }
  private entries: FlashcardEntry[] = []
  private currentEntryIndex: number = -1

  private isDraggingWindow: boolean = false
  private isDraggingLeft: boolean = false
  private isDraggingRight: boolean = false
  private dragStartX: number = 0
  private dragStartWindow: TimeWindow = { startTime: 0, endTime: 0 }

  public onWindowChange: ((window: TimeWindow) => void) | null = null

  constructor() {
    this.container = document.createElement('div')
    this.container.className = 'timeline-container'

    // Window time labels
    const windowLabelsContainer = document.createElement('div')
    windowLabelsContainer.className = 'window-labels'
    this.windowStartLabel = document.createElement('span')
    this.windowStartLabel.className = 'window-start-label'
    this.windowEndLabel = document.createElement('span')
    this.windowEndLabel.className = 'window-end-label'
    windowLabelsContainer.appendChild(this.windowStartLabel)
    windowLabelsContainer.appendChild(this.windowEndLabel)

    // Track
    this.track = document.createElement('div')
    this.track.className = 'timeline-track'

    // Entry markers container
    this.entriesContainer = document.createElement('div')
    this.entriesContainer.className = 'timeline-entries'

    // Current position marker
    this.currentMarker = document.createElement('div')
    this.currentMarker.className = 'current-marker'

    // Selection window
    this.windowEl = document.createElement('div')
    this.windowEl.className = 'timeline-window'

    // Handles
    this.leftHandle = document.createElement('div')
    this.leftHandle.className = 'handle handle-left'

    this.rightHandle = document.createElement('div')
    this.rightHandle.className = 'handle handle-right'

    this.windowEl.appendChild(this.leftHandle)
    this.windowEl.appendChild(this.rightHandle)

    this.track.appendChild(this.entriesContainer)
    this.track.appendChild(this.windowEl)
    this.track.appendChild(this.currentMarker)

    // Time labels
    this.timeLabels = document.createElement('div')
    this.timeLabels.className = 'timeline-labels'

    this.startLabel = document.createElement('span')
    this.startLabel.className = 'time-start'
    this.startLabel.textContent = '0:00'

    this.endLabel = document.createElement('span')
    this.endLabel.className = 'time-end'
    this.endLabel.textContent = '0:00'

    this.timeLabels.appendChild(this.startLabel)
    this.timeLabels.appendChild(this.endLabel)

    this.container.appendChild(windowLabelsContainer)
    this.container.appendChild(this.track)
    this.container.appendChild(this.timeLabels)

    this.setupDragHandlers()
    this.updateVisuals()
  }

  private setupDragHandlers(): void {
    // Window drag - move entire selection
    this.windowEl.addEventListener('mousedown', (e) => {
      if (e.target === this.leftHandle || e.target === this.rightHandle) return
      this.isDraggingWindow = true
      this.dragStartX = e.clientX
      this.dragStartWindow = { ...this.window }
      e.preventDefault()
    })

    // Left handle drag
    this.leftHandle.addEventListener('mousedown', (e) => {
      this.isDraggingLeft = true
      this.dragStartX = e.clientX
      this.dragStartWindow = { ...this.window }
      e.preventDefault()
      e.stopPropagation()
    })

    // Right handle drag
    this.rightHandle.addEventListener('mousedown', (e) => {
      this.isDraggingRight = true
      this.dragStartX = e.clientX
      this.dragStartWindow = { ...this.window }
      e.preventDefault()
      e.stopPropagation()
    })

    // Mouse move handler
    document.addEventListener('mousemove', (e) => this.handleDrag(e))

    // Mouse up handler
    document.addEventListener('mouseup', () => this.endDrag())
  }

  private handleDrag(e: MouseEvent): void {
    if (!this.isDraggingWindow && !this.isDraggingLeft && !this.isDraggingRight) return

    const rect = this.track.getBoundingClientRect()
    const deltaX = e.clientX - this.dragStartX
    const deltaPercent = deltaX / rect.width
    const deltaTime = deltaPercent * this.totalDuration

    const minWindowSize = 5 // minimum 5 seconds

    if (this.isDraggingWindow) {
      const windowDuration = this.dragStartWindow.endTime - this.dragStartWindow.startTime
      let newStart = this.dragStartWindow.startTime + deltaTime
      newStart = Math.max(0, Math.min(newStart, this.totalDuration - windowDuration))

      this.window = {
        startTime: newStart,
        endTime: newStart + windowDuration
      }
    } else if (this.isDraggingLeft) {
      let newStart = this.dragStartWindow.startTime + deltaTime
      newStart = Math.max(0, Math.min(newStart, this.window.endTime - minWindowSize))
      this.window.startTime = newStart
    } else if (this.isDraggingRight) {
      let newEnd = this.dragStartWindow.endTime + deltaTime
      newEnd = Math.min(this.totalDuration, Math.max(newEnd, this.window.startTime + minWindowSize))
      this.window.endTime = newEnd
    }

    this.updateVisuals()
    this.onWindowChange?.(this.window)
  }

  private endDrag(): void {
    this.isDraggingWindow = false
    this.isDraggingLeft = false
    this.isDraggingRight = false
  }

  setDuration(duration: number): void {
    this.totalDuration = duration
    this.endLabel.textContent = formatTime(duration)

    // Reset window to first 30 seconds or full duration if shorter
    this.window = {
      startTime: 0,
      endTime: Math.min(30, duration)
    }

    this.updateVisuals()
  }

  setEntries(entries: FlashcardEntry[]): void {
    this.entries = entries
    this.renderEntryMarkers()
  }

  setWindow(window: TimeWindow): void {
    this.window = window
    this.updateVisuals()
    this.onWindowChange?.(window)
  }

  getWindow(): TimeWindow {
    return { ...this.window }
  }

  highlightEntry(index: number): void {
    this.currentEntryIndex = index

    // Update entry markers
    const markers = this.entriesContainer.querySelectorAll('.entry-marker')
    markers.forEach((marker, i) => {
      marker.classList.toggle('current', i === index)
    })

    // Update current position marker
    if (index >= 0 && index < this.entries.length) {
      const entry = this.entries[index]
      const percent = (entry.cumulativeStartTime / this.totalDuration) * 100
      this.currentMarker.style.left = `${percent}%`
      this.currentMarker.style.display = 'block'
    }
  }

  private renderEntryMarkers(): void {
    this.entriesContainer.innerHTML = ''

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]
      const marker = document.createElement('div')
      marker.className = 'entry-marker'
      if (i === this.currentEntryIndex) {
        marker.classList.add('current')
      }

      const percent = (entry.cumulativeStartTime / this.totalDuration) * 100
      marker.style.left = `${percent}%`
      marker.title = `${entry.englishWord} (${formatTime(entry.cumulativeStartTime)})`

      this.entriesContainer.appendChild(marker)
    }
  }

  private updateVisuals(): void {
    if (this.totalDuration === 0) return

    const startPercent = (this.window.startTime / this.totalDuration) * 100
    const endPercent = (this.window.endTime / this.totalDuration) * 100
    const widthPercent = endPercent - startPercent

    this.windowEl.style.left = `${startPercent}%`
    this.windowEl.style.width = `${widthPercent}%`

    // Update window time labels
    this.windowStartLabel.textContent = formatTime(this.window.startTime)
    this.windowEndLabel.textContent = formatTime(this.window.endTime)

    // Position window labels above the handles
    this.windowStartLabel.style.left = `${startPercent}%`
    this.windowEndLabel.style.left = `${endPercent}%`
  }

  getElement(): HTMLElement {
    return this.container
  }
}
