# 输入安全拦截规则建议

本文档用于在网关侧部署本地输入安全规则。目标是只审查用户提交的 `input` / `prompt` / `user message` 内容，拦截明显不合规的 cyber abuse、NSFW、隐私窃取和诈骗类请求。

> 说明：本规则是硬限制与关键词组合方案，不等同于模型审查或法律合规结论。上线前建议先使用 `log` 模式观察误杀，再切换高置信规则为 `block`。

## 1. 拦截返回样式

符合项目现有 OpenAI 兼容错误格式。建议 HTTP 状态码使用 `400`。

```json
{
  "error": {
    "message": "请求内容不符合输入安全规则，请修改 prompt 后重试。",
    "type": "invalid_request_error",
    "param": "input",
    "code": "input_safety_blocked"
  }
}
```

英文部署可使用：

```json
{
  "error": {
    "message": "Your request was blocked by the input safety policy. Please revise your prompt and try again.",
    "type": "invalid_request_error",
    "param": "input",
    "code": "input_safety_blocked"
  }
}
```

对外不要返回命中的规则 ID、关键词或分类，避免用户按提示绕过规则。

## 2. 审查范围

只审查用户可控输入。

| 接口类型 | 需要审查 | 不审查 |
| --- | --- | --- |
| Chat Completions | `messages[].role == "user"` 的 `content` | `system`、`developer`、`assistant`、`tool` |
| Responses | `input` 中用户文本；`role == "user"` 的内容 | 系统指令、平台注入内容、模型输出 |
| Completions | `prompt` | 内部拼接模板 |
| Images | `prompt` | 生成结果 |
| Claude | `role == "user"` 的文本内容 | `system`、assistant 历史 |
| Gemini | 用户 role 的文本内容 | system instruction、model 历史 |

## 3. 预处理规则

匹配前建议执行：

1. 转小写。
2. 全角转半角。
3. 合并连续空白字符。
4. URL decode 一次。
5. 移除零宽字符。
6. 仅保存原文 hash，不默认保存原文。
7. 超长 base64 或不可读大块文本直接按可疑输入处理。

建议限制：

```text
INPUT_REVIEW_MAX_CHARS=8000
INPUT_REVIEW_BLOCK_SCORE=40
INPUT_REVIEW_REVIEW_SCORE=20
INPUT_REVIEW_MODE=log|block
```

## 4. 动作分级

| 分数 | 动作 | 说明 |
| --- | --- | --- |
| `>= 100` | `block` | 强违规，例如未成年人性内容、凭据窃取、恶意软件生成 |
| `>= 40` | `block` | 高置信组合命中 |
| `>= 20` | `review` / `log` | 中风险或上下文不足 |
| `< 20` | `allow` | 放行 |

如果没有人工复核流程，建议只对 `>= 40` 的规则启用拦截，其余先记录。

## 5. Cyber Abuse 规则

### 5.1 凭据、令牌、会话窃取

- `rule_id`: `CYBER_CREDENTIAL_THEFT_001`
- `category`: `cyber_abuse.credential_theft`
- `score`: `100`
- `action`: `block`

命中逻辑：`动词组 A` + `目标组 B`。

英文动词组 A：

```text
steal
extract
dump
exfiltrate
grab
harvest
scrape
leak
bypass login
session hijack
account takeover
```

英文目标组 B：

```text
password
credential
cookie
session
token
api key
secret key
ssh key
private key
jwt
oauth token
refresh token
access token
2fa code
otp
```

中文动词组 A：

```text
窃取
盗取
偷取
抓取
导出
提取
泄露
批量获取
劫持
接管账号
绕过登录
```

中文目标组 B：

```text
密码
凭据
cookie
会话
token
令牌
api key
密钥
私钥
ssh key
jwt
oauth
刷新令牌
访问令牌
验证码
动态码
二次验证
```

示例命中：

```text
窃取 cookie
抓取用户 token
write a script to dump saved passwords
extract oauth token from browser
```

允许例外：

```text
如何保护 cookie
token 泄露后如何轮换
detect credential leakage in logs
```

### 5.2 恶意软件生成

- `rule_id`: `CYBER_MALWARE_001`
- `category`: `cyber_abuse.malware`
- `score`: `100`
- `action`: `block`

