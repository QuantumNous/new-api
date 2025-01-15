# @leichtgewicht/ip-codec

Small package to encode or decode IP addresses from buffers to strings.
Supports IPV4 and IPV6.

## Usage

The basics are straigthforward

```js
import { encode, decode, sizeOf, familyOf } from '@leichtgewicht/ip-codec'

const uint8Array = encode("127.0.0.1")
const str = decode(uint8Array)

try {
  switch sizeOf(str) {
    case 4: // IPv4
    case 16: // IPv6
  }
  switch familyOf(str) {
    case: 1: // IPv4
    case: 2: // IPv6
  }
} catch (err) {
  // Invalid IP
}
```

By default the library will work with Uint8Array's but you can bring your own buffer:

```js
const buf = Buffer.alloc(4)
encode('127.0.0.1', buf)
```

It is also possible to de-encode at a location inside a given buffer

```js
const buf = Buffer.alloc(10)
encode('127.0.0.1', buf, 4)
```

Allocation of a buffer may be difficult if you don't know what type the buffer:
you can pass in a generator to allocate it for you:

```js
encode('127.0.0.1', Buffer.alloc)
```

You can also de/encode ipv4 or ipv6 specifically:

```js
import { v4, v6 } from '@leichtgewicht/ip-codec'

v4.decode(v4.encode('127.0.0.1'))
v6.decode(v6.encode('::'))
```

## History

The code in this package was originally extracted from [node-ip](https://github.com/indutny/node-ip) and since improved.

Notable changes are the removal of the `Buffer` dependency and better support for detection of
formats and allocation of buffers.

## License

[MIT](./LICENSE)
