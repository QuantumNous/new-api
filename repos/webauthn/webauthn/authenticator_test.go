package webauthn

import (
	"reflect"
	"testing"

	p "github.com/go-webauthn/webauthn/protocol"
)

func TestAuthenticator_UpdateCounter(t *testing.T) {
	type fields struct {
		AAGUID       []byte
		SignCount    uint32
		CloneWarning bool
	}

	type args struct {
		authDataCount uint32
	}

	tests := []struct {
		name        string
		fields      fields
		args        args
		wantWarning bool
	}{
		{
			"Increased counter",
			fields{
				AAGUID:       make([]byte, 16),
				SignCount:    1,
				CloneWarning: false,
			},
			args{
				authDataCount: 2,
			},
			false,
		},
		{
			"Unchanged counter",
			fields{
				AAGUID:       make([]byte, 16),
				SignCount:    1,
				CloneWarning: false,
			},
			args{
				authDataCount: 1,
			},
			true,
		},
		{
			"Decreased counter",
			fields{
				AAGUID:       make([]byte, 16),
				SignCount:    2,
				CloneWarning: false,
			},
			args{
				authDataCount: 1,
			},
			true,
		},
		{
			"Zero counter",
			fields{
				AAGUID:       make([]byte, 16),
				SignCount:    0,
				CloneWarning: false,
			},
			args{
				authDataCount: 0,
			},
			false,
		},
		{
			"Counter returned to zero",
			fields{
				AAGUID:       make([]byte, 16),
				SignCount:    1,
				CloneWarning: false,
			},
			args{
				authDataCount: 0,
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &Authenticator{
				AAGUID:       tt.fields.AAGUID,
				SignCount:    tt.fields.SignCount,
				CloneWarning: tt.fields.CloneWarning,
			}

			previousSignCount := a.SignCount
			a.UpdateCounter(tt.args.authDataCount)

			if a.CloneWarning != tt.wantWarning {
				t.Errorf("Clone warning result [%v] does not match expectation: [%v]", a.CloneWarning, tt.wantWarning)
				return
			}

			// If there's no clone warning then, assert that the SignCount is updated.
			if !a.CloneWarning && a.SignCount != tt.args.authDataCount {
				t.Errorf("Sign Count value [%v] does not match expectation [%v]", a.SignCount, tt.args.authDataCount)
				return
			}

			// If there's clone warning then, assert that the Sign Count remains unchanged.
			if a.CloneWarning && a.SignCount != previousSignCount {
				t.Errorf("Sign Count value [%v] does not match expectation [%v]", a.SignCount, tt.args.authDataCount)
				return
			}
		})
	}
}

func TestSelectAuthenticator(t *testing.T) {
	type args struct {
		att string
		rrk *bool
		uv  string
	}

	tests := []struct {
		name string
		args args
		want p.AuthenticatorSelection
	}{
		{"Generate Correct Authenticator Selection",
			args{
				att: "platform",
				rrk: p.ResidentKeyNotRequired(),
				uv:  "preferred",
			},
			p.AuthenticatorSelection{
				AuthenticatorAttachment: p.Platform,
				RequireResidentKey:      p.ResidentKeyNotRequired(),
				UserVerification:        p.VerificationPreferred,
			},
		},
		{"Generate Correct Authenticator Selection",
			args{
				att: "cross-platform",
				rrk: p.ResidentKeyRequired(),
				uv:  "required",
			},
			p.AuthenticatorSelection{
				AuthenticatorAttachment: p.CrossPlatform,
				RequireResidentKey:      p.ResidentKeyRequired(),
				UserVerification:        p.VerificationRequired,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SelectAuthenticator(tt.args.att, tt.args.rrk, tt.args.uv); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("SelectAuthenticator() = %v, want %v", got, tt.want)
			}
		})
	}
}
