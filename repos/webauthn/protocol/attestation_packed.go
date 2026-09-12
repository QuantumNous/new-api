package protocol

import (
	"bytes"
	"crypto/x509"
	"encoding/asn1"
	"fmt"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

func init() {
	RegisterAttestationFormat(AttestationFormatPacked, attestationFormatValidationHandlerPacked)
}

// attestationFormatValidationHandlerPacked is the handler for the Packed Attestation Statement Format.
//
// The syntax of a Packed Attestation statement is defined by the following CDDL:
//
// $$attStmtType //= (
//                       fmt: "packed",
//                       attStmt: packedStmtFormat
//                   )
//
// packedStmtFormat = {
//                        alg: COSEAlgorithmIdentifier,
//                        sig: bytes,
//                        x5c: [ attestnCert: bytes, * (caCert: bytes) ]
//                    } //
//                    {
//                        alg: COSEAlgorithmIdentifier
//                        sig: bytes,
//                    }
//
// Specification: §8.2. Packed Attestation Statement Format
//
// See: https://www.w3.org/TR/webauthn/#sctn-packed-attestation
func attestationFormatValidationHandlerPacked(att AttestationObject, clientDataHash []byte, mds metadata.Provider) (attestationType string, x5cs []any, err error) {
	var (
		alg int64
		sig []byte
		x5c []any
		ok  bool
	)

	// Step 1. Verify that attStmt is valid CBOR conforming to the syntax defined
	// above and perform CBOR decoding on it to extract the contained fields.
	// Get the alg value - A COSEAlgorithmIdentifier containing the identifier of the algorithm
	// used to generate the attestation signature.
	if alg, ok = att.AttStatement[stmtAlgorithm].(int64); !ok {
		return string(AttestationFormatPacked), nil, ErrAttestationFormat.WithDetails("Error retrieving alg value")
	}

	// Get the sig value - A byte string containing the attestation signature.
	if sig, ok = att.AttStatement[stmtSignature].([]byte); !ok {
		return string(AttestationFormatPacked), nil, ErrAttestationFormat.WithDetails("Error retrieving sig value")
	}

	// Step 2. If x5c is present, this indicates that the attestation type is not ECDAA.
	if x5c, ok = att.AttStatement[stmtX5C].([]any); ok {
		// Handle Basic Attestation steps for the x509 Certificate.
		return handleBasicAttestation(sig, clientDataHash, att.RawAuthData, att.AuthData.AttData.AAGUID, alg, x5c, mds)
	}

	// Step 3. If ecdaaKeyId is present, then the attestation type is ECDAA.
	// Also make sure the we did not have an x509.
	ecdaaKeyID, ecdaaKeyPresent := att.AttStatement[stmtECDAAKID].([]byte)
	if ecdaaKeyPresent {
		// Handle ECDAA Attestation steps for the x509 Certificate.
		return handleECDAAAttestation(sig, clientDataHash, ecdaaKeyID, mds)
	}

	// Step 4. If neither x5c nor ecdaaKeyId is present, self attestation is in use.
	return handleSelfAttestation(alg, att.AuthData.AttData.CredentialPublicKey, att.RawAuthData, clientDataHash, sig, mds)
}

// Handle the attestation steps laid out in the basic format.
func handleBasicAttestation(sig, clientDataHash, authData, aaguid []byte, alg int64, x5c []any, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	// Step 2.1. Verify that sig is a valid signature over the concatenation of authenticatorData
	// and clientDataHash using the attestation public key in attestnCert with the algorithm specified in alg.
	var attestnCert *x509.Certificate

	for i, raw := range x5c {
		rawByes, ok := raw.([]byte)
		if !ok {
			return "", x5c, ErrAttestation.WithDetails("Error getting certificate from x5c cert chain")
		}

		cert, err := x509.ParseCertificate(rawByes)
		if err != nil {
			return "", x5c, ErrAttestationFormat.WithDetails(fmt.Sprintf("Error parsing certificate from ASN.1 data: %+v", err)).WithError(err)
		}

		if cert.NotBefore.After(time.Now()) || cert.NotAfter.Before(time.Now()) {
			return "", x5c, ErrAttestationFormat.WithDetails("Cert in chain not time valid")
		}

		if i == 0 {
			attestnCert = cert
		}
	}

	if attestnCert == nil {
		return "", x5c, ErrAttestation.WithDetails("Error getting certificate from x5c cert chain")
	}

	signatureData := append(authData, clientDataHash...) //nolint:gocritic // This is intentional.

	if sigAlg := webauthncose.SigAlgFromCOSEAlg(webauthncose.COSEAlgorithmIdentifier(alg)); sigAlg == x509.UnknownSignatureAlgorithm {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Unsupported COSE alg: %d", alg))
	} else if err = attestnCert.CheckSignature(sigAlg, signatureData, sig); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Signature validation error: %+v", err)).WithError(err)
	}

	// Step 2.2 Verify that attestnCert meets the requirements in §8.2.1 Packed attestation statement certificate requirements.
	// §8.2.1 can be found here https://www.w3.org/TR/webauthn/#packed-attestation-cert-requirements

	// Step 2.2.1 (from §8.2.1) Version MUST be set to 3 (which is indicated by an ASN.1 INTEGER with value 2).
	if attestnCert.Version != 3 {
		return "", x5c, ErrAttestationCertificate.WithDetails("Attestation Certificate is incorrect version")
	}

	// Step 2.2.2 (from §8.2.1) Subject field MUST be set to:
	// 	Subject-C
	// 	ISO 3166 code specifying the country where the Authenticator vendor is incorporated (PrintableString).

	//  TODO: Find a good, usable, country code library. For now, check stringy-ness
	subjectString := strings.Join(attestnCert.Subject.Country, "")
	if subjectString == "" {
		return "", x5c, ErrAttestationCertificate.WithDetails("Attestation Certificate Country Code is invalid")
	}

	// 	Subject-O
	// 	Legal name of the Authenticator vendor (UTF8String).
	subjectString = strings.Join(attestnCert.Subject.Organization, "")
	if subjectString == "" {
		return "", x5c, ErrAttestationCertificate.WithDetails("Attestation Certificate Organization is invalid")
	}

	// Subject-OU
	// Literal string “Authenticator Attestation” (UTF8String).
	subjectString = strings.Join(attestnCert.Subject.OrganizationalUnit, " ")
	if subjectString != "Authenticator Attestation" {
		return "", x5c, ErrAttestationCertificate.WithDetails("Attestation Certificate Organizational Unit is invalid")
	}

	//  Subject-CN
	//  A UTF8String of the vendor’s choosing.
	subjectString = attestnCert.Subject.CommonName
	if subjectString == "" {
		return "", x5c, ErrAttestationCertificate.WithDetails("Attestation Certificate Common Name not set")
	}

	// Step 2.2.3 (from §8.2.1) If the related attestation root certificate is used for multiple authenticator models,
	// the Extension OID 1.3.6.1.4.1.45724.1.1.4 (id-fido-gen-ce-aaguid) MUST be present, containing the
	// AAGUID as a 16-byte OCTET STRING. The extension MUST NOT be marked as critical.
	var foundAAGUID []byte

	for _, extension := range attestnCert.Extensions {
		if extension.Id.Equal(oidFIDOGenCeAAGUID) {
			if extension.Critical {
				return "", x5c, ErrInvalidAttestation.WithDetails("Attestation certificate FIDO extension marked as critical")
			}

			foundAAGUID = extension.Value
		}
	}

	// We validate the AAGUID as mentioned above
	// This is not well defined in§8.2.1 but mentioned in step 2.3: we validate the AAGUID if it is present within the certificate
	// and make sure it matches the auth data AAGUID
	// Note that an X.509 Extension encodes the DER-encoding of the value in an OCTET STRING. Thus, the
	// AAGUID MUST be wrapped in two OCTET STRINGS to be valid.
	if len(foundAAGUID) > 0 {
		var unMarshalledAAGUID []byte

		if _, err = asn1.Unmarshal(foundAAGUID, &unMarshalledAAGUID); err != nil {
			return "", x5c, ErrInvalidAttestation.WithDetails("Error unmarshalling AAGUID from certificate")
		}

		if !bytes.Equal(aaguid, unMarshalledAAGUID) {
			return "", x5c, ErrInvalidAttestation.WithDetails("Certificate AAGUID does not match Auth Data certificate")
		}
	}

	// Step 2.2.4 The Basic Constraints extension MUST have the CA component set to false.
	if attestnCert.IsCA {
		return "", x5c, ErrInvalidAttestation.WithDetails("Attestation certificate's Basic Constraints marked as CA")
	}

	// Note for 2.2.5 An Authority Information Access (AIA) extension with entry id-ad-ocsp and a CRL
	// Distribution Point extension [RFC5280](https://www.w3.org/TR/webauthn/#biblio-rfc5280) are
	// both OPTIONAL as the status of many attestation certificates is available through authenticator
	// metadata services. See, for example, the FIDO Metadata Service
	// [FIDOMetadataService] (https://www.w3.org/TR/webauthn/#biblio-fidometadataservice)

	// Step 2.4 If successful, return attestation type Basic and attestation trust path x5c.
	// We don't handle trust paths yet but we're done.
	return string(metadata.BasicFull), x5c, nil
}

