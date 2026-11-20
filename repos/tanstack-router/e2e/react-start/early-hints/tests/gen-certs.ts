/**
 * Generate TLS certs for HTTP/2 testing
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const certDir = `${testDir}/.tmp/tls`

if (existsSync(`${certDir}/server.crt`)) {
  console.log('Certs already exist')
  process.exit(0)
}

const forge = await import('node-forge')
const { pki, md } = forge.default || forge

// Generate CA
const caKeys = pki.rsa.generateKeyPair(2048)
const caCert = pki.createCertificate()
caCert.publicKey = caKeys.publicKey
caCert.serialNumber = '01'
caCert.validity.notBefore = new Date()
caCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
caCert.setSubject([{ name: 'commonName', value: 'Test CA' }])
caCert.setIssuer(caCert.subject.attributes)
caCert.setExtensions([
  { name: 'basicConstraints', cA: true },
  { name: 'keyUsage', keyCertSign: true, digitalSignature: true },
  { name: 'subjectKeyIdentifier' },
])
caCert.sign(caKeys.privateKey, md.sha256.create())

// Generate server cert
const serverKeys = pki.rsa.generateKeyPair(2048)
const serverCert = pki.createCertificate()
serverCert.publicKey = serverKeys.publicKey
serverCert.serialNumber = '02'
serverCert.validity.notBefore = new Date()
serverCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
serverCert.setSubject([{ name: 'commonName', value: 'localhost' }])
serverCert.setIssuer(caCert.subject.attributes)
serverCert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
  { name: 'extKeyUsage', serverAuth: true },
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' },
    ],
  },
])
serverCert.sign(caKeys.privateKey, md.sha256.create())

await mkdir(certDir, { recursive: true })
await writeFile(`${certDir}/ca.crt`, pki.certificateToPem(caCert))
await writeFile(`${certDir}/server.crt`, pki.certificateToPem(serverCert))
await writeFile(
  `${certDir}/server.key`,
  pki.privateKeyToPem(serverKeys.privateKey),
)

console.log('Certs generated at', certDir)
