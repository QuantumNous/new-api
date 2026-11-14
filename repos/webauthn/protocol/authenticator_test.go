package protocol

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	noneAuthDataBase64 = "pkLSG3xtVeHOI8U5mCjSx0m/am7y/gPMnhDN9O1ttItBAAAAAAAAAAAAAAAAAAAAAAAAAAAAQMAxl6G32ykWaLrv/ouCs5HoGsvONqBtOb7ZmyMs8K8PccnwyyqPzWn/yZuyQmQBguvjYSvH6gDBlFG65quUDCSlAQIDJiABIVggyJGP+ra/u/eVjqN4OeYXUShRWxrEeC6Sb5/bZmJ9q8MiWCCHIkRdg5oRb1RHoFVYUpogcjlObCKFsV1ls1T+uUc6rA=="
	attAuthDataBase64  = "lWkIjx7O4yMpVANdvRDXyuORMFonUbVZu4/Xy7IpvdRBAAAAAAAAAAAAAAAAAAAAAAAAAAAAQIniszxcGnhupdPFOHJIm6dscrWCC2h8xHicBMu91THD0kdOdB0QQtkaEn+6KfsfT1o3NmmFT8YfXrG734WfVSmlAQIDJiABIVggyoHHeiUw5aSbt8/GsL9zaqZGRzV26A4y3CnCGUhVXu4iWCBMnc8za5xgPzIygngAv9W+vZTMGJwwZcM4sjiqkcb/1g=="
)

