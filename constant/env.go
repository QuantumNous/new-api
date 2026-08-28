package constant

var StreamingTimeout int
var DifyDebug bool
var MaxFileDownloadMB int

// MaxRelayResponseMB bounds the size of a non-stream upstream response body
// read fully into memory by relay handlers. A malicious or misbehaving
// upstream (e.g. free proxies) must not be able to OOM the gateway with an
// unbounded JSON body (F-36).
var MaxRelayResponseMB int
var StreamScannerMaxBufferMB int
var ForceStreamOption bool
var CountToken bool
var GetMediaToken bool
var GetMediaTokenNotStream bool
var UpdateTask bool
var MaxRequestBodyMB int
var AnonymousRequestBodyLimitKB int
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
