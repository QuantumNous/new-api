# 性能分析设置指南

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/wiki/basic-concepts/performance-analysis.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/wiki/basic-concepts/performance-analysis.mdx

## 页面大纲

    - 概述
    - 功能特点
    - pprof（内置）设置
      - 1. 配置环境变量
      - 2. 重启应用
      - 3. 验证
    - Pyroscope 设置
      - 1. 准备 Pyroscope 服务
      - 2. 配置环境变量
      - 3. 重启应用
      - 4. 验证
    - 故障排除
- Check env vars
  - 环境变量参考
  - 相关链接

## 原文内容

---
title: 性能分析设置指南
---
### 概述

New API 提供两类性能分析能力：

- **pprof（内置）**：适合临时诊断与离线分析
- **Pyroscope（可选）**：适合线上持续分析与火焰图可视化

两者可以同时启用，互不冲突。

### 功能特点

✅ 零代码集成 - 仅通过环境变量配置  
✅ 支持 Docker 和独立部署  
✅ 支持临时诊断与持续分析并存  
✅ 可选鉴权与实例区分

---

### pprof（内置）设置

#### 1. 配置环境变量

**使用 Docker Compose：**

```yaml
environment:
  - ENABLE_PPROF=true
```

**独立部署：**

```bash
export ENABLE_PPROF=true
```

#### 2. 重启应用

重启应用以应用更改。

#### 3. 验证

如果未修改路由，通常可在 `/debug/pprof/` 访问（以实际部署为准）。

---

### Pyroscope 设置

#### 1. 准备 Pyroscope 服务

确保 Pyroscope 服务可访问，并记录服务地址（例如：`http://localhost:4040`）。

#### 2. 配置环境变量

**使用 Docker Compose：**

```yaml
environment:
  - PYROSCOPE_URL=http://localhost:4040
  - PYROSCOPE_APP_NAME=new-api
  - PYROSCOPE_BASIC_AUTH_USER=your-user
  - PYROSCOPE_BASIC_AUTH_PASSWORD=your-password
  - PYROSCOPE_MUTEX_RATE=5
  - PYROSCOPE_BLOCK_RATE=5
  - HOSTNAME=your-hostname
```

**独立部署：**

```bash
export PYROSCOPE_URL=http://localhost:4040
export PYROSCOPE_APP_NAME=new-api
export PYROSCOPE_BASIC_AUTH_USER=your-user
export PYROSCOPE_BASIC_AUTH_PASSWORD=your-password
export PYROSCOPE_MUTEX_RATE=5
export PYROSCOPE_BLOCK_RATE=5
export HOSTNAME=your-hostname
```

#### 3. 重启应用

重启应用以应用更改。

#### 4. 验证

1. 打开 Pyroscope UI
2. 选择 `PYROSCOPE_APP_NAME` 对应的应用
3. 如设置了 `HOSTNAME`，可在实例维度区分来源

---

### 故障排除

**性能分析无法工作？**

1. ✅ 验证环境变量设置正确
2. ✅ 更改变量后重启应用
3. ✅ 检查网络连通性与鉴权配置
4. ✅ 确认 `PYROSCOPE_APP_NAME` 命名一致

**Docker 用户：**

```bash
# Check env vars
docker exec new-api env | grep -E "PPROF|PYROSCOPE"
```

---

## 环境变量参考

| 变量                          | 必需 | 默认值 | 说明                         |
| ----------------------------- | ---- | ------ | ---------------------------- |
| `ENABLE_PPROF`                | 否   | `false` | 启用 pprof 性能分析           |
| `PYROSCOPE_URL`               | 否   | -      | Pyroscope 服务地址           |
| `PYROSCOPE_APP_NAME`          | 否   | -      | Pyroscope 应用标识           |
| `PYROSCOPE_BASIC_AUTH_USER`   | 否   | -      | Pyroscope Basic Auth 用户名  |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | 否 | -      | Pyroscope Basic Auth 密码    |
| `PYROSCOPE_MUTEX_RATE`        | 否   | -      | Mutex 采样率                 |
| `PYROSCOPE_BLOCK_RATE`        | 否   | -      | Block 采样率                 |
| `HOSTNAME`                    | 否   | -      | 实例标识（可选）             |

---

## 相关链接

- [Pyroscope](https://pyroscope.io/)
- [Pyroscope Documentation](https://pyroscope.io/docs/)
