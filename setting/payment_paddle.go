package setting

import (
	"errors"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
)

var (
	PaddleApiKey        string
	PaddleClientToken   string
	PaddleWebhookSecret string
	PaddleSandbox       bool
	PaddleProductId     string
	PaddleCurrency      string  = "USD"
	PaddleUnitPrice     float64 = 1.0
	PaddleMinTopUp      int     = 1
)

var (
	paddleAPIKeyPattern        = regexp.MustCompile(`^pdl_(sdbx|live)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$`)
	paddleClientTokenPattern   = regexp.MustCompile(`^(test|live)_[a-zA-Z\d]{27}$`)
	paddleWebhookSecretPattern = regexp.MustCompile(`^pdl_ntfset_[a-zA-Z\d]{26}_[a-zA-Z\d]{32}$`)
	paddleProductIDPattern     = regexp.MustCompile(`^pro_[a-z\d]{26}$`)
	paddleCurrencyPattern      = regexp.MustCompile(`^[A-Z]{3}$`)
)

func ApplyPaddleEnvOverrides() {
	if sandbox, ok := paddleSandboxFromEnv(); ok {
		if !sandbox {
			applyPaddleEnv("PADDLE_LIVE_", false)
			return
		}
		applyPaddleEnv("PADDLE_SANDBOX_", true)
	}
}

func applyPaddleEnv(prefix string, sandbox bool) {
	PaddleSandbox = sandbox
	if value := strings.TrimSpace(os.Getenv(prefix + "API_KEY")); value != "" {
		PaddleApiKey = value
	}
	if value := strings.TrimSpace(os.Getenv(prefix + "CLIENT_TOKEN")); value != "" {
		PaddleClientToken = value
	}
	if value := strings.TrimSpace(os.Getenv(prefix + "WEBHOOK_SECRET")); value != "" {
		PaddleWebhookSecret = value
	}
	if value := strings.TrimSpace(os.Getenv(prefix + "PRODUCT_ID")); value != "" {
		PaddleProductId = value
	}
	if value := strings.ToUpper(strings.TrimSpace(os.Getenv(prefix + "CURRENCY"))); value != "" {
		PaddleCurrency = value
	}
	if value := strings.TrimSpace(os.Getenv(prefix + "UNIT_PRICE")); value != "" {
		if parsed, err := strconv.ParseFloat(value, 64); err == nil && !math.IsNaN(parsed) && !math.IsInf(parsed, 0) {
			PaddleUnitPrice = parsed
		}
	}
	if value := strings.TrimSpace(os.Getenv(prefix + "MIN_TOPUP")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			PaddleMinTopUp = parsed
		}
	}
}

func EffectivePaddleSandbox() bool {
	if sandbox, ok := paddleSandboxFromEnv(); ok {
		return sandbox
	}

	apiKey := strings.TrimSpace(PaddleApiKey)
	if strings.HasPrefix(apiKey, "pdl_live_apikey_") {
		return false
	}
	if strings.HasPrefix(apiKey, "pdl_sdbx_apikey_") {
		return true
	}

	clientToken := strings.TrimSpace(PaddleClientToken)
	if strings.HasPrefix(clientToken, "live_") {
		return false
	}
	if strings.HasPrefix(clientToken, "test_") {
		return true
	}

	return PaddleSandbox
}

func paddleSandboxFromEnv() (bool, bool) {
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("PADDLE_ENVIRONMENT")))
	switch environment {
	case "live", "prod", "production":
		return false, true
	case "sandbox", "test":
		return true, true
	default:
		return false, false
	}
}

func ValidatePaddleOption(key, value string) error {
	value = strings.TrimSpace(value)
	switch key {
	case "PaddleApiKey":
		if value == "" {
			return nil
		}
		if strings.HasPrefix(value, "apikey_") {
			return errors.New("Paddle API key 必须使用完整 pdl_live_apikey_... 或 pdl_sdbx_apikey_... 形态，不能使用 apikey_... ID")
		}
		if !paddleAPIKeyPattern.MatchString(value) {
			return errors.New("Paddle API key 格式无效，应使用完整 pdl_live_apikey_... 或 pdl_sdbx_apikey_... 形态")
		}
	case "PaddleClientToken":
		if value == "" {
			return nil
		}
		if !paddleClientTokenPattern.MatchString(value) {
			return errors.New("Paddle client-side token 格式无效，应使用完整 live_... 或 test_... 形态")
		}
	case "PaddleWebhookSecret":
		if value == "" {
			return nil
		}
		if strings.HasPrefix(value, "ntfset_") {
			return errors.New("Paddle webhook secret 必须使用完整 endpoint signing secret pdl_ntfset_..._...，不能使用 notification setting id ntfset_...")
		}
		if !paddleWebhookSecretPattern.MatchString(value) {
			return errors.New("Paddle webhook secret 格式无效，应使用完整 endpoint signing secret pdl_ntfset_..._...")
		}
	case "PaddleProductId":
		if value == "" {
			return nil
		}
		if !paddleProductIDPattern.MatchString(value) {
			return errors.New("Paddle product id 格式无效，应使用完整 pro_... 形态")
		}
	case "PaddleCurrency":
		if value == "" {
			return nil
		}
		if !paddleCurrencyPattern.MatchString(strings.ToUpper(value)) {
			return errors.New("Paddle currency 必须是 3 位 ISO 4217 币种代码")
		}
	case "PaddleUnitPrice":
		floatValue, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(floatValue) || math.IsInf(floatValue, 0) || floatValue <= 0 {
			return errors.New("Paddle unit price 必须大于 0")
		}
	case "PaddleMinTopUp":
		intValue, err := strconv.Atoi(value)
		if err != nil || intValue <= 0 {
			return errors.New("Paddle min topup 必须大于 0")
		}
	case "PaddleSandbox":
		if value != "true" && value != "false" {
			return errors.New("Paddle sandbox 必须是 true 或 false")
		}
	}
	return nil
}
