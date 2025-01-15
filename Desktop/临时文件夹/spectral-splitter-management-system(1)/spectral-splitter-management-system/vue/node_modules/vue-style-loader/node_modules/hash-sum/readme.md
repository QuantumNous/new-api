# hash-sum

> blazing fast unique hash generator

# install

```shell
npm i hash-sum -S
```

# features

- no dependencies
- minimal footprint
- works in all of node.js, io.js, and the browser
- hashes functions based on their source code
- produces different hashes for different object types
- support for circular references in objects
- ignores property assignment order

# `sum(value)`

yields a four-byte hexadecimal hash based off of `value`.

```
# creates unique hashes
 creates unique hashes
4d237d49 from: [ 0, 1, 2, 3 ]
766ec173 from: { url: 12 }
2f473108 from: { headers: 12 }
23308836 from: { headers: 122 }
062bce44 from: { headers: '122' }
acb9f66e from: { headers: { accept: 'text/plain' } }
1c365a2d from: { payload: [ 0, 1, 2, 3 ], headers: [ { a: 'b' } ] }
7319ae9d from: { a: [Function] }
8a3a0e86 from: { b: [Function] }
b6d7f5d4 from: { b: [Function] }
6c95fc65 from: function () {}
2941766e from: function (a) {}
294f8def from: function (b) {}
2d9c0cb8 from: function (a) { return a;}
ed5c63fc from: function (a) {return a;}
bba68bf6 from: ''
2d27667d from: 'null'
774b96ed from: 'false'
2d2a1684 from: 'true'
8daa1a0c from: '0'
8daa1a0a from: '1'
e38f07cc from: 'void 0'
6037ea1a from: 'undefined'
9b7df12e from: null
3c206f76 from: false
01e34ba8 from: true
1a96284a from: 0
1a96284b from: 1
29172c1a from: undefined
4505230f from: {}
3718c6e8 from: { a: {}, b: {} }
5d844489 from: []
938eaaf0 from: Tue Jul 14 2015 15:35:36 GMT-0300 (ART)
dfe5fb2e from: global
ok 1 should be equal
```

# license

MIT
