<template>
  <!-- Login / Register -->
  <LoginPage
    v-if="!isLoggedIn"
    :force-register="forceRegister"
    :is-windows="isWindows"
    @logged-in="onLoggedIn"
  />

  <!-- Main App -->
  <div v-else class="app-layout">
    <Sidebar
      :orders="filteredOrders"
      :selectedOrderId="selectedOrderId"
      :filter="filter"
      :search="search"
      :type-filter="typeFilter"
      :graduation-year-filter="graduationYearFilter"
      :graduation-years="graduationYearList"
      :university-filter="universityFilter"
      :universities="allUniversities"
      :major-filter="majorFilter"
      :majors="allMajors"
      :receiver-filter="receiverFilter"
      :receivers="allReceivers"
      :handler-filter="handlerFilter"
      :handlers="allHandlers"
      :badge-counts="badgeCounts"
      :is-windows="isWindows"
      @select="handleSelectOrder"
      @filter-change="filter = $event"
      @search-change="search = $event"
      @type-change="handleTypeChange"
      @graduation-year-change="handleGraduationYearChange"
      @university-change="handleUniversityChange"
      @major-change="majorFilter = $event"
      @receiver-change="receiverFilter = $event"
      @handler-change="handlerFilter = $event"
      @reset-filters="handleResetFilters"
      @create="openCreateModal(null)"
      @open-settings="showSettings = true"
      @open-stats="showStats = true"
      @logout="handleLogout"
    />

    <main class="main-panel">
      <!-- Title bar drag region -->
      <div class="main-drag">
        <div v-if="isWindows" class="win-controls">
          <button class="win-btn" @click="api.windowMinimize()" title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
          <button class="win-btn" @click="api.windowMaximize()" title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          </button>
          <button class="win-btn win-btn-close" @click="api.windowClose()" title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
        </div>
      </div>

      <StatsPanel
        v-if="showStats"
        @close="showStats = false"
        @navigate-order="handleSelectOrder"
      />

      <OrderPanel
        v-else-if="selectedOrder"
        :key="selectedOrder.id"
        :order="selectedOrder"
        :current-user="currentUser"
        @updated="loadOrders"
        @edit="openCreateModal"
        @deleted="onOrderDeleted"
      />

      <div v-else class="empty-state">
        <div class="empty-icon-box">
          <el-icon :size="48" color="#cbd5e1"><Files /></el-icon>
        </div>
        <h2 class="empty-title">请在左侧选择一个项目</h2>
        <p class="empty-sub">或者点击左下角新建单子开始记录</p>
      </div>
    </main>

    <CreateOrderModal v-model:visible="showCreateModal" :order="editingOrder" @saved="onOrderSaved" />
    <SettingsModal v-model:visible="showSettings" :current-user="currentUser" @reset="handleDataReset" @imported="handleMigrationImported" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { ElMessageBox } from 'element-plus'
import LoginPage from './components/LoginPage.vue'
import Sidebar from './components/Sidebar.vue'
import OrderPanel from './components/OrderPanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import CreateOrderModal from './components/CreateOrderModal.vue'
import SettingsModal from './components/SettingsModal.vue'

const api = window.electronAPI

// Platform detection
const isWindows = ref(false)
provide('isWindows', isWindows)

// Prevent Electron from navigating to dropped files
function preventDefaults(e) { e.preventDefault(); e.stopPropagation() }
let refreshTimer = null
onMounted(async () => {
  const platform = await api.getPlatform()
  isWindows.value = platform === 'win32'
  document.addEventListener('dragover', preventDefaults)
  document.addEventListener('drop', preventDefaults)
  refreshTimer = setInterval(() => {
    if (isLoggedIn.value) loadOrders()
  }, 60000)
})
onUnmounted(() => {
  document.removeEventListener('dragover', preventDefaults)
  document.removeEventListener('drop', preventDefaults)
  if (refreshTimer) clearInterval(refreshTimer)
})

// Auth state
const isLoggedIn = ref(false)
const currentUser = ref(null)
const forceRegister = ref(false)

// Provide currentUser to child components
provide('currentUser', currentUser)

async function checkAuth() {
  const hasUsers = await api.hasUsers()
  if (!hasUsers) {
    forceRegister.value = true
    return
  }
  const saved = await api.getSetting('rememberedUser')
  if (saved) {
    try {
      const user = JSON.parse(saved)
      if (user && user.id && user.username) {
        currentUser.value = user
        isLoggedIn.value = true
      }
    } catch {}
  }
}

function onLoggedIn(user) {
  currentUser.value = user
  isLoggedIn.value = true
  forceRegister.value = false
  loadGraduationYears()
  loadOrders()
}

onMounted(checkAuth)

// Graduation year helper
function getCurrentGraduationYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}

// App state
const allOrders = ref([])
const selectedOrderId = ref(null)
const filter = ref('all')
const search = ref('')
const typeFilter = ref('all')
const graduationYearFilter = ref(getCurrentGraduationYear())
const graduationYearList = ref([])
const universityFilter = ref('all')
const majorFilter = ref('all')
const receiverFilter = ref('all')
const handlerFilter = ref('all')
const showCreateModal = ref(false)
const editingOrder = ref(null)
const showSettings = ref(false)
const showStats = ref(false)

const isUnpaid = (o) => o.totalAmount > o.paidAmount

// 联动筛选：根据类型筛选后的订单，提取学校和专业列表
const typeFilteredOrders = computed(() => {
  if (typeFilter.value === 'all') return allOrders.value
  return allOrders.value.filter(o => (o.orderType || 'thesis') === typeFilter.value)
})

