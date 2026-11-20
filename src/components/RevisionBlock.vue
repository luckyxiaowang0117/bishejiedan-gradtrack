<template>
  <div class="rev-block">
    <!-- Collapsible header -->
    <div class="rev-header" @click="toggleExpand">
      <div class="rev-header-row1">
        <div class="rev-header-title">
          <el-icon :size="14" class="caret-icon">
            <CaretBottom v-if="isExpanded" />
            <CaretRight v-else />
          </el-icon>
          <h4 class="rev-title">{{ revision.title }}</h4>
        </div>
        <div class="rev-header-tags">
          <el-button
            v-if="pendingCount > 0"
            text
            bg
            size="small"
            type="primary"
            class="batch-resolve-btn"
            @click.stop="resolveAllItems"
          >
            <el-icon><Select /></el-icon> 一键全标完成 ({{ pendingCount }})
          </el-button>
          <el-tag v-if="pendingCount > 0" type="warning" effect="plain" round class="status-capsule">
            {{ pendingCount }} 个待修改
          </el-tag>
          <el-tag v-else-if="items.length > 0 && deliveryFiles.length === 0" type="warning" effect="plain" round class="status-capsule">
            待交付文件
          </el-tag>
          <el-tag v-else-if="items.length > 0 && deliveryFiles.length > 0" type="success" effect="plain" round class="status-capsule">
            <el-icon :size="14"><Check /></el-icon> <span>全部完成</span>
          </el-tag>
          <span v-if="deliveryFiles.length > 0" class="delivery-tag">
            <el-icon :size="13"><Check /></el-icon>
            <span>已交付</span>
          </span>
        </div>
      </div>
      <div class="rev-header-row2" @click.stop>
        <div class="deadline-area" :class="deadlineColor">
          <el-icon :size="12"><Clock /></el-icon>
          截止:
          <input
            type="datetime-local"
            :value="revision.deadline || ''"
            @change="handleDeadlineChange($event.target.value)"
            class="date-input"
          />
          <span v-if="isOverdue" class="status-tag danger">
            <el-icon :size="12"><WarningFilled /></el-icon> 逾期
          </span>
          <span v-else-if="isNearDeadline" class="status-tag warning">
            <el-icon :size="12"><Warning /></el-icon> 临近
          </span>
        </div>
        <span class="rev-created">创建: {{ revision.createdAt?.split('T')[0] || '—' }}</span>
      </div>
    </div>

    <!-- Content -->
    <div v-show="isExpanded" class="rev-content">
      <ul class="item-list">
        <li v-for="item in items" :key="item.id" class="feedback-item" :class="{ 'is-editing': editingItemId === item.id }">
          <el-checkbox
            :model-value="!!item.isResolved"
            @change="toggleItem(item.id)"
            class="item-check"
          />
          <div class="item-body">
            <div v-if="editingItemId === item.id" class="item-inline-edit">
              <el-input
                v-model="editingContent"
                type="textarea"
                :rows="2"
                placeholder="修改意见内容"
                @keydown.enter.ctrl="saveEdit(item.id)"
                @keydown.esc="cancelEdit"
                class="edit-textarea"
                autofocus
              />
              <div class="inline-edit-buttons">
                <el-button size="small" type="primary" @click="saveEdit(item.id)">保存</el-button>
                <el-button size="small" @click="cancelEdit">取消</el-button>
              </div>
            </div>
            <p
              v-else
              class="item-text"
              :class="{ resolved: item.isResolved }"
              title="双击即可修改此条意见"
              @dblclick="startEdit(item)"
            >
              {{ item.content }}
            </p>
            <!-- Attachment thumbnails -->
            <div v-if="parseAttachments(item).length > 0" class="attach-list">
              <div
                v-for="(att, i) in parseAttachments(item)"
                :key="i"
                class="attach-thumb-wrap"
              >
                <div class="attach-thumb" @click.stop="previewAttachment(att)">
                  <img v-if="att.type === 'image'" :src="'file://' + att.path" :alt="att.name" />
                  <div v-else-if="att.type === 'video'" class="video-thumb">
                    <video :src="'file://' + att.path" preload="metadata" />
                    <div class="video-play-icon">
                      <el-icon :size="20" color="#fff"><VideoPlay /></el-icon>
                    </div>
                  </div>
                  <div v-else class="file-icon-thumb">
                    <el-icon :size="22" color="var(--gt-text-violet)"><Document /></el-icon>
                  </div>
                  <span class="attach-name">{{ att.name }}</span>
                </div>
                <!-- Archive button -->
                <el-dropdown
                  v-if="availableFolders.length > 0"
                  trigger="click"
                  size="small"
                  @command="(cmd) => archiveToFolder(att, cmd)"
                >
                  <button class="archive-btn" @click.stop title="归档到项目文件夹">
                    <el-icon :size="12"><FolderAdd /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="f in availableFolders" :key="f.key" :command="f">
                        <el-icon :size="14"><Folder /></el-icon> {{ f.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button v-if="editingItemId !== item.id" class="item-action-btn item-edit-btn" title="编辑意见" @click="startEdit(item)">
              <el-icon><Edit /></el-icon>
            </button>
            <button class="item-action-btn item-delete" title="删除意见" @click="deleteItem(item.id)">
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </li>
      </ul>

      <!-- Input area with drag support -->
      <div
        class="input-area"
        :class="{ 'input-drag-over': isInputDragOver }"
        @dragover.prevent="isInputDragOver = true"
        @dragleave="isInputDragOver = false"
        @drop.prevent="handleFileDrop"
      >
        <!-- Pending attachments preview -->
        <div v-if="pendingFiles.length > 0" class="pending-files">
          <div v-for="(f, i) in pendingFiles" :key="i" class="pending-file">
            <img v-if="f.type.startsWith('image/')" :src="f.preview" class="pending-thumb" />
            <video v-else-if="f.type.startsWith('video/')" :src="f.preview" class="pending-thumb" />
            <div v-else class="pending-thumb pending-file-icon">
              <el-icon :size="20" color="var(--gt-text-violet)"><Document /></el-icon>
            </div>
            <span class="pending-name">{{ f.file.name }}</span>
            <button class="pending-remove" @click="removePendingFile(i)">
              <el-icon :size="12"><Close /></el-icon>
            </button>
          </div>
        </div>

        <div class="input-wrap">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            @keydown.ctrl.enter.prevent="handleSubmit"
            @keydown.meta.enter.prevent="handleSubmit"
            @paste="handlePaste"
            placeholder="输入修改意见，支持多行。Ctrl+Enter 或点击按钮提交。支持粘贴/拖拽文件。"
            rows="3"
          />
          <button class="send-btn" @click="handleSubmit" title="添加">
            <el-icon><Promotion /></el-icon>
          </button>
        </div>

        <!-- Drag overlay for input area -->
        <div v-show="isInputDragOver" class="input-drag-overlay">
          <el-icon :size="24"><Upload /></el-icon>
          <span>松开以添加为附件</span>
        </div>

        <div class="input-bottom-bar">
          <el-checkbox v-model="autoSplitLines" size="small" class="auto-split-checkbox">
            多行文本自动拆分为独立待办清单
          </el-checkbox>
          <span class="input-hint">
            <el-icon :size="12"><InfoFilled /></el-icon>
            Ctrl+Enter 提交，支持截图直接粘贴
          </span>
        </div>
      </div>

      <!-- ═══ Delivery section ═══ -->
      <div class="delivery-section">
        <div class="delivery-header">
          <div class="delivery-title">
            <el-icon :size="16" color="var(--gt-text-success)"><Upload /></el-icon>
            <span>修改后交付</span>
          </div>
          <el-button type="success" text bg size="small" @click="handleSelectDelivery">
            <el-icon><Upload /></el-icon> 上传文件
          </el-button>
        </div>

        <div
          class="delivery-body"
          :class="{ 'delivery-drag-over': isDeliveryDragOver }"
          @dragover.prevent.stop="isDeliveryDragOver = true"
          @dragleave.stop="onDeliveryDragLeave"
          @drop.prevent.stop="handleDeliveryDrop"
        >
          <div v-if="deliveryFiles.length === 0 && !isDeliveryDragOver" class="delivery-placeholder">
            <el-icon :size="24" color="var(--gt-border-strong)"><UploadFilled /></el-icon>
            <span>处理完修改后，将文件拖拽到此处或点击上方按钮上传</span>
          </div>

          <div v-if="deliveryFiles.length > 0" class="delivery-file-list">
            <div v-for="f in deliveryFiles" :key="f.path" class="delivery-file" @dblclick="openFileInSystem(f.path)">
              <div class="delivery-file-icon">
                <el-icon :size="20" :color="getDeliveryFileColor(f.name)"><Document /></el-icon>
              </div>
              <div class="delivery-file-info">
                <span class="delivery-file-name" :title="f.name">{{ f.name }}</span>
                <span class="delivery-file-meta">{{ formatFileSize(f.size) }}</span>
              </div>
              <div class="delivery-file-actions">
                <el-button text size="small" @click.stop="openFileInSystem(f.path)" title="打开">
                  <el-icon :size="14"><View /></el-icon>
                </el-button>
                <el-button text size="small" @click.stop="revealInFinder(f.path)" title="在文件夹中显示">
                  <el-icon :size="14"><FolderOpened /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <div v-show="isDeliveryDragOver" class="delivery-drag-overlay">
            <el-icon :size="24"><Upload /></el-icon>
            <span>松开以上传修改后文件</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview dialog -->
    <el-dialog v-model="previewVisible" :title="previewTitle" width="auto" top="5vh" destroy-on-close>
      <div class="preview-body">
        <img v-if="previewType === 'image'" :src="'file://' + previewSrc" class="preview-img" />
        <video v-else-if="previewType === 'video'" :src="'file://' + previewSrc" controls autoplay class="preview-video" />
        <div v-else class="preview-file-info">
          <el-icon :size="48" color="var(--gt-text-violet)"><Document /></el-icon>
          <p>{{ previewTitle }}</p>
          <el-button type="primary" @click="openFileInSystem(previewSrc)">用系统程序打开</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAccountWork } from '../useAccountWork.js'

const props = defineProps({ revision: Object, projectFoldersRef: Object })
const emit = defineEmits(['changed'])
const api = window.electronAPI

const isExpanded = ref(!!props.revision.isExpanded)
const inputText = ref('')
const textareaRef = ref(null)
const pendingFiles = ref([])
const isInputDragOver = ref(false)

const editingItemId = ref(null)
const editingContent = ref('')
const autoSplitLines = ref(true)
const saveAccountWork = useAccountWork({
  hasDraft: () => inputText.value.trim() || pendingFiles.value.length > 0 || editingItemId.value !== null,
})

function startEdit(item) {
  editingItemId.value = item.id
  editingContent.value = item.content
}

function cancelEdit() {
  editingItemId.value = null
  editingContent.value = ''
}

async function saveEdit(id) {
  const content = editingContent.value.trim()
  if (!content) {
    ElMessage.warning('修改意见内容不能为空')
    return
  }
  try {
    await saveAccountWork(() => api.updateFeedback(id, content))
    editingItemId.value = null
    editingContent.value = ''
    emit('changed')
    ElMessage.success('已更新修改意见')
  } catch (err) {
    ElMessage.error('更新失败: ' + (err.message || err))
  }
}

async function resolveAllItems() {
  const unresolved = items.value.filter(i => !i.isResolved)
  if (unresolved.length === 0) return
  try {
    await saveAccountWork(async () => {
      for (const item of unresolved) await api.toggleFeedbackResolved(item.id)
    })
    emit('changed')
    ElMessage.success(`已全部标记为完成（共 ${unresolved.length} 项）`)
  } catch (err) {
    ElMessage.error('操作失败: ' + (err.message || err))
  }
}

const deliveryFiles = ref([])
const isDeliveryDragOver = ref(false)

const deliveryFolderPath = computed(() => {
  if (!props.revision.folderPath) return ''
  return `${props.revision.folderPath}/修改后文件`.replace(/\\/g, '/')
})

async function loadDeliveryFiles() {
  if (!deliveryFolderPath.value) { deliveryFiles.value = []; return }
  await api.createFolder(deliveryFolderPath.value)
  const r = await api.listFolderContents(deliveryFolderPath.value)
  deliveryFiles.value = r.success ? r.files.filter(f => !f.isDirectory) : []
}

function onDeliveryDragLeave(event) {
  const el = event.currentTarget
  if (el && el.contains(event.relatedTarget)) return
  isDeliveryDragOver.value = false
}

async function handleDeliveryDrop(event) {
  isDeliveryDragOver.value = false
  const pathSet = new Set()
  const dtFiles = event.dataTransfer?.files
  if (dtFiles && dtFiles.length > 0) {
    for (const f of dtFiles) {
      const p = api.getPathForFile ? api.getPathForFile(f) : f.path
      if (p) pathSet.add(p)
    }
  }
  try {
    const uriList = event.dataTransfer?.getData('text/uri-list')
    if (uriList) {
      for (const line of uriList.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            const url = new URL(trimmed)
            if (url.protocol === 'file:') {
              let p = decodeURIComponent(url.pathname)
              if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1)
              pathSet.add(p)
            }
          } catch {}
        }
      }
    }
  } catch {}

  if (pathSet.size === 0) {
    ElMessage.info('未能自动获取路径，正在打开选择对话框…')
    try {
      const selected = await api.selectItems('files')
      if (selected && selected.length > 0) selected.forEach(p => pathSet.add(p))
    } catch {}
  }
  if (pathSet.size === 0) { ElMessage.warning('未选择任何文件'); return }
  await copyDeliveryFiles([...pathSet])
}

