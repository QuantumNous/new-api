package constant

var StreamingTimeout int

// StreamingFirstResponseTimeout limits how long upstream may take to deliver
// the first SSE data event after the request reached the backend. Unlike
// StreamingTimeout (the per-chunk idle ticker, which gets reset on every
// scanner read — including upstream keep-alive comments), this watchdog never
// resets and is the only reliable way to abort streams where upstream is
// "alive but silent". 0 disables the watchdog. Defaults to 180 seconds.
var StreamingFirstResponseTimeout int
var DifyDebug bool
var MaxFileDownloadMB int
var StreamScannerMaxBufferMB int
var ForceStreamOption bool
var CountToken bool
var GetMediaToken bool
var GetMediaTokenNotStream bool
var UpdateTask bool
var MaxRequestBodyMB int
var AzureDefaultAPIVersion string
var NotifyLimitCount int
var NotificationLimitDurationMinute int
var GenerateDefaultToken bool
var ErrorLogEnabled bool
var TaskQueryLimit int
var TaskTimeoutMinutes int

// temporary variable for sora patch, will be removed in future
var TaskPricePatches []string

// TrustedRedirectDomains is a list of trusted domains for redirect URL validation.
// Domains support subdomain matching (e.g., "example.com" matches "sub.example.com").
var TrustedRedirectDomains []string
