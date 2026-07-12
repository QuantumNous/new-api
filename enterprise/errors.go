/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	errUserAlreadyInEnterprise = errors.New("user already belongs to an enterprise")
	errEnterpriseAdminMustBeUser = errors.New("enterprise administrator must be a regular user")
	errInvitationUnavailable = errors.New("invitation is unavailable")
	errPendingRequestExists = errors.New("a pending request already exists")
	errInsufficientQuota = errors.New("insufficient quota")
	errQuotaOverflow = errors.New("quota amount exceeds the supported range")
)

func writeEnterpriseError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		failureI18n(c, http.StatusNotFound, i18n.MsgEnterpriseNotFound)
	case errors.Is(err, errUserAlreadyInEnterprise):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseUserAlreadyIn)
	case errors.Is(err, errEnterpriseAdminMustBeUser):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseAdminMustBeUser)
	case errors.Is(err, errInvitationUnavailable):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvitationUnavailable)
	case errors.Is(err, errPendingRequestExists):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterprisePendingRequestExists)
	case errors.Is(err, errInsufficientQuota):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseQuotaInsufficient)
	case errors.Is(err, errQuotaOverflow):
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseQuotaExceedsRange)
	default:
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseOpFailed)
	}
}
