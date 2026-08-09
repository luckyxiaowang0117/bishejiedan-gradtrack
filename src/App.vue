<template>
  <LoginPage
    v-if="!isLoggedIn"
    :force-register="forceRegister"
    :is-windows="isWindows"
    @logged-in="onLoggedIn"
  />

  <div v-else class="app-layout" :style="appLayoutStyle">
    <Sidebar
      :app-version="appVersion"
      :order-groups="groupedOrders"
      :selected-order-id="selectedOrderId"
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
      :sort-mode="sortMode"
      :group-mode="groupMode"
      :sort-options="SORT_OPTIONS"
      :group-options="GROUP_OPTIONS"
      :sync-busy="syncBusy"
      :total-visible-orders="filteredOrders.length"
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
      @sort-change="sortMode = $event"
      @group-change="groupMode = $event"
      @reset-filters="handleResetFilters"
      @create="openCreateModal(null)"
      @open-sync="handleQuickSync"
      @open-settings="showSettings = true"
      @open-stats="showStats = true"
      @logout="handleLogout"
    />

    <div
      class="sidebar-resizer"
      :class="{ 'sidebar-resizer-active': isResizingSidebar }"
      title="拖拽调整左侧区域宽度"
      @mousedown="startSidebarResize"
      @dblclick="resetSidebarWidth"
    />

    <main class="main-panel">
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
        :default-info-expanded="orderInfoDefaultExpanded"
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
    <SettingsModal
      v-model:visible="showSettings"
      :current-user="currentUser"
      @reset="handleDataReset"
      @imported="handleMigrationImported"
      @order-info-default-change="orderInfoDefaultExpanded = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LoginPage from './components/LoginPage.vue'
import Sidebar from './components/Sidebar.vue'
import OrderPanel from './components/OrderPanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import CreateOrderModal from './components/CreateOrderModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import packageJson from '../package.json'

const api = window.electronAPI
const appVersion = packageJson.version

const ORDER_TYPE_MAP = {
  thesis: '毕设论文',
  format: '格式修改',
  translation: '外文翻译',
  design: '设计定制',
  reduction: '论文降重',
  special: '特殊订单',
}

const ORDER_TYPE_ORDER = ['thesis', 'format', 'translation', 'design', 'reduction', 'special']

const SORT_OPTIONS = [
  { key: 'urgency_desc', label: '紧急优先' },
  { key: 'deadline_asc', label: '截止时间最近优先' },
  { key: 'deadline_desc', label: '截止时间最晚优先' },
  { key: 'created_desc', label: '创建时间最新优先' },
  { key: 'created_asc', label: '创建时间最早优先' },
  { key: 'amount_desc', label: '总金额从高到低' },
  { key: 'amount_asc', label: '总金额从低到高' },
  { key: 'balance_desc', label: '尾款金额从高到低' },
  { key: 'todo_first', label: '待修改优先' },
  { key: 'unpaid_first', label: '未结清优先' },
]

const GROUP_OPTIONS = [
  { key: 'none', label: '不分组' },
  { key: 'urgency', label: '按风险分组' },
  { key: 'status', label: '按状态分组' },
  { key: 'handler', label: '按处理人分组' },
  { key: 'receiver', label: '按接单人分组' },
  { key: 'university', label: '按学校分组' },
  { key: 'graduationYear', label: '按届别分组' },
  { key: 'orderType', label: '按业务类型分组' },
]

const isWindows = ref(false)
provide('isWindows', isWindows)

function preventDefaults(e) {
  e.preventDefault()
  e.stopPropagation()
}

let refreshTimer = null
onMounted(async () => {
  const platform = await api.getPlatform()
  isWindows.value = platform === 'win32'
  document.addEventListener('dragover', preventDefaults)
  document.addEventListener('drop', preventDefaults)
  window.addEventListener('resize', handleWindowResize)
  refreshTimer = setInterval(() => {
    if (isLoggedIn.value) loadOrders()
  }, 60000)
  await loadSidebarWidthPreference()
  await loadOrderInfoDefaultPreference()
  await checkAuth()
})

