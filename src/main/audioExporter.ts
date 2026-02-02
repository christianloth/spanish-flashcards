import ffmpeg from 'fluent-ffmpeg'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { synthesizeSpeech } from './ttsHandler'
import { createHash } from 'crypto'

const CACHE_DIR = join(process.cwd(), '.tts-cache')
const OUTPUT_DIR = join(process.cwd(), 'output')
const TEMP_DIR = join(OUTPUT_DIR, '.temp')

interface FlashcardEntry {
  englishWord: string
  spanishWord: string
  spanishSentence: string
}

interface ExportProgress {
  phase: string
  percent: number
}

interface ExportResult {
  success: boolean
  path?: string
  error?: string
}

type ProgressCallback = (phase: string, percent: number) => void

// Generate cache key matching ttsHandler pattern
function generateCacheKey(text: string, voiceId: string, languageCode: string): string {
  const hash = createHash('sha256')
  hash.update(`${text}|${voiceId}|${languageCode}`)
  return hash.digest('hex')
}

// Get cached MP3 file path if it exists
function getCachedAudioPath(text: string, language: 'en' | 'es'): string | null {
  const voiceId = language === 'es' ? 'jtfxplhZxnBzQICVwoQn' : 'EXAVITQu4vr4xnSDxMaL'
  const languageCode = language === 'es' ? 'es-ES' : 'en-US'
  const cacheKey = generateCacheKey(text, voiceId, languageCode)
  const cachePath = join(CACHE_DIR, `${cacheKey}.mp3`)

  return existsSync(cachePath) ? cachePath : null
}

// Convert base64 data URL to MP3 file
function dataUrlToFile(dataUrl: string, outputPath: string): void {
  const base64Data = dataUrl.replace(/^data:audio\/mpeg;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  writeFileSync(outputPath, buffer)
}

// Generate silence MP3 file using a WAV file intermediate
function generateSilence(duration: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a silent WAV file programmatically
    const sampleRate = 44100
    const numChannels = 2
    const bitsPerSample = 16
    const numSamples = Math.floor(sampleRate * duration)
    const dataSize = numSamples * numChannels * (bitsPerSample / 8)

    // WAV header
    const buffer = Buffer.alloc(44 + dataSize)

    // "RIFF" chunk descriptor
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)

    // "fmt " sub-chunk
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16) // Subchunk1Size
    buffer.writeUInt16LE(1, 20) // AudioFormat (PCM)
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28) // ByteRate
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32) // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34)

    // "data" sub-chunk
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)

    // Write zeros for silence (already initialized to 0 by Buffer.alloc)

    // Write WAV file
    const wavPath = outputPath.replace('.mp3', '.wav')
    writeFileSync(wavPath, buffer)

    // Convert WAV to MP3
    ffmpeg()
      .input(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .audioChannels(2)
      .audioFrequency(44100)
      .on('end', () => {
        // Clean up WAV file
        try {
          unlinkSync(wavPath)
        } catch (e) {
          console.warn('[AudioExporter] Failed to cleanup WAV:', e)
        }
        resolve()
      })
      .on('error', (err) => {
        // Clean up WAV file on error
        try {
          unlinkSync(wavPath)
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(err)
      })
      .save(outputPath)
  })
}

