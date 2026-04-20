<template>
  <div class="panel-wrapper">
    <!-- Top header bar -->
    <header class="panel-header">
      <div class="header-left">
        <span class="id-badge">ID: #{{ order.id.toString().padStart(3, '0') }}</span>
        <span
          class="order-type-badge"
          :style="{ color: orderTypeMeta.color, background: orderTypeMeta.color + '14' }"
        >{{ orderTypeMeta.label }}</span>
        <div class="header-divider" />
        <span class="created-date">创建于 {{ order.createdAt?.split('T')[0] || '—' }}</span>
      </div>
      <el-button v-if="order.folderPath" @click="handleOpenFolder" class="folder-btn">
        <el-icon><FolderOpened /></el-icon>
        打开本地项目文件夹
      </el-button>
    </header>

    <!-- Scrollable content -->
    <div class="panel-content">
      <div class="content-inner">

        <!-- Module 1: Project Info Card -->
        <div class="info-card">
          <div class="info-top">
            <div class="title-area">
              <span
                class="order-type-tag"
                :style="{ color: orderTypeMeta.color, background: orderTypeMeta.color + '14', borderColor: orderTypeMeta.color + '30' }"
              >{{ orderTypeMeta.label }}</span>
              <h2 class="project-title">{{ order.title }}</h2>
            </div>

            <!-- Design status badge -->
            <div v-if="order.includesDesign && order.designType" class="design-status-area">
              <div class="design-info">
                <span class="design-type-label">{{ order.designType }}</span>
                <span v-if="order.designSubType" class="design-sub-label">{{ order.designSubType }}</span>
              </div>
              <div class="design-divider" />
              <el-dropdown trigger="click" @command="handleDesignStatusChange">
                <div class="design-status-btn" :class="'status-' + designStatusColor">
                  <span class="design-status-dot" />
                  <span>{{ order.designStatus || '未设置' }}</span>
                  <el-icon :size="12"><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="s in availableDesignStatuses"
                      :key="s"
                      :command="s"
                      :class="{ 'is-active': s === order.designStatus }"
                    >{{ s }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- Breadcrumb: school/college/major -->
          <div v-if="order.university" class="school-breadcrumb">
            <el-icon :size="16" color="#6366f1"><OfficeBuilding /></el-icon>
            <span class="crumb-bold">{{ order.university || '未填写学校' }}</span>
            <span class="crumb-sep">/</span>
            <span>{{ order.college || '未填写学院' }}</span>
            <span class="crumb-sep">/</span>
            <span>{{ order.major || '未填写专业' }}</span>
          </div>

          <!-- Info grid row 1 -->
          <div class="info-grid">
            <div class="info-cell">
              <span class="cell-label">接单人</span>
              <span class="cell-value">{{ order.receiver || '本人' }}</span>
            </div>
            <div class="info-cell">
              <span class="cell-label">处理人</span>
              <span class="cell-value">{{ order.handler || '本人' }}</span>
            </div>
            <div v-if="order.orderType === 'thesis'" class="info-cell">
              <span class="cell-label">指导教师</span>
              <span class="cell-value">{{ order.advisor || '未填写' }}</span>
            </div>
            <div v-if="order.orderType === 'format'" class="info-cell">
              <span class="cell-label">服务类型</span>
              <span class="cell-value">{{ order.formatMode === 'full' ? '全包' : (order.formatMode === 'single' ? '单次' : '未设置') }}</span>
            </div>
            <div v-if="order.orderType === 'translation'" class="info-cell">
              <span class="cell-label">是否有原文</span>
              <span class="cell-value">{{ order.hasOriginalText ? '有' : '无' }}</span>
            </div>
            <div v-if="order.orderType === 'special'" class="info-cell">
              <span class="cell-label">服务项目</span>
              <span class="cell-value">{{ order.specialService || '未填写' }}</span>
            </div>
            <div class="info-cell">
              <span class="cell-label">交稿期限<template v-if="isUrgent"><span class="urgent-mark">(急)</span></template></span>
              <span class="cell-value" :class="{ 'text-urgent': isUrgent || isOverdue }">{{ order.deadline }}</span>
            </div>
            <div v-if="['thesis', 'design'].includes(order.orderType)" class="info-cell">
              <span class="cell-label">设计</span>
              <span class="cell-value">
                <el-tag v-if="order.includesDesign" type="success" size="small" effect="plain">包含</el-tag>
                <span v-else class="text-muted">不含</span>
              </span>
            </div>
          </div>

          <!-- Collapse toggle -->
          <div class="collapse-divider">
            <div class="collapse-toggle" @click="infoExpanded = !infoExpanded">
              <span>{{ infoExpanded ? '收起' : '展开详情' }}</span>
              <el-icon :size="11"><ArrowUp v-if="infoExpanded" /><ArrowDown v-else /></el-icon>
            </div>
          </div>

          <!-- Collapsible detail area -->
          <template v-if="infoExpanded">
            <!-- Info grid row 2 -->
            <div class="info-grid info-grid-secondary">
              <div class="info-cell">
                <div class="cell-label">学生姓名</div>
                <div class="cell-value copyable" @click="copyText(order.studentName)">
                  {{ order.studentName || '—' }}
                  <el-icon v-if="order.studentName" class="copy-icon" :size="12"><CopyDocument /></el-icon>
                </div>
              </div>
              <div class="info-cell">
                <div class="cell-label">微信昵称</div>
                <div class="cell-value copyable" @click="copyText(order.wechatName)">
                  {{ order.wechatName || '—' }}
                  <el-icon v-if="order.wechatName" class="copy-icon" :size="12"><CopyDocument /></el-icon>
                </div>
              </div>
              <div class="info-cell">
                <div class="cell-label">群聊名称</div>
                <div class="cell-value copyable" @click="copyText(order.groupChatName)">
                  {{ order.groupChatName || '—' }}
                  <el-icon v-if="order.groupChatName" class="copy-icon" :size="12"><CopyDocument /></el-icon>
                </div>
              </div>
            </div>

            <!-- Finance Section -->
            <div class="finance-section">
              <!-- 收款卡片 -->
              <div class="fin-card fin-card-income">
                <div class="fin-card-header">
                  <span class="fin-card-icon fin-icon-income"><el-icon :size="14"><Wallet /></el-icon></span>
                  <span class="fin-card-title">收款信息</span>
                  <div v-if="(order.refundAmount || 0) > 0" class="refund-tag">
                    <el-icon :size="12"><WarningFilled /></el-icon> 已退 ¥{{ order.refundAmount }}
                  </div>
                  <el-button text size="small" class="fin-link-btn" type="warning" @click="handleRefund">
                    {{ (order.refundAmount || 0) > 0 ? '改退款' : '退款' }}
                  </el-button>
                </div>
                <div class="fin-grid fin-grid-4">
                  <div class="fin-cell">
                    <span class="fin-num">¥{{ order.totalAmount || 0 }}</span>
                    <span class="fin-lbl">全款金额</span>
                  </div>
                  <div class="fin-cell">
                    <span class="fin-num fin-num-green">¥{{ order.paidAmount || 0 }}</span>
                    <span class="fin-lbl">已收金额</span>
                  </div>
                  <div class="fin-cell">
                    <span class="fin-num" :class="{ 'fin-num-red': balanceDue > 0 }">
                      {{ balanceDue > 0 ? '¥' + balanceDue.toFixed(0) : '—' }}
                    </span>
                    <span class="fin-lbl">尾款</span>
                  </div>
                  <div class="fin-cell">
                    <span class="fin-num">¥{{ order.dispatchAmount || 0 }}</span>
                    <span class="fin-lbl">派单金额</span>
                  </div>
                </div>
                <template v-if="balanceDue > 0">
                  <el-progress :percentage="paymentPercent" :stroke-width="5" :show-text="false" color="#6366f1" class="fin-progress" />
                </template>
                <div v-else-if="(order.totalAmount || 0) > 0 && balanceDue <= 0" class="fin-status-ok">
                  🎉 已全部收款 ✨
                </div>
              </div>

              <!-- 结算卡片 -->
              <div v-if="(order.dispatchAmount || 0) > 0" class="fin-card fin-card-settle">
                <div class="fin-card-header">
                  <span class="fin-card-icon fin-icon-settle"><el-icon :size="14"><Coin /></el-icon></span>
                  <span class="fin-card-title">处理人结算</span>
                  <span v-if="handlerRemaining <= 0" class="settle-ok-tag">
                    <el-icon :size="12"><Check /></el-icon> 已结清
                  </span>
                </div>
                <div class="fin-grid fin-grid-2">
                  <div class="fin-cell">
                    <span class="fin-num fin-num-green">¥{{ order.handlerPaidAmount || 0 }}</span>
                    <span class="fin-lbl">已付处理人</span>
                  </div>
                  <div class="fin-cell">
                    <span class="fin-num" :class="{ 'fin-num-red': handlerRemaining > 0 }">
                      {{ handlerRemaining > 0 ? '¥' + handlerRemaining.toFixed(0) : '—' }}
                    </span>
                    <span class="fin-lbl">未结算</span>
                  </div>
                </div>
                <div class="fin-actions">
                  <el-button
                    v-if="handlerRemaining > 0"
                    type="primary"
                    text bg size="small"
                    @click="handlePayHandler(false)"
                  >
                    <el-icon><Coin /></el-icon> 支付给处理人
                  </el-button>
                  <el-button text bg size="small" @click="handlePayHandler(true)">
                    <el-icon><Edit /></el-icon> {{ handlerRemaining > 0 ? '调整已付' : '调整支付' }}
                  </el-button>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="info-actions">
              <el-button text size="small" @click="$emit('edit', order)">
                <el-icon><Edit /></el-icon> 编辑信息
              </el-button>
              <el-button text size="small" type="danger" @click="handleDelete">
                <el-icon><Delete /></el-icon> 删除项目
              </el-button>
            </div>
          </template>
        </div>

        <!-- Module 2: Project Folders (thesis & format) -->
        <ProjectFolders
          v-if="order.folderPath"
          ref="projectFoldersRef"
          :folder-path="order.folderPath"
          :includes-design="!!order.includesDesign"
          :order-type="order.orderType || 'thesis'"
        />

        <!-- Module 3: Draft / Delivery Upload -->
        <DraftUpload
          v-if="order.folderPath"
          :folder-path="order.folderPath"
          :order-id="order.id"
          :order-type="order.orderType || 'thesis'"
          @draft-uploaded="emit('updated')"
        />

        <!-- Module 4: Revision Tracker (thesis & format) -->
        <RevisionTracker
          v-if="order.orderType !== 'translation'"
          :order-id="order.id"
          :revisions="revisions"
          :project-folders-ref="projectFoldersRef"
          :order-folder-path="order.folderPath"
          @changed="onRevisionsChanged"
        />

        <!-- Translation: simple status area -->
        <div v-if="order.orderType === 'translation'" class="translation-status-card">
          <h3 class="section-title">
            <el-icon :size="18" color="#f59e0b"><Document /></el-icon>
            翻译任务状态
          </h3>
          <div class="translation-info">
            <el-tag :type="order.hasOriginalText ? 'success' : 'warning'" size="default" effect="plain">
              {{ order.hasOriginalText ? '已有原文' : '暂无原文' }}
            </el-tag>
          </div>
        </div>

        <div style="height: 40px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import RevisionTracker from './RevisionTracker.vue'
import ProjectFolders from './ProjectFolders.vue'
import DraftUpload from './DraftUpload.vue'

const props = defineProps({
  order: Object,
  currentUser: Object,
})
const projectFoldersRef = ref(null)
const infoExpanded = ref(false)
const emit = defineEmits(['updated', 'edit', 'deleted'])
const api = window.electronAPI

watch(() => props.order?.id, () => { infoExpanded.value = false })

const orderTypeMap = {
  thesis: { label: '毕设论文', color: '#6366f1' },
  format: { label: '格式修改', color: '#0ea5e9' },
  translation: { label: '外文翻译', color: '#f59e0b' },
  design: { label: '设计定制', color: '#8b5cf6' },
  reduction: { label: '论文降重', color: '#10b981' },
  special: { label: '特殊订单', color: '#ef4444' },
}
const orderTypeMeta = computed(() => orderTypeMap[props.order.orderType] || orderTypeMap.thesis)

const revisions = ref([])
const designTypeDefs = ref([])

async function loadDesignTypes() {
  const rows = await api.listDesignTypes()
  designTypeDefs.value = rows.map(r => ({
    ...r,
    subTypes: JSON.parse(r.subTypes || '[]'),
    statuses: JSON.parse(r.statuses || '[]'),
  }))
}
onMounted(loadDesignTypes)

const availableDesignStatuses = computed(() => {
  const def = designTypeDefs.value.find(t => t.typeName === props.order.designType)
  if (!def) return []
  if (def.subTypes.length > 0) {
    const sub = def.subTypes.find(s => s.name === props.order.designSubType)
    return sub?.statuses || []
  }
  return def.statuses || []
})

const designStatusColor = computed(() => {
  const s = props.order.designStatus
  if (!s) return 'info'
  if (['已完成', '已优化', '已购买'].includes(s)) return 'success'
  if (['客户提供'].includes(s)) return ''
  return 'warning'
})

async function handleDesignStatusChange(status) {
  if (!props.currentUser || !props.currentUser.id) return
  await api.updateOrder(props.currentUser.id, props.order.id, { designStatus: status })
  emit('updated')
}

const hoursLeft = computed(() => {
  if (!props.order.deadline) return Infinity
  const target = new Date(props.order.deadline + 'T23:59:59')
  return (target - new Date()) / 3600000
})
const daysLeft = computed(() => Math.ceil(hoursLeft.value / 24))
const isUrgent = computed(() => {
  if (hoursLeft.value < 0) return false
  const type = props.order.orderType || 'thesis'
  if (['thesis', 'design'].includes(type)) return daysLeft.value <= 2
  return hoursLeft.value <= 2
})
const isOverdue = computed(() => hoursLeft.value < 0)
const balanceDue = computed(() => (props.order.totalAmount || 0) - (props.order.paidAmount || 0))
const paymentPercent = computed(() =>
  props.order.totalAmount > 0 ? Math.min(Math.round((props.order.paidAmount / props.order.totalAmount) * 100), 100) : 0
)

function copyText(text) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(`已复制: ${text}`)
  })
}

