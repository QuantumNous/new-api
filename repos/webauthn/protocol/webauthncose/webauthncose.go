package webauthncose

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"fmt"
	"hash"
	"math"
	"math/big"

	"github.com/google/go-tpm/legacy/tpm2"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

// PublicKeyData The public key portion of a Relying Party-specific credential key pair, generated
// by an authenticator and returned to a Relying Party at registration time. We unpack this object
// using fxamacker's cbor library ("github.com/fxamacker/cbor/v2") which is why there are cbor tags
// included. The tag field values correspond to the IANA COSE keys that give their respective
// values.
//
// Specification: §6.4.1.1. Examples of credentialPublicKey Values Encoded in COSE_Key Format (https://www.w3.org/TR/webauthn/#sctn-encoded-credPubKey-examples)
type PublicKeyData struct {
	// Decode the results to int by default.
	_struct bool `cbor:",keyasint" json:"public_key"` //nolint:unused,govet

	// The type of key created. Should be OKP, EC2, or RSA.
	KeyType int64 `cbor:"1,keyasint" json:"kty"`

	// A COSEAlgorithmIdentifier for the algorithm used to derive the key signature.
	Algorithm int64 `cbor:"3,keyasint" json:"alg"`
}

const ecCoordSize = 32

type EC2PublicKeyData struct {
	PublicKeyData

	// If the key type is EC2, the curve on which we derive the signature from.
	Curve int64 `cbor:"-1,keyasint,omitempty" json:"crv"`

	// A byte string 32 bytes in length that holds the x coordinate of the key.
	XCoord []byte `cbor:"-2,keyasint,omitempty" json:"x"`

	// A byte string 32 bytes in length that holds the y coordinate of the key.
	YCoord []byte `cbor:"-3,keyasint,omitempty" json:"y"`
}

type RSAPublicKeyData struct {
	PublicKeyData

	// Represents the modulus parameter for the RSA algorithm.
	Modulus []byte `cbor:"-1,keyasint,omitempty" json:"n"`

	// Represents the exponent parameter for the RSA algorithm.
	Exponent []byte `cbor:"-2,keyasint,omitempty" json:"e"`
}

type OKPPublicKeyData struct {
	PublicKeyData

	Curve int64

	// A byte string that holds the x coordinate of the key.
	XCoord []byte `cbor:"-2,keyasint,omitempty" json:"x"`
}

// Verify Octet Key Pair (OKP) Public Key Signature.
func (k *OKPPublicKeyData) Verify(data []byte, sig []byte) (bool, error) {
	var key ed25519.PublicKey = make([]byte, ed25519.PublicKeySize)

	copy(key, k.XCoord)

	return ed25519.Verify(key, data, sig), nil
}

// Verify Elliptic Curve Public Key Signature.
func (k *EC2PublicKeyData) Verify(data []byte, sig []byte) (bool, error) {
	curve := ec2AlgCurve(k.Algorithm)
	if curve == nil {
		return false, ErrUnsupportedAlgorithm
	}

	pubkey := &ecdsa.PublicKey{
		Curve: curve,
		X:     big.NewInt(0).SetBytes(k.XCoord),
		Y:     big.NewInt(0).SetBytes(k.YCoord),
	}

	h := HasherFromCOSEAlg(COSEAlgorithmIdentifier(k.Algorithm))
	h.Write(data)

	e := &ECDSASignature{}

	_, err := asn1.Unmarshal(sig, e)
	if err != nil {
		return false, ErrSigNotProvidedOrInvalid
	}

	return ecdsa.Verify(pubkey, h.Sum(nil), e.R, e.S), nil
}

// ToECDSA converts the EC2PublicKeyData to an ecdsa.PublicKey.
func (k *EC2PublicKeyData) ToECDSA() (key *ecdsa.PublicKey, err error) {
	curve := ec2AlgCurve(k.Algorithm)

	if curve == nil {
		return nil, ErrUnsupportedAlgorithm
	}

	return &ecdsa.PublicKey{
		Curve: curve,
		X:     big.NewInt(0).SetBytes(k.XCoord),
		Y:     big.NewInt(0).SetBytes(k.YCoord),
	}, nil
}

