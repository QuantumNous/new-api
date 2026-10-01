package protocol

import (
	"context"
	"crypto/x509"
	"fmt"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/metadata"
)

func ValidateMetadata(ctx context.Context, mds metadata.Provider, aaguid uuid.UUID, attestationType, attestationFormat string, x5cs []any) (protoErr *Error) {
	if mds == nil {
		return nil
	}

	if AttestationFormat(attestationFormat) == AttestationFormatNone {
		return nil
	}

	var (
		entry *metadata.Entry
		err   error
	)
	if entry, err = mds.GetEntry(ctx, aaguid); err != nil {
		return ErrMetadata.WithInfo(fmt.Sprintf("Failed to validate authenticator metadata for Authenticator Attestation GUID '%s'. Error occurred retreiving the metadata entry: %+v", aaguid, err))
	}

	if entry == nil {
		if aaguid == uuid.Nil && mds.GetValidateEntryPermitZeroAAGUID(ctx) {
			return nil
		}

		if mds.GetValidateEntry(ctx) {
			return ErrMetadata.WithInfo(fmt.Sprintf("Failed to validate authenticator metadata for Authenticator Attestation GUID '%s'. The authenticator has no registered metadata.", aaguid))
		}

		return nil
	}

	if attestationType != "" && mds.GetValidateAttestationTypes(ctx) {
		found := false

		for _, atype := range entry.MetadataStatement.AttestationTypes {
			if string(atype) == attestationType {
				found = true

				break
			}
		}

		if !found {
			return ErrMetadata.WithInfo(fmt.Sprintf("Failed to validate authenticator metadata for Authenticator Attestation GUID '%s'. The attestation type '%s' is not known to be used by this authenticator.", aaguid.String(), attestationType))
		}
	}

	if mds.GetValidateStatus(ctx) {
		if err = mds.ValidateStatusReports(ctx, entry.StatusReports); err != nil {
			return ErrMetadata.WithInfo(fmt.Sprintf("Failed to validate authenticator metadata for Authenticator Attestation GUID '%s'. Error occurred validating the authenticator status: %+v", aaguid, err))
		}
	}

	if mds.GetValidateTrustAnchor(ctx) {
		if len(x5cs) == 0 {
			return nil
		}

		var (
			x5c, parsed *x509.Certificate
			x5cis       []*x509.Certificate
			raw         []byte
			ok          bool
		)

		for i, x5cAny := range x5cs {
			if raw, ok = x5cAny.([]byte); !ok {
				return ErrMetadata.WithDetails(fmt.Sprintf("Failed to parse attestation certificate from x5c during attestation validation for Authenticator Attestation GUID '%s'.", aaguid)).WithInfo(fmt.Sprintf("The %s certificate in the attestation was type '%T' but '[]byte' was expected", loopOrdinalNumber(i), x5cAny))
			}

			if parsed, err = x509.ParseCertificate(raw); err != nil {
				return ErrMetadata.WithDetails(fmt.Sprintf("Failed to parse attestation certificate from x5c during attestation validation for Authenticator Attestation GUID '%s'.", aaguid)).WithInfo(fmt.Sprintf("Error returned from x509.ParseCertificate: %+v", err)).WithError(err)
			}

			if x5c == nil {
				x5c = parsed
			} else {
				x5cis = append(x5cis, parsed)
			}
		}

		if attestationType == string(metadata.AttCA) {
			if protoErr = tpmParseAIKAttCA(x5c, x5cis); protoErr != nil {
				return ErrMetadata.WithDetails(protoErr.Details).WithInfo(protoErr.DevInfo).WithError(protoErr)
			}
		}

		if x5c != nil && x5c.Subject.CommonName != x5c.Issuer.CommonName {
			if !entry.MetadataStatement.AttestationTypes.HasBasicFull() {
				return ErrMetadata.WithDetails(fmt.Sprintf("Failed to validate attestation statement signature during attestation validation for Authenticator Attestation GUID '%s'. Attestation was provided in the full format but the authenticator doesn't support the full attestation format.", aaguid))
			}

			if _, err = x5c.Verify(entry.MetadataStatement.Verifier(x5cis)); err != nil {
				return ErrMetadata.WithDetails(fmt.Sprintf("Failed to validate attestation statement signature during attestation validation for Authenticator Attestation GUID '%s'. The attestation certificate could not be verified due to an error validating the trust chain against the Metadata Service.", aaguid)).WithError(err)
			}
		}
	}

	return nil
}

func loopOrdinalNumber(n int) string {
	n++

	if n > 9 && n < 20 {
		return fmt.Sprintf("%dth", n)
	}

	switch n % 10 {
	case 1:
		return fmt.Sprintf("%dst", n)
	case 2:
		return fmt.Sprintf("%dnd", n)
	case 3:
		return fmt.Sprintf("%drd", n)
	default:
		return fmt.Sprintf("%dth", n)
	}
}
