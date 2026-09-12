package protocol

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

func mustParseX509Certificate(der []byte) *x509.Certificate {
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		panic(err)
	}

	return cert
}

func mustParseX509CertificatePEM(raw []byte) *x509.Certificate {
	block, rest := pem.Decode(raw)
	if len(rest) > 0 || block == nil || block.Type != "CERTIFICATE" {
		panic("Invalid PEM Certificate")
	}

	return mustParseX509Certificate(block.Bytes)
}

func attStatementParseX5CS(attStatement map[string]any, key string) (x5c []any, x5cs []*x509.Certificate, err error) {
	var ok bool
	if x5c, ok = attStatement[key].([]any); !ok {
		return nil, nil, ErrAttestationFormat.WithDetails("Error retrieving x5c value")
	}

	if len(x5c) == 0 {
		return nil, nil, ErrAttestationFormat.WithDetails("Error retrieving x5c value: empty array")
	}

	if x5cs, err = parseX5C(x5c); err != nil {
		return nil, nil, ErrAttestationFormat.WithDetails("Error retrieving x5c value: error occurred parsing values").WithError(err)
	}

	return x5c, x5cs, nil
}

func parseX5C(x5c []any) (x5cs []*x509.Certificate, err error) {
	x5cs = make([]*x509.Certificate, len(x5c))

	var (
		raw []byte
		ok  bool
	)

	for i, t := range x5c {
		if raw, ok = t.([]byte); !ok {
			return nil, fmt.Errorf("x5c[%d] is not a byte array", i)
		}

		if x5cs[i], err = x509.ParseCertificate(raw); err != nil {
			return nil, fmt.Errorf("x5c[%d] is not a valid certificate: %w", i, err)
		}
	}

	return x5cs, nil
}

// attStatementCertChainVerify allows verifying an attestation statement certificate chain and optionally allows
// mangling the not after value for purpose of just validating the attestation lineage. If you set mangleNotAfter to
// true this function should only be considered safe for determining lineage, and not hte validity of a chain in
// general.
//
// WARNING: Setting mangleNotAfter=true weakens security by accepting expired certificates.
func attStatementCertChainVerify(certs []*x509.Certificate, roots *x509.CertPool, mangleNotAfter bool, mangleNotAfterSafeTime time.Time) (chains [][]*x509.Certificate, err error) {
	if len(certs) == 0 {
		return nil, errors.New("empty chain")
	}

	leaf := certs[0]

	for _, cert := range certs {
		if !cert.IsCA {
			leaf = certInsecureConditionalNotAfterMangle(cert, mangleNotAfter, mangleNotAfterSafeTime)

			break
		}
	}

	var (
		intermediates *x509.CertPool
	)

	staticRoots := roots != nil

	intermediates = x509.NewCertPool()

	if roots == nil {
		if roots, err = x509.SystemCertPool(); err != nil || roots == nil {
			roots = x509.NewCertPool()
		}
	}

	for _, cert := range certs {
		if cert == leaf {
			continue
		}

		if isSelfSigned(cert) && !staticRoots {
			roots.AddCert(certInsecureConditionalNotAfterMangle(cert, mangleNotAfter, mangleNotAfterSafeTime))
		} else {
			intermediates.AddCert(certInsecureConditionalNotAfterMangle(cert, mangleNotAfter, mangleNotAfterSafeTime))
		}
	}

	opts := x509.VerifyOptions{
		Roots:         roots,
		Intermediates: intermediates,
	}

	return leaf.Verify(opts)
}

func isSelfSigned(c *x509.Certificate) bool {
	if !c.IsCA {
		return false
	}

	return c.CheckSignatureFrom(c) == nil
}

// This function is used to intentionally mangle the certificates not after values to exclude them from
// the verification process. This should only be used in instances where all you care about is which certificates
// performed the signing.
func certsInsecureNotAfterMangle(certs []*x509.Certificate) (out []*x509.Certificate) {
	// Add 1 year to the current time. This is effectively the not after time which is used to determine which
	// certificates to mangle.
	safe := time.Now().Add(time.Hour * 8760).UTC()

	out = make([]*x509.Certificate, len(certs))

	for i, cert := range certs {
		out[i] = certInsecureNotAfterMangle(cert, safe)
	}

	return out
}

// This function is used to intentionally but conditionally mangle the certificate not after value to exclude it from
// the verification process. This should only be used in instances where all you care about is which certificates
// performed the signing.
//
// WARNING: Setting mangle=true weakens security by accepting expired certificates.
func certInsecureConditionalNotAfterMangle(cert *x509.Certificate, mangle bool, safe time.Time) (out *x509.Certificate) {
	if !mangle || cert.NotAfter.After(safe) {
		return cert
	}

	out = &x509.Certificate{}

	*out = *cert

	out.NotAfter = safe

	return out
}

// This function is used to intentionally mangle the certificate not after value to exclude it from
// the verification process. This should only be used in instances where all you care about is which certificates
// performed the signing.
func certInsecureNotAfterMangle(cert *x509.Certificate, safe time.Time) (out *x509.Certificate) {
	c := *cert

	out = &c

	if out.NotAfter.Before(safe) {
		out.NotAfter = safe
	}

	return out
}

func verifyAttestationECDSAPublicKeyMatch(att AttestationObject, cert *x509.Certificate) (attPublicKeyData webauthncose.EC2PublicKeyData, err error) {
	var (
		key any
		ok  bool

		publicKey, attPublicKey *ecdsa.PublicKey
	)

	if key, err = webauthncose.ParsePublicKey(att.AuthData.AttData.CredentialPublicKey); err != nil {
		return attPublicKeyData, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error parsing public key: %+v", err)).WithError(err)
	}

	if attPublicKeyData, ok = key.(webauthncose.EC2PublicKeyData); !ok {
		return attPublicKeyData, ErrInvalidAttestation.WithDetails("Attestation public key is not ECDSA")
	}

	if publicKey, ok = cert.PublicKey.(*ecdsa.PublicKey); !ok {
		return attPublicKeyData, ErrInvalidAttestation.WithDetails("Credential public key is not ECDSA")
	}

	if attPublicKey, err = attPublicKeyData.ToECDSA(); err != nil {
		return attPublicKeyData, ErrInvalidAttestation.WithDetails("Error converting public key to ECDSA").WithError(err)
	}

	if !attPublicKey.Equal(publicKey) {
		return attPublicKeyData, ErrInvalidAttestation.WithDetails("Certificate public key does not match public key in authData")
	}

	return attPublicKeyData, nil
}
