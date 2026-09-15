package protocol

import (
	"bytes"
	"crypto/x509"
	"encoding/asn1"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// attestationFormatValidationHandlerAndroidKey is the handler for the Android Key Attestation Statement Format.
//
// An Android key attestation statement consists simply of the Android attestation statement, which is a series of DER
// encoded X.509 certificates. See the Android developer documentation. Its syntax is defined as follows:
//
// $$attStmtType //= (
//                       fmt: "android-key",
//                       attStmt: androidStmtFormat
//                   )
//
// androidStmtFormat = {
//                       alg: COSEAlgorithmIdentifier,
//                       sig: bytes,
//                       x5c: [ credCert: bytes, * (caCert: bytes) ]
//                     }
//
// Specification: §8.4. Android Key Attestation Statement Format
//
// See: https://www.w3.org/TR/webauthn/#sctn-android-key-attestation
func attestationFormatValidationHandlerAndroidKey(att AttestationObject, clientDataHash []byte, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	var (
		alg int64
		sig []byte
		ok  bool
	)
	
	// Given the verification procedure inputs attStmt, authenticatorData and clientDataHash, the verification procedure is as follows:
	// §8.4.1. Verify that attStmt is valid CBOR conforming to the syntax defined above and perform CBOR decoding on it to extract
	// the contained fields.
	// Get the alg value - A COSEAlgorithmIdentifier containing the identifier of the algorithm
	// used to generate the attestation signature.
	if alg, ok = att.AttStatement[stmtAlgorithm].(int64); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving alg value")
	}

	// Get the sig value - A byte string containing the attestation signature.
	if sig, ok = att.AttStatement[stmtSignature].([]byte); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving sig value")
	}

	// §8.4.2. Verify that sig is a valid signature over the concatenation of authenticatorData and clientDataHash
	// using the public key in the first certificate in x5c with the algorithm specified in alg.
	var (
		x5c   []any
		certs []*x509.Certificate
	)

	if x5c, certs, err = attStatementParseX5CS(att.AttStatement, stmtX5C); err != nil {
		return "", nil, err
	}

	if len(certs) == 0 {
		return "", nil, ErrInvalidAttestation.WithDetails("No certificates in x5c")
	}

	credCert := certs[0]

	if _, err = attStatementCertChainVerify(certs, attAndroidKeyHardwareRootsCertPool, true, time.Now().Add(time.Hour*8760).UTC()); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails("Error validating x5c cert chain").WithError(err)
	}

	signatureData := append(att.RawAuthData, clientDataHash...) //nolint:gocritic // This is intentional.

	if sigAlg := webauthncose.SigAlgFromCOSEAlg(webauthncose.COSEAlgorithmIdentifier(alg)); sigAlg == x509.UnknownSignatureAlgorithm {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Unsupported COSE alg: %d", alg))
	} else if err = credCert.CheckSignature(sigAlg, signatureData, sig); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Signature validation error: %+v", err)).WithError(err)
	}

	// Verify that the public key in the first certificate in x5c matches the credentialPublicKey in the attestedCredentialData in authenticatorData.
	var attPublicKeyData webauthncose.EC2PublicKeyData
	if attPublicKeyData, err = verifyAttestationECDSAPublicKeyMatch(att, credCert); err != nil {
		return "", nil, err
	}

	var valid bool
	if valid, err = attPublicKeyData.Verify(signatureData, sig); err != nil || !valid {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error parsing public key: %+v", err)).WithError(err)
	}

	// §8.4.3. Verify that the attestationChallenge field in the attestation certificate extension data is identical to clientDataHash.
	// attCert.Extensions.
	// As noted in §8.4.1 (https://www.w3.org/TR/webauthn/#key-attstn-cert-requirements) the Android Key Attestation
	// certificate's android key attestation certificate extension data is identified by the OID
	// "1.3.6.1.4.1.11129.2.1.17".
	var attExtBytes []byte

	for _, ext := range credCert.Extensions {
		if ext.Id.Equal(oidExtensionAndroidKeystore) {
			attExtBytes = ext.Value
		}
	}

	if len(attExtBytes) == 0 {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation certificate extensions missing 1.3.6.1.4.1.11129.2.1.17")
	}

	decoded := keyDescription{}

	if _, err = asn1.Unmarshal(attExtBytes, &decoded); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to parse Android key attestation certificate extensions").WithError(err)
	}

	// Verify that the attestationChallenge field in the attestation certificate extension data is identical to clientDataHash.
	if !bytes.Equal(decoded.AttestationChallenge, clientDataHash) {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation challenge not equal to clientDataHash")
	}

	// The AuthorizationList.allApplications field is not present on either authorization list (softwareEnforced nor teeEnforced), since PublicKeyCredential MUST be scoped to the RP ID.
	if decoded.SoftwareEnforced.AllApplications != nil || decoded.TeeEnforced.AllApplications != nil {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation certificate extensions contains all applications field")
	}

	// For the following, use only the teeEnforced authorization list if the RP wants to accept only keys from a trusted execution environment, otherwise use the union of teeEnforced and softwareEnforced.
	// The value in the AuthorizationList.origin field is equal to KM_ORIGIN_GENERATED (which == 0).
	if decoded.SoftwareEnforced.Origin != KM_ORIGIN_GENERATED || decoded.TeeEnforced.Origin != KM_ORIGIN_GENERATED {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation certificate extensions contains authorization list with origin not equal KM_ORIGIN_GENERATED")
	}

	// The value in the AuthorizationList.purpose field is equal to KM_PURPOSE_SIGN (which == 2).
	if !contains(decoded.SoftwareEnforced.Purpose, KM_PURPOSE_SIGN) && !contains(decoded.TeeEnforced.Purpose, KM_PURPOSE_SIGN) {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation certificate extensions contains authorization list with purpose not equal KM_PURPOSE_SIGN")
	}

	return string(metadata.BasicFull), x5c, err
}

