<template>
  <aside class="sidebar">
    <div class="drag-region" :class="{ 'drag-region-win': isWindows }" />

    <div class="sidebar-head">
      <div class="brand-row">
        <div class="brand-icon">
          <el-icon :size="18"><DataBoard /></el-icon>
        </div>
        <div class="brand-copy">
          <h1 class="brand-title">接单管理助手</h1>
          <span class="brand-version">v{{ appVersion }}</span>
        </div>
      </div>
      <el-input
        :model-value="search"
        @update:model-value="$emit('search-change', $event)"
        placeholder="搜索题目/学校/姓名/昵称..."
        prefix-icon="Search"
        clearable
        class="search-input"
      />
    </div>

    <div class="filter-panel">
      <div class="grad-seg">
        <button
          v-for="y in graduationYears"
          :key="y"
          class="grad-seg-btn"
          :class="{ 'grad-seg-active': graduationYearFilter === y }"
          @click="$emit('graduation-year-change', y)"
        >{{ y }}届<span v-if="y === currentGradYear" class="grad-current-tag">当前</span></button>
        <button
          class="grad-seg-btn"
          :class="{ 'grad-seg-active': graduationYearFilter === 'all' }"
          @click="$emit('graduation-year-change', 'all')"
        >全部届</button>
      </div>

      <div class="type-seg">
        <button
          class="type-seg-btn type-seg-btn-all"
          :class="{ 'type-seg-active': typeFilter === allTypeFilter.key }"
          :style="getTypeButtonStyle(allTypeFilter)"
          @click="$emit('type-change', allTypeFilter.key)"
        >{{ allTypeFilter.label }}</button>
        <div class="type-seg-grid">
          <button
            v-for="t in businessTypeFilters"
            :key="t.key"
            class="type-seg-btn type-seg-btn-business"
            :class="['type-key-' + t.key, { 'type-seg-active': typeFilter === t.key }]"
            :style="getTypeButtonStyle(t)"
            @click="$emit('type-change', t.key)"
          >{{ t.label }}</button>
        </div>
      </div>

      <div class="filter-body">
        <button
          class="advanced-toggle"
          :class="{ 'advanced-toggle-active': showAdvancedFilters || hasAdvancedFiltersActive }"
          @click="showAdvancedFilters = !showAdvancedFilters"
        >
          <span class="advanced-toggle-left">
            <el-icon :size="14"><Operation /></el-icon>
            <span class="advanced-toggle-text">学校 / 专业 / 接单人 / 处理人</span>
          </span>
          <span class="advanced-toggle-right">
            <span v-if="hasAdvancedFiltersActive" class="advanced-toggle-badge">已启用</span>
            <el-icon :size="14" class="advanced-toggle-arrow">
              <ArrowUp v-if="showAdvancedFilters" />
              <ArrowDown v-else />
            </el-icon>
          </span>
        </button>

        <div v-show="showAdvancedFilters" class="cascade-shell">
          <div class="cascade-shell-head">
            <span class="cascade-shell-title">精细筛选</span>
            <span class="cascade-shell-sub">按学校、专业与协作角色快速定位</span>
          </div>
          <div class="cascade-grid">
            <div class="filter-field filter-field-university">
              <div class="filter-field-label">
                <el-icon :size="13"><OfficeBuilding /></el-icon>
                <span>学校</span>
              </div>
              <el-select
                :model-value="universityFilter"
                @update:model-value="$emit('university-change', $event)"
                placeholder="全部学校"
                clearable
                size="small"
                class="cascade-select"
              >
                <el-option label="全部学校" value="all" />
                <el-option v-for="u in universities" :key="u" :label="u" :value="u" />
              </el-select>
            </div>

            <div class="filter-field filter-field-major">
              <div class="filter-field-label">
                <el-icon :size="13"><CollectionTag /></el-icon>
                <span>专业</span>
              </div>
              <el-select
                :model-value="majorFilter"
                @update:model-value="$emit('major-change', $event)"
                placeholder="全部专业"
                clearable
                size="small"
                class="cascade-select"
              >
                <el-option label="全部专业" value="all" />
                <el-option v-for="m in majors" :key="m" :label="m" :value="m" />
              </el-select>
            </div>

            <div class="filter-field filter-field-receiver">
              <div class="filter-field-label">
                <el-icon :size="13"><User /></el-icon>
                <span>接单人</span>
              </div>
              <el-select
                :model-value="receiverFilter"
                @update:model-value="$emit('receiver-change', $event)"
                placeholder="全部接单人"
                clearable
                size="small"
                class="cascade-select"
              >
                <el-option label="全部接单人" value="all" />
                <el-option v-for="r in receivers" :key="r" :label="r" :value="r" />
              </el-select>
            </div>

            <div class="filter-field filter-field-handler">
              <div class="filter-field-label">
                <el-icon :size="13"><SetUp /></el-icon>
                <span>处理人</span>
              </div>
              <el-select
                :model-value="handlerFilter"
                @update:model-value="$emit('handler-change', $event)"
                placeholder="全部处理人"
                clearable
                size="small"
                class="cascade-select"
              >
                <el-option label="全部处理人" value="all" />
                <el-option v-for="h in handlers" :key="h" :label="h" :value="h" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="status-row">
          <button
            v-for="f in filters"
            :key="f.key"
            class="filter-pill"
            :class="[filter === f.key ? f.activeClass : 'pill-default', 'pill-key-' + f.key]"
            @click="$emit('filter-change', f.key)"
          >
            {{ f.label }}
            <span
              v-if="f.countKey && badgeCounts && badgeCounts[f.countKey] > 0"
              class="pill-count"
              :class="{ 'pill-count-active': filter === f.key }"
            >{{ badgeCounts[f.countKey] }}</span>
          </button>
        </div>

        <div class="list-organizer">
          <div class="organizer-field">
            <span class="organizer-label">排序</span>
            <el-select
              :model-value="sortMode"
              @update:model-value="$emit('sort-change', $event)"
              size="small"
              class="organizer-select"
            >
              <el-option v-for="item in sortOptions" :key="item.key" :label="item.label" :value="item.key" />
            </el-select>
          </div>

          <div class="organizer-field">
            <span class="organizer-label">分组</span>
            <el-select
              :model-value="groupMode"
              @update:model-value="$emit('group-change', $event)"
              size="small"
              class="organizer-select"
            >
              <el-option v-for="item in groupOptions" :key="item.key" :label="item.label" :value="item.key" />
            </el-select>
          </div>
        </div>

        <div class="reset-row">
          <div class="result-meta">
            <span class="result-count">{{ totalVisibleOrders }}</span>
            <span class="result-label">个项目</span>
          </div>
          <el-button
            v-if="hasActiveFilters"
            text
            size="small"
            type="danger"
            class="reset-filters-btn"
            @click="$emit('reset-filters')"
          >
            <el-icon><RefreshLeft /></el-icon>
            重置筛选
          </el-button>
        </div>
      </div>
    </div>

    <div class="order-list">
      <template v-if="flatOrderCount > 0">
        <section v-for="group in orderGroups" :key="group.key" class="order-group">
          <button
            v-if="groupMode !== 'none'"
            type="button"
            class="order-group-head"
            @click="toggleGroup(group.key)"
          >
            <div class="order-group-copy">
              <div class="order-group-title">{{ group.label }}</div>
              <div v-if="group.description" class="order-group-sub">{{ group.description }}</div>
            </div>
            <div class="order-group-right">
              <div class="order-group-count">{{ group.orders.length }}</div>
              <el-icon class="order-group-arrow" :class="{ 'order-group-arrow-open': isGroupExpanded(group.key) }">
                <ArrowDown />
              </el-icon>
            </div>
          </button>

          <div v-show="groupMode === 'none' || isGroupExpanded(group.key)">
            <div
              v-for="order in group.orders"
              :key="order.id"
              class="order-card"
              :class="[
                { active: order.id === selectedOrderId },
                'card-urgency-' + getStatus(order).overall,
              ]"
              @click="$emit('select', order.id)"
            >
              <div class="card-top">
                <h3 class="card-title">{{ order.title }}</h3>
                <span
                  class="type-badge"
                  :style="{ color: (orderTypeMap[order.orderType || 'thesis'] || {}).color, background: (orderTypeMap[order.orderType || 'thesis'] || {}).color + '14' }"
                >{{ (orderTypeMap[order.orderType || 'thesis'] || {}).label }}</span>
              </div>

              <div v-if="order.university" class="card-school">
                <el-icon :size="12"><OfficeBuilding /></el-icon>
                {{ order.university }}<span v-if="order.major"> · {{ order.major }}</span>
              </div>

              <div class="card-people">
                <span><el-icon :size="12"><User /></el-icon> 接单人: {{ order.receiver || '本人' }}</span>
                <span><el-icon :size="12"><SetUp /></el-icon> 处理人: {{ order.handler || '本人' }}</span>
              </div>

              <div v-if="order.groupChatName" class="card-group-chat">
                <el-icon :size="12"><ChatDotRound /></el-icon>
                <span class="card-group-chat-label">群聊名称:</span>
                <span class="card-group-chat-value">{{ order.groupChatName }}</span>
              </div>

              <div class="card-bottom">
                <div class="card-badges">
                  <span v-if="order.isDraftSubmitted && (order.revisionCount || 0) === 0" class="badge badge-success">
                    <el-icon :size="12"><Check /></el-icon> 已交付初稿
                  </span>
                  <span v-else-if="order.isDraftSubmitted && (order.revisionCount || 0) > 0 && (order.pendingCount || 0) > 0" class="badge badge-warning">
                    <el-icon :size="12"><Clock /></el-icon> 第{{ order.revisionCount }}次修改中
                  </span>
                  <span v-else-if="order.isDraftSubmitted && (order.revisionCount || 0) > 0 && (order.pendingCount || 0) === 0" class="badge badge-success">
                    <el-icon :size="12"><Check /></el-icon> 已完成{{ order.revisionCount }}次修改
                  </span>
                  <span v-else-if="getStatus(order).deliveryStatus === 'danger'" class="badge badge-danger">
                    <el-icon :size="12"><WarningFilled /></el-icon> 交稿逾期
                  </span>
                  <span v-else-if="getStatus(order).deliveryStatus === 'warning'" class="badge badge-deadline-warn">
                    <el-icon :size="12"><WarningFilled /></el-icon> 交稿临近
                  </span>
                  <span v-if="getStatus(order).revisionStatus === 'danger'" class="badge badge-danger">
                    <el-icon :size="12"><Clock /></el-icon> 修改逾期
                  </span>
                  <span v-else-if="getStatus(order).revisionStatus === 'warning'" class="badge badge-deadline-warn">
                    <el-icon :size="12"><Clock /></el-icon> 修改临近
                  </span>
                  <span
                    v-if="!order.isDraftSubmitted && order.pendingCount > 0 && getStatus(order).deliveryStatus === 'normal' && getStatus(order).revisionStatus === 'normal'"
                    class="badge"
                    :class="order.overdueCount > 0 ? 'badge-danger' : 'badge-warning'"
                  >
                    <el-icon :size="12"><WarningFilled /></el-icon>
                    {{ order.pendingCount }} 待改
                  </span>
                  <span v-if="order.totalAmount > order.paidAmount" class="badge badge-unpaid">
                    <el-icon :size="12"><Money /></el-icon> 尾款未结清
                  </span>
                  <span v-if="(order.dispatchAmount || 0) > 0 && (order.handlerPaidAmount || 0) >= order.dispatchAmount" class="badge badge-handler-paid">
                    <el-icon :size="12"><Check /></el-icon> 已结清{{ order.handler ? ' ' + order.handler : '' }}
                  </span>
                  <span v-else-if="(order.dispatchAmount || 0) > 0 && (order.handlerPaidAmount || 0) < order.dispatchAmount" class="badge badge-handler-unpaid">
                    <el-icon :size="12"><Money /></el-icon> 待付{{ order.handler ? ' ' + order.handler : '' }} ¥{{ (order.dispatchAmount - (order.handlerPaidAmount || 0)).toFixed(0) }}
                  </span>
                  <span v-if="(order.refundAmount || 0) > 0" class="badge badge-refund">
                    <el-icon :size="12"><RefreshLeft /></el-icon> 已退¥{{ order.refundAmount }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <div v-else class="empty-list">
        <el-icon :size="36" color="#cbd5e1"><Filter /></el-icon>
        <p>没有找到相关单子</p>
        <span class="empty-list-sub">可以尝试切换排序、分组或筛选条件</span>
      </div>
    </div>

    <div class="sidebar-foot">
      <div class="foot-row foot-row-primary">
        <el-button type="primary" size="large" class="create-btn" @click="$emit('create')">
          <el-icon><CirclePlusFilled /></el-icon>
          新建接单项目
        </el-button>
      </div>
      <div class="foot-row foot-row-secondary">
        <el-tooltip content="立即同步" placement="top">
          <el-button size="large" class="settings-btn sync-btn" :loading="syncBusy" @click="$emit('open-sync')">
            <el-icon :size="18"><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="数据统计" placement="top">
          <el-button size="large" class="settings-btn" @click="$emit('open-stats')">
            <el-icon :size="18"><DataLine /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="设置" placement="top">
          <el-button size="large" class="settings-btn" @click="$emit('open-settings')">
            <el-icon :size="18"><Setting /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="退出登录" placement="top">
          <el-button size="large" class="settings-btn logout-btn" @click="$emit('logout')">
            <el-icon :size="18"><SwitchButton /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  appVersion: String,
  orderGroups: {
    type: Array,
    default: () => [],
  },
  selectedOrderId: Number,
  filter: String,
  search: String,
  typeFilter: String,
  graduationYearFilter: [Number, String],
  graduationYears: Array,
  universityFilter: String,
  universities: Array,
  majorFilter: String,
  majors: Array,
  receiverFilter: String,
  receivers: Array,
  handlerFilter: String,
  handlers: Array,
  badgeCounts: Object,
  sortMode: String,
  groupMode: String,
  syncBusy: Boolean,
  sortOptions: {
    type: Array,
    default: () => [],
  },
  groupOptions: {
    type: Array,
    default: () => [],
  },
  totalVisibleOrders: Number,
  isWindows: Boolean,
})

