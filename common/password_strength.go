package common

import "errors"

// ErrPasswordTooWeak is returned when a self-registration password does not
// meet the minimum strength policy (8-20 characters with at least three
// character classes: lowercase, uppercase, digit, symbol).
var ErrPasswordTooWeak = errors.New("password is too weak")

// ValidatePasswordStrength enforces the same minimum strength used by the
// registration form so that server-side validation does not rely on the
// browser. The rule: length within [8,20] and at least 3 character classes.
func ValidatePasswordStrength(password string) error {
	length := len([]rune(password))
	if length < 8 || length > 20 {
		return ErrPasswordTooWeak
	}
	return validatePasswordCharacterClasses(password)
}

func validatePasswordCharacterClasses(password string) error {
	var classes int
	for _, r := range password {
		switch {
		case r >= 'a' && r <= 'z':
			classes = markClass(classes, 1)
		case r >= 'A' && r <= 'Z':
			classes = markClass(classes, 2)
		case r >= '0' && r <= '9':
			classes = markClass(classes, 4)
		default:
			classes = markClass(classes, 8)
		}
	}
	if bitCount(classes) < 3 {
		return ErrPasswordTooWeak
	}
	return nil
}

func markClass(bits, class int) int {
	return bits | class
}

func bitCount(bits int) int {
	count := 0
	for bits != 0 {
		bits &= bits - 1
		count++
	}
	return count
}
