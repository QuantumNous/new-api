package protocol

import (
	"bytes"
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"time"

	"github.com/go-webauthn/webauthn/metadata"
)

// attestationFormatValidationHandlerAppleAnonymous is the handler for the Apple Anonymous Attestation Statement Format.
//
// The syntax of an Apple attestation statement is defined as follows:
//
// $$attStmtType //= (
//                       fmt: "apple",
//                       attStmt: appleStmtFormat
//                   )
//
// appleStmtFormat = {
//                       x5c: [ credCert: bytes, * (caCert: bytes) ]
//                   }
//
// Specification: §8.8. Apple Anonymous Attestation Statement Format
//
// See : https://www.w3.org/TR/webauthn/#sctn-apple-anonymous-attestation
func attestationFormatValidationHandlerAppleAnonymous(att AttestationObject, clientDataHash []byte, _ metadata.Provider) (attestationType string, x5cs []any, err error) {
	// Step 1. Verify that attStmt is valid CBOR conforming to the syntax defined above and perform CBOR decoding on it
	// to extract the contained fields.
	var (
		x5c   []any
		certs []*x509.Certificate
	)

	if x5c, certs, err = attStatementParseX5CS(att.AttStatement, stmtX5C); err != nil {
		return "", nil, err
	}

	credCert := certs[0]

	if _, err = attStatementCertChainVerify(certs, attAppleHardwareRootsCertPool, true, time.Now().Add(time.Hour*8760).UTC()); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails("Error validating x5c cert chain").WithError(err)
	}

	// Step 2. Concatenate authenticatorData and clientDataHash to form nonceToHash.
	nonceToHash := append(att.RawAuthData, clientDataHash...) //nolint:gocritic // This is intentional.

	// Step 3. Perform SHA-256 hash of nonceToHash to produce nonce.
	nonce := sha256.Sum256(nonceToHash)

	// Step 4. Verify that nonce equals the value of the extension with OID 1.2.840.113635.100.8.2 in credCert.
	var attExtBytes []byte

	for _, ext := range credCert.Extensions {
		if ext.Id.Equal(oidExtensionAppleAnonymousAttestation) {
			attExtBytes = ext.Value
		}
	}

	if len(attExtBytes) == 0 {
		return "", nil, ErrAttestationFormat.WithDetails("Attestation certificate extensions missing 1.2.840.113635.100.8.2")
	}

	decoded := AppleAnonymousAttestation{}

	if _, err = asn1.Unmarshal(attExtBytes, &decoded); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to parse apple attestation certificate extensions").WithError(err)
	}

	if !bytes.Equal(decoded.Nonce, nonce[:]) {
		return "", nil, ErrInvalidAttestation.WithDetails("Attestation certificate does not contain expected nonce")
	}

	// Step 5. Verify that the credential public key equals the Subject Public Key of credCert.
	if _, err = verifyAttestationECDSAPublicKeyMatch(att, credCert); err != nil {
		return "", nil, err
	}

	// Step 6. If successful, return implementation-specific values representing attestation type Anonymization CA and
	// attestation trust path x5c.
	return string(metadata.AnonCA), x5c, nil
}

// AppleAnonymousAttestation represents the attestation format for Apple, who have not yet published a schema for the
// extension (as of JULY 2021.)
type AppleAnonymousAttestation struct {
	Nonce []byte `asn1:"tag:1,explicit"`
}

var (
	attAppleHardwareRootsCertPool *x509.CertPool
)

func init() {
	RegisterAttestationFormat(AttestationFormatApple, attestationFormatValidationHandlerAppleAnonymous)
}