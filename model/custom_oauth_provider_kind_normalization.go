package model

func normalizeCustomOAuthProviderForKind(provider *CustomOAuthProvider) {
	if provider == nil {
		return
	}

	switch provider.GetKind() {
	case CustomOAuthProviderKindOAuthCode:
		clearTrustedHeaderProviderFields(provider)
		clearCASProviderFields(provider)
		clearJWTDirectOnlyProviderFields(provider)
	case CustomOAuthProviderKindCAS:
		clearCASUnrelatedProviderFields(provider)
	case CustomOAuthProviderKindJWTDirect:
		clearTrustedHeaderProviderFields(provider)
		clearOAuthCodeOnlyProviderFields(provider)
		clearCASProviderFields(provider)
	case CustomOAuthProviderKindTrustedHeader:
		clearTrustedHeaderUnrelatedProviderFields(provider)
		clearCASProviderFields(provider)
	default:
		clearCASProviderFields(provider)
		clearCASUnrelatedProviderFields(provider)
	}
}

func NormalizeCustomOAuthProviderForRead(provider *CustomOAuthProvider) {
	normalizeCustomOAuthProviderForKind(provider)
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

func clearCASProviderFields(provider *CustomOAuthProvider) {
	provider.CASServerURL = ""
	provider.ServiceURL = ""
	provider.ValidateURL = ""
	provider.Renew = false
	provider.Gateway = false
}

func clearOAuthCodeOnlyProviderFields(provider *CustomOAuthProvider) {
	provider.TokenEndpoint = ""
	provider.ClientSecret = ""
	provider.AuthStyle = 0
}

func clearCASUnrelatedProviderFields(provider *CustomOAuthProvider) {
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
	provider.AuthStyle = 0
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
	provider.AuthStyle = 0
}
