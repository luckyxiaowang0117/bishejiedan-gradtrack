<template>
  <div class="panel-wrapper">
    <!-- Top header bar -->
    <header class="panel-header">
      <div class="header-left">
        <span class="id-badge">ID: #{{ order.id.toString().padStart(3, '0') }}</span>
        <span v-if="order.orderCode" class="order-code-badge">{{ order.orderCode }}</span>
        <span
          class="order-type-badge"
          :style="{ color: orderTypeMeta.color, background: `color-mix(in srgb, ${orderTypeMeta.color} 8%, var(--gt-surface))` }"
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
                :style="{ color: orderTypeMeta.color, background: `color-mix(in srgb, ${orderTypeMeta.color} 8%, var(--gt-surface))`, borderColor: `color-mix(in srgb, ${orderTypeMeta.color} 24%, var(--gt-border))` }"
              >{{ orderTypeMeta.label }}</span>
              <h2 class="project-title">{{ order.title || '待客户确认题目' }}</h2>
              <el-tag v-if="!String(order.title || '').trim()" class="detail-missing-title" type="warning" effect="plain" size="small">待补充题目</el-tag>
            </div>

            <!-- Design status badge -->
            <div v-if="order.includesDesign && order.designType" class="design-status-area">
              <div class="design-info">
                <span class="design-type-label">{{ order.designType }}</span>
                <span v-if="order.designSubType" class="design-sub-label">{{ order.designSubType }}</span>
              </div>
              <div class="design-divider" />
              <el-dropdown trigger="click" @command="handleDesignStatusChange">
                <div class="design-status-btn" :class="designStatusClass(order.designStatus)">
                  <span class="design-status-dot" />
                  <span>{{ order.designStatus || '未设置' }}</span>
                  <el-icon :size="12"><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu class="design-status-menu">
                    <el-dropdown-item
                      v-for="s in availableDesignStatuses"
                      :key="s"
                      :command="s"
                      :class="[designStatusClass(s), { 'is-active': s === order.designStatus }]"
                      :aria-current="s === order.designStatus ? 'true' : undefined"
                    >{{ s }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div v-if="order.packageTier" class="package-summary" :class="'package-' + packageMeta.key">
            <span class="package-summary-icon">{{ packageMeta.icon }}</span>
            <span class="package-summary-code">{{ packageMeta.code }}</span>
            <strong>{{ packageMeta.label }}</strong>
          </div>

          <!-- Breadcrumb: school/college/major -->
          <div v-if="order.university" class="school-breadcrumb">
            <el-icon :size="16" color="var(--gt-text-violet)"><OfficeBuilding /></el-icon>
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
                <div class="cell-label">订单编号</div>
                <div class="cell-value copyable" @click="copyText(order.orderCode)">
                  {{ order.orderCode || '—' }}
                  <el-icon v-if="order.orderCode" class="copy-icon" :size="12"><CopyDocument /></el-icon>
                </div>
              </div>
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
              <div class="info-cell">
                <div class="cell-label">套餐方案</div>
                <div v-if="order.packageTier" class="cell-value package-detail-value" :class="'package-' + packageMeta.key">
                  <span>{{ packageMeta.icon }}</span>{{ packageMeta.code }} · {{ packageMeta.label }}
                </div>
                <div v-else class="cell-value text-muted">未选择套餐</div>
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
                  <el-button
                    v-if="balanceDue > 0 && (order.totalAmount || 0) > 0"
                    text
                    size="small"
                    class="fin-link-btn settle-balance-btn"
                    type="success"
                    @click="handleSettleBalance"
                  >
                    一键结清
                  </el-button>
                </div>
                <div class="fin-grid" :class="isSelfHandler ? 'fin-grid-3' : 'fin-grid-4'">
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
                  <div v-if="!isSelfHandler" class="fin-cell">
                    <span class="fin-num">¥{{ order.dispatchAmount || 0 }}</span>
                    <span class="fin-lbl">派单金额</span>
                  </div>
                </div>
                <template v-if="balanceDue > 0">
                  <el-progress :percentage="paymentPercent" :stroke-width="5" :show-text="false" color="var(--gt-text-violet)" class="fin-progress" />
                </template>
                <div v-else-if="(order.totalAmount || 0) > 0 && balanceDue <= 0" class="fin-status-ok">
                  🎉 已全部收款 ✨
                </div>
              </div>

              <!-- 结算卡片 -->
              <div v-if="!isSelfHandler && (order.dispatchAmount || 0) > 0" class="fin-card fin-card-settle">
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

        <div class="workspace-tabs" role="group" aria-label="订单工作区">
          <button
            type="button"
            class="workspace-tab-btn"
            :class="{ active: activeTab === 'files' }"
            :aria-pressed="activeTab === 'files'"
            @click="activeTab = 'files'"
          >
            <el-icon><Folder /></el-icon>
            <span>项目文件区</span>
          </button>
          <button
            v-if="order.orderType !== 'translation'"
            type="button"
            class="workspace-tab-btn"
            :class="{ active: activeTab === 'revisions' }"
            :aria-pressed="activeTab === 'revisions'"
            @click="openRevisions"
          >
            <el-icon><Connection /></el-icon>
            <span>修改意见与迭代</span>
            <span v-if="revisions.length > 0" class="tab-badge">{{ revisions.length }}</span>
          </button>
        </div>

        <section v-show="activeTab === 'files'" aria-label="项目文件区">
          <template v-if="order.folderPath">
            <ProjectFolders
              ref="projectFoldersRef"
              :folder-path="order.folderPath"
              :includes-design="!!order.includesDesign"
              :order-type="order.orderType || 'thesis'"
            />
            <DraftUpload
              :folder-path="order.folderPath"
              :order-id="order.id"
              :order-type="order.orderType || 'thesis'"
              @draft-uploaded="emit('updated')"
            />
          </template>
          <el-alert
            v-else
            title="此订单未关联项目文件夹"
            description="关联项目文件夹后，此处会显示项目资料及交付文件。"
            type="info"
            show-icon
            :closable="false"
          />

          <div v-if="order.orderType === 'translation'" class="translation-status-card">
            <h3 class="section-title">
              <el-icon :size="18" color="var(--gt-text-warning)"><Document /></el-icon>
              翻译任务状态
            </h3>
            <div class="translation-info">
              <el-tag :type="order.hasOriginalText ? 'success' : 'warning'" size="default" effect="plain">
                {{ order.hasOriginalText ? '已有原文' : '暂无原文' }}
              </el-tag>
            </div>
          </div>
        </section>

        <RevisionTracker
          v-if="revisionsOpened && order.orderType !== 'translation'"
          v-show="activeTab === 'revisions'"
          :order-id="order.id"
          :revisions="revisions"
          :project-folders-ref="projectFoldersRef"
          :order-folder-path="order.folderPath"
          @changed="onRevisionsChanged"
        />

        <div style="height: 40px" />
      </div>
    </div>

    <el-dialog
      v-model="deleteDialogVisible"
      class="delete-order-dialog"
      :title="deleteStep === 'scope' ? '删除订单' : '验证删除订单'"
      width="min(500px, calc(100vw - 32px))"
      align-center
      append-to-body
      :show-close="!deleting"
      :close-on-click-modal="false"
      :close-on-press-escape="!deleting"
      @closed="deletePassword = ''"
    >
      <div class="delete-order-summary">
        <span class="delete-order-code">{{ order.orderCode || '#' + order.id }}</span>
        <strong>{{ order.title || '待客户确认题目' }}</strong>
        <p>订单、修改轮次和反馈记录将被删除。</p>
      </div>

      <el-checkbox v-if="order.folderPath && deleteStep === 'scope'" v-model="deleteFolder">
        同时删除项目文件夹
      </el-checkbox>
      <div v-if="deleteFolder && order.folderPath" class="delete-folder-warning">
        <strong>此文件夹及其中的资料也将被删除</strong>
        <p>{{ order.folderPath }}</p>
      </div>
      <p v-else-if="order.folderPath" class="delete-folder-retained">项目文件夹会保留。</p>

      <form v-if="deleteStep === 'verify'" class="delete-password-form" @submit.prevent="confirmDelete">
        <label for="delete-order-password">登录密码</label>
        <el-input
          id="delete-order-password"
          ref="deletePasswordInput"
          v-model="deletePassword"
          type="password"
          autocomplete="current-password"
          placeholder="输入登录密码"
          :disabled="deleting"
          :aria-invalid="!!deleteError"
          @input="deleteError = ''"
        />
        <p v-if="deleteError" class="delete-error" role="alert">{{ deleteError }}</p>
      </form>

      <template #footer>
        <el-button :disabled="deleting" @click="deleteDialogVisible = false">取消</el-button>
        <el-button v-if="deleteStep === 'scope'" type="danger" @click="requestDeletePassword">
          继续验证
        </el-button>
        <el-button v-else type="danger" :loading="deleting" @click="confirmDelete">
          {{ deleteFolder ? '删除订单和文件夹' : '仅删除订单' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderTypeMeta as orderTypeMap } from '../orderTypeMeta.js'
import { designStatusClass } from '../designStatus.js'
import RevisionTracker from './RevisionTracker.vue'
import ProjectFolders from './ProjectFolders.vue'
import DraftUpload from './DraftUpload.vue'

const props = defineProps({
  order: Object,
  currentUser: Object,
  defaultInfoExpanded: Boolean,
})
const projectFoldersRef = ref(null)
const infoExpanded = ref(false)
const activeTab = ref('files')
const revisionsOpened = ref(false)
const deleteDialogVisible = ref(false)
const deleteStep = ref('scope')
const deleteFolder = ref(false)
const deletePassword = ref('')
const deletePasswordInput = ref(null)
const deleteError = ref('')
const deleting = ref(false)
const emit = defineEmits(['updated', 'edit', 'deleted'])
const api = window.electronAPI

function openRevisions() {
  revisionsOpened.value = true
  activeTab.value = 'revisions'
}

watch(
  () => props.order?.id,
  () => { infoExpanded.value = !!props.defaultInfoExpanded },
  { immediate: true }
)
watch(
  () => props.defaultInfoExpanded,
  (value) => { infoExpanded.value = !!value }
)

const orderTypeMeta = computed(() => orderTypeMap[props.order.orderType] || orderTypeMap.thesis)

const packageMeta = computed(() => {
  const packageMetaMap = {
    budget: { key: 'budget', icon: '¥', code: '套餐1', label: '省钱套餐' },
    carefree: { key: 'carefree', icon: '✓', code: '套餐2', label: '省心套餐' },
    vip: { key: 'vip', icon: '★', code: '套餐3', label: '超级VIP套餐' },
  }
  return packageMetaMap[props.order.packageTier] || packageMetaMap.budget
})

const isSelfHandler = computed(() => {
  const handler = String(props.order.handler || '').trim()
  return !handler || handler === '本人'
})

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
          customStyle: {
            width: '460px',
            maxWidth: 'calc(100vw - 48px)',
          },
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
          customStyle: {
            width: '460px',
            maxWidth: 'calc(100vw - 48px)',
          },
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

async function handleSettleBalance() {
  if (!props.currentUser || !props.currentUser.id) {
    ElMessage.error('未获取到用户信息，请重新登录')
    return
  }
  const total = Number(props.order.totalAmount) || 0
  const paid = Number(props.order.paidAmount) || 0
  const remaining = Math.max(total - paid, 0)
  if (total <= 0 || remaining <= 0) return

  try {
    await ElMessageBox.confirm(
      `当前已收 ¥${paid.toFixed(0)}，尾款 ¥${remaining.toFixed(0)}。确认后将已收金额更新为全款 ¥${total.toFixed(0)}。`,
      '确认结清尾款',
      {
        type: 'warning',
        confirmButtonText: '确认结清',
        cancelButtonText: '取消',
      }
    )
    await api.updateOrder(props.currentUser.id, props.order.id, { paidAmount: total })
    emit('updated')
    ElMessage.success('尾款已结清')
  } catch {}
}

function handleDelete() {
  deleteStep.value = 'scope'
  deleteFolder.value = false
  deletePassword.value = ''
  deleteError.value = ''
  deleteDialogVisible.value = true
}

async function requestDeletePassword() {
  deleteStep.value = 'verify'
  await nextTick()
  deletePasswordInput.value?.focus()
}

async function confirmDelete() {
  if (deleting.value) return
  if (!deletePassword.value) {
    deleteError.value = '请输入登录密码。'
    deletePasswordInput.value?.focus()
    return
  }

  const userId = props.currentUser?.id
  if (!userId) {
    deleteError.value = '无法验证身份，请重新登录。'
    return
  }

  const orderId = props.order.id
  const folderPath = props.order.folderPath
  const deleteProjectFolder = deleteFolder.value && !!folderPath
  deleting.value = true
  deleteError.value = ''
  try {
    const verified = await api.verifyPassword(userId, deletePassword.value)
    if (!verified) {
      deleteError.value = '密码错误，请重新输入。'
      return
    }
    if (deleteProjectFolder && folderPath !== props.order.folderPath) {
      deleteStep.value = 'scope'
      deleteFolder.value = false
      ElMessage.warning('项目文件夹已变更，请重新确认删除范围。')
      return
    }

    const result = await api.deleteOrder(userId, orderId, { deleteFolder: deleteProjectFolder })
    if (!result?.success) {
      deleteError.value = result?.error === 'ORDER_NOT_FOUND'
        ? '项目不存在或已被删除。'
        : (result?.error || '删除失败，请重试。')
      return
    }
    deleteDialogVisible.value = false
    emit('deleted')
    if (result.folder?.deleted) {
      ElMessage.success('订单和本地文件夹已删除')
    } else if (deleteProjectFolder && result.folder?.error) {
      ElMessage.warning(`订单已删除，文件夹未删除：${result.folder.error}`)
    } else {
      ElMessage.success(folderPath ? '订单已删除，本地文件夹已保留' : '订单已删除')
    }
  } catch (error) {
    deleteError.value = error?.message || '删除失败，请重试。'
  } finally {
    deleting.value = false
    deletePassword.value = ''
    if (deleteDialogVisible.value && deleteStep.value === 'verify') {
      await nextTick()
      deletePasswordInput.value?.focus()
    }
  }
}

watch(() => props.order.id, loadRevisions, { immediate: true })
</script>

<style scoped>
:global(.delete-order-dialog .el-dialog__title) {
  font-weight: 600;
}

.delete-order-summary {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  overflow-wrap: anywhere;
}

.delete-order-summary p,
.delete-folder-retained,
.delete-folder-warning p {
  font-weight: 500;
}

.delete-order-code {
  font-size: 12px;
  font-weight: 700;
  color: var(--gt-text-violet);
}

.delete-order-summary strong {
  font-size: 15px;
  color: var(--gt-text-main);
}

.delete-folder-retained {
  color: var(--gt-text-muted);
}

.delete-folder-warning {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--gt-danger-border);
  border-radius: 8px;
  background: var(--gt-danger-surface);
  color: light-dark(#991b1b, #fda4af);
}

.delete-folder-warning p {
  max-height: 96px;
  overflow: auto;
  overflow-wrap: anywhere;
}

.delete-password-form {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.delete-password-form label {
  font-weight: 600;
}

.delete-error {
  color: var(--gt-text-danger);
}

.panel-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Header ─── */
.panel-header {
  height: var(--gt-topbar-height);
  background: var(--gt-surface);
  border-bottom: 1px solid var(--gt-border);
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
  flex-wrap: wrap;
}
.id-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  background: var(--gt-surface-raised);
  color: var(--gt-text-main);
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.order-code-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  background: var(--gt-accent-surface);
  color: var(--gt-text-violet);
  border: 1px solid var(--gt-accent-border);
  border-radius: 6px;
  letter-spacing: 0;
}
.header-divider {
  width: 1px;
  height: 16px;
  background: light-dark(#cbd5e1, var(--gt-surface-raised));
}
.created-date {
  font-size: var(--gt-text-sm);
  color: var(--gt-text-main);
  font-weight: 600;
}
.folder-btn {
  background: light-dark(#1e293b, #282828) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 8px !important;
  font-weight: 500 !important;
}
.folder-btn:hover {
  background: light-dark(#334155, #393939) !important;
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
  background: var(--gt-surface);
  border-radius: 16px;
  border: 1px solid var(--gt-border);
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

.package-summary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  margin: 10px 0 2px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
}

.package-summary-icon,
.package-summary-code { font-weight: 700; }
.package-summary.package-budget,
.package-detail-value.package-budget { color: var(--gt-text-success); background: var(--gt-success-surface); border-color: var(--gt-success-border); }
.package-summary.package-carefree,
.package-detail-value.package-carefree { color: var(--gt-text-accent); background: light-dark(#eff6ff, #24364e); border-color: light-dark(#bfdbfe, #50678e); }
.package-summary.package-vip,
.package-detail-value.package-vip { color: light-dark(#b45309, #fcd58a); background: var(--gt-warning-surface); border-color: var(--gt-warning-border); }

.package-detail-value {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border: 1px solid transparent;
  border-radius: 4px;
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
  color: var(--gt-text-body);
  line-height: 1.3;
  margin: 0;
}

/* Design status */
.design-status-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--gt-surface-subtle);
  border: 1px solid var(--gt-border);
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
  color: light-dark(#334155, var(--gt-text-body));
  font-weight: 600;
  white-space: nowrap;
}
.design-sub-label {
  font-size: 12px;
  color: var(--gt-text-violet);
  font-weight: 500;
  white-space: nowrap;
  background: var(--gt-accent-surface);
  padding: 1px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}
.design-divider {
  width: 1px;
  height: 28px;
  background: var(--gt-surface-raised);
  flex-shrink: 0;
}
.detail-missing-title.el-tag {
  --el-tag-text-color: var(--gt-status-pending-text);
  font-weight: 600;
}

.design-status-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--gt-design-status-surface);
  color: var(--gt-design-status-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.design-status-btn:hover {
  background: color-mix(in srgb, var(--gt-design-status-surface) 94%, var(--gt-design-status-text));
}
.design-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* Breadcrumb */
.school-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--gt-surface-subtle);
  border: 1px solid var(--gt-border-strong);
  border-radius: 8px;
  font-size: var(--gt-text-sm);
  color: var(--gt-text-main);
  font-weight: 600;
  margin-bottom: calc(var(--gt-card-gap) - 4px);
}
.crumb-bold { font-weight: 700; color: var(--gt-text-heading); }
.crumb-sep { color: light-dark(#64748b, var(--gt-text-muted)); }

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
  border-top: 1px solid var(--gt-border-strong);
}

.text-muted {
  color: var(--gt-text-main);
  font-size: 12px;
  font-weight: 600;
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
.info-cell:nth-child(7)::before { background: #fb7185; }

.cell-label {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.3px;
}
.cell-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--gt-text-heading);
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
  background: var(--gt-accent-surface);
}
.copy-icon {
  opacity: 0;
  color: light-dark(#64748b, var(--gt-text-muted));
  transition: opacity 0.15s, color 0.15s;
}
.cell-value.copyable:hover .copy-icon {
  opacity: 1;
  color: light-dark(#4f46e5, #c7d2fe);
}
.text-urgent { color: var(--gt-text-danger); }
.urgent-mark { color: var(--gt-text-danger); }

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
  border-top: 1px dashed var(--gt-border-strong);
}
.collapse-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 14px;
  margin: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gt-text-main);
  background: var(--gt-surface);
  border: 1px solid var(--gt-border-strong);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.collapse-toggle:hover {
  color: var(--gt-text-violet);
  border-color: var(--gt-accent-border);
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
  border: 1px solid var(--gt-border);
}
.fin-card-income {
  background: linear-gradient(135deg, var(--gt-surface-subtle) 0%, var(--gt-accent-surface) 100%);
  border-color: var(--gt-accent-border);
}
.fin-card-settle {
  background: linear-gradient(135deg, var(--gt-surface-subtle) 0%, light-dark(var(--gt-success-surface), var(--gt-surface-muted)) 100%);
  border-color: light-dark(var(--gt-success-border), var(--gt-border));
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
  background: var(--gt-accent-surface-strong);
  color: light-dark(#4f46e5, #c7d2fe);
}
.fin-icon-settle {
  background: light-dark(#d1fae5, #1d4338);
  color: var(--gt-text-success);
}
.fin-card-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--gt-text-main);
}

.fin-grid {
  display: grid;
  gap: 6px;
}
.fin-grid-4 { grid-template-columns: repeat(4, 1fr); }
.fin-grid-3 { grid-template-columns: repeat(3, 1fr); }
.fin-grid-2 { grid-template-columns: repeat(2, 1fr); }

.fin-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  background: color-mix(in srgb, var(--gt-surface) 70%, transparent);
  border-radius: 8px;
}
.fin-num {
  font-size: 17px;
  font-weight: 800;
  color: var(--gt-text-heading);
  letter-spacing: -0.3px;
}
.fin-num-green { color: var(--gt-text-success); }
.fin-num-red { color: var(--gt-text-danger); font-weight: 800; }
.fin-lbl {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 700;
}

.workspace-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--gt-card-gap);
  border-bottom: 1px solid var(--gt-border-strong);
  padding-bottom: 10px;
}

.workspace-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--gt-text-main);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.workspace-tab-btn:hover {
  background: var(--gt-surface-muted);
  color: var(--gt-text-heading);
}

.workspace-tab-btn.active {
  background: var(--gt-surface);
  border-color: var(--gt-border-strong);
  color: light-dark(#4f46e5, #c7d2fe);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
}

.tab-badge {
  background: var(--gt-accent-surface);
  color: light-dark(#4f46e5, #c7d2fe);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
}

.fin-progress {
  margin-top: 10px;
}
.fin-status-ok {
  margin-top: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--gt-text-success);
  padding: 6px;
  background: linear-gradient(135deg, var(--gt-success-surface), light-dark(#f0fdf4, #17352e), var(--gt-warning-surface));
  border-radius: 8px;
  border: 1px solid var(--gt-success-border);
}

.fin-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--gt-success-border);
}

.refund-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: var(--gt-text-warning);
  background: var(--gt-warning-surface);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--gt-warning-border);
}
.settle-ok-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gt-text-success);
  background: var(--gt-success-surface);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--gt-success-border);
}
.fin-link-btn {
  margin-left: auto;
  font-size: 11px !important;
}

.info-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--gt-border);
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
  background: var(--gt-surface);
  border-radius: 16px;
  border: 1px solid var(--gt-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: var(--gt-card-pad);
  margin-bottom: var(--gt-card-gap);
}
.section-title {
  font-size: var(--gt-title-md);
  font-weight: 700;
  color: var(--gt-text-body);
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
