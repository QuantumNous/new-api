# New API – Web 界面后端接口文档

> 本文档汇总了 **New API** 后端提供给前端 Web 界面的全部 REST 接口（不含 *Relay* 相关接口）。
>
> 接口前缀统一为 `https://<your-domain>`，以下仅列出 **路径**、**HTTP 方法**、**鉴权要求** 与 **功能简介**。
>
> 鉴权级别说明：
> * **公开** – 不需要登录即可调用
> * **用户** – 需携带用户 Token（`middleware.UserAuth`）
> * **管理员** – 需管理员 Token（`middleware.AdminAuth`）
> * **Root** – 仅限最高权限 Root 用户（`middleware.RootAuth`）

---

## 1. 初始化 / 系统状态
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | /api/setup | 公开 | 获取系统初始化状态 |
| POST | /api/setup | 公开 | 完成首次安装向导 |
| GET  | /api/status | 公开 | 获取运行状态摘要 |
| GET  | /api/uptime/status | 公开 | Uptime-Kuma 兼容状态探针 |
| GET  | /api/status/test | 管理员 | 测试后端与依赖组件是否正常 |

## 2. 公共信息
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/models | 用户 | 获取前端可用模型列表 |
| GET | /api/notice | 公开 | 获取公告栏内容 |
| GET | /api/about | 公开 | 关于页面信息 |
| GET | /api/home_page_content | 公开 | 首页自定义内容 |
| GET | /api/pricing | 可匿名/用户 | 价格与套餐信息 |
| GET | /api/ratio_config | 公开 | 模型倍率配置（仅公开字段） |

## 3. 邮件 / 身份验证
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/verification | 公开 (限流) | 发送邮箱验证邮件 |
| GET | /api/reset_password | 公开 (限流) | 发送重置密码邮件 |
| POST | /api/user/reset | 公开 | 提交重置密码请求 |

## 4. OAuth / 第三方登录
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/oauth/github | 公开 | GitHub OAuth 跳转 |
| GET | /api/oauth/oidc | 公开 | OIDC 通用 OAuth 跳转 |
| GET | /api/oauth/linuxdo | 公开 | LinuxDo OAuth 跳转 |
| GET | /api/oauth/wechat | 公开 | 微信扫码登录跳转 |
| GET | /api/oauth/wechat/bind | 公开 | 微信账户绑定 |
| GET | /api/oauth/email/bind | 公开 | 邮箱绑定 |
| GET | /api/oauth/telegram/login | 公开 | Telegram 登录 |
| GET | /api/oauth/telegram/bind | 公开 | Telegram 账户绑定 |
| GET | /api/oauth/state | 公开 | 获取随机 state（防 CSRF） |

## 5. 用户模块
### 5.1 账号注册/登录
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | /api/user/register | 公开 | 注册新账号 |
| POST | /api/user/login | 公开 | 用户登录 |
| GET  | /api/user/logout | 用户 | 退出登录 |
| GET  | /api/user/epay/notify | 公开 | Epay 支付回调 |
| GET  | /api/user/groups | 公开 | 列出所有分组（无鉴权版） |

### 5.2 用户自身操作 (需登录)
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/user/self/groups | 用户 | 获取自己所在分组 |
| GET | /api/user/self | 用户 | 获取个人资料 |
| GET | /api/user/models | 用户 | 获取模型可见性 |
| PUT | /api/user/self | 用户 | 修改个人资料 |
| DELETE | /api/user/self | 用户 | 注销账号 |
| GET | /api/user/token | 用户 | 生成用户级别 Access Token |
| GET | /api/user/aff | 用户 | 获取推广码信息 |
| POST | /api/user/topup | 用户 | 余额直充 |
| POST | /api/user/pay | 用户 | 提交支付订单 |
| POST | /api/user/amount | 用户 | 余额支付 |
| POST | /api/user/aff_transfer | 用户 | 推广额度转账 |
| PUT | /api/user/setting | 用户 | 更新用户设置 |

### 5.3 管理员用户管理
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/user/ | 管理员 | 获取全部用户列表 |
| GET | /api/user/search | 管理员 | 搜索用户 |
| GET | /api/user/:id | 管理员 | 获取单个用户信息 |
| POST | /api/user/ | 管理员 | 创建用户 |
| POST | /api/user/manage | 管理员 | 冻结/重置等管理操作 |
| PUT | /api/user/ | 管理员 | 更新用户 |
| DELETE | /api/user/:id | 管理员 | 删除用户 |

