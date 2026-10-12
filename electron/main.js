const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, screen } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { initDatabase, getDb } = require('./database')

const isMac = process.platform === 'darwin'
let mainWindow
let tray = null
const DEFAULT_WINDOW_STATE = {
  width: 1360,
  height: 840,
  minWidth: 1040,
  minHeight: 600,
  isMaximized: false,
}

function getSettingValue(key) {
  const db = getDb()
  if (!db) return null
  const row = db.prepare('SELECT value FROM Settings WHERE key = ?').get(key)
  return row ? row.value : null
}

function setSettingValue(key, value) {
  const db = getDb()
  if (!db) return
  db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run(key, value)
}

function getValidatedWindowState() {
  const raw = getSettingValue('windowState')
  if (!raw) return { ...DEFAULT_WINDOW_STATE }

  try {
    const parsed = JSON.parse(raw)
    const width = Math.max(DEFAULT_WINDOW_STATE.minWidth, Number(parsed.width) || DEFAULT_WINDOW_STATE.width)
    const height = Math.max(DEFAULT_WINDOW_STATE.minHeight, Number(parsed.height) || DEFAULT_WINDOW_STATE.height)
    const state = {
      width,
      height,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : undefined,
      y: Number.isFinite(Number(parsed.y)) ? Number(parsed.y) : undefined,
      isMaximized: !!parsed.isMaximized,
      minWidth: DEFAULT_WINDOW_STATE.minWidth,
      minHeight: DEFAULT_WINDOW_STATE.minHeight,
    }

    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      const display = screen.getDisplayMatching({
        x: state.x,
        y: state.y,
        width,
        height,
      })
      const area = display.workArea
      const visible =
        state.x < area.x + area.width &&
        state.x + width > area.x &&
        state.y < area.y + area.height &&
        state.y + height > area.y

      if (!visible) {
        delete state.x
        delete state.y
      }
    }

    return state
  } catch {
    return { ...DEFAULT_WINDOW_STATE }
  }
}

function persistWindowState(win) {
  if (!win || win.isDestroyed()) return
  const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
  setSettingValue('windowState', JSON.stringify({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
  }))
}

function shouldRequirePasswordOnTrayRestore() {
  return getSettingValue('requirePasswordOnTrayRestore') === '1'
}

function showMainWindowWithRestorePrivacy() {
  if (!mainWindow) return
  if (shouldRequirePasswordOnTrayRestore()) {
    mainWindow.webContents.send('app:requireUnlock')
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showMainWindowWithRestorePrivacy()
    }
  })
}

function createWindow() {
  const savedState = getValidatedWindowState()
  const winOptions = {
    width: savedState.width,
    height: savedState.height,
    minWidth: DEFAULT_WINDOW_STATE.minWidth,
    minHeight: DEFAULT_WINDOW_STATE.minHeight,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  }

  if (isMac) {
    winOptions.titleBarStyle = 'hiddenInset'
    winOptions.trafficLightPosition = { x: 16, y: 16 }
  } else {
    winOptions.frame = false
  }

  if (Number.isFinite(savedState.x) && Number.isFinite(savedState.y)) {
    winOptions.x = savedState.x
    winOptions.y = savedState.y
  }

  mainWindow = new BrowserWindow(winOptions)

  if (savedState.isMaximized) {
    mainWindow.maximize()
  }

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  let persistTimer = null
  const schedulePersistWindowState = () => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => persistWindowState(mainWindow), 150)
  }

  mainWindow.on('resize', schedulePersistWindowState)
  mainWindow.on('move', schedulePersistWindowState)
  mainWindow.on('maximize', schedulePersistWindowState)
  mainWindow.on('unmaximize', schedulePersistWindowState)

  mainWindow.on('close', (event) => {
    persistWindowState(mainWindow)
    event.preventDefault()
    mainWindow.hide()
    if (!isMac && tray) {
      tray.displayBalloon({
        title: '接单管理助手',
        content: '程序已最小化到托盘，右键托盘图标可退出。',
        iconType: 'info',
        noSound: true,
      })
    }
  })
}

app.whenReady().then(() => {
  initDatabase()
  backfillMissingOrderCodes()
  createWindow()
  createTray()
  registerIpcHandlers()

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
})

function createTray() {
  const iconFile = isMac ? 'icon.png' : 'icon.ico'
  const candidatePaths = app.isPackaged
    ? [
        path.join(process.resourcesPath, iconFile),
      ]
    : [
        path.join(__dirname, '..', 'build', iconFile),
        path.join(app.getAppPath(), 'build', iconFile),
      ]
  let trayIcon = nativeImage.createEmpty()
  for (const p of candidatePaths) {
    try {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) {
        trayIcon = isMac ? img.resize({ width: 16, height: 16 }) : img
        break
      }
    } catch {}
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('接单管理助手')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        showMainWindowWithRestorePrivacy()
      },
    },
    { type: 'separator' },
    {
      label: '退出程序',
      click: () => {
        tray = null
        app.exit(0)
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        showMainWindowWithRestorePrivacy()
      }
    }
  })
}

function copyDirRecursive(src, dest) {
  const fs = require('fs')
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}

function normalizeRootPath(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') return ''
  const normalized = path.normalize(rootPath.trim())
  return normalized.endsWith(path.sep) ? normalized.slice(0, -1) : normalized
}

function replacePathPrefix(oldRoot, newRoot, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return targetPath || ''
  const oldNorm = normalizeRootPath(oldRoot)
  const newNorm = normalizeRootPath(newRoot)
  if (!oldNorm || !newNorm) return targetPath
  const pathNorm = path.normalize(targetPath.trim())
  const oldCheck = process.platform === 'win32' ? oldNorm.toLowerCase() : oldNorm
  const pathCheck = process.platform === 'win32' ? pathNorm.toLowerCase() : pathNorm
  if (pathCheck !== oldCheck && !pathCheck.startsWith(oldCheck + path.sep)) return targetPath
  const relative = path.relative(oldNorm, pathNorm)
  if (!relative || relative === '.') return newNorm
  if (relative.startsWith('..')) return targetPath
  return path.join(newNorm, relative)
}

function rewriteAttachmentsJson(attachmentsText, oldRoot, newRoot) {
  if (!attachmentsText) return '[]'
  try {
    const arr = JSON.parse(attachmentsText)
    if (!Array.isArray(arr)) return attachmentsText
    for (const item of arr) {
      if (item && typeof item.path === 'string') {
        item.path = replacePathPrefix(oldRoot, newRoot, item.path)
      }
    }
    return JSON.stringify(arr)
  } catch {
    return attachmentsText
  }
}

function safeJsonParse(text, fallback) {
  if (!text) return fallback
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function makeSyncId() {
  return crypto.randomUUID().replace(/-/g, '')
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeSyncUsername(username) {
  return String(username || '').trim().toLowerCase()
}

function buildSyncScopeFromUsername(username) {
  const normalized = normalizeSyncUsername(username)
  if (!normalized) return `acct-${makeSyncId()}`
  return `acct-${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`
}

function getOrderSortClause(sortMode) {
  switch (sortMode) {
    case 'deadline_desc':
      return `
        CASE WHEN o.deadline IS NULL OR o.deadline = '' THEN 1 ELSE 0 END ASC,
        datetime(o.deadline) DESC,
        datetime(o.createdAt) DESC
      `
    case 'created_desc':
      return `datetime(o.createdAt) DESC`
    case 'created_asc':
      return `datetime(o.createdAt) ASC`
    case 'amount_desc':
      return `o.totalAmount DESC, datetime(o.createdAt) DESC`
    case 'amount_asc':
      return `o.totalAmount ASC, datetime(o.createdAt) DESC`
    case 'balance_desc':
      return `
        (o.totalAmount - o.paidAmount) DESC,
        CASE WHEN o.deadline IS NULL OR o.deadline = '' THEN 1 ELSE 0 END ASC,
        datetime(o.deadline) ASC,
        datetime(o.createdAt) DESC
      `
    case 'todo_first':
      return `
        CASE WHEN overdueCount > 0 THEN 0
             WHEN pendingCount > 0 THEN 1
             ELSE 2 END ASC,
        CASE WHEN nearestRevisionDeadline IS NULL THEN 1 ELSE 0 END ASC,
        datetime(nearestRevisionDeadline) ASC,
        datetime(o.createdAt) DESC
      `
    case 'unpaid_first':
      return `
        CASE WHEN (o.totalAmount - o.paidAmount) > 0 THEN 0 ELSE 1 END ASC,
        (o.totalAmount - o.paidAmount) DESC,
        CASE WHEN o.deadline IS NULL OR o.deadline = '' THEN 1 ELSE 0 END ASC,
        datetime(o.deadline) ASC,
        datetime(o.createdAt) DESC
      `
    case 'title_missing_first':
      return `
        CASE WHEN TRIM(COALESCE(o.title, '')) = '' THEN 0 ELSE 1 END ASC,
        datetime(o.createdAt) DESC
      `
    case 'urgency_desc':
      return `
        CASE
          WHEN overdueCount > 0 THEN 0
          WHEN o.isDraftSubmitted = 0 AND o.deadline IS NOT NULL AND o.deadline != '' AND datetime(o.deadline) <= datetime('now') THEN 0
          WHEN nearestRevisionDeadline IS NOT NULL AND datetime(nearestRevisionDeadline) <= datetime('now', '+1 day') THEN 1
          WHEN o.isDraftSubmitted = 0 AND o.deadline IS NOT NULL AND o.deadline != '' AND datetime(o.deadline) <= datetime('now', '+2 day') THEN 1
          WHEN pendingCount > 0 THEN 2
          WHEN (o.totalAmount - o.paidAmount) > 0 THEN 3
          WHEN o.isDraftSubmitted = 1 AND pendingCount = 0 THEN 5
          ELSE 4
        END ASC,
        CASE WHEN nearestRevisionDeadline IS NULL THEN 1 ELSE 0 END ASC,
        datetime(nearestRevisionDeadline) ASC,
        CASE WHEN o.deadline IS NULL OR o.deadline = '' THEN 1 ELSE 0 END ASC,
        datetime(o.deadline) ASC,
        datetime(o.createdAt) DESC
      `
    case 'deadline_asc':
    default:
      return `
        CASE WHEN o.deadline IS NULL OR o.deadline = '' THEN 1 ELSE 0 END ASC,
        datetime(o.deadline) ASC,
        datetime(o.createdAt) DESC
      `
  }
}

function getOrderTypeSubDir(orderType) {
  const typeSubDirs = {
    thesis: '毕业设计',
    format: '格式修改',
    translation: '外文翻译',
    design: '毕业设计',
    reduction: '论文降重',
    special: '特殊订单',
  }
  return typeSubDirs[orderType || 'thesis'] || '毕业设计'
}

const SPECIAL_SERVICE_OPTIONS = [
  { label: '开题报告', code: 'KR' },
  { label: '图例绘制', code: 'FD' },
  { label: 'PPT制作', code: 'PP' },
  { label: '其他特殊服务', code: 'OS' },
]

function getSpecialServiceCode(specialService) {
  const service = String(specialService || '').trim()
  const matched = SPECIAL_SERVICE_OPTIONS.find(option => service === option.label)
  if (matched) return matched.code
  if (service.includes('开题')) return 'KR'
  if (service.includes('图例') || service.toLowerCase().includes('figure')) return 'FD'
  if (service.toLowerCase().includes('ppt') || service.toLowerCase().includes('powerpoint')) return 'PP'
  return 'OS'
}

function getOrderServiceCode(order) {
  const type = order.orderType || 'thesis'
  if (type === 'thesis') return Number(order.includesDesign) ? 'BS' : 'BP'
  if (type === 'format') return 'FM'
  if (type === 'translation') return 'ET'
  if (type === 'design') return 'SD'
  if (type === 'reduction') return 'PR'
  if (type === 'special') return getSpecialServiceCode(order.specialService)
  return 'OS'
}

function normalizeOrderCodeSegment(value, maxLength = 12) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength)
}

const HISTORY_FIELDS = ['university', 'college', 'major', 'receiver', 'handler', 'advisor']

function getHiddenHistoryValues(userId, field) {
  try {
    const values = JSON.parse(getSettingValue(`hiddenHistory:${userId}:${field}`) || '[]')
    return Array.isArray(values) ? values.filter(value => typeof value === 'string') : []
  } catch { return [] }
}

function getOrderCodeRule(order) {
  const fixedPrefix = normalizeOrderCodeSegment(getSettingValue('orderCodeFixedPrefix'))
  const defaultCode = getOrderServiceCode(order)
  let serviceCodes = {}
  try { serviceCodes = JSON.parse(getSettingValue('orderCodeServiceCodes') || '{}') || {} } catch {}
  return {
    fixedPrefix,
    serviceCode: normalizeOrderCodeSegment(serviceCodes[defaultCode]) || defaultCode,
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function generateNextOrderCode(userId, order, date = new Date()) {
  const database = getDb()
  const fallbackYear = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
  const year = Number(order.graduationYear) || fallbackYear
  const { fixedPrefix, serviceCode } = getOrderCodeRule(order)
  const prefix = `${fixedPrefix ? `${fixedPrefix}-` : ''}${year}-${serviceCode}-`
  const rows = database.prepare(`
    SELECT orderCode FROM Orders
    WHERE userId = ? AND orderCode LIKE ?
  `).all(userId, `${prefix}%`)
  const codePattern = new RegExp(`^${escapeRegExp(prefix)}(\\d{4})$`)
  let maxSeq = 0
  for (const row of rows) {
    const match = String(row.orderCode || '').match(codePattern)
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]) || 0)
  }

  let nextSeq = maxSeq + 1
  let nextCode = `${prefix}${String(nextSeq).padStart(4, '0')}`
  while (database.prepare('SELECT id FROM Orders WHERE userId = ? AND orderCode = ?').get(userId, nextCode)) {
    nextSeq += 1
    nextCode = `${prefix}${String(nextSeq).padStart(4, '0')}`
  }
  return nextCode
}

