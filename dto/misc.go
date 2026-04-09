package dto

// TestStatusData is the response data for GET /api/status/test.
type TestStatusData struct {
	HttpStats any `json:"http_stats"`
}

// StatusData is the response data for GET /api/status.
type StatusData struct {
	Version                      string  `json:"version"`
	StartTime                    int64   `json:"start_time"`
	EmailVerification            bool    `json:"email_verification"`
	GitHubOAuth                  bool    `json:"github_oauth"`
	GitHubClientId               string  `json:"github_client_id"`
	DiscordOAuth                 bool    `json:"discord_oauth"`
	DiscordClientId              string  `json:"discord_client_id"`
	LinuxDOOAuth                 bool    `json:"linuxdo_oauth"`
	LinuxDOClientId              string  `json:"linuxdo_client_id"`
	LinuxDOMinimumTrustLevel     int     `json:"linuxdo_minimum_trust_level"`
	TelegramOAuth                bool    `json:"telegram_oauth"`
	TelegramBotName              string  `json:"telegram_bot_name"`
	SystemName                   string  `json:"system_name"`
	Logo                         string  `json:"logo"`
	FooterHtml                   string  `json:"footer_html"`
	WeChatQrcode                 string  `json:"wechat_qrcode"`
	WeChatLogin                  bool    `json:"wechat_login"`
	ServerAddress                string  `json:"server_address"`
	TurnstileCheck               bool    `json:"turnstile_check"`
	TurnstileSiteKey             string  `json:"turnstile_site_key"`
	TopUpLink                    string  `json:"top_up_link"`
	DocsLink                     string  `json:"docs_link"`
	QuotaPerUnit                 float64 `json:"quota_per_unit"`
	DisplayInCurrency            bool    `json:"display_in_currency"`
	QuotaDisplayType             string  `json:"quota_display_type"`
	CustomCurrencySymbol         string  `json:"custom_currency_symbol"`
	CustomCurrencyExchangeRate   float64 `json:"custom_currency_exchange_rate"`
	EnableBatchUpdate            bool    `json:"enable_batch_update"`
	EnableDrawing                bool    `json:"enable_drawing"`
	EnableTask                   bool    `json:"enable_task"`
	EnableDataExport             bool    `json:"enable_data_export"`
	DataExportDefaultTime        string  `json:"data_export_default_time"`
	DefaultCollapseSidebar       bool    `json:"default_collapse_sidebar"`
	MjNotifyEnabled              bool    `json:"mj_notify_enabled"`
	Chats                        []ChatEntry `json:"chats"`
	DemoSiteEnabled              bool    `json:"demo_site_enabled"`
	SelfUseModeEnabled           bool    `json:"self_use_mode_enabled"`
	DefaultUseAutoGroup          bool    `json:"default_use_auto_group"`
	UsdExchangeRate              float64 `json:"usd_exchange_rate"`
	Price                        float64 `json:"price"`
	StripeUnitPrice              float64 `json:"stripe_unit_price"`
	ApiInfoEnabled               bool    `json:"api_info_enabled"`
	UptimeKumaEnabled            bool    `json:"uptime_kuma_enabled"`
	AnnouncementsEnabled         bool    `json:"announcements_enabled"`
	FaqEnabled                   bool    `json:"faq_enabled"`
	HeaderNavModules             string  `json:"HeaderNavModules"`
	SidebarModulesAdmin          string  `json:"SidebarModulesAdmin"`
	OidcEnabled                  bool    `json:"oidc_enabled"`
	OidcClientId                 string  `json:"oidc_client_id"`
	OidcAuthorizationEndpoint    string  `json:"oidc_authorization_endpoint"`
	PasskeyLogin                 bool    `json:"passkey_login"`
	PasskeyDisplayName           string  `json:"passkey_display_name"`
	PasskeyRpId                  string  `json:"passkey_rp_id"`
	PasskeyOrigins               string  `json:"passkey_origins"`
	PasskeyAllowInsecure         bool    `json:"passkey_allow_insecure"`
	PasskeyUserVerification      string  `json:"passkey_user_verification"`
	PasskeyAttachment            string  `json:"passkey_attachment"`
	Setup                        bool    `json:"setup"`
	UserAgreementEnabled         bool    `json:"user_agreement_enabled"`
	PrivacyPolicyEnabled         bool    `json:"privacy_policy_enabled"`
	CheckinEnabled               bool    `json:"checkin_enabled"`
	QN                           string  `json:"_qn"`
	ApiInfo                      []ApiInfoEntry       `json:"api_info,omitempty"`
	Announcements                []AnnouncementEntry  `json:"announcements,omitempty"`
	FAQ                          []FAQEntry           `json:"faq,omitempty"`
	CustomOAuthProviders         []CustomOAuthInfo    `json:"custom_oauth_providers,omitempty"`
}

// PasswordResetRequest is the request body for POST /api/user/reset.
type PasswordResetRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

// ApiInfoEntry represents a single API info item displayed on the console dashboard.
type ApiInfoEntry struct {
	URL         string `json:"url"`
	Route       string `json:"route"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// AnnouncementEntry represents a single announcement displayed on the console dashboard.
type AnnouncementEntry struct {
	Content     string `json:"content"`
	PublishDate string `json:"publishDate"`
	Type        string `json:"type,omitempty"`
	Extra       string `json:"extra,omitempty"`
}

// FAQEntry represents a single FAQ item displayed on the console dashboard.
type FAQEntry struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// ChatEntry represents a chat application link (name → URL mapping).
type ChatEntry = map[string]string

// CustomOAuthInfo is a client-facing projection of a custom OAuth provider for the status endpoint.
type CustomOAuthInfo struct {
	Id                    int    `json:"id"`
	Name                  string `json:"name"`
	Slug                  string `json:"slug"`
	Icon                  string `json:"icon"`
	ClientId              string `json:"client_id"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	Scopes                string `json:"scopes"`
}