onUnmounted(() => {
  document.removeEventListener('dragover', preventDefaults)
  document.removeEventListener('drop', preventDefaults)
  window.removeEventListener('resize', handleWindowResize)
  if (removeSidebarResizeListeners) removeSidebarResizeListeners()
  clearResizeInteractionStyles()
  if (refreshTimer) clearInterval(refreshTimer)
})

const isLoggedIn = ref(false)
const currentUser = ref(null)
const forceRegister = ref(false)
provide('currentUser', currentUser)

function getCurrentGraduationYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}

const allOrders = ref([])
const selectedOrderId = ref(null)
const filter = ref('all')
const search = ref('')
const typeFilter = ref('all')
const sortMode = ref('urgency_desc')
const groupMode = ref('urgency')
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
const syncBusy = ref(false)
const orderInfoDefaultExpanded = ref(false)
const prefsReady = ref(false)
const isHydratingListState = ref(false)
const sidebarWidth = ref(null)
const isResizingSidebar = ref(false)
let removeSidebarResizeListeners = null

const isUnpaid = (o) => o.totalAmount > o.paidAmount

const appLayoutStyle = computed(() => (
  sidebarWidth.value ? { '--gt-sidebar-width': `${sidebarWidth.value}px` } : {}
))

function getSidebarWidthBounds() {
  const compactScreen = window.innerWidth <= 1680 || window.innerHeight <= 940
  const mediumScreen = window.innerWidth <= 2200 || window.innerHeight <= 1180
  const min = compactScreen ? 360 : (mediumScreen ? 390 : 430)
  const max = Math.max(min + 80, Math.min(Math.floor(window.innerWidth * 0.42), 720))
  return { min, max }
}

function clampSidebarWidth(width) {
  const { min, max } = getSidebarWidthBounds()
  return Math.min(Math.max(Math.round(Number(width) || min), min), max)
}

async function loadSidebarWidthPreference() {
  const raw = await api.getSetting('sidebarWidth')
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) {
    sidebarWidth.value = clampSidebarWidth(parsed)
  } else {
    sidebarWidth.value = null
  }
}

async function loadOrderInfoDefaultPreference() {
  const raw = await api.getSetting('orderInfoDefaultExpanded')
  orderInfoDefaultExpanded.value = raw === '1'
}

async function persistSidebarWidth(width) {
  await api.setSetting('sidebarWidth', String(clampSidebarWidth(width)))
}

function clearResizeInteractionStyles() {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function bindSidebarResizeListeners(onMove, onUp) {
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  removeSidebarResizeListeners = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    removeSidebarResizeListeners = null
  }
}

function startSidebarResize(event) {
  event.preventDefault()
  const sidebarElement = event.currentTarget?.previousElementSibling
  const measuredWidth = sidebarElement?.getBoundingClientRect?.().width
  const currentWidth = sidebarWidth.value ?? clampSidebarWidth(measuredWidth || getSidebarWidthBounds().min)
  const startX = event.clientX
  const startWidth = currentWidth
  isResizingSidebar.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (moveEvent) => {
    const nextWidth = clampSidebarWidth(startWidth + (moveEvent.clientX - startX))
    sidebarWidth.value = nextWidth
  }

  const onUp = async () => {
    if (removeSidebarResizeListeners) removeSidebarResizeListeners()
    isResizingSidebar.value = false
    clearResizeInteractionStyles()
    if (sidebarWidth.value) await persistSidebarWidth(sidebarWidth.value)
  }

  bindSidebarResizeListeners(onMove, onUp)
}

async function resetSidebarWidth() {
  sidebarWidth.value = null
  await api.setSetting('sidebarWidth', '')
}

