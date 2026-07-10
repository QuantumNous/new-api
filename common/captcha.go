package common

import (
	"sync"
	"time"

	"github.com/mojocn/base64Captcha"
)

// CaptchaValidSeconds 图形验证码有效期（秒）
var CaptchaValidSeconds = 180

const captchaRedisPrefix = "captcha:"

// captchaRecord 验证码存储内容：答案 + 服务端签发时间
type captchaRecord struct {
	Answer    string `json:"a"`
	CreatedAt int64  `json:"c"` // 毫秒时间戳，图片下发时写入
}

// captchaMemValue 内存回退存储的单条记录
type captchaMemValue struct {
	record    captchaRecord
	expiredAt time.Time
}

var (
	captchaMemMu  sync.Mutex
	captchaMemMap = make(map[string]captchaMemValue)
)

// captchaStore 实现 base64Captcha.Store 接口，Redis 优先，未启用时回退到内存
type captchaStore struct{}

var captchaStoreInst = captchaStore{}

func encodeCaptchaRecord(answer string, createdAt int64) string {
	if createdAt <= 0 {
		createdAt = time.Now().UnixMilli()
	}
	raw, err := Marshal(captchaRecord{Answer: answer, CreatedAt: createdAt})
	if err != nil {
		return answer
	}
	return string(raw)
}

func decodeCaptchaRecord(raw string) (captchaRecord, bool) {
	if raw == "" {
		return captchaRecord{}, false
	}
	var rec captchaRecord
	if err := UnmarshalJsonStr(raw, &rec); err == nil && rec.Answer != "" {
		return rec, true
	}
	// 兼容旧格式：纯答案字符串
	return captchaRecord{Answer: raw, CreatedAt: 0}, true
}

func (s captchaStore) Set(id string, value string) error {
	payload := encodeCaptchaRecord(value, time.Now().UnixMilli())
	if RedisEnabled {
		return RedisSet(captchaRedisPrefix+id, payload, time.Duration(CaptchaValidSeconds)*time.Second)
	}
	captchaMemMu.Lock()
	defer captchaMemMu.Unlock()
	rec, _ := decodeCaptchaRecord(payload)
	captchaMemMap[id] = captchaMemValue{
		record:    rec,
		expiredAt: time.Now().Add(time.Duration(CaptchaValidSeconds) * time.Second),
	}
	captchaMemCleanup()
	return nil
}

func (s captchaStore) Get(id string, clear bool) string {
	rec, ok := s.load(id, clear)
	if !ok {
		return ""
	}
	return rec.Answer
}

func (s captchaStore) load(id string, clear bool) (captchaRecord, bool) {
	if id == "" {
		return captchaRecord{}, false
	}
	if RedisEnabled {
		val, err := RedisGet(captchaRedisPrefix + id)
		if err != nil {
			return captchaRecord{}, false
		}
		rec, ok := decodeCaptchaRecord(val)
		if !ok {
			return captchaRecord{}, false
		}
		if clear {
			_ = RedisDel(captchaRedisPrefix + id)
		}
		return rec, true
	}
	captchaMemMu.Lock()
	defer captchaMemMu.Unlock()
	v, ok := captchaMemMap[id]
	if !ok || time.Now().After(v.expiredAt) {
		if ok {
			delete(captchaMemMap, id)
		}
		return captchaRecord{}, false
	}
	if clear {
		delete(captchaMemMap, id)
	}
	return v.record, true
}

func (s captchaStore) Verify(id, answer string, clear bool) bool {
	// 先窥探不消费，仅在答案正确时才清除，避免答错一次即失效
	rec, ok := s.load(id, false)
	if !ok || rec.Answer == "" {
		return false
	}
	if rec.Answer != answer {
		return false
	}
	if clear {
		s.load(id, true)
	}
	return true
}

// captchaMemCleanup 清理过期内存记录，调用方必须已持有 captchaMemMu
func captchaMemCleanup() {
	now := time.Now()
	for k, v := range captchaMemMap {
		if now.After(v.expiredAt) {
			delete(captchaMemMap, k)
		}
	}
}

// GenerateCaptcha 生成 6 位纯数字图形验证码，返回验证码 id 与 base64 png 图片
func GenerateCaptcha() (id string, b64 string, err error) {
	driver := base64Captcha.NewDriverDigit(50, 140, 6, 0.55, 70)
	c := base64Captcha.NewCaptcha(driver, captchaStoreInst)
	id, b64, _, err = c.Generate()
	return id, b64, err
}

// PeekCaptchaMeta 读取验证码是否存在及服务端签发时间（毫秒），不消费。
// exists=false 表示不存在或已过期；createdAt=0 表示旧格式记录（无签发时间）。
func PeekCaptchaMeta(id string) (createdAt int64, exists bool) {
	rec, ok := captchaStoreInst.load(id, false)
	if !ok {
		return 0, false
	}
	return rec.CreatedAt, true
}

// GetCaptchaCreatedAt 读取验证码服务端签发时间（毫秒），不消费。不存在、过期或无签发时间返回 false。
func GetCaptchaCreatedAt(id string) (int64, bool) {
	createdAt, exists := PeekCaptchaMeta(id)
	if !exists || createdAt <= 0 {
		return 0, false
	}
	return createdAt, true
}

// VerifyCaptcha 校验答案并一次性消费
func VerifyCaptcha(id, answer string) bool {
	if id == "" || answer == "" {
		return false
	}
	return captchaStoreInst.Verify(id, answer, true)
}

// SeedCaptchaForTest 以指定 id/answer 预置一条验证码记录，返回写入的 answer。
// 仅供跨包测试使用（生成的答案随机不可预测，测试需要确定性输入）。
func SeedCaptchaForTest(id, answer string) string {
	_ = captchaStoreInst.Set(id, answer)
	return answer
}

// SeedCaptchaWithCreatedAtForTest 预置验证码并指定签发时间（毫秒），仅测试使用。
// createdAt=0 表示旧格式（无签发时间）。
func SeedCaptchaWithCreatedAtForTest(id, answer string, createdAt int64) string {
	if RedisEnabled {
		var payload string
		if createdAt <= 0 {
			payload = answer // 旧格式：纯答案
		} else {
			payload = encodeCaptchaRecord(answer, createdAt)
		}
		_ = RedisSet(captchaRedisPrefix+id, payload, time.Duration(CaptchaValidSeconds)*time.Second)
		return answer
	}
	captchaMemMu.Lock()
	defer captchaMemMu.Unlock()
	captchaMemMap[id] = captchaMemValue{
		record:    captchaRecord{Answer: answer, CreatedAt: createdAt},
		expiredAt: time.Now().Add(time.Duration(CaptchaValidSeconds) * time.Second),
	}
	return answer
}