async function loadRevisions() { revisions.value = await api.listRevisions(props.order.id) }
function onRevisionsChanged() { loadRevisions(); emit('updated') }

async function handleOpenFolder() {
  if (!props.order.folderPath) return ElMessage.warning('未关联文件夹，请先设置根目录。')
  const r = await api.openFolder(props.order.folderPath)
  if (!r.success) ElMessage.error(r.error === 'FOLDER_NOT_FOUND' ? '文件夹不存在，可能已删除。' : r.error)
}


const handlerRemaining = computed(() => {
  const dispatch = props.order.dispatchAmount || 0
  const paid = props.order.handlerPaidAmount || 0
  return Math.max(dispatch - paid, 0)
})

async function handlePayHandler(forceAdjust = false) {
  try {
    const remaining = handlerRemaining.value
    const current = props.order.handlerPaidAmount || 0
    const dispatch = props.order.dispatchAmount || 0
    const isAdjust = forceAdjust

    if (isAdjust) {
      // 调整模式：直接输入调整后的已付总额
      const { value: amountInput } = await ElMessageBox.prompt(
        `派单金额 ¥${dispatch}，当前已付处理人 ¥${current}\n请输入调整后的已付总额：`,
        '调整已付金额',
        {
          inputValue: String(current),
          inputPattern: /^\d+(\.\d{1,2})?$/,
          inputErrorMessage: '请输入有效金额',
          confirmButtonText: '下一步',
          cancelButtonText: '取消',
        }
      )
      const newTotal = parseFloat(amountInput)

      // 密码验证
      const { value: password } = await ElMessageBox.prompt(
        `即将调整已付金额：¥${current} → ¥${newTotal}\n为保护财务数据安全，请输入登录密码验证：`,
        '密码验证',
        {
          inputType: 'password',
          inputPlaceholder: '请输入登录密码',
          confirmButtonText: '确认调整',
          cancelButtonText: '取消',
        }
      )
      if (!props.currentUser || !props.currentUser.id) {
        ElMessage.error('未获取到用户信息，请重新登录')
        return
      }
      const isValid = await api.verifyPassword(props.currentUser.id, password)
      if (!isValid) {
        ElMessage.error('密码错误，操作已取消')
        return
      }

      await api.updateOrder(props.currentUser.id, props.order.id, { handlerPaidAmount: newTotal })
      emit('updated')
      ElMessage.success(`已付处理人金额已调整为 ¥${newTotal}`)
    } else {
      // 支付模式：输入本次支付金额，累加
      const { value: amountInput } = await ElMessageBox.prompt(
        `派单金额 ¥${dispatch}，已付 ¥${current}，未结 ¥${remaining}\n请输入本次支付金额：`,
        '支付给处理人',
        {
          inputValue: String(remaining),
          inputPattern: /^\d+(\.\d{1,2})?$/,
          inputErrorMessage: '请输入有效金额',
          confirmButtonText: '确认支付',
          cancelButtonText: '取消',
        }
      )
      const amount = parseFloat(amountInput)
      const newTotal = current + amount

      await api.updateOrder(props.currentUser.id, props.order.id, { handlerPaidAmount: newTotal })
      emit('updated')
      ElMessage.success(`已支付 ¥${amount}，累计已付 ¥${newTotal}`)
    }
  } catch {}
}

