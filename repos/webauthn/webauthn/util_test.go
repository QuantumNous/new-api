package webauthn

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsByteArrayInSlice(t *testing.T) {
	testCases := []struct {
		name     string
		have     []byte
		haystack [][]byte
		expected bool
	}{
		{
			"ShouldMatchSingleEntry",
			[]byte("123"),
			[][]byte{[]byte("123")},
			true,
		},
		{
			"ShouldMatchMultiEntry",
			[]byte("123"),
			[][]byte{[]byte("bac"), []byte("123")},
			true,
		},
		{
			"ShouldNotMatchEmpty",
			[]byte("123"),
			nil,
			false,
		},
		{
			"ShouldNotMatchNotInSlice",
			[]byte("123"),
			[][]byte{[]byte("bac"), []byte("no")},
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, isByteArrayInSlice(tc.have, tc.haystack...))
		})
	}
}

func TestIsCredentialsAllowedMatchingOwned(t *testing.T) {
	testCases := []struct {
		name        string
		allowed     [][]byte
		credentials []Credential
		expected    bool
	}{
		{
			"ShouldMatchSingleEntry",
			[][]byte{[]byte("123")},
			[]Credential{
				{
					ID: []byte("123"),
				},
			},
			true,
		},
		{
			"ShouldMatchMultipleEntry",
			[][]byte{[]byte("123")},
			[]Credential{
				{
					ID: []byte("123"),
				},
				{
					ID: []byte("ab"),
				},
			},
			true,
		},
		{
			"ShouldMatchMultipleEntryAlt",
			[][]byte{[]byte("123"), []byte("ab")},
			[]Credential{
				{
					ID: []byte("123"),
				},
				{
					ID: []byte("ab"),
				},
			},
			true,
		},
		{
			"ShouldNotMatchDifferentCredentials",
			[][]byte{[]byte("123")},
			[]Credential{
				{
					ID: []byte("456"),
				},
			},
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, isCredentialsAllowedMatchingOwned(tc.allowed, tc.credentials))
		})
	}
}
