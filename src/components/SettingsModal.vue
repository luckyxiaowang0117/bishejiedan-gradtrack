<template>
  <el-dialog
    v-model="dialogVisible"
    title="设置"
    width="var(--gt-dialog-lg)"
    align-center
    :close-on-click-modal="false"
    :destroy-on-close="false"
    :before-close="beforeDialogClose"
    class="settings-dialog"
  >
    <div class="settings-body">
      <!-- Section 1: Root Directory -->
      <div class="settings-section">
        <div class="section-header">
          <el-icon :size="18" color="#409eff"><FolderOpened /></el-icon>
          <div>
            <div class="section-title">项目文件夹根目录</div>
            <div class="section-desc">新建订单时，将在此目录下自动创建专属项目文件夹</div>
          </div>
        </div>
        <div class="dir-row">
          <el-input :model-value="rootDir" readonly placeholder="未设置" />
          <el-button type="primary" plain @click="handleSelectDir">
            <el-icon><FolderOpened /></el-icon> 选择目录
          </el-button>
        </div>
        <el-alert v-if="!rootDir" title="建议在创建第一个订单前配置此项，否则不会自动生成项目文件夹。" type="warning" show-icon :closable="false" class="settings-alert" />
      </div>

      <!-- Section 2: Auto Launch -->
      <div class="settings-section">
        <div class="section-header">
          <el-icon :size="18" color="#67c23a"><Monitor /></el-icon>
          <div>
            <div class="section-title">开机自启动</div>
            <div class="section-desc">系统启动时自动运行本应用，支持 macOS 和 Windows</div>
          </div>
        </div>
        <div class="auto-launch-row">
          <el-switch v-model="autoLaunch" @change="handleAutoLaunchChange" />
          <span class="auto-launch-text">{{ autoLaunch ? '已开启' : '已关闭' }}</span>
        </div>
      </div>

      <!-- Section 3: Privacy Protection -->
      <div class="settings-section privacy-section">
        <div class="section-header">
          <el-icon :size="18" color="#4f46e5"><Lock /></el-icon>
          <div>
            <div class="section-title">隐私保护</div>
            <div class="section-desc">保留账号记忆，但进入主界面前按需验证当前账号密码</div>
          </div>
        </div>
        <div class="privacy-options">
          <div class="privacy-row">
            <div>
              <div class="privacy-title">启动时验证密码</div>
              <div class="privacy-desc">开机自启或手动启动后，需要输入当前账号密码才能进入主界面</div>
            </div>
            <el-switch v-model="requirePasswordOnStartup" @change="handlePrivacySettingChange('requirePasswordOnStartup', $event)" />
          </div>
          <div class="privacy-row">
            <div>
              <div class="privacy-title">后台恢复时验证密码</div>
              <div class="privacy-desc">软件隐藏到后台后，通过托盘、桌面快捷方式或开始菜单重新打开时需要输入密码</div>
            </div>
            <el-switch v-model="requirePasswordOnTrayRestore" @change="handlePrivacySettingChange('requirePasswordOnTrayRestore', $event)" />
          </div>
        </div>
      </div>

      <!-- Section 4: Order Detail Preference -->
      <div class="settings-section">
        <div class="section-header">
          <el-icon :size="18" color="#6366f1"><SetUp /></el-icon>
          <div>
            <div class="section-title">订单详情默认状态</div>
            <div class="section-desc">控制打开订单时右侧详细信息默认折叠或展开</div>
          </div>
        </div>
        <div class="preference-row">
          <el-radio-group v-model="orderInfoDefaultExpanded" @change="handleOrderInfoDefaultChange">
            <el-radio-button :value="false">默认折叠</el-radio-button>
            <el-radio-button :value="true">默认展开</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- Section 5: Syncthing Sync -->
      <div class="settings-section sync-section">
        <div class="section-header">
          <el-icon :size="18" color="#0f766e"><RefreshRight /></el-icon>
          <div>
            <div class="section-title">一键同步（Syncthing）</div>
            <div class="section-desc">先等 Syncthing 完成目录同步，再点击这里将交换目录中的变更与本机数据库对账合并</div>
          </div>
        </div>

        <div class="dir-row">
          <el-input :model-value="syncDir" readonly placeholder="未设置同步目录" />
          <el-button type="primary" plain @click="handleSelectSyncDir">
            <el-icon><FolderOpened /></el-icon> 选择目录
          </el-button>
        </div>

        <div class="sync-meta-grid">
          <div class="sync-meta-card">
            <div class="sync-meta-label">上次同步时间</div>
            <div class="sync-meta-value">{{ formattedLastSyncAt }}</div>
          </div>
          <div class="sync-meta-card">
            <div class="sync-meta-label">同步状态</div>
            <div class="sync-meta-value">{{ syncOverview.status || '未设置' }}</div>
          </div>
        </div>

        <el-alert
          :title="syncOverview.hint || '请先选择同步目录。'"
          :type="syncDir ? 'info' : 'warning'"
          show-icon
          :closable="false"
          class="settings-alert"
        />

        <div class="sync-summary">
          <div class="sync-summary-title">同步状态说明</div>
          <div class="sync-summary-text">{{ syncOverview.summary?.text || '自上次同步后，本机暂无重要新增记录' }}</div>
          <div v-if="(syncOverview.summary?.details || []).length > 0" class="sync-summary-list">
            <div v-for="detail in syncOverview.summary.details" :key="detail.title" class="sync-summary-item">
              <span class="sync-summary-item-title">{{ detail.title }} {{ detail.count }} 条</span>
              <span class="sync-summary-item-body">：{{ detail.items.join('、') }}<template v-if="detail.count > detail.items.length"> 等</template></span>
            </div>
          </div>
        </div>

        <div class="migration-actions">
          <el-button type="success" :loading="syncBusy" @click="handleRunSync">
            <el-icon><RefreshRight /></el-icon> 立即同步
          </el-button>
          <el-button plain :disabled="syncBusy" @click="loadSyncOverview">刷新状态</el-button>
        </div>
      </div>

      <!-- Section 6: Design Type Management -->
      <div class="settings-section">
        <div class="section-header">
          <el-icon :size="18" color="#8b5cf6"><SetUp /></el-icon>
          <div>
            <div class="section-title">设计类型管理</div>
            <div class="section-desc">自定义设计类型、来源/子类型及状态选项</div>
          </div>
        </div>

        <div class="dt-list">
          <div v-for="dt in designTypes" :key="dt.id" class="dt-card">
            <div class="dt-card-header">
              <el-input v-model="dt.typeName" size="small" class="dt-name-input" @blur="saveDT(dt)" />
              <el-button text type="danger" size="small" @click="removeDT(dt.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>

            <!-- Sub types (if any) -->
            <div v-if="dt.subTypes.length > 0" class="dt-sub-section">
              <div class="dt-sub-label">子类型（各有独立状态）:</div>
              <div v-for="(sub, si) in dt.subTypes" :key="si" class="dt-sub-row">
                <el-input v-model="sub.name" size="small" placeholder="子类型名称" class="dt-sub-name" @blur="saveDT(dt)" />
                <div class="dt-tags-wrap">
                  <el-tag v-for="(s, idx) in sub.statuses" :key="idx" closable size="small" @close="removeSubStatus(dt, si, idx)">{{ s }}</el-tag>
                  <el-input v-if="sub._adding" v-model="sub._newVal" size="small" class="dt-tag-input" @keydown.enter="confirmSubStatus(dt, sub)" @blur="confirmSubStatus(dt, sub)" placeholder="回车确认" />
                  <el-button v-else text size="small" @click="sub._adding = true">+ 状态</el-button>
                </div>
                <el-button text type="danger" size="small" @click="removeSubType(dt, si)"><el-icon :size="12"><Close /></el-icon></el-button>
              </div>
              <el-button text size="small" @click="addSubType(dt)">+ 添加子类型</el-button>
            </div>

            <!-- Direct statuses (when no sub types) -->
            <div v-else class="dt-status-section">
              <div class="dt-sub-label">状态选项:</div>
              <div class="dt-tags-wrap">
                <el-tag v-for="(s, idx) in dt.statuses" :key="idx" closable size="small" @close="removeStatus(dt, idx)">{{ s }}</el-tag>
                <el-input v-if="dt._adding" v-model="dt._newVal" size="small" class="dt-tag-input" @keydown.enter="confirmStatus(dt)" @blur="confirmStatus(dt)" placeholder="回车确认" />
                <el-button v-else text size="small" @click="dt._adding = true">+ 状态</el-button>
              </div>
              <el-button text size="small" style="margin-top: 6px" @click="convertToSubTypes(dt)">切换为子类型模式</el-button>
            </div>
          </div>
        </div>

        <el-button size="small" @click="addDT" style="margin-top: 8px">
          <el-icon><Plus /></el-icon> 添加设计类型
        </el-button>
      </div>
      <!-- Section 7: Change Password -->
      <div class="settings-section">
        <div class="section-header">
          <el-icon :size="18" color="#f59e0b"><Lock /></el-icon>
          <div>
            <div class="section-title">修改登录密码</div>
            <div class="section-desc">修改当前账号的登录密码</div>
          </div>
        </div>
        <el-form :model="pwdForm" label-width="80px" size="default">
          <el-form-item label="原密码">
            <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码" />
          </el-form-item>
          <el-form-item label="确认密码">
            <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="pwdLoading" @click="handleChangePassword">确认修改</el-button>
            <el-button @click="resetPwdForm">清空</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Section 8: Data Migration -->
      <div class="settings-section migration-section">
        <div class="section-header">
          <el-icon :size="18" color="#2563eb"><UploadFilled /></el-icon>
          <div>
            <div class="section-title">多机数据迁移</div>
            <div class="section-desc">A 机先导出，再同步订单文件夹，B 机导入后自动重映射路径</div>
          </div>
        </div>
        <div class="migration-note">
          导入会覆盖当前账号下的订单数据，请先确认当前账号正确，并且网盘已同步完成。
        </div>
        <div class="migration-actions">
          <el-button type="primary" plain :loading="migrationBusy" @click="handleExportMigration">
            <el-icon><Download /></el-icon> 导出迁移文件
          </el-button>
          <el-button type="warning" plain :loading="migrationBusy" @click="handleImportMigration">
            <el-icon><Upload /></el-icon> 导入迁移文件
          </el-button>
        </div>
      </div>

      <!-- Section 9: Folder Migration -->
      <div class="settings-section folder-migration-section">
        <div class="section-header">
          <el-icon :size="18" color="#7c3aed"><FolderOpened /></el-icon>
          <div>
            <div class="section-title">历史文件夹按毕业届整理</div>
            <div class="section-desc">将旧结构项目复制到“毕业届/业务类型/学校/专业”目录，并同步更新数据库路径</div>
          </div>
        </div>
        <div class="migration-note">
          执行前会先生成预览；迁移会复制资料到新目录并保留旧目录，确认无误后可手动清理旧文件夹。
        </div>
        <div class="migration-actions">
          <el-button type="primary" plain :loading="folderMigrationBusy" @click="handlePreviewGraduationMigration">
            <el-icon><View /></el-icon> 预览可迁移项目
          </el-button>
        </div>
      </div>

      <!-- Section 10: Reset Data -->
      <div class="settings-section reset-section">
        <div class="section-header">
          <el-icon :size="18" color="#e11d48"><WarnTriangleFilled /></el-icon>
          <div>
            <div class="section-title" style="color: #e11d48">危险操作 — 一键重置数据</div>
            <div class="section-desc">清空所有订单、用户、设置等数据，此操作不可恢复</div>
          </div>
        </div>
        <el-button type="danger" plain @click="handleReset">
          <el-icon><Delete /></el-icon> 重置所有数据
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="handleFinish">完成</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="missingFolderDialogVisible"
    title="导入完成（部分路径缺失）"
    width="var(--gt-dialog-xl)"
    align-center
    :close-on-click-modal="false"
    class="missing-folder-dialog"
  >
    <div class="missing-dialog-body">
      <el-alert
        type="warning"
        show-icon
        :closable="false"
        title="以下订单的文件夹路径未找到，请检查网盘是否已同步或路径是否正确。"
      />

      <div class="missing-toolbar">
        <div class="missing-count">共 {{ missingOrderFolders.length }} 条缺失记录</div>
        <el-button size="small" plain @click="copyAllMissingPaths">一键复制全部路径</el-button>
      </div>

      <div class="missing-list">
        <div v-for="(item, idx) in missingOrderFolders" :key="`${item.path}-${idx}`" class="missing-item">
          <div class="missing-item-header">
            <div class="missing-item-title">{{ idx + 1 }}. {{ item.title || '未命名订单' }}</div>
            <el-button size="small" text type="primary" @click="copyMissingPath(item.path)">复制路径</el-button>
          </div>
          <div class="missing-item-path" :title="item.path">{{ item.path }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="missingFolderDialogVisible = false">我知道了</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="folderMigrationDialogVisible"
    title="历史文件夹迁移预览"
    width="var(--gt-dialog-xl)"
    align-center
    :close-on-click-modal="false"
    class="folder-migration-dialog"
  >
    <div class="folder-migration-body">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="迁移执行时会复制文件夹并更新数据库路径，旧文件夹会保留。"
      />

      <div class="folder-migration-summary">
        <div>
          <span class="summary-num">{{ folderMigrationPreview?.summary?.migratableCount || 0 }}</span>
          <span class="summary-label">可迁移</span>
        </div>
        <div>
          <span class="summary-num muted">{{ folderMigrationPreview?.summary?.skippedCount || 0 }}</span>
          <span class="summary-label">已跳过</span>
        </div>
      </div>

      <div v-if="(folderMigrationPreview?.items || []).length > 0" class="folder-migration-list">
        <div v-for="item in folderMigrationPreview.items" :key="item.orderId" class="folder-migration-item">
          <div class="folder-migration-title">{{ item.title }} <span>{{ item.graduationYear }}届</span></div>
          <div class="path-line">
            <span>旧</span>
            <code>{{ item.oldPath }}</code>
          </div>
          <div class="path-line">
            <span>新</span>
            <code>{{ item.newPath }}</code>
          </div>
        </div>
      </div>
      <el-empty v-else description="当前没有需要迁移的项目文件夹" />

      <el-collapse v-if="(folderMigrationPreview?.skipped || []).length > 0" class="folder-migration-skipped">
        <el-collapse-item :title="`查看跳过项目（${folderMigrationPreview.skipped.length}）`" name="skipped">
          <div class="skipped-list">
            <div v-for="item in folderMigrationPreview.skipped" :key="`${item.orderId}-${item.reason}`" class="skipped-item">
              <div class="skipped-title">{{ item.title }}</div>
              <div class="skipped-reason">{{ getFolderMigrationReason(item.reason) }}<template v-if="item.detail">：{{ item.detail }}</template></div>
              <div v-if="item.oldPath" class="skipped-path">{{ item.oldPath }}</div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <template #footer>
      <el-button @click="folderMigrationDialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="!(folderMigrationPreview?.items || []).length"
        :loading="folderMigrationBusy"
        @click="handleRunGraduationMigration"
      >
        确认执行迁移
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({ visible: Boolean, currentUser: Object })
const emit = defineEmits(['update:visible', 'reset', 'imported', 'order-info-default-change'])

const api = window.electronAPI
const rootDir = ref('')
const syncDir = ref('')
const autoLaunch = ref(false)
const requirePasswordOnStartup = ref(false)
const requirePasswordOnTrayRestore = ref(false)
const orderInfoDefaultExpanded = ref(false)
const designTypes = ref([])
const migrationBusy = ref(false)
const syncBusy = ref(false)
const folderMigrationBusy = ref(false)
const folderMigrationDialogVisible = ref(false)
const folderMigrationPreview = ref(null)
const missingFolderDialogVisible = ref(false)
const missingOrderFolders = ref([])
const syncOverview = ref({
  status: '未设置同步目录',
  lastSyncAt: '',
  summary: { totalCount: 0, details: [], text: '自上次同步后，本机暂无重要新增记录' },
  hint: '',
})

const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const formattedLastSyncAt = computed(() => {
  const value = syncOverview.value?.lastSyncAt
  if (!value) return '尚未同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
})

const folderMigrationReasonMap = {
  EMPTY_PATH: '未关联项目文件夹',
  NO_GRADUATION_YEAR: '缺少毕业届',
  SOURCE_NOT_FOUND: '原文件夹不存在',
  OUTSIDE_ROOT: '不在当前根目录下',
  ALREADY_MIGRATED: '已在毕业届目录中',
  SAME_PATH: '新旧路径一致',
  TARGET_EXISTS: '目标文件夹已存在',
}

function getFolderMigrationReason(reason) {
  return folderMigrationReasonMap[reason] || reason || '未知原因'
}

function resetPwdForm() {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

async function handleChangePassword() {
  const { oldPassword, newPassword, confirmPassword } = pwdForm.value
  if (!oldPassword || !newPassword || !confirmPassword) {
    ElMessage.warning('请填写所有密码字段')
    return
  }
  if (newPassword !== confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }
  if (newPassword.length < 4) {
    ElMessage.warning('新密码长度不能少于4位')
    return
  }
  if (!props.currentUser || !props.currentUser.id) {
    ElMessage.error('未获取到用户信息，请重新登录')
    return
  }
  pwdLoading.value = true
  try {
    const result = await api.changePassword(props.currentUser.id, oldPassword, newPassword)
    if (result.success) {
      ElMessage.success('密码修改成功')
      resetPwdForm()
    } else {
      ElMessage.error(result.error || '修改失败')
    }
  } finally {
    pwdLoading.value = false
  }
}

async function loadData() {
  const val = await api.getSetting('rootDirectory')
  rootDir.value = val || ''
  syncDir.value = await api.getSetting('syncDirectory') || ''
  requirePasswordOnStartup.value = await api.getSetting('requirePasswordOnStartup') === '1'
  requirePasswordOnTrayRestore.value = await api.getSetting('requirePasswordOnTrayRestore') === '1'
  orderInfoDefaultExpanded.value = await api.getSetting('orderInfoDefaultExpanded') === '1'
  autoLaunch.value = await api.getAutoLaunch()
  const rows = await api.listDesignTypes()
  designTypes.value = rows.map(r => ({
    ...r,
    subTypes: JSON.parse(r.subTypes || '[]').map(s => ({ ...s, _adding: false, _newVal: '' })),
    statuses: JSON.parse(r.statuses || '[]'),
    _adding: false, _newVal: '',
  }))
  await loadSyncOverview()
}

watch(() => props.visible, (val) => {
  if (val) {
    loadData()
    resetPwdForm()
  }
})

async function handleAutoLaunchChange(val) {
  await api.setAutoLaunch(val)
  ElMessage.success(val ? '已开启开机自启动' : '已关闭开机自启动')
}

async function handlePrivacySettingChange(key, val) {
  await api.setSetting(key, val ? '1' : '0')
  ElMessage.success(val ? '已开启密码验证' : '已关闭密码验证')
}

async function handleOrderInfoDefaultChange(val) {
  await api.setSetting('orderInfoDefaultExpanded', val ? '1' : '0')
  emit('order-info-default-change', !!val)
  ElMessage.success(val ? '订单详情将默认展开' : '订单详情将默认折叠')
}

async function persistPendingChanges() {
  // 1. 收集所有正在编辑但未确认的输入
  for (const dt of designTypes.value) {
    if (dt._adding) {
      const val = (dt._newVal || '').trim()
      dt._newVal = ''
      dt._adding = false
      if (val && !dt.statuses.includes(val)) {
        dt.statuses.push(val)
      }
    }
    for (const sub of dt.subTypes) {
      if (sub._adding) {
        const val = (sub._newVal || '').trim()
        sub._newVal = ''
        sub._adding = false
        if (val && !sub.statuses.includes(val)) {
          sub.statuses.push(val)
        }
      }
    }
  }
  // 2. 逐个保存所有设计类型
  for (const dt of designTypes.value) {
    try {
      await saveDT(dt)
    } catch (e) {
      console.error('[SettingsModal] 保存失败, id=', dt.id, e)
    }
  }
  // 3. 重新从数据库加载，验证持久化成功
  await loadData()
}

async function beforeDialogClose(done) {
  await persistPendingChanges()
  done()
}

async function handleFinish() {
  await persistPendingChanges()
  emit('update:visible', false)
}

async function handleReset() {
  try {
    const { value } = await ElMessageBox.prompt(
      '此操作将清空所有订单、用户、设置等数据，且不可恢复。请输入超级密码以确认操作：',
      '一键重置数据',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPlaceholder: '请输入超级密码',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )
    if (!value || !value.trim()) {
      ElMessage.warning('请输入超级密码')
      return
    }
    const result = await api.resetAll(value.trim())
    if (!result.success) {
      ElMessage.error(result.error || '重置失败')
      return
    }
    ElMessage.success('数据已全部重置')
    emit('update:visible', false)
    emit('reset')
  } catch {}
}

async function handleSelectDir() {
  const dir = await api.selectDirectory()
  if (dir) {
    rootDir.value = dir
    await api.setSetting('rootDirectory', dir)
  }
}

async function loadSyncOverview() {
  if (!props.currentUser?.id) return
  syncOverview.value = await api.getSyncOverview(props.currentUser.id)
  syncDir.value = syncOverview.value?.syncDirectory || syncDir.value || ''
}

async function handleSelectSyncDir() {
  const dir = await api.selectDirectory()
  if (!dir) return
  syncDir.value = dir
  await api.setSetting('syncDirectory', dir)
  await loadSyncOverview()
  ElMessage.success('同步目录已更新')
}

async function handleRunSync() {
  if (!props.currentUser?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  if (!syncDir.value) {
    ElMessage.warning('请先设置同步目录')
    return
  }
  syncBusy.value = true
  try {
    const result = await api.runSync(props.currentUser.id)
    if (!result?.success) {
      const errorTextMap = {
        INVALID_USER: '当前用户无效，请重新登录',
        SYNC_DIR_NOT_SET: '请先设置同步目录',
      }
      ElMessage.error(errorTextMap[result?.error] || result?.error || '同步失败')
      return
    }
    syncOverview.value = result.overview || syncOverview.value
    syncDir.value = syncOverview.value?.syncDirectory || syncDir.value
    ElMessage.success(`同步完成：导入 ${result.imported} 条，导出 ${result.exported} 条`)
  } finally {
    syncBusy.value = false
  }
}

async function handleExportMigration() {
  if (!props.currentUser?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  migrationBusy.value = true
  try {
    const result = await api.exportMigration(props.currentUser.id)
    if (!result || result.cancelled) return
    if (!result.success) {
      ElMessage.error(result.error || '导出失败')
      return
    }
    ElMessage.success(`导出成功：${result.summary.orderCount} 个订单`)
  } finally {
    migrationBusy.value = false
  }
}

async function handleImportMigration() {
  if (!props.currentUser?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  const filePath = await api.selectMigrationFile()
  if (!filePath) return
  const newRoot = await api.selectDirectory()
  if (!newRoot) return
  try {
    await ElMessageBox.confirm(
      '导入后将覆盖当前账号下已有订单、轮次与反馈数据。请确认网盘文件夹已同步完毕。',
      '确认导入',
      { type: 'warning', confirmButtonText: '确认导入', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  migrationBusy.value = true
  try {
    const result = await api.importMigration({
      filePath,
      newRoot,
      currentUserId: props.currentUser.id,
    })
    if (!result.success) {
      const errorTextMap = {
        INVALID_PARAMS: '导入参数无效',
        FILE_NOT_FOUND: '迁移文件不存在',
        INVALID_FILE_FORMAT: '迁移文件格式错误',
        UNSUPPORTED_FORMAT: '迁移文件版本不兼容',
        MISSING_OLD_ROOT: '迁移文件缺少原始根目录，请重新导出',
      }
      ElMessage.error(errorTextMap[result.error] || result.error || '导入失败')
      return
    }
    rootDir.value = newRoot
    const missing = (result.missingPaths || []).length
    const missingList = Array.isArray(result.missingOrderFolders) ? result.missingOrderFolders : []
    ElMessage.success(`导入成功：${result.summary.orderCount} 个订单${missing ? `，${missing} 条路径未找到` : ''}`)
    if (missingList.length > 0) {
      missingOrderFolders.value = missingList
      missingFolderDialogVisible.value = true
    }
    emit('imported')
  } finally {
    migrationBusy.value = false
  }
}

async function handlePreviewGraduationMigration() {
  if (!props.currentUser?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  folderMigrationBusy.value = true
  try {
    const result = await api.previewGraduationFolderMigration(props.currentUser.id)
    if (!result?.success) {
      const errorTextMap = {
        INVALID_USER: '当前用户无效，请重新登录',
        ROOT_DIR_NOT_SET: '请先设置项目文件夹根目录',
      }
      ElMessage.error(errorTextMap[result?.error] || result?.error || '生成预览失败')
      return
    }
    folderMigrationPreview.value = result
    folderMigrationDialogVisible.value = true
  } finally {
    folderMigrationBusy.value = false
  }
}

async function handleRunGraduationMigration() {
  if (!props.currentUser?.id) {
    ElMessage.error('未获取到当前用户，请重新登录后重试')
    return
  }
  const count = folderMigrationPreview.value?.items?.length || 0
  if (count <= 0) return
  try {
    await ElMessageBox.confirm(
      `将复制 ${count} 个项目文件夹到毕业届目录，并更新数据库中的订单、修改轮次和附件路径。旧文件夹会保留。`,
      '确认执行迁移',
      { type: 'warning', confirmButtonText: '确认迁移', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  folderMigrationBusy.value = true
  try {
    const result = await api.runGraduationFolderMigration(props.currentUser.id)
    if (!result?.success && !result?.summary) {
      const errorTextMap = {
        INVALID_USER: '当前用户无效，请重新登录',
        ROOT_DIR_NOT_SET: '请先设置项目文件夹根目录',
      }
      ElMessage.error(errorTextMap[result?.error] || result?.error || '迁移失败')
      return
    }
    const migrated = result.summary?.migratedCount || 0
    const failed = result.summary?.failedCount || 0
    if (failed > 0) {
      ElMessage.warning(`已迁移 ${migrated} 个，${failed} 个失败，请重新预览查看剩余项目`)
    } else {
      ElMessage.success(`已迁移 ${migrated} 个项目文件夹`)
    }
    folderMigrationDialogVisible.value = false
    folderMigrationPreview.value = null
    emit('imported')
    await loadSyncOverview()
  } finally {
    folderMigrationBusy.value = false
  }
}

async function copyMissingPath(path) {
  const text = (path || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('路径已复制')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('路径已复制')
  }
}

async function copyAllMissingPaths() {
  const all = missingOrderFolders.value.map(item => item.path).filter(Boolean)
  if (all.length === 0) return
  await copyMissingPath(all.join('\n'))
}

async function saveDT(dt) {
  const plainData = JSON.parse(JSON.stringify({
    typeName: dt.typeName,
    subTypes: (dt.subTypes || []).map(s => ({ name: s.name, statuses: [...(s.statuses || [])] })),
    statuses: [...(dt.statuses || [])],
  }))
  console.log('[saveDT] id=', dt.id, 'data=', plainData)
  try {
    await api.updateDesignType(dt.id, plainData)
  } catch (e) {
    console.error('[saveDT] 保存失败, id=', dt.id, e)
    throw e
  }
}

async function addDT() {
  const id = await api.createDesignType({ typeName: '新类型', subTypes: [], statuses: ['未完成', '已完成'] })
  await loadData()
}

async function removeDT(id) {
  try {
    await ElMessageBox.confirm('确定删除该设计类型？', '删除', { type: 'warning' })
    await api.deleteDesignType(id)
    await loadData()
  } catch {}
}

function addSubType(dt) {
  dt.subTypes.push({ name: '', statuses: ['未完成', '已完成'], _adding: false, _newVal: '' })
  saveDT(dt)
}

function removeSubType(dt, idx) {
  dt.subTypes.splice(idx, 1)
  saveDT(dt)
}

function removeSubStatus(dt, subIdx, statusIdx) {
  dt.subTypes[subIdx].statuses.splice(statusIdx, 1)
  saveDT(dt)
}

function confirmSubStatus(dt, sub) {
  const val = (sub._newVal || '').trim()
  sub._newVal = ''
  sub._adding = false
  if (val && !sub.statuses.includes(val)) {
    sub.statuses.push(val)
  }
}

function removeStatus(dt, idx) {
  dt.statuses.splice(idx, 1)
  saveDT(dt)
}

function confirmStatus(dt) {
  const val = (dt._newVal || '').trim()
  dt._newVal = ''
  dt._adding = false
  if (val && !dt.statuses.includes(val)) {
    dt.statuses.push(val)
  }
}

function convertToSubTypes(dt) {
  dt.subTypes = [{ name: '默认', statuses: [...dt.statuses], _adding: false, _newVal: '' }]
  dt.statuses = []
  saveDT(dt)
}
</script>

<style scoped>
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-height: 70vh;
  overflow-y: auto;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.section-header .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.section-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.dir-row {
  display: flex;
  gap: 8px;
}
.dir-row .el-input {
  flex: 1;
}

.settings-alert {
  margin-top: 4px;
}

.sync-section {
  border: 1px solid #c7f9e5;
  border-radius: 12px;
  padding: 14px;
  background: linear-gradient(180deg, #f5fffb 0%, #f8fffd 100%);
}

.sync-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sync-meta-card {
  border: 1px solid #d1fae5;
  border-radius: 10px;
  background: #ffffff;
  padding: 12px;
}

.sync-meta-label {
  font-size: 12px;
  color: #6b7280;
}

.sync-meta-value {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #0f766e;
}

.sync-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #ffffff;
  padding: 12px;
}

.sync-summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.sync-summary-text {
  font-size: 12px;
  line-height: 1.7;
  color: #475569;
}

.sync-summary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sync-summary-item {
  font-size: 12px;
  color: #334155;
  line-height: 1.6;
}

.sync-summary-item-title {
  font-weight: 600;
}

.sync-summary-item-body {
  color: #64748b;
}

/* Auto launch */
.auto-launch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.preference-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.privacy-section {
  border: 1px solid #dbe4ff;
  border-radius: 12px;
  padding: 14px;
  background: linear-gradient(180deg, #f8faff 0%, #ffffff 100%);
}

.privacy-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.privacy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}

.privacy-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.privacy-desc {
  margin-top: 3px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.auto-launch-text {
  font-size: 13px;
  color: #606266;
}

.migration-section {
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 14px;
  background: #f8fbff;
}

.folder-migration-section {
  border: 1px solid #ede9fe;
  border-radius: 12px;
  padding: 14px;
  background: #fbfaff;
}

.migration-note {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

.migration-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-dialog :deep(.el-dialog),
.missing-folder-dialog :deep(.el-dialog),
.folder-migration-dialog :deep(.el-dialog) {
  margin: 0 !important;
}

.settings-dialog :deep(.el-dialog__body) {
  max-height: min(78vh, 760px);
  overflow: auto;
}

.missing-folder-dialog :deep(.el-dialog__body) {
  max-height: min(72vh, 640px);
  overflow: auto;
}

.folder-migration-dialog :deep(.el-dialog__body) {
  max-height: min(72vh, 640px);
  overflow: auto;
}

.missing-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.missing-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.missing-count {
  font-size: 12px;
  color: #64748b;
}

.missing-list {
  max-height: 420px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.missing-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
}

.missing-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.missing-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.missing-item-path {
  margin-top: 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #475569;
  word-break: break-all;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 8px;
}

.folder-migration-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.folder-migration-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.folder-migration-summary > div {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  padding: 12px;
}

.summary-num {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #7c3aed;
  line-height: 1;
}

.summary-num.muted {
  color: #64748b;
}

.summary-label {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.folder-migration-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
  padding-right: 4px;
}

.folder-migration-item {
  border: 1px solid #ede9fe;
  border-radius: 10px;
  background: #fbfaff;
  padding: 12px;
}

.folder-migration-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.folder-migration-title span {
  flex-shrink: 0;
  font-size: 12px;
  color: #7c3aed;
  background: #ede9fe;
  border-radius: 999px;
  padding: 2px 8px;
}

.path-line {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  margin-top: 6px;
}

.path-line span {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.path-line code {
  display: block;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: #475569;
  word-break: break-all;
  background: #ffffff;
  border: 1px dashed #ddd6fe;
  border-radius: 8px;
  padding: 7px 8px;
}

.folder-migration-skipped {
  border-top: 1px solid #f1f5f9;
}

.skipped-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skipped-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  padding: 10px;
}

.skipped-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.skipped-reason {
  margin-top: 4px;
  font-size: 12px;
  color: #7c3aed;
}

.skipped-path {
  margin-top: 4px;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  color: #64748b;
  word-break: break-all;
}

/* Reset section */
.reset-section {
  border: 1px solid #fecdd3;
  border-radius: 12px;
  padding: 16px;
  background: #fff5f5;
}

/* Design type management */
.dt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dt-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}

.dt-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.dt-name-input {
  flex: 1;
  font-weight: 600;
}

.dt-sub-section,
.dt-status-section {
  padding-left: 4px;
}

.dt-sub-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.dt-sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.dt-sub-name {
  width: 100px;
  flex-shrink: 0;
}

.dt-tags-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.dt-tag-input {
  width: 80px;
}

@media (max-width: 680px) {
  .sync-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
