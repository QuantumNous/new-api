package protocol

import (
	"bytes"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"errors"
	"fmt"
	"strings"

	"github.com/google/go-tpm/legacy/tpm2"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// attestationFormatValidationHandlerTPM is the handler for the TPM Attestation Statement Format.
//
// The syntax of a TPM Attestation statement is as follows:
//
// $$attStmtType // = (
//                        fmt: "tpm",
//                        attStmt: tpmStmtFormat
//                    )
//
// tpmStmtFormat = {
//                     ver: "2.0",
//                     (
//                         alg: COSEAlgorithmIdentifier,
//                         x5c: [ aikCert: bytes, * (caCert: bytes) ]
//                     )
//                     sig: bytes,
//                     certInfo: bytes,
//                     pubArea: bytes
//                 }
//
// Specification: §8.3. TPM Attestation Statement Format
//
// See: https://www.w3.org/TR/webauthn/#sctn-tpm-attestation
func attestationFormatValidationHandlerTPM(att AttestationObject, clientDataHash []byte, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	var (
		ver    string
		alg    int64
		x5c    []any
		ok     bool
		x509ok bool
	)

	// Given the verification procedure inputs attStmt, authenticatorData
	// and clientDataHash, the verification procedure is as follows.

	// Verify that attStmt is valid CBOR conforming to the syntax defined
	// above and perform CBOR decoding on it to extract the contained fields.
	if ver, ok = att.AttStatement[stmtVersion].(string); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving ver value")
	}

	if ver != "2.0" {
		return "", nil, ErrAttestationFormat.WithDetails("WebAuthn only supports TPM 2.0 currently")
	}

	if alg, ok = att.AttStatement[stmtAlgorithm].(int64); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving alg value")
	}

	if x5c, x509ok = att.AttStatement[stmtX5C].([]any); !x509ok {
		// Handle Basic Attestation steps for the x509 Certificate.
		return "", nil, ErrNotImplemented
	}

	if _, ok = att.AttStatement[stmtECDAAKID].([]byte); ok {
		return "", nil, ErrNotImplemented
	}

	var (
		sig           []byte
		certInfoBytes []byte
		pubAreaBytes  []byte
		pubArea       tpm2.Public
		key           any
	)

	if sig, ok = att.AttStatement[stmtSignature].([]byte); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving sig value")
	}

	if certInfoBytes, ok = att.AttStatement[stmtCertInfo].([]byte); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving certInfo value")
	}

	if pubAreaBytes, ok = att.AttStatement[stmtPubArea].([]byte); !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Error retrieving pubArea value")
	}

	// Verify that the public key specified by the parameters and unique fields of pubArea
	// is identical to the credentialPublicKey in the attestedCredentialData in authenticatorData.
	if pubArea, err = tpm2.DecodePublic(pubAreaBytes); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to decode TPMT_PUBLIC in attestation statement").WithError(err)
	}

	if key, err = webauthncose.ParsePublicKey(att.AuthData.AttData.CredentialPublicKey); err != nil {
		return "", nil, err
	}

	switch k := key.(type) {
	case webauthncose.EC2PublicKeyData:
		if pubArea.ECCParameters.CurveID != k.TPMCurveID() ||
			!bytes.Equal(pubArea.ECCParameters.Point.XRaw, k.XCoord) ||
			!bytes.Equal(pubArea.ECCParameters.Point.YRaw, k.YCoord) {
			return "", nil, ErrAttestationFormat.WithDetails("Mismatch between ECCParameters in pubArea and credentialPublicKey")
		}
	case webauthncose.RSAPublicKeyData:
		exp := uint32(k.Exponent[0]) + uint32(k.Exponent[1])<<8 + uint32(k.Exponent[2])<<16
		if !bytes.Equal(pubArea.RSAParameters.ModulusRaw, k.Modulus) ||
			pubArea.RSAParameters.Exponent() != exp {
			return "", nil, ErrAttestationFormat.WithDetails("Mismatch between RSAParameters in pubArea and credentialPublicKey")
		}
	default:
		return "", nil, ErrUnsupportedKey
	}

	// Concatenate authenticatorData and clientDataHash to form attToBeSigned.
	attToBeSigned := append(att.RawAuthData, clientDataHash...) //nolint:gocritic // This is intentional.

	// Validate that certInfo is valid:
	// 1/4 Verify that magic is set to TPM_GENERATED_VALUE, handled here.
	certInfo, err := tpm2.DecodeAttestationData(certInfoBytes)
	if err != nil {
		return "", nil, err
	}

	// 2/4 Verify that type is set to TPM_ST_ATTEST_CERTIFY.
	if certInfo.Type != tpm2.TagAttestCertify {
		return "", nil, ErrAttestationFormat.WithDetails("Type is not set to TPM_ST_ATTEST_CERTIFY")
	}

	// 3/4 Verify that extraData is set to the hash of attToBeSigned using the hash algorithm employed in "alg".
	coseAlg := webauthncose.COSEAlgorithmIdentifier(alg)

	h := webauthncose.HasherFromCOSEAlg(coseAlg)
	h.Write(attToBeSigned)

	if !bytes.Equal(certInfo.ExtraData, h.Sum(nil)) {
		return "", nil, ErrAttestationFormat.WithDetails("ExtraData is not set to hash of attToBeSigned")
	}

	// 4/4 Verify that attested contains a TPMS_CERTIFY_INFO structure as specified in
	// [TPMv2-Part2] section 10.12.3, whose name field contains a valid Name for pubArea,
	// as computed using the algorithm in the nameAlg field of pubArea
	// using the procedure specified in [TPMv2-Part1] section 16.
	if ok, err = certInfo.AttestedCertifyInfo.Name.MatchesPublic(pubArea); err != nil {
		return "", nil, err
	} else if !ok {
		return "", nil, ErrAttestationFormat.WithDetails("Hash value mismatch attested and pubArea")
	}

	// Note that the remaining fields in the "Standard Attestation Structure"
	// [TPMv2-Part1] section 31.2, i.e., qualifiedSigner, clockInfo and firmwareVersion
	// are ignored. These fields MAY be used as an input to risk engines.

	// If x5c is present, this indicates that the attestation type is not ECDAA.
	if x509ok {
		var (
			aikCert *x509.Certificate
			raw     []byte
		)

		// In this case:
		// Verify the sig is a valid signature over certInfo using the attestation public key in aikCert with the algorithm specified in alg.
		if raw, ok = x5c[0].([]byte); !ok {
			return "", nil, ErrAttestation.WithDetails("Error getting certificate from x5c cert chain")
		}

		if aikCert, err = x509.ParseCertificate(raw); err != nil {
			return "", nil, ErrAttestationFormat.WithDetails("Error parsing certificate from ASN.1")
		}

		if sigAlg := webauthncose.SigAlgFromCOSEAlg(coseAlg); sigAlg == x509.UnknownSignatureAlgorithm {
			return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Unsupported COSE alg: %d", alg))
		} else if err = aikCert.CheckSignature(sigAlg, certInfoBytes, sig); err != nil {
			return "", nil, ErrAttestationFormat.WithDetails(fmt.Sprintf("Signature validation error: %+v", err))
		}

		// Verify that aikCert meets the requirements in §8.3.1 TPM Attestation Statement Certificate Requirements.

		// 1/6 Version MUST be set to 3.
		if aikCert.Version != 3 {
			return "", nil, ErrAttestationFormat.WithDetails("AIK certificate version must be 3")
		}

		// 2/6 Subject field MUST be set to empty.
		if aikCert.Subject.String() != "" {
			return "", nil, ErrAttestationFormat.WithDetails("AIK certificate subject must be empty")
		}

		var (
			manufacturer, model, version string
			ekuValid                     = false
			eku                          []asn1.ObjectIdentifier
			constraints                  tpmBasicConstraints
			rest                         []byte
		)

		for _, ext := range aikCert.Extensions {
			switch {
			case ext.Id.Equal(oidExtensionSubjectAltName):
				if manufacturer, model, version, err = parseSANExtension(ext.Value); err != nil {
					return "", nil, err
				}
			case ext.Id.Equal(oidExtensionExtendedKeyUsage):
				if rest, err = asn1.Unmarshal(ext.Value, &eku); err != nil {
					return "", nil, ErrAttestationFormat.WithDetails("AIK certificate extended key usage malformed")
				} else if len(rest) != 0 {
					return "", nil, ErrAttestationFormat.WithDetails("AIK certificate extended key usage contains extra data")
				}

				found := false

				for _, oid := range eku {
					if oid.Equal(oidTCGKpAIKCertificate) {
						found = true
						break
					}
				}

				if !found {
					return "", nil, ErrAttestationFormat.WithDetails("AIK certificate extended key usage missing 2.23.133.8.3")
				}

				ekuValid = true
			case ext.Id.Equal(oidExtensionBasicConstraints):
				if rest, err = asn1.Unmarshal(ext.Value, &constraints); err != nil {
					return "", nil, ErrAttestationFormat.WithDetails("AIK certificate basic constraints malformed")
				} else if len(rest) != 0 {
					return "", nil, ErrAttestationFormat.WithDetails("AIK certificate basic constraints contains extra data")
				}
			}
		}

		// 3/6 The Subject Alternative Name extension MUST be set as defined in [TPMv2-EK-Profile] section 3.2.9.
		if manufacturer == "" || model == "" || version == "" {
			return "", nil, ErrAttestationFormat.WithDetails("Invalid SAN data in AIK certificate")
		}

		if !isValidTPMManufacturer(manufacturer) {
			return "", nil, ErrAttestationFormat.WithDetails("Invalid TPM manufacturer")
		}

		// 4/6 The Extended Key Usage extension MUST contain the "joint-iso-itu-t(2) internationalorganizations(23) 133 tcg-kp(8) tcg-kp-AIKCertificate(3)" OID.
		if !ekuValid {
			return "", nil, ErrAttestationFormat.WithDetails("AIK certificate missing EKU")
		}

		// 6/6 An Authority Information Access (AIA) extension with entry id-ad-ocsp and a CRL Distribution Point
		// extension [RFC5280] are both OPTIONAL as the status of many attestation certificates is available
		// through metadata services. See, for example, the FIDO Metadata Service.
		if constraints.IsCA {
			return "", nil, ErrAttestationFormat.WithDetails("AIK certificate basic constraints missing or CA is true")
		}
	}

	return string(metadata.AttCA), x5c, err
}

