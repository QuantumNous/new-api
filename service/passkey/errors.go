package passkey

import "errors"

type UserErrorCode string

const (
	UserErrorSettingsNotFound UserErrorCode = "settings_not_found"
	UserErrorInsecureOrigin   UserErrorCode = "insecure_origin"
	UserErrorHTTPSRequired    UserErrorCode = "https_required"
	UserErrorOriginUnknown    UserErrorCode = "origin_unknown"
	UserErrorRPIDNoOrigin     UserErrorCode = "rpid_no_origin"
	UserErrorOriginParse      UserErrorCode = "origin_parse"
	UserErrorSessionNotFound  UserErrorCode = "session_not_found"
	UserErrorSessionInvalid   UserErrorCode = "session_invalid"
)

type UserError struct {
	Code    UserErrorCode
	Message string
	Args    map[string]any
}

func (e *UserError) Error() string {
	return e.Message
}

func newUserError(code UserErrorCode, message string, args map[string]any) error {
	return &UserError{
		Code:    code,
		Message: message,
		Args:    args,
	}
}

func AsUserError(err error) (*UserError, bool) {
	var userErr *UserError
	if errors.As(err, &userErr) {
		return userErr, true
	}
	return nil, false
}
