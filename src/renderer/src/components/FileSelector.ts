export class FileSelector {
  private container: HTMLElement
  private select: HTMLSelectElement
  private preloadButton: HTMLButtonElement
  private files: string[] = []
  public onFileSelect: ((filename: string) => void) | null = null
  public onPreloadCache: (() => void) | null = null

  constructor() {
    this.container = document.createElement('div')
    this.container.className = 'file-selector'

    const label = document.createElement('label')
    label.textContent = 'Select vocabulary file:'
    label.htmlFor = 'file-select'

    this.select = document.createElement('select')
    this.select.id = 'file-select'
    this.select.addEventListener('change', () => this.handleChange())

    this.preloadButton = document.createElement('button')
    this.preloadButton.className = 'preload-cache-button'
    this.preloadButton.textContent = 'Preload to Cache'
    this.preloadButton.disabled = true
    this.preloadButton.addEventListener('click', () => this.handlePreload())

    this.container.appendChild(label)
    this.container.appendChild(this.select)
    this.container.appendChild(this.preloadButton)
  }

  async loadFiles(): Promise<void> {
    try {
      this.files = await window.electronAPI.getInputFiles()
      this.renderOptions()
    } catch (error) {
      console.error('Error loading files:', error)
      this.files = []
      this.renderOptions()
    }
  }

  private renderOptions(): void {
    this.select.innerHTML = ''

    const defaultOption = document.createElement('option')
    defaultOption.value = ''
    defaultOption.textContent = this.files.length > 0
      ? '-- Choose a file --'
      : '-- No files found --'
    defaultOption.disabled = true
    defaultOption.selected = true
    this.select.appendChild(defaultOption)

    for (const file of this.files) {
      const option = document.createElement('option')
      option.value = file
      option.textContent = file
      this.select.appendChild(option)
    }
  }

  private handleChange(): void {
    const filename = this.select.value
    if (filename) {
      this.preloadButton.disabled = false
      if (this.onFileSelect) {
        this.onFileSelect(filename)
      }
    } else {
      this.preloadButton.disabled = true
    }
  }

  private handlePreload(): void {
    if (this.onPreloadCache) {
      this.onPreloadCache()
    }
  }

  getElement(): HTMLElement {
    return this.container
  }

  setSelectedFile(filename: string): void {
    this.select.value = filename
    this.preloadButton.disabled = !filename
  }

  setPreloadButtonState(enabled: boolean, text?: string): void {
    this.preloadButton.disabled = !enabled
    if (text) {
      this.preloadButton.textContent = text
    }
  }
}
