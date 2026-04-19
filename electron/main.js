const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { initDatabase, getDb } = require('./database')

const isMac = process.platform === 'darwin'
let mainWindow
let tray = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  const winOptions = {
    width: 1360,
    height: 840,
    minWidth: 1040,
    minHeight: 600,
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

  mainWindow = new BrowserWindow(winOptions)

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
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
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
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
        mainWindow.show()
        mainWindow.focus()
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

function registerIpcHandlers() {
  const db = getDb()

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
    const result = db.prepare('INSERT INTO Users (username, password) VALUES (?, ?)').run(username, password)
    return { success: true, user: { id: Number(result.lastInsertRowid), username } }
  })

  ipcMain.handle('auth:login', (_, username, password) => {
    const user = db.prepare('SELECT id, username, password FROM Users WHERE username = ?').get(username)
    if (!user || user.password !== password) return null
    return { id: user.id, username: user.username }
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
        SUM(dispatchAmount) as dispatch,
        SUM(refundAmount) as refund,
        SUM(paidAmount) as paid
      FROM Orders${w} GROUP BY orderType
    `).all(dateParams)

    const overall = db.prepare(`
      SELECT
        SUM(totalAmount) as totalRevenue,
        SUM(paidAmount) as totalPaid,
        SUM(dispatchAmount) as totalDispatch,
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

    const handlerPayment = db.prepare(`
      SELECT
        SUM(CASE WHEN handlerPaidAmount >= dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN handlerPaidAmount < dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as unpaidCount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
      FROM Orders WHERE userId = @userId AND dispatchAmount > 0${dateFilter}${gradFilter}
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
    const handler = handlerName === '本人' ? '' : handlerName
    const offset = weekOffset || 0
    const gradCond = (graduationYear && graduationYear > 0) ? ' AND graduationYear = @graduationYear' : ''

    const allOrders = db.prepare(`
      SELECT id, title, orderType, totalAmount, dispatchAmount, handlerPaidAmount,
        CASE WHEN receiver = '' THEN '本人' ELSE receiver END as receiver, createdAt
      FROM Orders WHERE userId = @userId AND (handler = @handler OR (@handler = '' AND handler = ''))${gradCond}
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
      WHERE userId = @userId AND (handler = @handler OR (@handler = '' AND handler = ''))${gradCond}
      AND createdAt >= @start AND createdAt < @end
      ORDER BY createdAt DESC
    `).all({ userId, handler, graduationYear, start: weekStart.toISOString(), end: weekEnd.toISOString() })

    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(dispatchAmount) as totalDispatch,
        SUM(handlerPaidAmount) as paidAmount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount,
        SUM(CASE WHEN handlerPaidAmount >= dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN handlerPaidAmount < dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as unpaidCount
      FROM Orders WHERE userId = @userId AND (handler = @handler OR (@handler = '' AND handler = ''))${gradCond}
    `).get({ userId, handler, graduationYear })

    const weekStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(dispatchAmount) as totalDispatch,
        SUM(handlerPaidAmount) as paidAmount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
      FROM Orders
      WHERE userId = @userId AND (handler = @handler OR (@handler = '' AND handler = ''))${gradCond}
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
      SELECT id, title, orderType, totalAmount, dispatchAmount, handlerPaidAmount,
        CASE WHEN handler = '' THEN '本人' ELSE handler END as handler, createdAt
      FROM Orders WHERE userId = @userId AND (receiver = @receiver OR (@receiver = '' AND receiver = ''))${gradCond}
      ORDER BY createdAt DESC
    `).all({ userId, receiver, graduationYear })

    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as orderCount,
        SUM(totalAmount) as totalAmount,
        SUM(dispatchAmount) as totalDispatch,
        SUM(handlerPaidAmount) as paidAmount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount,
        SUM(CASE WHEN handlerPaidAmount >= dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN handlerPaidAmount < dispatchAmount AND dispatchAmount > 0 THEN 1 ELSE 0 END) as unpaidCount
      FROM Orders WHERE userId = @userId AND (receiver = @receiver OR (@receiver = '' AND receiver = ''))${gradCond}
    `).get({ userId, receiver, graduationYear })

    const byHandler = db.prepare(`
      SELECT
        CASE WHEN handler = '' THEN '本人' ELSE handler END as name,
        COUNT(*) as orderCount,
        SUM(dispatchAmount) as totalDispatch,
        SUM(handlerPaidAmount) as paidAmount,
        SUM(CASE WHEN dispatchAmount > 0 THEN dispatchAmount - handlerPaidAmount ELSE 0 END) as unpaidAmount
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
    const user = db.prepare('SELECT id, username FROM Users WHERE id = ?').get(userId)
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
      user: { id: user.id, username: user.username },
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
    const importedOrders = Array.isArray(payload.data.orders) ? payload.data.orders : []
    const importedRevisions = Array.isArray(payload.data.revisions) ? payload.data.revisions : []
    const importedFeedback = Array.isArray(payload.data.feedback) ? payload.data.feedback : []
    const importedDesignTypes = Array.isArray(payload.data.designTypes) ? payload.data.designTypes : []

    const missingPaths = []
    const missingOrderFolders = []
    const importTxn = db.transaction(() => {
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
        INSERT INTO Orders (userId, title, university, college, major, studentName, wechatName, groupChatName, includesDesign, designType, designSubType, designStatus, orderType, formatMode, hasOriginalText, receiver, handler, advisor, deadline, totalAmount, paidAmount, dispatchAmount, isDesignFinished, folderPath, graduationYear, createdAt, isDraftSubmitted, refundAmount, isHandlerPaid, handlerPaidAmount)
        VALUES (@userId, @title, @university, @college, @major, @studentName, @wechatName, @groupChatName, @includesDesign, @designType, @designSubType, @designStatus, @orderType, @formatMode, @hasOriginalText, @receiver, @handler, @advisor, @deadline, @totalAmount, @paidAmount, @dispatchAmount, @isDesignFinished, @folderPath, @graduationYear, @createdAt, @isDraftSubmitted, @refundAmount, @isHandlerPaid, @handlerPaidAmount)
      `)
      for (const o of importedOrders) {
        const mappedPath = replacePathPrefix(oldRoot, normalizedNewRoot, o.folderPath || '')
        const result = insertOrder.run({
          userId: currentUserId,
          title: o.title || '',
          university: o.university || '',
          college: o.college || '',
          major: o.major || '',
          studentName: o.studentName || '',
          wechatName: o.wechatName || '',
          groupChatName: o.groupChatName || '',
          includesDesign: Number(o.includesDesign) || 0,
          designType: o.designType || '',
          designSubType: o.designSubType || '',
          designStatus: o.designStatus || '',
          orderType: o.orderType || 'thesis',
          formatMode: o.formatMode || '',
          hasOriginalText: Number(o.hasOriginalText) || 0,
          receiver: o.receiver || '',
          handler: o.handler || '',
          advisor: o.advisor || '',
          deadline: o.deadline || '',
          totalAmount: Number(o.totalAmount) || 0,
          paidAmount: Number(o.paidAmount) || 0,
          dispatchAmount: Number(o.dispatchAmount) || 0,
          isDesignFinished: Number(o.isDesignFinished) || 0,
          folderPath: mappedPath,
          graduationYear: Number(o.graduationYear) || 0,
          createdAt: o.createdAt || new Date().toISOString(),
          isDraftSubmitted: Number(o.isDraftSubmitted) || 0,
          refundAmount: Number(o.refundAmount) || 0,
          isHandlerPaid: Number(o.isHandlerPaid) || 0,
          handlerPaidAmount: Number(o.handlerPaidAmount) || 0,
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
        'INSERT INTO Revisions (orderId, title, folderPath, deadline, isExpanded, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
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
          r.createdAt || new Date().toISOString()
        )
        revMap.set(r.id, Number(result.lastInsertRowid))
        if (mappedPath && !fs.existsSync(mappedPath) && missingPaths.length < 30) missingPaths.push(mappedPath)
      }

      const insertFeedback = db.prepare(
        'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments) VALUES (?, ?, ?, ?, ?, ?)'
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
          mappedAttachments
        )
      }

      db.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').run('rootDirectory', normalizedNewRoot)
    })

    try {
      importTxn()
    } catch (err) {
      return { success: false, error: err.message || 'IMPORT_FAILED' }
    }

    return {
      success: true,
      summary: {
        orderCount: importedOrders.length,
        revisionCount: importedRevisions.length,
        feedbackCount: importedFeedback.length,
      },
      missingPaths,
      missingOrderFolders,
    }
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

  ipcMain.handle('orders:list', (_, userId, search, orderType, graduationYear) => {
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
      query += ` AND (o.title LIKE ? OR o.university LIKE ? OR o.college LIKE ? OR o.major LIKE ? OR o.advisor LIKE ? OR o.receiver LIKE ? OR o.handler LIKE ? OR o.studentName LIKE ? OR o.wechatName LIKE ? OR o.groupChatName LIKE ?)`
      const s = `%${search}%`
      params.push(s, s, s, s, s, s, s, s, s, s)
    }

    query += ` ORDER BY o.deadline ASC`
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('orders:get', (_, userId, id) => {
    return db.prepare('SELECT * FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
  })

  ipcMain.handle('orders:distinctValues', (_, userId, field) => {
    const allowed = ['university', 'college', 'major', 'receiver', 'handler', 'advisor']
    if (!allowed.includes(field)) return []
    return db.prepare(`SELECT DISTINCT ${field} AS val FROM Orders WHERE userId = ? AND ${field} != '' ORDER BY val ASC`).all(userId).map(r => r.val)
  })

  ipcMain.handle('orders:create', (_, data) => {
    const stmt = db.prepare(`
      INSERT INTO Orders (userId, title, university, college, major, studentName, wechatName, groupChatName, includesDesign, designType, designSubType, designStatus, orderType, formatMode, hasOriginalText, receiver, handler, advisor, deadline, totalAmount, paidAmount, dispatchAmount, isDesignFinished, folderPath, graduationYear, createdAt)
      VALUES (@userId, @title, @university, @college, @major, @studentName, @wechatName, @groupChatName, @includesDesign, @designType, @designSubType, @designStatus, @orderType, @formatMode, @hasOriginalText, @receiver, @handler, @advisor, @deadline, @totalAmount, @paidAmount, @dispatchAmount, 0, @folderPath, @graduationYear, datetime('now'))
    `)
    const now = new Date()
    const defaultGradYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
    const result = stmt.run({
      designType: '', designSubType: '', designStatus: '',
      orderType: 'thesis', formatMode: '', hasOriginalText: 0,
      dispatchAmount: 0, graduationYear: defaultGradYear,
      ...data,
    })
    return result.lastInsertRowid
  })

  ipcMain.handle('orders:update', (_, userId, id, data) => {
    // Verify the order belongs to the user before updating
    const order = db.prepare('SELECT id FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
    if (!order) return false
    
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE Orders SET ${fields} WHERE id = @id AND userId = @userId`).run({ ...data, id, userId })
    return true
  })

  ipcMain.handle('orders:delete', (_, userId, id) => {
    // Verify the order belongs to the user before deleting
    const order = db.prepare('SELECT id FROM Orders WHERE id = ? AND userId = ?').get(id, userId)
    if (!order) return false
    
    const deleteTransaction = db.transaction(() => {
      const revisions = db.prepare('SELECT id FROM Revisions WHERE orderId = ?').all(id)
      for (const rev of revisions) {
        db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(rev.id)
      }
      db.prepare('DELETE FROM Revisions WHERE orderId = ?').run(id)
      db.prepare('DELETE FROM Orders WHERE id = ? AND userId = ?').run(id, userId)
    })
    deleteTransaction()
    return true
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
    const fs = require('fs')
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
      'INSERT INTO Revisions (orderId, title, folderPath, deadline, isExpanded, createdAt) VALUES (?, ?, ?, NULL, 1, datetime(\'now\'))'
    ).run(orderId, title, revFolderPath)
    return result.lastInsertRowid
  })

  ipcMain.handle('revisions:update', (_, id, data) => {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE Revisions SET ${fields} WHERE id = @id`).run({ ...data, id })
    return true
  })

  ipcMain.handle('revisions:delete', (_, id) => {
    db.prepare('DELETE FROM FeedbackItems WHERE revisionId = ?').run(id)
    db.prepare('DELETE FROM Revisions WHERE id = ?').run(id)
    return true
  })

  // ===== FeedbackItems =====
  ipcMain.handle('feedback:create', (_, revisionId, content, attachments) => {
    const att = attachments && attachments.length > 0 ? JSON.stringify(attachments) : '[]'
    const hasImg = attachments && attachments.length > 0 ? 1 : 0
    const result = db.prepare(
      'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments) VALUES (?, ?, 0, ?, NULL, ?)'
    ).run(revisionId, content, hasImg, att)
    return result.lastInsertRowid
  })

  ipcMain.handle('feedback:batchCreate', (_, revisionId, contents) => {
    const stmt = db.prepare(
      'INSERT INTO FeedbackItems (revisionId, content, isResolved, hasImage, imagePath, attachments) VALUES (?, ?, 0, 0, NULL, \'[]\')'
    )
    const insertMany = db.transaction((items) => {
      const ids = []
      for (const content of items) {
        const result = stmt.run(revisionId, content)
        ids.push(result.lastInsertRowid)
      }
      return ids
    })
    return insertMany(contents)
  })

  ipcMain.handle('feedback:toggleResolved', (_, id) => {
    db.prepare('UPDATE FeedbackItems SET isResolved = CASE WHEN isResolved = 0 THEN 1 ELSE 0 END WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('feedback:update', (_, id, content) => {
    db.prepare('UPDATE FeedbackItems SET content = ? WHERE id = ?').run(content, id)
    return true
  })

  ipcMain.handle('feedback:delete', (_, id) => {
    const fs = require('fs')
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
    return true
  })

  // ===== Attachments =====
  ipcMain.handle('attachment:save', (_, { buffer, filename, targetDir }) => {
    const fs = require('fs')
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

  ipcMain.handle('fs:generateOrderFolder', (_, { rootDirectory, university, major, studentName, title, includesDesign, orderType }) => {
    const type = orderType || 'thesis'
    const typeSubDirs = { thesis: '毕业设计', format: '格式修改', translation: '外文翻译' }
    const subDir = typeSubDirs[type] || '毕业设计'
    const year = new Date().getFullYear()
    
    // 路径组成部分清理（去除非法字符）
    const sanitizePathPart = (str) => (str || '').trim().replace(/[<>:"/\\|?*]/g, '_')
    
    const uniName = sanitizePathPart(university)
    const majorName = sanitizePathPart(major)
    const studentNamePart = sanitizePathPart(studentName)
    const sanitizedTitle = sanitizePathPart(title) || '未命名项目'
    
    // 构建文件夹名称：年份-学生姓名-项目名称 或 年份-项目名称
    const folderName = studentNamePart 
      ? `${year}-${studentNamePart}-${sanitizedTitle}`
      : `${year}-${sanitizedTitle}`
    
    // 构建完整路径：根目录/类型/学校/专业/文件夹名
    const folderPath = path.join(rootDirectory, subDir, uniName, `${majorName}专业`, folderName)
    try {
      const fs = require('fs')
      fs.mkdirSync(folderPath, { recursive: true })
      if (type === 'format') {
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
        if (includesDesign) {
          fs.mkdirSync(path.join(folderPath, '设计文件'), { recursive: true })
        }
      }
      return { success: true, folderPath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
