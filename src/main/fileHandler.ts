import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function getInputDirectory(): string {
  // In development, use the project's input directory
  // In production, use the app's resources directory
  if (process.env.NODE_ENV === 'development') {
    return join(process.cwd(), 'input')
  }
  return join(app.getAppPath(), 'input')
}

function listInputFiles(): string[] {
  const inputDir = getInputDirectory()
  try {
    const files = readdirSync(inputDir)
    // Filter for .txt files only
    return files.filter(file => file.endsWith('.txt'))
  } catch (error) {
    console.error('Error reading input directory:', error)
    return []
  }
}

function readVocabularyFile(filename: string): string {
  const inputDir = getInputDirectory()
  const filePath = join(inputDir, filename)
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error('Error reading vocabulary file:', error)
    return ''
  }
}

export { listInputFiles, readVocabularyFile, getInputDirectory }
