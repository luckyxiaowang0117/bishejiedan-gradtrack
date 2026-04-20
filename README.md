# 毕设接单管理助手

一个基于 Vue + Electron + SQLite 的本地桌面项目管理工具，用于跟踪毕设接单、返修、收款和交付状态。

## 当前版本

- 应用版本：`4.3.0`
- 技术栈：`Vue 3`、`Vite`、`Electron`、`better-sqlite3`

## 开发命令

```bash
npm install
npm run dev
npm run build:win
```

## 版本管理约定

- Git 仓库只保存源码、配置、文档。
- `node_modules/`、`dist/` 等构建产物不提交。
- 大体积安装包如需随版本一并归档，使用 Git LFS 管理。
- 本地数据库和运行时数据不提交。
- 每次正式发布时：
  1. 更新 `package.json` 版本号。
  2. 提交代码。
  3. 打标签，如 `v4.3.0`。
  4. 将安装包上传到 GitHub Releases 做归档。

详细归档记录见 [ARCHIVE.md](./ARCHIVE.md)。
