# dns-packet
[![](https://img.shields.io/npm/v/dns-packet.svg?style=flat)](https://www.npmjs.org/package/dns-packet) [![](https://img.shields.io/npm/dm/dns-packet.svg)](https://www.npmjs.org/package/dns-packet) [![](https://github.com/github/mafintosh/dns-packet/workflows/ci.yml/badge.svg)](https://github.com/github/mafintosh/dns-packet/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/mafintosh/dns-packet/badge.svg?branch=master)](https://coveralls.io/github/mafintosh/dns-packet?branch=master)

An [abstract-encoding](https://github.com/mafintosh/abstract-encoding) compliant module for encoding / decoding DNS packets. Lifted out of [multicast-dns](https://github.com/mafintosh/multicast-dns) as a separate module.

```
npm install dns-packet
```

## UDP Usage

``` js
const dnsPacket = require('dns-packet')
const dgram = require('dgram')

const socket = dgram.createSocket('udp4')

const buf = dnsPacket.encode({
  type: 'query',
  id: 1,
  flags: dnsPacket.RECURSION_DESIRED,
  questions: [{
    type: 'A',
    name: 'google.com'
  }]
})

socket.on('message', message => {
  console.log(dnsPacket.decode(message)) // prints out a response from google dns
})

socket.send(buf, 0, buf.length, 53, '8.8.8.8')
```

Also see [the UDP example](examples/udp.js).

## TCP, TLS, HTTPS

While DNS has traditionally been used over a datagram transport, it is increasingly being carried over TCP for larger responses commonly including DNSSEC responses and TLS or HTTPS for enhanced security. See below examples on how to use `dns-packet` to wrap DNS packets in these protocols:

- [TCP](examples/tcp.js)
- [DNS over TLS](examples/tls.js)
- [DNS over HTTPS](examples/doh.js)

## API

#### `var buf = packets.encode(packet, [buf], [offset])`

Encodes a DNS packet into a buffer containing a UDP payload.

#### `var packet = packets.decode(buf, [offset])`

Decode a DNS packet from a buffer containing a UDP payload.

#### `var buf = packets.streamEncode(packet, [buf], [offset])`

Encodes a DNS packet into a buffer containing a TCP payload.

#### `var packet = packets.streamDecode(buf, [offset])`

Decode a DNS packet from a buffer containing a TCP payload.

#### `var len = packets.encodingLength(packet)`

Returns how many bytes are needed to encode the DNS packet

## Packets

Packets look like this

``` js
{
  type: 'query|response',
  id: optionalIdNumber,
  flags: optionalBitFlags,
  questions: [...],
  answers: [...],
  additionals: [...],
  authorities: [...]
}
```

The bit flags available are

``` js
packet.RECURSION_DESIRED
packet.RECURSION_AVAILABLE
packet.TRUNCATED_RESPONSE
packet.AUTHORITATIVE_ANSWER
packet.AUTHENTIC_DATA
packet.CHECKING_DISABLED
```

To use more than one flag bitwise-or them together

``` js
var flags = packet.RECURSION_DESIRED | packet.RECURSION_AVAILABLE
```

And to check for a flag use bitwise-and

``` js
var isRecursive = message.flags & packet.RECURSION_DESIRED
```

A question looks like this

``` js
{
  type: 'A', // or SRV, AAAA, etc
  class: 'IN', // one of IN, CS, CH, HS, ANY. Default: IN
  name: 'google.com' // which record are you looking for
}
```

And an answer, additional, or authority looks like this

``` js
{
  type: 'A', // or SRV, AAAA, etc
  class: 'IN', // one of IN, CS, CH, HS
  name: 'google.com', // which name is this record for
  ttl: optionalTimeToLiveInSeconds,
  (record specific data, see below)
}
```

## Supported record types

#### `A`

``` js
{
  data: 'IPv4 address' // fx 127.0.0.1
}
```

#### `AAAA`

``` js
{
  data: 'IPv6 address' // fx fe80::1
}
```

#### `CAA`

``` js
{
  flags: 128, // octet
  tag: 'issue|issuewild|iodef',
  value: 'ca.example.net',
  issuerCritical: false
}
```

#### `CNAME`

``` js
{
  data: 'cname.to.another.record'
}
```

#### `DNAME`

``` js
{
  data: 'dname.to.another.record'
}
```

#### `DNSKEY`

``` js
{
  flags: 257, // 16 bits
  algorithm: 1, // octet
  key: Buffer
}
```

#### `DS`

``` js
{
  keyTag: 12345,
  algorithm: 8,
  digestType: 1,
  digest: Buffer
}
```

#### `HINFO`

``` js
{
  data: {
    cpu: 'cpu info',
    os: 'os info'
  }
}
```

#### `MX`

``` js
{
  preference: 10,
  exchange: 'mail.example.net'
}
```

#### `NAPTR`

``` js
{
  data:
    {
      order: 100,
      preference: 10,
      flags: 's',
      services: 'SIP+D2U',
      regexp: '!^.*$!sip:customer-service@example.com!',
      replacement: '_sip._udp.example.com'
    }
}
```

#### `NS`

``` js
{
  data: nameServer
}
```

#### `NSEC`

``` js
{
  nextDomain: 'a.domain',
  rrtypes: ['A', 'TXT', 'RRSIG']
}
```

#### `NSEC3`

``` js
{
  algorithm: 1,
  flags: 0,
  iterations: 2,
  salt: Buffer,
  nextDomain: Buffer, // Hashed per RFC5155
  rrtypes: ['A', 'TXT', 'RRSIG']
}
```

#### `NULL`

``` js
{
  data: Buffer('any binary data')
}
```

#### `OPT`

[EDNS0](https://tools.ietf.org/html/rfc6891) options.

``` js
{
  type: 'OPT',
  name: '.',
  udpPayloadSize: 4096,
  flags: packet.DNSSEC_OK,
  options: [{
    // pass in any code/data for generic EDNS0 options
    code: 12,
    data: Buffer.alloc(31)
  }, {
    // Several EDNS0 options have enhanced support
    code: 'PADDING',
    length: 31,
  }, {
    code: 'CLIENT_SUBNET',
    family: 2, // 1 for IPv4, 2 for IPv6
    sourcePrefixLength: 64, // used to truncate IP address
    scopePrefixLength: 0,
    ip: 'fe80::',
  }, {
    code: 'TCP_KEEPALIVE',
    timeout: 150 // increments of 100ms.  This means 15s.
  }, {
    code: 'KEY_TAG',
    tags: [1, 2, 3],
  }]
}
```

The options `PADDING`, `CLIENT_SUBNET`, `TCP_KEEPALIVE` and `KEY_TAG` support enhanced de/encoding. See [optionscodes.js](https://github.com/mafintosh/dns-packet/blob/master/optioncodes.js) for all supported option codes. If the `data` property is present on a option, it takes precedence. On decoding, `data` will always be defined.

#### `PTR`

``` js
{
  data: 'points.to.another.record'
}
```

#### `RP`

``` js
{
  mbox: 'admin.example.com',
  txt: 'txt.example.com'
}
```

#### `SSHFP`

``` js
{
  algorithm: 1,
  hash: 1,
  fingerprint: 'A108C9F834354D5B37AF988141C9294822F5BC00'
}
````

#### `RRSIG`

``` js
{
  typeCovered: 'A',
  algorithm: 8,
  labels: 1,
  originalTTL: 3600,
  expiration: timestamp,
  inception: timestamp,
  keyTag: 12345,
  signersName: 'a.name',
  signature: Buffer
}
```

#### `SOA`

``` js
{
  data:
    {
      mname: domainName,
      rname: mailbox,
      serial: zoneSerial,
      refresh: refreshInterval,
      retry: retryInterval,
      expire: expireInterval,
      minimum: minimumTTL
    }
}
```

#### `SRV`

``` js
{
  data: {
    port: servicePort,
    target: serviceHostName,
    priority: optionalServicePriority,
    weight: optionalServiceWeight
  }
}
```

#### `TLSA`

``` js
{
  usage: 3,
  selector: 1,
  matchingType: 1,
  certificate: Buffer
}
```

#### `TXT`

``` js
{
  data: 'text' || Buffer || [ Buffer || 'text' ]
}
```

When encoding, scalar values are converted to an array and strings are converted to UTF-8 encoded Buffers. When decoding, the return value will always be an array of Buffer.

If you need another record type, open an issue and we'll try to add it.

## License

MIT