function backfillMissingOrderCodes() {
  const database = getDb()
  const rows = database.prepare(`
    SELECT * FROM Orders
    WHERE userId IS NOT NULL AND (orderCode IS NULL OR orderCode = '')
    ORDER BY userId ASC, datetime(createdAt) ASC, id ASC
  `).all()
  const update = database.prepare('UPDATE Orders SET orderCode = ? WHERE id = ?')
  const txn = database.transaction(() => {
    for (const order of rows) {
      const code = generateNextOrderCode(order.userId, order, new Date(order.createdAt || Date.now()))
      update.run(code, order.id)
    }
  })
  txn()
}

function sanitizePathPart(str, fallback = '') {
  return (str || fallback || '').trim().replace(/[<>:"/\\|?*]/g, '_')
}

function normalizePackageTier(value) {
  return ['budget', 'carefree', 'vip'].includes(value) ? value : ''
}

function isSelfHandlerValue(value) {
  const handler = String(value || '').trim()
  return !handler || handler === '本人'
}

function buildOrderFolderName(order) {
  const folderYear = Number(order.graduationYear) || new Date().getFullYear()
  const studentNamePart = sanitizePathPart(order.studentName)
  const sanitizedTitle = sanitizePathPart(order.title, '题目暂未确认') || '题目暂未确认'
  return studentNamePart
    ? `${folderYear}-${studentNamePart}-${sanitizedTitle}`
    : `${folderYear}-${sanitizedTitle}`
}

function buildGraduationOrderFolderPath(rootDirectory, order) {
  const type = order.orderType || 'thesis'
  const folderYear = Number(order.graduationYear) || new Date().getFullYear()
  const subDir = getOrderTypeSubDir(type)
  const uniName = sanitizePathPart(order.university)
  const majorName = sanitizePathPart(order.major)
  const folderName = buildOrderFolderName(order)
  return path.join(rootDirectory, `${folderYear}届`, subDir, uniName, `${majorName}专业`, folderName)
}

function isSamePath(left, right) {
  if (!left || !right) return false
  const a = path.normalize(left)
  const b = path.normalize(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function isPathWithin(basePath, targetPath) {
  if (!basePath || !targetPath) return false
  const relative = path.relative(path.normalize(basePath), path.normalize(targetPath))
  return !!relative && relative !== '.' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function hasGraduationLayer(rootDirectory, folderPath, graduationYear) {
  if (!rootDirectory || !folderPath || !graduationYear) return false
  const relative = path.relative(path.normalize(rootDirectory), path.normalize(folderPath))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false
  return relative.split(/[\\/]+/).includes(`${graduationYear}届`)
}

function validateOrderFolderDeletion(folderPath, rootDirectory) {
  if (!folderPath || typeof folderPath !== 'string') {
    return { ok: false, error: '未关联项目文件夹' }
  }

  const normalized = path.normalize(folderPath)
  const parsed = path.parse(normalized)
  if (isSamePath(normalized, parsed.root)) {
    return { ok: false, error: '项目文件夹指向磁盘根目录，已拒绝删除' }
  }

  const highRiskPaths = [
    app.getPath('home'),
    app.getPath('desktop'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('userData'),
  ].filter(Boolean)
  if (highRiskPaths.some(p => isSamePath(normalized, p))) {
    return { ok: false, error: '项目文件夹指向高风险目录，已拒绝删除' }
  }

  if (rootDirectory) {
    const root = normalizeRootPath(rootDirectory)
    if (isSamePath(normalized, root)) {
      return { ok: false, error: '项目文件夹指向根目录本身，已拒绝删除' }
    }
    if (!isPathWithin(root, normalized)) {
      return { ok: false, error: '项目文件夹不在当前根目录下，已拒绝删除' }
    }
  }

  if (!fs.existsSync(normalized)) {
    return { ok: true, missing: true, path: normalized }
  }

  const stat = fs.statSync(normalized)
  if (!stat.isDirectory()) {
    return { ok: false, error: '项目路径不是文件夹，已拒绝删除' }
  }

  return { ok: true, missing: false, path: normalized }
}

function registerIpcHandlers() {
  const db = getDb()
  const SYNC_PREVIEW_LIMIT = 3
  const SHARED_SYNC_NAMESPACE = 'shared-orders'

  function getSyncSettingKey(suffix) {
    return `sync:${suffix}:${SHARED_SYNC_NAMESPACE}`
  }

  function ensureUserSyncScope(userRow) {
    if (!userRow) return null
    const nextScope = userRow.syncScope || buildSyncScopeFromUsername(userRow.username)
    if (nextScope !== userRow.syncScope) {
      db.prepare('UPDATE Users SET syncScope = ? WHERE id = ?').run(nextScope, userRow.id)
      userRow.syncScope = nextScope
    }
    return userRow
  }

  function getUserSyncProfile(userId) {
    const row = db.prepare('SELECT id, username, syncScope FROM Users WHERE id = ?').get(userId)
    return ensureUserSyncScope(row)
  }

  function getSyncDeviceId() {
    let deviceId = getSettingValue('syncDeviceId')
    if (!deviceId) {
      deviceId = makeSyncId()
      setSettingValue('syncDeviceId', deviceId)
    }
    return deviceId
  }

  function getSyncDirectory() {
    return normalizeRootPath(getSettingValue('syncDirectory') || '')
  }

  function getRootDirectory() {
    return normalizeRootPath(getSettingValue('rootDirectory') || '')
  }

  function ensureDir(dirPath) {
    if (!dirPath) return
    fs.mkdirSync(dirPath, { recursive: true })
  }

  function getSharedSyncDirName() {
    return SHARED_SYNC_NAMESPACE
  }

  function ensureSharedSyncDirs(syncDir) {
    const baseDir = path.join(syncDir, getSharedSyncDirName())
    const eventsDir = path.join(baseDir, 'events')
    const assetsDir = path.join(baseDir, 'assets')
    ensureDir(eventsDir)
    ensureDir(assetsDir)
    return { baseDir, eventsDir, assetsDir }
  }

  function parseAttachments(attachmentsText) {
    const parsed = safeJsonParse(attachmentsText, [])
    return Array.isArray(parsed) ? parsed : []
  }

  function getLocalAttachmentDir() {
    const dir = path.join(app.getPath('userData'), 'attachments')
    ensureDir(dir)
    return dir
  }

  function copyFileWithUniqueName(sourcePath, targetDir, preferredName) {
    ensureDir(targetDir)
    const ext = path.extname(preferredName || sourcePath || '')
    const fallbackBase = path.basename(preferredName || sourcePath || `file_${Date.now()}`, ext) || `file_${Date.now()}`
    let filename = preferredName || `${fallbackBase}${ext}`
    let destination = path.join(targetDir, filename)
    let counter = 1
    while (fs.existsSync(destination)) {
      filename = `${fallbackBase}_${counter}${ext}`
      destination = path.join(targetDir, filename)
      counter += 1
    }
    fs.copyFileSync(sourcePath, destination)
    return { path: destination, name: filename }
  }

  function summarizeText(text, fallback = '未命名记录') {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim()
    if (!normalized) return fallback
    return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized
  }

  function getFieldLabel(field) {
    const fieldMap = {
      title: '标题',
      university: '学校',
      college: '学院',
      major: '专业',
      studentName: '学生姓名',
      wechatName: '微信名',
      orderCode: '订单编号',
      groupChatName: '微信群名',
      includesDesign: '是否含设计',
      receiver: '接单人',
      handler: '处理人',
      advisor: '指导老师',
      deadline: '截止日期',
      totalAmount: '总金额',
      paidAmount: '已收金额',
      dispatchAmount: '下发金额',
      refundAmount: '退款金额',
      handlerPaidAmount: '已付处理费',
      designType: '设计类型',
      designSubType: '设计子类型',
      designStatus: '设计状态',
      orderType: '订单类型',
      formatMode: '合作模式',
      packageTier: '套餐方案',
      hasOriginalText: '有无原文',
      specialService: '服务项目',
      isDesignFinished: '是否完成',
      isDraftSubmitted: '是否交初稿',
      graduationYear: '毕业年份',
      folderPath: '项目路径',
      deadlineAt: '截止日期',
      isResolved: '反馈状态',
      attachments: '附件',
      content: '反馈内容',
    }
    return fieldMap[field] || field
  }

  function getOrderAmountFields() {
    return ['totalAmount', 'paidAmount', 'dispatchAmount', 'refundAmount', 'handlerPaidAmount']
  }

  function getOrderById(id) {
    return db.prepare('SELECT * FROM Orders WHERE id = ?').get(id)
  }

  function getOrderBySyncUuid(syncUuid, userId) {
    return db.prepare('SELECT * FROM Orders WHERE syncUuid = ? AND userId = ?').get(syncUuid, userId)
  }

  function getRevisionWithContextById(id) {
    return db.prepare(`
      SELECT
        r.*,
        o.userId,
        o.title AS orderTitle,
        o.syncUuid AS orderSyncUuid
      FROM Revisions r
      JOIN Orders o ON o.id = r.orderId
      WHERE r.id = ?
    `).get(id)
  }

  function getRevisionBySyncUuid(syncUuid, userId) {
    return db.prepare(`
      SELECT
        r.*,
        o.userId,
        o.title AS orderTitle,
        o.syncUuid AS orderSyncUuid
      FROM Revisions r
      JOIN Orders o ON o.id = r.orderId
      WHERE r.syncUuid = ? AND o.userId = ?
    `).get(syncUuid, userId)
  }

  function getFeedbackWithContextById(id) {
    return db.prepare(`
      SELECT
        fi.*,
        r.title AS revisionTitle,
        r.syncUuid AS revisionSyncUuid,
        o.userId,
        o.title AS orderTitle
      FROM FeedbackItems fi
      JOIN Revisions r ON r.id = fi.revisionId
      JOIN Orders o ON o.id = r.orderId
      WHERE fi.id = ?
    `).get(id)
  }

  function getFeedbackBySyncUuid(syncUuid, userId) {
    return db.prepare(`
      SELECT
        fi.*,
        r.title AS revisionTitle,
        r.syncUuid AS revisionSyncUuid,
        o.userId,
        o.title AS orderTitle
      FROM FeedbackItems fi
      JOIN Revisions r ON r.id = fi.revisionId
      JOIN Orders o ON o.id = r.orderId
      WHERE fi.syncUuid = ? AND o.userId = ?
    `).get(syncUuid, userId)
  }

  function insertSyncEvent({ userId, entityType, entityUuid, action, payload, summaryType, summaryLabel = '', summaryExtra = '' }) {
    const profile = getUserSyncProfile(userId)
    if (!profile?.syncScope) return
    db.prepare(`
      INSERT INTO SyncEvents (
        eventId, userId, syncScope, deviceId, entityType, entityUuid, action, payload,
        summaryType, summaryLabel, summaryExtra, createdAt, exportedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      makeSyncId(),
      userId,
      profile.syncScope,
      getSyncDeviceId(),
      entityType,
      entityUuid,
      action,
      JSON.stringify(payload || {}),
      summaryType,
      summaryLabel,
      summaryExtra,
      nowIso()
    )
  }

  function recordOrderSyncEvent(action, orderRow, changedFields = []) {
    if (!orderRow?.userId || !orderRow?.syncUuid) return
    const amountFields = changedFields.filter(field => getOrderAmountFields().includes(field))
    const otherFields = changedFields.filter(field => !getOrderAmountFields().includes(field))
    const summaryType = action === 'create'
      ? 'order_created'
      : action === 'delete'
        ? 'order_deleted'
        : amountFields.length > 0 && otherFields.length === 0
          ? 'amount_changed'
          : 'order_updated'
    const summaryExtra = action === 'update'
      ? [...amountFields, ...otherFields].map(getFieldLabel).join('、')
      : ''
    insertSyncEvent({
      userId: orderRow.userId,
      entityType: 'order',
      entityUuid: orderRow.syncUuid,
      action,
      summaryType,
      summaryLabel: orderRow.title || '未命名订单',
      summaryExtra,
      payload: {
        sourceRoot: getRootDirectory(),
        changedFields,
        order: orderRow,
      },
    })
  }

  function recordRevisionSyncEvent(action, revisionRow, changedFields = []) {
    if (!revisionRow?.userId || !revisionRow?.syncUuid) return
    insertSyncEvent({
      userId: revisionRow.userId,
      entityType: 'revision',
      entityUuid: revisionRow.syncUuid,
      action,
      summaryType: 'revision_changed',
      summaryLabel: `${revisionRow.orderTitle || '未命名订单'}-${revisionRow.title || '未命名轮次'}`,
      summaryExtra: changedFields.map(getFieldLabel).join('、'),
      payload: {
        sourceRoot: getRootDirectory(),
        changedFields,
        orderSyncUuid: revisionRow.orderSyncUuid,
        orderTitle: revisionRow.orderTitle || '',
        revision: revisionRow,
      },
    })
  }

  function recordFeedbackSyncEvent(action, feedbackRow, changedFields = []) {
    if (!feedbackRow?.userId || !feedbackRow?.syncUuid) return
    const attachments = parseAttachments(feedbackRow.attachments)
    const attachmentNames = attachments.map(item => item?.name || path.basename(item?.path || '')).filter(Boolean)
    insertSyncEvent({
      userId: feedbackRow.userId,
      entityType: 'feedback',
      entityUuid: feedbackRow.syncUuid,
      action,
      summaryType: attachmentNames.length > 0 ? 'attachment_changed' : (changedFields.includes('isResolved') ? 'feedback_resolved' : 'feedback_created'),
      summaryLabel: `${feedbackRow.orderTitle || '未命名订单'}-${feedbackRow.revisionTitle || '未命名轮次'}`,
      summaryExtra: attachmentNames.join('、') || summarizeText(feedbackRow.content, '反馈内容'),
      payload: {
        changedFields,
        orderTitle: feedbackRow.orderTitle || '',
        revisionTitle: feedbackRow.revisionTitle || '',
        revisionSyncUuid: feedbackRow.revisionSyncUuid,
        feedback: feedbackRow,
        attachmentNames,
      },
    })
  }

  function buildPendingSyncSummary(userId) {
    const lastSyncAt = getSettingValue(getSyncSettingKey('lastSuccessAt'))
    const params = [userId, getSyncDeviceId()]
    let query = `
      SELECT eventId, entityType, action, payload, summaryLabel, summaryExtra, createdAt
      FROM SyncEvents
      WHERE userId = ? AND deviceId = ?
    `
    if (lastSyncAt) {
      query += ' AND datetime(createdAt) > datetime(?)'
      params.push(lastSyncAt)
    }
    query += ' ORDER BY datetime(createdAt) ASC'
    const rows = db.prepare(query).all(...params)
    const groups = new Map()

    function pushGroup(key, title, text) {
      if (!text) return
      if (!groups.has(key)) groups.set(key, { title, items: [] })
      groups.get(key).items.push(text)
    }

    for (const row of rows) {
      const payload = safeJsonParse(row.payload, {})
      if (row.entityType === 'order') {
        if (row.action === 'create') pushGroup('order_created', '新增订单', payload.order?.title || row.summaryLabel)
        else if (row.action === 'delete') pushGroup('order_deleted', '删除订单', row.summaryLabel)
        else {
          const changedFields = Array.isArray(payload.changedFields) ? payload.changedFields : []
          const amountFields = changedFields.filter(field => getOrderAmountFields().includes(field))
          const otherFields = changedFields.filter(field => !getOrderAmountFields().includes(field))
          if (otherFields.length > 0) {
            pushGroup('order_updated', '修改订单', `${payload.order?.title || row.summaryLabel}（${otherFields.map(getFieldLabel).join('、')}）`)
          }
          if (amountFields.length > 0) {
            pushGroup('amount_changed', '金额变动', payload.order?.title || row.summaryLabel)
          }
        }
      } else if (row.entityType === 'revision') {
        pushGroup('revision_changed', '修改节点变更', row.summaryLabel)
      } else if (row.entityType === 'feedback') {
        if (row.action === 'create') {
          pushGroup('feedback_created', '新增反馈', row.summaryLabel)
        } else if ((payload.changedFields || []).includes('isResolved')) {
          pushGroup('feedback_resolved', '反馈状态更新', row.summaryLabel)
        }
        const attachmentNames = Array.isArray(payload.attachmentNames) ? payload.attachmentNames : []
        if (attachmentNames.length > 0 || (payload.changedFields || []).includes('attachments') || row.action === 'delete') {
          const attachLabel = attachmentNames.length > 0 ? attachmentNames.join('、') : row.summaryExtra
          pushGroup('attachment_changed', '附件变更', attachLabel || row.summaryLabel)
        }
      }
    }

    const details = Array.from(groups.values()).map(group => {
      const uniqueItems = [...new Set(group.items.filter(Boolean))]
      const preview = uniqueItems.slice(0, SYNC_PREVIEW_LIMIT)
      const suffix = uniqueItems.length > SYNC_PREVIEW_LIMIT ? ' 等' : ''
      return {
        title: group.title,
        count: uniqueItems.length,
        items: preview,
        text: `${group.title} ${uniqueItems.length} 条：${preview.join('、')}${suffix}`,
      }
    })

    return {
      totalCount: details.reduce((sum, item) => sum + item.count, 0),
      details,
      text: details.length > 0
        ? `自上次同步后，本机新增重要记录 ${details.reduce((sum, item) => sum + item.count, 0)} 项。${details.map(item => item.text).join('；')}`
        : '自上次同步后，本机暂无重要新增记录',
    }
  }

  function createPortableEvent(eventRow, syncDir, assetsDir) {
    const payload = safeJsonParse(eventRow.payload, {})
    if (eventRow.entityType === 'feedback' && payload.feedback) {
      const rawAttachments = parseAttachments(payload.feedback.attachments)
      const portableAttachments = rawAttachments.map((item, index) => {
        const att = { ...item }
        const sourcePath = att.path
        const ext = path.extname(att.name || sourcePath || '')
        if (sourcePath && fs.existsSync(sourcePath)) {
          const syncName = `${eventRow.eventId}_${index}${ext || ''}`
          const targetPath = path.join(assetsDir, syncName)
          if (!fs.existsSync(targetPath)) fs.copyFileSync(sourcePath, targetPath)
          att.syncAssetPath = path.relative(syncDir, targetPath)
        }
        delete att.path
        return att
      })
      payload.feedback.attachments = JSON.stringify(portableAttachments)
      payload.attachmentNames = portableAttachments.map(item => item?.name || '').filter(Boolean)
    }
    return {
      version: 1,
      eventId: eventRow.eventId,
      userId: eventRow.userId,
      syncScope: eventRow.syncScope || '',
      deviceId: eventRow.deviceId,
      entityType: eventRow.entityType,
      entityUuid: eventRow.entityUuid,
      action: eventRow.action,
      summaryType: eventRow.summaryType,
      summaryLabel: eventRow.summaryLabel,
      summaryExtra: eventRow.summaryExtra,
      createdAt: eventRow.createdAt,
      payload,
    }
  }

  function materializeAttachmentsForImport(feedbackPayload, syncDir) {
    const portableAttachments = parseAttachments(feedbackPayload.attachments)
    const localDir = getLocalAttachmentDir()
    const localizedAttachments = []
    for (const item of portableAttachments) {
      const nextItem = { ...item }
      if (item.syncAssetPath) {
        const assetPath = path.join(syncDir, item.syncAssetPath)
        if (fs.existsSync(assetPath)) {
          const copied = copyFileWithUniqueName(assetPath, localDir, item.name || path.basename(assetPath))
          nextItem.path = copied.path
          nextItem.name = copied.name
        }
      }
      delete nextItem.syncAssetPath
      localizedAttachments.push(nextItem)
    }
    return JSON.stringify(localizedAttachments)
  }

  function applyOrderEvent(event, userId) {
    const payload = event.payload || {}
    const order = payload.order
    if (!order?.syncUuid) return
    const localRoot = getRootDirectory()
    if (event.action === 'delete') {
      const existingOrder = getOrderBySyncUuid(order.syncUuid, userId)
      if (!existingOrder) return
      const revisions = db.prepare('SELECT id FROM Revisions WHERE orderId = ?').all(existingOrder.id)
      for (const revision of revisions) {
        db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(revision.id)
      }
      db.prepare('DELETE FROM Revisions WHERE orderId = ?').run(existingOrder.id)
      db.prepare('DELETE FROM Orders WHERE id = ? AND userId = ?').run(existingOrder.id, userId)
      return
    }

    const mappedFolderPath = replacePathPrefix(payload.sourceRoot || '', localRoot, order.folderPath || '')
    const orderData = {
      title: order.title || '',
      university: order.university || '',
      college: order.college || '',
      major: order.major || '',
      studentName: order.studentName || '',
      wechatName: order.wechatName || '',
      orderCode: String(order.orderCode || '').trim(),
      groupChatName: order.groupChatName || '',
      includesDesign: Number(order.includesDesign) || 0,
      designType: order.designType || '',
      designSubType: order.designSubType || '',
      designStatus: order.designStatus || '',
      orderType: order.orderType || 'thesis',
      formatMode: order.formatMode || '',
      packageTier: normalizePackageTier(order.packageTier),
      hasOriginalText: Number(order.hasOriginalText) || 0,
      specialService: order.specialService || '',
      receiver: order.receiver || '',
      handler: order.handler || '',
      advisor: order.advisor || '',
      deadline: order.deadline || '',
      totalAmount: Number(order.totalAmount) || 0,
      paidAmount: Number(order.paidAmount) || 0,
      dispatchAmount: Number(order.dispatchAmount) || 0,
      isDesignFinished: Number(order.isDesignFinished) || 0,
      folderPath: mappedFolderPath,
      graduationYear: Number(order.graduationYear) || 0,
      createdAt: order.createdAt || nowIso(),
      isDraftSubmitted: Number(order.isDraftSubmitted) || 0,
      refundAmount: Number(order.refundAmount) || 0,
      isHandlerPaid: Number(order.isHandlerPaid) || 0,
      handlerPaidAmount: Number(order.handlerPaidAmount) || 0,
      syncUuid: order.syncUuid,
    }
    if (isSelfHandlerValue(orderData.handler)) {
      orderData.handler = '本人'
      orderData.dispatchAmount = 0
      orderData.handlerPaidAmount = 0
      orderData.isHandlerPaid = 0
    }
    const existingOrder = getOrderBySyncUuid(order.syncUuid, userId)
    if (existingOrder && !orderData.orderCode) {
      orderData.orderCode = existingOrder.orderCode || ''
    }
    if (!existingOrder && !orderData.orderCode) {
      orderData.orderCode = String(orderData.groupChatName || '').trim()
        || generateNextOrderCode(userId, orderData, new Date(orderData.createdAt || Date.now()))
      if (!orderData.groupChatName) orderData.groupChatName = orderData.orderCode
    }
    if (existingOrder) {
      db.prepare(`
        UPDATE Orders SET
          title = @title,
          university = @university,
          college = @college,
          major = @major,
          studentName = @studentName,
          wechatName = @wechatName,
          orderCode = @orderCode,
          groupChatName = @groupChatName,
          includesDesign = @includesDesign,
          designType = @designType,
          designSubType = @designSubType,
          designStatus = @designStatus,
          orderType = @orderType,
          formatMode = @formatMode,
          packageTier = @packageTier,
          hasOriginalText = @hasOriginalText,
          specialService = @specialService,
          receiver = @receiver,
          handler = @handler,
          advisor = @advisor,
          deadline = @deadline,
          totalAmount = @totalAmount,
          paidAmount = @paidAmount,
          dispatchAmount = @dispatchAmount,
          isDesignFinished = @isDesignFinished,
          folderPath = @folderPath,
          graduationYear = @graduationYear,
          createdAt = @createdAt,
          isDraftSubmitted = @isDraftSubmitted,
          refundAmount = @refundAmount,
          isHandlerPaid = @isHandlerPaid,
          handlerPaidAmount = @handlerPaidAmount
        WHERE id = @id AND userId = @userId
      `).run({ ...orderData, id: existingOrder.id, userId })
    } else {
      db.prepare(`
        INSERT INTO Orders (
          userId, title, university, college, major, studentName, wechatName, orderCode, groupChatName,
          includesDesign, designType, designSubType, designStatus, orderType, formatMode, packageTier,
          hasOriginalText, specialService, receiver, handler, advisor, deadline, totalAmount, paidAmount,
          dispatchAmount, isDesignFinished, folderPath, graduationYear, createdAt,
          isDraftSubmitted, refundAmount, isHandlerPaid, handlerPaidAmount, syncUuid
        ) VALUES (
          @userId, @title, @university, @college, @major, @studentName, @wechatName, @orderCode, @groupChatName,
          @includesDesign, @designType, @designSubType, @designStatus, @orderType, @formatMode, @packageTier,
          @hasOriginalText, @specialService, @receiver, @handler, @advisor, @deadline, @totalAmount, @paidAmount,
          @dispatchAmount, @isDesignFinished, @folderPath, @graduationYear, @createdAt,
          @isDraftSubmitted, @refundAmount, @isHandlerPaid, @handlerPaidAmount, @syncUuid
        )
      `).run({ ...orderData, userId })
    }
  }

  function applyRevisionEvent(event, userId) {
    const payload = event.payload || {}
    const revision = payload.revision
    if (!revision?.syncUuid || !payload.orderSyncUuid) return
    const localRoot = getRootDirectory()
    const parentOrder = getOrderBySyncUuid(payload.orderSyncUuid, userId)
    if (!parentOrder) return
    if (event.action === 'delete') {
      const existingRevision = getRevisionBySyncUuid(revision.syncUuid, userId)
      if (!existingRevision) return
      db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(existingRevision.id)
      db.prepare('DELETE FROM Revisions WHERE id = ?').run(existingRevision.id)
      return
    }

    const mappedFolderPath = replacePathPrefix(payload.sourceRoot || '', localRoot, revision.folderPath || '')
    const revisionData = {
      orderId: parentOrder.id,
      title: revision.title || '',
      folderPath: mappedFolderPath,
      deadline: revision.deadline || null,
      isExpanded: Number(revision.isExpanded) || 0,
      createdAt: revision.createdAt || nowIso(),
      syncUuid: revision.syncUuid,
    }
    const existingRevision = getRevisionBySyncUuid(revision.syncUuid, userId)
    if (existingRevision) {
      db.prepare(`
        UPDATE Revisions SET
          orderId = @orderId,
          title = @title,
          folderPath = @folderPath,
          deadline = @deadline,
          isExpanded = @isExpanded,
          createdAt = @createdAt
        WHERE id = @id
      `).run({ ...revisionData, id: existingRevision.id })
    } else {
      db.prepare(`
        INSERT INTO Revisions (orderId, title, folderPath, deadline, isExpanded, createdAt, syncUuid)
        VALUES (@orderId, @title, @folderPath, @deadline, @isExpanded, @createdAt, @syncUuid)
      `).run(revisionData)
    }
  }

  function applyFeedbackEvent(event, userId, syncDir) {
    const payload = event.payload || {}
    const feedback = payload.feedback
    if (!feedback?.syncUuid || !payload.revisionSyncUuid) return
    const parentRevision = getRevisionBySyncUuid(payload.revisionSyncUuid, userId)
    if (!parentRevision) return
    if (event.action === 'delete') {
      const existingFeedback = getFeedbackBySyncUuid(feedback.syncUuid, userId)
      if (existingFeedback) db.prepare('DELETE FROM FeedbackItems WHERE id = ?').run(existingFeedback.id)
      return
    }

    const attachments = materializeAttachmentsForImport(feedback, syncDir)
    const feedbackData = {
      revisionId: parentRevision.id,
      content: feedback.content || '',
      isResolved: Number(feedback.isResolved) || 0,
      hasImage: Number(feedback.hasImage) || 0,
      imagePath: feedback.imagePath || null,
      attachments,
      syncUuid: feedback.syncUuid,
    }
    const existingFeedback = getFeedbackBySyncUuid(feedback.syncUuid, userId)
    if (existingFeedback) {
      db.prepare(`
        UPDATE FeedbackItems SET
          revisionId = @revisionId,
          content = @content,
          isResolved = @isResolved,
          hasImage = @hasImage,
          imagePath = @imagePath,
          attachments = @attachments
        WHERE id = @id
      `).run({ ...feedbackData, id: existingFeedback.id })
    } else {
      db.prepare(`
        INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments, syncUuid)
        VALUES (@revisionId, @content, @isResolved, @hasImage, @imagePath, @attachments, @syncUuid)
      `).run(feedbackData)
    }
  }

  function applyIncomingSyncEvent(event, userId, syncDir) {
    const applyTxn = db.transaction(() => {
      if (event.entityType === 'order') applyOrderEvent(event, userId)
      else if (event.entityType === 'revision') applyRevisionEvent(event, userId)
      else if (event.entityType === 'feedback') applyFeedbackEvent(event, userId, syncDir)
      db.prepare('INSERT OR REPLACE INTO SyncAppliedEvents (eventId, appliedAt) VALUES (?, ?)').run(event.eventId, nowIso())
    })
    applyTxn()
  }

  function listSyncEventFiles(eventsDir) {
    if (!fs.existsSync(eventsDir)) return []
    return fs.readdirSync(eventsDir)
      .filter(name => name.endsWith('.json'))
      .map(name => path.join(eventsDir, name))
  }

  function hasAnyRemoteEvent(syncDir) {
    const eventsDir = path.join(syncDir, getSharedSyncDirName(), 'events')
    return listSyncEventFiles(eventsDir).length > 0
  }

  function seedBaselineSyncEvents(userId) {
    const deviceId = getSyncDeviceId()
    const existingCount = db.prepare('SELECT COUNT(*) AS c FROM SyncEvents WHERE userId = ? AND deviceId = ?').get(userId, deviceId).c
    if (existingCount > 0) return 0
    const orders = db.prepare('SELECT * FROM Orders WHERE userId = ? ORDER BY id ASC').all(userId)
    let created = 0
    for (const order of orders) {
      recordOrderSyncEvent('create', order)
      created += 1
      const revisions = db.prepare(`
        SELECT r.*, o.userId, o.title AS orderTitle, o.syncUuid AS orderSyncUuid
        FROM Revisions r
        JOIN Orders o ON o.id = r.orderId
        WHERE r.orderId = ?
        ORDER BY r.id ASC
      `).all(order.id)
      for (const revision of revisions) {
        recordRevisionSyncEvent('create', revision)
        created += 1
        const feedbackItems = db.prepare(`
          SELECT
            fi.*,
            r.title AS revisionTitle,
            r.syncUuid AS revisionSyncUuid,
            o.userId,
            o.title AS orderTitle
          FROM FeedbackItems fi
          JOIN Revisions r ON r.id = fi.revisionId
          JOIN Orders o ON o.id = r.orderId
          WHERE fi.revisionId = ?
          ORDER BY fi.id ASC
        `).all(revision.id)
        for (const feedback of feedbackItems) {
          recordFeedbackSyncEvent('create', feedback)
          created += 1
        }
      }
    }
    return created
  }

  function exportPendingSyncEvents(syncDir, userId) {
    const { eventsDir, assetsDir } = ensureSharedSyncDirs(syncDir)
    const pendingRows = db.prepare(`
      SELECT * FROM SyncEvents
      WHERE userId = ? AND deviceId = ? AND exportedAt IS NULL
      ORDER BY datetime(createdAt) ASC
    `).all(userId, getSyncDeviceId())
    for (const row of pendingRows) {
      const portableEvent = createPortableEvent(row, syncDir, assetsDir)
      fs.writeFileSync(path.join(eventsDir, `${row.eventId}.json`), JSON.stringify(portableEvent, null, 2), 'utf8')
      db.prepare('UPDATE SyncEvents SET exportedAt = ? WHERE eventId = ?').run(nowIso(), row.eventId)
    }
    return pendingRows.length
  }

  function importSyncEvents(syncDir, userId) {
    const { eventsDir } = ensureSharedSyncDirs(syncDir)
    const files = listSyncEventFiles(eventsDir)
    const rawEvents = []
    for (const filePath of files) {
      try {
        const event = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (!event?.eventId) continue
        const applied = db.prepare('SELECT eventId FROM SyncAppliedEvents WHERE eventId = ?').get(event.eventId)
        if (applied) continue
        if (event.deviceId === getSyncDeviceId()) {
          db.prepare('INSERT OR REPLACE INTO SyncAppliedEvents (eventId, appliedAt) VALUES (?, ?)').run(event.eventId, nowIso())
          continue
        }
        rawEvents.push(event)
      } catch {}
    }
    rawEvents.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    for (const event of rawEvents) {
      applyIncomingSyncEvent(event, userId, syncDir)
    }
    return rawEvents.length
  }

  function getSyncOverview(userId) {
    const syncDirectory = getSyncDirectory()
    const pendingSummary = buildPendingSyncSummary(userId)
    const lastSyncAt = getSettingValue(getSyncSettingKey('lastSuccessAt'))
    let status = '待首次同步'
    if (!syncDirectory) status = '未设置同步目录'
    else if (pendingSummary.totalCount > 0) status = '可同步'
    else if (lastSyncAt) status = '已同步'
    return {
      deviceId: getSyncDeviceId(),
      syncScope: SHARED_SYNC_NAMESPACE,
      syncDirectory,
      lastSyncAt,
      status,
      summary: pendingSummary,
      hint: syncDirectory
        ? '当前版本按统一订单数据池同步，不区分账号。请先确认 Syncthing 已完成目录同步，再点击同步。'
        : '请先选择用于 Syncthing 的同步目录。',
    }
  }

  function rewritePathForOrderFolder(value, oldFolderPath, newFolderPath) {
    if (!value || typeof value !== 'string') return value || ''
    if (isSamePath(value, oldFolderPath) || isPathWithin(oldFolderPath, value)) {
      return replacePathPrefix(oldFolderPath, newFolderPath, value)
    }
    return value
  }

  function rewriteAttachmentsForOrderFolder(attachmentsText, oldFolderPath, newFolderPath) {
    if (!attachmentsText) return '[]'
    try {
      const arr = JSON.parse(attachmentsText)
      if (!Array.isArray(arr)) return attachmentsText
      let changed = false
      for (const item of arr) {
        if (item && typeof item.path === 'string') {
          const nextPath = rewritePathForOrderFolder(item.path, oldFolderPath, newFolderPath)
          if (nextPath !== item.path) {
            item.path = nextPath
            changed = true
          }
        }
      }
      return changed ? JSON.stringify(arr) : attachmentsText
    } catch {
      return attachmentsText
    }
  }

  function normalizeOrderUpdateData(data = {}) {
    const next = { ...data }
    if (Object.prototype.hasOwnProperty.call(next, 'title')) {
      next.title = String(next.title || '').trim()
    }
    if (Object.prototype.hasOwnProperty.call(next, 'packageTier')) {
      next.packageTier = normalizePackageTier(next.packageTier)
    }
    if (Object.prototype.hasOwnProperty.call(next, 'handler')) {
      next.handler = String(next.handler || '').trim() || '本人'
      if (isSelfHandlerValue(next.handler)) {
        next.dispatchAmount = 0
        next.handlerPaidAmount = 0
        next.isHandlerPaid = 0
      }
    }
    return next
  }

  function updateRelatedPathsForOrderFolder(orderId, oldFolderPath, newFolderPath) {
    const revisions = db.prepare('SELECT id, folderPath FROM Revisions WHERE orderId = ?').all(orderId)
    for (const revision of revisions) {
      const nextRevisionPath = rewritePathForOrderFolder(revision.folderPath || '', oldFolderPath, newFolderPath)
      if (nextRevisionPath !== (revision.folderPath || '')) {
        db.prepare('UPDATE Revisions SET folderPath = ? WHERE id = ?').run(nextRevisionPath, revision.id)
        const revisionRow = getRevisionWithContextById(revision.id)
        recordRevisionSyncEvent('update', revisionRow, ['folderPath'])
      }
    }

    const feedbackItems = db.prepare(`
      SELECT fi.id, fi.imagePath, fi.attachments
      FROM FeedbackItems fi
      JOIN Revisions r ON r.id = fi.revisionId
      WHERE r.orderId = ?
    `).all(orderId)
    for (const feedback of feedbackItems) {
      const nextImagePath = feedback.imagePath
        ? rewritePathForOrderFolder(feedback.imagePath, oldFolderPath, newFolderPath)
        : feedback.imagePath
      const nextAttachments = rewriteAttachmentsForOrderFolder(feedback.attachments || '[]', oldFolderPath, newFolderPath)
      const changedFields = []
      if (nextImagePath !== feedback.imagePath) changedFields.push('imagePath')
      if (nextAttachments !== (feedback.attachments || '[]')) changedFields.push('attachments')
      if (changedFields.length > 0) {
        db.prepare('UPDATE FeedbackItems SET imagePath = ?, attachments = ? WHERE id = ?').run(nextImagePath, nextAttachments, feedback.id)
        const feedbackRow = getFeedbackWithContextById(feedback.id)
        recordFeedbackSyncEvent('update', feedbackRow, changedFields)
      }
    }
  }

  function buildGraduationFolderMigrationPreview(userId) {
    const rootDirectory = getRootDirectory()
    if (!userId) return { success: false, error: 'INVALID_USER' }
    if (!rootDirectory) return { success: false, error: 'ROOT_DIR_NOT_SET' }

    const orders = db.prepare('SELECT * FROM Orders WHERE userId = ? ORDER BY graduationYear DESC, id ASC').all(userId)
    const items = []
    const skipped = []

    function pushSkipped(order, reason, detail = '') {
      skipped.push({
        orderId: order.id,
        title: order.title || '未命名订单',
        graduationYear: order.graduationYear || 0,
        oldPath: order.folderPath || '',
        reason,
        detail,
      })
    }

    for (const order of orders) {
      const graduationYear = Number(order.graduationYear) || 0
      const oldPath = order.folderPath || ''
      if (!oldPath) {
        pushSkipped(order, 'EMPTY_PATH', '未关联项目文件夹')
        continue
      }
      if (!graduationYear) {
        pushSkipped(order, 'NO_GRADUATION_YEAR', '订单缺少毕业届')
        continue
      }
      if (!fs.existsSync(oldPath)) {
        pushSkipped(order, 'SOURCE_NOT_FOUND', '原文件夹不存在')
        continue
      }
      if (!isSamePath(rootDirectory, oldPath) && !isPathWithin(rootDirectory, oldPath)) {
        pushSkipped(order, 'OUTSIDE_ROOT', '原路径不在当前根目录下')
        continue
      }
      if (hasGraduationLayer(rootDirectory, oldPath, graduationYear)) {
        pushSkipped(order, 'ALREADY_MIGRATED', '路径中已包含对应毕业届目录')
        continue
      }

      const newPath = buildGraduationOrderFolderPath(rootDirectory, order)
      if (isSamePath(oldPath, newPath)) {
        pushSkipped(order, 'SAME_PATH', '新旧路径一致')
        continue
      }
      if (fs.existsSync(newPath)) {
        pushSkipped(order, 'TARGET_EXISTS', '目标文件夹已存在')
        continue
      }

      items.push({
        orderId: order.id,
        title: order.title || '未命名订单',
        graduationYear,
        oldPath,
        newPath,
      })
    }

    return {
      success: true,
      rootDirectory,
      totalOrders: orders.length,
      items,
      skipped,
      summary: {
        migratableCount: items.length,
        skippedCount: skipped.length,
      },
    }
  }

  function runGraduationFolderMigration(userId) {
    const preview = buildGraduationFolderMigrationPreview(userId)
    if (!preview.success) return preview

    const migrated = []
    const failed = []

    for (const item of preview.items) {
      try {
        if (fs.existsSync(item.newPath)) {
          failed.push({ ...item, error: '目标文件夹已存在' })
          continue
        }

        copyDirRecursive(item.oldPath, item.newPath)

        const updateTxn = db.transaction(() => {
          updateRelatedPathsForOrderFolder(item.orderId, item.oldPath, item.newPath)

          db.prepare('UPDATE Orders SET folderPath = ? WHERE id = ? AND userId = ?').run(item.newPath, item.orderId, userId)
          const orderRow = getOrderById(item.orderId)
          recordOrderSyncEvent('update', orderRow, ['folderPath'])
        })

        updateTxn()
        migrated.push(item)
      } catch (err) {
        failed.push({ ...item, error: err.message || String(err) })
      }
    }

    return {
      success: failed.length === 0,
      migrated,
      failed,
      skipped: preview.skipped,
      summary: {
        migratedCount: migrated.length,
        failedCount: failed.length,
        skippedCount: preview.skipped.length,
      },
    }
  }

  // ===== Window Controls =====
  ipcMain.handle('window:getPlatform', () => process.platform)
  ipcMain.handle('window:minimize', () => mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow.hide())

  // ===== Reset =====
  ipcMain.handle('reset:all', (_, superPassword) => {
    if (superPassword !== 'xiaozhantuwen666') return { success: false, error: '超级密码错误' }
    db.exec(`
      DELETE FROM FeedbackItems;
      DELETE FROM Revisions;
      DELETE FROM Orders;
      DELETE FROM Users;
      DELETE FROM DesignTypeDefs;
      DELETE FROM SyncEvents;
      DELETE FROM SyncAppliedEvents;
      DELETE FROM Settings;
    `)
    return { success: true }
  })

  // ===== Auth =====
  ipcMain.handle('auth:hasUsers', () => {
    const row = db.prepare('SELECT COUNT(*) as c FROM Users').get()
    return row.c > 0
  })

  ipcMain.handle('auth:register', (_, username, password) => {
    const existing = db.prepare('SELECT id FROM Users WHERE username = ?').get(username)
    if (existing) return { success: false, error: '用户名已存在' }
    const syncScope = buildSyncScopeFromUsername(username)
    const result = db.prepare('INSERT INTO Users (username, syncScope, password) VALUES (?, ?, ?)').run(username, syncScope, password)
    return { success: true, user: { id: Number(result.lastInsertRowid), username, syncScope } }
  })

  ipcMain.handle('auth:login', (_, username, password) => {
    const user = ensureUserSyncScope(db.prepare('SELECT id, username, syncScope, password FROM Users WHERE username = ?').get(username))
    if (!user || user.password !== password) return null
    return { id: user.id, username: user.username, syncScope: user.syncScope }
  })

  ipcMain.handle('auth:verifyPassword', (_, userId, password) => {
    const user = db.prepare('SELECT password FROM Users WHERE id = ?').get(userId)
    if (!user) return false
    return user.password === password
  })

  ipcMain.handle('auth:changePassword', (_, userId, oldPassword, newPassword) => {
    const user = db.prepare('SELECT password FROM Users WHERE id = ?').get(userId)
    if (!user) return { success: false, error: '用户不存在' }
    if (user.password !== oldPassword) return { success: false, error: '原密码错误' }
    db.prepare('UPDATE Users SET password = ? WHERE id = ?').run(newPassword, userId)
    return { success: true }
  })

  // ===== Stats =====
  ipcMain.handle('stats:getYears', (_, userId) => {
    return db.prepare(`
      SELECT DISTINCT strftime('%Y', createdAt) as year FROM Orders WHERE userId = ? ORDER BY year DESC
    `).all(userId).map(r => parseInt(r.year))
  })

  ipcMain.handle('stats:getSummary', (_, params) => {
    const { userId, year, month, graduationYear } = params || {}
    let dateFilter = ''
    const dateParams = { userId }
    if (year && month) {
      const m = String(month).padStart(2, '0')
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      const nm = String(nextMonth).padStart(2, '0')
      dateFilter = ` AND createdAt >= @start AND createdAt < @end`
      dateParams.start = `${year}-${m}-01`
      dateParams.end = `${nextYear}-${nm}-01`
    } else if (year) {
      dateFilter = ` AND createdAt >= @start AND createdAt < @end`
      dateParams.start = `${year}-01-01`
      dateParams.end = `${year + 1}-01-01`
    }
    let gradFilter = ''
    if (graduationYear && graduationYear > 0) {
      gradFilter = ' AND graduationYear = @graduationYear'
      dateParams.graduationYear = graduationYear
    }
    const w = ' WHERE userId = @userId' + dateFilter + gradFilter

    const totalOrders = db.prepare(`SELECT COUNT(*) as c FROM Orders${w}`).get(dateParams).c

    const byType = db.prepare(`
      SELECT orderType, COUNT(*) as count,
        SUM(totalAmount) as revenue,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as dispatch,
        SUM(refundAmount) as refund,
        SUM(paidAmount) as paid
      FROM Orders${w} GROUP BY orderType
    `).all(dateParams)

    const overall = db.prepare(`
      SELECT
        SUM(totalAmount) as totalRevenue,
        SUM(paidAmount) as totalPaid,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as totalDispatch,
        SUM(refundAmount) as totalRefund
      FROM Orders${w}
    `).get(dateParams)

    const thesisBalance = db.prepare(`
      SELECT SUM(totalAmount - paidAmount) as balance
      FROM Orders WHERE userId = @userId AND orderType = 'thesis' AND totalAmount > paidAmount${dateFilter}${gradFilter}
    `).get(dateParams)

    const completedCount = db.prepare(`
      SELECT COUNT(*) as c FROM Orders
      WHERE userId = @userId AND isDraftSubmitted = 1${dateFilter}${gradFilter}
      AND id NOT IN (
        SELECT DISTINCT o.id FROM Orders o
        JOIN Revisions r ON r.orderId = o.id
        JOIN FeedbackItems fi ON fi.revisionId = r.id
        WHERE fi.isResolved = 0 AND o.userId = @userId
      )
    `).get(dateParams).c

    const titleMissingCount = db.prepare(`
      SELECT COUNT(*) as c FROM Orders
      WHERE userId = @userId AND TRIM(COALESCE(title, '')) = ''${dateFilter}${gradFilter}
    `).get(dateParams).c

    const handlerPayment = db.prepare(`
      SELECT
        SUM(CASE WHEN handlerPaidAmount >= dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN handlerPaidAmount < dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as unpaidCount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
      FROM Orders WHERE userId = @userId
        AND TRIM(COALESCE(handler, '')) NOT IN ('', '本人')
        AND dispatchAmount > 0${dateFilter}${gradFilter}
    `).get(dateParams)

    const byReceiver = db.prepare(`
      SELECT CASE WHEN receiver = '' THEN '本人' ELSE receiver END as name,
        COUNT(*) as count, SUM(totalAmount) as revenue
      FROM Orders${w} GROUP BY name ORDER BY count DESC LIMIT 10
    `).all(dateParams)

    const byHandler = db.prepare(`
      SELECT CASE WHEN handler = '' THEN '本人' ELSE handler END as name,
        COUNT(*) as count, SUM(totalAmount) as revenue
      FROM Orders${w} GROUP BY name ORDER BY count DESC LIMIT 10
    `).all(dateParams)

    const byUniversity = db.prepare(`
      SELECT university as name, COUNT(*) as count, SUM(totalAmount) as revenue
      FROM Orders WHERE userId = @userId AND university != ''${dateFilter}${gradFilter}
      GROUP BY university ORDER BY count DESC LIMIT 10
    `).all(dateParams)

    let monthlyTrend
    if (year && month) {
      monthlyTrend = db.prepare(`
        SELECT strftime('%d', createdAt) as day,
          COUNT(*) as count, SUM(totalAmount) as revenue
        FROM Orders WHERE userId = @userId${dateFilter}${gradFilter}
        GROUP BY day ORDER BY day
      `).all(dateParams)
    } else if (year) {
      monthlyTrend = db.prepare(`
        SELECT strftime('%Y-%m', createdAt) as month,
          COUNT(*) as count, SUM(totalAmount) as revenue
        FROM Orders WHERE userId = @userId${dateFilter}${gradFilter}
        GROUP BY month ORDER BY month
      `).all(dateParams)
    } else {
      monthlyTrend = db.prepare(`
        SELECT strftime('%Y-%m', createdAt) as month,
          COUNT(*) as count, SUM(totalAmount) as revenue
        FROM Orders WHERE userId = @userId${gradFilter} GROUP BY month ORDER BY month DESC LIMIT 12
      `).all(gradFilter ? dateParams : { userId }).reverse()
    }

    const byStatus = db.prepare(`
      SELECT orderType,
        SUM(CASE WHEN isDraftSubmitted = 0 THEN 1 ELSE 0 END) as draftPending,
        SUM(CASE WHEN isDraftSubmitted = 1 THEN 1 ELSE 0 END) as draftDone
      FROM Orders${w} GROUP BY orderType
    `).all(dateParams)

    return {
      totalOrders,
      completedCount,
      titleMissingCount,
      overall: {
        totalRevenue: overall.totalRevenue || 0,
        totalPaid: overall.totalPaid || 0,
        totalDispatch: overall.totalDispatch || 0,
        totalRefund: overall.totalRefund || 0,
      },
      thesisBalance: thesisBalance.balance || 0,
      handlerPayment: {
        paidCount: handlerPayment.paidCount || 0,
        unpaidCount: handlerPayment.unpaidCount || 0,
        unpaidAmount: handlerPayment.unpaidAmount || 0,
      },
      byType,
      byStatus,
      byReceiver,
      byHandler,
      byUniversity,
      monthlyTrend,
      trendMode: year && month ? 'daily' : 'monthly',
    }
  })

  ipcMain.handle('stats:handlerDetail', (_, userId, handlerName, weekOffset, graduationYear) => {
    const handler = String(handlerName || '').trim()
    const offset = weekOffset || 0
    const gradCond = (graduationYear && graduationYear > 0) ? ' AND graduationYear = @graduationYear' : ''

    const allOrders = db.prepare(`
      SELECT id, title, orderType, totalAmount, dispatchAmount, handlerPaidAmount,
        CASE WHEN receiver = '' THEN '本人' ELSE receiver END as receiver, createdAt
      FROM Orders WHERE userId = @userId AND handler = @handler
        AND TRIM(COALESCE(handler, '')) NOT IN ('', '本人')${gradCond}
      ORDER BY createdAt DESC
    `).all({ userId, handler, graduationYear })

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - offset * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekOrders = db.prepare(`
      SELECT id, title, orderType, totalAmount, dispatchAmount, handlerPaidAmount,
        CASE WHEN receiver = '' THEN '本人' ELSE receiver END as receiver, createdAt
      FROM Orders
      WHERE userId = @userId AND handler = @handler
        AND TRIM(COALESCE(handler, '')) NOT IN ('', '本人')${gradCond}
      AND createdAt >= @start AND createdAt < @end
      ORDER BY createdAt DESC
    `).all({ userId, handler, graduationYear, start: weekStart.toISOString(), end: weekEnd.toISOString() })

    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as totalDispatch,
        SUM(handlerPaidAmount) as paidAmount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount,
        SUM(CASE WHEN handlerPaidAmount >= dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN handlerPaidAmount < dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as unpaidCount
      FROM Orders WHERE userId = @userId AND handler = @handler
        AND TRIM(COALESCE(handler, '')) NOT IN ('', '本人')${gradCond}
    `).get({ userId, handler, graduationYear })

    const weekStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as totalDispatch,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN handlerPaidAmount ELSE 0 END) as paidAmount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') AND dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
      FROM Orders
      WHERE userId = @userId AND handler = @handler
        AND TRIM(COALESCE(handler, '')) NOT IN ('', '本人')${gradCond}
      AND createdAt >= @start AND createdAt < @end
    `).get({ userId, handler, graduationYear, start: weekStart.toISOString(), end: weekEnd.toISOString() })

    const weekLabel = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')} ~ ${weekEnd.getFullYear()}-${String(weekEnd.getMonth()+1).padStart(2,'0')}-${String(weekEnd.getDate()-1).padStart(2,'0')}`

    return {
      allOrders,
      total: {
        orderCount: totalStats.orderCount || 0,
        totalDispatch: totalStats.totalDispatch || 0,
        paidAmount: totalStats.paidAmount || 0,
        unpaidAmount: totalStats.unpaidAmount || 0,
        paidCount: totalStats.paidCount || 0,
        unpaidCount: totalStats.unpaidCount || 0,
      },
      week: {
        label: weekLabel,
        orderCount: weekStats.orderCount || 0,
        totalDispatch: weekStats.totalDispatch || 0,
        paidAmount: weekStats.paidAmount || 0,
        unpaidAmount: weekStats.unpaidAmount || 0,
        orders: weekOrders,
      },
    }
  })

  ipcMain.handle('stats:receiverDetail', (_, userId, receiverName, graduationYear) => {
    const receiver = receiverName === '本人' ? '' : receiverName
    const gradCond = (graduationYear && graduationYear > 0) ? ' AND graduationYear = @graduationYear' : ''

    const allOrders = db.prepare(`
      SELECT id, title, orderType, totalAmount, paidAmount,
        CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END as dispatchAmount,
        CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN handlerPaidAmount ELSE 0 END as handlerPaidAmount,
        CASE WHEN TRIM(COALESCE(handler, '')) IN ('', '本人') THEN '本人' ELSE handler END as handler, createdAt
      FROM Orders WHERE userId = @userId AND (receiver = @receiver OR (@receiver = '' AND receiver = ''))${gradCond}
      ORDER BY createdAt DESC
    `).all({ userId, receiver, graduationYear })

    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(totalAmount) as totalAmount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as totalDispatch,
        SUM(paidAmount) as paidAmount,
        SUM(CASE WHEN totalAmount > paidAmount THEN totalAmount - paidAmount ELSE 0 END) as unpaidAmount,
        SUM(CASE WHEN totalAmount > 0 AND paidAmount >= totalAmount THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN totalAmount > 0 AND paidAmount < totalAmount THEN 1 ELSE 0 END) as unpaidCount
      FROM Orders WHERE userId = @userId AND (receiver = @receiver OR (@receiver = '' AND receiver = ''))${gradCond}
    `).get({ userId, receiver, graduationYear })

    const byHandler = db.prepare(`
      SELECT
        CASE WHEN TRIM(COALESCE(handler, '')) IN ('', '本人') THEN '本人' ELSE handler END as name,
        COUNT(*) as orderCount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN dispatchAmount ELSE 0 END) as totalDispatch,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') THEN handlerPaidAmount ELSE 0 END) as paidAmount,
        SUM(CASE WHEN TRIM(COALESCE(handler, '')) NOT IN ('', '本人') AND dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
      FROM Orders WHERE userId = @userId AND (receiver = @receiver OR (@receiver = '' AND receiver = ''))${gradCond}
      GROUP BY name ORDER BY orderCount DESC
    `).all({ userId, receiver, graduationYear })

    return {
      allOrders,
      total: {
        orderCount: totalStats.orderCount || 0,
        totalAmount: totalStats.totalAmount || 0,
        totalDispatch: totalStats.totalDispatch || 0,
        paidAmount: totalStats.paidAmount || 0,
        unpaidAmount: totalStats.unpaidAmount || 0,
        paidCount: totalStats.paidCount || 0,
        unpaidCount: totalStats.unpaidCount || 0,
      },
      byHandler,
    }
  })

  // ===== Settings =====
  ipcMain.handle('settings:get', (_, key) => {
    const row = db.prepare('SELECT value FROM Settings WHERE key = ?').get(key)
    return row ? row.value : null
  })

  ipcMain.handle('settings:set', (_, key, value) => {
    db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run(key, value)
    return true
  })

  ipcMain.handle('settings:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('sync:getOverview', (_, userId) => {
    if (!userId) return { status: '未登录', summary: { totalCount: 0, details: [], text: '请先登录后再查看同步状态' } }
    return getSyncOverview(userId)
  })

  ipcMain.handle('sync:run', (_, userId) => {
    if (!userId) return { success: false, error: 'INVALID_USER' }
    const syncDir = getSyncDirectory()
    if (!syncDir) return { success: false, error: 'SYNC_DIR_NOT_SET' }
    ensureSharedSyncDirs(syncDir)
    const localEventCount = db.prepare('SELECT COUNT(*) AS c FROM SyncEvents WHERE userId = ? AND deviceId = ?').get(userId, getSyncDeviceId()).c
    if (localEventCount === 0 && !hasAnyRemoteEvent(syncDir)) {
      seedBaselineSyncEvents(userId)
    }
    const imported = importSyncEvents(syncDir, userId)
    const exported = exportPendingSyncEvents(syncDir, userId)
    const finishedAt = nowIso()
    setSettingValue(getSyncSettingKey('lastSuccessAt'), finishedAt)
    return {
      success: true,
      imported,
      exported,
      finishedAt,
      overview: getSyncOverview(userId),
    }
  })

  ipcMain.handle('migration:selectImportFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: '迁移文件', extensions: ['json', 'gradtrack-export'] }],
      title: '选择迁移文件',
    })
    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('migration:export', (_, userId) => {
    if (!userId) return { success: false, error: 'INVALID_USER' }
    const fs = require('fs')
    const user = ensureUserSyncScope(db.prepare('SELECT id, username, syncScope FROM Users WHERE id = ?').get(userId))
    if (!user) return { success: false, error: 'USER_NOT_FOUND' }
    const rootRow = db.prepare('SELECT value FROM Settings WHERE key = ?').get('rootDirectory')
    const orders = db.prepare('SELECT * FROM Orders WHERE userId = ? ORDER BY id ASC').all(userId)
    const orderIds = orders.map(o => o.id)
    const revisions = orderIds.length > 0
      ? db.prepare(`SELECT r.* FROM Revisions r JOIN Orders o ON r.orderId = o.id WHERE o.userId = ? ORDER BY r.id ASC`).all(userId)
      : []
    const feedback = revisions.length > 0
      ? db.prepare(`SELECT fi.* FROM FeedbackItems fi JOIN Revisions r ON fi.revisionId = r.id JOIN Orders o ON r.orderId = o.id WHERE o.userId = ? ORDER BY fi.id ASC`).all(userId)
      : []
    const designTypes = db.prepare('SELECT * FROM DesignTypeDefs ORDER BY sortOrder ASC').all()
    const payload = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      exportRoot: rootRow?.value || '',
      user: { id: user.id, username: user.username, syncScope: user.syncScope },
      data: {
        orders,
        revisions,
        feedback,
        designTypes,
      },
    }
    const defaultName = `gradtrack-export-${new Date().toISOString().slice(0, 10)}.gradtrack-export`
    const saveResult = dialog.showSaveDialogSync(mainWindow, {
      title: '导出迁移文件',
      defaultPath: defaultName,
      filters: [{ name: 'GradTrack Export', extensions: ['gradtrack-export', 'json'] }],
    })
    if (!saveResult) return { success: false, cancelled: true }
    fs.writeFileSync(saveResult, JSON.stringify(payload, null, 2), 'utf8')
    return {
      success: true,
      filePath: saveResult,
      summary: {
        orderCount: orders.length,
        revisionCount: revisions.length,
        feedbackCount: feedback.length,
      },
      exportRoot: payload.exportRoot,
    }
  })

  ipcMain.handle('migration:import', (_, { filePath, newRoot, currentUserId, oldRootOverride }) => {
    if (!filePath || !newRoot || !currentUserId) return { success: false, error: 'INVALID_PARAMS' }
    const fs = require('fs')
    if (!fs.existsSync(filePath)) return { success: false, error: 'FILE_NOT_FOUND' }
    let payload
    try {
      payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return { success: false, error: 'INVALID_FILE_FORMAT' }
    }
    if (!payload || payload.formatVersion !== 1 || !payload.data) {
      return { success: false, error: 'UNSUPPORTED_FORMAT' }
    }
    const oldRoot = normalizeRootPath(oldRootOverride || payload.exportRoot || '')
    if (!oldRoot) return { success: false, error: 'MISSING_OLD_ROOT' }
    const normalizedNewRoot = normalizeRootPath(newRoot)
    const currentUser = ensureUserSyncScope(db.prepare('SELECT id, username, syncScope FROM Users WHERE id = ?').get(currentUserId))
    if (!currentUser) return { success: false, error: 'USER_NOT_FOUND' }
    const importedSyncScope = payload.user?.syncScope || currentUser.syncScope || buildSyncScopeFromUsername(currentUser.username)
    const importedOrders = Array.isArray(payload.data.orders) ? payload.data.orders : []
    const importedRevisions = Array.isArray(payload.data.revisions) ? payload.data.revisions : []
    const importedFeedback = Array.isArray(payload.data.feedback) ? payload.data.feedback : []
    const importedDesignTypes = Array.isArray(payload.data.designTypes) ? payload.data.designTypes : []

    const missingPaths = []
    const missingOrderFolders = []
    const importTxn = db.transaction(() => {
      db.prepare('UPDATE Users SET syncScope = ? WHERE id = ?').run(importedSyncScope, currentUserId)
      db.prepare('DELETE FROM SyncEvents WHERE userId = ?').run(currentUserId)
      const orderIds = db.prepare('SELECT id FROM Orders WHERE userId = ?').all(currentUserId).map(r => r.id)
      for (const oid of orderIds) {
        const revIds = db.prepare('SELECT id FROM Revisions WHERE orderId = ?').all(oid).map(r => r.id)
        for (const rid of revIds) db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(rid)
        db.prepare('DELETE FROM Revisions WHERE orderId = ?').run(oid)
      }
      db.prepare('DELETE FROM Orders WHERE userId = ?').run(currentUserId)

      if (importedDesignTypes.length > 0) {
        db.prepare('DELETE FROM DesignTypeDefs').run()
        const insertDT = db.prepare('INSERT INTO DesignTypeDefs (typeName, subTypes, statuses, sortOrder) VALUES (?, ?, ?, ?)')
        for (const dt of importedDesignTypes) {
          insertDT.run(
            dt.typeName || '',
            dt.subTypes || '[]',
            dt.statuses || '[]',
            Number(dt.sortOrder) || 0
          )
        }
      }

      const orderMap = new Map()
      const insertOrder = db.prepare(`
        INSERT INTO Orders (userId, title, university, college, major, studentName, wechatName, orderCode, groupChatName, specialService, includesDesign, designType, designSubType, designStatus, orderType, formatMode, packageTier, hasOriginalText, receiver, handler, advisor, deadline, totalAmount, paidAmount, dispatchAmount, isDesignFinished, folderPath, graduationYear, createdAt, isDraftSubmitted, refundAmount, isHandlerPaid, handlerPaidAmount, syncUuid)
        VALUES (@userId, @title, @university, @college, @major, @studentName, @wechatName, @orderCode, @groupChatName, @specialService, @includesDesign, @designType, @designSubType, @designStatus, @orderType, @formatMode, @packageTier, @hasOriginalText, @receiver, @handler, @advisor, @deadline, @totalAmount, @paidAmount, @dispatchAmount, @isDesignFinished, @folderPath, @graduationYear, @createdAt, @isDraftSubmitted, @refundAmount, @isHandlerPaid, @handlerPaidAmount, @syncUuid)
      `)
      for (const o of importedOrders) {
        const mappedPath = replacePathPrefix(oldRoot, normalizedNewRoot, o.folderPath || '')
        const createdAt = o.createdAt || new Date().toISOString()
        const importedOrderCode = String(o.orderCode || '').trim()
          || String(o.groupChatName || '').trim()
          || generateNextOrderCode(currentUserId, o, new Date(createdAt))
        const importedHandler = String(o.handler || '').trim() || '本人'
        const importedSelfHandled = isSelfHandlerValue(importedHandler)
        const result = insertOrder.run({
          userId: currentUserId,
          title: o.title || '',
          university: o.university || '',
          college: o.college || '',
          major: o.major || '',
          studentName: o.studentName || '',
          wechatName: o.wechatName || '',
          orderCode: importedOrderCode,
          groupChatName: o.groupChatName || importedOrderCode,
          specialService: o.specialService || '',
          includesDesign: Number(o.includesDesign) || 0,
          designType: o.designType || '',
          designSubType: o.designSubType || '',
          designStatus: o.designStatus || '',
          orderType: o.orderType || 'thesis',
          formatMode: o.formatMode || '',
          packageTier: normalizePackageTier(o.packageTier),
          hasOriginalText: Number(o.hasOriginalText) || 0,
          receiver: o.receiver || '',
          handler: importedHandler,
          advisor: o.advisor || '',
          deadline: o.deadline || '',
          totalAmount: Number(o.totalAmount) || 0,
          paidAmount: Number(o.paidAmount) || 0,
          dispatchAmount: importedSelfHandled ? 0 : (Number(o.dispatchAmount) || 0),
          isDesignFinished: Number(o.isDesignFinished) || 0,
          folderPath: mappedPath,
          graduationYear: Number(o.graduationYear) || 0,
          createdAt,
          isDraftSubmitted: Number(o.isDraftSubmitted) || 0,
          refundAmount: Number(o.refundAmount) || 0,
          isHandlerPaid: importedSelfHandled ? 0 : (Number(o.isHandlerPaid) || 0),
          handlerPaidAmount: importedSelfHandled ? 0 : (Number(o.handlerPaidAmount) || 0),
          syncUuid: o.syncUuid || makeSyncId(),
        })
        orderMap.set(o.id, Number(result.lastInsertRowid))
        if (mappedPath && !fs.existsSync(mappedPath)) {
          if (missingPaths.length < 30) missingPaths.push(mappedPath)
          if (missingOrderFolders.length < 30) {
            missingOrderFolders.push({
              title: o.title || '未命名订单',
              path: mappedPath,
            })
          }
        }
      }

      const revMap = new Map()
      const insertRev = db.prepare(
        'INSERT INTO Revisions (orderId, title, folderPath, deadline, isExpanded, createdAt, syncUuid) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      for (const r of importedRevisions) {
        const mappedOrderId = orderMap.get(r.orderId)
        if (!mappedOrderId) continue
        const mappedPath = replacePathPrefix(oldRoot, normalizedNewRoot, r.folderPath || '')
        const result = insertRev.run(
          mappedOrderId,
          r.title || '',
          mappedPath,
          r.deadline || null,
          Number(r.isExpanded) || 0,
          r.createdAt || new Date().toISOString(),
          r.syncUuid || makeSyncId()
        )
        revMap.set(r.id, Number(result.lastInsertRowid))
        if (mappedPath && !fs.existsSync(mappedPath) && missingPaths.length < 30) missingPaths.push(mappedPath)
      }

      const insertFeedback = db.prepare(
        'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments, syncUuid) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      for (const fi of importedFeedback) {
        const mappedRevId = revMap.get(fi.revisionId)
        if (!mappedRevId) continue
        const mappedImagePath = fi.imagePath ? replacePathPrefix(oldRoot, normalizedNewRoot, fi.imagePath) : null
        const mappedAttachments = rewriteAttachmentsJson(fi.attachments || '[]', oldRoot, normalizedNewRoot)
        insertFeedback.run(
          mappedRevId,
          fi.content || '',
          Number(fi.isResolved) || 0,
          Number(fi.hasImage) || 0,
          mappedImagePath,
          mappedAttachments,
          fi.syncUuid || makeSyncId()
        )
      }

      db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run('rootDirectory', normalizedNewRoot)
    })

    try {
      importTxn()
    } catch (err) {
      return { success: false, error: err.message || 'IMPORT_FAILED' }
    }

    setSettingValue(getSyncSettingKey('lastSuccessAt'), '')

    return {
      success: true,
      syncScope: importedSyncScope,
      summary: {
        orderCount: importedOrders.length,
        revisionCount: importedRevisions.length,
        feedbackCount: importedFeedback.length,
      },
      missingPaths,
      missingOrderFolders,
    }
  })

  ipcMain.handle('folderMigration:previewGraduation', (_, userId) => {
    return buildGraduationFolderMigrationPreview(userId)
  })

  ipcMain.handle('folderMigration:runGraduation', (_, userId) => {
    return runGraduationFolderMigration(userId)
  })

  // ===== Auto Launch =====
  ipcMain.handle('autoLaunch:get', () => {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  })

  ipcMain.handle('autoLaunch:set', (_, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return true
  })

  // ===== Orders =====
  ipcMain.handle('orders:graduationYears', (_, userId) => {
    return db.prepare(`
      SELECT DISTINCT graduationYear as year
      FROM Orders WHERE userId = ? AND graduationYear > 0
      ORDER BY year DESC
    `).all(userId).map(r => r.year)
  })

  ipcMain.handle('orders:list', (_, userId, search, orderType, graduationYear, sortMode = 'deadline_asc') => {
    let query = `
      SELECT o.*,
        (SELECT COUNT(*) FROM FeedbackItems fi
         JOIN Revisions r ON fi.revisionId = r.id
         WHERE r.orderId = o.id AND fi.isResolved = 0) as pendingCount,
        (SELECT COUNT(*) FROM Revisions r
         JOIN FeedbackItems fi ON fi.revisionId = r.id
         WHERE r.orderId = o.id AND fi.isResolved = 0
         AND r.deadline < datetime('now')) as overdueCount,
        (SELECT MIN(r.deadline) FROM Revisions r
         WHERE r.orderId = o.id AND r.deadline IS NOT NULL
         AND EXISTS (SELECT 1 FROM FeedbackItems fi WHERE fi.revisionId = r.id AND fi.isResolved = 0)
        ) as nearestRevisionDeadline,
        (SELECT COUNT(*) FROM Revisions r WHERE r.orderId = o.id) as revisionCount
      FROM Orders o WHERE o.userId = ?
    `
    const params = [userId]

    if (graduationYear && graduationYear > 0) {
      query += ` AND o.graduationYear = ?`
      params.push(graduationYear)
    }

    if (orderType && orderType !== 'all') {
      query += ` AND o.orderType = ?`
      params.push(orderType)
    }

    if (search) {
      query += ` AND (o.title LIKE ? OR o.university LIKE ? OR o.college LIKE ? OR o.major LIKE ? OR o.advisor LIKE ? OR o.receiver LIKE ? OR o.handler LIKE ? OR o.studentName LIKE ? OR o.wechatName LIKE ? OR o.orderCode LIKE ? OR o.groupChatName LIKE ? OR o.specialService LIKE ?)`
      const s = `%${search}%`
      params.push(s, s, s, s, s, s, s, s, s, s, s, s)
    }

    query += ` ORDER BY ${getOrderSortClause(sortMode)}`
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('orders:get', (_, userId, id) => {
    return db.prepare('SELECT * FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
  })

  ipcMain.handle('orders:distinctValues', (_, userId, field) => {
    const allowed = ['university', 'college', 'major', 'receiver', 'handler', 'advisor']
    if (!allowed.includes(field)) return []
    const hidden = getHiddenHistoryValues(userId, field)
    return db.prepare(`SELECT DISTINCT ${field} AS val FROM Orders WHERE userId = ? AND ${field} != '' ORDER BY val ASC`).all(userId).map(r => r.val).filter(value => !hidden.includes(value))
  })

  ipcMain.handle('orders:removeHistoryValue', (_, userId, field, value) => {
    if (!HISTORY_FIELDS.includes(field) || typeof value !== 'string' || !userId) return false
    const hidden = getHiddenHistoryValues(userId, field)
    if (!hidden.includes(value)) hidden.push(value)
    setSettingValue(`hiddenHistory:${userId}:${field}`, JSON.stringify(hidden))
    return true
  })

  ipcMain.handle('orders:create', (_, data) => {
    const stmt = db.prepare(`
      INSERT INTO Orders (userId, title, university, college, major, studentName, wechatName, orderCode, groupChatName, specialService, includesDesign, designType, designSubType, designStatus, orderType, formatMode, packageTier, hasOriginalText, receiver, handler, advisor, deadline, totalAmount, paidAmount, dispatchAmount, isDesignFinished, folderPath, graduationYear, createdAt, syncUuid)
      VALUES (@userId, @title, @university, @college, @major, @studentName, @wechatName, @orderCode, @groupChatName, @specialService, @includesDesign, @designType, @designSubType, @designStatus, @orderType, @formatMode, @packageTier, @hasOriginalText, @receiver, @handler, @advisor, @deadline, @totalAmount, @paidAmount, @dispatchAmount, 0, @folderPath, @graduationYear, datetime('now'), @syncUuid)
    `)
    const now = new Date()
    const defaultGradYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
    const orderData = {
      designType: '', designSubType: '', designStatus: '',
      orderType: 'thesis', formatMode: '', packageTier: '', hasOriginalText: 0, specialService: '',
      dispatchAmount: 0, graduationYear: defaultGradYear, syncUuid: makeSyncId(),
      ...data,
    }
    orderData.packageTier = normalizePackageTier(orderData.packageTier)
    if (isSelfHandlerValue(orderData.handler)) {
      orderData.handler = '本人'
      orderData.dispatchAmount = 0
    }
    const manualGroupChatName = String(orderData.groupChatName || '').trim()
    orderData.orderCode = String(orderData.orderCode || '').trim()
      || manualGroupChatName
      || generateNextOrderCode(orderData.userId, orderData, now)
    const duplicateOrder = db.prepare(`
      SELECT id FROM Orders
      WHERE userId = ? AND orderCode = ? COLLATE NOCASE
    `).get(orderData.userId, orderData.orderCode)
    if (duplicateOrder) {
      throw new Error(`订单编号“${orderData.orderCode}”已存在，请检查群聊名称或使用其他编号。`)
    }
    orderData.groupChatName = manualGroupChatName || orderData.orderCode
    const result = stmt.run(orderData)
    for (const field of HISTORY_FIELDS) {
      const hidden = getHiddenHistoryValues(orderData.userId, field)
      if (hidden.includes(orderData[field])) {
        setSettingValue(`hiddenHistory:${orderData.userId}:${field}`, JSON.stringify(hidden.filter(value => value !== orderData[field])))
      }
    }
    const orderRow = getOrderById(Number(result.lastInsertRowid))
    recordOrderSyncEvent('create', orderRow)
    return result.lastInsertRowid
  })

  ipcMain.handle('orders:update', (_, userId, id, data) => {
    // Verify the order belongs to the user before updating
    const order = db.prepare('SELECT id FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
    if (!order) return false

    const normalizedData = normalizeOrderUpdateData(data)
    const fields = Object.keys(normalizedData).map(k => `${k} = @${k}`).join(', ')
    if (!fields) return true
    db.prepare(`UPDATE Orders SET ${fields} WHERE id = @id AND userId = @userId`).run({ ...normalizedData, id, userId })
    const orderRow = getOrderById(id)
    recordOrderSyncEvent('update', orderRow, Object.keys(normalizedData))
    return true
  })

  ipcMain.handle('orders:updateWithFolder', (_, userId, id, data, renameFolder = false) => {
    const existingOrder = db.prepare('SELECT * FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
    if (!existingOrder) return { success: false, error: 'ORDER_NOT_FOUND' }

    const normalizedData = normalizeOrderUpdateData(data)
    if (!renameFolder || !existingOrder.folderPath) {
      const fields = Object.keys(normalizedData).map(k => `${k} = @${k}`).join(', ')
      if (fields) {
        db.prepare(`UPDATE Orders SET ${fields} WHERE id = @id AND userId = @userId`).run({ ...normalizedData, id, userId })
        recordOrderSyncEvent('update', getOrderById(id), Object.keys(normalizedData))
      }
      return { success: true, folderRenamed: false, folderPath: existingOrder.folderPath || '' }
    }

    const rootDirectory = getRootDirectory()
    const oldFolderPath = path.normalize(existingOrder.folderPath)
    if (!rootDirectory) return { success: false, error: 'ROOT_DIR_NOT_SET' }
    if (!fs.existsSync(oldFolderPath)) return { success: false, error: 'SOURCE_NOT_FOUND', oldFolderPath }
    if (isSamePath(rootDirectory, oldFolderPath) || !isPathWithin(rootDirectory, oldFolderPath)) {
      return { success: false, error: 'OUTSIDE_ROOT', oldFolderPath }
    }

    const nextOrder = { ...existingOrder, ...normalizedData }
    const newFolderPath = path.join(path.dirname(oldFolderPath), buildOrderFolderName(nextOrder))
    if (!isPathWithin(rootDirectory, newFolderPath)) {
      return { success: false, error: 'OUTSIDE_ROOT', oldFolderPath, newFolderPath }
    }
    if (isSamePath(oldFolderPath, newFolderPath)) {
      const fields = Object.keys(normalizedData).map(k => `${k} = @${k}`).join(', ')
      if (fields) {
        db.prepare(`UPDATE Orders SET ${fields} WHERE id = @id AND userId = @userId`).run({ ...normalizedData, id, userId })
        recordOrderSyncEvent('update', getOrderById(id), Object.keys(normalizedData))
      }
      return { success: true, folderRenamed: false, folderPath: oldFolderPath }
    }
    if (fs.existsSync(newFolderPath)) {
      return { success: false, error: 'TARGET_EXISTS', oldFolderPath, newFolderPath }
    }

    let folderRenamed = false
    try {
      fs.renameSync(oldFolderPath, newFolderPath)
      folderRenamed = true
      const updateTxn = db.transaction(() => {
        updateRelatedPathsForOrderFolder(id, oldFolderPath, newFolderPath)
        const updateData = { ...normalizedData, folderPath: newFolderPath }
        const fields = Object.keys(updateData).map(k => `${k} = @${k}`).join(', ')
        db.prepare(`UPDATE Orders SET ${fields} WHERE id = @id AND userId = @userId`).run({ ...updateData, id, userId })
        recordOrderSyncEvent('update', getOrderById(id), Object.keys(updateData))
      })
      updateTxn()
      return { success: true, folderRenamed: true, oldFolderPath, folderPath: newFolderPath }
    } catch (err) {
      let rollbackError = ''
      if (folderRenamed && fs.existsSync(newFolderPath) && !fs.existsSync(oldFolderPath)) {
        try {
          fs.renameSync(newFolderPath, oldFolderPath)
        } catch (rollbackErr) {
          rollbackError = rollbackErr.message || String(rollbackErr)
        }
      }
      return {
        success: false,
        error: 'RENAME_FAILED',
        message: err.message || String(err),
        rollbackError,
        oldFolderPath,
        newFolderPath,
      }
    }
  })

  ipcMain.handle('orders:delete', (_, userId, id, options = {}) => {
    // Verify the order belongs to the user before deleting
    const order = db.prepare('SELECT id FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
    if (!order) return { success: false, error: 'ORDER_NOT_FOUND' }
    
    const orderRow = getOrderById(id)
    const deleteFolder = !!options.deleteFolder
    let folderDeleteResult = {
      requested: deleteFolder,
      deleted: false,
      skipped: !deleteFolder,
      error: '',
      path: orderRow?.folderPath || '',
    }

    const deleteTransaction = db.transaction(() => {
      const revisions = db.prepare('SELECT id FROM Revisions WHERE orderId = ?').all(id)
      for (const rev of revisions) {
        db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(rev.id)
      }
      db.prepare('DELETE FROM Revisions WHERE orderId = ?').run(id)
      db.prepare('DELETE FROM Orders WHERE id = ? AND userId = ?').run(id, userId)
    })
    deleteTransaction()
    recordOrderSyncEvent('delete', orderRow)

    if (deleteFolder) {
      const validation = validateOrderFolderDeletion(orderRow?.folderPath || '', getRootDirectory())
      folderDeleteResult = {
        requested: true,
        deleted: false,
        skipped: false,
        error: '',
        path: validation.path || orderRow?.folderPath || '',
      }
      if (!validation.ok) {
        folderDeleteResult.error = validation.error || '文件夹校验失败'
      } else if (validation.missing) {
        folderDeleteResult.skipped = true
        folderDeleteResult.error = '文件夹不存在，已跳过删除'
      } else {
        try {
          fs.rmSync(validation.path, { recursive: true, force: true })
          folderDeleteResult.deleted = true
        } catch (err) {
          folderDeleteResult.error = err.message || '文件夹删除失败'
        }
      }
    }

    return {
      success: true,
      folder: folderDeleteResult,
    }
  })

  // ===== Revisions =====
  ipcMain.handle('revisions:listByOrder', (_, orderId) => {
    const revisions = db.prepare('SELECT * FROM Revisions WHERE orderId = ? ORDER BY createdAt ASC').all(orderId)
    for (const rev of revisions) {
      rev.items = db.prepare('SELECT * FROM FeedbackItems WHERE revisionId = ? ORDER BY id ASC').all(rev.id)
    }
    return revisions
  })

  ipcMain.handle('revisions:create', (_, orderId, title, orderFolderPath) => {
    let revFolderPath = ''
    if (orderFolderPath) {
      const sanitized = title.replace(/[<>:"/\\|?*]/g, '_')
      revFolderPath = path.join(orderFolderPath, '论文文件', '论文稿件', sanitized)
      try {
        fs.mkdirSync(revFolderPath, { recursive: true })
        fs.mkdirSync(path.join(revFolderPath, '修改后文件'), { recursive: true })
      } catch (err) {
        console.error('[revisions:create] Failed to create folder:', err)
      }
    }
    const result = db.prepare(
      'INSERT INTO Revisions (orderId, title, folderPath, deadline, isExpanded, createdAt, syncUuid) VALUES (?, ?, ?, NULL, 1, datetime(\'now\'), ?)'
    ).run(orderId, title, revFolderPath, makeSyncId())
    const revisionRow = getRevisionWithContextById(Number(result.lastInsertRowid))
    recordRevisionSyncEvent('create', revisionRow)
    return result.lastInsertRowid
  })

  ipcMain.handle('revisions:update', (_, id, data) => {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE Revisions SET ${fields} WHERE id = @id`).run({ ...data, id })
    const revisionRow = getRevisionWithContextById(id)
    recordRevisionSyncEvent('update', revisionRow, Object.keys(data))
    return true
  })

  ipcMain.handle('revisions:delete', (_, id) => {
    const revisionRow = getRevisionWithContextById(id)
    db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(id)
    db.prepare('DELETE FROM Revisions WHERE id = ?').run(id)
    recordRevisionSyncEvent('delete', revisionRow)
    return true
  })

  // ===== FeedbackItems =====
  ipcMain.handle('feedback:create', (_, revisionId, content, attachments) => {
    const att = attachments && attachments.length > 0 ? JSON.stringify(attachments) : '[]'
    const hasImg = attachments && attachments.length > 0 ? 1 : 0
    const result = db.prepare(
      'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments, syncUuid) VALUES (?, ?, 0, ?, NULL, ?, ?)'
    ).run(revisionId, content, hasImg, att, makeSyncId())
    const feedbackRow = getFeedbackWithContextById(Number(result.lastInsertRowid))
    recordFeedbackSyncEvent('create', feedbackRow, attachments?.length ? ['attachments'] : [])
    return result.lastInsertRowid
  })

  ipcMain.handle('feedback:batchCreate', (_, revisionId, contents) => {
    const stmt = db.prepare(
      'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments, syncUuid) VALUES (?, ?, 0, 0, NULL, \'[]\', ?)'
    )
    const insertMany = db.transaction((items) => {
      const ids = []
      for (const content of items) {
        const result = stmt.run(revisionId, content, makeSyncId())
        ids.push(result.lastInsertRowid)
      }
      return ids
    })
    const ids = insertMany(contents)
    for (const id of ids) {
      const feedbackRow = getFeedbackWithContextById(Number(id))
      recordFeedbackSyncEvent('create', feedbackRow)
    }
    return ids
  })

  ipcMain.handle('feedback:toggleResolved', (_, id) => {
    db.prepare('UPDATE FeedbackItems SET isResolved = CASE WHEN isResolved = 0 THEN 1 ELSE 0 END WHERE id = ?').run(id)
    const feedbackRow = getFeedbackWithContextById(id)
    recordFeedbackSyncEvent('update', feedbackRow, ['isResolved'])
    return true
  })

  ipcMain.handle('feedback:update', (_, id, content) => {
    db.prepare('UPDATE FeedbackItems SET content = ? WHERE id = ?').run(content, id)
    const feedbackRow = getFeedbackWithContextById(id)
    recordFeedbackSyncEvent('update', feedbackRow, ['content'])
    return true
  })

  ipcMain.handle('feedback:delete', (_, id) => {
    const feedbackRow = getFeedbackWithContextById(id)
    const row = db.prepare('SELECT attachments FROM FeedbackItems WHERE id = ?').get(id)
    if (row && row.attachments) {
      try {
        const atts = JSON.parse(row.attachments)
        for (const a of atts) {
          if (a.path && fs.existsSync(a.path)) fs.unlinkSync(a.path)
        }
      } catch {}
    }
    db.prepare('DELETE FROM FeedbackItems WHERE id = ?').run(id)
    recordFeedbackSyncEvent('delete', feedbackRow, ['attachments'])
    return true
  })

  // ===== Attachments =====
  ipcMain.handle('attachment:save', (_, { buffer, filename, targetDir }) => {
    const attDir = targetDir || path.join(app.getPath('userData'), 'attachments')
    if (!fs.existsSync(attDir)) fs.mkdirSync(attDir, { recursive: true })
    let uniqueName = filename
    let filePath = path.join(attDir, uniqueName)
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename)
      const base = path.basename(filename, ext)
      uniqueName = `${base}_${Date.now()}${ext}`
      filePath = path.join(attDir, uniqueName)
    }
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, path: filePath, name: uniqueName }
  })

  ipcMain.handle('attachment:getPath', (_, filePath) => {
    return filePath
  })

  // ===== File System =====
  ipcMain.handle('fs:openFolder', async (_, folderPath) => {
    try {
      const fs = require('fs')
      if (!fs.existsSync(folderPath)) {
        return { success: false, error: 'FOLDER_NOT_FOUND' }
      }
      await shell.openPath(folderPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:createFolder', (_, folderPath) => {
    try {
      const fs = require('fs')
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true })
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:listFolderContents', (_, folderPath) => {
    const fs = require('fs')
    try {
      if (!fs.existsSync(folderPath)) return { success: false, error: 'FOLDER_NOT_FOUND', files: [] }
      const entries = fs.readdirSync(folderPath, { withFileTypes: true })
      const files = entries
        .filter(e => !e.name.startsWith('.'))
        .map(e => {
          const fullPath = path.join(folderPath, e.name)
          const stat = fs.statSync(fullPath)
          return {
            name: e.name,
            path: fullPath,
            isDirectory: e.isDirectory(),
            size: stat.size,
            modifiedAt: stat.mtimeMs,
          }
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
      return { success: true, files }
    } catch (err) {
      return { success: false, error: err.message, files: [] }
    }
  })

  ipcMain.handle('fs:copyFilesToFolder', (_, filePaths, targetFolder) => {
    const fs = require('fs')
    console.log('[copyFilesToFolder] filePaths:', filePaths, 'targetFolder:', targetFolder)
    try {
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: false, error: '没有提供要复制的文件路径' }
      }
      if (!targetFolder) {
        return { success: false, error: '目标文件夹路径为空' }
      }
      if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true })
      const copied = []
      for (const src of filePaths) {
        if (!fs.existsSync(src)) {
          console.warn('[copyFilesToFolder] Source not found:', src)
          continue
        }
        const name = path.basename(src)
        let dest = path.join(targetFolder, name)
        if (fs.existsSync(dest)) {
          const ext = path.extname(name)
          const base = path.basename(name, ext)
          dest = path.join(targetFolder, `${base}_${Date.now()}${ext}`)
        }
        const stat = fs.statSync(src)
        if (stat.isDirectory()) {
          copyDirRecursive(src, dest)
        } else {
          fs.copyFileSync(src, dest)
        }
        copied.push({ name: path.basename(dest), path: dest })
        console.log('[copyFilesToFolder] Copied:', src, '->', dest)
      }
      return { success: true, copied }
    } catch (err) {
      console.error('[copyFilesToFolder] Error:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:openFileInSystem', async (_, filePath) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:deleteFile', (_, filePath) => {
    const fs = require('fs')
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true })
        else fs.unlinkSync(filePath)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:revealInFinder', (_, filePath) => {
    shell.showItemInFolder(filePath)
    return { success: true }
  })

  ipcMain.handle('fs:selectItems', async (_, mode = 'both') => {
    const properties = ['multiSelections']
    if (mode === 'files') {
      properties.push('openFile')
    } else if (mode === 'folders') {
      properties.push('openDirectory')
    } else {
      if (process.platform === 'darwin') {
        properties.push('openFile', 'openDirectory')
      } else {
        properties.push('openFile', 'openDirectory')
      }
    }
    const titleMap = { files: '选择文件', folders: '选择文件夹', both: '选择文件或文件夹' }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties,
      title: titleMap[mode] || titleMap.both,
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // ===== Design Type Definitions =====
  ipcMain.handle('designTypes:list', () => {
    return db.prepare('SELECT * FROM DesignTypeDefs ORDER BY sortOrder ASC').all()
  })

  ipcMain.handle('designTypes:create', (_, { typeName, subTypes, statuses }) => {
    const maxSort = db.prepare('SELECT MAX(sortOrder) as m FROM DesignTypeDefs').get().m || 0
    const result = db.prepare(
      'INSERT INTO DesignTypeDefs (typeName, subTypes, statuses, sortOrder) VALUES (?, ?, ?, ?)'
    ).run(typeName, JSON.stringify(subTypes || []), JSON.stringify(statuses || []), maxSort + 1)
    return result.lastInsertRowid
  })

  ipcMain.handle('designTypes:update', (_, id, data) => {
    console.log('[designTypes:update] id=', id, 'data=', JSON.stringify(data))
    const fields = []
    const params = { id }
    if (data.typeName !== undefined) { fields.push('typeName = @typeName'); params.typeName = data.typeName }
    if (data.subTypes !== undefined) { fields.push('subTypes = @subTypes'); params.subTypes = JSON.stringify(data.subTypes) }
    if (data.statuses !== undefined) { fields.push('statuses = @statuses'); params.statuses = JSON.stringify(data.statuses) }
    if (data.sortOrder !== undefined) { fields.push('sortOrder = @sortOrder'); params.sortOrder = data.sortOrder }
    if (fields.length > 0) {
      const sql = `UPDATE DesignTypeDefs SET ${fields.join(', ')} WHERE id = @id`
      console.log('[designTypes:update] SQL=', sql, 'params=', JSON.stringify(params))
      db.prepare(sql).run(params)
    } else {
      console.log('[designTypes:update] No fields to update!')
    }
    return true
  })

  ipcMain.handle('designTypes:delete', (_, id) => {
    db.prepare('DELETE FROM DesignTypeDefs WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('fs:generateOrderFolder', (_, { rootDirectory, university, major, studentName, title, includesDesign, orderType, graduationYear }) => {
    const type = orderType || 'thesis'
    const folderPath = buildGraduationOrderFolderPath(rootDirectory, {
      university,
      major,
      studentName,
      title,
      orderType: type,
      graduationYear,
    })
    try {
      const fs = require('fs')
      fs.mkdirSync(folderPath, { recursive: true })
      if (['format', 'reduction', 'special'].includes(type)) {
        fs.mkdirSync(path.join(folderPath, '客户源文件'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '修改后文件'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '客户要求'), { recursive: true })
      } else if (type === 'translation') {
        fs.mkdirSync(path.join(folderPath, '源文件'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '交付文件'), { recursive: true })
      } else {
        fs.mkdirSync(path.join(folderPath, '论文文件', '外文翻译'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '论文文件', '论文稿件'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '论文文件', '论文稿件', '初稿'), { recursive: true })
        fs.mkdirSync(path.join(folderPath, '客户提供的需求文件'), { recursive: true })
        if (includesDesign || type === 'design') {
          fs.mkdirSync(path.join(folderPath, '设计文件'), { recursive: true })
        }
      }
      return { success: true, folderPath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