// Verify RSA Public Key Signature.
func (k *RSAPublicKeyData) Verify(data []byte, sig []byte) (valid bool, err error) {
	var e int

	if e, err = parseRSAPublicKeyDataExponent(k); err != nil {
		return false, ErrUnsupportedKey
	}

	pubkey := &rsa.PublicKey{
		N: big.NewInt(0).SetBytes(k.Modulus),
		E: e,
	}

	coseAlg := COSEAlgorithmIdentifier(k.Algorithm)

	algDetail, ok := COSESignatureAlgorithmDetails[coseAlg]
	if !ok {
		return false, ErrUnsupportedAlgorithm
	}

	hash := algDetail.hash
	h := hash.New()
	h.Write(data)

	switch coseAlg {
	case AlgPS256, AlgPS384, AlgPS512:
		err := rsa.VerifyPSS(pubkey, hash, h.Sum(nil), sig, nil)

		return err == nil, err
	case AlgRS1, AlgRS256, AlgRS384, AlgRS512:
		err := rsa.VerifyPKCS1v15(pubkey, hash, h.Sum(nil), sig)

		return err == nil, err
	default:
		return false, ErrUnsupportedAlgorithm
	}
}

// ParsePublicKey figures out what kind of COSE material was provided and create the data for the new key.
func ParsePublicKey(keyBytes []byte) (publicKey any, err error) {
	pk := PublicKeyData{}

	if err = webauthncbor.Unmarshal(keyBytes, &pk); err != nil {
		return nil, ErrUnsupportedKey
	}

	switch COSEKeyType(pk.KeyType) {
	case OctetKey:
		var o OKPPublicKeyData

		if err = webauthncbor.Unmarshal(keyBytes, &o); err != nil {
			return nil, err
		}

		o.PublicKeyData = pk

		return o, nil
	case EllipticKey:
		var e EC2PublicKeyData

		if err = webauthncbor.Unmarshal(keyBytes, &e); err != nil {
			return nil, err
		}

		e.PublicKeyData = pk

		return e, nil
	case RSAKey:
		var r RSAPublicKeyData

		if err = webauthncbor.Unmarshal(keyBytes, &r); err != nil {
			return nil, err
		}

		r.PublicKeyData = pk

		return r, nil
	default:
		return nil, ErrUnsupportedKey
	}
}

// ParseFIDOPublicKey is only used when the appID extension is configured by the assertion response.
func ParseFIDOPublicKey(keyBytes []byte) (data EC2PublicKeyData, err error) {
	x, y := elliptic.Unmarshal(elliptic.P256(), keyBytes)

	if x == nil || y == nil {
		return data, fmt.Errorf("elliptic unmarshall returned a nil value")
	}

	return EC2PublicKeyData{
		PublicKeyData: PublicKeyData{
			Algorithm: int64(AlgES256),
		},
		XCoord: x.FillBytes(make([]byte, ecCoordSize)),
		YCoord: y.FillBytes(make([]byte, ecCoordSize)),
	}, nil
}

func VerifySignature(key any, data []byte, sig []byte) (bool, error) {
	switch k := key.(type) {
	case OKPPublicKeyData:
		return k.Verify(data, sig)
	case EC2PublicKeyData:
		return k.Verify(data, sig)
	case RSAPublicKeyData:
		return k.Verify(data, sig)
	default:
		return false, ErrUnsupportedKey
	}
}

func DisplayPublicKey(cpk []byte) string {
	parsedKey, err := ParsePublicKey(cpk)
	if err != nil {
		return keyCannotDisplay
	}

	switch k := parsedKey.(type) {
	case RSAPublicKeyData:
		var e int

		if e, err = parseRSAPublicKeyDataExponent(&k); err != nil {
			return keyCannotDisplay
		}

		rKey := &rsa.PublicKey{
			N: big.NewInt(0).SetBytes(k.Modulus),
			E: e,
		}

		data, err := x509.MarshalPKIXPublicKey(rKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)
	case EC2PublicKeyData:
		curve := ec2AlgCurve(k.Algorithm)
		if curve == nil {
			return keyCannotDisplay
		}

		eKey := &ecdsa.PublicKey{
			Curve: curve,
			X:     big.NewInt(0).SetBytes(k.XCoord),
			Y:     big.NewInt(0).SetBytes(k.YCoord),
		}

		data, err := x509.MarshalPKIXPublicKey(eKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)
	case OKPPublicKeyData:
		if len(k.XCoord) != ed25519.PublicKeySize {
			return keyCannotDisplay
		}

		var oKey ed25519.PublicKey = make([]byte, ed25519.PublicKeySize)

		copy(oKey, k.XCoord)

		data, err := marshalEd25519PublicKey(oKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)

	default:
		return "Cannot display key of this type"
	}
}

