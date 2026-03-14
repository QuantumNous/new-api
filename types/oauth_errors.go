package types

type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}
