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
        <li v-for="item in items" :key="item.id" class="feedback-item">
          <el-checkbox
            :model-value="!!item.isResolved"
            @change="toggleItem(item.id)"
            class="item-check"
          />
          <div class="item-body">
            <p class="item-text" :class="{ resolved: item.isResolved }">{{ item.content }}</p>
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
                    <el-icon :size="22" color="#6366f1"><Document /></el-icon>
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
          <button class="item-delete" @click="deleteItem(item.id)">
            <el-icon><Delete /></el-icon>
          </button>
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
              <el-icon :size="20" color="#6366f1"><Document /></el-icon>
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

        <p class="input-hint">
          <el-icon :size="12"><InfoFilled /></el-icon>
          支持粘贴/拖拽任意文件作为附件。回车换行，Ctrl+Enter 提交。
        </p>
      </div>

      <!-- ═══ Delivery section ═══ -->
      <div class="delivery-section">
        <div class="delivery-header">
          <div class="delivery-title">
            <el-icon :size="16" color="#10b981"><Upload /></el-icon>
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
            <el-icon :size="24" color="#cbd5e1"><UploadFilled /></el-icon>
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
          <el-icon :size="48" color="#6366f1"><Document /></el-icon>
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

const props = defineProps({ revision: Object, projectFoldersRef: Object })
const emit = defineEmits(['changed'])
const api = window.electronAPI

const isExpanded = ref(!!props.revision.isExpanded)
const inputText = ref('')
const textareaRef = ref(null)
const pendingFiles = ref([])
const isInputDragOver = ref(false)

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

async function handleSubmit() {
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
      await api.createFeedback(props.revision.id, text, savedAttachments)
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

async function toggleItem(id) { await api.toggleFeedbackResolved(id); emit('changed') }
async function deleteItem(id) { await api.deleteFeedback(id); emit('changed') }
</script>

<style scoped>
.rev-block {
  background: #fff;
  border: 1px solid #e2e8f0;
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
  background: rgba(248, 250, 252, 0.5);
  border-bottom: 1px solid #f1f5f9;
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
.caret-icon { color: #94a3b8; flex-shrink: 0; }
.delivery-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 12px;
  height: 24px;
  line-height: 1;
  font-size: 12px;
  font-weight: 500;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.rev-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.deadline-area {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.color-default { color: #64748b; }
.color-danger { color: #e11d48; }
.color-warning { color: #d97706; }
.date-input {
  background: transparent;
  border: none;
  border-bottom: 1px dashed #cbd5e1;
  font-size: 12px;
  color: inherit;
  width: 165px;
  cursor: pointer;
  padding: 0;
}
.date-input:focus { outline: none; border-bottom-color: #6366f1; }
.status-tag {
  font-weight: 700;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}
.status-tag.danger { color: #e11d48; }
.status-tag.warning { color: #d97706; }
.rev-created {
  font-size: 12px;
  color: #94a3b8;
  border-left: 1px solid #e2e8f0;
  padding-left: 16px;
  white-space: nowrap;
}

/* ─── Content ─── */
.rev-content { padding: 8px; background: #fff; }
.item-list { list-style: none; }
.feedback-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}
.feedback-item:hover { background: #f8fafc; }
.item-check { margin-top: 2px; }
.item-body { flex: 1; min-width: 0; }
.item-text {
  font-size: 13px;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}
.item-text.resolved { text-decoration: line-through; color: #9ca3af; }

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
  border: 1px solid #e2e8f0;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.attach-thumb:hover {
  border-color: #6366f1;
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
  background: #f1f5f9;
}
.attach-name {
  display: block;
  font-size: 10px;
  color: #64748b;
  padding: 3px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #f8fafc;
}

/* Archive button on attachment */
.archive-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e2e8f0;
  color: #6366f1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 3;
}
.attach-thumb-wrap:hover .archive-btn { opacity: 1; }
.archive-btn:hover { background: #eef2ff; }

.item-delete {
  opacity: 0;
  padding: 4px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.feedback-item:hover .item-delete { opacity: 1; }
.item-delete:hover { color: #e11d48; background: #fff1f2; }

/* ─── Pending files ─── */
.pending-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  background: #f0fdf4;
  border: 1px dashed #86efac;
  border-radius: 8px;
}
.pending-file {
  position: relative;
  width: 88px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #d1fae5;
  background: #fff;
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
  background: #f1f5f9;
}
.pending-name {
  display: block;
  font-size: 10px;
  color: #475569;
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
  border-top: 1px solid #f1f5f9;
  position: relative;
  transition: background 0.2s;
}
.input-area.input-drag-over {
  background: #eef2ff;
}
.input-drag-overlay {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.06);
  border: 2px dashed #6366f1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 500;
  z-index: 5;
  pointer-events: none;
}
.input-wrap { position: relative; }
.input-wrap textarea {
  width: 100%;
  font-size: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  padding-right: 44px;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}
.input-wrap textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}
.input-wrap textarea::placeholder { color: #94a3b8; }
.send-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 6px;
  background: #e0e7ff;
  color: #4338ca;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.send-btn:hover { background: #c7d2fe; }
.input-hint {
  font-size: 10px;
  color: #94a3b8;
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
  color: #475569;
}

/* ─── Delivery Section ─── */
.delivery-section {
  margin-top: 4px;
  padding: 12px;
  border-top: 2px dashed #e2e8f0;
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
  font-size: 13px;
  font-weight: 600;
  color: #059669;
}

.delivery-body {
  position: relative;
  background: #f0fdf4;
  border: 1.5px solid #bbf7d0;
  border-radius: 10px;
  padding: 12px;
  min-height: 60px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.delivery-body.delivery-drag-over {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  background: #dcfce7;
}

.delivery-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  color: #94a3b8;
  font-size: 12px;
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
  background: #fff;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 180px;
  max-width: 280px;
  flex: 1;
}
.delivery-file:hover {
  background: #ecfdf5;
  border-color: #6ee7b7;
}

.delivery-file-icon {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: #f0fdf4;
  border: 1px solid #d1fae5;
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
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delivery-file-meta {
  font-size: 10px;
  color: #94a3b8;
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
  background: rgba(16, 185, 129, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #059669;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2;
}
</style>
