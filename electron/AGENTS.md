<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# electron

## Purpose

提供桌面端打包支持，将 Go 后端二进制（`new-api`）和前端静态资源（`web/dist`）打包为跨平台桌面应用程序（macOS dmg/zip、Windows NSIS/portable、Linux AppImage/deb），基于 Electron 39.x 和 electron-builder。

桌面应用启动时，Electron 主进程会拉起后端 Go 进程并在系统托盘显示图标，用户通过浏览器窗口访问本地服务。

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Electron 依赖配置、各平台打包构建参数（extraResources 定义资源拷贝规则） |
| `main.js` | Electron 主进程：启动后端进程、创建浏览器窗口、托盘图标逻辑 |
| `preload.js` | Electron preload 脚本（渲染进程安全桥接） |
| `build.sh` | 桌面应用构建脚本 |
| `icon.png` | 应用图标 |
| `tray-iconTemplate.png` / `tray-iconTemplate@2x.png` | macOS 托盘图标（Template 格式自适应深色/浅色模式） |
| `tray-icon-windows.png` | Windows 托盘图标 |
| `entitlements.mac.plist` | macOS 沙箱权限声明 |
| `create-tray-icon.js` | 托盘图标生成工具脚本 |

## For AI Agents

### Working In This Directory

- 此目录与 Go 后端代码完全解耦，仅依赖已构建好的 `../new-api`（或 `../new-api.exe`）二进制和 `../web/dist` 静态资源。
- 打包前须先完成 Go 后端编译和前端 `bun run build`，再运行 `build.sh` 或 `npm run build:mac/win/linux`。
- `extraResources` 在 `package.json` 中定义了资源拷贝规则：后端二进制拷贝到 `bin/`，前端资源拷贝到 `web/dist/`，License 文件拷贝到 `licenses/`。
- macOS 打包需要 Xcode 命令行工具；Windows 打包在 macOS 上需要 wine（或在 Windows 上直接构建）。
- 不要在此目录中存放 Go 源码或前端组件代码；此目录只负责打包装配层。
- 修改应用图标时，需同时更新 `icon.png`（全平台）和托盘图标文件。

### Testing Requirements

- 打包产物在目标平台上手动启动验证：后端进程正常拉起、前端页面可访问、托盘图标显示正确。
- 不涉及自动化单元测试。

### Common Patterns

```bash
# 构建 macOS 版本
cd electron && npm run build:mac

# 开发调试（需要先启动后端）
npm run dev-app
```

## Dependencies

### Internal

- `../new-api`（编译产物）— Go 后端二进制
- `../web/dist`（构建产物）— 前端静态资源

### External

- `electron` 39.x — 桌面应用框架
- `electron-builder` — 多平台打包工具
- `cross-env` — 跨平台环境变量设置

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