func TestAuthenticatorFlags_UserPresent(t *testing.T) {
	var (
		goodByte byte = 0x01
		badByte  byte = 0x10
	)

	tests := []struct {
		name string
		flag AuthenticatorFlags
		want bool
	}{
		{
			"Present",
			AuthenticatorFlags(goodByte),
			true,
		},
		{
			"Missing",
			AuthenticatorFlags(badByte),
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.flag.UserPresent(); got != tt.want {
				t.Errorf("AuthenticatorFlags.UserPresent() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthenticatorFlags_UserVerified(t *testing.T) {
	var (
		goodByte byte = 0x04
		badByte  byte = 0x02
	)

	tests := []struct {
		name string
		flag AuthenticatorFlags
		want bool
	}{
		{
			"Present",
			AuthenticatorFlags(goodByte),
			true,
		},
		{
			"Missing",
			AuthenticatorFlags(badByte),
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.flag.UserVerified(); got != tt.want {
				t.Errorf("AuthenticatorFlags.UserVerified() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthenticatorFlags_HasAttestedCredentialData(t *testing.T) {
	var (
		goodByte byte = 0x40
		badByte  byte = 0x01
	)

	tests := []struct {
		name string
		flag AuthenticatorFlags
		want bool
	}{
		{
			"Present",
			AuthenticatorFlags(goodByte),
			true,
		},
		{
			"Missing",
			AuthenticatorFlags(badByte),
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.flag.HasAttestedCredentialData(); got != tt.want {
				t.Errorf("AuthenticatorFlags.HasAttestedCredentialData() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthenticatorFlags_HasExtensions(t *testing.T) {
	var (
		goodByte byte = 0x80
		badByte  byte = 0x01
	)

	tests := []struct {
		name string
		flag AuthenticatorFlags
		want bool
	}{
		{
			"Present",
			AuthenticatorFlags(goodByte),
			true,
		},
		{
			"Missing",
			AuthenticatorFlags(badByte),
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.flag.HasExtensions(); got != tt.want {
				t.Errorf("AuthenticatorFlags.HasExtensions() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthenticatorData_Unmarshal(t *testing.T) {
	type fields struct {
		RPIDHash []byte
		Flags    AuthenticatorFlags
		Counter  uint32
		AttData  AttestedCredentialData
		ExtData  []byte
	}

	type args struct {
		rawAuthData []byte
	}

	noneAuthData, _ := base64.StdEncoding.DecodeString(noneAuthDataBase64)
	attAuthData, _ := base64.StdEncoding.DecodeString(attAuthDataBase64)

	// Empty data.
	badAuthData1 := []byte{}

	// Attested credential data missing.
	badAuthData2 := make([]byte, minAttestedAuthLength-1)
	copy(badAuthData2, attAuthData)

	// Flags not set but data exists.
	badAuthData3 := make([]byte, len(attAuthData))
	copy(badAuthData3, attAuthData)
	badAuthData3[32] &= 0b0011_1111

	// Extensions data missing.
	badAuthData4 := make([]byte, len(attAuthData))
	copy(badAuthData4, attAuthData)
	badAuthData4[32] |= 0b1000_0000

	// Leftover bytes.
	badAuthData5 := make([]byte, len(attAuthData))
	copy(badAuthData5, attAuthData)
	badAuthData5 = append(badAuthData5, []byte("Hello World")...)

	tests := []struct {
		name   string
		fields fields
		args   args

		errString  string
		errType    string
		errDetails string
		errInfo    string
	}{
		{
			name:   "None Marshall Successfully",
			fields: fields{},
			args: args{
				noneAuthData,
			},
		},
		{
			name:   "Att Data Marshall Successfully",
			fields: fields{},
			args: args{
				attAuthData,
			},
		},
		{
			name:   "Authenticator data too short",
			fields: fields{},
			args: args{
				badAuthData1,
			},
			errString:  "Authenticator data length too short",
			errType:    "invalid_request",
			errDetails: "Authenticator data length too short",
			errInfo:    fmt.Sprintf("Expected data greater than %d bytes. Got %d bytes", minAuthDataLength, len(badAuthData1)),
		},
		{
			name:   "Attested credential missing",
			fields: fields{},
			args: args{
				badAuthData2,
			},
			errString:  "Attested credential flag set but data is missing",
			errType:    "invalid_request",
			errDetails: "Attested credential flag set but data is missing",
			errInfo:    "",
		},
		{
			name:   "Attested credential missing",
			fields: fields{},
			args: args{
				badAuthData3,
			},
			errString:  "Attested credential flag not set",
			errType:    "invalid_request",
			errDetails: "Attested credential flag not set",
			errInfo:    "",
		},
		{
			name:   "Extensions data missing",
			fields: fields{},
			args: args{
				badAuthData4,
			},
			errString:  "Extensions flag set but extensions data is missing",
			errType:    "invalid_request",
			errDetails: "Extensions flag set but extensions data is missing",
			errInfo:    "",
		},
		{
			name:   "Leftover bytes",
			fields: fields{},
			args: args{
				badAuthData5,
			},
			errString:  "Leftover bytes decoding AuthenticatorData",
			errType:    "invalid_request",
			errDetails: "Leftover bytes decoding AuthenticatorData",
			errInfo:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &AuthenticatorData{
				RPIDHash: tt.fields.RPIDHash,
				Flags:    tt.fields.Flags,
				Counter:  tt.fields.Counter,
				AttData:  tt.fields.AttData,
				ExtData:  tt.fields.ExtData,
			}

			err := a.Unmarshal(tt.args.rawAuthData)
			if tt.errString != "" {
				assert.EqualError(t, err, tt.errString)

				AssertIsProtocolError(t, err, tt.errType, tt.errDetails, tt.errInfo)

				return
			}

			require.NoError(t, err)
		})
	}
}

func TestAuthenticatorData_unmarshalAttestedData(t *testing.T) {
	type fields struct {
		RPIDHash []byte
		Flags    AuthenticatorFlags
		Counter  uint32
		AttData  AttestedCredentialData
		ExtData  []byte
	}

	type args struct {
		rawAuthData []byte
	}

	noneAuthData, _ := base64.StdEncoding.DecodeString(noneAuthDataBase64)
	attAuthData, _ := base64.StdEncoding.DecodeString(attAuthDataBase64)

	// Data length too short.
	badAuthData1 := make([]byte, len(attAuthData))
	copy(badAuthData1, attAuthData)
	binary.BigEndian.PutUint16(badAuthData1[53:], 256)

	// ID length too long.
	badAuthData2 := make([]byte, len(attAuthData)+maxCredentialIDLength+1)
	copy(badAuthData2, attAuthData)
	binary.BigEndian.PutUint16(badAuthData2[53:], maxCredentialIDLength+1)

	// Malformed public key.
	badAuthData3 := make([]byte, 119)
	copy(badAuthData3, attAuthData[:119])

	badData, _ := hex.DecodeString("83FF20030102")
	badAuthData3 = append(badAuthData3, badData...)

	tests := []struct {
		name       string
		fields     fields
		args       args
		errString  string
		errType    string
		errDetails string
		errInfo    string
	}{
		{
			name:   "None Marshall Successfully",
			fields: fields{},
			args: args{
				noneAuthData,
			},
		},
		{
			name:   "Att Data Marshall Successfully",
			fields: fields{},
			args: args{
				attAuthData,
			},
		},
		{
			name:   "Data length too short",
			fields: fields{},
			args: args{
				badAuthData1,
			},
			errString:  "Authenticator attestation data length too short",
			errType:    "invalid_request",
			errDetails: "Authenticator attestation data length too short",
			errInfo:    "",
		},
		{
			name:   "ID length too long",
			fields: fields{},
			args: args{
				badAuthData2,
			},
			errString:  "Authenticator attestation data credential id length too long",
			errType:    "invalid_request",
			errDetails: "Authenticator attestation data credential id length too long",
			errInfo:    "",
		},
		{
			name:   "Could not unmarshal Credential Public Key",
			fields: fields{},
			args: args{
				badAuthData3,
			},
			errString:  "Could not unmarshal Credential Public Key: cbor: unexpected \"break\" code",
			errType:    "invalid_request",
			errDetails: "Could not unmarshal Credential Public Key: cbor: unexpected \"break\" code",
			errInfo:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &AuthenticatorData{
				RPIDHash: tt.fields.RPIDHash,
				Flags:    tt.fields.Flags,
				Counter:  tt.fields.Counter,
				AttData:  tt.fields.AttData,
				ExtData:  tt.fields.ExtData,
			}

			err := a.unmarshalAttestedData(tt.args.rawAuthData)
			if tt.errString != "" {
				assert.EqualError(t, err, tt.errString)

				AssertIsProtocolError(t, err, tt.errType, tt.errDetails, tt.errInfo)

				return
			}

			require.NoError(t, err)
		})
	}
}

func Test_unmarshalCredentialPublicKey(t *testing.T) {
	type args struct {
		keyBytes []byte
	}

	tests := []struct {
		name string
		args args
		want []byte
	}{
		// TODO: Add test cases.
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := unmarshalCredentialPublicKey(tt.args.keyBytes)
			if err != nil {
				t.Errorf("unmarshalCredentialPublicKey() returned err %v", err)
			} else if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("unmarshalCredentialPublicKey() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthenticatorData_Verify(t *testing.T) {
	type fields struct {
		RPIDHash []byte
		Flags    AuthenticatorFlags
		Counter  uint32
		AttData  AttestedCredentialData
		ExtData  []byte
	}

	type args struct {
		rpIdHash                 []byte
		userVerificationRequired bool
		userPresenceRequired     bool
	}

	tests := []struct {
		name       string
		fields     fields
		args       args
		errString  string
		errType    string
		errDetails string
		errInfo    string
	}{
		{
			name: "Success",
			fields: fields{
				RPIDHash: []byte{1, 2, 3},
				Flags:    AuthenticatorFlags(0x05),
			},
			args: args{
				rpIdHash: []byte{1, 2, 3},
			},
			errString: "",
		},
		{
			name: "RP hash mismatch",
			fields: fields{
				RPIDHash: []byte{0xff},
			},
			args: args{
				rpIdHash: []byte{0xaa},
			},
			errString:  "Error validating the authenticator response",
			errType:    "verification_error",
			errDetails: "Error validating the authenticator response",
			errInfo:    "RP Hash mismatch. Expected ff and Received aa",
		},
		{
			name: "UP flag not set",
			fields: fields{
				RPIDHash: []byte{1, 2, 3},
				Flags:    AuthenticatorFlags(0x04),
			},
			args: args{
				rpIdHash:             []byte{1, 2, 3},
				userPresenceRequired: true,
			},
			errString:  "Error validating the authenticator response",
			errType:    "verification_error",
			errDetails: "Error validating the authenticator response",
			errInfo:    "User presence required but flag not set by authenticator",
		},
		{
			name: "User verification required",
			fields: fields{
				RPIDHash: []byte{1, 2, 3},
				Flags:    AuthenticatorFlags(0x01),
			},
			args: args{
				rpIdHash:                 []byte{1, 2, 3},
				userVerificationRequired: true,
				userPresenceRequired:     true,
			},
			errString:  "Error validating the authenticator response",
			errType:    "verification_error",
			errDetails: "Error validating the authenticator response",
			errInfo:    "User verification required but flag not set by authenticator",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &AuthenticatorData{
				RPIDHash: tt.fields.RPIDHash,
				Flags:    tt.fields.Flags,
				Counter:  tt.fields.Counter,
				AttData:  tt.fields.AttData,
				ExtData:  tt.fields.ExtData,
			}

			err := a.Verify(tt.args.rpIdHash, nil, tt.args.userVerificationRequired, tt.args.userPresenceRequired)
			if tt.errString != "" {
				assert.EqualError(t, err, tt.errString)

				AssertIsProtocolError(t, err, tt.errType, tt.errDetails, tt.errInfo)

				return
			}

			require.NoError(t, err)
		})
	}
}
