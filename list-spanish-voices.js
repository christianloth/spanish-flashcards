// Script to list all available Spanish voices from ElevenLabs
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { config } from 'dotenv'

config({ path: '.env' })

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

async function listSpanishVoices() {
  try {
    const voices = await client.voices.getAll()

    console.log('\n=== CASTILIAN SPANISH VOICES FROM SPAIN ===\n')

    // Filter for Spanish voices
    const spanishVoices = voices.voices.filter(voice => {
      const desc = voice.description?.toLowerCase() || ''
      const labels = voice.labels || {}

      // Look for Spain/Castilian indicators
      return (
        desc.includes('spain') ||
        desc.includes('castilian') ||
        desc.includes('madrid') ||
        desc.includes('barcelona') ||
        desc.includes('spanish') ||
        labels.accent?.toLowerCase().includes('spanish') ||
        labels.accent?.toLowerCase().includes('castilian')
      )
    })

    spanishVoices.forEach(voice => {
      console.log(`Name: ${voice.name}`)
      console.log(`ID: ${voice.voice_id}`)
      console.log(`Category: ${voice.category || 'N/A'}`)
      console.log(`Description: ${voice.description || 'N/A'}`)
      console.log(`Labels:`, voice.labels)
      console.log('---')
    })

    console.log(`\nTotal Spanish/Castilian voices found: ${spanishVoices.length}`)

  } catch (error) {
    console.error('Error fetching voices:', error)
  }
}

listSpanishVoices()
