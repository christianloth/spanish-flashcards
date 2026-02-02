export class FileSelector {
  private container: HTMLElement
  private select: HTMLSelectElement
  private files: string[] = []
  public onFileSelect: ((filename: string) => void) | null = null

  constructor() {
    this.container = document.createElement('div')
    this.container.className = 'file-selector'

    const label = document.createElement('label')
    label.textContent = 'Select vocabulary file:'
    label.htmlFor = 'file-select'

    this.select = document.createElement('select')
    this.select.id = 'file-select'
    this.select.addEventListener('change', () => this.handleChange())

    this.container.appendChild(label)
    this.container.appendChild(this.select)
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
    if (filename && this.onFileSelect) {
      this.onFileSelect(filename)
    }
  }

  getElement(): HTMLElement {
    return this.container
  }

  setSelectedFile(filename: string): void {
    this.select.value = filename
  }
}
