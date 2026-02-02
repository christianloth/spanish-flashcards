# TTS Audio Cache

This directory stores cached audio files from the ElevenLabs TTS API.

## Purpose

- **Reduces API costs**: Avoids redundant API calls for the same text/voice combinations
- **Improves performance**: Cached audio plays instantly (< 10ms vs 500-2000ms API calls)
- **Persists across sessions**: Cache survives app restarts

## Contents

- `{hash}.mp3` - Cached audio files (SHA256 hash of text + voiceId + languageCode)
- `cache-index.json` - Metadata tracking file

## Management

**View cache stats:** Open Settings → "Audio Cache" section

**Clear cache:** 
- Via UI: Settings → "Clear Cache" button
- Manually: Delete all `.mp3` files in this directory

## Storage

- Average file size: ~10-20 KB per word/sentence
- Typical cache size: ~5-10 MB for 300 entries

## Note

This directory is gitignored and will not be committed to version control.
