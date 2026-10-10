// Licensed under BSD-3-Clause (this file only)
// Code adapted from https://github.com/fastify/secure-json-parse/blob/783fcb1b5434709466759847cec974381939673a/test/index.test.js
//
// Copyright (c) Vercel, Inc. (https://vercel.com)
// Copyright (c) 2019 The Fastify Team
// Copyright (c) 2019, Sideway Inc, and project contributors
// All rights reserved.
//
// The complete list of contributors can be found at:
// - https://github.com/hapijs/bourne/graphs/contributors
// - https://github.com/fastify/secure-json-parse/graphs/contributors
// - https://github.com/vercel/ai/commits/main/packages/provider-utils/src/secure-parse-json.test.ts
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { describe, it, expect } from 'vitest';
import { secureJsonParse } from './secure-json-parse';

describe('secureJsonParse', () => {
  it('parses object string', () => {
    expect(secureJsonParse('{"a": 5, "b": 6}')).toStrictEqual(
      JSON.parse('{"a": 5, "b": 6}'),
    );
  });

  it('parses null string', () => {
    expect(secureJsonParse('null')).toStrictEqual(JSON.parse('null'));
  });

  it('parses 0 string', () => {
    expect(secureJsonParse('0')).toStrictEqual(JSON.parse('0'));
  });

  it('parses string string', () => {
    expect(secureJsonParse('"X"')).toStrictEqual(JSON.parse('"X"'));
  });

  it('allows constructor property with non-object value', () => {
    expect(secureJsonParse('{ "constructor": "string value" }')).toStrictEqual({
      constructor: 'string value',
    });
  });

  it('allows constructor property with null value', () => {
    expect(secureJsonParse('{ "constructor": null }')).toStrictEqual({
      constructor: null,
    });
  });

  it('errors on constructor property', () => {
    const text =
      '{ "a": 5, "b": 6, "constructor": { "x": 7 }, "c": { "d": 0, "e": "text", "__proto__": { "y": 8 }, "f": { "g": 2 } } }';

    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });

  it('errors on proto property', () => {
    const text =
      '{ "a": 5, "b": 6, "__proto__": { "x": 7 }, "c": { "d": 0, "e": "text", "__proto__": { "y": 8 }, "f": { "g": 2 } } }';

    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });

  it('errors on unicode-escaped __proto__ property', () => {
    const text = '{ "\\u005f\\u005fproto__": { "isAdmin": true } }';
    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });

  it('errors on fully unicode-escaped __proto__ property', () => {
    const text =
      '{ "\\u005f\\u005f\\u0070\\u0072\\u006f\\u0074\\u006f\\u005f\\u005f": { "isAdmin": true } }';
    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });

  it('errors on unicode-escaped constructor property', () => {
    const text =
      '{ "\\u0063\\u006fnstructor": { "prototype": { "isAdmin": true } } }';
    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });

  it('errors on fully unicode-escaped constructor property', () => {
    const text =
      '{ "\\u0063\\u006f\\u006e\\u0073\\u0074\\u0072\\u0075\\u0063\\u0074\\u006f\\u0072": { "prototype": { "isAdmin": true } } }';
    expect(() => secureJsonParse(text)).toThrow(SyntaxError);
  });
});
