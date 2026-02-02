import { FlashcardEntry } from '../types'
import { estimateEntryDuration } from '../utils/timeUtils'

// Parse format: "english | spanish - sentence"
// Example: "action | acción - La acción de la película fue emocionante."
const ENTRY_REGEX = /^(.+?)\s*\|\s*(.+?)\s*-\s*(.+)$/

export function parseVocabularyFile(content: string, playbackRate: number = 1.0): FlashcardEntry[] {
  const lines = content.trim().split('\n')
  const entries: FlashcardEntry[] = []
  let cumulativeTime = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const match = line.match(ENTRY_REGEX)
    if (match) {
      const entry: FlashcardEntry = {
        id: i + 1,
        englishWord: match[1].trim(),
        spanishWord: match[2].trim(),
        spanishSentence: match[3].trim(),
        estimatedDuration: 0,
        cumulativeStartTime: cumulativeTime
      }

      // Calculate estimated duration
      entry.estimatedDuration = estimateEntryDuration(entry, playbackRate)
      cumulativeTime += entry.estimatedDuration

      entries.push(entry)
    } else {
      console.warn(`Line ${i + 1} does not match expected format: "${line}"`)
    }
  }

  return entries
}

export function recalculateDurations(entries: FlashcardEntry[], playbackRate: number): FlashcardEntry[] {
  let cumulativeTime = 0

  return entries.map(entry => {
    const estimatedDuration = estimateEntryDuration(entry, playbackRate)
    const updatedEntry = {
      ...entry,
      estimatedDuration,
      cumulativeStartTime: cumulativeTime
    }
    cumulativeTime += estimatedDuration
    return updatedEntry
  })
}

export function getTotalDuration(entries: FlashcardEntry[]): number {
  if (entries.length === 0) return 0
  const lastEntry = entries[entries.length - 1]
  return lastEntry.cumulativeStartTime + lastEntry.estimatedDuration
}
