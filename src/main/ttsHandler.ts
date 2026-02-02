import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { config } from 'dotenv'
import { createHash } from 'crypto'

// Load .env file from project root
config({ path: join(process.cwd(), '.env') })

let client: ElevenLabsClient | null = null
let apiKey: string | null = null

// Cache configuration - store in project directory
const CACHE_DIR = join(process.cwd(), '.tts-cache')
const CACHE_INDEX_PATH = join(CACHE_DIR, 'cache-index.json')

interface CacheEntry {
  text: string
  voiceId: string
  languageCode: string
  timestamp: number
  fileSize: number
  lastAccessed: number
}

interface CacheIndex {
  version: string
  entries: Record<string, CacheEntry>
}

let cacheIndex: CacheIndex = { version: '1.0', entries: {} }

// Initialize from environment variable if available
export function initFromEnv(): void {
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey && envKey.trim() !== '') {
    setApiKey(envKey)
    console.log('ElevenLabs API key loaded from .env file')
  }

  // Initialize cache
  ensureCacheDir()
  loadCacheIndex()
}

// Voice IDs for ElevenLabs - Castilian Spanish voices from Spain
const VOICE_IDS = {
  // Spanish - David Martin: Peninsular Spanish, kind and close tone
  spanish: 'jtfxplhZxnBzQICVwoQn', // "David Martin" - Peninsular Spanish
  // English - clear voice
  english: 'EXAVITQu4vr4xnSDxMaL'  // "Bella" - multilingual
}

// Alternative high-quality voices (user can change in settings)
export const AVAILABLE_VOICES = [
  // Castilian Spanish voices from Spain
  { id: 'jtfxplhZxnBzQICVwoQn', name: 'David Martin (Peninsular - Kind)', gender: 'male' },
  { id: 'PBaBRSRTvwmnK1PAq9e0', name: 'JeiJo (Castilian - Madrid/León)', gender: 'male' },
  { id: 'nMPrFLO7QElx9wTR0JGo', name: 'Ginyin (Castilian - Young Male)', gender: 'male' },
  { id: 'BPoDAH7n4gFrnGY27Jkj', name: 'Frankie (Spanish - Neutral)', gender: 'male' },
  { id: 'Rfj8YxsU5Gg9QdQE7F9O', name: 'Javier Madrid (Spanish)', gender: 'male' },
  { id: 'HYlEvvU9GMan5YdjFYpg', name: 'Loida (Spanish - Young Female)', gender: 'female' },
  // General multilingual voices
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Multilingual)', gender: 'female' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male' },
]

// Cache directory setup
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
    console.log('[TTS Cache] Created cache directory:', CACHE_DIR)
  }
}

// Load cache index from disk
function loadCacheIndex(): void {
  if (existsSync(CACHE_INDEX_PATH)) {
    try {
      const data = readFileSync(CACHE_INDEX_PATH, 'utf8')
      cacheIndex = JSON.parse(data)
      console.log(`[TTS Cache] Loaded index with ${Object.keys(cacheIndex.entries).length} entries`)
    } catch (error) {
      console.error('[TTS Cache] Error loading cache index:', error)
      cacheIndex = { version: '1.0', entries: {} }
    }
  }
}

// Save cache index to disk
function saveCacheIndex(): void {
  try {
    writeFileSync(CACHE_INDEX_PATH, JSON.stringify(cacheIndex, null, 2))
  } catch (error) {
    console.error('[TTS Cache] Error saving cache index:', error)
  }
}

// Generate cache key from text, voice, and language
function generateCacheKey(text: string, voiceId: string, languageCode: string): string {
  const hash = createHash('sha256')
  hash.update(`${text}|${voiceId}|${languageCode}`)
  return hash.digest('hex')
}

export function setApiKey(key: string): boolean {
  if (!key || key.trim() === '') {
    apiKey = null
    client = null
    return false
  }

  apiKey = key.trim()
  client = new ElevenLabsClient({ apiKey })
  return true
}

export function getApiKey(): string | null {
  return apiKey
}

export function isConfigured(): boolean {
  return client !== null && apiKey !== null
}

