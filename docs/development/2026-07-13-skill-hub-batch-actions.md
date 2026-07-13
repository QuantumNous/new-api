# 技能广场批量操作

技能广场管理的 default 与 classic 前端均支持逐项勾选和当前筛选结果全选，并提供批量删除、批量导出操作。单次操作限制为 1 至 200 个技能。

## 管理员接口

- `POST /api/admin/skill-hub/skills/batch-delete`
- `POST /api/admin/skill-hub/skills/batch-export`

请求体均为：

```json
{"ids":["skill-a","skill-b"]}
```

批量删除在一个数据库事务内删除技能和标签关联，提交成功后再尽力清理受管 OSS 中的技能包和图标。

批量导出返回 `skill-hub-export.zip`，结构与 `scripts/skill-hub-batch-upload` 的批量导入格式一致：

```text
skill-hub-export.zip
├── manifest.json
├── packages/
│   └── {skill-id}.zip
└── icons/
    └── {skill-id}.{png|jpg|webp}
```

归档中保存的是 OSS 对象的真实内容，不是 URL 占位。为避免服务端请求伪造和不完整备份，导出只读取当前 Skill Hub 配置所管理的 OSS 对象；任一所选技能的 ZIP 或非空图标无法从受管 OSS 读取时，整个导出失败并返回对应技能 ID。
