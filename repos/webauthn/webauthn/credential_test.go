package webauthn

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/go-webauthn/webauthn/protocol"
)

func TestMakeNewCredential(t *testing.T) {
	type args struct {
		c *protocol.ParsedCredentialCreationData
	}

	var testCases []struct {
		name     string
		args     args
		expected *Credential
		err      string
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := NewCredential(nil, tc.args.c)
			if len(tc.err) > 0 {
				assert.EqualError(t, err, tc.err)
			} else {
				require.NoError(t, err)

				assert.EqualValues(t, tc.expected, actual)
			}
		})
	}
}
