export interface FlashcardEntry {
  id: number
  englishWord: string
  spanishWord: string
  spanishSentence: string
  estimatedDuration: number  // seconds
  cumulativeStartTime: number // seconds from playlist start
}

export type PlaybackPhase =
  | 'idle'
  | 'english'
  | 'pause-after-english'
  | 'spanish-word'
  | 'pause-after-spanish-word'
  | 'spanish-sentence'
  | 'between-entries'

export interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean
  currentEntryIndex: number
  currentPhase: PlaybackPhase
  elapsedTime: number        // total elapsed in current session
  playbackRate: number       // 0.5 to 2.0
}

export interface TimeWindow {
  startTime: number  // seconds
  endTime: number    // seconds
}

export interface VocabularyFile {
  name: string
  path: string
  entries: FlashcardEntry[]
  totalDuration: number
}

// Event callbacks for playback engine
export interface PlaybackCallbacks {
  onStateChange: (state: PlaybackState) => void
  onEntryChange: (entry: FlashcardEntry, index: number) => void
  onPhaseChange: (phase: PlaybackPhase) => void
  onTimeUpdate: (elapsed: number) => void
  onComplete: () => void
}