function handleWindowResize() {
  if (!sidebarWidth.value) return
  sidebarWidth.value = clampSidebarWidth(sidebarWidth.value)
}

function getOrderUrgencyKey(order) {
  const now = new Date()
  const deadline = order.deadline ? new Date(order.deadline + 'T23:59:59') : null
  const nearestRevision = order.nearestRevisionDeadline
    ? new Date(order.nearestRevisionDeadline.includes('T') ? order.nearestRevisionDeadline : order.nearestRevisionDeadline + 'T23:59:59')
    : null

  if ((nearestRevision && nearestRevision <= now) || (!order.isDraftSubmitted && deadline && deadline <= now)) {
    return 'overdue'
  }
  if ((nearestRevision && (nearestRevision - now) / 3600000 <= 24) || (!order.isDraftSubmitted && deadline && (deadline - now) / 86400000 <= 2)) {
    return 'warning'
  }
  if (order.pendingCount > 0) return 'revision'
  if (isUnpaid(order)) return 'finance'
  if (order.isDraftSubmitted && order.pendingCount === 0) return 'done'
  return 'normal'
}

const urgencyMetaMap = {
  overdue: { label: '已逾期', order: 0, description: '需要立刻处理' },
  warning: { label: '临近截止', order: 1, description: '建议今天优先推进' },
  revision: { label: '待修改', order: 2, description: '返修任务待处理' },
  finance: { label: '财务跟进', order: 3, description: '尾款或结算仍待跟进' },
  normal: { label: '进行中', order: 4, description: '常规推进中的项目' },
  done: { label: '已完成', order: 5, description: '可整理归档' },
}

const statusMetaMap = {
  draft: { label: '待提交初稿', order: 0, description: '尚未交付初稿' },
  todo: { label: '待修改', order: 1, description: '存在未完成修改项' },
  unpaid: { label: '尾款未结清', order: 2, description: '需要继续催收或确认' },
  idle: { label: '已完成', order: 3, description: '当前无待办，可归档' },
  active: { label: '推进中', order: 4, description: '普通进行中的项目' },
}

function getStatusGroupKey(order) {
  if (!order.isDraftSubmitted) return 'draft'
  if (order.pendingCount > 0) return 'todo'
  if (order.isDraftSubmitted && order.pendingCount === 0) return 'idle'
  if (isUnpaid(order)) return 'unpaid'
  return 'active'
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-CN')
}

const typeFilteredOrders = computed(() => {
  if (typeFilter.value === 'all') return allOrders.value
  return allOrders.value.filter(o => (o.orderType || 'thesis') === typeFilter.value)
})

const allUniversities = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => {
    if (o.university && o.university.trim()) set.add(o.university.trim())
  })
  return Array.from(set).sort(compareText)
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
  return Array.from(set).sort(compareText)
})

const allReceivers = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => set.add(o.receiver || '本人'))
  return Array.from(set).sort(compareText)
})

const allHandlers = computed(() => {
  const set = new Set()
  typeFilteredOrders.value.forEach(o => set.add(o.handler || '本人'))
  return Array.from(set).sort(compareText)
})

function handleTypeChange(val) {
  typeFilter.value = val
  universityFilter.value = 'all'
  majorFilter.value = 'all'
  receiverFilter.value = 'all'
  handlerFilter.value = 'all'
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
}

const preFilteredOrders = computed(() => {
  let result = allOrders.value
  if (universityFilter.value && universityFilter.value !== 'all') {
    result = result.filter(o => o.university === universityFilter.value)
  }
  if (majorFilter.value && majorFilter.value !== 'all') {
    result = result.filter(o => o.major === majorFilter.value)
  }
  if (receiverFilter.value && receiverFilter.value !== 'all') {
    result = result.filter(o => (o.receiver || '本人') === receiverFilter.value)
  }
  if (handlerFilter.value && handlerFilter.value !== 'all') {
    result = result.filter(o => (o.handler || '本人') === handlerFilter.value)
  }
  return result
})

