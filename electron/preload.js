const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Controls
  getPlatform: () => ipcRenderer.invoke('window:getPlatform'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // Auth
  hasUsers: () => ipcRenderer.invoke('auth:hasUsers'),
  register: (username, password) => ipcRenderer.invoke('auth:register', username, password),
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  verifyPassword: (userId, password) => ipcRenderer.invoke('auth:verifyPassword', userId, password),
  changePassword: (userId, oldPassword, newPassword) => ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),

  // Stats
  getStats: (params) => ipcRenderer.invoke('stats:getSummary', params),
  getStatsYears: (userId) => ipcRenderer.invoke('stats:getYears', userId),
  getHandlerDetail: (userId, handler, weekOffset, graduationYear) => ipcRenderer.invoke('stats:handlerDetail', userId, handler, weekOffset, graduationYear),
  getReceiverDetail: (userId, receiver, graduationYear) => ipcRenderer.invoke('stats:receiverDetail', userId, receiver, graduationYear),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  selectDirectory: () => ipcRenderer.invoke('settings:selectDirectory'),

  // Reset
  resetAll: (superPassword) => ipcRenderer.invoke('reset:all', superPassword),
  exportMigration: (userId) => ipcRenderer.invoke('migration:export', userId),
  importMigration: (params) => ipcRenderer.invoke('migration:import', params),
  selectMigrationFile: () => ipcRenderer.invoke('migration:selectImportFile'),

  // Auto Launch
  getAutoLaunch: () => ipcRenderer.invoke('autoLaunch:get'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('autoLaunch:set', enabled),

  // Orders
  getGraduationYears: (userId) => ipcRenderer.invoke('orders:graduationYears', userId),
  listOrders: (userId, search, orderType, graduationYear) => ipcRenderer.invoke('orders:list', userId, search, orderType, graduationYear),
  getOrder: (userId, id) => ipcRenderer.invoke('orders:get', userId, id),
  getDistinctValues: (userId, field) => ipcRenderer.invoke('orders:distinctValues', userId, field),
  createOrder: (data) => ipcRenderer.invoke('orders:create', data),
  updateOrder: (userId, id, data) => ipcRenderer.invoke('orders:update', userId, id, data),
  deleteOrder: (userId, id) => ipcRenderer.invoke('orders:delete', userId, id),

  // Revisions
  listRevisions: (orderId) => ipcRenderer.invoke('revisions:listByOrder', orderId),
  createRevision: (orderId, title, orderFolderPath) => ipcRenderer.invoke('revisions:create', orderId, title, orderFolderPath),
  updateRevision: (id, data) => ipcRenderer.invoke('revisions:update', id, data),
  deleteRevision: (id) => ipcRenderer.invoke('revisions:delete', id),

  // Feedback Items
  createFeedback: (revisionId, content, attachments) => ipcRenderer.invoke('feedback:create', revisionId, content, attachments),
  batchCreateFeedback: (revisionId, contents) => ipcRenderer.invoke('feedback:batchCreate', revisionId, contents),
  toggleFeedbackResolved: (id) => ipcRenderer.invoke('feedback:toggleResolved', id),
  updateFeedback: (id, content) => ipcRenderer.invoke('feedback:update', id, content),
  deleteFeedback: (id) => ipcRenderer.invoke('feedback:delete', id),

  // File System
  openFolder: (folderPath) => ipcRenderer.invoke('fs:openFolder', folderPath),
  createFolder: (folderPath) => ipcRenderer.invoke('fs:createFolder', folderPath),
  generateOrderFolder: (params) => ipcRenderer.invoke('fs:generateOrderFolder', params),
  listFolderContents: (folderPath) => ipcRenderer.invoke('fs:listFolderContents', folderPath),
  copyFilesToFolder: (filePaths, targetFolder) => ipcRenderer.invoke('fs:copyFilesToFolder', filePaths, targetFolder),
  openFileInSystem: (filePath) => ipcRenderer.invoke('fs:openFileInSystem', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  revealInFinder: (filePath) => ipcRenderer.invoke('fs:revealInFinder', filePath),
  selectItems: (mode) => ipcRenderer.invoke('fs:selectItems', mode),

  // Attachments
  saveAttachment: (data) => ipcRenderer.invoke('attachment:save', data),
  getAttachmentPath: (filePath) => ipcRenderer.invoke('attachment:getPath', filePath),

  // Design Type Definitions
  listDesignTypes: () => ipcRenderer.invoke('designTypes:list'),
  createDesignType: (data) => ipcRenderer.invoke('designTypes:create', data),
  updateDesignType: (id, data) => ipcRenderer.invoke('designTypes:update', id, data),
  deleteDesignType: (id) => ipcRenderer.invoke('designTypes:delete', id),

  // Utilities
  getPathForFile: (file) => webUtils.getPathForFile(file),
})
