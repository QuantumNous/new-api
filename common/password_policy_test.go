package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidatePasswordLengthUsesUnicodeCodePointsAndBcryptLimit(t *testing.T) {
	tests := []struct {
		name     string
		password string
		valid    bool
	}{
		{name: "seven ASCII characters", password: "Abcd1!x", valid: false},
		{name: "eight ASCII characters", password: "Abcd1!xy", valid: true},
		{name: "twenty ASCII characters", password: strings.Repeat("a", 20), valid: true},
		{name: "twenty one ASCII characters", password: strings.Repeat("a", 21), valid: false},
		{name: "seven emoji", password: strings.Repeat("😀", 7), valid: false},
		{name: "eight emoji", password: strings.Repeat("😀", 8), valid: true},
		{name: "twenty emoji exceed bcrypt byte limit", password: strings.Repeat("😀", 20), valid: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.valid, ValidatePasswordLength(test.password))
		})
	}
}
