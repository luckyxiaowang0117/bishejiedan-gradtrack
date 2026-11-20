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
        placeholder="搜索编号/题目/学校/姓名/昵称..."
        prefix-icon="Search"
        clearable
        class="search-input"
      />
    </div>

    <div class="filter-panel" @keydown.esc="showAdvancedFilters = false">
      <div class="quick-filters">
        <div class="graduation-filters" role="group" aria-label="毕业届">
          <button
            v-for="year in graduationYears"
            :key="year"
            type="button"
            class="graduation-filter"
            :aria-pressed="graduationYearFilter === year"
            @click="$emit('graduation-year-change', year)"
          >
            {{ year }}届
            <span v-if="year === currentGradYear" class="current-year-label">当前</span>
          </button>
          <button
            type="button"
            class="graduation-filter"
            :aria-pressed="graduationYearFilter === 'all'"
            @click="$emit('graduation-year-change', 'all')"
          >全部届</button>
        </div>

        <div class="type-filters" role="group" aria-label="业务类型">
          <button
            type="button"
            class="type-filter-all"
            :aria-pressed="typeFilter === 'all'"
            @click="$emit('type-change', 'all')"
          >全部类型</button>
          <div class="type-filter-grid">
            <button
              v-for="(type, key) in orderTypeMap"
              :key="key"
              type="button"
              class="type-filter"
              :style="{ '--type-color': type.color }"
              :aria-pressed="typeFilter === key"
              @click="$emit('type-change', key)"
            >{{ type.label }}</button>
          </div>
        </div>
      </div>

      <div class="filter-controls">
        <button
          type="button"
          class="advanced-toggle"
          :class="{ 'advanced-toggle-active': showAdvancedFilters || advancedFilterCount > 0 }"
          :aria-expanded="showAdvancedFilters"
          aria-controls="sidebar-advanced-filters"
          @click="showAdvancedFilters = !showAdvancedFilters"
        >
          <el-icon><Operation /></el-icon>
          <span class="advanced-toggle-label">精细筛选</span>
          <span v-if="advancedFilterCount" class="advanced-toggle-badge">{{ advancedFilterCount }}</span>
          <el-icon><ArrowUp v-if="showAdvancedFilters" /><ArrowDown v-else /></el-icon>
        </button>

        <div v-show="showAdvancedFilters" id="sidebar-advanced-filters" class="cascade-shell">
          <div class="cascade-grid">
            <div class="filter-field">
              <span>学校</span>
              <el-select
                :model-value="universityFilter"
                aria-label="学校"
                placeholder="全部学校"
                size="small"
                filterable
                @update:model-value="$emit('university-change', $event)"
              >
                <el-option label="全部学校" value="all" />
                <el-option v-for="item in universities" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
            <div class="filter-field">
              <span>专业</span>
              <el-select
                :model-value="majorFilter"
                aria-label="专业"
                placeholder="全部专业"
                size="small"
                filterable
                @update:model-value="$emit('major-change', $event)"
              >
                <el-option label="全部专业" value="all" />
                <el-option v-for="item in majors" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
            <div class="filter-field">
              <span>接单人</span>
              <el-select
                :model-value="receiverFilter"
                aria-label="接单人"
                placeholder="全部接单人"
                size="small"
                filterable
                @update:model-value="$emit('receiver-change', $event)"
              >
                <el-option label="全部接单人" value="all" />
                <el-option v-for="item in receivers" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
            <div class="filter-field">
              <span>处理人</span>
              <el-select
                :model-value="handlerFilter"
                aria-label="处理人"
                placeholder="全部处理人"
                size="small"
                filterable
                @update:model-value="$emit('handler-change', $event)"
              >
                <el-option label="全部处理人" value="all" />
                <el-option v-for="item in handlers" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
          </div>

          <el-checkbox
            class="title-missing-filter"
            :model-value="titleMissingOnly"
            @update:model-value="$emit('title-missing-change', $event)"
          >仅看待补充题目</el-checkbox>
        </div>
      </div>

      <div class="status-row" aria-label="订单状态">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="filter-pill"
          :class="[filter === f.key ? f.activeClass : 'pill-default', 'pill-key-' + f.key]"
          :aria-pressed="filter === f.key"
          @click="$emit('filter-change', f.key)"
        >
          {{ f.label }}
          <span v-if="f.countKey && badgeCounts?.[f.countKey] > 0" class="pill-count">
            {{ badgeCounts[f.countKey] }}
          </span>
        </button>
      </div>

      <div class="result-toolbar">
        <span class="result-count">{{ totalVisibleOrders }} 单</span>
        <div class="list-organizer">
          <el-select
            :model-value="sortMode"
            aria-label="排序"
            :title="'排序 · ' + (sortOptions.find(item => item.key === sortMode)?.label || '')"
            size="small"
            @update:model-value="$emit('sort-change', $event)"
          >
            <template #prefix><el-icon><Sort /></el-icon></template>
            <el-option v-for="item in sortOptions" :key="item.key" :label="item.label" :value="item.key" />
          </el-select>

          <el-select
            :model-value="groupMode"
            aria-label="分组"
            :title="'分组 · ' + (groupOptions.find(item => item.key === groupMode)?.label || '')"
            size="small"
            @update:model-value="$emit('group-change', $event)"
          >
            <template #prefix><el-icon><Grid /></el-icon></template>
            <el-option v-for="item in groupOptions" :key="item.key" :label="item.label" :value="item.key" />
          </el-select>
        </div>
        <button
          v-if="groupMode !== 'none' && orderGroups.length > 0"
          type="button"
          class="toolbar-action"
          :aria-label="isAllGroupsExpanded ? '全部收起' : '全部展开'"
          :title="isAllGroupsExpanded ? '全部收起' : '全部展开'"
          @click="toggleAllGroups"
        >
          <el-icon><DArrowLeft v-if="isAllGroupsExpanded" /><DArrowRight v-else /></el-icon>
        </button>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="toolbar-action reset-filters-btn"
          aria-label="重置筛选"
          title="重置筛选"
          @click="$emit('reset-filters')"
        >
          <el-icon><RefreshLeft /></el-icon>
        </button>
      </div>
    </div>

    <div class="order-list">
      <template v-if="flatOrderCount > 0">
        <section v-for="group in orderGroups" :key="group.key" class="order-group">
          <button
            v-if="groupMode !== 'none'"
            type="button"
            class="order-group-head"
            :aria-expanded="isGroupExpanded(group.key)"
            @click="toggleGroup(group.key)"
          >
            <span class="order-group-title" :title="group.label">{{ group.label }}</span>
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
              role="button"
              tabindex="0"
              :class="[
                { active: order.id === selectedOrderId },
                'card-urgency-' + getStatus(order).overall,
              ]"
              @click="$emit('select', order.id)"
              @keydown.enter="$emit('select', order.id)"
              @keydown.space.prevent="$emit('select', order.id)"
            >
              <div class="card-top">
                <h3 class="card-title" :title="order.title || '待客户确认题目'">{{ order.title || '待客户确认题目' }}</h3>
                <span
                  class="type-badge"
                  :style="{ color: (orderTypeMap[order.orderType] || orderTypeMap.thesis).color, background: `color-mix(in srgb, ${(orderTypeMap[order.orderType] || orderTypeMap.thesis).color} 8%, var(--gt-surface))` }"
                >{{ (orderTypeMap[order.orderType] || orderTypeMap.thesis).label }}</span>
              </div>
              <div
                v-if="order.orderCode || order.packageTier || order.orderType === 'special'"
                class="card-identity"
              >
                <span v-if="order.orderCode" class="card-order-code" :title="order.orderCode">{{ order.orderCode }}</span>
                <span v-if="order.packageTier" class="card-package" :class="'package-' + getPackageMeta(order.packageTier).key">
                  <strong>{{ getPackageMeta(order.packageTier).code }}</strong> · {{ getPackageMeta(order.packageTier).label }}
                </span>
                <span
                  v-if="order.orderType === 'special'"
                  class="card-special-service"
                  :title="order.specialService || '服务未填写'"
                >服务项目 {{ order.specialService || '未填写' }}</span>
              </div>

              <div v-if="order.university || order.major" class="card-school" :title="[order.university, order.major].filter(Boolean).join(' · ')">
                <span class="card-school-badge">
                  <el-icon><OfficeBuilding /></el-icon>
                  <span>{{ [order.university, order.major].filter(Boolean).join(' · ') }}</span>
                </span>
              </div>

              <div class="card-people">
                <span :title="'接单人 ' + (order.receiver || '本人')">
                  <el-icon><User /></el-icon>
                  <span>接单人 {{ order.receiver || '本人' }}</span>
                </span>
                <span :title="'处理人 ' + (order.handler || '本人')">
                  <el-icon><SetUp /></el-icon>
                  <span>处理人 {{ order.handler || '本人' }}</span>
                </span>
              </div>

              <div v-if="order.groupChatName?.trim()" class="card-group-chat" :title="order.groupChatName">
                <el-icon><ChatDotRound /></el-icon>
                <span>群聊名称 {{ order.groupChatName }}</span>
              </div>

              <div class="card-bottom">
                <div class="card-badges">
                  <span v-if="!String(order.title || '').trim()" class="badge badge-warning">
                    <el-icon :size="12"><WarningFilled /></el-icon> 待补充题目
                  </span>
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
                  <span v-if="!isSelfHandler(order) && (order.dispatchAmount || 0) > 0 && (order.handlerPaidAmount || 0) >= order.dispatchAmount" class="badge badge-handler-paid">
                    <el-icon :size="12"><Check /></el-icon> 已结清{{ order.handler ? ' ' + order.handler : '' }}
                  </span>
                  <span v-else-if="!isSelfHandler(order) && (order.dispatchAmount || 0) > 0 && (order.handlerPaidAmount || 0) < order.dispatchAmount" class="badge badge-handler-unpaid">
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
        <el-icon :size="36" color="var(--gt-border-strong)"><Filter /></el-icon>
        <p>没有找到相关单子</p>
        <span class="empty-list-sub">可以尝试切换排序、分组或筛选条件</span>
      </div>
    </div>

    <div class="sidebar-foot">
      <el-button type="primary" size="large" class="create-btn" @click="$emit('create')">
        <el-icon><CirclePlusFilled /></el-icon>
        新建接单项目
      </el-button>
      <div class="sidebar-utilities">
        <el-tooltip content="立即同步" placement="top">
          <el-button size="large" aria-label="立即同步" class="settings-btn sync-btn" :loading="syncBusy" @click="$emit('open-sync')">
            <el-icon :size="18"><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="数据统计" placement="top">
          <el-button size="large" aria-label="数据统计" class="settings-btn" @click="$emit('open-stats')">
            <el-icon :size="18"><DataLine /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="设置" placement="top">
          <el-button size="large" aria-label="设置" class="settings-btn" @click="$emit('open-settings')">
            <el-icon :size="18"><Setting /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="退出登录" placement="top">
          <el-button size="large" aria-label="退出登录" class="settings-btn logout-btn" @click="$emit('logout')">
            <el-icon :size="18"><SwitchButton /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { orderTypeMeta as orderTypeMap } from '../orderTypeMeta.js'

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
  titleMissingOnly: Boolean,
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
  'title-missing-change',
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
    expandedGroupKeys.value = props.orderGroups.map(group => group.key)
  }
}, { immediate: true })