// forEachSAN loops through the TPM SAN extension.
//
// RFC 5280, 4.2.1.6
// SubjectAltName ::= GeneralNames
//
// GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
//
//	GeneralName ::= CHOICE {
//	     otherName                       [0]     OtherName,
//	     rfc822Name                      [1]     IA5String,
//	     dNSName                         [2]     IA5String,
//	     x400Address                     [3]     ORAddress,
//	     directoryName                   [4]     Name,
//	     ediPartyName                    [5]     EDIPartyName,
//	     uniformResourceIdentifier       [6]     IA5String,
//	     iPAddress                       [7]     OCTET STRING,
//	     registeredID                    [8]     OBJECT IDENTIFIER }
func forEachSAN(extension []byte, callback func(tag int, data []byte) error) error {
	var seq asn1.RawValue

	rest, err := asn1.Unmarshal(extension, &seq)
	if err != nil {
		return err
	} else if len(rest) != 0 {
		return errors.New("x509: trailing data after X.509 extension")
	}

	if !seq.IsCompound || seq.Tag != 16 || seq.Class != 0 {
		return asn1.StructuralError{Msg: "bad SAN sequence"}
	}

	rest = seq.Bytes

	for len(rest) > 0 {
		var v asn1.RawValue

		rest, err = asn1.Unmarshal(rest, &v)
		if err != nil {
			return err
		}

		if err = callback(v.Tag, v.Bytes); err != nil {
			return err
		}
	}

	return nil
}