const filteredOrders = computed(() => {
  let result = preFilteredOrders.value
  if (filter.value === 'draft') result = result.filter(o => !o.isDraftSubmitted)
  else if (filter.value === 'todo') result = result.filter(o => o.pendingCount > 0)
  else if (filter.value === 'unpaid') result = result.filter(isUnpaid)
  else if (filter.value === 'idle') result = result.filter(o => o.isDraftSubmitted && o.pendingCount === 0)
  return result
})

const badgeCounts = computed(() => ({
  draft: preFilteredOrders.value.filter(o => !o.isDraftSubmitted).length,
  todo: preFilteredOrders.value.filter(o => o.pendingCount > 0).length,
  unpaid: preFilteredOrders.value.filter(isUnpaid).length,
  idle: preFilteredOrders.value.filter(o => o.isDraftSubmitted && o.pendingCount === 0).length,
}))

function buildGroupMeta(mode, key) {
  if (mode === 'urgency') {
    return urgencyMetaMap[key] || { label: '其他', order: 99, description: '' }
  }
  if (mode === 'status') {
    return statusMetaMap[key] || { label: '其他', order: 99, description: '' }
  }
  if (mode === 'handler') {
    return { label: key || '未分配处理人', order: 50, description: '同一处理人的项目集中查看' }
  }
  if (mode === 'receiver') {
    return { label: key || '未填写接单人', order: 50, description: '同一接单人的项目集中查看' }
  }
  if (mode === 'university') {
    return { label: key || '未填写学校', order: 50, description: '同校项目归并查看' }
  }
  if (mode === 'graduationYear') {
    return { label: key ? `${key}届` : '未填写届别', order: key ? 9999 - Number(key) : 9999, description: '按毕业年份回看项目' }
  }
  if (mode === 'orderType') {
    const orderIndex = ORDER_TYPE_ORDER.indexOf(key)
    return { label: ORDER_TYPE_MAP[key] || '其他类型', order: orderIndex === -1 ? 999 : orderIndex, description: '按业务类型归类' }
  }
  return { label: '', order: 0, description: '' }
}

function getGroupKey(order, mode) {
  switch (mode) {
    case 'urgency':
      return getOrderUrgencyKey(order)
    case 'status':
      return getStatusGroupKey(order)
    case 'handler':
      return order.handler || '本人'
    case 'receiver':
      return order.receiver || '本人'
    case 'university':
      return order.university || '未填写学校'
    case 'graduationYear':
      return order.graduationYear || '未填写'
    case 'orderType':
      return order.orderType || 'thesis'
    default:
      return 'all'
  }
}

const groupedOrders = computed(() => {
  if (groupMode.value === 'none') {
    return [{
      key: 'all',
      label: '',
      description: '',
      order: 0,
      orders: filteredOrders.value,
    }]
  }

  const map = new Map()
  for (const order of filteredOrders.value) {
    const key = getGroupKey(order, groupMode.value)
    if (!map.has(key)) {
      const meta = buildGroupMeta(groupMode.value, key)
      map.set(key, {
        key: String(key),
        label: meta.label,
        description: meta.description,
        order: meta.order,
        orders: [],
      })
    }
    map.get(key).orders.push(order)
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return compareText(a.label, b.label)
  })
})

const selectedOrder = computed(() => allOrders.value.find(o => o.id === selectedOrderId.value) || null)

function getListPreferenceKey(userId) {
  return `listPreferences:${userId}`
}

async function loadListPreferences(userId) {
  isHydratingListState.value = true
  prefsReady.value = false

  try {
    const raw = await api.getSetting(getListPreferenceKey(userId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.filter === 'string') filter.value = parsed.filter
      if (typeof parsed.sortMode === 'string') sortMode.value = parsed.sortMode
      if (typeof parsed.groupMode === 'string') groupMode.value = parsed.groupMode
    }
  } catch {}

  isHydratingListState.value = false
  prefsReady.value = true
}

