import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { config } from 'dotenv'

// Load .env file from project root
config({ path: join(process.cwd(), '.env') })

let client: ElevenLabsClient | null = null
let apiKey: string | null = null

// Initialize from environment variable if available
export function initFromEnv(): void {
  const envKey = process.env.ELEVENLABS_API_KEY
  if (envKey && envKey.trim() !== '') {
    setApiKey(envKey)
    console.log('ElevenLabs API key loaded from .env file')
  }
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

function getTempDir(): string {
  const tempDir = join(app.getPath('temp'), 'spanish-flashcards-audio')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
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

  const selectedVoiceId = voiceId || (language === 'es' ? VOICE_IDS.spanish : VOICE_IDS.english)

  try {
    console.log(`[TTS] Generating audio for: "${text.substring(0, 30)}..." (${language})`)

    // Generate audio using ElevenLabs
    // Use language_code to ensure correct accent (es-ES = Castilian Spanish from Spain)
    const audioStream = await client.textToSpeech.convert(selectedVoiceId, {
      text,
      model_id: 'eleven_multilingual_v2', // Best for Spanish (Spain)
      language_code: language === 'es' ? 'es-ES' : 'en-US', // Castilian Spanish
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    })

    // Collect audio chunks
    const chunks: Uint8Array[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk)
    }

    // Combine chunks into a single buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const audioBuffer = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset)
      offset += chunk.length
    }

    console.log(`[TTS] Audio generated: ${audioBuffer.length} bytes`)

    // Return as base64 data URL (works with Content Security Policy)
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`
    console.log(`[TTS] Returning data URL (${dataUrl.length} chars), prefix: ${dataUrl.substring(0, 40)}...`)
    return dataUrl
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
      model_id: 'eleven_multilingual_v2'
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