// Concatenate audio files using FFmpeg concat filter (handles mixed formats properly)
function concatenateAudio(inputPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    // Add all input files
    inputPaths.forEach((path) => command.input(path))

    // Build filter complex: [0:a][1:a][2:a]...concat=n=N:v=0:a=1[outa]
    // This properly decodes all inputs to PCM first, then concatenates
    const filterInputs = inputPaths.map((_, i) => `[${i}:a]`).join('')
    const filterComplex = `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[outa]`

    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', '[outa]'])
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .audioChannels(2)
      .audioFrequency(44100)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

// Main export function
export async function exportAudioFile(
  entries: FlashcardEntry[],
  filename: string,
  speed: number,
  onProgress: ProgressCallback
): Promise<ExportResult> {
  console.log('[AudioExporter] Starting export:', { entries: entries.length, filename, speed })

  try {
    // Create output directories
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true })
      console.log('[AudioExporter] Created output directory:', OUTPUT_DIR)
    }
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true })
      console.log('[AudioExporter] Created temp directory:', TEMP_DIR)
    }

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '-')
    const baseName = filename.replace(/\.[^/.]+$/, '') // Remove extension
    const outputPath = join(OUTPUT_DIR, `${baseName}-export-${timestamp}.mp3`)

    // Calculate scaled pause durations
    const pause1 = 1.5 / speed
    const pause2 = 0.8 / speed
    const pause3 = 1.0 / speed

    // Generate silence files
    onProgress('Preparing silence tracks', 0)
    const silence1Path = join(TEMP_DIR, `silence-${pause1.toFixed(2)}s.mp3`)
    const silence2Path = join(TEMP_DIR, `silence-${pause2.toFixed(2)}s.mp3`)
    const silence3Path = join(TEMP_DIR, `silence-${pause3.toFixed(2)}s.mp3`)

    console.log('[AudioExporter] Generating silence files:', { pause1, pause2, pause3 })
    await generateSilence(pause1, silence1Path)
    await generateSilence(pause2, silence2Path)
    await generateSilence(pause3, silence3Path)
    console.log('[AudioExporter] Silence files created')

    // Generate/fetch TTS for all entries
    const totalCards = entries.length
    const audioPaths: string[] = []
    const tempFiles: string[] = []

    for (let i = 0; i < totalCards; i++) {
      const entry = entries[i]
      const progress = Math.floor((i / totalCards) * 70)
      onProgress(`Generating TTS (${i + 1}/${totalCards})`, progress)

      // English audio
      let englishPath = getCachedAudioPath(entry.englishWord, 'en')
      if (!englishPath) {
        const dataUrl = await synthesizeSpeech(entry.englishWord, 'en')
        englishPath = join(TEMP_DIR, `temp-en-${i}.mp3`)
        dataUrlToFile(dataUrl, englishPath)
        tempFiles.push(englishPath)
      }
      audioPaths.push(englishPath)
      audioPaths.push(silence1Path)

      // Spanish word audio
      let spanishWordPath = getCachedAudioPath(entry.spanishWord, 'es')
      if (!spanishWordPath) {
        const dataUrl = await synthesizeSpeech(entry.spanishWord, 'es')
        spanishWordPath = join(TEMP_DIR, `temp-es-word-${i}.mp3`)
        dataUrlToFile(dataUrl, spanishWordPath)
        tempFiles.push(spanishWordPath)
      }
      audioPaths.push(spanishWordPath)
      audioPaths.push(silence2Path)

      // Spanish sentence audio
      let spanishSentencePath = getCachedAudioPath(entry.spanishSentence, 'es')
      if (!spanishSentencePath) {
        const dataUrl = await synthesizeSpeech(entry.spanishSentence, 'es')
        spanishSentencePath = join(TEMP_DIR, `temp-es-sentence-${i}.mp3`)
        dataUrlToFile(dataUrl, spanishSentencePath)
        tempFiles.push(spanishSentencePath)
      }
      audioPaths.push(spanishSentencePath)
      audioPaths.push(silence3Path)
    }

    // Concatenate all audio files using filter complex
    onProgress('Assembling audio', 75)
    console.log('[AudioExporter] Starting FFmpeg concatenation with', audioPaths.length, 'audio files')
    await concatenateAudio(audioPaths, outputPath)
    console.log('[AudioExporter] FFmpeg concatenation complete')

    // Cleanup temp files
    onProgress('Saving', 95)
    tempFiles.forEach(path => {
      try {
        if (existsSync(path)) unlinkSync(path)
      } catch (error) {
        console.error(`Failed to cleanup temp file ${path}:`, error)
      }
    })

    // Cleanup silence files
    ;[silence1Path, silence2Path, silence3Path].forEach(path => {
      try {
        if (existsSync(path)) unlinkSync(path)
      } catch (error) {
        console.error(`Failed to cleanup temp file ${path}:`, error)
      }
    })

    onProgress('Complete', 100)
    console.log('[AudioExporter] Export complete:', outputPath)
    return { success: true, path: outputPath }
  } catch (error) {
    console.error('[AudioExporter] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Check if FFmpeg is available
export function checkFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      resolve(!err)
    })
  })
}
