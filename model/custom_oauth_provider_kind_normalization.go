package model

func normalizeCustomOAuthProviderForKind(provider *CustomOAuthProvider) {
	if provider == nil {
		return
	}

	switch provider.GetKind() {
	case CustomOAuthProviderKindOAuthCode:
		clearTrustedHeaderProviderFields(provider)
		clearJWTDirectOnlyProviderFields(provider)
	case CustomOAuthProviderKindJWTDirect:
		clearTrustedHeaderProviderFields(provider)
		clearOAuthCodeOnlyProviderFields(provider)
	case CustomOAuthProviderKindTrustedHeader:
		clearTrustedHeaderUnrelatedProviderFields(provider)
	}
}

func NormalizeCustomOAuthProviderForRead(provider *CustomOAuthProvider) {
	normalizeCustomOAuthProviderForKind(provider)
}

func clearTrustedHeaderProviderFields(provider *CustomOAuthProvider) {
	provider.TrustedProxyCIDRs = ""
	provider.ExternalIDHeader = ""
	provider.UsernameHeader = ""
	provider.DisplayNameHeader = ""
	provider.EmailHeader = ""
	provider.GroupHeader = ""
	provider.RoleHeader = ""
}

func clearJWTDirectOnlyProviderFields(provider *CustomOAuthProvider) {
	provider.JWTSource = ""
	provider.JWTHeader = ""
	provider.JWTIdentityMode = ""
	provider.JWTAcquireMode = ""
	provider.Issuer = ""
	provider.Audience = ""
	provider.JwksURL = ""
	provider.PublicKey = ""
	provider.AuthorizationServiceField = ""
	provider.TicketExchangeURL = ""
	provider.TicketExchangeMethod = ""
	provider.TicketExchangePayloadMode = ""
	provider.TicketExchangeTicketField = ""
	provider.TicketExchangeTokenField = ""
	provider.TicketExchangeServiceField = ""
	provider.TicketExchangeExtraParams = ""
	provider.TicketExchangeHeaders = ""
}

func clearOAuthCodeOnlyProviderFields(provider *CustomOAuthProvider) {
	provider.TokenEndpoint = ""
	provider.ClientSecret = ""
	provider.AuthStyle = 0
}

func clearTrustedHeaderUnrelatedProviderFields(provider *CustomOAuthProvider) {
	provider.WellKnown = ""
	provider.ClientId = ""
	provider.ClientSecret = ""
	provider.AuthorizationEndpoint = ""
	provider.TokenEndpoint = ""
	provider.UserInfoEndpoint = ""
	provider.Scopes = ""
	provider.Issuer = ""
	provider.Audience = ""
	provider.JwksURL = ""
	provider.PublicKey = ""
	provider.JWTSource = ""
	provider.JWTHeader = ""
	provider.JWTIdentityMode = ""
	provider.JWTAcquireMode = ""
	provider.AuthorizationServiceField = ""
	provider.TicketExchangeURL = ""
	provider.TicketExchangeMethod = ""
	provider.TicketExchangePayloadMode = ""
	provider.TicketExchangeTicketField = ""
	provider.TicketExchangeTokenField = ""
	provider.TicketExchangeServiceField = ""
	provider.TicketExchangeExtraParams = ""
	provider.TicketExchangeHeaders = ""
	provider.UserIdField = ""
	provider.UsernameField = ""
	provider.DisplayNameField = ""
	provider.EmailField = ""
	provider.GroupField = ""
	provider.RoleField = ""
	provider.AccessPolicy = ""
	provider.AccessDeniedMessage = ""
	provider.AuthStyle = 0
}
