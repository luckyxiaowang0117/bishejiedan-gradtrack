import { inject, onBeforeUnmount, ref } from 'vue'

export function useAccountWork({ hasDraft = () => false, isBusy = () => false } = {}) {
  const track = inject('trackAccountWork', null)
  const pending = ref(0)
  let mounted = true
  const stop = track?.(() => ({
    draft: mounted && hasDraft(),
    busy: pending.value > 0 || (mounted && isBusy()),
  }))
  onBeforeUnmount(() => {
    mounted = false
    if (!pending.value) stop?.()
  })

  return async function saveAccountWork(operation) {
    pending.value++
    try {
      return await operation()
    } finally {
      pending.value--
      if (!mounted && !pending.value) stop?.()
    }
  }
}