watch(() => props.orderGroups, (groups, previous) => {
  if (props.groupMode === 'none') return
  const previouslyVisible = new Set(previous.map(group => group.key))
  expandedGroupKeys.value = groups
    .filter(group => !previouslyVisible.has(group.key) || expandedGroupKeys.value.includes(group.key))
    .map(group => group.key)
})

const isAllGroupsExpanded = computed(() => {
  if (props.groupMode === 'none' || props.orderGroups.length === 0) return false
  return props.orderGroups.every(g => expandedGroupKeys.value.includes(g.key))
})

function toggleAllGroups() {
  if (isAllGroupsExpanded.value) {
    expandedGroupKeys.value = []
  } else {
    expandedGroupKeys.value = props.orderGroups.map(g => g.key)
  }
}

const flatOrderCount = computed(() =>
  props.orderGroups.reduce((sum, group) => sum + group.orders.length, 0)
)

const hasActiveFilters = computed(() =>
  props.typeFilter !== 'all' ||
  props.universityFilter !== 'all' ||
  props.majorFilter !== 'all' ||
  props.receiverFilter !== 'all' ||
  props.handlerFilter !== 'all' ||
  props.titleMissingOnly ||
  props.filter !== 'all' ||
  (props.search && props.search.trim() !== '')
)