func contains(s []int, e int) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}

	return false
}

type keyDescription struct {
	AttestationVersion       int
	AttestationSecurityLevel asn1.Enumerated
	KeymasterVersion         int
	KeymasterSecurityLevel   asn1.Enumerated
	AttestationChallenge     []byte
	UniqueID                 []byte
	SoftwareEnforced         authorizationList
	TeeEnforced              authorizationList
}

type authorizationList struct {
	Purpose                     []int       `asn1:"tag:1,explicit,set,optional"`
	Algorithm                   int         `asn1:"tag:2,explicit,optional"`
	KeySize                     int         `asn1:"tag:3,explicit,optional"`
	Digest                      []int       `asn1:"tag:5,explicit,set,optional"`
	Padding                     []int       `asn1:"tag:6,explicit,set,optional"`
	EcCurve                     int         `asn1:"tag:10,explicit,optional"`
	RsaPublicExponent           int         `asn1:"tag:200,explicit,optional"`
	RollbackResistance          any         `asn1:"tag:303,explicit,optional"`
	ActiveDateTime              int         `asn1:"tag:400,explicit,optional"`
	OriginationExpireDateTime   int         `asn1:"tag:401,explicit,optional"`
	UsageExpireDateTime         int         `asn1:"tag:402,explicit,optional"`
	NoAuthRequired              any         `asn1:"tag:503,explicit,optional"`
	UserAuthType                int         `asn1:"tag:504,explicit,optional"`
	AuthTimeout                 int         `asn1:"tag:505,explicit,optional"`
	AllowWhileOnBody            any         `asn1:"tag:506,explicit,optional"`
	TrustedUserPresenceRequired any         `asn1:"tag:507,explicit,optional"`
	TrustedConfirmationRequired any         `asn1:"tag:508,explicit,optional"`
	UnlockedDeviceRequired      any         `asn1:"tag:509,explicit,optional"`
	AllApplications             any         `asn1:"tag:600,explicit,optional"`
	ApplicationID               any         `asn1:"tag:601,explicit,optional"`
	CreationDateTime            int         `asn1:"tag:701,explicit,optional"`
	Origin                      int         `asn1:"tag:702,explicit,optional"`
	RootOfTrust                 rootOfTrust `asn1:"tag:704,explicit,optional"`
	OsVersion                   int         `asn1:"tag:705,explicit,optional"`
	OsPatchLevel                int         `asn1:"tag:706,explicit,optional"`
	AttestationApplicationID    []byte      `asn1:"tag:709,explicit,optional"`
	AttestationIDBrand          []byte      `asn1:"tag:710,explicit,optional"`
	AttestationIDDevice         []byte      `asn1:"tag:711,explicit,optional"`
	AttestationIDProduct        []byte      `asn1:"tag:712,explicit,optional"`
	AttestationIDSerial         []byte      `asn1:"tag:713,explicit,optional"`
	AttestationIDImei           []byte      `asn1:"tag:714,explicit,optional"`
	AttestationIDMeid           []byte      `asn1:"tag:715,explicit,optional"`
	AttestationIDManufacturer   []byte      `asn1:"tag:716,explicit,optional"`
	AttestationIDModel          []byte      `asn1:"tag:717,explicit,optional"`
	VendorPatchLevel            int         `asn1:"tag:718,explicit,optional"`
	BootPatchLevel              int         `asn1:"tag:719,explicit,optional"`
}

type rootOfTrust struct {
	verifiedBootKey   []byte            //nolint:unused
	deviceLocked      bool              //nolint:unused
	verifiedBootState verifiedBootState //nolint:unused
	verifiedBootHash  []byte            //nolint:unused
}

type verifiedBootState int

const (
	Verified verifiedBootState = iota
	SelfSigned
	Unverified
	Failed
)

const (
	// KM_ORIGIN_GENERATED means generated in keymaster. Should not exist outside the TEE.
	KM_ORIGIN_GENERATED = iota

	// KM_ORIGIN_DERIVED means derived inside keymaster. Likely exists off-device.
	KM_ORIGIN_DERIVED

	// KM_ORIGIN_IMPORTED means imported into keymaster. Existed as clear text in Android.
	KM_ORIGIN_IMPORTED

	// KM_ORIGIN_UNKNOWN means keymaster did not record origin.  This value can only be seen on keys in a keymaster0
	// implementation. The keymaster0 adapter uses this value to document the fact that it is unknown whether the key
	// was generated inside or imported into keymaster.
	KM_ORIGIN_UNKNOWN
)


const (
	// KM_PURPOSE_ENCRYPT is usable with RSA, EC and AES keys.
	KM_PURPOSE_ENCRYPT = iota

	// KM_PURPOSE_DECRYPT is usable with RSA, EC and AES keys.
	KM_PURPOSE_DECRYPT

	// KM_PURPOSE_SIGN is usable with RSA, EC and HMAC keys.
	KM_PURPOSE_SIGN

	// KM_PURPOSE_VERIFY is usable with RSA, EC and HMAC keys.
	KM_PURPOSE_VERIFY

	// KM_PURPOSE_DERIVE_KEY is usable with EC keys.
	KM_PURPOSE_DERIVE_KEY

	// KM_PURPOSE_WRAP is usable with wrapped keys.
	KM_PURPOSE_WRAP
)

var (
	attAndroidKeyHardwareRootsCertPool *x509.CertPool
)

func init() {
	RegisterAttestationFormat(AttestationFormatAndroidKey, attestationFormatValidationHandlerAndroidKey)
}