## 6. 站点选项 (Root)
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/option/ | Root | 获取全局配置 |
| PUT | /api/option/ | Root | 更新全局配置 |
| POST | /api/option/rest_model_ratio | Root | 重置模型倍率 |
| POST | /api/option/migrate_console_setting | Root | 迁移旧版控制台配置 |

## 7. 模型倍率同步 (Root)
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/ratio_sync/channels | Root | 获取可同步渠道列表 |
| POST | /api/ratio_sync/fetch | Root | 从上游拉取倍率 |

## 8. 渠道管理 (管理员)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/channel/ | 获取渠道列表 |
| GET | /api/channel/search | 搜索渠道 |
| GET | /api/channel/models | 查询渠道模型能力 |
| GET | /api/channel/models_enabled | 查询启用模型能力 |
| GET | /api/channel/:id | 获取单个渠道 |
| GET | /api/channel/test | 批量测试渠道连通性 |
| GET | /api/channel/test/:id | 单个渠道测试 |
| GET | /api/channel/update_balance | 批量刷新余额 |
| GET | /api/channel/update_balance/:id | 单个刷新余额 |
| POST | /api/channel/ | 新增渠道 |
| PUT | /api/channel/ | 更新渠道 |
| DELETE | /api/channel/disabled | 删除已禁用渠道 |
| POST | /api/channel/tag/disabled | 批量禁用标签渠道 |
| POST | /api/channel/tag/enabled | 批量启用标签渠道 |
| PUT | /api/channel/tag | 编辑渠道标签 |
| DELETE | /api/channel/:id | 删除渠道 |
| POST | /api/channel/batch | 批量删除渠道 |
| POST | /api/channel/fix | 修复渠道能力表 |
| GET | /api/channel/fetch_models/:id | 拉取单渠道模型 |
| POST | /api/channel/fetch_models | 拉取全部渠道模型 |
| POST | /api/channel/batch/tag | 批量设置渠道标签 |
| GET | /api/channel/tag/models | 根据标签获取模型 |
| POST | /api/channel/copy/:id | 复制渠道 |

## 9. Token 管理
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/token/ | 用户 | 获取全部 Token |
| GET | /api/token/search | 用户 | 搜索 Token |
| GET | /api/token/:id | 用户 | 获取单个 Token |
| POST | /api/token/ | 用户 | 创建 Token |
| PUT | /api/token/ | 用户 | 更新 Token |
| DELETE | /api/token/:id | 用户 | 删除 Token |
| POST | /api/token/batch | 用户 | 批量删除 Token |

## 10. 兑换码管理 (管理员)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/redemption/ | 获取兑换码列表 |
| GET | /api/redemption/search | 搜索兑换码 |
| GET | /api/redemption/:id | 获取单个兑换码 |
| POST | /api/redemption/ | 创建兑换码 |
| PUT | /api/redemption/ | 更新兑换码 |
| DELETE | /api/redemption/invalid | 删除无效兑换码 |
| DELETE | /api/redemption/:id | 删除兑换码 |

## 11. 日志
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/log/ | 管理员 | 获取全部日志 |
| DELETE | /api/log/ | 管理员 | 删除历史日志 |
| GET | /api/log/stat | 管理员 | 日志统计 |
| GET | /api/log/self/stat | 用户 | 我的日志统计 |
| GET | /api/log/search | 管理员 | 搜索全部日志 |
| GET | /api/log/self | 用户 | 获取我的日志 |
| GET | /api/log/self/search | 用户 | 搜索我的日志 |
| GET | /api/log/token | 公开 | 根据 Token 查询日志（支持 CORS） |

## 12. 数据统计
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/data/ | 管理员 | 全站用量按日期统计 |
| GET | /api/data/self | 用户 | 我的用量按日期统计 |

## 13. 分组
| GET | /api/group/ | 管理员 | 获取全部分组列表 |

## 14. Midjourney 任务
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/mj/self | 用户 | 获取自己的 MJ 任务 |
| GET | /api/mj/ | 管理员 | 获取全部 MJ 任务 |

## 15. 任务中心
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /api/task/self | 用户 | 获取我的任务 |
| GET | /api/task/ | 管理员 | 获取全部任务 |

## 16. 账户计费面板 (Dashboard)
| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | /dashboard/billing/subscription | 用户 Token | 获取订阅额度信息 |
| GET | /v1/dashboard/billing/subscription | 同上 | 兼容 OpenAI SDK 路径 |
| GET | /dashboard/billing/usage | 用户 Token | 获取使用量信息 |
| GET | /v1/dashboard/billing/usage | 同上 | 兼容 OpenAI SDK 路径 |

---

> **更新日期**：2025.07.17