async function handleSelectDelivery() {
  try {
    const selected = await api.selectItems('files')
    if (!selected || selected.length === 0) return
    await copyDeliveryFiles(selected)
  } catch (err) {
    ElMessage.error('选择文件失败: ' + (err.message || err))
  }
}

async function copyDeliveryFiles(paths) {
  try {
    const r = await api.copyFilesToFolder(paths, deliveryFolderPath.value)
    if (r.success) {
      ElMessage.success(`已上传 ${r.copied.length} 个修改后文件`)
      await loadDeliveryFiles()
    } else {
      ElMessage.error('上传失败: ' + r.error)
    }
  } catch (err) {
    ElMessage.error('上传出错: ' + (err.message || err))
  }
}

async function revealInFinder(filePath) {
  await api.revealInFinder(filePath)
}

function getDeliveryFileColor(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  if (['doc', 'docx'].includes(ext)) return '#2b579a'
  if (['pdf'].includes(ext)) return '#d93025'
  if (['xls', 'xlsx'].includes(ext)) return '#217346'
  if (['ppt', 'pptx'].includes(ext)) return '#d24726'
  return '#6366f1'
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

onMounted(loadDeliveryFiles)

const previewVisible = ref(false)
const previewSrc = ref('')
const previewType = ref('image')
const previewTitle = ref('')

const items = computed(() => props.revision.items || [])
const pendingCount = computed(() => items.value.filter(i => !i.isResolved).length)

const availableFolders = computed(() => {
  if (!props.projectFoldersRef) return []
  try { return props.projectFoldersRef.getFolderDefs() || [] } catch { return [] }
})

const hoursLeft = computed(() => {
  if (!props.revision.deadline) return Infinity
  const dl = props.revision.deadline
  const target = dl.includes('T') ? new Date(dl) : new Date(dl + 'T23:59:59')
  return (target - new Date()) / 3600000
})
const daysLeft = computed(() => Math.ceil(hoursLeft.value / 24))
const isOverdue = computed(() => props.revision.deadline && hoursLeft.value < 0 && pendingCount.value > 0)
const isNearDeadline = computed(() => props.revision.deadline && hoursLeft.value >= 0 && hoursLeft.value <= 48 && pendingCount.value > 0)
const deadlineColor = computed(() => {
  if (!pendingCount.value || !props.revision.deadline) return 'color-default'
  if (isOverdue.value) return 'color-danger'
  if (isNearDeadline.value) return 'color-warning'
  return 'color-default'
})

function parseAttachments(item) {
  if (!item.attachments) return []
  try { return JSON.parse(item.attachments) } catch { return [] }
}

function getFileType(mimeOrName) {
  if (!mimeOrName) return 'file'
  const lower = mimeOrName.toLowerCase()
  if (lower.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) return 'image'
  if (lower.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(lower)) return 'video'
  return 'file'
}

function previewAttachment(att) {
  previewSrc.value = att.path
  previewType.value = att.type || 'file'
  previewTitle.value = att.name
  previewVisible.value = true
}

async function openFileInSystem(filePath) {
  await api.openFileInSystem(filePath)
}

async function archiveToFolder(att, folder) {
  const r = await api.copyFilesToFolder([att.path], folder.path)
  if (r.success) {
    ElMessage.success(`已归档到「${folder.label}」`)
    if (props.projectFoldersRef) props.projectFoldersRef.refreshAll()
  } else {
    ElMessage.error('归档失败: ' + r.error)
  }
}

async function toggleExpand() {
  isExpanded.value = !isExpanded.value
  await api.updateRevision(props.revision.id, { isExpanded: isExpanded.value ? 1 : 0 })
}

async function handleDeadlineChange(val) {
  await api.updateRevision(props.revision.id, { deadline: val || null })
  emit('changed')
}

function handlePaste(e) {
  const clipboardItems = e.clipboardData?.items
  if (!clipboardItems) return
  for (const item of clipboardItems) {
    if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      addPendingFile(file, item.type)
    }
  }
}

