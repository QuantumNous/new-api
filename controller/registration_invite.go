package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var (
	errRegistrationInviteCodeRequired = errors.New("registration invite code is required")
	errRegistrationInviteCodeInvalid  = errors.New("registration invite code is invalid")
)

type inviteCodeLookup func(string) (int, error)

func normalizeRegistrationInviteMode(mode string) string {
	switch mode {
	case common.RegistrationInviteModeRequired, common.RegistrationInviteModeHidden:
		return mode
	default:
		return common.RegistrationInviteModeOptional
	}
}

func resolveRegistrationInviter(mode string, affCode string, lookup inviteCodeLookup) (int, error) {
	mode = normalizeRegistrationInviteMode(mode)
	if mode == common.RegistrationInviteModeHidden {
		return 0, nil
	}

	affCode = strings.TrimSpace(affCode)
	if affCode == "" {
		if mode == common.RegistrationInviteModeRequired {
			return 0, errRegistrationInviteCodeRequired
		}
		return 0, nil
	}

	inviterID, err := lookup(affCode)
	if err == nil {
		return inviterID, nil
	}
	return 0, errRegistrationInviteCodeInvalid
}

func resolveConfiguredRegistrationInviter(affCode string) (int, error) {
	return resolveRegistrationInviter(
		common.RegistrationInviteMode,
		affCode,
		model.GetUserIdByAffCode,
	)
}
