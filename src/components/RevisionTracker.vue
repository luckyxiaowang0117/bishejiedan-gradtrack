<template>
  <div class="tracker">
    <div class="tracker-header">
      <h3 class="tracker-title">
        <el-icon :size="18" color="#6366f1"><Connection /></el-icon>
        修改意见与迭代记录
      </h3>
      <el-button type="primary" text bg size="small" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon> 新增修改轮次
      </el-button>
    </div>

    <div v-if="revisions.length === 0" class="tracker-empty">
      目前还没有任何修改记录。
    </div>

    <div class="revision-list">
      <RevisionBlock
        v-for="revision in revisions"
        :key="revision.id"
        :revision="revision"
        :project-folders-ref="projectFoldersRef"
        @changed="$emit('changed')"
      />
    </div>

    <!-- Create revision dialog -->
    <el-dialog
      v-model="showCreateDialog"
      title="新增修改轮次"
      width="var(--gt-dialog-sm)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="create-form">
        <div class="create-field">
          <label class="create-label">轮次名称</label>
          <el-input v-model="newTitle" placeholder="自动生成" disabled size="large" />
        </div>
        <div class="create-field">
          <label class="create-label">
            截止日期
            <span class="required-mark">*</span>
          </label>
          <div class="datetime-row">
            <el-date-picker
              v-model="newDate"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              size="large"
              class="date-pick"
            />
            <el-time-picker
              v-model="newTime"
              placeholder="选择时间"
              format="HH:mm"
              value-format="HH:mm"
              size="large"
              class="time-pick"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canCreate" @click="handleCreate">
          确认创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import RevisionBlock from './RevisionBlock.vue'

const props = defineProps({ orderId: Number, revisions: Array, projectFoldersRef: Object, orderFolderPath: String })
const emit = defineEmits(['changed'])
const api = window.electronAPI

const showCreateDialog = ref(false)
const newTitle = ref('')
const newDate = ref('')
const newTime = ref('23:59')

const canCreate = computed(() => !!newDate.value)

watch(showCreateDialog, (val) => {
  if (val) {
    newTitle.value = `第 ${props.revisions.length + 1} 次修改记录`
    newDate.value = ''
    newTime.value = '23:59'
  }
})

async function handleCreate() {
  if (!newDate.value) return
  const time = newTime.value || '23:59'
  const deadline = `${newDate.value}T${time}`
  const revId = await api.createRevision(props.orderId, newTitle.value, props.orderFolderPath || '')
  await api.updateRevision(revId, { deadline })
  showCreateDialog.value = false
  emit('changed')
}
</script>

<style scoped>
.tracker {
  margin-top: 8px;
}

.tracker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tracker-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tracker-empty {
  text-align: center;
  padding: 32px;
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #94a3b8;
  font-size: 13px;
}

.revision-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.create-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.create-label {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.required-mark {
  color: #e11d48;
  margin-left: 2px;
}

.datetime-row {
  display: flex;
  gap: 10px;
}
.date-pick {
  flex: 1;
}
.time-pick {
  width: 130px;
  flex-shrink: 0;
}
</style>
