import { ref, readonly } from 'vue'

const mode = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export const appearanceMode = readonly(mode)

export function applyAppearance(modeValue) {
  mode.value = modeValue === 'dark' ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', mode.value === 'dark')

  const url = new URL(window.location.href)
  if (url.searchParams.get('appearanceMode') !== mode.value) {
    url.searchParams.set('appearanceMode', mode.value)
    window.history.replaceState(window.history.state, '', url)
  }
}
