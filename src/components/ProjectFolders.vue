<template>
  <div class="project-folders">
    <div class="folders-header">
      <h3 class="folders-title">
        <el-icon :size="18" color="#6366f1"><Folder /></el-icon>
        项目文件区
      </h3>
      <div class="folders-header-actions">
        <el-button text size="small" @click="refreshAll">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
    </div>

    <div v-if="!folderPath" class="folders-empty">
      <el-icon :size="24" color="#cbd5e1"><FolderRemove /></el-icon>
      <p>未关联项目文件夹，请先在设置中配置根目录并重建项目。</p>
    </div>

    <div v-else class="folders-grid" :class="'cols-' + folders.length">
      <div
        v-for="folder in folders"
        :key="folder.key"
        class="folder-card"
        :class="{ 'drag-over': folder.isDragOver }"
        @dragover.prevent.stop="onDragOver(folder)"
        @dragleave.stop="onDragLeave(folder, $event)"
        @drop.prevent.stop="onDrop(folder, $event)"
        @dblclick="openInFinder(folder.path)"
      >
        <div class="card-body">
          <div class="card-icon" :style="{ background: folder.color + '14' }">
            <el-icon :size="28" :color="folder.color"><Folder /></el-icon>
          </div>
          <span class="card-name">{{ folder.label }}</span>
        </div>

        <div class="card-footer">
          <el-button text size="small" @click.stop="openInFinder(folder.path)">
            <el-icon :size="14"><FolderOpened /></el-icon> 打开
          </el-button>
          <el-dropdown trigger="click" size="small" @command="(cmd) => handleImport(folder, cmd)">
            <el-button text size="small" @click.stop>
              <el-icon :size="14"><Upload /></el-icon> 导入
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="files">
                  <el-icon :size="14"><Document /></el-icon> 导入文件
                </el-dropdown-item>
                <el-dropdown-item command="folders">
                  <el-icon :size="14"><Folder /></el-icon> 导入文件夹
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- Drag overlay -->
        <div v-show="folder.isDragOver" class="drag-overlay">
          <el-icon :size="32"><Upload /></el-icon>
          <span>松开以归档到此文件夹</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  folderPath: String,
  includesDesign: Boolean,
  orderType: { type: String, default: 'thesis' },
})
const api = window.electronAPI

const thesisFolderDefs = [
  { key: 'design', label: '设计文件', subPath: '设计文件', color: '#8b5cf6', designOnly: true },
  { key: 'paper', label: '论文稿件', subPath: '论文文件/论文稿件', color: '#6366f1' },
  { key: 'translation', label: '外文翻译', subPath: '论文文件/外文翻译', color: '#0ea5e9' },
  { key: 'requirements', label: '需求文件', subPath: '客户提供的需求文件', color: '#f59e0b' },
]

const formatFolderDefs = [
  { key: 'source', label: '客户源文件', subPath: '客户源文件', color: '#6366f1' },
  { key: 'output', label: '修改后文件', subPath: '修改后文件', color: '#10b981' },
  { key: 'requirements', label: '客户要求', subPath: '客户要求', color: '#f59e0b' },
]

const translationFolderDefs = [
  { key: 'source', label: '源文件', subPath: '源文件', color: '#6366f1' },
  { key: 'delivery', label: '交付文件', subPath: '交付文件', color: '#10b981' },
]

const folders = ref([])

function buildFolders() {
  const base = props.folderPath
  if (!base) { folders.value = []; return }
  const defsMap = { thesis: thesisFolderDefs, format: formatFolderDefs, translation: translationFolderDefs }
  const defs = defsMap[props.orderType] || thesisFolderDefs
  folders.value = defs
    .filter(d => !d.designOnly || props.includesDesign)
    .map(d => reactive({
      ...d,
      path: `${base}/${d.subPath}`.replace(/\\/g, '/'),
      fileCount: 0,
      isDragOver: false,
    }))
  refreshAll()
}

