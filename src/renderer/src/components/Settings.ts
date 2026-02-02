import { TTSService } from '../services/TTSService'

export class Settings {
  private container: HTMLElement
  private apiKeyInput: HTMLInputElement
  private saveButton: HTMLButtonElement
  private testButton: HTMLButtonElement
  private statusEl: HTMLElement
  private ttsService: TTSService
  private cacheStatsEl: HTMLElement
  private clearCacheButton: HTMLButtonElement

  public onConfigured: (() => void) | null = null

  constructor(ttsService: TTSService) {
    this.ttsService = ttsService
    this.container = document.createElement('div')
    this.container.className = 'settings-panel'

    // Title
    const title = document.createElement('h2')
    title.textContent = 'ElevenLabs Setup'

    // Description
    const description = document.createElement('p')
    description.className = 'settings-description'
    description.innerHTML = `
      This app uses <a href="https://elevenlabs.io" target="_blank">ElevenLabs</a> for high-quality
      Castilian Spanish text-to-speech. You'll need a free API key to get started.
      <br><br>
      <strong>Get your free API key:</strong>
      <ol>
        <li>Sign up at <a href="https://elevenlabs.io" target="_blank">elevenlabs.io</a></li>
        <li>Go to Profile Settings → API Keys</li>
        <li>Copy your API key and paste it below</li>
      </ol>
    `

    // API Key input group
    const inputGroup = document.createElement('div')
    inputGroup.className = 'input-group'

    const label = document.createElement('label')
    label.textContent = 'API Key:'
    label.htmlFor = 'api-key-input'

    this.apiKeyInput = document.createElement('input')
    this.apiKeyInput.type = 'password'
    this.apiKeyInput.id = 'api-key-input'
    this.apiKeyInput.placeholder = 'Enter your ElevenLabs API key'
    this.apiKeyInput.autocomplete = 'off'

    inputGroup.appendChild(label)
    inputGroup.appendChild(this.apiKeyInput)

    // Buttons
    const buttonGroup = document.createElement('div')
    buttonGroup.className = 'button-group'

    this.testButton = document.createElement('button')
    this.testButton.textContent = 'Test Connection'
    this.testButton.className = 'btn-secondary'
    this.testButton.addEventListener('click', () => this.testConnection())

    this.saveButton = document.createElement('button')
    this.saveButton.textContent = 'Save & Continue'
    this.saveButton.className = 'btn-primary'
    this.saveButton.addEventListener('click', () => this.saveApiKey())

    buttonGroup.appendChild(this.testButton)
    buttonGroup.appendChild(this.saveButton)

    // Status message
    this.statusEl = document.createElement('div')
    this.statusEl.className = 'settings-status'

    // Cache section
    const cacheSection = document.createElement('div')
    cacheSection.className = 'settings-section'
    cacheSection.style.marginTop = '30px'
    cacheSection.style.paddingTop = '20px'
    cacheSection.style.borderTop = '1px solid #e0e0e0'

    const cacheTitle = document.createElement('h3')
    cacheTitle.textContent = 'Audio Cache'
    cacheTitle.style.marginBottom = '10px'

    this.cacheStatsEl = document.createElement('div')
    this.cacheStatsEl.id = 'cache-stats'
    this.cacheStatsEl.style.margin = '10px 0'
    this.cacheStatsEl.style.padding = '15px'
    this.cacheStatsEl.style.background = '#f5f5f5'
    this.cacheStatsEl.style.borderRadius = '4px'
    this.cacheStatsEl.innerHTML = '<p style="margin: 0;">Loading cache statistics...</p>'

    this.clearCacheButton = document.createElement('button')
    this.clearCacheButton.id = 'clear-cache-btn'
    this.clearCacheButton.textContent = 'Clear Cache'
    this.clearCacheButton.className = 'btn-secondary'
    this.clearCacheButton.style.marginTop = '10px'
    this.clearCacheButton.addEventListener('click', () => this.clearCache())

    cacheSection.appendChild(cacheTitle)
    cacheSection.appendChild(this.cacheStatsEl)
    cacheSection.appendChild(this.clearCacheButton)

    // Assemble
    this.container.appendChild(title)
    this.container.appendChild(description)
    this.container.appendChild(inputGroup)
    this.container.appendChild(buttonGroup)
    this.container.appendChild(this.statusEl)
    this.container.appendChild(cacheSection)

    // Check if already configured
    this.checkExistingKey()
    // Load cache stats
    this.updateCacheStats()
  }

