<template>
  <el-dialog
    :model-value="visible"
    title="切换账号"
    width="min(440px, calc(100vw - 32px))"
    align-center
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @update:model-value="$emit('update:visible', $event)"
    @opened="focusInput"
  >
    <p class="current-account">当前账号 <strong>{{ currentName }}</strong></p>
    <div v-if="otherNames.length" class="quick-accounts" role="group" aria-label="本机近期账号">
      <button
        v-for="name in otherNames"
        :key="name"
        type="button"
        class="quick-account"
        :aria-pressed="username === name"
        :disabled="busy"
        :title="name"
        @click="choose(name)"
      >{{ name }}</button>
      <el-button link type="primary" :disabled="busy" @click="choose('')">使用其他账号</el-button>
    </div>

    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="目标账号">
        <el-input ref="usernameInput" v-model="username" autocomplete="off" :disabled="busy" @input="error = ''" />
      </el-form-item>
      <el-form-item label="目标账号密码">
        <el-input ref="passwordInput" v-model="password" type="password" show-password autocomplete="off" :disabled="busy" @input="error = ''" />
      </el-form-item>
      <el-checkbox v-model="remember" :disabled="busy">记住登录</el-checkbox>
      <p v-if="error" class="switch-error" role="alert">{{ error }}</p>
      <div class="switch-actions">
        <el-button :disabled="busy" @click="$emit('update:visible', false)">取消</el-button>
        <el-button native-type="submit" type="primary" :loading="busy">确认切换</el-button>
      </div>
    </el-form>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

const props = defineProps({
  visible: Boolean,
  currentName: String,
  initialName: String,
  recentNames: { type: Array, required: true },
  authenticate: { type: Function, required: true },
})
defineEmits(['update:visible'])

const username = ref(props.initialName || '')
const password = ref('')
const remember = ref(true)
const error = ref('')
const busy = ref(false)
const usernameInput = ref(null)
const passwordInput = ref(null)
const otherNames = computed(() => props.recentNames.filter(name => name !== props.currentName))

function focusInput() {
  if (username.value) passwordInput.value?.focus()
  else usernameInput.value?.focus()
}

async function choose(name) {
  username.value = name
  password.value = ''
  error.value = ''
  await nextTick()
  focusInput()
}

async function submit() {
  if (busy.value) return
  const name = username.value.trim()
  if (!name || !password.value) {
    error.value = '请输入目标账号和密码'
    focusInput()
    return
  }
  if (name === props.currentName) {
    error.value = '该账号已登录，请选择其他账号'
    return
  }

  busy.value = true
  error.value = ''
  try {
    error.value = await props.authenticate({ username: name, password: password.value, remember: remember.value }) || ''
  } catch {
    error.value = '暂时无法切换账号，请重试'
  } finally {
    password.value = ''
    busy.value = false
    await nextTick()
    if (error.value) focusInput()
  }
}
</script>

<style scoped>
.current-account { margin: 0 0 12px; overflow-wrap: anywhere; color: var(--gt-text-main); font-weight: 600; }
.current-account strong { margin-left: 6px; }
.quick-accounts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.quick-account {
  max-width: 100%;
  padding: 5px 9px;
  border: 1px solid var(--gt-border-strong);
  border-radius: 7px;
  background: var(--gt-surface-subtle);
  color: var(--gt-text-body);
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  cursor: pointer;
}
.quick-account[aria-pressed="true"], .quick-account:hover { border-color: var(--gt-accent-border); background: var(--gt-accent-surface); }
.quick-account:focus-visible { outline: 2px solid var(--gt-text-accent); }
.switch-error { margin: 6px 0 0; color: var(--gt-text-danger); font-weight: 600; }
.el-form :deep(.el-form-item__label) { color: var(--gt-text-main); font-weight: 600; }
.switch-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
