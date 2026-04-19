const path = require('path')
const { app } = require('electron')

let db = null

function initDatabase() {
  const Database = require('better-sqlite3')
  const dbPath = path.join(app.getPath('userData'), 'gradtrack.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  return db
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      university TEXT DEFAULT '',
      college TEXT DEFAULT '',
      major TEXT DEFAULT '',
      studentName TEXT DEFAULT '',
      wechatName TEXT DEFAULT '',
      groupChatName TEXT DEFAULT '',
      includesDesign INTEGER DEFAULT 0,
      receiver TEXT DEFAULT '本人',
      handler TEXT DEFAULT '本人',
      advisor TEXT DEFAULT '',
      deadline DATE NOT NULL,
      totalAmount REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      isDesignFinished INTEGER DEFAULT 0,
      folderPath TEXT DEFAULT '',
      createdAt DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      title TEXT NOT NULL,
      deadline DATE,
      isExpanded INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (orderId) REFERENCES Orders(id)
    );

    CREATE TABLE IF NOT EXISTS FeedbackItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revisionId INTEGER NOT NULL,
      content TEXT NOT NULL,
      isResolved INTEGER DEFAULT 0,
      hasImage INTEGER DEFAULT 0,
      imagePath TEXT,
      attachments TEXT DEFAULT '[]',
      FOREIGN KEY (revisionId) REFERENCES Revisions(id)
    );

    CREATE TABLE IF NOT EXISTS DesignTypeDefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      typeName TEXT NOT NULL,
      subTypes TEXT DEFAULT '[]',
      statuses TEXT DEFAULT '[]',
      sortOrder INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      createdAt DATETIME DEFAULT (datetime('now'))
    );
  `)
  runMigrations()
  seedDesignTypes()
}

function runMigrations() {
  const feedbackCols = db.prepare("PRAGMA table_info(FeedbackItems)").all()
  if (!feedbackCols.find(c => c.name === 'attachments')) {
    db.exec("ALTER TABLE FeedbackItems ADD COLUMN attachments TEXT DEFAULT '[]'")
  }

  const orderCols = db.prepare("PRAGMA table_info(Orders)").all()
  const newOrderCols = [
    { name: 'studentName', def: "TEXT DEFAULT ''" },
    { name: 'wechatName', def: "TEXT DEFAULT ''" },
    { name: 'groupChatName', def: "TEXT DEFAULT ''" },
    { name: 'includesDesign', def: "INTEGER DEFAULT 0" },
  ]
  for (const col of newOrderCols) {
    if (!orderCols.find(c => c.name === col.name)) {
      db.exec(`ALTER TABLE Orders ADD COLUMN ${col.name} ${col.def}`)
    }
  }

  const revCols = db.prepare("PRAGMA table_info(Revisions)").all()
  if (!revCols.find(c => c.name === 'folderPath')) {
    db.exec("ALTER TABLE Revisions ADD COLUMN folderPath TEXT DEFAULT ''")
  }

  const designCols = [
    { name: 'designType', def: "TEXT DEFAULT ''" },
    { name: 'designSubType', def: "TEXT DEFAULT ''" },
    { name: 'designStatus', def: "TEXT DEFAULT ''" },
  ]
  for (const col of designCols) {
    if (!orderCols.find(c => c.name === col.name)) {
      db.exec(`ALTER TABLE Orders ADD COLUMN ${col.name} ${col.def}`)
    }
  }

  const typeCols = [
    { name: 'orderType', def: "TEXT DEFAULT 'thesis'" },
    { name: 'formatMode', def: "TEXT DEFAULT ''" },
    { name: 'hasOriginalText', def: "INTEGER DEFAULT 0" },
  ]
  const latestOrderCols = db.prepare("PRAGMA table_info(Orders)").all()
  for (const col of typeCols) {
    if (!latestOrderCols.find(c => c.name === col.name)) {
      db.exec(`ALTER TABLE Orders ADD COLUMN ${col.name} ${col.def}`)
    }
  }

  const finalOrderCols = db.prepare("PRAGMA table_info(Orders)").all()
  if (!finalOrderCols.find(c => c.name === 'isDraftSubmitted')) {
    db.exec("ALTER TABLE Orders ADD COLUMN isDraftSubmitted INTEGER DEFAULT 0")
  }

  const financeCols = [
    { name: 'dispatchAmount', def: "REAL DEFAULT 0" },
    { name: 'isHandlerPaid', def: "INTEGER DEFAULT 0" },
    { name: 'refundAmount', def: "REAL DEFAULT 0" },
    { name: 'handlerPaidAmount', def: "REAL DEFAULT 0" },
  ]
  const latestCols2 = db.prepare("PRAGMA table_info(Orders)").all()
  for (const col of financeCols) {
    if (!latestCols2.find(c => c.name === col.name)) {
      db.exec(`ALTER TABLE Orders ADD COLUMN ${col.name} ${col.def}`)
    }
  }

  // Migrate old isHandlerPaid=1 data to handlerPaidAmount
  db.exec(`
    UPDATE Orders SET handlerPaidAmount = dispatchAmount
    WHERE isHandlerPaid = 1 AND handlerPaidAmount = 0 AND dispatchAmount > 0
  `)

  // Add userId column to Orders table for user isolation
  const finalOrderCols3 = db.prepare("PRAGMA table_info(Orders)").all()
  if (!finalOrderCols3.find(c => c.name === 'userId')) {
    db.exec("ALTER TABLE Orders ADD COLUMN userId INTEGER DEFAULT NULL")
    
    // Assign existing orders to the first user (if any users exist)
    const firstUser = db.prepare('SELECT MIN(id) as id FROM Users').get()
    if (firstUser && firstUser.id) {
      db.prepare('UPDATE Orders SET userId = ? WHERE userId IS NULL').run(firstUser.id)
    }
  }

  // Add graduationYear column and backfill from createdAt
  const colsForGrad = db.prepare("PRAGMA table_info(Orders)").all()
  if (!colsForGrad.find(c => c.name === 'graduationYear')) {
    db.exec("ALTER TABLE Orders ADD COLUMN graduationYear INTEGER DEFAULT 0")
    db.exec(`
      UPDATE Orders SET graduationYear =
        CASE
          WHEN CAST(strftime('%m', createdAt) AS INTEGER) >= 9
          THEN CAST(strftime('%Y', createdAt) AS INTEGER) + 1
          ELSE CAST(strftime('%Y', createdAt) AS INTEGER)
        END
      WHERE graduationYear = 0 OR graduationYear IS NULL
    `)
  }
}

function seedDesignTypes() {
  const count = db.prepare('SELECT COUNT(*) as c FROM DesignTypeDefs').get().c
  if (count > 0) {
    const row = db.prepare("SELECT * FROM DesignTypeDefs WHERE typeName = '计算机程序'").get()
    if (row) {
      const subTypes = JSON.parse(row.subTypes || '[]')
      const purchased = subTypes.find(s => s.name === '购买源码')
      if (purchased && purchased.statuses.length === 2 && purchased.statuses.includes('未优化')) {
        purchased.statuses = ['暂未购买', '已购买-未优化', '已购买-已优化']
        db.prepare('UPDATE DesignTypeDefs SET subTypes = ? WHERE id = ?').run(JSON.stringify(subTypes), row.id)
      }
    }
    return
  }
  const insert = db.prepare('INSERT INTO DesignTypeDefs (typeName, subTypes, statuses, sortOrder) VALUES (?, ?, ?, ?)')
  insert.run('计算机程序', JSON.stringify([
    { name: '定制', statuses: ['未完成', '已完成'] },
    { name: '购买源码', statuses: ['暂未购买', '已购买-未优化', '已购买-已优化'] },
  ]), '[]', 1)
  insert.run('单片机仿真', '[]', JSON.stringify(['未购买', '已购买']), 2)
  insert.run('单片机实物', '[]', JSON.stringify(['未购买', '已购买']), 3)
  insert.run('机械设计', '[]', JSON.stringify(['未购买', '已购买', '客户提供']), 4)
}

function getDb() {
  return db
}

module.exports = { initDatabase, getDb }
