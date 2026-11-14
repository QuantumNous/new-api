package protocol

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mitchellh/mapstructure"

	"github.com/go-webauthn/webauthn/metadata"
)

// attestationFormatValidationHandlerAndroidSafetyNet is the handler for the Android SafetyNet Attestation Statement
// Format.
//
// When the authenticator is a platform authenticator on certain Android platforms, the attestation statement may be
// based on the SafetyNet API. In this case the authenticator data is completely controlled by the caller of the
// SafetyNet API (typically an application running on the Android platform) and the attestation statement provides some
// statements about the health of the platform and the identity of the calling application (see SafetyNet Documentation
// for more details).
//
// The syntax of an Android Attestation statement is defined as follows:
//
//	$$attStmtType //= (
//			fmt: "android-safetynet",
//			attStmt: safetynetStmtFormat
//	)
//
//	safetynetStmtFormat = {
//			ver: text,
//			response: bytes
//	}
//
// Specification: §8.5. Android SafetyNet Attestation Statement Format
//
// See: https://www.w3.org/TR/webauthn/#sctn-android-safetynet-attestation
func attestationFormatValidationHandlerAndroidSafetyNet(att AttestationObject, clientDataHash []byte, mds metadata.Provider) (attestationType string, x5cs []any, err error) {
	// The syntax of an Android Attestation statement is defined as follows:
	//     $$attStmtType //= (
	//                           fmt: "android-safetynet",
	//                           attStmt: safetynetStmtFormat
	//                       )

	//     safetynetStmtFormat = {
	//                               ver: text,
	//                               response: bytes
	//                           }

	// §8.5.1 Verify that attStmt is valid CBOR conforming to the syntax defined above and perform CBOR decoding on it to extract
	// the contained fields.

	// We have done this
	// §8.5.2 Verify that response is a valid SafetyNet response of version ver.
	version, present := att.AttStatement[stmtVersion].(string)
	if !present {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to find the version of SafetyNet")
	}

	if version == "" {
		return "", nil, ErrAttestationFormat.WithDetails("Not a proper version for SafetyNet")
	}

	// TODO: provide user the ability to designate their supported versions.

	response, present := att.AttStatement["response"].([]byte)
	if !present {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to find the SafetyNet response")
	}

	var token *jwt.Token

	if token, err = jwt.Parse(string(response), keyFuncSafetyNetJWT, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()})); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// marshall the JWT payload into the safetynet response json.
	var safetyNetResponse SafetyNetResponse

	if err = mapstructure.Decode(token.Claims, &safetyNetResponse); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails(fmt.Sprintf("Error parsing the SafetyNet response: %+v", err)).WithError(err)
	}

	// §8.5.3 Verify that the nonce in the response is identical to the Base64 encoding of the SHA-256 hash of the concatenation
	// of authenticatorData and clientDataHash.
	nonceBuffer := sha256.Sum256(append(att.RawAuthData, clientDataHash...))

	nonceBytes, err := base64.StdEncoding.DecodeString(safetyNetResponse.Nonce)
	if !bytes.Equal(nonceBuffer[:], nonceBytes) || err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails("Invalid nonce for in SafetyNet response").WithError(err)
	}

	// §8.5.4 Let attestationCert be the attestation certificate (https://www.w3.org/TR/webauthn/#attestation-certificate)
	certChain := token.Header[stmtX5C].([]any)
	l := make([]byte, base64.StdEncoding.DecodedLen(len(certChain[0].(string))))

	n, err := base64.StdEncoding.Decode(l, []byte(certChain[0].(string)))
	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	attestationCert, err := x509.ParseCertificate(l[:n])
	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// §8.5.5 Verify that attestationCert is issued to the hostname "attest.android.com".
	if err = attestationCert.VerifyHostname(attStatementAndroidSafetyNetHostname); err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// §8.5.6 Verify that the ctsProfileMatch attribute in the payload of response is true.
	if !safetyNetResponse.CtsProfileMatch {
		return "", nil, ErrInvalidAttestation.WithDetails("ctsProfileMatch attribute of the JWT payload is false")
	}

	if t := time.Unix(safetyNetResponse.TimestampMs/1000, 0); t.After(time.Now()) {
		// Zero tolerance for post-dated timestamps.
		return "", nil, ErrInvalidAttestation.WithDetails("SafetyNet response with timestamp after current time")
	} else if t.Before(time.Now().Add(-time.Minute)) {
		// Small tolerance for pre-dated timestamps.
		if mds != nil && mds.GetValidateEntry(context.Background()) {
			return "", nil, ErrInvalidAttestation.WithDetails("SafetyNet response with timestamp before one minute ago")
		}
	}

	// §8.5.7 If successful, return implementation-specific values representing attestation type Basic and attestation
	// trust path attestationCert.
	return string(metadata.BasicFull), nil, nil
}

func keyFuncSafetyNetJWT(token *jwt.Token) (key any, err error) {
	var (
		ok    bool
		raw   any
		chain []any
		first string
		der   []byte
		cert  *x509.Certificate
	)

	if raw, ok = token.Header[stmtX5C]; !ok {
		return nil, fmt.Errorf("jwt header missing x5c")
	}

	if chain, ok = raw.([]any); !ok || len(chain) == 0 {
		return nil, fmt.Errorf("jwt header x5c is not a non-empty array")
	}

	if first, ok = chain[0].(string); !ok || first == "" {
		return nil, fmt.Errorf("jwt header x5c[0] not a base64 string")
	}

	if der, err = base64.StdEncoding.DecodeString(first); err != nil {
		return nil, fmt.Errorf("decode x5c leaf: %w", err)
	}

	if cert, err = x509.ParseCertificate(der); err != nil {
		if cert != nil {
			return cert.PublicKey, fmt.Errorf("parse x5c leaf: %w", err)
		}

		return nil, fmt.Errorf("parse x5c leaf: %w", err)
	}

	return cert.PublicKey, nil
}

type SafetyNetResponse struct {
	Nonce                      string `json:"nonce"`
	TimestampMs                int64  `json:"timestampMs"`
	ApkPackageName             string `json:"apkPackageName"`
	ApkDigestSha256            string `json:"apkDigestSha256"`
	CtsProfileMatch            bool   `json:"ctsProfileMatch"`
	ApkCertificateDigestSha256 []any  `json:"apkCertificateDigestSha256"`
	BasicIntegrity             bool   `json:"basicIntegrity"`
}

func init() {
	RegisterAttestationFormat(AttestationFormatAndroidSafetyNet, attestationFormatValidationHandlerAndroidSafetyNet)
}