async function refreshAll() {
  for (const f of folders.value) await refreshFolder(f)
}

async function refreshFolder(folder) {
  const r = await api.listFolderContents(folder.path)
  if (r.success) {
    folder.fileCount = r.files.filter(f => !f.isDirectory).length
  } else {
    folder.fileCount = 0
  }
}

const dragCounters = new Map()

function onDragOver(folder) {
  if (!dragCounters.has(folder.key)) dragCounters.set(folder.key, 0)
  dragCounters.set(folder.key, dragCounters.get(folder.key) + 1)
  folder.isDragOver = true
}

function onDragLeave(folder, event) {
  const card = event.currentTarget
  if (card && card.contains(event.relatedTarget)) return
  dragCounters.set(folder.key, 0)
  folder.isDragOver = false
}

function extractPathsFromUriList(dataTransfer) {
  const paths = []
  try {
    const uriList = dataTransfer.getData('text/uri-list')
    if (uriList) {
      for (const line of uriList.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          try {
            const url = new URL(trimmed)
            if (url.protocol === 'file:') {
              let p = decodeURIComponent(url.pathname)
              if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1)
              paths.push(p)
            }
          } catch {}
        }
      }
    }
  } catch {}
  return paths
}

async function onDrop(folder, event) {
  dragCounters.set(folder.key, 0)
  folder.isDragOver = false

  const pathSet = new Set()

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    for (const f of files) {
      const p = api.getPathForFile ? api.getPathForFile(f) : f.path
      if (p) pathSet.add(p)
    }
  }

  const uriPaths = extractPathsFromUriList(event.dataTransfer)
  uriPaths.forEach(p => pathSet.add(p))

  if (pathSet.size === 0) {
    ElMessage.info('未能自动获取路径，正在打开选择对话框…')
    try {
      const selected = await api.selectItems('both')
      if (selected && selected.length > 0) {
        selected.forEach(p => pathSet.add(p))
      }
    } catch (err) {
      console.error('[ProjectFolders] selectItems fallback error:', err)
    }
  }

  if (pathSet.size === 0) {
    ElMessage.warning('未选择任何文件或文件夹')
    return
  }

  await copyToFolder([...pathSet], folder)
}

async function handleImport(folder, mode) {
  try {
    const selected = await api.selectItems(mode)
    if (!selected || selected.length === 0) return
    await copyToFolder(selected, folder)
  } catch (err) {
    ElMessage.error('导入出错: ' + (err.message || err))
  }
}

async function copyToFolder(paths, folder) {
  try {
    const r = await api.copyFilesToFolder(paths, folder.path)
    if (r.success) {
      const count = r.copied.length
      ElMessage.success(`已归档 ${count} 个项目到「${folder.label}」`)
      await refreshFolder(folder)
    } else {
      ElMessage.error('归档失败: ' + r.error)
    }
  } catch (err) {
    ElMessage.error('归档出错: ' + (err.message || err))
    console.error('[ProjectFolders] copyToFolder error:', err)
  }
}

async function openInFinder(folderPath) {
  await api.openFolder(folderPath)
}


watch(() => props.folderPath, buildFolders, { immediate: true })
watch(() => props.includesDesign, buildFolders)
watch(() => props.orderType, buildFolders)

defineExpose({ refreshAll, getFolderDefs: () => folders.value })
</script>

<style scoped>
.project-folders {
  margin-bottom: 24px;
}

.folders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.folders-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.folders-empty {
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

.folders-grid {
  display: grid;
  gap: 14px;
}
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.cols-3 { grid-template-columns: repeat(3, 1fr); }
.cols-2 { grid-template-columns: repeat(2, 1fr); }

.folder-card {
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  min-height: 160px;
}
.folder-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.folder-card.drag-over {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), 0 4px 16px rgba(99, 102, 241, 0.1);
  background: #eef2ff;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0 4px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.2px;
}

.card-count {
  font-size: 12px;
  color: #94a3b8;
}

.folders-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-footer {
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
