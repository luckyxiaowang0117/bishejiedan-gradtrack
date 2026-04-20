<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEditing ? '编辑订单信息' : '新建接单项目'"
    width="var(--gt-dialog-md)"
    align-center
    :close-on-click-modal="false"
    destroy-on-close
    class="order-dialog"
  >
    <el-form :model="form" label-position="top" size="default" class="order-form">
      <div class="form-layout">
        <section class="form-column form-column-left">
          <div v-if="!isEditing" class="column-card type-card">
            <div class="column-title">订单类型</div>
            <div class="type-selector">
              <button
                v-for="t in orderTypes"
                :key="t.key"
                class="type-option"
                :class="{ active: form.orderType === t.key }"
                :style="form.orderType === t.key ? { borderColor: t.color, background: t.color + '0a' } : {}"
                @click="form.orderType = t.key"
                type="button"
              >
                <span class="type-dot" :style="{ background: form.orderType === t.key ? t.color : '#cbd5e1' }" />
                <span class="type-label">{{ t.label }}</span>
                <span class="type-desc">{{ t.desc }}</span>
              </button>
            </div>
          </div>

          <div class="column-card">
            <div class="column-title">项目信息</div>
            <el-form-item :label="titleLabel + ' *'">
              <el-input v-model="form.title" :placeholder="titlePlaceholder" />
            </el-form-item>

            <div class="form-grid form-grid-3">
              <el-form-item label="学校名称 *">
                <el-autocomplete v-model="form.university" :fetch-suggestions="(q, cb) => fetchSuggestions('university', q, cb)" placeholder="例: 华南理工大学" style="width: 100%" />
              </el-form-item>
              <el-form-item label="学院">
                <el-autocomplete v-model="form.college" :fetch-suggestions="(q, cb) => fetchSuggestions('college', q, cb)" placeholder="例: 机械工程学院" style="width: 100%" />
              </el-form-item>
              <el-form-item label="专业">
                <el-autocomplete v-model="form.major" :fetch-suggestions="(q, cb) => fetchSuggestions('major', q, cb)" placeholder="例: 机械电子工程" style="width: 100%" />
              </el-form-item>
            </div>

            <div class="form-grid form-grid-3">
              <el-form-item label="学生姓名">
                <el-input v-model="form.studentName" placeholder="选填" />
              </el-form-item>
              <el-form-item label="微信昵称">
                <el-input v-model="form.wechatName" placeholder="选填" />
              </el-form-item>
              <el-form-item label="群聊名称">
                <el-input v-model="form.groupChatName" placeholder="选填" />
              </el-form-item>
            </div>

            <div class="form-grid form-grid-3">
              <el-form-item label="接单人">
                <el-autocomplete v-model="form.receiver" :fetch-suggestions="(q, cb) => fetchSuggestions('receiver', q, cb)" placeholder="本人" style="width: 100%" />
              </el-form-item>
              <el-form-item label="处理人">
                <el-autocomplete v-model="form.handler" :fetch-suggestions="(q, cb) => fetchSuggestions('handler', q, cb)" placeholder="本人" style="width: 100%" />
              </el-form-item>
              <el-form-item v-if="form.orderType === 'thesis'" label="指导教师">
                <el-autocomplete v-model="form.advisor" :fetch-suggestions="(q, cb) => fetchSuggestions('advisor', q, cb)" placeholder="教师姓名" style="width: 100%" />
              </el-form-item>
            </div>
          </div>
        </section>

        <section class="form-column form-column-right">
          <div class="column-card">
            <div class="column-title">交付与属性</div>
            <div class="form-grid form-grid-2">
              <el-form-item label="交稿日期 *">
                <el-date-picker
                  v-model="form.deadline"
                  type="date"
                  placeholder="选择日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="毕业届">
                <el-select v-model="form.graduationYear" placeholder="选择毕业届" filterable allow-create style="width: 100%">
                  <el-option v-for="y in graduationYearOptions" :key="y" :label="y + '届'" :value="y" />
                </el-select>
              </el-form-item>
            </div>

            <div class="form-grid form-grid-2">
              <el-form-item v-if="form.orderType === 'thesis'" label="是否包含设计">
                <el-switch
                  v-model="form.includesDesign"
                  active-text="包含"
                  inactive-text="不含"
                  :active-value="1"
                  :inactive-value="0"
                  style="margin-top: 4px"
                />
              </el-form-item>
              <el-form-item v-if="form.orderType === 'format'" label="服务类型">
                <el-select v-model="form.formatMode" placeholder="选择类型" style="width: 100%">
                  <el-option label="全包" value="full" />
                  <el-option label="单次" value="single" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="form.orderType === 'special'" label="服务项目">
                <el-input v-model="form.specialService" placeholder="选填，例如：图例绘制 / PPT制作" />
              </el-form-item>
              <el-form-item v-if="form.orderType === 'translation'" label="是否有原文">
                <el-switch
                  v-model="form.hasOriginalText"
                  active-text="有"
                  inactive-text="无"
                  :active-value="1"
                  :inactive-value="0"
                  style="margin-top: 4px"
                />
              </el-form-item>
            </div>

            <div v-if="showDesignFields" class="form-grid form-grid-3">
              <el-form-item label="设计类型">
                <el-select v-model="form.designType" placeholder="选择类型" style="width: 100%" @change="onDesignTypeChange">
                  <el-option v-for="t in designTypeDefs" :key="t.id" :label="t.typeName" :value="t.typeName" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="currentSubTypes.length > 0" label="来源/子类型">
                <el-select v-model="form.designSubType" placeholder="选择来源" style="width: 100%" @change="onDesignSubTypeChange">
                  <el-option v-for="s in currentSubTypes" :key="s.name" :label="s.name" :value="s.name" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="currentStatuses.length > 0" label="当前状态">
                <el-select v-model="form.designStatus" placeholder="选择状态" style="width: 100%">
                  <el-option v-for="s in currentStatuses" :key="s" :label="s" :value="s" />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <div class="column-card">
            <div class="column-title">金额信息</div>
            <div class="form-grid form-grid-3">
              <el-form-item label="全款金额 (元)">
                <el-input-number v-model="form.totalAmount" :min="0" :precision="0" :step="100" controls-position="right" placeholder="全款金额" style="width: 100%" />
              </el-form-item>
              <el-form-item label="已收金额 (定金)">
                <el-input-number v-model="form.paidAmount" :min="0" :precision="0" :step="100" controls-position="right" placeholder="已收金额" style="width: 100%" />
              </el-form-item>
              <el-form-item label="派单金额 (元)">
                <el-input-number v-model="form.dispatchAmount" :min="0" :precision="0" :step="100" controls-position="right" placeholder="支付给处理人" style="width: 100%" />
              </el-form-item>
            </div>
          </div>
        </section>
      </div>

      <el-alert
        v-if="!isEditing"
        class="folder-alert"
        :title="`保存后将在根目录下创建文件夹: ${folderPreview}`"
        type="info"
        show-icon
        :closable="false"
      />
    </el-form>

    <template #footer>
      <el-button @click="closeDialog()">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">
        {{ isEditing ? '保存修改' : '创建项目并建档' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed, onMounted, inject } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({ visible: Boolean, order: Object })
const emit = defineEmits(['update:visible', 'saved'])
const api = window.electronAPI
const currentUser = inject('currentUser')
const saving = ref(false)
const isEditing = computed(() => !!props.order)
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const orderTypes = [
  { key: 'thesis', label: '毕设论文', desc: '含论文、设计、修改', color: '#6366f1' },
  { key: 'format', label: '格式修改', desc: '仅格式调整', color: '#0ea5e9' },
  { key: 'translation', label: '外文翻译', desc: '翻译任务', color: '#f59e0b' },
  { key: 'design', label: '设计定制', desc: '程序/单片机/机械设计', color: '#8b5cf6' },
  { key: 'reduction', label: '论文降重', desc: '降重与修改交付', color: '#10b981' },
  { key: 'special', label: '特殊订单', desc: '图例/PPT等灵活项目', color: '#ef4444' },
]

const graduationYearOptions = computed(() => {
  const current = getCurrentGraduationYear()
  const years = []
  for (let y = current + 2; y >= current - 3; y--) years.push(y)
  return years
})

const showDesignFields = computed(() => form.value.orderType === 'design' || (form.value.orderType === 'thesis' && form.value.includesDesign))
const titleLabel = computed(() => {
  const map = {
    thesis: '论文题目',
    format: '项目题目',
    translation: '论文题目',
    design: '项目题目',
    reduction: '论文题目',
    special: '订单标题',
  }
  return map[form.value.orderType] || '项目题目'
})
const titlePlaceholder = computed(() => {
  const map = {
    thesis: '输入毕设论文题目',
    format: '输入项目题目',
    translation: '输入论文题目',
    design: '输入设计项目名称',
    reduction: '输入论文题目',
    special: '输入订单标题',
  }
  return map[form.value.orderType] || '输入项目题目'
})

const historyCache = ref({})

async function fetchSuggestions(field, query, cb) {
  if (!currentUser.value || !currentUser.value.id) return cb([])
  if (!historyCache.value[field]) {
    historyCache.value[field] = await api.getDistinctValues(currentUser.value.id, field)
  }
  const list = historyCache.value[field]
  const q = (query || '').toLowerCase()
  const filtered = q ? list.filter(v => v.toLowerCase().includes(q)) : list
  cb(filtered.map(v => ({ value: v })))
}

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

const currentTypeDef = computed(() => designTypeDefs.value.find(t => t.typeName === form.value.designType))
const currentSubTypes = computed(() => currentTypeDef.value?.subTypes || [])
const currentStatuses = computed(() => {
  if (currentSubTypes.value.length > 0) {
    const sub = currentSubTypes.value.find(s => s.name === form.value.designSubType)
    return sub?.statuses || []
  }
  return currentTypeDef.value?.statuses || []
})

function onDesignTypeChange() {
  form.value.designSubType = ''
  form.value.designStatus = ''
}
function onDesignSubTypeChange() {
  form.value.designStatus = ''
}

function getCurrentGraduationYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}