defineEmits([
  'select',
  'filter-change',
  'search-change',
  'type-change',
  'graduation-year-change',
  'university-change',
  'major-change',
  'receiver-change',
  'handler-change',
  'sort-change',
  'group-change',
  'reset-filters',
  'create',
  'open-sync',
  'open-settings',
  'open-stats',
  'logout',
])

function getCurrentGraduationYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}

const currentGradYear = getCurrentGraduationYear()
const showAdvancedFilters = ref(false)
const expandedGroupKeys = ref([])

watch(() => props.groupMode, (mode) => {
  if (mode === 'none') {
    expandedGroupKeys.value = []
  } else {
    expandedGroupKeys.value = []
  }
}, { immediate: true })

watch(() => props.orderGroups, (groups) => {
  const validKeys = new Set(groups.map(group => group.key))
  expandedGroupKeys.value = expandedGroupKeys.value.filter(key => validKeys.has(key))
}, { deep: true })

const flatOrderCount = computed(() =>
  props.orderGroups.reduce((sum, group) => sum + group.orders.length, 0)
)

const hasActiveFilters = computed(() =>
  props.typeFilter !== 'all' ||
  props.universityFilter !== 'all' ||
  props.majorFilter !== 'all' ||
  props.receiverFilter !== 'all' ||
  props.handlerFilter !== 'all' ||
  props.filter !== 'all' ||
  (props.search && props.search.trim() !== '')
)

