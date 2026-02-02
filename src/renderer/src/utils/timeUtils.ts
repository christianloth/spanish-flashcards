import { FlashcardEntry } from '../types'

// Average speaking rates (words per minute)
const ENGLISH_WPM = 150
const SPANISH_WPM = 180

// Pause durations (in seconds at rate 1.0)
export const PAUSE_AFTER_ENGLISH = 1.5
export const PAUSE_AFTER_SPANISH_WORD = 0.8
export const PAUSE_BETWEEN_ENTRIES = 1.0

/**
 * Estimate how long it takes to speak a piece of text
 */
function estimateTextDuration(text: string, lang: 'en' | 'es', rate: number): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length
  const wpm = lang === 'es' ? SPANISH_WPM : ENGLISH_WPM
  // Add a small base time for very short phrases
  const baseSeconds = Math.max(0.5, (words / wpm) * 60)
  return baseSeconds / rate
}

/**
 * Estimate total duration for a flashcard entry including pauses
 */
export function estimateEntryDuration(entry: FlashcardEntry, rate: number): number {
  const englishDuration = estimateTextDuration(entry.englishWord, 'en', rate)
  const spanishWordDuration = estimateTextDuration(entry.spanishWord, 'es', rate)
  const sentenceDuration = estimateTextDuration(entry.spanishSentence, 'es', rate)

  return (
    englishDuration +
    (PAUSE_AFTER_ENGLISH / rate) +
    spanishWordDuration +
    (PAUSE_AFTER_SPANISH_WORD / rate) +
    sentenceDuration +
    (PAUSE_BETWEEN_ENTRIES / rate)
  )
}

/**
 * Format seconds to MM:SS display
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Find the entry index at a given time position
 */
export function findEntryAtTime(entries: FlashcardEntry[], time: number): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].cumulativeStartTime <= time) {
      return i
    }
  }
  return 0
}

/**
 * Get entries that fall within a time window
 */
export function getEntriesInWindow(
  entries: FlashcardEntry[],
  startTime: number,
  endTime: number
): FlashcardEntry[] {
  return entries.filter(entry => {
    const entryEnd = entry.cumulativeStartTime + entry.estimatedDuration
    // Entry overlaps with window if it starts before window ends
    // and ends after window starts
    return entry.cumulativeStartTime < endTime && entryEnd > startTime
  })
}