命中逻辑：`生成动词` + `恶意软件词`。

英文生成动词：

```text
write
create
build
generate
make
develop
implement
code
```

英文恶意软件词：

```text
malware
ransomware
keylogger
trojan
backdoor
rootkit
worm
botnet
infostealer
stealer
cryptominer
reverse shell
persistence mechanism
process injection
dll injection
credential stealer
```

中文生成动词：

```text
写
生成
制作
开发
实现
编写
构建
```

中文恶意软件词：

```text
恶意软件
勒索软件
键盘记录器
木马
后门
rootkit
蠕虫
僵尸网络
盗号木马
信息窃取器
挖矿木马
反弹 shell
持久化
进程注入
dll 注入
凭据窃取
```

允许例外：

```text
恶意软件检测规则
勒索软件应急响应
keylogger 防护方案
reverse shell 是什么以及如何检测
```

### 5.3 规避检测、免杀、绕过风控

- `rule_id`: `CYBER_EVASION_001`
- `category`: `cyber_abuse.evasion`
- `score`: `100`
- `action`: `block`

命中逻辑：`规避词 A` + `检测/风控目标 B`。

英文规避词 A：

```text
bypass
evade
avoid detection
undetectable
obfuscate
hide from
disable
turn off
circumvent
```

英文目标 B：

```text
antivirus
edr
xdr
firewall
waf
ids
ips
sandbox
defender
security tool
detection
rate limit
captcha
risk control
```

中文规避词 A：

```text
绕过
规避
免杀
隐藏
躲避
逃避检测
关闭
禁用
对抗
绕开
```

中文目标 B：

```text
杀毒
防病毒
edr
xdr
防火墙
waf
入侵检测
沙箱
defender
安全软件
检测
风控
验证码
限流
```

允许例外：

```text
如何加强验证码防护
WAF 绕过检测日志分析
EDR 告警排查
```

### 5.4 真实目标攻击

- `rule_id`: `CYBER_REAL_TARGET_ATTACK_001`
- `category`: `cyber_abuse.real_target_attack`
- `score`: `80`
- `action`: `block`

命中逻辑：`攻击动词` + `真实目标特征`。

英文攻击动词：

```text
exploit
attack
hack
breach
penetrate
gain access
unauthorized access
take over
scan
enumerate
bruteforce
brute force
```

中文攻击动词：

```text
攻击
入侵
黑掉
拿下
渗透
未授权访问
接管
扫描
爆破
撞库
枚举
```

真实目标特征：

```regex
\b(?:\d{1,3}\.){3}\d{1,3}\b
https?://[^\s]+\b
\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b
```

中文目标词：

```text
真实网站
公网 ip
公司网络
生产服务器
目标域名
受害者
后台
管理面板
数据库
```

英文目标词：

```text
real website
public ip
company network
production server
target domain
victim
admin panel
database
```

允许例外：

```text
授权渗透测试报告模板
CTF 靶场题目分析
本地靶机漏洞复现
```

建议白名单词：

```text
ctf
靶场
lab
localhost
127.0.0.1
本地环境
授权
defensive
防御
修复
```

### 5.5 钓鱼、仿冒登录、诈骗脚本

- `rule_id`: `CYBER_PHISHING_001`
- `category`: `cyber_abuse.phishing`
- `score`: `100`
- `action`: `block`

英文：

```text
phishing page
fake login
credential harvesting
clone login page
spoof email
scam script
bank login clone
paypal login clone
microsoft login clone
google login clone
```

中文：

```text
钓鱼页面
仿冒登录
假登录页
克隆登录页
盗号页面
收集账号密码
诈骗脚本
仿冒银行
仿冒支付
仿冒微软登录
仿冒谷歌登录
```

组合增强：

```text
create/build/generate/write/制作/生成/编写 + 上述词 => block
```

### 5.6 DDoS 和流量攻击

- `rule_id`: `CYBER_DDOS_001`
- `category`: `cyber_abuse.ddos`
- `score`: `100`
- `action`: `block`

英文：

```text
ddos
dos attack
booter
stresser
udp flood
tcp flood
syn flood
http flood
slowloris
amplification attack
stress a website
take down website
```

中文：

```text
ddos
拒绝服务
打流量
流量攻击
压垮网站
打死网站
洪水攻击
udp flood
tcp flood
syn flood
http flood
慢速攻击
放大攻击
```

