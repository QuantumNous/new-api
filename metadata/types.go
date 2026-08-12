package metadata

import (
	"context"
	"errors"
	"reflect"
	"time"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// The Provider is an interface which describes the elements required to satisfy validation of metadata.
type Provider interface {
	// GetEntry returns a MDS3 payload entry given a AAGUID.
	GetEntry(ctx context.Context, aaguid uuid.UUID) (entry *Entry, err error)

	// GetValidateEntry returns true if this provider requires an entry to exist with a AAGUID matching the attestation
	// statement during registration.
	GetValidateEntry(ctx context.Context) (validate bool)

	// GetValidateEntryPermitZeroAAGUID returns true if attestation statements with zerod AAGUID should be permitted
	// when considering the result from GetValidateEntry. i.e. if the AAGUID is zeroed, and GetValidateEntry returns
	// true, and this implementation returns true, the attestation statement will pass validation.
	GetValidateEntryPermitZeroAAGUID(ctx context.Context) (skip bool)

	// GetValidateTrustAnchor returns true if trust anchor validation of attestation statements is enforced during
	// registration.
	GetValidateTrustAnchor(ctx context.Context) (validate bool)

	// GetValidateStatus returns true if the status reports for an authenticator should be validated against desired and
	// undesired statuses.
	GetValidateStatus(ctx context.Context) (validate bool)

	// GetValidateAttestationTypes if true will enforce checking that the provided attestation is possible with the
	// given authenticator.
	GetValidateAttestationTypes(ctx context.Context) (validate bool)

	// ValidateStatusReports returns nil if the provided authenticator status reports are desired.
	ValidateStatusReports(ctx context.Context, reports []StatusReport) (err error)
}

var (
	ErrNotInitialized = errors.New("metadata: not initialized")
)

type PublicKeyCredentialParameters struct {
	Type string                               `json:"type"`
	Alg  webauthncose.COSEAlgorithmIdentifier `json:"alg"`
}

type AuthenticatorAttestationTypes []AuthenticatorAttestationType

func (t AuthenticatorAttestationTypes) HasBasicFull() bool {
	for _, a := range t {
		if a == BasicFull || a == AttCA {
			return true
		}
	}

	return false
}

// AuthenticatorAttestationType - The ATTESTATION constants are 16 bit long integers indicating the specific attestation that authenticator supports.
// Each constant has a case-sensitive string representation (in quotes), which is used in the authoritative metadata for FIDO authenticators.
type AuthenticatorAttestationType string

const (
	// BasicFull - Indicates full basic attestation, based on an attestation private key shared among a class of authenticators (e.g. same model). Authenticators must provide its attestation signature during the registration process for the same reason. The attestation trust anchor is shared with FIDO Servers out of band (as part of the Metadata). This sharing process should be done according to [UAFMetadataService].
	BasicFull AuthenticatorAttestationType = "basic_full"

	// BasicSurrogate - Just syntactically a Basic Attestation. The attestation object self-signed, i.e. it is signed using the UAuth.priv key, i.e. the key corresponding to the UAuth.pub key included in the attestation object. As a consequence it does not provide a cryptographic proof of the security characteristics. But it is the best thing we can do if the authenticator is not able to have an attestation private key.
	BasicSurrogate AuthenticatorAttestationType = "basic_surrogate"

	// Ecdaa - Indicates use of elliptic curve based direct anonymous attestation as defined in [FIDOEcdaaAlgorithm]. Support for this attestation type is optional at this time. It might be required by FIDO Certification.
	Ecdaa AuthenticatorAttestationType = "ecdaa"

	// AttCA - Indicates PrivacyCA attestation as defined in [TCG-CMCProfile-AIKCertEnroll]. Support for this attestation type is optional at this time. It might be required by FIDO Certification.
	AttCA AuthenticatorAttestationType = "attca"

	// AnonCA In this case, the authenticator uses an Anonymization CA which dynamically generates per-credential attestation certificates such that the attestation statements presented to Relying Parties do not provide uniquely identifiable information, e.g., that might be used for tracking purposes. The applicable [WebAuthn] attestation formats "fmt" are Google SafetyNet Attestation "android-safetynet", Android Keystore Attestation "android-key", Apple Anonymous Attestation "apple", and Apple Application Attestation "apple-appattest".
	AnonCA AuthenticatorAttestationType = "anonca"

	// None - Indicates absence of attestation.
	None AuthenticatorAttestationType = "none"
)

type KeyScope string

const (
	KeyScopeNone                   KeyScope = ""
	PublicKeyCredentialSource      KeyScope = "public-key-credential-source" //nolint:gosec
	DeviceSupplementalPublicKeys   KeyScope = "device-spk"
	ProviderSupplementalPublicKeys KeyScope = "provider-spk"
)

type MultiDeviceCredentialSupport string

const (
	MultiDeviceCredentialUnsupported MultiDeviceCredentialSupport = "unsupported"
	MultiDeviceCredentialExplicit    MultiDeviceCredentialSupport = "explicit"
	MultiDeviceCredentialImplicit    MultiDeviceCredentialSupport = "implicit"
)

// AuthenticatorStatus - This enumeration describes the status of an authenticator model as identified by its AAID and potentially some additional information (such as a specific attestation key).
// https://fidoalliance.org/specs/mds/fido-metadata-service-v3.1-ps-20250521.html#sctn-authnr-stat
type AuthenticatorStatus string

const (
	// NotFidoCertified - This authenticator is not FIDO certified.
	NotFidoCertified AuthenticatorStatus = "NOT_FIDO_CERTIFIED"

	// FidoCertified - This authenticator has passed FIDO functional certification. This certification scheme is phased out and will be replaced by FIDO_CERTIFIED_L1.
	FidoCertified AuthenticatorStatus = "FIDO_CERTIFIED"

	// UserVerificationBypass - Indicates that malware is able to bypass the user verification. This means that the authenticator could be used without the user's consent and potentially even without the user's knowledge.
	//nolint:gosec
	UserVerificationBypass AuthenticatorStatus = "USER_VERIFICATION_BYPASS"

	// AttestationKeyCompromise - Indicates that an attestation key for this authenticator is known to be compromised. Additional data should be supplied, including the key identifier and the date of compromise, if known.
	AttestationKeyCompromise AuthenticatorStatus = "ATTESTATION_KEY_COMPROMISE"

	// UserKeyRemoteCompromise - This authenticator has identified weaknesses that allow registered keys to be compromised and should not be trusted. This would include both, e.g. weak entropy that causes predictable keys to be generated or side channels that allow keys or signatures to be forged, guessed or extracted.
	UserKeyRemoteCompromise AuthenticatorStatus = "USER_KEY_REMOTE_COMPROMISE"

	// UserKeyPhysicalCompromise - This authenticator has known weaknesses in its key protection mechanism(s) that allow user keys to be extracted by an adversary in physical possession of the device.
	UserKeyPhysicalCompromise AuthenticatorStatus = "USER_KEY_PHYSICAL_COMPROMISE"

	// UpdateAvailable - A software or firmware update is available for the device. Additional data should be supplied including a URL where users can obtain an update and the date the update was published.
	UpdateAvailable AuthenticatorStatus = "UPDATE_AVAILABLE"

	// Revoked - The FIDO Alliance has determined that this authenticator should not be trusted for any reason, for example if it is known to be a fraudulent product or contain a deliberate backdoor.
	Revoked AuthenticatorStatus = "REVOKED"

	// SelfAssertionSubmitted - The authenticator vendor has completed and submitted the self-certification checklist to the FIDO Alliance. If this completed checklist is publicly available, the URL will be specified in StatusReportJSON.url.
	SelfAssertionSubmitted AuthenticatorStatus = "SELF_ASSERTION_SUBMITTED"

	// FidoCertifiedL1 - The authenticator has passed FIDO Authenticator certification at level 1. This level is the more strict successor of FIDO_CERTIFIED.
	FidoCertifiedL1 AuthenticatorStatus = "FIDO_CERTIFIED_L1"

	// FidoCertifiedL1plus - The authenticator has passed FIDO Authenticator certification at level 1+. This level is the more than level 1.
	FidoCertifiedL1plus AuthenticatorStatus = "FIDO_CERTIFIED_L1plus"

	// FidoCertifiedL2 - The authenticator has passed FIDO Authenticator certification at level 2. This level is more strict than level 1+.
	FidoCertifiedL2 AuthenticatorStatus = "FIDO_CERTIFIED_L2"

	// FidoCertifiedL2plus - The authenticator has passed FIDO Authenticator certification at level 2+. This level is more strict than level 2.
	FidoCertifiedL2plus AuthenticatorStatus = "FIDO_CERTIFIED_L2plus"

	// FidoCertifiedL3 - The authenticator has passed FIDO Authenticator certification at level 3. This level is more strict than level 2+.
	FidoCertifiedL3 AuthenticatorStatus = "FIDO_CERTIFIED_L3"

	// FidoCertifiedL3plus - The authenticator has passed FIDO Authenticator certification at level 3+. This level is more strict than level 3.
	FidoCertifiedL3plus AuthenticatorStatus = "FIDO_CERTIFIED_L3plus"

	// FIPS140CertifiedL1 - The authenticator has passed FIPS 140 certification at overall level 1.
	FIPS140CertifiedL1 AuthenticatorStatus = "FIPS140_CERTIFIED_L1"

	// FIPS140CertifiedL2 - The authenticator has passed FIPS 140 certification at overall level 2.
	FIPS140CertifiedL2 AuthenticatorStatus = "FIPS140_CERTIFIED_L2"

	// FIPS140CertifiedL3 - The authenticator has passed FIPS 140 certification at overall level 3.
	FIPS140CertifiedL3 AuthenticatorStatus = "FIPS140_CERTIFIED_L3"

	// FIPS140CertifiedL4 - The authenticator has passed FIPS 140 certification at overall level 4.
	FIPS140CertifiedL4 AuthenticatorStatus = "FIPS140_CERTIFIED_L4"
)

// defaultUndesiredAuthenticatorStatus is an array of undesirable authenticator statuses.
var defaultUndesiredAuthenticatorStatus = [...]AuthenticatorStatus{
	AttestationKeyCompromise,
	UserVerificationBypass,
	UserKeyRemoteCompromise,
	UserKeyPhysicalCompromise,
	Revoked,
}

// IsUndesiredAuthenticatorStatus returns whether the supplied authenticator status is desirable or not.
func IsUndesiredAuthenticatorStatus(status AuthenticatorStatus) bool {
	for _, s := range defaultUndesiredAuthenticatorStatus {
		if s == status {
			return true
		}
	}

	return false
}

// IsUndesiredAuthenticatorStatusSlice returns whether the supplied authenticator status is desirable or not.
func IsUndesiredAuthenticatorStatusSlice(status AuthenticatorStatus, values []AuthenticatorStatus) bool {
	for _, s := range values {
		if s == status {
			return true
		}
	}

	return false
}

// IsUndesiredAuthenticatorStatusMap returns whether the supplied authenticator status is desirable or not.
func IsUndesiredAuthenticatorStatusMap(status AuthenticatorStatus, values map[AuthenticatorStatus]bool) bool {
	_, ok := values[status]

	return ok
}

type AuthenticationAlgorithm string

const (
	// ALG_SIGN_SECP256R1_ECDSA_SHA256_RAW is an ECDSA signature on the NIST secp256r1 curve which must have raw R and
	// S buffers, encoded in big-endian order.
	ALG_SIGN_SECP256R1_ECDSA_SHA256_RAW AuthenticationAlgorithm = "secp256r1_ecdsa_sha256_raw"

	// ALG_SIGN_SECP256R1_ECDSA_SHA256_DER is a DER ITU-X690-2008 encoded ECDSA signature RFC5480 on the NIST secp256r1
	// curve.
	ALG_SIGN_SECP256R1_ECDSA_SHA256_DER AuthenticationAlgorithm = "secp256r1_ecdsa_sha256_der"

	// ALG_SIGN_RSASSA_PSS_SHA256_RAW is a RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian
	// order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA256_RAW AuthenticationAlgorithm = "rsassa_pss_sha256_raw"

	// ALG_SIGN_RSASSA_PSS_SHA256_DER is a DER ITU-X690-2008 encoded OCTET STRING (not BIT STRING!) containing the
	// RSASSA-PSS RFC3447 signature RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA256_DER AuthenticationAlgorithm = "rsassa_pss_sha256_der"

	// ALG_SIGN_SECP256K1_ECDSA_SHA256_RAW is an ECDSA signature on the secp256k1 curve which must have raw R and S
	// buffers, encoded in big-endian order.
	ALG_SIGN_SECP256K1_ECDSA_SHA256_RAW AuthenticationAlgorithm = "secp256k1_ecdsa_sha256_raw"

	// ALG_SIGN_SECP256K1_ECDSA_SHA256_DER is a DER ITU-X690-2008 encoded ECDSA signature RFC5480 on the secp256k1 curve.
	ALG_SIGN_SECP256K1_ECDSA_SHA256_DER AuthenticationAlgorithm = "secp256k1_ecdsa_sha256_der"

	// ALG_SIGN_SM2_SM3_RAW is a Chinese SM2 elliptic curve based signature algorithm combined with SM3 hash algorithm
	// OSCCA-SM2 OSCCA-SM3.
	ALG_SIGN_SM2_SM3_RAW AuthenticationAlgorithm = "sm2_sm3_raw"

	// ALG_SIGN_RSA_EMSA_PKCS1_SHA256_RAW is the EMSA-PKCS1-v1_5 signature as defined in RFC3447.
	ALG_SIGN_RSA_EMSA_PKCS1_SHA256_RAW AuthenticationAlgorithm = "rsa_emsa_pkcs1_sha256_raw"

	// ALG_SIGN_RSA_EMSA_PKCS1_SHA256_DER is a DER ITU-X690-2008 encoded OCTET STRING (not BIT STRING!) containing the
	// EMSA-PKCS1-v1_5 signature as defined in RFC3447.
	ALG_SIGN_RSA_EMSA_PKCS1_SHA256_DER AuthenticationAlgorithm = "rsa_emsa_pkcs1_sha256_der"

	// ALG_SIGN_RSASSA_PSS_SHA384_RAW is a RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian
	// order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA384_RAW AuthenticationAlgorithm = "rsassa_pss_sha384_raw"

	// ALG_SIGN_RSASSA_PSS_SHA512_RAW is a RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian
	// order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA512_RAW AuthenticationAlgorithm = "rsassa_pss_sha512_raw"

	// ALG_SIGN_RSASSA_PKCSV15_SHA256_RAW is a RSASSA-PKCS1-v1_5 RFC3447 with SHA256(aka RS256) signature must have raw
	// S buffers, encoded in big-endian order RFC8017 RFC4056.
	ALG_SIGN_RSASSA_PKCSV15_SHA256_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha256_raw"

	// ALG_SIGN_RSASSA_PKCSV15_SHA384_RAW is a RSASSA-PKCS1-v1_5 RFC3447 with SHA384(aka RS384) signature must have raw S buffers, encoded in big-endian order RFC8017 RFC4056.
	ALG_SIGN_RSASSA_PKCSV15_SHA384_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha384_raw"

	// ALG_SIGN_RSASSA_PKCSV15_SHA512_RAW is a RSASSA-PKCS1-v1_5 RFC3447 with SHA512(aka RS512) signature must have raw
	// S buffers, encoded in big-endian order RFC8017 RFC4056.
	ALG_SIGN_RSASSA_PKCSV15_SHA512_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha512_raw"

	// ALG_SIGN_RSASSA_PKCSV15_SHA1_RAW is a RSASSA-PKCS1-v1_5 RFC3447 with SHA1(aka RS1) signature must have raw S
	// buffers, encoded in big-endian order RFC8017 RFC4056.
	ALG_SIGN_RSASSA_PKCSV15_SHA1_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha1_raw"

	// ALG_SIGN_SECP384R1_ECDSA_SHA384_RAW is an ECDSA signature on the NIST secp384r1 curve with SHA384(aka: ES384)
	// which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP384R1_ECDSA_SHA384_RAW AuthenticationAlgorithm = "secp384r1_ecdsa_sha384_raw"

	// ALG_SIGN_SECP521R1_ECDSA_SHA512_RAW is an ECDSA signature on the NIST secp512r1 curve with SHA512(aka: ES512)
	// which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP521R1_ECDSA_SHA512_RAW AuthenticationAlgorithm = "secp521r1_ecdsa_sha512_raw"

	// ALG_SIGN_ED25519_EDDSA_SHA512_RAW is an EdDSA signature on the curve 25519, which must have raw R and S buffers,
	// encoded in big-endian order.
	ALG_SIGN_ED25519_EDDSA_SHA512_RAW AuthenticationAlgorithm = "ed25519_eddsa_sha512_raw"

	// ALG_SIGN_ED448_EDDSA_SHA512_RAW is an EdDSA signature on the curve Ed448, which must have raw R and S buffers,
	// encoded in big-endian order.
	ALG_SIGN_ED448_EDDSA_SHA512_RAW AuthenticationAlgorithm = "ed448_eddsa_sha512_raw"
)

// TODO: this goes away after webauthncose.CredentialPublicKey gets implemented.
type algKeyCose struct {
	KeyType   webauthncose.COSEKeyType
	Algorithm webauthncose.COSEAlgorithmIdentifier
	Curve     webauthncose.COSEEllipticCurve
}

func algKeyCoseDictionary() func(AuthenticationAlgorithm) algKeyCose {
	mapping := map[AuthenticationAlgorithm]algKeyCose{
		ALG_SIGN_SECP256R1_ECDSA_SHA256_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256, Curve: webauthncose.P256},
		ALG_SIGN_SECP256R1_ECDSA_SHA256_DER: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256, Curve: webauthncose.P256},
		ALG_SIGN_RSASSA_PSS_SHA256_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS256},
		ALG_SIGN_RSASSA_PSS_SHA256_DER:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS256},
		ALG_SIGN_SECP256K1_ECDSA_SHA256_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256K, Curve: webauthncose.Secp256k1},
		ALG_SIGN_SECP256K1_ECDSA_SHA256_DER: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256K, Curve: webauthncose.Secp256k1},
		ALG_SIGN_RSASSA_PSS_SHA384_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS384},
		ALG_SIGN_RSASSA_PSS_SHA512_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS512},
		ALG_SIGN_RSASSA_PKCSV15_SHA256_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS256},
		ALG_SIGN_RSASSA_PKCSV15_SHA384_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS384},
		ALG_SIGN_RSASSA_PKCSV15_SHA512_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS512},
		ALG_SIGN_RSASSA_PKCSV15_SHA1_RAW:    {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS1},
		ALG_SIGN_SECP384R1_ECDSA_SHA384_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES384, Curve: webauthncose.P384},
		ALG_SIGN_SECP521R1_ECDSA_SHA512_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES512, Curve: webauthncose.P521},
		ALG_SIGN_ED25519_EDDSA_SHA512_RAW:   {KeyType: webauthncose.OctetKey, Algorithm: webauthncose.AlgEdDSA, Curve: webauthncose.Ed25519},
		ALG_SIGN_ED448_EDDSA_SHA512_RAW:     {KeyType: webauthncose.OctetKey, Algorithm: webauthncose.AlgEdDSA, Curve: webauthncose.Ed448},
	}

	return func(key AuthenticationAlgorithm) algKeyCose {
		return mapping[key]
	}
}

