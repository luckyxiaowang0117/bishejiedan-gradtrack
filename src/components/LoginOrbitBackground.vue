<template>
  <canvas ref="canvas" class="orbit-background" aria-hidden="true" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { appearanceMode } from '../appearance.js'

const orbits = [
  { x: .39, y: .53, tilt: -.41, ratio: .31, light: '65,91,181', dark: '113,174,255' },
  { x: .58, y: .47, tilt: .42, ratio: .44, light: '100,76,165', dark: '177,151,254' },
  { x: .51, y: .48, tilt: -.17, ratio: .67, light: '46,101,166', dark: '114,210,245' },
]
const wave = index => Math.sin(index * 91.3) * .5 + .5
const stars = Array.from({ length: 98 }, (_, index) => ({
  x: wave(index + .2),
  y: wave(index * 5.7 + .8),
  bright: index % 7 === 0,
}))

const canvas = ref(null)
let context
let observer
let reducedMotion
let width = 0
let height = 0
let time = 0
let lastFrame = 0
let animationFrame = 0

function draw() {
  if (!context || !width || !height) return
  const dark = appearanceMode.value === 'dark'
  const light = dark ? '#bcf0ff' : '#4c70ca'
  const span = Math.max(width, height) * .55

  context.clearRect(0, 0, width, height)
  stars.forEach(({ x, y, bright }, index) => {
    const opacity = (bright ? .34 : .14) * (.8 + .2 * Math.sin(index + time * .7))
    const size = bright ? 1.65 : .9
    context.fillStyle = `rgba(${dark ? '190,213,255' : '30,56,116'},${opacity})`
    context.fillRect(x * width, y * height, size, size)
  })

  orbits.forEach((orbit, index) => {
    const hue = dark ? orbit.dark : orbit.light
    const direction = index === 1 ? -1 : 1
    context.save()
    context.translate(width * orbit.x, height * orbit.y)
    context.rotate(orbit.tilt)

    for (let ring = 0; ring < 5; ring++) {
      const major = span * (.61 + ring * .115)
      const minor = major * orbit.ratio
      context.strokeStyle = `rgba(${hue},${ring % 2 ? .21 : .37})`
      context.lineWidth = ring === 2 ? 1.2 : .75
      context.setLineDash(ring === 4 ? [2, 7] : [])
      context.beginPath()
      context.ellipse(0, 0, major, minor, 0, 0, 2 * Math.PI)
      context.stroke()
      context.setLineDash([])

      const angle = time * (.14 + ring * .025) * direction + index * 2 + ring * .67
      context.strokeStyle = `rgba(${hue},.72)`
      context.lineWidth = 2
      context.beginPath()
      context.ellipse(0, 0, major, minor, 0, angle - .11 * direction, angle, direction < 0)
      context.stroke()

      context.fillStyle = light
      context.shadowColor = light
      context.shadowBlur = dark ? 12 : 6
      context.beginPath()
      context.arc(Math.cos(angle) * major, Math.sin(angle) * minor, ring === 2 ? 3 : 1.5, 0, 2 * Math.PI)
      context.fill()
      context.shadowBlur = 0
    }
    context.restore()
  })
}

function resize() {
  const { clientWidth, clientHeight } = canvas.value
  width = clientWidth
  height = clientHeight
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  context.setTransform(scale, 0, 0, scale, 0, 0)
  draw()
}

function animate(now) {
  animationFrame = requestAnimationFrame(animate)
  if (!lastFrame) lastFrame = now
  if (now - lastFrame < 1000 / 36) return
  time += Math.min(now - lastFrame, 70) / 1000
  lastFrame = now
  draw()
}

function syncMotion() {
  cancelAnimationFrame(animationFrame)
  lastFrame = 0
  if (!reducedMotion.matches && !document.hidden) {
    animationFrame = requestAnimationFrame(animate)
  }
}

onMounted(() => {
  context = canvas.value.getContext('2d')
  if (!context) return
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  resize()
  reducedMotion.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', syncMotion)
  syncMotion()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  observer?.disconnect()
  reducedMotion?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', syncMotion)
})

watch(appearanceMode, draw)
</script>

<style scoped>
.orbit-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