允许例外：

```text
DDoS 防护
限流设计
高并发压测自己的服务
流量攻击日志分析
```

### 5.7 批量注册、垃圾信息、平台滥用

- `rule_id`: `CYBER_PLATFORM_ABUSE_001`
- `category`: `cyber_abuse.platform_abuse`
- `score`: `60`
- `action`: `block`

英文组合：

```text
mass signup + bypass captcha
bulk account creation + fake identity
spam bot + send messages
scrape users + send dm
auto register + proxy
```

中文组合：

```text
批量注册 + 绕过验证码
批量养号 + 代理
自动注册 + 风控
群发私信 + 爬取用户
垃圾消息 + 机器人
```

### 5.8 支付欺诈、卡密、盗刷

- `rule_id`: `CYBER_PAYMENT_FRAUD_001`
- `category`: `fraud.payment`
- `score`: `100`
- `action`: `block`

英文：

```text
carding
stolen credit card
credit card dump
bin attack
chargeback fraud
payment bypass
fake payment proof
```

中文：

```text
盗刷
黑卡
信用卡料
卡料
跑卡
撞库支付
绕过支付
伪造付款截图
拒付欺诈
```

## 6. NSFW 规则

### 6.1 未成年人性内容

- `rule_id`: `NSFW_SEXUAL_MINORS_001`
- `category`: `nsfw.sexual_minors`
- `score`: `200`
- `action`: `block`

命中逻辑：`未成年人词` + `性内容词`。

英文未成年人词：

```text
minor
underage
child
children
kid
teen
schoolgirl
schoolboy
preteen
lolita
loli
shota
```

中文未成年人词：

```text
未成年
儿童
小孩
孩子
幼女
幼童
萝莉
正太
学生妹
小学生
初中生
未满18
未满十八
```

英文性内容词：

```text
sex
sexual
nude
naked
porn
erotic
explicit
lewd
strip
seduce
incest
```

中文性内容词：

```text
性
色情
裸露
裸体
成人内容
露骨
淫秽
挑逗
脱衣
乱伦
```

任意组合命中即拦截。

### 6.2 露骨色情生成

- `rule_id`: `NSFW_EXPLICIT_SEXUAL_001`
- `category`: `nsfw.explicit_sexual`
- `score`: `80`
- `action`: `block`

英文：

```text
explicit sex
pornographic
hardcore porn
graphic sexual
sexual act
oral sex
anal sex
masturbation
fetish porn
```

中文：

```text
露骨色情
色情描写
成人影片
成人视频
性交
口交
肛交
自慰
性癖色情
```

组合增强：

```text
write/generate/create/生成/写/制作 + 上述词 => block
```

允许例外：

```text
性教育
医学解释
性健康咨询
法律合规讨论
```

### 6.3 非自愿、性暴力、胁迫性内容

- `rule_id`: `NSFW_NON_CONSENSUAL_001`
- `category`: `nsfw.non_consensual`
- `score`: `200`
- `action`: `block`

英文：

```text
non-consensual
without consent
rape
sexual assault
forced sex
coerced
blackmail sex
revenge porn
hidden camera
upskirt
```

中文：

```text
非自愿
未经同意
强奸
性侵
强迫发生关系
胁迫
偷拍视频
偷拍裙底
报复性色情
裸照威胁
```

### 6.4 裸露或色情图片生成提示词

- `rule_id`: `NSFW_IMAGE_PROMPT_001`
- `category`: `nsfw.image_prompt`
- `score`: `80`
- `action`: `block`

命中逻辑：`图片生成词` + `裸露/色情词`。

英文图片生成词：

```text
generate image
create image
image prompt
stable diffusion
midjourney
photorealistic
render
```

中文图片生成词：

```text
生成图片
画一张
图片提示词
绘图提示词
文生图
图生图
写真
渲染
```

英文裸露/色情词：

```text
nude
naked
 topless
see-through
lingerie
porn
explicit
spread legs
```

中文裸露/色情词：

```text
裸体
裸露
裸照
上空
透视
内衣
色情
露骨
大尺度
```

允许例外：

```text
医学解剖图
艺术史分析
服装设计说明
```

## 7. 隐私与人肉搜索规则

### 7.1 个人隐私泄露