function handleFileDrop(e) {
  isInputDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  for (const file of files) {
    addPendingFile(file, file.type || 'application/octet-stream')
  }
}

function addPendingFile(file, type) {
  if (type.startsWith('image/') || type.startsWith('video/')) {
    const reader = new FileReader()
    reader.onload = () => {
      pendingFiles.value.push({ file, type, preview: reader.result })
    }
    reader.readAsDataURL(file)
  } else {
    pendingFiles.value.push({ file, type, preview: null })
  }
}

function removePendingFile(index) {
  pendingFiles.value.splice(index, 1)
}

function handleSubmit() {
  return saveAccountWork(submitFeedback)
}

async function submitFeedback() {
  const text = inputText.value.trim()
  const hasPending = pendingFiles.value.length > 0
  if (!text && !hasPending) return

  try {
    let savedAttachments = []
    if (hasPending) {
      for (const pf of pendingFiles.value) {
        const fileType = getFileType(pf.type)
        const arrayBuf = await pf.file.arrayBuffer()
        const filename = pf.file.name || `paste_${Date.now()}.${pf.type.split('/')[1] || 'bin'}`
        const r = await api.saveAttachment({
          buffer: Array.from(new Uint8Array(arrayBuf)),
          filename,
          targetDir: props.revision.folderPath || '',
        })
        if (r.success) savedAttachments.push({ type: fileType, path: r.path, name: r.name })
      }
    }

    if (text) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (autoSplitLines.value && lines.length > 1 && savedAttachments.length === 0) {
        await api.batchCreateFeedback(props.revision.id, lines)
        ElMessage.success(`已智能拆分并添加 ${lines.length} 条修改意见`)
      } else {
        await api.createFeedback(props.revision.id, text, savedAttachments)
      }
    } else if (savedAttachments.length > 0) {
      const defaultContent = savedAttachments.map(a => `[${a.type === 'image' ? '图片' : a.type === 'video' ? '视频' : '文件'}] ${a.name}`).join(', ')
      await api.createFeedback(props.revision.id, defaultContent, savedAttachments)
    }

    inputText.value = ''
    pendingFiles.value = []
    emit('changed')
  } catch (err) {
    ElMessage.error('添加失败: ' + (err.message || '未知错误'))
  }
}