async function handleRefund() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入退款金额（元）',
      (props.order.refundAmount || 0) > 0 ? '修改退款金额' : '发起退款',
      {
        inputValue: String(props.order.refundAmount || ''),
        inputPattern: /^\d+(\.\d{1,2})?$/,
        inputErrorMessage: '请输入有效金额',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
      }
    )
    const amount = parseFloat(value)
    if (!props.currentUser || !props.currentUser.id) return
    await api.updateOrder(props.currentUser.id, props.order.id, { refundAmount: amount })
    emit('updated')
    ElMessage.success(amount > 0 ? `已记录退款 ¥${amount}` : '已清除退款记录')
  } catch {}
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(`确定删除「${props.order.title}」？此操作不可恢复。`, '删除项目', { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' })
    const { value: pwd } = await ElMessageBox.prompt('请输入您的登录密码以确认删除', '身份验证', {
      inputType: 'password',
      inputPlaceholder: '输入密码',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    })
    if (!props.currentUser) {
      ElMessage.error('无法验证身份，请重新登录')
      return
    }
    const ok = await api.verifyPassword(props.currentUser.id, pwd)
    if (!ok) {
      ElMessage.error('密码错误，删除已取消')
      return
    }
    await api.deleteOrder(props.currentUser.id, props.order.id)
    emit('deleted')
    ElMessage.success('项目已删除')
  } catch {}
}