func AlgKeyMatch(key algKeyCose, algs []AuthenticationAlgorithm) bool {
	for _, alg := range algs {
		if reflect.DeepEqual(algKeyCoseDictionary()(alg), key) {
			return true
		}
	}

	return false
}

type PublicKeyAlgAndEncoding string

const (
	// ALG_KEY_ECC_X962_RAW is a raw ANSI X9.62 formatted Elliptic Curve public key.
	ALG_KEY_ECC_X962_RAW PublicKeyAlgAndEncoding = "ecc_x962_raw"

	// ALG_KEY_ECC_X962_DER is a DER ITU-X690-2008 encoded ANSI X.9.62 formatted SubjectPublicKeyInfo RFC5480 specifying an elliptic curve public key.
	ALG_KEY_ECC_X962_DER PublicKeyAlgAndEncoding = "ecc_x962_der"

	// ALG_KEY_RSA_2048_RAW is a raw encoded 2048-bit RSA public key RFC3447.
	ALG_KEY_RSA_2048_RAW PublicKeyAlgAndEncoding = "rsa_2048_raw"

	// ALG_KEY_RSA_2048_DER is a ASN.1 DER [ITU-X690-2008] encoded 2048-bit RSA RFC3447 public key RFC4055.
	ALG_KEY_RSA_2048_DER PublicKeyAlgAndEncoding = "rsa_2048_der"

	// ALG_KEY_COSE is a COSE_Key format, as defined in Section 7 of RFC8152. This encoding includes its own field for indicating the public key algorithm.
	ALG_KEY_COSE PublicKeyAlgAndEncoding = "cose"
)

type Error struct {
	// Short name for the type of error that has occurred.
	Type string `json:"type"`

	// Additional details about the error.
	Details string `json:"error"`

	// Information to help debug the error.
	DevInfo string `json:"debug"`
}

func (e *Error) Error() string {
	return e.Details
}

// Clock is an interface used to implement clock functionality in various metadata areas.
type Clock interface {
	// Now returns the current time.
	Now() time.Time
}

// RealClock is just a real clock.
type RealClock struct{}

// Now returns the current time.
func (RealClock) Now() time.Time {
	return time.Now()
}