async function toggleItem(id) {
  await saveAccountWork(() => api.toggleFeedbackResolved(id))
  emit('changed')
}

async function deleteItem(id) {
  await saveAccountWork(() => api.deleteFeedback(id))
  emit('changed')
}
</script>

<style scoped>
.rev-block {
  background: var(--gt-surface);
  border: 1px solid var(--gt-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* ─── Header ─── */
.rev-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--gt-surface-subtle) 50%, transparent);
  border-bottom: 1px solid var(--gt-border);
  cursor: pointer;
}
.rev-header-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rev-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rev-header-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-capsule {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
  box-sizing: border-box;
}
.status-capsule :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rev-header-row2 {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 22px;
}
.caret-icon { color: var(--gt-text-main); flex-shrink: 0; }
.delivery-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 12px;
  height: 24px;
  line-height: 1;
  font-size: 12px;
  font-weight: 700;
  color: var(--gt-text-success);
  background: var(--gt-success-surface);
  border: 1px solid var(--gt-success-border);
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.rev-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--gt-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.deadline-area {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
.color-default { color: var(--gt-text-main); }
.color-danger { color: var(--gt-text-danger); }
.color-warning { color: var(--gt-text-warning); }
.date-input {
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--gt-border-strong);
  font-size: 12px;
  font-weight: 600;
  color: inherit;
  width: 165px;
  cursor: pointer;
  padding: 0;
}
.date-input:focus { outline: none; border-bottom-color: light-dark(#6366f1, #a5b4fc); }
.status-tag {
  font-weight: 700;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
.status-tag.danger { color: var(--gt-text-danger); }
.status-tag.warning { color: var(--gt-text-warning); }
.rev-created {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 600;
  border-left: 1px solid var(--gt-border-strong);
  padding-left: 16px;
  white-space: nowrap;
}

/* ─── Content ─── */
.rev-content { padding: 8px; background: var(--gt-surface); }
.item-list { list-style: none; }
.feedback-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}
.feedback-item:hover { background: var(--gt-surface-subtle); }
.item-check { margin-top: 2px; }
.item-body { flex: 1; min-width: 0; }
.item-text {
  font-size: 13.5px;
  color: var(--gt-text-main);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
.item-text.resolved { text-decoration: line-through; color: var(--gt-text-muted); font-weight: 500; }

/* ─── Attachments ─── */
.attach-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.attach-thumb-wrap {
  position: relative;
  width: 100px;
}
.attach-thumb {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--gt-border);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.attach-thumb:hover {
  border-color: light-dark(#6366f1, #a5b4fc);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}
.attach-thumb img {
  width: 100%;
  height: 72px;
  object-fit: cover;
  display: block;
}
.video-thumb { position: relative; }
.video-thumb video {
  width: 100%;
  height: 72px;
  object-fit: cover;
  display: block;
}
.video-play-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}
.file-icon-thumb {
  width: 100%;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gt-surface-muted);
}
.attach-name {
  display: block;
  font-size: 11px;
  color: var(--gt-text-main);
  font-weight: 600;
  padding: 3px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--gt-surface-subtle);
}

/* Archive button on attachment */
.archive-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--gt-surface) 90%, transparent);
  border: 1px solid var(--gt-border-strong);
  color: var(--gt-text-violet);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 3;
}
.attach-thumb-wrap:hover .archive-btn { opacity: 1; }
.archive-btn:hover { background: var(--gt-accent-surface); }