const allUniversities = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => {
    if (o.university && o.university.trim()) set.add(o.university.trim())
  })
  return Array.from(set).sort()
})

const allMajors = computed(() => {
  let orders = typeFilteredOrders.value
  if (universityFilter.value && universityFilter.value !== 'all') {
    orders = orders.filter(o => o.university === universityFilter.value)
  }
  const set = new Set()
  orders.forEach(o => {
    if (o.major && o.major.trim()) set.add(o.major.trim())
  })
  return Array.from(set).sort()
})

const allReceivers = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => {
    set.add(o.receiver || '本人')
  })
  return Array.from(set).sort()
})

const allHandlers = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => {
    set.add(o.handler || '本人')
  })
  return Array.from(set).sort()
})

function handleTypeChange(val) {
  typeFilter.value = val
  universityFilter.value = 'all'
  majorFilter.value = 'all'
  receiverFilter.value = 'all'
  handlerFilter.value = 'all'
  loadOrders()
}

function handleGraduationYearChange(val) {
  graduationYearFilter.value = val
  typeFilter.value = 'all'
  universityFilter.value = 'all'
  majorFilter.value = 'all'
  receiverFilter.value = 'all'
  handlerFilter.value = 'all'
  filter.value = 'all'
  loadOrders()
}

function handleUniversityChange(val) {
  universityFilter.value = val
  majorFilter.value = 'all'
}

function handleResetFilters() {
  typeFilter.value = 'all'
  universityFilter.value = 'all'
  majorFilter.value = 'all'
  receiverFilter.value = 'all'
  handlerFilter.value = 'all'
  filter.value = 'all'
  search.value = ''
  loadOrders()
}

const preFilteredOrders = computed(() => {
  let result = allOrders.value
  if (universityFilter.value && universityFilter.value !== 'all')
    result = result.filter(o => o.university === universityFilter.value)
  if (majorFilter.value && majorFilter.value !== 'all')
    result = result.filter(o => o.major === majorFilter.value)
  if (receiverFilter.value && receiverFilter.value !== 'all')
    result = result.filter(o => (o.receiver || '本人') === receiverFilter.value)
  if (handlerFilter.value && handlerFilter.value !== 'all')
    result = result.filter(o => (o.handler || '本人') === handlerFilter.value)
  return result
})

const filteredOrders = computed(() => {
  let result = preFilteredOrders.value
  if (filter.value === 'draft') result = result.filter(o => !o.isDraftSubmitted)
  else if (filter.value === 'todo') result = result.filter(o => o.pendingCount > 0)
  else if (filter.value === 'unpaid') result = result.filter(isUnpaid)
  else if (filter.value === 'idle') {
    result = result.filter(o => o.isDraftSubmitted && o.pendingCount === 0 && !isUnpaid(o))
  }
  return result
})

const badgeCounts = computed(() => ({
  draft: preFilteredOrders.value.filter(o => !o.isDraftSubmitted).length,
  todo: preFilteredOrders.value.filter(o => o.pendingCount > 0).length,
  unpaid: preFilteredOrders.value.filter(isUnpaid).length,
  idle: preFilteredOrders.value.filter(o => o.isDraftSubmitted && o.pendingCount === 0 && !isUnpaid(o)).length,
}))

const selectedOrder = computed(() => allOrders.value.find(o => o.id === selectedOrderId.value) || null)

async function loadOrders() {
  if (!currentUser.value || !currentUser.value.id) return
  const gradYear = graduationYearFilter.value === 'all' ? null : graduationYearFilter.value
  allOrders.value = await api.listOrders(currentUser.value.id, search.value, typeFilter.value, gradYear)
}

async function loadGraduationYears() {
  if (!currentUser.value || !currentUser.value.id) return
  const years = await api.getGraduationYears(currentUser.value.id)
  const current = getCurrentGraduationYear()
  if (!years.includes(current)) years.push(current)
  years.sort((a, b) => b - a)
  graduationYearList.value = years
}

function openCreateModal(order) {
  editingOrder.value = order
  showCreateModal.value = true
}

function onOrderSaved() {
  showCreateModal.value = false
  editingOrder.value = null
  loadGraduationYears()
  loadOrders()
}

function onOrderDeleted() {
  selectedOrderId.value = null
  loadOrders()
}

function handleSelectOrder(id) {
  showStats.value = false
  selectedOrderId.value = id
}

function handleDataReset() {
  currentUser.value = null
  isLoggedIn.value = false
  forceRegister.value = true
  allOrders.value = []
  selectedOrderId.value = null
  showStats.value = false
  showSettings.value = false
}

function handleMigrationImported() {
  loadGraduationYears()
  loadOrders()
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '确认退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.setSetting('rememberedUser', '')
    currentUser.value = null
    isLoggedIn.value = false
    allOrders.value = []
    selectedOrderId.value = null
    showStats.value = false
  } catch {}
}

watch([search, typeFilter], loadOrders)
watch(isLoggedIn, (val) => { if (val) { loadGraduationYears(); loadOrders() } })
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: #f8fafc;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.5);
}

.main-drag {
  height: 44px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.win-controls {
  display: flex;
  -webkit-app-region: no-drag;
  height: 100%;
}
.win-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.win-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.win-btn:active {
  background: rgba(0, 0, 0, 0.1);
}
.win-btn-close:hover {
  background: #e81123;
  color: #fff;
}
.win-btn-close:active {
  background: #bf0f1d;
  color: #fff;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 80px;
}

.empty-icon-box {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.empty-sub {
  font-size: 13px;
  color: #94a3b8;
}
</style>