// COSEAlgorithmIdentifier is a number identifying a cryptographic algorithm. The algorithm identifiers SHOULD be values
// registered in the IANA COSE Algorithms registry [https://www.w3.org/TR/webauthn/#biblio-iana-cose-algs-reg], for
// instance, -7 for "ES256" and -257 for "RS256".
//
// Specification: §5.8.5. Cryptographic Algorithm Identifier (https://www.w3.org/TR/webauthn/#sctn-alg-identifier)
type COSEAlgorithmIdentifier int

const (
	// AlgES256 ECDSA with SHA-256.
	AlgES256 COSEAlgorithmIdentifier = -7

	// AlgEdDSA EdDSA.
	AlgEdDSA COSEAlgorithmIdentifier = -8

	// AlgES384 ECDSA with SHA-384.
	AlgES384 COSEAlgorithmIdentifier = -35

	// AlgES512 ECDSA with SHA-512.
	AlgES512 COSEAlgorithmIdentifier = -36

	// AlgPS256 RSASSA-PSS with SHA-256.
	AlgPS256 COSEAlgorithmIdentifier = -37

	// AlgPS384 RSASSA-PSS with SHA-384.
	AlgPS384 COSEAlgorithmIdentifier = -38

	// AlgPS512 RSASSA-PSS with SHA-512.
	AlgPS512 COSEAlgorithmIdentifier = -39

	// AlgES256K is ECDSA using secp256k1 curve and SHA-256.
	AlgES256K COSEAlgorithmIdentifier = -47

	// AlgRS256 RSASSA-PKCS1-v1_5 with SHA-256.
	AlgRS256 COSEAlgorithmIdentifier = -257

	// AlgRS384 RSASSA-PKCS1-v1_5 with SHA-384.
	AlgRS384 COSEAlgorithmIdentifier = -258

	// AlgRS512 RSASSA-PKCS1-v1_5 with SHA-512.
	AlgRS512 COSEAlgorithmIdentifier = -259

	// AlgRS1 RSASSA-PKCS1-v1_5 with SHA-1.
	AlgRS1 COSEAlgorithmIdentifier = -65535
)

// COSEKeyType is The Key type derived from the IANA COSE AuthData.
type COSEKeyType int

const (
	// KeyTypeReserved is a reserved value.
	KeyTypeReserved COSEKeyType = iota

	// OctetKey is an Octet Key.
	OctetKey

	// EllipticKey is an Elliptic Curve Public Key.
	EllipticKey

	// RSAKey is an RSA Public Key.
	RSAKey

	// Symmetric Keys.
	Symmetric

	// HSSLMS is the public key for HSS/LMS hash-based digital signature.
	HSSLMS
)

// COSEEllipticCurve is an enumerator that represents the COSE Elliptic Curves.
//
// Specification: https://www.iana.org/assignments/cose/cose.xhtml#elliptic-curves
type COSEEllipticCurve int

const (
	// EllipticCurveReserved is the COSE EC Reserved value.
	EllipticCurveReserved COSEEllipticCurve = iota

	// P256 represents NIST P-256 also known as secp256r1.
	P256

	// P384 represents NIST P-384 also known as secp384r1.
	P384

	// P521 represents NIST P-521 also known as secp521r1.
	P521

	// X25519 for use w/ ECDH only.
	X25519

	// X448 for use w/ ECDH only.
	X448

	// Ed25519 for use w/ EdDSA only.
	Ed25519

	// Ed448 for use w/ EdDSA only.
	Ed448

	// Secp256k1 is the SECG secp256k1 curve.
	Secp256k1
)

func (k *EC2PublicKeyData) TPMCurveID() tpm2.EllipticCurve {
	switch COSEEllipticCurve(k.Curve) {
	case P256:
		return tpm2.CurveNISTP256 // TPM_ECC_NIST_P256.
	case P384:
		return tpm2.CurveNISTP384 // TPM_ECC_NIST_P384.
	case P521:
		return tpm2.CurveNISTP521 // TPM_ECC_NIST_P521.
	default:
		return tpm2.EllipticCurve(0) // TPM_ECC_NONE.
	}
}