const (
	nameTypeDN = 4
)

func parseSANExtension(value []byte) (manufacturer string, model string, version string, err error) {
	err = forEachSAN(value, func(tag int, data []byte) error {
		if tag == nameTypeDN {
			tpmDeviceAttributes := pkix.RDNSequence{}

			if _, err = asn1.Unmarshal(data, &tpmDeviceAttributes); err != nil {
				return err
			}

			for _, rdn := range tpmDeviceAttributes {
				if len(rdn) == 0 {
					continue
				}

				for _, atv := range rdn {
					value, ok := atv.Value.(string)
					if !ok {
						continue
					}

					if atv.Type.Equal(oidTCGAtTpmManufacturer) {
						manufacturer = strings.TrimPrefix(value, "id:")
					}

					if atv.Type.Equal(oidTCGAtTpmModel) {
						model = value
					}

					if atv.Type.Equal(oidTCGAtTPMVersion) {
						version = strings.TrimPrefix(value, "id:")
					}
				}
			}
		}

		return nil
	})

	return
}

// See https://trustedcomputinggroup.org/resource/vendor-id-registry/ for registry contents.
var tpmManufacturers = []struct {
	id   string
	name string
	code string
}{
	{"414D4400", "AMD", "AMD"},
	{"414E5400", "Ant Group", "ANT"},
	{"41544D4C", "Atmel", "ATML"},
	{"4252434D", "Broadcom", "BRCM"},
	{"4353434F", "Cisco", "CSCO"},
	{"464C5953", "Flyslice Technologies", "FLYS"},
	{"524F4343", "Fuzhou Rockchip", "ROCC"},
	{"474F4F47", "Google", "GOOG"},
	{"48504900", "HPI", "HPI"},
	{"48504500", "HPE", "HPE"},
	{"48495349", "Huawei", "HISI"},
	{"49424d00", "IBM", "IBM"},
	{"49424D00", "IBM", "IBM"},
	{"49465800", "Infineon", "IFX"},
	{"494E5443", "Intel", "INTC"},
	{"4C454E00", "Lenovo", "LEN"},
	{"4D534654", "Microsoft", "MSFT"},
	{"4E534D20", "National Semiconductor", "NSM"},
	{"4E545A00", "Nationz", "NTZ"},
	{"4E534700", "NSING", "NSG"},
	{"4E544300", "Nuvoton Technology", "NTC"},
	{"51434F4D", "Qualcomm", "QCOM"},
	{"534D534E", "Samsung", "SECE"},
	{"53454345", "SecEdge", "SecEdge"},
	{"534E5300", "Sinosun", "SNS"},
	{"534D5343", "SMSC", "SMSC"},
	{"53544D20", "ST Microelectronics", "STM"},
	{"54584E00", "Texas Instruments", "TXN"},
	{"57454300", "Winbond", "WEC"},
	{"5345414C", "Wisekey", "SEAL"},
	{"FFFFF1D0", "FIDO Alliance Conformance Testing", "FIDO"},
}