- `rule_id`: `PRIVACY_DANGEROUS_DISCLOSURE_001`
- `category`: `privacy.dangerous_disclosure`
- `score`: `80`
- `action`: `block`

英文动词：

```text
find address
track location
dox
lookup personal info
find phone number
find real identity
```

中文动词：

```text
查地址
定位某人
人肉
开盒
查手机号
查身份证
查真实身份
查家庭住址
```

敏感字段：

```text
身份证
手机号
家庭住址
住址
银行卡
护照
社保号
phone number
home address
id number
passport
bank account
ssn
```

允许例外：

```text
隐私保护建议
个人信息脱敏
合规数据处理
```

## 8. 自残与暴力规则

### 8.1 自残方法指导

- `rule_id`: `SELF_HARM_INSTRUCTIONS_001`
- `category`: `self_harm.instructions`
- `score`: `100`
- `action`: `block`

英文：

```text
how to kill myself
suicide method
self harm instructions
painless suicide
best way to die
```

中文：

```text
怎么自杀
自杀方法
自残教程
无痛自杀
怎么死不痛苦
```

允许并应放行的求助类表达：

```text
我想自杀怎么办
如何帮助有自杀想法的人
心理危机求助
```

说明：求助类不要拦截为违规，应该交给上游模型提供安全支持或转人工。

### 8.2 暴力伤害指导

- `rule_id`: `VIOLENCE_INSTRUCTIONS_001`
- `category`: `violence.instructions`
- `score`: `80`
- `action`: `block`

英文：

```text
how to hurt someone
how to kill someone
make a weapon
hide a weapon
violent attack plan
```

中文：

```text
如何伤害别人
如何杀人
制作武器
藏匿武器
暴力袭击计划
```

## 9. 组合规则建议

### 9.1 强制 block 组合

```text
未成年人词 + 性内容词 => block
生成动词 + 恶意软件词 => block
规避词 + 安全检测目标 => block
窃取动词 + 凭据目标 => block
攻击动词 + 真实目标特征 => block
图片生成词 + 裸露/色情词 => block
非自愿词 + 性内容词 => block
```

### 9.2 降低误杀白名单

出现以下词时，可降低 20 分，但不得覆盖强制 block 规则：

英文：

```text
defense
defensive
protect
mitigate
patch
fix
detect
monitor
incident response
ctf
lab
localhost
training
education
medical
legal compliance
```

中文：

```text
防御
保护
缓解
修复
补丁
检测
监控
应急响应
靶场
本地环境
授权
培训
教育
医学
合规
法律讨论
```

不得白名单覆盖：

```text
sexual_minors
credential_theft
malware_generation
non_consensual_sexual
payment_fraud
```

## 10. 建议配置结构

```json
{
  "enabled": true,
  "mode": "block",
  "block_score": 40,
  "review_score": 20,
  "max_input_chars": 8000,
  "return_message": "请求内容不符合输入安全规则，请修改 prompt 后重试。",
  "rules": [
    {
      "id": "CYBER_CREDENTIAL_THEFT_001",
      "category": "cyber_abuse.credential_theft",
      "score": 100,
      "action": "block"
    },
    {
      "id": "NSFW_SEXUAL_MINORS_001",
      "category": "nsfw.sexual_minors",
      "score": 200,
      "action": "block"
    }
  ]
}
```

## 11. 日志字段

建议记录：

```text
request_id
user_id
ip_hash
endpoint
model
category
rule_id
score
action
request_hash
created_at
```

不建议默认记录：

```text
完整原文
完整图片 URL
完整 token
完整 cookie
完整密钥
```

## 12. 上线顺序

1. `log` 模式上线全部规则。
2. 观察 1 到 3 天误杀。
3. 先启用强制 block：
   - `NSFW_SEXUAL_MINORS_001`
   - `NSFW_NON_CONSENSUAL_001`
   - `CYBER_CREDENTIAL_THEFT_001`
   - `CYBER_MALWARE_001`
   - `CYBER_EVASION_001`
   - `CYBER_PHISHING_001`
   - `CYBER_PAYMENT_FRAUD_001`
4. 对真实目标攻击、DDoS、平台滥用启用 `review` 或较高阈值 block。
5. 后续如可用，再接入模型审查作为二级判断。