const defaultForm = () => ({
  orderType: 'thesis',
  title: '', university: '', college: '', major: '',
  studentName: '', wechatName: '', groupChatName: '',
  includesDesign: 0, designType: '', designSubType: '', designStatus: '',
  formatMode: '', hasOriginalText: 0, specialService: '',
  receiver: '', handler: '', advisor: '',
  deadline: '', totalAmount: undefined, paidAmount: undefined, dispatchAmount: undefined,
  graduationYear: getCurrentGraduationYear(),
})
const form = ref(defaultForm())

const typeSubDirMap = {
  thesis: '毕业设计',
  format: '格式修改',
  translation: '外文翻译',
  design: '毕业设计',
  reduction: '论文降重',
  special: '特殊订单',
}
const folderPreview = computed(() => {
  const year = new Date().getFullYear()
  const uni = form.value.university || '学校名称'
  const title = form.value.title || '项目名称'
  const subDir = typeSubDirMap[form.value.orderType] || '毕业设计'
  return `${subDir}/${year}-${uni}-${title}`
})

watch(() => props.visible, (val) => {
  if (val) {
    historyCache.value = {}
    loadDesignTypes()
    if (props.order) {
      form.value = {
        orderType: props.order.orderType || 'thesis',
        title: props.order.title || '',
        university: props.order.university || '',
        college: props.order.college || '',
        major: props.order.major || '',
        studentName: props.order.studentName || '',
        wechatName: props.order.wechatName || '',
        groupChatName: props.order.groupChatName || '',
        includesDesign: props.order.includesDesign || 0,
        designType: props.order.designType || '',
        designSubType: props.order.designSubType || '',
        designStatus: props.order.designStatus || '',
        formatMode: props.order.formatMode || '',
        hasOriginalText: props.order.hasOriginalText || 0,
        specialService: props.order.specialService || '',
        receiver: props.order.receiver === '本人' ? '' : (props.order.receiver || ''),
        handler: props.order.handler === '本人' ? '' : (props.order.handler || ''),
        advisor: props.order.advisor || '',
        deadline: props.order.deadline || '',
        totalAmount: props.order.totalAmount || undefined,
        paidAmount: props.order.paidAmount || undefined,
        dispatchAmount: props.order.dispatchAmount || undefined,
        graduationYear: props.order.graduationYear || getCurrentGraduationYear(),
      }
    } else {
      form.value = defaultForm()
    }
  }
})

