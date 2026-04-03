package controller

import "github.com/QuantumNous/new-api/model"

type customOAuthJWTLoginResult struct {
	Action                string
	User                  *model.User
	BindAfterStatusCheck  bool
	ProviderUserID        string
	AutoRegisterTriggered bool
	EmailMergeTriggered   bool
	GroupResult           string
	RoleResult            int
}

type customOAuthJWTAuditInfo struct {
	ProviderSlug          string
	ProviderKind          string
	ExternalID            string
	TargetUserID          int
	Action                string
	AutoRegisterTriggered bool
	EmailMergeTriggered   bool
	GroupResult           string
	RoleResult            string
	FailureReason         string
}
