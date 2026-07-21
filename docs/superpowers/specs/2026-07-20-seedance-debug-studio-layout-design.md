# Seedance 调试页工作台布局改造

日期：2026-07-20  
状态：已批准（方案 1）

## 目标

将 `seedance-debug.html` 深度改造为对齐 `gongzuotai` 的双栏创作台：左创作、右历史；登录态自动选 Token，未登录才手输 Key。

## 布局

- 顶栏：标题、登录态、文档链接
- 左栏：Token / 模型 / 提示词 / 参考素材 / 常用参数 / 生成
- 右栏：生成历史（进行中置顶 + 完成网格）
- 高级折叠：API Base、图床、人脸审核、自定义模型、请求体预览、curl

## 账号

- `GET /api/user/self` 判定 Cookie 登录
- 已登录：`GET /api/token/` + `POST /api/token/{id}/key`，下拉选 Token，只持久化 tokenId
- 未登录：Key 输入 + localStorage（兼容现状）

## 历史

- localStorage 为主（约 30～50 条）
- 进行中任务按现有模型协议轮询
- 支持预览 / 下载 / 删除 / 再做一条

## 范围

- 同步改 `web/classic/public` 与 `web/default/public` 两份静态页
- 不改后端、不引入构建
- 保留现有多模型协议与图床逻辑，UI 简化为主流程
