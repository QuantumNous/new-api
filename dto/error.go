package dto

type OpenAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Param   string `json:"param"`
	Code    any    `json:"code"`
}

type OpenAIErrorWithStatusCode struct {
	Error      OpenAIError `json:"error"`
	StatusCode int         `json:"status_code"`
	LocalError bool
}

type GeneralErrorResponse struct {
	Error    OpenAIError `json:"error"`
	Message  string      `json:"message"`
	Msg      string      `json:"msg"`
	Err      string      `json:"err"`
	ErrorMsg string      `json:"error_msg"`
	Header   struct {
		Message string `json:"message"`
	} `json:"header"`
	Response struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	} `json:"response"`
}

func (e GeneralErrorResponse) ToMessage() string {
	if e.Error.Message != "" {
		return e.Error.Message
	}
	if e.Message != "" {
		return e.Message
	}
	if e.Msg != "" {
		return e.Msg
	}
	if e.Err != "" {
		return e.Err
	}
	if e.ErrorMsg != "" {
		return e.ErrorMsg
	}
	if e.Header.Message != "" {
		return e.Header.Message
	}
	if e.Response.Error.Message != "" {
		return e.Response.Error.Message
	}
	return ""
}

// 自定义HTTP状态码 (使用非标准状态码范围)
const (
	StatusNewAPIBatchRateLimitExceeded = 499 // 自定义限流状态码
	StatusNewAPIBatchTimeout           = 598 // 自定义超时状态码
	StatusNewAPIBatchInternal          = 599 // 自定义内部错误状态码
	StatusNewAPIBatchSubmitted         = 203 // 批量请求已提交，需要重试获取结果
	StatusNewAPIBatchAccepted          = 202 // 批量请求已接受，正在处理中
	StatusRequestConflict              = 409 // 请求冲突，如分布式锁获取失败
)