watch(() => props.order.id, loadRevisions, { immediate: true })
</script>

<style scoped>
.panel-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Header ─── */
.panel-header {
  height: var(--gt-topbar-height);
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 var(--gt-page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.id-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.header-divider {
  width: 1px;
  height: 16px;
  background: #e2e8f0;
}
.created-date {
  font-size: var(--gt-text-sm);
  color: #64748b;
}
.folder-btn {
  background: #1e293b !important;
  color: #fff !important;
  border: none !important;
  border-radius: 8px !important;
  font-weight: 500 !important;
}
.folder-btn:hover {
  background: #334155 !important;
}

/* ─── Content ─── */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--gt-page-pad-y) var(--gt-page-pad);
}
.content-inner {
  max-width: var(--gt-content-max-width);
  margin: 0 auto;
}

/* ─── Info Card ─── */
.info-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: var(--gt-card-pad);
  margin-bottom: var(--gt-card-gap);
}

.info-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: calc(var(--gt-card-gap) - 4px);
}

.title-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.order-type-tag {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid;
  flex-shrink: 0;
}

.project-title {
  font-size: var(--gt-title-xl);
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
  margin: 0;
}

/* Design status */
.design-status-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  flex-shrink: 0;
}
.design-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.design-type-label {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
}
.design-sub-label {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  white-space: nowrap;
  background: #eef2ff;
  padding: 1px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}
