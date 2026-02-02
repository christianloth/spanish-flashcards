import { App } from './App'
import '../styles/main.css'

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new App()
  await app.initialize()
})