func handleECDAAAttestation(sig, clientDataHash, ecdaaKeyID []byte, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	return "Packed (ECDAA)", nil, ErrNotSpecImplemented
}

func handleSelfAttestation(alg int64, pubKey, authData, clientDataHash, sig []byte, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	verificationData := append(authData, clientDataHash...) //nolint:gocritic // This is intentional.

	var (
		key   any
		valid bool
	)

	if key, err = webauthncose.ParsePublicKey(pubKey); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails(fmt.Sprintf("Error parsing the public key: %+v", err))
	}

	// §4.1 Validate that alg matches the algorithm of the credentialPublicKey in authenticatorData.
	switch k := key.(type) {
	case webauthncose.OKPPublicKeyData:
		err = verifyKeyAlgorithm(k.Algorithm, alg)
	case webauthncose.EC2PublicKeyData:
		err = verifyKeyAlgorithm(k.Algorithm, alg)
	case webauthncose.RSAPublicKeyData:
		err = verifyKeyAlgorithm(k.Algorithm, alg)
	default:
		return "", nil, ErrInvalidAttestation.WithDetails("Error verifying the public key data")
	}

	if err != nil {
		return "", nil, err
	}

	// §4.2 Verify that sig is a valid signature over the concatenation of authenticatorData and
	// clientDataHash using the credential public key with alg.
	if valid, err = webauthncose.VerifySignature(key, verificationData, sig); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails(fmt.Sprintf("Error verifying the signature: %+v", err)).WithError(err)
	} else if !valid {
		return "", nil, ErrInvalidAttestation.WithDetails("Unable to verify signature")
	}

	return string(metadata.BasicSurrogate), nil, err
}

func verifyKeyAlgorithm(keyAlgorithm, attestedAlgorithm int64) error {
	if keyAlgorithm != attestedAlgorithm {
		return ErrInvalidAttestation.WithDetails("Public key algorithm does not equal att statement algorithm")
	}

	return nil
}