export async function synthesizeSpeech(
  text: string,
  language: 'en' | 'es',
  voiceId?: string
): Promise<string> {
  if (!client) {
    throw new Error('ElevenLabs API key not configured')
  }

  ensureCacheDir()

  const selectedVoiceId = voiceId || (language === 'es' ? VOICE_IDS.spanish : VOICE_IDS.english)
  const languageCode = language === 'es' ? 'es-ES' : 'en-US'
  const cacheKey = generateCacheKey(text, selectedVoiceId, languageCode)
  const cachePath = join(CACHE_DIR, `${cacheKey}.mp3`)

  // CACHE HIT - return existing audio
  if (existsSync(cachePath)) {
    console.log('[TTS Cache] Hit:', text)
    const audioBuffer = readFileSync(cachePath)

    // Update lastAccessed timestamp
    if (cacheIndex.entries[cacheKey]) {
      cacheIndex.entries[cacheKey].lastAccessed = Date.now()
      saveCacheIndex()
    }

    return `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`
  }

  // CACHE MISS - call API
  console.log('[TTS Cache] Miss, calling API:', text)

  try {
    // Generate audio using ElevenLabs
    // eleven_multilingual_v2 automatically detects language from text
    const audioStream = await client.textToSpeech.convert(selectedVoiceId, {
      text,
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true
      }
    })

    // Collect audio chunks
    const chunks: Uint8Array[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk)
    }

    // Combine chunks into a single buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const audioData = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      audioData.set(chunk, offset)
      offset += chunk.length
    }
    const audioBuffer = Buffer.from(audioData)

    console.log(`[TTS] Audio generated: ${audioBuffer.length} bytes`)

    // SAVE TO CACHE
    writeFileSync(cachePath, audioBuffer)
    cacheIndex.entries[cacheKey] = {
      text,
      voiceId: selectedVoiceId,
      languageCode,
      timestamp: Date.now(),
      fileSize: audioBuffer.length,
      lastAccessed: Date.now()
    }
    saveCacheIndex()
    console.log('[TTS Cache] Saved to cache')

    // Return as base64 data URL (works with Content Security Policy)
    const base64Audio = audioBuffer.toString('base64')
    return `data:audio/mpeg;base64,${base64Audio}`
  } catch (error) {
    console.error('ElevenLabs TTS error:', error)
    throw error
  }
}

export function cleanupAudioFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  } catch (error) {
    console.error('Error cleaning up audio file:', error)
  }
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: 'API key not configured' }
  }

  try {
    // Test by generating a tiny audio clip - this works with basic API keys
    const audioStream = await client.textToSpeech.convert('EXAVITQu4vr4xnSDxMaL', {
      text: 'Test',
      modelId: 'eleven_multilingual_v2'
    })

    // Just check we can get some data
    for await (const chunk of audioStream) {
      if (chunk.length > 0) {
        return { success: true }
      }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export function getAvailableVoices() {
  return AVAILABLE_VOICES
}

// Cache management functions
export function getCacheStats() {
  const entries = Object.values(cacheIndex.entries)
  const totalFiles = entries.length
  const totalSize = entries.reduce((sum, entry) => sum + entry.fileSize, 0)

  if (entries.length === 0) {
    return {
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      oldestEntry: null,
      newestEntry: null
    }
  }

  const oldestEntry = entries.reduce((min, e) =>
    e.timestamp < min ? e.timestamp : min, Date.now())
  const newestEntry = entries.reduce((max, e) =>
    e.timestamp > max ? e.timestamp : max, 0)

  return {
    totalFiles,
    totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    oldestEntry: new Date(oldestEntry).toISOString(),
    newestEntry: new Date(newestEntry).toISOString()
  }
}

export function clearCache() {
  // Delete all MP3 files
  ensureCacheDir()
  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.mp3'))
  files.forEach(f => unlinkSync(join(CACHE_DIR, f)))

  // Reset index
  cacheIndex = { version: '1.0', entries: {} }
  saveCacheIndex()

  console.log(`[TTS Cache] Cleared ${files.length} cached files`)
  return { deleted: files.length }
}
