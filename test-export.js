// Quick test script for audio export functionality
const { exportAudioFile } = require('./out/main/audioExporter')

const testEntries = [
  {
    englishWord: 'hello',
    spanishWord: 'hola',
    spanishSentence: 'Hola, ¿cómo estás?'
  },
  {
    englishWord: 'goodbye',
    spanishWord: 'adiós',
    spanishSentence: 'Adiós, hasta luego.'
  }
]

async function test() {
  console.log('Testing audio export with 2 entries...')

  const result = await exportAudioFile(
    testEntries,
    'test.txt',
    1.0,
    (phase, percent) => {
      console.log(`Progress: ${phase} (${percent}%)`)
    }
  )

  console.log('\nResult:', result)

  if (result.success) {
    console.log('\n✓ Export successful!')
    console.log('Output file:', result.path)
  } else {
    console.log('\n✗ Export failed!')
    console.log('Error:', result.error)
  }
}

test().catch(console.error)
