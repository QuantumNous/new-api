import { describe, expect, test } from 'vitest'
import { findRouteMatch, processRouteTree } from '../src/new-process-route-tree'

const testCases = [
  {
    name: 'param with braces',
    path: '/$id',
    nav: '/1',
    params: { id: '1' },
  },
  {
    name: 'param without braces',
    path: '/{$id}',
    nav: '/2',
    params: { id: '2' },
  },
  {
    name: 'param with prefix',
    path: '/prefix-{$id}',
    nav: '/prefix-3',
    params: { id: '3' },
  },
  {
    name: 'param with suffix',
    path: '/{$id}-suffix',
    nav: '/4-suffix',
    params: { id: '4' },
  },
  {
    name: 'param with prefix and suffix',
    path: '/prefix-{$id}-suffix',
    nav: '/prefix-5-suffix',
    params: { id: '5' },
  },
  {
    name: 'wildcard with no braces',
    path: '/abc/$',
    nav: '/abc/6',
    params: { '*': '6', _splat: '6' },
  },
  {
    name: 'wildcard with braces',
    path: '/abc/{$}',
    nav: '/abc/7',
    params: { '*': '7', _splat: '7' },
  },
  {
    name: 'wildcard with prefix',
    path: '/abc/prefix{$}',
    nav: '/abc/prefix/8',
    params: { '*': '/8', _splat: '/8' },
  },
  {
    name: 'wildcard with suffix',
    path: '/abc/{$}suffix',
    nav: '/abc/9/suffix',
    params: { _splat: '9/', '*': '9/' },
  },
  {
    name: 'optional param with no prefix/suffix and value',
    path: '/abc/{-$id}/def',
    nav: '/abc/10/def',
    params: { id: '10' },
  },
  {
    name: 'optional param with no prefix/suffix and requiredParam and no value',
    path: '/abc/{-$id}/$foo/def',
    nav: '/abc/bar/def',
    params: { foo: 'bar' },
  },
  {
    name: 'optional param with no prefix/suffix and requiredParam and value',
    path: '/abc/{-$id}/$foo/def',
    nav: '/abc/10/bar/def',
    params: { id: '10', foo: 'bar' },
  },
  {
    name: 'optional param with no prefix/suffix and no value',
    path: '/abc/{-$id}/def',
    nav: '/abc/def',
    params: {},
  },
  {
    name: 'optional param with prefix and value',
    path: '/optional-{-$id}',
    nav: '/optional-12',
    params: { id: '12' },
  },
  {
    name: 'optional param with prefix and no value',
    path: '/optional-{-$id}',
    nav: '/optional-',
    params: {},
  },
  {
    name: 'optional param with suffix and value',
    path: '/{-$id}-optional',
    nav: '/13-optional',
    params: { id: '13' },
  },
  {
    name: 'optional param with suffix and no value',
    path: '/{-$id}-optional',
    nav: '/-optional',
    params: {},
  },
  {
    name: 'optional param with required param, prefix, suffix, wildcard and no value',
    path: `/$foo/a{-$id}-optional/$`,
    nav: '/bar/a-optional/qux',
    params: { foo: 'bar', _splat: 'qux', '*': 'qux' },
  },
  {
    name: 'optional param with required param, prefix, suffix, wildcard and value',
    path: `/$foo/a{-$id}-optional/$`,
    nav: '/bar/a14-optional/qux',
    params: { foo: 'bar', id: '14', _splat: 'qux', '*': 'qux' },
  },
]

// porting tests from https://github.com/TanStack/router/pull/5851
describe('curly params smoke tests', () => {
  test.each(testCases)('$name', ({ path, nav, params }) => {
    const tree = {
      id: '__root__',
      isRoot: true,
      fullPath: '/',
      path: '/',
      children: [
        {
          id: path,
          fullPath: path,
          path: path,
        },
      ],
    }
    const processed = processRouteTree(tree)
    const res = findRouteMatch(nav, processed.processedTree)
    expect(res?.rawParams).toEqual(params)
  })
})
