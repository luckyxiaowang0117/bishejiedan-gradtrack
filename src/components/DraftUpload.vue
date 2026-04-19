<template>
  <div class="draft-upload">
    <div class="draft-header">
      <h3 class="draft-title">
        <el-icon :size="18" color="#6366f1"><Document /></el-icon>
        {{ orderType === 'translation' ? '译文交付' : '初稿交付' }}
      </h3>
      <div class="draft-header-actions">
        <el-tag v-if="files.length > 0" type="success" size="small" effect="plain" round>
          已上传 {{ files.length }} 个文件
        </el-tag>
        <el-button type="primary" text bg size="small" @click="handleSelectFiles">
          <el-icon><Upload /></el-icon> {{ orderType === 'translation' ? '上传译文' : '上传初稿' }}
        </el-button>
      </div>
    </div>

    <div v-if="!folderPath" class="draft-empty">
      <el-icon :size="24" color="#cbd5e1"><FolderRemove /></el-icon>
      <p>未关联项目文件夹，无法使用初稿交付功能。</p>
    </div>

    <div
      v-else
      class="draft-body"
      :class="{ 'is-drag-over': isDragOver }"
      @dragover.prevent.stop="onDragOver"
      @dragleave.stop="onDragLeave"
      @drop.prevent.stop="onDrop"
    >
      <div v-if="files.length === 0 && !isDragOver" class="draft-placeholder">
        <el-icon :size="32" color="#cbd5e1"><UploadFilled /></el-icon>
        <p>拖拽{{ orderType === 'translation' ? '译文' : '初稿' }}文件到此区域，或点击右上角上传按钮</p>
      </div>

      <div v-if="files.length > 0" class="file-grid">
        <div v-for="f in files" :key="f.path" class="file-card" @dblclick="openFile(f.path)">
          <div class="file-icon-wrap">
            <el-icon :size="28" :color="getFileIconColor(f.name)"><Document /></el-icon>
          </div>
          <div class="file-info">
            <span class="file-name" :title="f.name">{{ f.name }}</span>
            <span class="file-meta">{{ formatSize(f.size) }}</span>
          </div>
          <div class="file-actions">
            <el-button text size="small" @click.stop="openFile(f.path)" title="用系统程序打开">
              <el-icon :size="14"><View /></el-icon>
            </el-button>
            <el-button text size="small" @click.stop="revealFile(f.path)" title="在文件夹中显示">
              <el-icon :size="14"><FolderOpened /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div v-show="isDragOver" class="drag-overlay">
        <el-icon :size="32"><Upload /></el-icon>
        <span>松开以上传{{ orderType === 'translation' ? '译文' : '初稿' }}文件</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  folderPath: String,
  orderId: Number,
  orderType: { type: String, default: 'thesis' },
})
const emit = defineEmits(['draft-uploaded'])

const api = window.electronAPI
const currentUser = inject('currentUser')

const draftSubPathMap = {
  thesis: '论文文件/论文稿件/初稿',
  format: '修改后文件',
  translation: '交付文件',
}
const draftFolderPath = computed(() => {
  if (!props.folderPath) return ''
  const sub = draftSubPathMap[props.orderType] || draftSubPathMap.thesis
  return `${props.folderPath}/${sub}`.replace(/\\/g, '/')
})

const files = ref([])
const isDragOver = ref(false)
let dragCounter = 0

async function loadFiles() {
  if (!draftFolderPath.value) { files.value = []; return }
  await api.createFolder(draftFolderPath.value)
  const r = await api.listFolderContents(draftFolderPath.value)
  if (r.success) {
    files.value = r.files.filter(f => !f.isDirectory)
  } else {
    files.value = []
  }
}

function onDragOver() {
  dragCounter++
  isDragOver.value = true
}

function onDragLeave(event) {
  const el = event.currentTarget
  if (el && el.contains(event.relatedTarget)) return
  dragCounter = 0
  isDragOver.value = false
}

async function onDrop(event) {
  dragCounter = 0
  isDragOver.value = false

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
  await copyAndRefresh([...pathSet])
}

async function handleSelectFiles() {
  try {
    const selected = await api.selectItems('files')
    if (!selected || selected.length === 0) return
    await copyAndRefresh(selected)
  } catch (err) {
    ElMessage.error('选择文件失败: ' + (err.message || err))
  }
}

async function copyAndRefresh(paths) {
  try {
    const r = await api.copyFilesToFolder(paths, draftFolderPath.value)
    if (r.success) {
      ElMessage.success(`已上传 ${r.copied.length} 个${props.orderType === 'translation' ? '译文' : '初稿'}文件`)
      await loadFiles()
      if (props.orderId && currentUser.value && currentUser.value.id) {
        await api.updateOrder(currentUser.value.id, props.orderId, { isDraftSubmitted: 1 })
        emit('draft-uploaded')
      }
    } else {
      ElMessage.error('上传失败: ' + r.error)
    }
  } catch (err) {
    ElMessage.error('上传出错: ' + (err.message || err))
  }
}

async function openFile(filePath) {
  await api.openFileInSystem(filePath)
}

async function revealFile(filePath) {
  await api.revealInFinder(filePath)
}

function getFileIconColor(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  if (['doc', 'docx'].includes(ext)) return '#2b579a'
  if (['pdf'].includes(ext)) return '#d93025'
  if (['xls', 'xlsx'].includes(ext)) return '#217346'
  if (['ppt', 'pptx'].includes(ext)) return '#d24726'
  return '#6366f1'
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

watch(() => props.folderPath, loadFiles, { immediate: true })
</script>

<style scoped>
.draft-upload {
  margin-bottom: 24px;
}

.draft-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.draft-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-empty {
  text-align: center;
  padding: 24px;
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.draft-body {
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  position: relative;
  min-height: 100px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.draft-body.is-drag-over {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  background: #eef2ff;
}

.draft-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #94a3b8;
  font-size: 13px;
}
.draft-placeholder p {
  margin: 0;
}

.file-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 200px;
  max-width: 300px;
  flex: 1;
}
.file-card:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.file-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 11px;
  color: #94a3b8;
}

.file-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.file-card:hover .file-actions {
  opacity: 1;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  border-radius: 11px;
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #4f46e5;
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2;
}
</style>