.design-divider {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
  flex-shrink: 0;
}
.design-status-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.design-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.design-status-btn.status-success {
  background: #ecfdf5;
  color: #059669;
}
.design-status-btn.status-success .design-status-dot { background: #10b981; }
.design-status-btn.status-success:hover { background: #d1fae5; }

.design-status-btn.status-warning {
  background: #fffbeb;
  color: #b45309;
}
.design-status-btn.status-warning .design-status-dot { background: #f59e0b; }
.design-status-btn.status-warning:hover { background: #fef3c7; }

.design-status-btn.status-info,
.design-status-btn.status- {
  background: #f1f5f9;
  color: #475569;
}
.design-status-btn.status-info .design-status-dot,
.design-status-btn.status- .design-status-dot { background: #94a3b8; }
.design-status-btn.status-info:hover,
.design-status-btn.status-:hover { background: #e2e8f0; }

/* Breadcrumb */
.school-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  font-size: var(--gt-text-sm);
  color: #475569;
  margin-bottom: calc(var(--gt-card-gap) - 4px);
}
.crumb-bold { font-weight: 500; }
.crumb-sep { color: #cbd5e1; }

/* Info grid */
.info-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0;
}

.info-grid-secondary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.text-muted {
  color: #94a3b8;
  font-size: 12px;
}

.info-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  margin-right: 24px;
}
.info-cell::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.04);
}
.info-cell:nth-child(1)::before { background: #818cf8; }
.info-cell:nth-child(2)::before { background: #34d399; }
.info-cell:nth-child(3)::before { background: #fbbf24; }
.info-cell:nth-child(4)::before { background: #f472b6; }
.info-cell:nth-child(5)::before { background: #38bdf8; }
.info-cell:nth-child(6)::before { background: #a78bfa; }

.cell-label {
  font-size: 10px;
  color: #b0b8c9;
  white-space: nowrap;
  letter-spacing: 0.3px;
}
.cell-value {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}
.cell-value.copyable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 4px;
  margin: -1px -4px;
  transition: background 0.15s;
}
.cell-value.copyable:hover {
  background: #eef2ff;
}
.copy-icon {
  opacity: 0;
  color: #94a3b8;
  transition: opacity 0.15s, color 0.15s;
}
.cell-value.copyable:hover .copy-icon {
  opacity: 1;
  color: #6366f1;
}
.text-urgent { color: #e11d48; }
.urgent-mark { color: #e11d48; }

/* Collapse Toggle */
.collapse-divider {
  display: flex;
  align-items: center;
  margin-top: 14px;
}
.collapse-divider::before,
.collapse-divider::after {
  content: '';
  flex: 1;
  border-top: 1px dashed #e2e8f0;
}
.collapse-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 14px;
  margin: 0 12px;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.collapse-toggle:hover {
  color: #6366f1;
  border-color: #c7d2fe;
  box-shadow: 0 2px 6px rgba(99,102,241,0.1);
}

/* Finance Section */
.finance-section {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fin-card {
  border-radius: 12px;
  padding: 14px 18px;
  border: 1px solid #e2e8f0;
}
.fin-card-income {
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border-color: #e0e7ff;
}
.fin-card-settle {
  background: linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%);
  border-color: #d1fae5;
}

.fin-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.fin-card-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fin-icon-income {
  background: #e0e7ff;
  color: #4f46e5;
}
.fin-icon-settle {
  background: #d1fae5;
  color: #059669;
}
.fin-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.fin-grid {
  display: grid;
  gap: 6px;
}
.fin-grid-4 { grid-template-columns: repeat(4, 1fr); }
.fin-grid-2 { grid-template-columns: repeat(2, 1fr); }

.fin-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
}
.fin-num {
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.3px;
}
.fin-num-green { color: #059669; }
.fin-num-red { color: #e11d48; font-weight: 700; }
.fin-lbl {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 500;
}

.fin-progress {
  margin-top: 10px;
}
.fin-status-ok {
  margin-top: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #059669;
  padding: 6px;
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4, #fffbeb);
  border-radius: 8px;
  border: 1px solid #d1fae5;
}

.fin-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #d1fae5;
}

.refund-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: #d97706;
  background: #fffbeb;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #fde68a;
}
.settle-ok-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: #ecfdf5;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #a7f3d0;
}
.fin-link-btn {
  margin-left: auto;
  font-size: 11px !important;
}

.info-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  gap: 8px;
}

.order-type-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;
}

.translation-status-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: var(--gt-card-pad);
  margin-bottom: var(--gt-card-gap);
}
.section-title {
  font-size: var(--gt-title-md);
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.translation-info {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
