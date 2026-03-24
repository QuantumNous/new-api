package constant

type MultiKeyMode string

const (
	MultiKeyModeRandom  MultiKeyMode = "random"  // 随机
	MultiKeyModePolling MultiKeyMode = "polling" // 轮询
	MultiKeyModeSticky  MultiKeyMode = "sticky"  // 粘性
)
