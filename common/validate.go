package common

import (
	"unicode/utf8"

	"github.com/go-playground/validator/v10"
)

const (
	PasswordMinLength = 8
	PasswordMaxLength = 20
	PasswordMaxBytes  = 72
)

var Validate *validator.Validate

func init() {
	Validate = validator.New()
	if err := Validate.RegisterValidation("password", func(field validator.FieldLevel) bool {
		return ValidatePasswordLength(field.Field().String())
	}); err != nil {
		panic(err)
	}
}

func ValidatePasswordLength(password string) bool {
	characterCount := utf8.RuneCountInString(password)
	return characterCount >= PasswordMinLength &&
		characterCount <= PasswordMaxLength &&
		len(password) <= PasswordMaxBytes
}