const advancedFilterCount = computed(() =>
  [props.universityFilter, props.majorFilter, props.receiverFilter, props.handlerFilter]
    .filter(value => value && value !== 'all').length + Number(!!props.titleMissingOnly)
)

const filters = [
  { key: 'all', label: '全部', activeClass: 'pill-all', countKey: null },
  { key: 'draft', label: '待提交初稿', activeClass: 'pill-draft', countKey: 'draft' },
  { key: 'todo', label: '待修改', activeClass: 'pill-todo', countKey: 'todo' },
  { key: 'unpaid', label: '欠尾款', activeClass: 'pill-unpaid', countKey: 'unpaid' },
  { key: 'idle', label: '已完成', activeClass: 'pill-idle', countKey: 'idle' },
]

const packageMetaMap = {
  budget: { key: 'budget', code: '套餐1', label: '省钱套餐' },
  carefree: { key: 'carefree', code: '套餐2', label: '省心套餐' },
  vip: { key: 'vip', code: '套餐3', label: '超级VIP套餐' },
}

function getPackageMeta(packageTier) {
  return packageMetaMap[packageTier] || packageMetaMap.budget
}

function isSelfHandler(order) {
  const handler = String(order?.handler || '').trim()
  return !handler || handler === '本人'
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
  background: var(--gt-surface);
  border-right: 1px solid var(--gt-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.02);
  position: relative;
  z-index: 10;
  container-type: inline-size;
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
  padding: 0 var(--gt-sidebar-section-px) 9px;
  border-bottom: 1px solid var(--gt-border);
  flex-shrink: 0;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
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
  color: var(--gt-text-body);
}

