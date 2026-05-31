package common

import (
	"sync"
	"time"

	"github.com/mojocn/base64Captcha"
)

// CaptchaValidSeconds 图形验证码有效期（秒）
var CaptchaValidSeconds = 180

const captchaRedisPrefix = "captcha:"

// captchaMemValue 内存回退存储的单条记录
type captchaMemValue struct {
	answer    string
	expiredAt time.Time
}

var (
	captchaMemMu  sync.Mutex
	captchaMemMap = make(map[string]captchaMemValue)
)

// captchaStore 实现 base64Captcha.Store 接口，Redis 优先，未启用时回退到内存
type captchaStore struct{}

var captchaStoreInst = captchaStore{}

func (s captchaStore) Set(id string, value string) error {
	if RedisEnabled {
		return RedisSet(captchaRedisPrefix+id, value, time.Duration(CaptchaValidSeconds)*time.Second)
	}
	captchaMemMu.Lock()
	defer captchaMemMu.Unlock()
	captchaMemMap[id] = captchaMemValue{
		answer:    value,
		expiredAt: time.Now().Add(time.Duration(CaptchaValidSeconds) * time.Second),
	}
	captchaMemCleanup()
	return nil
}

func (s captchaStore) Get(id string, clear bool) string {
	if RedisEnabled {
		val, err := RedisGet(captchaRedisPrefix + id)
		if err != nil {
			return ""
		}
		if clear {
			_ = RedisDel(captchaRedisPrefix + id)
		}
		return val
	}
	captchaMemMu.Lock()
	defer captchaMemMu.Unlock()
	v, ok := captchaMemMap[id]
	if !ok || time.Now().After(v.expiredAt) {
		if ok {
			delete(captchaMemMap, id)
		}
		return ""
	}
	if clear {
		delete(captchaMemMap, id)
	}
	return v.answer
}

func (s captchaStore) Verify(id, answer string, clear bool) bool {
	// 先窥探不消费，仅在答案正确时才清除，避免答错一次即失效
	stored := s.Get(id, false)
	if stored == "" {
		return false
	}
	if stored != answer {
		return false
	}
	if clear {
		s.Get(id, true)
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
