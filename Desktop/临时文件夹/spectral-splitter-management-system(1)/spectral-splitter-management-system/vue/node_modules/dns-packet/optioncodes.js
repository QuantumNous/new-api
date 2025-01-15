'use strict'

exports.toString = function (type) {
  switch (type) {
    // list at
    // https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-11
    case 1: return 'LLQ'
    case 2: return 'UL'
    case 3: return 'NSID'
    case 5: return 'DAU'
    case 6: return 'DHU'
    case 7: return 'N3U'
    case 8: return 'CLIENT_SUBNET'
    case 9: return 'EXPIRE'
    case 10: return 'COOKIE'
    case 11: return 'TCP_KEEPALIVE'
    case 12: return 'PADDING'
    case 13: return 'CHAIN'
    case 14: return 'KEY_TAG'
    case 26946: return 'DEVICEID'
  }
  if (type < 0) {
    return null
  }
  return `OPTION_${type}`
}

exports.toCode = function (name) {
  if (typeof name === 'number') {
    return name
  }
  if (!name) {
    return -1
  }
  switch (name.toUpperCase()) {
    case 'OPTION_0': return 0
    case 'LLQ': return 1
    case 'UL': return 2
    case 'NSID': return 3
    case 'OPTION_4': return 4
    case 'DAU': return 5
    case 'DHU': return 6
    case 'N3U': return 7
    case 'CLIENT_SUBNET': return 8
    case 'EXPIRE': return 9
    case 'COOKIE': return 10
    case 'TCP_KEEPALIVE': return 11
    case 'PADDING': return 12
    case 'CHAIN': return 13
    case 'KEY_TAG': return 14
    case 'DEVICEID': return 26946
    case 'OPTION_65535': return 65535
  }
  const m = name.match(/_(\d+)$/)
  if (m) {
    return parseInt(m[1], 10)
  }
  return -1
}
