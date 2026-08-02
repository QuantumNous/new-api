# 邀请充值返佣 — 完成记录

**Date:** 2026-07-12  
**Status:** Done / ready for next feature

## 功能摘要
被邀请人充值成功后，邀请人获得可配置比例（默认 1%）的到账额度返佣，进入 `aff_quota`，用户手动提取到余额。含用户/管理页面、邀请排行榜、漏发补偿任务。

## 关键入口
- Spec: `docs/superpowers/specs/2026-07-12-invite-topup-rebate-design.md`
- Plan: `docs/superpowers/plans/2026-07-12-invite-topup-rebate.md`
- Code: `model/invite_rebate.go`, `controller/invite_rebate.go`, `controller/invite_rebate_task.go`
- UI: `web/src/features/invite-rebate/`

## 配置 Option
- `InviteTopupRebateEnabled` (default false)
- `InviteTopupRebateRatioBp` (default 100 = 1%)
- `InviteTopupRebateBackfillMinutes` (default 5)

## 安全结论
User/Admin/Root 分层正确；幂等账本；负转移/禁用用户拦截；排行榜脱敏且不暴露他人 user_id。无 HIGH 级未修复问题。

## 备注
- 合并上游时优先保留独立文件，只处理 topup 钩子 / option / router 薄 diff。
- 若 leaderboard 返回 `Invalid URL (GET /api/user/invite_rebate/leaderboard)`，说明请求打到了未部署该路由的旧后端。