func isValidTPMManufacturer(id string) bool {
	for _, m := range tpmManufacturers {
		if m.id == id {
			return true
		}
	}

	return false
}

func tpmParseAIKAttCA(x5c *x509.Certificate, x5cis []*x509.Certificate) (err *Error) {
	if err = tpmParseSANExtension(x5c); err != nil {
		return err
	}

	if err = tpmRemoveEKU(x5c); err != nil {
		return err
	}

	for _, parent := range x5cis {
		if err = tpmRemoveEKU(parent); err != nil {
			return err
		}
	}

	return nil
}

func tpmParseSANExtension(attestation *x509.Certificate) (protoErr *Error) {
	var (
		manufacturer, model, version string
		err                          error
	)

	for _, ext := range attestation.Extensions {
		if ext.Id.Equal(oidExtensionSubjectAltName) {
			if manufacturer, model, version, err = parseSANExtension(ext.Value); err != nil {
				return ErrInvalidAttestation.WithDetails("Authenticator with invalid Authenticator Identity Key SAN data encountered during attestation validation.").WithInfo(fmt.Sprintf("Error occurred parsing SAN extension: %s", err.Error())).WithError(err)
			}
		}
	}

	if manufacturer == "" || model == "" || version == "" {
		return ErrAttestationFormat.WithDetails("Invalid SAN data in AIK certificate.")
	}

	var unhandled []asn1.ObjectIdentifier //nolint:prealloc

	for _, uce := range attestation.UnhandledCriticalExtensions {
		if uce.Equal(oidExtensionSubjectAltName) {
			continue
		}

		unhandled = append(unhandled, uce)
	}

	attestation.UnhandledCriticalExtensions = unhandled

	return nil
}

type tpmBasicConstraints struct {
	IsCA       bool `asn1:"optional"`
	MaxPathLen int  `asn1:"optional,default:-1"`
}

// Remove extension key usage to avoid ExtKeyUsage check failure.
func tpmRemoveEKU(x5c *x509.Certificate) *Error {
	var (
		unknown []asn1.ObjectIdentifier
		hasAiK  bool
	)

	for _, eku := range x5c.UnknownExtKeyUsage {
		if eku.Equal(oidTCGKpAIKCertificate) {
			hasAiK = true

			continue
		}

		if eku.Equal(oidMicrosoftKpPrivacyCA) {
			continue
		}

		unknown = append(unknown, eku)
	}

	if !hasAiK {
		return ErrAttestationFormat.WithDetails("Attestation Identity Key certificate missing required Extended Key Usage.")
	}

	x5c.UnknownExtKeyUsage = unknown

	return nil
}

func init() {
	RegisterAttestationFormat(AttestationFormatTPM, attestationFormatValidationHandlerTPM)
}
