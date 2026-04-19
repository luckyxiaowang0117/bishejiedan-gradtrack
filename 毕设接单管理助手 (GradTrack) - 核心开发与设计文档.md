# 毕设接单管理助手 (GradTrack) - 核心开发与设计文档

## 1. 项目概述 (Project Overview)

- **项目名称**：毕设接单管理助手 (GradTrack)
- **目标平台**：Windows 桌面端应用 (仅本地运行，无需云端同步)
- **核心痛点**：解决个人接单过程中，不同客户（尤其是微信沟通中）频繁、碎片化的修改意见容易遗漏的问题；管理多个不同学校、不同进度订单的交付期限和尾款；以及本地庞杂项目文件的管理。
- **核心原则**：进度可视化、反馈结构化（支持长文本自动拆分为待办清单）、本地数据优先、文件管理极简化。

## 2. 技术栈建议 (Tech Stack Recommendation)

建议 AI 助手采用以下现代桌面应用技术栈进行开发：

- **框架**：Electron (或 Tauri)
- **前端**：Vue 3 (Composition API) 或 React 18
- **样式**：Tailwind CSS (用于快速构建现代化、响应式的 UI)
- **图标库**：Phosphor Icons (或类似现代线框图标库)
- **本地数据库**：SQLite3 (使用 `sqlite3` 或 `better-sqlite3` 库持久化本地数据)
- **系统交互**：Node.js `fs` (用于创建本地文件夹) 和 `child_process.exec` (用于调用 Windows 资源管理器打开文件夹)

## 3. 数据库结构设计 (Database Schema - SQLite)

需要创建并维护三个核心数据表及一个配置表。

### 3.1 订单主表 (`Orders`)

| **字段名**         | **类型** | **描述**            | **补充说明**          |
| ------------------ | -------- | ------------------- | --------------------- |
| `id`               | INTEGER  | 主键，自增          | 唯一订单号            |
| `title`            | TEXT     | 项目题目            | 必填                  |
| `university`       | TEXT     | 学校名称 (一级分类) |                       |
| `college`          | TEXT     | 学院 (二级分类)     |                       |
| `major`            | TEXT     | 专业 (三级分类)     |                       |
| `receiver`         | TEXT     | 接单人              | 默认："本人"          |
| `handler`          | TEXT     | 处理人 (实际执行者) | 默认："本人"          |
| `advisor`          | TEXT     | 指导教师            |                       |
| `deadline`         | DATE     | 交稿日期            | 必填，格式 YYYY-MM-DD |
| `totalAmount`      | REAL     | 全款金额            | 默认 0                |
| `paidAmount`       | REAL     | 已收金额(定金)      | 默认 0                |
| `isDesignFinished` | INTEGER  | 设计是否完成        | 0=未完成, 1=已完成    |
| `folderPath`       | TEXT     | 本地专属文件夹路径  | 绝对路径              |
| `createdAt`        | DATETIME | 创建时间            |                       |

### 3.2 修改轮次表 (`Revisions`)

| **字段名**   | **类型** | **描述**             | **补充说明**                       |
| ------------ | -------- | -------------------- | ---------------------------------- |
| `id`         | INTEGER  | 主键，自增           |                                    |
| `orderId`    | INTEGER  | 外键                 | 关联 `Orders.id`                   |
| `title`      | TEXT     | 轮次标题             | 例如："第一轮修改", "中期检查修改" |
| `deadline`   | DATE     | 该轮次修改的截止日期 | 可为空                             |
| `isExpanded` | INTEGER  | UI状态：是否展开     | 0=折叠, 1=展开                     |
| `createdAt`  | DATETIME | 创建时间             |                                    |

### 3.3 修改意见详情表 (`FeedbackItems`)

| **字段名**   | **类型** | **描述**           | **补充说明**             |
| ------------ | -------- | ------------------ | ------------------------ |
| `id`         | INTEGER  | 主键，自增         |                          |
| `revisionId` | INTEGER  | 外键               | 关联 `Revisions.id`      |
| `content`    | TEXT     | 修改意见的具体内容 |                          |
| `isResolved` | INTEGER  | 是否已解决         | 0=待修改, 1=已修改       |
| `hasImage`   | INTEGER  | 是否包含图片附件   | 预留字段，0=否, 1=是     |
| `imagePath`  | TEXT     | 本地图片路径       | 预留字段，存储微信截图等 |

### 3.4 全局设置表 (`Settings`) - 键值对或单行记录

