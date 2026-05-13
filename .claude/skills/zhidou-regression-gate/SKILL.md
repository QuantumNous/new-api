---
name: zhidou-regression-gate
description: 跑本期回归检查:编译、go vet、前端 build、agent.enabled=false 下的功能对比,确认现有功能 0 变化
when_to_use: 每期收工前 + 每条 Codex PR 合入前,确保改动没有破坏现有功能
---

# Skill: zhidou-regression-gate

## 作用

在知豆 Agent 改造的每个阶段收工前,跑一遍完整的回归检查,确保:
1. 代码能编译、能通过静态检查
2. 前端能 build
3. **关键**:`agent.enabled=false` 时,现有功能(登录、建 Token、查日志、充值、签到)与改造前完全一致

## 何时调用

- **每 5~8 个任务合一批后**:跑一次,确认这批任务没破坏现有功能
- **每条 Codex PR 合入前**:作为 merge 前的最后一道门禁
- **每个阶段收工前**:跑一次完整回归,通过后才能进入下一阶段

## 执行步骤

### 第 1 步:后端编译 + 静态检查

```bash
cd c:/Users/道初/Desktop/3D/new-api/
go build -o new-api.exe .
if [ $? -ne 0 ]; then
  echo "❌ 编译失败"
  exit 1
fi

go vet ./...
if [ $? -ne 0 ]; then
  echo "❌ go vet 发现问题"
  exit 1
fi

echo "✅ 后端编译 + 静态检查通过"
```

### 第 2 步:前端 build

```bash
cd c:/Users/道初/Desktop/3D/new-api/web/
bun install
DISABLE_ESLINT_PLUGIN='true' bun run build
if [ $? -ne 0 ]; then
  echo "❌ 前端 build 失败"
  exit 1
fi

echo "✅ 前端 build 通过"
```

### 第 3 步:功能回归(agent.enabled=false)

**前置条件**:
- 数据库里有一个测试用户(user_id=999,username=`regression_test_user`)
- 该用户有 1 个 Token(name=`regression_test_token`)
- 该用户余额 > 0

**回归清单**:

1. **登录**:
   ```bash
   curl -X POST http://localhost:8080/api/user/login \
     -H "Content-Type: application/json" \
     -d '{"username":"regression_test_user","password":"test123"}'
   # 期望:返回 200,拿到 session cookie
   ```

2. **查余额**:
   ```bash
   curl -X GET http://localhost:8080/api/user/self \
     -H "Cookie: session=<上一步拿到的 cookie>"
   # 期望:返回 200,quota 字段存在
   ```

3. **列 Token**:
   ```bash
   curl -X GET http://localhost:8080/api/token/ \
     -H "Cookie: session=<cookie>" \
     -H "New-Api-User: 999"
   # 期望:返回 200,data 数组含 regression_test_token
   ```

4. **查日志**:
   ```bash
   curl -X GET "http://localhost:8080/api/log/self?p=0" \
     -H "Cookie: session=<cookie>" \
     -H "New-Api-User: 999"
   # 期望:返回 200,data 数组存在(可能为空)
   ```

5. **签到状态**:
   ```bash
   curl -X GET http://localhost:8080/api/user/checkin \
     -H "Cookie: session=<cookie>" \
     -H "New-Api-User: 999"
   # 期望:返回 200,has_checked_in 字段存在
   ```

6. **调用 relay 接口**(用 ZhidouAiClient.java):
   ```bash
   # 用测试 Token 调一次 /v1/chat/completions
   # 期望:返回 200,扣费正常,log 表有记录
   ```

**判断标准**:
- 所有接口返回码与改造前一致
- 返回 JSON 结构与改造前一致(字段名、类型、嵌套层级)
- 数据库 `log` 表的 `quota` 扣费与改造前一致(误差 < 1%)

### 第 4 步:生成回归报告

```markdown
# 回归报告 - <日期>

## 测试环境
- 分支:<当前分支>
- Commit:<当前 commit hash>
- agent.enabled: false

## 测试结果

| 项目 | 状态 | 备注 |
|---|---|---|
| 后端编译 | ✅ / ❌ | |
| go vet | ✅ / ❌ | |
| 前端 build | ✅ / ❌ | |
| 登录 | ✅ / ❌ | |
| 查余额 | ✅ / ❌ | |
| 列 Token | ✅ / ❌ | |
| 查日志 | ✅ / ❌ | |
| 签到状态 | ✅ / ❌ | |
| Relay 接口 | ✅ / ❌ | |

## 结论

- [ ] 全部通过,可以合入 / 进入下一阶段
- [ ] 有失败项,需要修复

## 失败详情

<如果有失败项,粘贴错误日志>
```

## 注意事项

1. **测试用户数据要稳定**:每次回归用同一个测试用户,避免数据漂移。
2. **agent.enabled=false 是硬性要求**:回归测试期间,必须确认 Agent 功能完全关闭。
3. **对比基准**:第一次跑回归时,把结果存为"黄金基准";后续每次跑,都与黄金基准对比。
4. **失败即停**:任何一项失败,立即停止后续测试,先修复再继续。

## 自动化建议(阶段 3 起)

把上述步骤写成 `backend/tests/regression_test.sh`,每次 PR 合入前自动跑。CI 配置:

```yaml
# .github/workflows/regression.yml
name: Regression Gate
on: [pull_request]
jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: bash backend/tests/regression_test.sh
```