.brand-version {
  font-size: 11px;
  font-weight: 700;
  color: var(--gt-text-violet);
  background: var(--gt-accent-surface);
  border: 1px solid var(--gt-accent-border);
  border-radius: 999px;
  padding: 2px 8px;
  line-height: 1.2;
  flex-shrink: 0;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--gt-border);
  background: var(--gt-surface-subtle);
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: light-dark(#6366f1, #a5b4fc);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

.filter-panel {
  display: grid;
  gap: 5px;
  flex-shrink: 0;
  padding: 8px var(--gt-sidebar-section-px);
  border-bottom: 1px solid var(--gt-border);
}

.filter-controls {
  position: relative;
}

.quick-filters {
  display: grid;
  min-width: 0;
  gap: 6px;
  margin: -8px calc(-1 * var(--gt-sidebar-section-px)) 0;
  padding: 7px var(--gt-sidebar-section-px);
  border-bottom: 1px solid var(--gt-border);
  background: linear-gradient(180deg, var(--gt-surface-subtle), var(--gt-surface-muted));
}

.graduation-filters {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.graduation-filter {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--gt-border-strong);
  border-radius: 999px;
  background: var(--gt-surface);
  color: light-dark(#334155, var(--gt-text-body));
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.graduation-filter:hover {
  border-color: light-dark(#818cf8, #a5b4fc);
}

.graduation-filter[aria-pressed="true"] {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #fff;
}

.graduation-filter:focus-visible {
  outline-offset: -2px;
}

.current-year-label {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--gt-accent-surface-strong);
  color: var(--gt-text-violet);
  font-size: 9px;
}

.graduation-filter[aria-pressed="true"] .current-year-label {
  background: #ffffff40;
  color: #fff;
}

.type-filters,
.type-filter-grid {
  display: grid;
  gap: 5px;
}

.type-filter-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.type-filter-all,
.type-filter {
  min-height: 30px;
  padding: 3px 6px;
  border: 1px solid;
  border-radius: 10px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.type-filter-all {
  border-color: var(--gt-border-strong);
  background: var(--gt-surface);
  color: light-dark(#334155, var(--gt-text-body));
}

.type-filter-all[aria-pressed="true"] {
  border-color: light-dark(#334155, var(--gt-border-strong));
  background: linear-gradient(135deg, light-dark(#334155, #262626), light-dark(#475569, #353535));
  color: #fff;
}

.type-filter {
  border-color: color-mix(in srgb, var(--type-color) 24%, var(--gt-surface));
  background: color-mix(in srgb, var(--type-color) 8%, var(--gt-surface));
  color: var(--type-color);
}

.type-filter[aria-pressed="true"] {
  border-color: var(--type-color);
  background: var(--type-color);
  color: var(--gt-type-on);
}

.type-filter-all:hover,
.type-filter:hover {
  box-shadow: inset 0 0 0 1px currentColor;
}

.advanced-toggle,
.toolbar-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: var(--gt-surface);
  border: 1px solid var(--gt-border);
  border-radius: 6px;
  color: light-dark(#28364b, var(--gt-text-body));
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.advanced-toggle {
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  font-weight: 600;
}

.advanced-toggle-label {
  margin-right: auto;
}

.advanced-toggle:hover,
.advanced-toggle-active,
.toolbar-action:hover {
  color: var(--gt-text-violet);
  background: var(--gt-accent-surface);
  border-color: var(--gt-accent-border);
}

.advanced-toggle-badge {
  min-width: 17px;
  padding: 1px 4px;
  border-radius: 8px;
  background: #4338ca;
  color: #fff;
  font-size: 10px;
  text-align: center;
}

.cascade-shell {
  margin-top: 5px;
  padding: 5px 8px 2px;
  border: 1px solid var(--gt-border);
  border-radius: 8px;
  background: var(--gt-surface-subtle);
}

.cascade-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
}

.filter-field {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr);
  gap: 5px;
  align-items: center;
  color: light-dark(#334155, var(--gt-text-body));
  font-size: 12px;
  font-weight: 500;
}

.list-organizer :deep(.el-select__wrapper) {
  min-height: 30px;
  border-radius: 6px;
}

.cascade-grid :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 6px;
}

.title-missing-filter {
  height: 22px;
  margin: 1px 0 0;
}

@media (max-height: 700px) {
  .sidebar-head {
    padding-bottom: 7px;
  }

  .brand-row {
    margin-bottom: 5px;
  }

  .filter-panel {
    gap: 4px;
    padding-bottom: 5px;
  }

  .quick-filters {
    padding-block: 5px;
  }

  .type-filter-all,
  .type-filter {
    min-height: 27px;
  }

  .cascade-shell {
    position: absolute;
    z-index: 5;
    top: 0;
    left: calc(100% + var(--gt-sidebar-section-px) + 8px);
    width: 350px;
    margin: 0;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  }
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.filter-pill {
  min-height: 27px;
  padding: 3px 7px;
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
  background: var(--gt-surface-muted);
  color: var(--gt-text-main);
  font-weight: 600;
  border-color: var(--gt-border-strong);
}

.pill-default:hover {
  background: var(--gt-surface-raised);
  color: var(--gt-text-heading);
}

.pill-key-all.pill-default {
  background: light-dark(#f0f0ff, #24223d);
  color: var(--gt-text-violet);
  border-color: var(--gt-accent-border);
}

.pill-key-draft.pill-default {
  background: light-dark(#faf5ff, #2d2445);
  color: light-dark(#9333ea, #d8b4fe);
  border-color: light-dark(#ede9fe, #654e90);
}

.pill-key-todo.pill-default {
  background: var(--gt-warning-surface);
  color: var(--gt-text-warning);
  border-color: var(--gt-warning-border);
}

.pill-key-unpaid.pill-default {
  background: light-dark(#fff5f5, #352333);
  color: var(--gt-text-danger);
  border-color: var(--gt-danger-border);
}

.pill-all {
  background: var(--gt-accent-surface-strong);
  color: light-dark(#3730a3, #c7d2fe);
  border-color: light-dark(#a5b4fc, #6683b4);
}

.pill-draft {
  background: light-dark(#ede9fe, #2d2445);
  color: light-dark(#6b21a8, #d8b4fe);
  border-color: light-dark(#c4b5fd, #654e90);
}

.pill-todo {
  background: light-dark(#fef3c7, #48351c);
  color: var(--gt-text-warning);
  border-color: light-dark(#fcd34d, #9b6c31);
}

.pill-unpaid {
  background: light-dark(#ffe4e6, #352333);
  color: light-dark(#9f1239, #fda4af);
  border-color: light-dark(#fda4af, #965264);
}

.pill-idle {
  background: linear-gradient(135deg, var(--gt-accent-surface-strong), light-dark(#ede9fe, #2d2445), light-dark(#fce7f3, #332743));
  color: light-dark(#6d28d9, #d8b4fe);
  border-color: light-dark(#c4b5fd, #654e90);
}

.pill-key-idle.pill-default {
  background: linear-gradient(135deg, var(--gt-accent-surface), light-dark(#f5f3ff, #2d2445), light-dark(#fdf2f8, #332743));
  color: light-dark(#7c3aed, #d8b4fe);
  border-color: light-dark(#ddd6fe, #654e90);
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
  background: light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.12));
  color: inherit;
}

.result-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.list-organizer {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.result-count {
  padding-right: 2px;
  color: var(--gt-text-body);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.toolbar-action {
  width: 28px;
  height: 30px;
  flex-shrink: 0;
  font-size: 14px;
}

.order-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 5px var(--gt-sidebar-section-px);
}

.order-group + .order-group {
  margin-top: 8px;
}

.order-group {
  position: relative;
}

.order-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 6px;
  min-height: 28px;
  width: 100%;
  border: none;
  background: color-mix(in srgb, var(--gt-surface-subtle) 96%, transparent);
  backdrop-filter: blur(10px);
  cursor: pointer;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 4;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgba(148, 163, 184, 0.08);
  margin-bottom: 4px;
}

.order-group-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--gt-text-body);
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
  background: var(--gt-accent-surface);
  color: light-dark(#312e81, #c7d2fe);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
}

.order-group-arrow {
  color: var(--gt-text-main);
  transition: transform 0.15s ease, color 0.15s ease;
}

.order-group-arrow-open {
  transform: rotate(180deg);
  color: light-dark(#4f46e5, #c7d2fe);
}

.order-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3px;
  padding: 6px 9px;
  line-height: 1.35;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--gt-border);
  background: var(--gt-surface);
  margin-bottom: 6px;
}

.order-card:hover {
  border-color: var(--gt-border-strong);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.order-card.active {
  background: var(--gt-accent-surface);
  border-color: light-dark(var(--gt-accent-border), #707b9c);
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.08);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  line-height: 1.4;
  color: var(--gt-text-body);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.order-card.active .card-title {
  color: light-dark(#312e81, #c7d2fe);
}

.type-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.card-identity,
.card-school,
.card-people,
.card-group-chat {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  font-weight: 500;
  color: light-dark(#334155, var(--gt-text-body));
}

.card-identity {
  flex-wrap: wrap;
  row-gap: 3px;
}

.card-identity > span,
.card-people > span > span,
.card-group-chat > span {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-order-code {
  flex-shrink: 0;
  padding: 1px 5px;
  border: 1px solid var(--gt-accent-border);
  border-radius: 4px;
  color: var(--gt-text-violet);
  background: var(--gt-accent-surface);
  font-weight: 700;
}

.card-school-badge {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--gt-surface-raised);
}

.card-school-badge > span {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.card-school .el-icon,
.card-people .el-icon,
.card-group-chat .el-icon {
  flex-shrink: 0;
}

.card-people {
  gap: 10px;
}

.card-people > span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.card-package {
  flex: 0 0 auto;
  border-radius: 4px;
  padding: 1px 4px;
  font-weight: 600;
}

.card-package.package-budget { color: var(--gt-text-success); background: var(--gt-success-surface); }
.card-package.package-carefree { color: var(--gt-text-accent); background: light-dark(#eff6ff, #24364e); }
.card-package.package-vip { color: var(--gt-text-warning); background: var(--gt-warning-surface); }

.card-special-service {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--gt-danger-surface);
  color: light-dark(#991b1b, #fda4af);
}

.card-group-chat {
  color: var(--gt-text-muted);
}

.card-bottom:has(.card-badges:empty) {
  display: none;
}

.card-badges {
  display: flex;
  gap: 3px 5px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.badge-warning,
.badge-deadline-warn,
.badge-refund {
  background: var(--gt-warning-surface);
  color: var(--gt-text-warning);
}

.badge-success,
.badge-handler-paid {
  background: var(--gt-success-surface);
  color: var(--gt-text-success);
}

.badge-danger,
.badge-unpaid {
  background: light-dark(#fff1f2, #352333);
  color: light-dark(#be123c, #fda4af);
}

.badge-handler-unpaid {
  background: light-dark(#fef3c7, #48351c);
  color: light-dark(#b45309, #fcd58a);
}

.order-card.card-urgency-warning {
  border-left: 3px solid #f59e0b;
}

.order-card.card-urgency-danger {
  border-left: 3px solid light-dark(#e11d48, #fda4af);
  background: var(--gt-danger-surface);
}

.order-card.card-urgency-danger.active {
  background: var(--gt-danger-surface);
  border-color: light-dark(#e11d48, #fda4af);
  border-left: 3px solid light-dark(#e11d48, #fda4af);
}

.order-card.card-urgency-warning.active {
  border-left: 3px solid #f59e0b;
}

.empty-list {
  text-align: center;
  padding: 60px 0;
  color: var(--gt-text-main);
  font-size: 13.5px;
  font-weight: 600;
}

.empty-list-sub {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--gt-text-body);
  font-weight: 500;
}

.sidebar-foot {
  display: grid;
  gap: 6px;
  flex-shrink: 0;
  padding: 7px var(--gt-sidebar-section-px);
  border-top: 1px solid var(--gt-border-strong);
  background: var(--gt-surface);
}

.create-btn {
  width: 100%;
  border-radius: 8px;
  font-weight: 600;
}

.sidebar-utilities {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.sidebar-utilities .settings-btn {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  color: var(--gt-text-body);
  border-color: var(--gt-border-strong);
  border-radius: 7px;
}

@media (max-height: 700px) {
  .sidebar-foot {
    padding-block: 6px;
  }
}

@container (max-width: 360px) {
  .filter-pill {
    padding-inline: 5px;
  }

  .list-organizer :deep(.el-select__wrapper) {
    padding-inline: 5px;
    gap: 3px;
  }
}

.settings-btn:hover {
  color: light-dark(#4f46e5, #c7d2fe) !important;
  border-color: var(--gt-accent-border) !important;
  background: var(--gt-accent-surface) !important;
}

.sync-btn:hover {
  color: light-dark(#0f766e, #99f6e4) !important;
  border-color: light-dark(#99f6e4, #376652) !important;
  background: var(--gt-success-surface) !important;
}

.logout-btn:hover {
  color: var(--gt-text-danger) !important;
  border-color: var(--gt-danger-border) !important;
  background: light-dark(#fff1f2, #352333) !important;
}
</style>
