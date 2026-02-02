import { FlashcardEntry, PlaybackPhase } from '../types'

export class FlashCard {
  private container: HTMLElement
  private cardInner: HTMLElement
  private frontFace: HTMLElement
  private backFace: HTMLElement
  private cardNumber: HTMLElement
  private englishWord: HTMLElement
  private spanishWord: HTMLElement
  private spanishSentence: HTMLElement
  private phaseIndicator: HTMLElement

  private isFlipped: boolean = false
  private currentEntry: FlashcardEntry | null = null
  private totalEntries: number = 0

  constructor() {
    this.container = document.createElement('div')
    this.container.className = 'flashcard'

    // Card number display
    this.cardNumber = document.createElement('div')
    this.cardNumber.className = 'card-number'
    this.cardNumber.textContent = 'No card loaded'

    // Card inner (for 3D flip)
    this.cardInner = document.createElement('div')
    this.cardInner.className = 'flashcard-inner'

    // Front face (English)
    this.frontFace = document.createElement('div')
    this.frontFace.className = 'flashcard-face flashcard-front'

    this.englishWord = document.createElement('div')
    this.englishWord.className = 'english-word'
    this.englishWord.textContent = 'English'

    const frontLabel = document.createElement('div')
    frontLabel.className = 'face-label'
    frontLabel.textContent = 'ENGLISH'

    this.frontFace.appendChild(frontLabel)
    this.frontFace.appendChild(this.englishWord)

    // Back face (Spanish)
    this.backFace = document.createElement('div')
    this.backFace.className = 'flashcard-face flashcard-back'

    const backLabel = document.createElement('div')
    backLabel.className = 'face-label'
    backLabel.textContent = 'SPANISH'

    this.spanishWord = document.createElement('div')
    this.spanishWord.className = 'spanish-word'
    this.spanishWord.textContent = 'Spanish'

    this.spanishSentence = document.createElement('div')
    this.spanishSentence.className = 'spanish-sentence'
    this.spanishSentence.textContent = 'Example sentence'

    this.backFace.appendChild(backLabel)
    this.backFace.appendChild(this.spanishWord)
    this.backFace.appendChild(this.spanishSentence)

    // Assemble card
    this.cardInner.appendChild(this.frontFace)
    this.cardInner.appendChild(this.backFace)

    // Phase indicator
    this.phaseIndicator = document.createElement('div')
    this.phaseIndicator.className = 'phase-indicator'
    this.phaseIndicator.textContent = 'Ready'

    this.container.appendChild(this.cardNumber)
    this.container.appendChild(this.cardInner)
    this.container.appendChild(this.phaseIndicator)
  }

  setEntry(entry: FlashcardEntry, index: number, total: number): void {
    this.currentEntry = entry
    this.totalEntries = total

    this.cardNumber.textContent = `Word ${index + 1} of ${total}`
    this.englishWord.textContent = entry.englishWord
    this.spanishWord.textContent = entry.spanishWord
    this.spanishSentence.textContent = entry.spanishSentence

    // Reset to front side without animation for new cards
    this.setFlipped(false, false)
  }

  setPhase(phase: PlaybackPhase): void {
    // Determine if card should be flipped based on phase
    const shouldFlip = phase === 'spanish-word' ||
      phase === 'pause-after-spanish-word' ||
      phase === 'spanish-sentence'

    this.setFlipped(shouldFlip, true)

    // Update phase indicator
    const phaseLabels: Record<PlaybackPhase, string> = {
      'idle': 'Ready',
      'english': 'Speaking: English',
      'pause-after-english': 'Pausing...',
      'spanish-word': 'Speaking: Spanish word',
      'pause-after-spanish-word': 'Pausing...',
      'spanish-sentence': 'Speaking: Spanish sentence',
      'between-entries': 'Next word...'
    }

    this.phaseIndicator.textContent = phaseLabels[phase]

    // Highlight active side
    this.frontFace.classList.toggle('active', phase === 'english')
    this.backFace.classList.toggle('active',
      phase === 'spanish-word' || phase === 'spanish-sentence')
  }

  private setFlipped(flipped: boolean, animate: boolean = true): void {
    if (this.isFlipped === flipped) return

    this.isFlipped = flipped

    if (!animate) {
      // Instant flip without animation
      this.cardInner.style.transition = 'none'
      this.container.classList.toggle('flipped', flipped)
      // Force reflow
      this.cardInner.offsetHeight
      this.cardInner.style.transition = ''
    } else {
      this.container.classList.toggle('flipped', flipped)
    }
  }

  reset(): void {
    this.currentEntry = null
    this.cardNumber.textContent = 'No card loaded'
    this.englishWord.textContent = ''
    this.spanishWord.textContent = ''
    this.spanishSentence.textContent = ''
    this.phaseIndicator.textContent = 'Ready'
    this.setFlipped(false, false)
  }

  getElement(): HTMLElement {
    return this.container
  }
}