  private async checkExistingKey(): Promise<void> {
    const key = await this.ttsService.getApiKey()
    if (key) {
      this.apiKeyInput.value = key
      this.showStatus('API key already configured', 'success')
    }
  }

  private async testConnection(): Promise<void> {
    const key = this.apiKeyInput.value.trim()
    if (!key) {
      this.showStatus('Please enter an API key', 'error')
      return
    }

    this.showStatus('Testing connection...', 'info')
    this.testButton.disabled = true

    // Temporarily set the key for testing
    await this.ttsService.setApiKey(key)
    const result = await this.ttsService.testConnection()

    this.testButton.disabled = false

    if (result.success) {
      this.showStatus('Connection successful! Your API key is valid.', 'success')
    } else {
      this.showStatus(`Connection failed: ${result.error || 'Unknown error'}`, 'error')
    }
  }

  private async saveApiKey(): Promise<void> {
    const key = this.apiKeyInput.value.trim()
    if (!key) {
      this.showStatus('Please enter an API key', 'error')
      return
    }

    this.showStatus('Saving...', 'info')
    this.saveButton.disabled = true

    const success = await this.ttsService.setApiKey(key)

    if (success) {
      this.showStatus('API key saved successfully!', 'success')
      // Notify that configuration is complete
      setTimeout(() => {
        this.onConfigured?.()
      }, 500)
    } else {
      this.showStatus('Failed to save API key', 'error')
      this.saveButton.disabled = false
    }
  }

  private showStatus(message: string, type: 'info' | 'success' | 'error'): void {
    this.statusEl.textContent = message
    this.statusEl.className = `settings-status status-${type}`
  }

  private async updateCacheStats(): Promise<void> {
    try {
      const stats = await window.electronAPI.tts.getCacheStats()

      if (stats.totalFiles === 0) {
        this.cacheStatsEl.innerHTML = '<p style="margin: 0;">No cached audio files yet.</p>'
        return
      }

      const oldestDate = stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleDateString() : 'N/A'
      const newestDate = stats.newestEntry ? new Date(stats.newestEntry).toLocaleDateString() : 'N/A'

      this.cacheStatsEl.innerHTML = `
        <p style="margin: 5px 0;"><strong>Cached Audio Files:</strong> ${stats.totalFiles}</p>
        <p style="margin: 5px 0;"><strong>Total Size:</strong> ${stats.totalSizeMB} MB</p>
        <p style="margin: 5px 0;"><strong>Oldest Entry:</strong> ${oldestDate}</p>
        <p style="margin: 5px 0;"><strong>Newest Entry:</strong> ${newestDate}</p>
      `
    } catch (error) {
      console.error('Error loading cache stats:', error)
      this.cacheStatsEl.innerHTML = '<p style="margin: 0; color: #d32f2f;">Error loading cache statistics</p>'
    }
  }

  private async clearCache(): Promise<void> {
    const confirmed = confirm('Delete all cached audio files? This will require re-downloading audio from ElevenLabs.')
    if (!confirmed) {
      return
    }

    try {
      this.clearCacheButton.disabled = true
      this.clearCacheButton.textContent = 'Clearing...'

      const result = await window.electronAPI.tts.clearCache()

      alert(`Cleared ${result.deleted} cached files`)
      await this.updateCacheStats()

      this.clearCacheButton.disabled = false
      this.clearCacheButton.textContent = 'Clear Cache'
    } catch (error) {
      console.error('Error clearing cache:', error)
      alert('Error clearing cache')
      this.clearCacheButton.disabled = false
      this.clearCacheButton.textContent = 'Clear Cache'
    }
  }

  getElement(): HTMLElement {
    return this.container
  }

  show(): void {
    this.container.style.display = 'block'
  }

  hide(): void {
    this.container.style.display = 'none'
  }
}