function closeDialog() {
  emit('update:visible', false)
}

async function handleSave() {
  if (!form.value.title.trim()) return ElMessage.warning('请填写项目题目')
  if (!form.value.deadline) return ElMessage.warning('请选择交稿日期')
  if (!form.value.university && !isEditing.value) {
    return ElMessage.warning('请填写学校名称')
  }
  saving.value = true
  try {
    const payload = {
      orderType: form.value.orderType || 'thesis',
      title: form.value.title,
      university: form.value.university || '',
      college: form.value.college || '',
      major: form.value.major || '',
      studentName: form.value.studentName || '',
      wechatName: form.value.wechatName || '',
      groupChatName: form.value.groupChatName || '',
      includesDesign: form.value.orderType === 'design' ? 1 : (form.value.orderType === 'thesis' ? (form.value.includesDesign ? 1 : 0) : 0),
      designType: showDesignFields.value ? (form.value.designType || '') : '',
      designSubType: showDesignFields.value ? (form.value.designSubType || '') : '',
      designStatus: showDesignFields.value ? (form.value.designStatus || '') : '',
      formatMode: form.value.orderType === 'format' ? (form.value.formatMode || '') : '',
      hasOriginalText: form.value.orderType === 'translation' ? (form.value.hasOriginalText ? 1 : 0) : 0,
      specialService: form.value.orderType === 'special' ? (form.value.specialService || '') : '',
      receiver: form.value.receiver || '本人',
      handler: form.value.handler || '本人',
      advisor: form.value.advisor || '',
      deadline: form.value.deadline,
      totalAmount: Number(form.value.totalAmount) || 0,
      paidAmount: Number(form.value.paidAmount) || 0,
      dispatchAmount: Number(form.value.dispatchAmount) || 0,
      graduationYear: Number(form.value.graduationYear) || getCurrentGraduationYear(),
    }
    if (!currentUser.value || !currentUser.value.id) {
      ElMessage.error('用户未登录')
      return
    }
    if (isEditing.value) {
      await api.updateOrder(currentUser.value.id, props.order.id, payload)
    } else {
      const newId = await api.createOrder({ ...payload, userId: currentUser.value.id, folderPath: '' })
      const rootDir = await api.getSetting('rootDirectory')
      if (rootDir) {
        const r = await api.generateOrderFolder({
          rootDirectory: rootDir,
          university: payload.university,
          major: payload.major,
          studentName: payload.studentName,
          title: payload.title,
          includesDesign: payload.includesDesign,
          orderType: payload.orderType,
        })
        if (r.success && r.folderPath) {
          await api.updateOrder(currentUser.value.id, Number(newId), { folderPath: r.folderPath })
        }
      }
    }
    ElMessage.success(isEditing.value ? '已保存' : '项目已创建')
    closeDialog()
    emit('saved')
  } catch (err) {
    ElMessage.error('保存失败: ' + (err.message || '未知错误'))
    console.error('handleSave error:', err)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
:deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.order-dialog :deep(.el-dialog__header) {
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  padding: 16px 24px;
}

.order-dialog :deep(.el-dialog) {
  margin: 0 !important;
}

.order-dialog :deep(.el-dialog__body) {
  max-height: min(74vh, 760px);
  overflow: auto;
  padding: 18px 24px;
}

.order-dialog :deep(.el-dialog__footer) {
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

.order-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
  gap: 16px;
  align-items: start;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.column-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  padding: 14px;
}

.column-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid :deep(.el-form-item) {
  margin-bottom: 0;
}

.form-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.folder-alert {
  margin-top: 2px;
}

/* Type selector */
.type-selector {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.type-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.type-option:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.type-option.active {
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.1);
}
.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background 0.15s;
}
.type-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}
.type-desc {
  font-size: 11px;
  color: #94a3b8;
}

@media (max-width: 980px) {
  .form-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .type-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid-2,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