const hasAdvancedFiltersActive = computed(() =>
  props.universityFilter !== 'all' ||
  props.majorFilter !== 'all' ||
  props.receiverFilter !== 'all' ||
  props.handlerFilter !== 'all'
)

const filters = [
  { key: 'all', label: '全部', activeClass: 'pill-all', countKey: null },
  { key: 'draft', label: '待提交初稿', activeClass: 'pill-draft', countKey: 'draft' },
  { key: 'todo', label: '待修改', activeClass: 'pill-todo', countKey: 'todo' },
  { key: 'unpaid', label: '欠尾款', activeClass: 'pill-unpaid', countKey: 'unpaid' },
  { key: 'idle', label: '🎉已完成🎉', activeClass: 'pill-idle', countKey: 'idle' },
]

const typeFilters = [
  { key: 'all', label: '全部类型', color: '#475569' },
  { key: 'thesis', label: '毕设论文', color: '#6366f1' },
  { key: 'format', label: '格式修改', color: '#0ea5e9' },
  { key: 'translation', label: '外文翻译', color: '#f59e0b' },
  { key: 'design', label: '设计定制', color: '#8b5cf6' },
  { key: 'reduction', label: '论文降重', color: '#10b981' },
  { key: 'special', label: '特殊订单', color: '#ef4444' },
]

