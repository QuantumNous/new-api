package webauthncose

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

// TestOKPSignatureVerification is a compatibility test to ensure that removing
// a previously used dependency doesn't introduce new issues.
//
// Since OKPs are used to represent Ed25519 keys, this test largely ensures
// that the underlying Ed25519 signature verification passes.
func TestOKPSignatureVerification(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("error creating ed25519 key: %v", err)
	}

	data := []byte("Sample data to sign")
	validSig := ed25519.Sign(priv, data)
	invalidSig := []byte("invalid")

	key := OKPPublicKeyData{
		XCoord: pub,
	}

	// Test that a valid signature passes.
	ok, err := key.Verify(data, validSig)
	if err != nil {
		t.Fatalf("error verifying okp signature: %v", err)
	}

	if !ok {
		t.Fatalf("valid signature wasn't properly verified")
	}

	// And that an invalid signature fails.
	ok, err = key.Verify(data, invalidSig)
	if err != nil {
		t.Fatalf("error verifying okp signature: %v", err)
	}

	if ok {
		t.Fatalf("invalid signature was incorrectly verified")
	}
}

func TestP256SignatureVerification(t *testing.T) {
	// Private/public key pair was generated with the following:
	//
	// $ openssl ecparam -genkey -name secp256r1 -noout -out private_key.pem
	// $ openssl ec -in private_key.pem -noout -text
	// Private-Key: (256 bit)
	// priv:
	// 	48:7f:36:1d:df:d7:34:40:e7:07:f4:da:a6:77:5b:
	// 	37:68:59:e8:a3:c9:f2:9b:3b:b6:94:a1:29:27:c0:
	// 	21:3c
	// pub:
	// 	04:f7:39:f8:c7:7b:32:f4:d5:f1:32:65:86:1f:eb:
	// 	d7:6e:7a:9c:61:a1:14:0d:29:6b:8c:16:30:25:08:
	// 	87:03:16:c2:49:70:ad:78:11:cc:d9:da:7f:1b:88:
	// 	f2:02:be:ba:c7:70:66:3e:f5:8b:a6:83:46:18:6d:
	// 	d7:78:20:0d:d4
	// ASN1 OID: prime256v1
	// NIST CURVE: P-256
	// ----.
	pubX, err := hex.DecodeString("f739f8c77b32f4d5f13265861febd76e7a9c61a1140d296b8c16302508870316")
	assert.Nil(t, err)
	pubY, err := hex.DecodeString("c24970ad7811ccd9da7f1b88f202bebac770663ef58ba68346186dd778200dd4")
	assert.Nil(t, err)

	key := EC2PublicKeyData{
		// These constants are from https://datatracker.ietf.org/doc/rfc9053/
		// (see "ECDSA" and "Elliptic Curve Keys").
		PublicKeyData: PublicKeyData{
			KeyType:   2,  // EC.
			Algorithm: -7, // "ES256".
		},
		Curve:  1, // P-256.
		XCoord: pubX,
		YCoord: pubY,
	}

	data := []byte("webauthnFTW")

	// Valid signature obtained with:
	// $ echo -n 'webauthnFTW' | openssl dgst -sha256 -sign private_key.pem | xxd -ps | tr -d '\n'.
	validSig, err := hex.DecodeString("3045022053584980793ee4ec01d583f303604c4f85a7e87df3fe9551962c5ab69a5ce27b022100c801fd6186ca4681e87fbbb97c5cb659f039473995a75a9a9dffea2708d6f8fb")
	assert.Nil(t, err)

	// Happy path, verification should succeed.
	ok, err := VerifySignature(key, data, validSig)
	assert.True(t, ok, "invalid EC signature")
	assert.Nil(t, err, "error verifying EC signature")

	// Verification against BAD data should fail.
	ok, err = VerifySignature(key, []byte("webauthnFTL"), validSig)
	assert.Nil(t, err, "error verifying EC signature")
	assert.False(t, ok, "verification against bad data is successful!")
}

func TestOKPDisplayPublicKey(t *testing.T) {
	// Sample public key generated from ed25519.GenerateKey(rand.Reader).
	var pub ed25519.PublicKey = []byte{0x7b, 0x88, 0x10, 0x24, 0xad, 0xc9, 0x82, 0xd3, 0x80, 0xb8, 0x77, 0x1e, 0x3b, 0x9b, 0xf8, 0xe4, 0xb3, 0x99, 0x8b, 0xc7, 0xd0, 0x58, 0x30, 0x66, 0x2, 0xce, 0x4d, 0xf, 0x2f, 0xe4, 0xb7, 0x81}
	// The PEM encoded representation of the public key in PKIX, ASN.1 DER format.
	expected := `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAe4gQJK3JgtOAuHceO5v45LOZi8fQWDBmAs5NDy/kt4E=
-----END PUBLIC KEY-----
`
	key := OKPPublicKeyData{
		XCoord: pub,
		PublicKeyData: PublicKeyData{
			KeyType: int64(OctetKey),
		},
	}

	// Get the CBOR-encoded representation of the OKPPublicKeyData.
	buf, _ := webauthncbor.Marshal(key)

	got := DisplayPublicKey(buf)
	if got != expected {
		t.Fatalf("incorrect PEM format received for ed25519 public key. expected\n%#v\n got \n%#v\n", expected, got)
	}
}

func TestRSAExponent(t *testing.T) {
	testCases := []struct {
		name     string
		have     *RSAPublicKeyData
		expected int
		err      string
	}{
		{
			"ShouldHandle3ByteExponent",
			&RSAPublicKeyData{
				Exponent: []byte{0x01, 0x00, 0x01},
			},
			65537,
			"",
		},
		{
			"ShouldHandle3ByteExponentAlt",
			&RSAPublicKeyData{
				Exponent: []byte{0x01, 0x00, 0x02},
			},
			65538,
			"",
		},
		{
			"ShouldHandle3ByteExponentLarge",
			&RSAPublicKeyData{
				Exponent: []byte{0xff, 0xff, 0xff},
			},
			16777215,
			"",
		},
		{
			"ShouldHandle4ByteExponent",
			&RSAPublicKeyData{
				Exponent: []byte{0x01, 0x00, 0x02, 0xff},
			},
			16777983,
			"",
		},
		{
			"ShouldHandleZeroLength",
			&RSAPublicKeyData{
				Exponent: []byte{},
			},
			0,
			"invalid exponent length",
		},
		{
			"ShouldHandleNilExponent",
			&RSAPublicKeyData{
				Exponent: nil,
			},
			0,
			"invalid exponent length",
		},
		{
			"ShouldHandleNilKey",
			nil,
			0,
			"invalid key",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := parseRSAPublicKeyDataExponent(tc.have)

			if tc.err != "" {
				assert.EqualError(t, err, tc.err)
				assert.Equal(t, 0, actual)
			} else {
				assert.Equal(t, tc.expected, actual)
				assert.NoError(t, err)
			}
		})
	}
}