async function persistListPreferences() {
  if (!prefsReady.value || isHydratingListState.value || !currentUser.value?.id) return
  const payload = JSON.stringify({
    filter: filter.value,
    sortMode: sortMode.value,
    groupMode: groupMode.value,
  })
  await api.setSetting(getListPreferenceKey(currentUser.value.id), payload)
}

async function loadOrders() {
  if (!currentUser.value?.id) return
  const gradYear = graduationYearFilter.value === 'all' ? null : graduationYearFilter.value
  allOrders.value = await api.listOrders(currentUser.value.id, search.value, typeFilter.value, gradYear, sortMode.value)
}

async function loadGraduationYears() {
  if (!currentUser.value?.id) return
  const years = await api.getGraduationYears(currentUser.value.id)
  const current = getCurrentGraduationYear()
  if (!years.includes(current)) years.push(current)
  years.sort((a, b) => b - a)
  graduationYearList.value = years
}

async function bootstrapUserSession(user) {
  await loadListPreferences(user.id)
  await loadGraduationYears()
  await loadOrders()
}

async function checkAuth() {
  const hasUsers = await api.hasUsers()
  if (!hasUsers) {
    forceRegister.value = true
    return
  }

  const saved = await api.getSetting('rememberedUser')
  if (!saved) return

  try {
    const user = JSON.parse(saved)
    if (user && user.id && user.username) {
      currentUser.value = user
      isLoggedIn.value = true
      forceRegister.value = false
      await bootstrapUserSession(user)
    }
  } catch {}
}

async function onLoggedIn(user) {
  currentUser.value = user
  isLoggedIn.value = true
  forceRegister.value = false
  await bootstrapUserSession(user)
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

async function handleQuickSync() {
  if (!currentUser.value?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  if (syncBusy.value) return

  const overview = await api.getSyncOverview(currentUser.value.id)
  if (!overview?.syncDirectory) {
    showSettings.value = true
    ElMessage.warning('请先在设置中配置同步目录')
    return
  }

  syncBusy.value = true
  try {
    const result = await api.runSync(currentUser.value.id)
    if (!result?.success) {
      const errorTextMap = {
        INVALID_USER: '当前用户无效，请重新登录',
        SYNC_DIR_NOT_SET: '请先设置同步目录',
      }
      ElMessage.error(errorTextMap[result?.error] || result?.error || '同步失败')
      return
    }
    await loadGraduationYears()
    await loadOrders()
    ElMessage.success(`同步完成：导入 ${result.imported} 条，导出 ${result.exported} 条`)
  } finally {
    syncBusy.value = false
  }
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

watch([search, typeFilter, sortMode], () => {
  if (!isHydratingListState.value) loadOrders()
})

watch(graduationYearFilter, () => {
  if (!isHydratingListState.value && isLoggedIn.value) loadOrders()
})

watch([filter, sortMode, groupMode], () => {
  persistListPreferences()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: var(--gt-shell-bg);
}

.sidebar-resizer {
  width: 10px;
  flex-shrink: 0;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: background 0.15s ease;
}

.sidebar-resizer::before {
  content: '';
  width: 3px;
  height: calc(100% - 28px);
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.sidebar-resizer:hover::before,
.sidebar-resizer-active::before {
  background: rgba(99, 102, 241, 0.42);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.5);
}

.main-drag {
  height: var(--gt-drag-height);
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
  padding: 0 var(--gt-page-pad);
  padding-bottom: calc(var(--gt-page-pad-y) * 2 + 16px);
}

.empty-icon-box {
  width: var(--gt-empty-icon-box);
  height: var(--gt-empty-icon-box);
  border-radius: 16px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--gt-card-gap);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
}

.empty-title {
  font-size: var(--gt-empty-title-size);
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.empty-sub {
  font-size: var(--gt-empty-sub-size);
  color: #94a3b8;
}
</style>
