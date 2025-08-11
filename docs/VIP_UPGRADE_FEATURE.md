# VIP升级功能

## 功能概述

VIP升级功能为New API添加了用户VIP会员系统，允许用户通过消费额度升级为VIP用户，享受VIP专属权益。

## 功能特性

### 🎯 核心功能
- **一键VIP升级** - 用户可通过钱包页面直接升级VIP
- **智能余额检查** - 自动检查用户余额是否足够升级
- **原子事务处理** - 确保余额扣除和状态更新的数据一致性
- **VIP状态显示** - 在个人设置和钱包页面显示VIP状态

### 💰 费用设置
- **升级费用**: 30额度（可配置）
- **计费方式**: 基于new-api原生额度系统（微额度）
- **扣费机制**: 立即扣除，事务性保证

### 👑 VIP权益系统
- **用户分组**: 基于new-api原生的`group`字段（'vip'）
- **权限继承**: 兼容现有的角色权限系统
- **显示标识**: 前端显示专属VIP标签

## 技术架构

### 后端实现
- **API端点**: `POST /api/user/vip_upgrade`
- **权限控制**: 需要用户认证
- **数据库**: 基于原生user表的`group`字段
- **事务安全**: 使用GORM事务确保数据一致性

### 前端实现
- **VIP组件**: `web/src/components/common/VipUpgrade.js`
- **集成页面**: 钱包页面和个人设置页面
- **状态检测**: 自动检测用户VIP状态
- **UI反馈**: 升级成功/失败的用户反馈

### 配置选项
- `ENABLE_VIP_UPGRADE`: 启用/禁用VIP升级功能
- `VIP_SERVICE_URL`: VIP服务相关URL（可选）
- `VIP_UPGRADE_PATH`: VIP升级页面路径（可选）

## 使用方式

### 管理员配置
1. 设置环境变量 `ENABLE_VIP_UPGRADE=true` 启用功能
2. 可选配置VIP服务相关URL和路径

### 用户使用
1. 访问钱包页面（`/console/topup`）
2. 点击"升级VIP"按钮
3. 确认升级（自动扣除30额度）
4. 升级成功后享受VIP权益

### VIP状态查看
- **钱包页面**: 显示当前用户分组状态
- **个人设置**: 显示VIP标签
- **API接口**: `/api/user/self` 返回用户分组信息

## 兼容性

- ✅ **向后兼容**: 不影响现有功能
- ✅ **版本兼容**: 支持new-api最新版本
- ✅ **数据兼容**: 基于原生数据结构
- ✅ **权限兼容**: 与现有角色系统协同工作

## 文件修改列表

### 后端核心文件
- `controller/user.go` - VIP升级API实现
- `router/api-router.go` - 路由配置
- `common/constants.go` - VIP相关常量
- `common/init.go` - 环境变量初始化
- `controller/misc.go` - 状态API扩展
- `model/option.go` - 选项管理扩展

### 前端核心文件
- `web/src/components/common/VipUpgrade.js` - VIP升级组件
- `web/src/pages/TopUp/index.js` - 钱包页面集成
- `web/src/components/settings/PersonalSetting.js` - 个人设置显示

### 配置文件
- `dto/user_settings.go` - 用户设置数据结构扩展

## 安全考虑

- **权限验证**: API需要用户认证
- **余额检查**: 防止余额不足的恶意请求
- **事务安全**: 确保扣费和状态更新的原子性
- **重复检查**: 防止重复升级VIP

## 部署说明

1. **环境变量设置**:
   ```bash
   ENABLE_VIP_UPGRADE=true
   ```

2. **重启服务**: 修改后需要重启new-api服务

3. **数据库**: 自动使用现有user表，无需额外迁移

## 后续扩展

- 支持VIP有效期设置
- 支持多级VIP会员
- 支持VIP专属功能
- 支持VIP续费机制