- `rootDirectory`: String (用于存储软件自动创建项目文件夹的根目录，如 `D:\毕设接单资料库`)

## 4. 核心功能与 UI 交互要求 (Core Features & UI)

整体布局为**左右分栏**。左侧固定宽度（约 320px）为列表区，右侧自适应宽度为主工作区。

### 4.1 左侧边栏 (Sidebar: 列表与检索)

- **顶部搜索**：全局模糊搜索，范围包括 `title`, `university`, `major`, `advisor`。
- **快捷过滤器**：
  - `全部 (All)`：显示所有订单。
  - `有待修改 (Todo)`：仅显示内部包含 `isResolved = 0` 修改项的订单。
  - `欠尾款 (Unpaid)`：仅显示 `totalAmount > paidAmount` 的订单。
- **卡片排序规则**：默认按 `deadline` 升序排列（最近要交稿的在最上面）。
- **卡片数据展示**：
  - 显示题目（最多两行，超出省略号）。
  - 显示“学校 · 专业”标签。
  - **严重警告联动**：如果该订单下的某个 `Revision` 的 `deadline` 已逾期，且该轮次内有未完成的 `FeedbackItem`，卡片需显示红色的【X 待改】警告标签。否则显示黄色警告标签。

### 4.2 右侧面板上半区 (Main Panel Top: 订单看板与文件联动)

- **顶部全局操作**：
  - 【打开本地项目文件夹】按钮：点击后，程序需调用系统 API (如 `explorer.exe <folderPath>`) 自动打开关联的本地目录。
- **基本信息看板**：
  - 面包屑导航展示分类：`学校 / 学院 / 专业`。
  - “设计已完成” Switch 开关 (直接更新 `isDesignFinished` 字段)。
  - 显示处理人、指导教师、交稿期限（距离今天 <= 7 天需红色高亮标记为“急”）。
  - **财务进度条**：计算 `paidAmount / totalAmount` 显示进度，并明确计算出“尾款差额”。

### 4.3 右侧面板下半区 (Main Panel Bottom: 修改迭代追踪器) - **核心重点**

- **轮次管理**：点击“新增修改轮次”新建一个 `Revision` 块。每个块可独立折叠/展开。
- **轮次头部警告逻辑**：
  - 允许设置该轮次的 `deadline`。
  - 如果 `isResolved == 0` 的子项数量 > 0：
    - 当 `deadline` < 今天：时间文本变红，显示【逾期】标识。
    - 当 `deadline` 距离今天 <= 2 天：时间文本变橙色，显示【临近】标识。
- **意见智能拆分录入 (Text Auto-Split)**：
  - 底部提供一个 `<textarea>`。
  - **交互规则**：用户粘贴大段多行文本并按下 `Enter` 键时，拦截默认换行事件。程序需将文本按换行符 `\n` 进行 `split`，过滤掉空行后，自动将其转换为**多条**独立的 `FeedbackItem` (状态默认为未解决)。
- **状态双态切换**：
  - 每条意见左侧放置 Checkbox。勾选后，更新数据库，并将文本置灰并添加中划线 (`line-through`)。

### 4.4 自动化文件建档机制 (Auto-Folder Creation)

- 在“新建接单项目”表单中，当用户点击保存时：
  1. 验证必填项（题目、交稿日期）。
  2. 读取 `Settings` 中的 `rootDirectory`。
  3. 拼接生成目标路径：规则建议为 `${rootDirectory}\${id.toString().padStart(3,'0')}_${handler}_${title.substring(0,8)}`。
  4. 检查目录是否存在，不存在则调用 Node.js `fs.mkdirSync(path, { recursive: true })` 创建实体文件夹。
  5. 将生成的路径存入数据库的 `folderPath` 字段。

## 5. 提示给 AI 的工程化要求 (AI Engineering Directives)

1. **组件化开发**：请将左侧列表卡片、修改轮次块 (Revision Block)、新建订单弹窗等拆分为独立的 Vue/React 组件，保持主文件整洁。
2. **防注入与数据安全**：使用 SQLite 时，所有查询必须使用参数化查询 (Parameterized queries) 以防止 SQL 注入。
3. **极简体验**：不要引入繁琐的加载动画或网络请求配置，这是一个纯本地、即时响应的效率工具，重点优化响应速度和数据持久化的稳定性。
4. **容错处理**：在点击“打开本地文件夹”时，需用 `try-catch` 捕获异常，如果文件夹在硬盘上被意外删除，需弹出友好提示并允许用户重新绑定路径。