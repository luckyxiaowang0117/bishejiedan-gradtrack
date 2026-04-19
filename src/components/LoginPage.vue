<template>
  <div class="login-wrapper">
    <!-- Animated background orbs -->
    <div class="bg-orb orb-1" />
    <div class="bg-orb orb-2" />
    <div class="bg-orb orb-3" />

    <!-- Title bar drag region -->
    <div class="login-drag-region">
      <div v-if="isWindows" class="login-win-controls">
        <button class="login-win-btn" @click="api.windowMinimize()" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="login-win-btn" @click="api.windowMaximize()" title="最大化">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        </button>
        <button class="login-win-btn login-win-close" @click="api.windowClose()" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
    </div>

    <div class="login-card">
      <!-- Brand -->
      <div class="brand">
        <div class="brand-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
            <path d="M9 11h14M9 16h10M9 21h14" stroke="#fff" stroke-width="2" stroke-linecap="round" />
            <defs><linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
          </svg>
        </div>
        <h1 class="brand-name">接单管理助手</h1>
        <p class="brand-sub">{{ isRegister ? '创建您的账号' : '欢迎回来' }}</p>
      </div>

      <!-- Login Form -->
      <form v-if="!isRegister" @submit.prevent="handleLogin" class="login-form">
        <div class="field">
          <label>账号</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input v-model="username" type="text" placeholder="请输入账号" autocomplete="username" />
          </div>
        </div>
        <div class="field">
          <label>密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input v-model="password" :type="showPwd ? 'text' : 'password'" placeholder="请输入密码" autocomplete="current-password" />
            <button type="button" class="eye-btn" @click="showPwd = !showPwd" tabindex="-1">
              <svg v-if="showPwd" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <label class="remember-row">
          <input type="checkbox" v-model="remember" />
          <span>记住登录</span>
        </label>
        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>{{ loading ? '登录中...' : '登 录' }}</span>
        </button>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p class="switch-link">没有账号？<a @click="isRegister = true">立即注册</a></p>
      </form>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="login-form">
        <div class="field">
          <label>账号</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input v-model="regUsername" type="text" placeholder="设置您的账号" autocomplete="username" />
          </div>
        </div>
        <div class="field">
          <label>密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input v-model="regPassword" :type="showRegPwd ? 'text' : 'password'" placeholder="设置密码" autocomplete="new-password" />
            <button type="button" class="eye-btn" @click="showRegPwd = !showRegPwd" tabindex="-1">
              <svg v-if="showRegPwd" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <div class="field">
          <label>确认密码</label>
          <div class="input-wrap">
            <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input v-model="regConfirm" :type="showRegPwd ? 'text' : 'password'" placeholder="再次输入密码" autocomplete="new-password" />
          </div>
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>{{ loading ? '注册中...' : '注 册' }}</span>
        </button>
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p class="switch-link">已有账号？<a @click="isRegister = false">返回登录</a></p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({ forceRegister: Boolean, isWindows: Boolean })
const emit = defineEmits(['logged-in'])
const api = window.electronAPI

const isRegister = ref(!!props.forceRegister)
const loading = ref(false)
const errorMsg = ref('')

const username = ref('')
const password = ref('')
const showPwd = ref(false)
const remember = ref(true)

const regUsername = ref('')
const regPassword = ref('')
const regConfirm = ref('')
const showRegPwd = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  if (!username.value.trim()) return (errorMsg.value = '请输入账号')
  if (!password.value) return (errorMsg.value = '请输入密码')
  loading.value = true
  try {
    const user = await api.login(username.value.trim(), password.value)
    if (!user) {
      errorMsg.value = '账号或密码错误'
      return
    }
    if (remember.value) {
      await api.setSetting('rememberedUser', JSON.stringify(user))
    } else {
      await api.setSetting('rememberedUser', '')
    }
    emit('logged-in', user)
  } catch (err) {
    errorMsg.value = '登录失败: ' + (err.message || err)
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  errorMsg.value = ''
  if (!regUsername.value.trim()) return (errorMsg.value = '请设置账号')
  if (regUsername.value.trim().length < 2) return (errorMsg.value = '账号至少2个字符')
  if (!regPassword.value) return (errorMsg.value = '请设置密码')
  if (regPassword.value.length < 4) return (errorMsg.value = '密码至少4位')
  if (regPassword.value !== regConfirm.value) return (errorMsg.value = '两次密码不一致')
  loading.value = true
  try {
    const result = await api.register(regUsername.value.trim(), regPassword.value)
    if (!result.success) {
      errorMsg.value = result.error || '注册失败'
      return
    }
    await api.setSetting('rememberedUser', JSON.stringify(result.user))
    emit('logged-in', result.user)
  } catch (err) {
    errorMsg.value = '注册失败: ' + (err.message || err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #1e293b 100%);
  overflow: hidden;
}

.login-drag-region {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  -webkit-app-region: drag;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.login-win-controls {
  display: flex;
  -webkit-app-region: no-drag;
  height: 100%;
}
.login-win-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.login-win-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}
.login-win-close:hover {
  background: #e81123;
  color: #fff;
}
.login-win-close:active {
  background: #bf0f1d;
  color: #fff;
}

/* Animated background orbs */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 20s ease-in-out infinite;
}
.orb-1 {
  width: 400px;
  height: 400px;
  background: #6366f1;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}
.orb-2 {
  width: 300px;
  height: 300px;
  background: #8b5cf6;
  bottom: -80px;
  right: -60px;
  animation-delay: -7s;
}
.orb-3 {
  width: 200px;
  height: 200px;
  background: #a78bfa;
  top: 50%;
  left: 60%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(15px, 35px) scale(1.02); }
}

/* Card */
.login-card {
  position: relative;
  width: 400px;
  padding: 40px 36px 32px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  z-index: 1;
}

/* Brand */
.brand {
  text-align: center;
  margin-bottom: 32px;
}
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.15);
  margin-bottom: 16px;
}
.brand-name {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}
.brand-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0 14px;
  height: 46px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-wrap:focus-within {
  border-color: rgba(99, 102, 241, 0.6);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.field-icon {
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.input-wrap input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
}
.input-wrap input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.eye-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.35);
  padding: 2px;
  display: flex;
  transition: color 0.15s;
}
.eye-btn:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* Remember */
.remember-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
}
.remember-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

/* Submit */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  letter-spacing: 2px;
  margin-top: 4px;
}
.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
}
.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error */
.error-msg {
  text-align: center;
  color: #f87171;
  font-size: 13px;
  margin: -4px 0 0;
}

/* Switch link */
.switch-link {
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}
.switch-link a {
  color: #818cf8;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.15s;
}
.switch-link a:hover {
  color: #a5b4fc;
}
</style>
