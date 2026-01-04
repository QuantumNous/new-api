# 前后端分离与 Docker 容器化改造计划

## 1. 现状分析
- **后端**: Go (Gin)，目前包含嵌入的前端资源。
- **前端**: React (Vite)，位于 `web/` 目录。
- **当前部署**: 单一容器，Go 负责所有服务。
- **目标**: 分离为 Frontend 容器 (Nginx + React 构建产物) 和 Backend 容器 (Go API)。

## 2. 实施步骤

### 2.1 前端容器化 (web/)
1.  **创建 `web/Dockerfile`**:
    -   **构建阶段**: 使用 `node` 镜像，安装依赖 (`bun` 或 `npm`)，执行构建。
    -   **运行阶段**: 使用 `nginx:alpine` 镜像，复制构建产物到 `/usr/share/nginx/html`。
2.  **创建 `web/nginx.conf`**:
    -   配置静态资源服务。
    -   配置反向代理：将 `/api/`, `/v1/` 等请求转发给后端容器。
    -   支持 React 路由（`try_files $uri /index.html`）。

### 2.2 后端容器化 (根目录)
1.  **优化 `Dockerfile`**:
    -   现有的 `Dockerfile` 已经很好，但可以针对纯 API 模式进行微调（可选，通常保持现状即可，只要外部流量由 Nginx 接管）。
    -   确保构建过程中设置 `GOPROXY`（根据之前的进度记录）。

### 2.3 编排 (docker-compose.yml)
1.  **重构 `docker-compose.yml`**:
    -   **backend 服务**: 使用根目录 `Dockerfile` 构建。暴露端口供 Nginx 访问（如 3000）。
    -   **frontend 服务**: 使用 `web/Dockerfile` 构建。暴露端口给主机（如 80）。依赖 `backend`。
    -   **网络**: 定义内部网络，确保前后端可通过服务名通信。

### 2.4 验证与文档
1.  **验证**: 启动容器，检查前端页面是否正常加载，API 请求是否成功转发。
2.  **文档**: 更新 `说明文档.md`，添加部署指南。

## 3. 详细任务清单 (ToDo)
- [ ] 创建 `web/nginx.conf`
- [ ] 创建 `web/Dockerfile`
- [ ] 更新根目录 `docker-compose.yml`
- [ ] 更新 `说明文档.md`
