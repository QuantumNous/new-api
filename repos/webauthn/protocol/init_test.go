package protocol

import "crypto/x509"

func init() {
	if attAndroidKeyHardwareRootsCertPool == nil {
		attAndroidKeyHardwareRootsCertPool = x509.NewCertPool()
	}

	attAndroidKeyHardwareRootsCertPool.AddCert(mustParseX509CertificatePEM([]byte(certificateAndroidKeyIntermediateFAKE1)))
	attAndroidKeyHardwareRootsCertPool.AddCert(mustParseX509CertificatePEM([]byte(certificateAndroidKeyIntermediateFAKE2)))
}