func ec2AlgCurve(coseAlg int64) elliptic.Curve {
	switch COSEAlgorithmIdentifier(coseAlg) {
	case AlgES512: // IANA COSE code for ECDSA w/ SHA-512.
		return elliptic.P521()
	case AlgES384: // IANA COSE code for ECDSA w/ SHA-384.
		return elliptic.P384()
	case AlgES256: // IANA COSE code for ECDSA w/ SHA-256.
		return elliptic.P256()
	default:
		return nil
	}
}

// SigAlgFromCOSEAlg return which signature algorithm is being used from the COSE Key.
func SigAlgFromCOSEAlg(coseAlg COSEAlgorithmIdentifier) x509.SignatureAlgorithm {
	d, ok := COSESignatureAlgorithmDetails[coseAlg]
	if !ok {
		return x509.UnknownSignatureAlgorithm
	}

	return d.sigAlg
}

// HasherFromCOSEAlg returns the Hashing interface to be used for a given COSE Algorithm.
func HasherFromCOSEAlg(coseAlg COSEAlgorithmIdentifier) hash.Hash {
	d, ok := COSESignatureAlgorithmDetails[coseAlg]
	if !ok {
		// default to SHA256?  Why not.
		return crypto.SHA256.New()
	}

	return d.hash.New()
}

var COSESignatureAlgorithmDetails = map[COSEAlgorithmIdentifier]struct {
	name   string
	hash   crypto.Hash
	sigAlg x509.SignatureAlgorithm
}{
	AlgRS1:   {"SHA1-RSA", crypto.SHA1, x509.SHA1WithRSA},
	AlgRS256: {"SHA256-RSA", crypto.SHA256, x509.SHA256WithRSA},
	AlgRS384: {"SHA384-RSA", crypto.SHA384, x509.SHA384WithRSA},
	AlgRS512: {"SHA512-RSA", crypto.SHA512, x509.SHA512WithRSA},
	AlgPS256: {"SHA256-RSAPSS", crypto.SHA256, x509.SHA256WithRSAPSS},
	AlgPS384: {"SHA384-RSAPSS", crypto.SHA384, x509.SHA384WithRSAPSS},
	AlgPS512: {"SHA512-RSAPSS", crypto.SHA512, x509.SHA512WithRSAPSS},
	AlgES256: {"ECDSA-SHA256", crypto.SHA256, x509.ECDSAWithSHA256},
	AlgES384: {"ECDSA-SHA384", crypto.SHA384, x509.ECDSAWithSHA384},
	AlgES512: {"ECDSA-SHA512", crypto.SHA512, x509.ECDSAWithSHA512},
	AlgEdDSA: {"EdDSA", crypto.SHA512, x509.PureEd25519},
}

type Error struct {
	// Short name for the type of error that has occurred.
	Type string `json:"type"`

	// Additional details about the error.
	Details string `json:"error"`

	// Information to help debug the error.
	DevInfo string `json:"debug"`
}

var (
	ErrUnsupportedKey = &Error{
		Type:    "invalid_key_type",
		Details: "Unsupported Public Key Type",
	}
	ErrUnsupportedAlgorithm = &Error{
		Type:    "unsupported_key_algorithm",
		Details: "Unsupported public key algorithm",
	}
	ErrSigNotProvidedOrInvalid = &Error{
		Type:    "signature_not_provided_or_invalid",
		Details: "Signature invalid or not provided",
	}
)

func (err *Error) Error() string {
	return err.Details
}

func (passedError *Error) WithDetails(details string) *Error {
	err := *passedError
	err.Details = details

	return &err
}

func parseRSAPublicKeyDataExponent(k *RSAPublicKeyData) (exp int, err error) {
	if k == nil {
		return 0, fmt.Errorf("invalid key")
	}

	if len(k.Exponent) == 0 {
		return 0, fmt.Errorf("invalid exponent length")
	}

	for _, b := range k.Exponent {
		if exp > (math.MaxInt >> 8) {
			return 0, ErrUnsupportedKey
		}

		exp = (exp << 8) | int(b)
	}

	if exp <= 0 {
		return 0, ErrUnsupportedKey
	}

	return exp, nil
}
