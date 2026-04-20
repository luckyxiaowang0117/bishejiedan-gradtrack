# 毕设接单管理助手

一个基于 Vue + Electron + SQLite 的本地桌面项目管理工具，用于跟踪毕设接单、返修、收款和交付状态。

## 当前版本

- 应用版本：`5.2.0`
- 技术栈：`Vue 3`、`Vite`、`Electron`、`better-sqlite3`

## 开发命令

```bash
npm install
npm run dev
npm run build:win
```

## 5.2.0 升级亮点

- 同步身份从本地自增 `userId` 升级为账号稳定标识，不再因为 `user-1 / user-2 / user-3` 分叉。
- 新版本会自动兼容旧版 `user-*` 同步目录，便于双机从旧结构平滑迁移。
- 多机迁移导入时会保留订单、轮次、反馈的同步 `syncUuid`，避免导入后失去同步能力。
- 同步状态说明已明确提示新版使用稳定账号标识。

## 版本管理约定

- Git 仓库只保存源码、配置、文档。
- `node_modules/`、`dist/` 等构建产物不提交。
- 大体积安装包如需随版本一并归档，使用 Git LFS 管理。
- 本地数据库和运行时数据不提交。
- 每次正式发布时：
  1. 更新 `package.json` 版本号。
  2. 提交代码。
  3. 打标签，如 `v5.2.0`。
  4. 将安装包上传到 GitHub Releases 做归档。

详细归档记录见 [ARCHIVE.md](./ARCHIVE.md)。