const allTypeFilter = typeFilters[0]
const businessTypeFilters = typeFilters.slice(1)

const orderTypeMap = {
  thesis: { label: '毕设论文', color: '#6366f1' },
  format: { label: '格式修改', color: '#0ea5e9' },
  translation: { label: '外文翻译', color: '#f59e0b' },
  design: { label: '设计定制', color: '#8b5cf6' },
  reduction: { label: '论文降重', color: '#10b981' },
  special: { label: '特殊订单', color: '#ef4444' },
}

function hexToRgba(hex, alpha) {
  const normalized = (hex || '').replace('#', '')
  if (normalized.length !== 6) return `rgba(148, 163, 184, ${alpha})`
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getTypeButtonStyle(type) {
  const isActive = props.typeFilter === type.key
  const color = type.color || '#64748b'
  if (isActive) {
    return {
      color: '#fff',
      borderColor: color,
      background: `linear-gradient(135deg, ${color} 0%, ${hexToRgba(color, 0.86)} 100%)`,
      boxShadow: `0 10px 22px ${hexToRgba(color, 0.26)}`,
    }
  }
  return {
    color,
    borderColor: hexToRgba(color, 0.18),
    background: `linear-gradient(135deg, ${hexToRgba(color, 0.12)} 0%, ${hexToRgba(color, 0.04)} 100%)`,
    boxShadow: 'none',
  }
}

function isGroupExpanded(key) {
  return expandedGroupKeys.value.includes(key)
}

function toggleGroup(key) {
  if (isGroupExpanded(key)) {
    expandedGroupKeys.value = expandedGroupKeys.value.filter(item => item !== key)
  } else {
    expandedGroupKeys.value = [...expandedGroupKeys.value, key]
  }
}

function getStatus(order) {
  let deliveryStatus = 'normal'
  if (order.isDraftSubmitted) {
    deliveryStatus = 'delivered'
  } else if (order.deadline) {
    const target = new Date(order.deadline + 'T23:59:59')
    const diffMs = target - new Date()
    const diffHours = diffMs / 3600000
    const diffDays = diffHours / 24

    const type = order.orderType || 'thesis'
    if (['thesis', 'design'].includes(type)) {
      if (diffDays <= 0) deliveryStatus = 'danger'
      else if (diffDays <= 2) deliveryStatus = 'warning'
    } else {
      if (diffHours <= 0) deliveryStatus = 'danger'
      else if (diffHours <= 2) deliveryStatus = 'warning'
    }
  }

  let revisionStatus = 'normal'
  if (order.nearestRevisionDeadline) {
    const dl = order.nearestRevisionDeadline
    const target = dl.includes('T') ? new Date(dl) : new Date(dl + 'T23:59:59')
    const diffHours = (target - new Date()) / 3600000
    if (diffHours <= 0) revisionStatus = 'danger'
    else if (diffHours <= 24) revisionStatus = 'warning'
  }

  const levels = { normal: 0, delivered: 0, warning: 1, danger: 2 }
  const overallLevel = Math.max(levels[deliveryStatus] || 0, levels[revisionStatus] || 0)
  const overall = ['normal', 'warning', 'danger'][overallLevel]

  return { deliveryStatus, revisionStatus, overall }
}
</script>

<style scoped>
.sidebar {
  width: var(--gt-sidebar-width);
  min-width: var(--gt-sidebar-width);
  max-width: var(--gt-sidebar-width);
  background: #fff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.02);
  position: relative;
  z-index: 10;
}

.drag-region {
  height: var(--gt-drag-height);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.drag-region-win {
  height: 8px;
}

.sidebar-head {
  padding: 0 var(--gt-sidebar-head-px) var(--gt-sidebar-head-pb);
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.brand-icon {
  width: var(--gt-brand-icon-size);
  height: var(--gt-brand-icon-size);
  border-radius: 8px;
  background: #4f46e5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-size: var(--gt-brand-title-size);
  font-weight: 700;
  color: #1e293b;
}

.brand-version {
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 2px 8px;
  line-height: 1.2;
  flex-shrink: 0;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

.filter-panel {
  padding: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.grad-seg {
  display: flex;
  padding: 10px var(--gt-sidebar-section-px) 0;
  gap: 4px;
  background: #f8fafc;
  flex-wrap: wrap;
}

.grad-seg-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 16px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.grad-seg-btn:hover {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #eef2ff;
}

.grad-seg-active {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
}

.grad-seg-active:hover {
  background: #4338ca;
  color: #fff;
  border-color: #4338ca;
}

.grad-current-tag {
  font-size: 10px;
  background: rgba(255,255,255,0.25);
  padding: 0 4px;
  border-radius: 4px;
  line-height: 1.4;
}

.grad-seg-active .grad-current-tag {
  background: rgba(255,255,255,0.3);
}

.type-seg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px var(--gt-sidebar-section-px) 11px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.type-seg-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.type-seg-btn {
  min-height: var(--gt-filter-btn-height);
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 12px;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
  text-align: center;
  white-space: nowrap;
}

.type-seg-btn:hover {
  transform: translateY(-1px);
}

.type-seg-active {
  transform: translateY(-1px);
}

.type-seg-active:hover {
  transform: translateY(-1px);
}

.type-seg-btn-all,
.type-seg-btn-business {
  width: 100%;
}

@media (max-width: 520px) {
  .type-seg-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.filter-body {
  padding: 10px var(--gt-sidebar-section-px) 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  color: #475569;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.advanced-toggle:hover {
  border-color: #cbd5e1;
  background: linear-gradient(180deg, #ffffff, #f1f5f9);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  transform: translateY(-1px);
}

.advanced-toggle-active {
  border-color: #c7d2fe;
  background: linear-gradient(180deg, #f8faff, #eef2ff);
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.08);
}

.advanced-toggle-left,
.advanced-toggle-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.advanced-toggle-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.advanced-toggle-badge {
  font-size: 10px;
  font-weight: 700;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.12);
  padding: 3px 7px;
  border-radius: 999px;
  line-height: 1;
}

.advanced-toggle-arrow {
  color: #64748b;
}

.cascade-shell {
  padding: 8px 10px 9px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.96));
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 10px 24px rgba(15, 23, 42, 0.04);
}

.cascade-shell-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.cascade-shell-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #334155;
  line-height: 1.2;
}

.cascade-shell-sub {
  font-size: 9px;
  color: #94a3b8;
  white-space: nowrap;
  line-height: 1.2;
}

.cascade-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.filter-field {
  position: relative;
  padding: 7px 8px 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: #fff;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.filter-field:hover {
  transform: translateY(-1px);
  border-color: #dbe4ff;
  box-shadow: 0 10px 18px rgba(99, 102, 241, 0.08);
}

.filter-field-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.1;
}

.filter-field-university .filter-field-label { color: #4f46e5; }
.filter-field-major .filter-field-label { color: #0f766e; }
.filter-field-receiver .filter-field-label { color: #c2410c; }
.filter-field-handler .filter-field-label { color: #7c3aed; }

.cascade-select :deep(.el-select__wrapper),
.organizer-select :deep(.el-select__wrapper) {
  min-height: 34px;
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  box-shadow: inset 0 0 0 1px #e2e8f0;
}

.cascade-select :deep(.el-select__wrapper.is-focused),
.organizer-select :deep(.el-select__wrapper.is-focused) {
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #6366f1, 0 0 0 4px rgba(99, 102, 241, 0.12);
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.filter-pill {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 11px;
  white-space: nowrap;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pill-default {
  background: #f1f5f9;
  color: #64748b;
  border-color: #e2e8f0;
}

.pill-default:hover {
  background: #e2e8f0;
  color: #475569;
}

.pill-key-all.pill-default {
  background: #f0f0ff;
  color: #6366f1;
  border-color: #e0e7ff;
}

.pill-key-draft.pill-default {
  background: #faf5ff;
  color: #9333ea;
  border-color: #ede9fe;
}

.pill-key-todo.pill-default {
  background: #fffbeb;
  color: #d97706;
  border-color: #fef3c7;
}

.pill-key-unpaid.pill-default {
  background: #fff5f5;
  color: #e11d48;
  border-color: #ffe4e6;
}

.pill-all {
  background: #e0e7ff;
  color: #3730a3;
  border-color: #a5b4fc;
}

.pill-draft {
  background: #ede9fe;
  color: #6b21a8;
  border-color: #c4b5fd;
}

.pill-todo {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

.pill-unpaid {
  background: #ffe4e6;
  color: #9f1239;
  border-color: #fda4af;
}

.pill-idle {
  background: linear-gradient(135deg, #e0e7ff, #ede9fe, #fce7f3);
  color: #6d28d9;
  border-color: #c4b5fd;
}

.pill-key-idle.pill-default {
  background: linear-gradient(135deg, #eef2ff, #f5f3ff, #fdf2f8);
  color: #7c3aed;
  border-color: #ddd6fe;
}

.pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  background: rgba(0,0,0,0.12);
  color: inherit;
}

.list-organizer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.organizer-field {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px;
  background: #fff;
}

.organizer-label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.03em;
}

.reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.result-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: #64748b;
}

.result-count {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.result-label {
  font-size: 11px;
}

.reset-filters-btn {
  padding: 0 4px;
  font-size: 11px;
}

.order-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px var(--gt-sidebar-section-px);
}

.order-group + .order-group {
  margin-top: 12px;
}

.order-group {
  position: relative;
}

.order-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 6px;
  width: 100%;
  border: none;
  background: rgba(248, 250, 252, 0.96);
  backdrop-filter: blur(10px);
  cursor: pointer;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 4;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgba(148, 163, 184, 0.08);
  margin-bottom: 8px;
}

.order-group-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.order-group-sub {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.order-group-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.order-group-count {
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.order-group-arrow {
  color: #94a3b8;
  transition: transform 0.15s ease, color 0.15s ease;
}

.order-group-arrow-open {
  transform: rotate(180deg);
  color: #4f46e5;
}

.order-card {
  padding: var(--gt-order-card-py) var(--gt-order-card-px);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f1f5f9;
  background: #fff;
  margin-bottom: 8px;
}

.order-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.order-card.active {
  background: #eef2ff;
  border-color: #c7d2fe;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.08);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  gap: 8px;
}

.card-title {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  line-height: 1.4;
  color: #1e293b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.order-card.active .card-title {
  color: #312e81;
}

.type-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.card-school {
  font-size: var(--gt-text-xs);
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.card-people {
  display: flex;
  gap: 12px;
  font-size: var(--gt-text-xs);
  color: #64748b;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.card-people span {
  display: flex;
  align-items: center;
  gap: 3px;
}

.card-group-chat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--gt-text-xs);
  color: #64748b;
  margin-bottom: 10px;
  min-width: 0;
}

.card-group-chat-label {
  flex-shrink: 0;
}

.card-group-chat-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-bottom {
  display: flex;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(241, 245, 249, 0.8);
}

.card-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-warning,
.badge-deadline-warn,
.badge-refund {
  background: #fffbeb;
  color: #d97706;
}

.badge-success,
.badge-handler-paid {
  background: #ecfdf5;
  color: #059669;
}

.badge-danger,
.badge-unpaid {
  background: #fff1f2;
  color: #be123c;
}

.badge-handler-unpaid {
  background: #fef3c7;
  color: #b45309;
}

.order-card.card-urgency-warning {
  border-left: 3px solid #f59e0b;
}

.order-card.card-urgency-danger {
  border-left: 3px solid #e11d48;
  background: #fef2f2;
}

.order-card.card-urgency-danger.active {
  background: #fef2f2;
  border-color: #e11d48;
  border-left: 3px solid #e11d48;
}

.order-card.card-urgency-warning.active {
  border-left: 3px solid #f59e0b;
}

.empty-list {
  text-align: center;
  padding: 60px 0;
  color: #94a3b8;
  font-size: 13px;
}

.empty-list-sub {
  display: block;
  margin-top: 8px;
  font-size: 11px;
}

.sidebar-foot {
  padding: 12px var(--gt-sidebar-section-px);
  border-top: 1px solid #e2e8f0;
  background: #fff;
}

.foot-row {
  display: flex;
  gap: 8px;
}

.foot-row + .foot-row {
  margin-top: 8px;
}

.foot-row-secondary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.create-btn {
  flex: 1;
  border-radius: 8px;
  font-weight: 500;
}

.settings-btn {
  border-radius: 8px !important;
  width: 100% !important;
  padding: 0 !important;
  color: #64748b !important;
  border-color: #e2e8f0 !important;
}

.settings-btn:hover {
  color: #4f46e5 !important;
  border-color: #c7d2fe !important;
  background: #eef2ff !important;
}

.sync-btn:hover {
  color: #0f766e !important;
  border-color: #99f6e4 !important;
  background: #ecfdf5 !important;
}

.logout-btn:hover {
  color: #e11d48 !important;
  border-color: #fecdd3 !important;
  background: #fff1f2 !important;
}
</style>