.batch-resolve-btn {
  font-size: 12px;
  font-weight: 600;
  height: 24px;
  padding: 0 8px;
}

.item-inline-edit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0;
}

.inline-edit-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.item-action-btn {
  opacity: 0;
  padding: 4px;
  border: none;
  background: none;
  color: var(--gt-text-main);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feedback-item:hover .item-action-btn {
  opacity: 1;
}

.item-edit-btn:hover {
  color: light-dark(#4f46e5, #c7d2fe);
  background: var(--gt-accent-surface);
}

.item-delete:hover {
  color: var(--gt-text-danger);
  background: light-dark(#fff1f2, #352333);
}

.input-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.auto-split-checkbox {
  font-size: 12px;
  font-weight: 600;
  color: var(--gt-text-main);
}

.input-hint {
  font-size: 12px;
  font-weight: 600;
  color: var(--gt-text-main);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ─── Pending files ─── */
.pending-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  background: light-dark(#f0fdf4, var(--gt-surface-muted));
  border: 1px dashed light-dark(#86efac, var(--gt-border-strong));
  border-radius: 8px;
}
.pending-file {
  position: relative;
  width: 88px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--gt-success-border);
  background: var(--gt-surface);
}
.pending-thumb {
  width: 100%;
  height: 60px;
  object-fit: cover;
  display: block;
}
.pending-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gt-surface-muted);
}
.pending-name {
  display: block;
  font-size: 11px;
  color: var(--gt-text-main);
  font-weight: 600;
  padding: 2px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pending-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pending-remove:hover { background: rgba(220, 38, 38, 0.8); }

/* ─── Input Area ─── */
.input-area {
  margin-top: 8px;
  padding: 12px;
  border-top: 1px solid var(--gt-border);
  position: relative;
  transition: background 0.2s;
}
.input-area.input-drag-over {
  background: var(--gt-accent-surface);
}
.input-drag-overlay {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: light-dark(rgba(99, 102, 241, 0.06), rgba(147, 197, 253, 0.12));
  border: 2px dashed light-dark(#6366f1, #a5b4fc);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: light-dark(#4f46e5, #c7d2fe);
  font-size: 13px;
  font-weight: 500;
  z-index: 5;
  pointer-events: none;
}
.input-wrap { position: relative; }
.input-wrap textarea {
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--gt-text-main);
  background: var(--gt-surface-subtle);
  border: 1px solid var(--gt-border);
  border-radius: 8px;
  padding: 12px;
  padding-right: 44px;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}
.input-wrap textarea:focus {
  outline: none;
  border-color: light-dark(#6366f1, #a5b4fc);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}
.input-wrap textarea::placeholder { color: var(--gt-text-muted); }
.send-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 6px;
  background: var(--gt-accent-surface-strong);
  color: var(--gt-text-violet);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.send-btn:hover { background: light-dark(#c7d2fe, var(--gt-surface-raised)); }
.input-hint {
  font-size: 11px;
  color: var(--gt-text-main);
  font-weight: 600;
  margin-top: 6px;
  margin-left: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ─── Preview ─── */
.preview-body {
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 80vh;
}
.preview-img { max-width: 100%; max-height: 75vh; border-radius: 8px; }
.preview-video { max-width: 100%; max-height: 75vh; border-radius: 8px; }
.preview-file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
}
.preview-file-info p {
  font-size: 14px;
  color: var(--gt-text-main);
  font-weight: 600;
}

/* ─── Delivery Section ─── */
.delivery-section {
  margin-top: 4px;
  padding: 12px;
  border-top: 2px dashed var(--gt-border-strong);
}

.delivery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.delivery-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--gt-text-success);
}

.delivery-body {
  position: relative;
  background: light-dark(#f0fdf4, var(--gt-surface-muted));
  border: 1.5px solid light-dark(#86efac, var(--gt-border-strong));
  border-radius: 10px;
  padding: 12px;
  min-height: 60px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.delivery-body.delivery-drag-over {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  background: light-dark(#dcfce7, #1d4338);
}

.delivery-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  color: var(--gt-text-main);
  font-weight: 600;
  font-size: 12.5px;
  text-align: center;
}

.delivery-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.delivery-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--gt-surface);
  border: 1px solid var(--gt-success-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 180px;
  max-width: 280px;
  flex: 1;
}
.delivery-file:hover {
  background: var(--gt-success-surface);
  border-color: light-dark(#6ee7b7, #376652);
}

.delivery-file-icon {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: light-dark(#f0fdf4, #17352e);
  border: 1px solid var(--gt-success-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delivery-file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.delivery-file-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--gt-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delivery-file-meta {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--gt-text-main);
}

.delivery-file-actions {
  display: flex;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.delivery-file:hover .delivery-file-actions {
  opacity: 1;
}

.delivery-drag-overlay {
  position: absolute;
  inset: 0;
  border-radius: 9px;
  background: light-dark(rgba(16, 185, 129, 0.08), rgba(134, 239, 172, 0.18));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--gt-text-success);
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2;
}
</style>
