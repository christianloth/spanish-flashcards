// Test script for ElevenLabs API
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testElevenLabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  console.log('=== ElevenLabs API Test ===\n');

  // Check if API key exists
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY not found in .env');
    return;
  }

  console.log('API Key found:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5));

  // Create client
  const client = new ElevenLabsClient({ apiKey });

  // Test 1: Generate English audio directly
  console.log('\n--- Test 1: Generating English audio ---');
  try {
    const englishText = 'Hello, this is a test.';
    console.log('Text:', englishText);
    console.log('Calling ElevenLabs API...');

    const audioStream = await client.textToSpeech.convert('EXAVITQu4vr4xnSDxMaL', {
      text: englishText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    });

    console.log('Got audio stream, collecting chunks...');

    // Collect chunks
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
      process.stdout.write('.');
    }
    console.log(' done!');

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const outputPath = path.join(__dirname, 'test-english.mp3');
    fs.writeFileSync(outputPath, audioBuffer);
    console.log('SUCCESS: Audio saved to', outputPath);
    console.log('File size:', audioBuffer.length, 'bytes');
  } catch (error) {
    console.error('FAILED: Could not generate English audio');
    console.error('Error:', error.message);
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
    if (error.body) {
      console.error('Response body:', JSON.stringify(error.body, null, 2));
    }
    return; // Stop if TTS fails
  }

  // Test 2: Generate Spanish audio
  console.log('\n--- Test 2: Generating Spanish audio ---');
  try {
    const spanishText = 'Hola, esta es una prueba de la voz en español de España.';
    console.log('Text:', spanishText);
    console.log('Calling ElevenLabs API...');

    const audioStream = await client.textToSpeech.convert('EXAVITQu4vr4xnSDxMaL', {
      text: spanishText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    });

    console.log('Got audio stream, collecting chunks...');

    // Collect chunks
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
      process.stdout.write('.');
    }
    console.log(' done!');

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const outputPath = path.join(__dirname, 'test-spanish.mp3');
    fs.writeFileSync(outputPath, audioBuffer);
    console.log('SUCCESS: Audio saved to', outputPath);
    console.log('File size:', audioBuffer.length, 'bytes');
  } catch (error) {
    console.error('FAILED: Could not generate Spanish audio');
    console.error('Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
  console.log('\nTo play the audio files:');
  console.log('  open test-english.mp3');
  console.log('  open test-spanish.mp3');
}

testElevenLabs().catch(console.error);
