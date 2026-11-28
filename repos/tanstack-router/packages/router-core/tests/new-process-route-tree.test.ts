import { describe, expect, it } from 'vitest'
import {
  findFlatMatch,
  findRouteMatch,
  processRouteMasks,
  processRouteTree,
} from '../src/new-process-route-tree'
import type { AnyRoute, RouteMask } from '../src'

function makeTree(routes: Array<string>) {
  return processRouteTree({
    id: '__root__',
    isRoot: true,
    fullPath: '/',
    path: '/',
    children: routes.map((route) => ({
      id: route,
      fullPath: route,
      path: route,
    })),
  }).processedTree
}

describe('findRouteMatch', () => {
  describe('routesByPath', () => {
    it('uses exact route-template keys while matching duplicate bare aliases by insertion order', () => {
      const routeTree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/$id',
            fullPath: '/$id',
            path: '$id',
          },
          {
            id: '/{$id}',
            fullPath: '/{$id}',
            path: '{$id}',
          },
          {
            id: '/prefix{$id}',
            fullPath: '/prefix{$id}',
            path: 'prefix{$id}',
          },
        ],
      }

      const { processedTree, routesByPath } = processRouteTree(routeTree)

      expect(routesByPath['/$id']?.id).toBe('/$id')
      expect(routesByPath['/{$id}']?.id).toBe('/{$id}')
      expect(routesByPath['/prefix{$id}']?.id).toBe('/prefix{$id}')
      expect(findRouteMatch('/value', processedTree)?.route.id).toBe('/$id')
      expect(findRouteMatch('/prefixvalue', processedTree)?.route.id).toBe(
        '/prefix{$id}',
      )
    })
  })

  describe('priority', () => {
    describe('basic permutations priorities', () => {
      it('/static/static vs /static/dynamic', () => {
        const tree = makeTree(['/a/b', '/a/$b'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/b')
      })
      it('/static/static vs /static/optional', () => {
        const tree = makeTree(['/a/b', '/a/{-$b}'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/b')
      })
      it('/static/static vs /static/wildcard', () => {
        const tree = makeTree(['/a/b', '/a/$'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/b')
      })
      it('/static/dynamic vs /static/optional', () => {
        const tree = makeTree(['/a/$b', '/a/{-$b}'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/$b')
      })
      it('/static/dynamic vs /static/wildcard', () => {
        const tree = makeTree(['/a/$b', '/a/$'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/$b')
      })
      it('/static/optional vs /static/wildcard', () => {
        const tree = makeTree(['/a/{-$b}', '/a/$'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/{-$b}')
      })
    })

    describe('prefix / suffix priorities', () => {
      it('prefix+suffix dynamic wins over plain dynamic', () => {
        const tree = makeTree(['/a/b{$b}b', '/a/$b'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{$b}b')
      })
      it('prefix dynamic wins over plain dynamic', () => {
        const tree = makeTree(['/a/b{$b}', '/a/$b'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{$b}')
      })
      it('suffix dynamic wins over plain dynamic', () => {
        const tree = makeTree(['/a/{$b}b', '/a/$b'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/{$b}b')
      })

      it('prefix+suffix optional wins over plain optional', () => {
        const tree = makeTree(['/a/b{-$b}b', '/a/{-$b}'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{-$b}b')
      })
      it('prefix optional wins over plain optional', () => {
        const tree = makeTree(['/a/b{-$b}', '/a/{-$b}'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{-$b}')
      })
      it('suffix optional wins over plain optional', () => {
        const tree = makeTree(['/a/{-$b}b', '/a/{-$b}'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/{-$b}b')
      })

      it('prefix+suffix wildcard wins over plain wildcard', () => {
        const tree = makeTree(['/a/b{$}b', '/a/$'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{$}b')
      })
      it('prefix wildcard wins over plain wildcard', () => {
        const tree = makeTree(['/a/b{$}', '/a/$'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/b{$}')
      })
      it('suffix wildcard wins over plain wildcard', () => {
        const tree = makeTree(['/a/{$}b', '/a/$'])
        expect(findRouteMatch('/a/bbb', tree)?.route.id).toBe('/a/{$}b')
      })
    })

    describe('prefix / suffix lengths', () => {
      it('longer overlapping prefix wins over shorter prefix', () => {
        const tree = makeTree(['/a/b{$b}', '/a/bbbb{$b}'])
        expect(findRouteMatch('/a/bbbbb', tree)?.route.id).toBe('/a/bbbb{$b}')
      })
      it('longer overlapping suffix wins over shorter suffix', () => {
        const tree = makeTree(['/a/{$b}b', '/a/{$b}bbbb'])
        expect(findRouteMatch('/a/bbbbb', tree)?.route.id).toBe('/a/{$b}bbbb')
      })
      it('longer prefix and shorter suffix wins over shorter prefix and longer suffix', () => {
        const tree = makeTree(['/a/b{$b}bbb', '/a/bbb{$b}b'])
        expect(findRouteMatch('/a/bbbbb', tree)?.route.id).toBe('/a/bbb{$b}b')
      })
    })

    describe('root matches', () => {
      it('optional at the root matches /', () => {
        const tree = makeTree(['/{-$id}'])
        const res = findRouteMatch('/', tree)
        expect(res?.route.id).toBe('/{-$id}')
        expect(res?.rawParams).toEqual({})
      })
      it('wildcard at the root matches /', () => {
        const tree = makeTree(['/$'])
        const res = findRouteMatch('/', tree)
        expect(res?.route.id).toBe('/$')
        expect(res?.rawParams).toEqual({ '*': '', _splat: '' })
      })
      it('dynamic at the root DOES NOT match /', () => {
        const tree = makeTree(['/$id'])
        const res = findRouteMatch('/', tree)
        expect(res).toBeNull()
      })
    })

    describe('root matches with root index', () => {
      it('root index wins over root optional', () => {
        const tree = makeTree(['/', '/{-$id}'])
        const res = findRouteMatch('/', tree)
        expect(res?.route.id).toBe('/')
      })
      it('root index wins over root wildcard', () => {
        const tree = makeTree(['/', '/$'])
        const res = findRouteMatch('/', tree)
        expect(res?.route.id).toBe('/')
      })
      it('root index wins over root dynamic', () => {
        const tree = makeTree(['/', '/$id'])
        const res = findRouteMatch('/', tree)
        expect(res?.route.id).toBe('/')
      })
    })

    describe('edge-case variations', () => {
      it('/static/optional/static vs /static/dynamic/static', () => {
        const tree = makeTree(['/a/{-$b}/c', '/a/$b/c'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/$b/c')
      })
      it('/static/optional/dynamic vs /static/dynamic/static', () => {
        const tree = makeTree(['/a/{-$b}/$c', '/a/$b/c'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/$b/c')
      })
      it('/static/optional/static vs /static/dynamic', () => {
        const tree = makeTree(['/users/{-$org}/settings', '/users/$id'])
        expect(findRouteMatch('/users/settings', tree)?.route.id).toBe(
          '/users/{-$org}/settings',
        )
      })
      it('/optional/static/static vs /static/dynamic', () => {
        const tree = makeTree(['/{-$other}/posts/new', '/posts/$id'])
        expect(findRouteMatch('/posts/new', tree)?.route.id).toBe(
          '/{-$other}/posts/new',
        )
      })
      it('/optional/static/static vs /static/static', () => {
        const tree = makeTree(['/{-$other}/posts/new', '/posts/new'])
        expect(findRouteMatch('/posts/new', tree)?.route.id).toBe(
          '/{-$other}/posts/new',
        )
      })
      it('/optional/static/static/dynamic vs /static/dynamic/static/dynamic', () => {
        const tree = makeTree(['/{-$other}/posts/a/b/$c', '/posts/$a/b/$c'])
        expect(findRouteMatch('/posts/a/b/c', tree)?.route.id).toBe(
          '/{-$other}/posts/a/b/$c',
        )
      })
      it('chain of optional and static segments: favor earlier static segments', () => {
        const tree = makeTree([
          '/{-$a}/{-$b}/{-$c}/d/e',
          '/{-$a}/{-$b}/c/d/{-$e}',
        ])
        expect(findRouteMatch('/a/b/c/d/e', tree)?.route.id).toBe(
          '/{-$a}/{-$b}/c/d/{-$e}',
        )
      })
      it('chain of dynamic and static segments: favor earlier static segments', () => {
        const tree = makeTree(['/$a/$b/$c/d/e', '/$a/$b/c/d/$e'])
        expect(findRouteMatch('/a/b/c/d/e', tree)?.route.id).toBe(
          '/$a/$b/c/d/$e',
        )
      })

      it('a short wildcard match does not prevent a longer match', () => {
        const tree = makeTree(['/a/$', '/a/b/c/$'])
        expect(findRouteMatch('/a/b/c/d/e', tree)?.route.id).toBe('/a/b/c/$')
        expect(findRouteMatch('/a/d/e', tree)?.route.id).toBe('/a/$')
      })

      it('matching a single dynamic param is favored over matching any number of optional params', () => {
        const tree = makeTree(['/$a/z', '/{-$a}/{-$b}/{-$c}/{-$d}/{-$e}/z'])
        expect(findRouteMatch('/a/z', tree)?.route.id).toBe('/$a/z')
        expect(findRouteMatch('/a/b/z', tree)?.route.id).toBe(
          '/{-$a}/{-$b}/{-$c}/{-$d}/{-$e}/z',
        )
      })
      it('matching a single dynamic param is favored over matching any number of optional params (2)', () => {
        const tree = makeTree(['/{-$a}/$b', '/{-$a}'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/{-$a}/$b')
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/{-$a}/$b')
      })
      describe('optional param can be a route on its own, but matching a static or dynamic is preferred', () => {
        it('on its own', () => {
          const tree = makeTree(['/a/{-$b}/'])
          expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/{-$b}/')
        })
        it('vs dynamic sibling', () => {
          const tree = makeTree(['/a/{-$b}/', '/a/$b'])
          expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/$b')
        })
        it('vs dynamic child', () => {
          const tree = makeTree(['/a/{-$b}/', '/a/{-$b}/$c'])
          expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/{-$b}/$c')
        })
      })
      it('optional child vs. shorter route', () => {
        const tree = makeTree(['/a', '/a/{-$b}'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/{-$b}')

        // but index can still win over optional child
        const treeWithIndex = makeTree(['/a/', '/a/{-$b}'])
        expect(findRouteMatch('/a', treeWithIndex)?.route.id).toBe('/a/')
      })
      it('optional+static vs static+wildcard', () => {
        const tree = makeTree(['/{-$a}/b', '/a/$'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/$')
      })
      it('dynamic+static vs static+wildcard', () => {
        const tree = makeTree(['/$a/b', '/a/$'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/$')
      })
      it('dynamic+static+static vs static+wildcard', () => {
        const tree = makeTree(['/$a/b/c', '/a/$'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/$')
      })
      it('case-insensitive static+wildcard beats optional+static', () => {
        const tree = makeTree(['/{-$a}/bar', '/foo/$'])
        expect(findRouteMatch('/FOO/bar', tree)?.route.id).toBe('/foo/$')
      })
      it('static+optional+static vs static+static+wildcard', () => {
        const tree = makeTree(['/a/{-$b}/c', '/a/b/$'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/b/$')
      })
      it('static+optional+static vs static+static+dynamic', () => {
        const tree = makeTree(['/a/{-$b}/c/d', '/a/b/c/$d'])
        expect(findRouteMatch('/a/b/c/d', tree)?.route.id).toBe('/a/b/c/$d')
      })
      it('static+optional+static+static beats static+dynamic+static+optional', () => {
        const tree = makeTree(['/a/$b/c/{-$d}', '/a/{-$b}/c/d'])
        expect(findRouteMatch('/a/b/c/d', tree)?.route.id).toBe('/a/{-$b}/c/d')
      })
      it('static+dynamic+wildcard vs static+optional+static', () => {
        const tree = makeTree(['/a/$b/$', '/a/{-$b}/c'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/{-$b}/c')
      })
      it('static+dynamic+static vs static+dynamic+wildcard', () => {
        const tree = makeTree(['/a/$b/c', '/a/$b/$'])
        expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/a/$b/c')
      })
      it('prefix+suffix wildcard wins over prefix wildcard and plain wildcard', () => {
        const tree = makeTree(['/a/foo{$}bar', '/a/foo{$}', '/a/$'])
        expect(findRouteMatch('/a/fooxbar', tree)?.route.id).toBe(
          '/a/foo{$}bar',
        )
      })
      it('skipped optional keeps later static priority over wildcard', () => {
        const tree = makeTree(['/{-$a}/b/c', '/b/$'])
        expect(findRouteMatch('/b/c', tree)?.route.id).toBe('/{-$a}/b/c')
      })
      it('skipped optional aligns later static priority with wildcard siblings', () => {
        const tree = makeTree(['/{-$a}/b/{-$c}/d', '/b/c/$'])
        expect(findRouteMatch('/b/c/d', tree)?.route.id).toBe('/b/c/$')
      })
      it('optional child wins over empty wildcard at the same node', () => {
        const tree = makeTree(['/a/{-$b}', '/a/$'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/{-$b}')
      })
      it('optional+static vs static+optional', () => {
        const tree = makeTree(['/{-$a}/b', '/a/{-$b}'])
        expect(findRouteMatch('/a/b', tree)?.route.id).toBe('/a/{-$b}')
      })
    })
  })

  describe('trailing slashes (index routes)', () => {
    describe('static routes', () => {
      it('an index route can be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/a/'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/a/')
      })
      it('an index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/a/'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/')
      })
      it('a non-index route CANNOT be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/a'])
        expect(findRouteMatch('/a/', tree)).toBeNull()
      })
      it('a non-index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/a'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a')
      })
    })
    describe('dynamic routes', () => {
      it('an index route can be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/$a/'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/$a/')
      })
      it('an index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/$a/'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/$a/')
      })
      it('a non-index route CANNOT be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/$a'])
        expect(findRouteMatch('/a/', tree)).toBeNull()
      })
      it('a non-index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/$a'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/$a')
      })
    })
    describe('optional routes', () => {
      it('an index route can be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/{-$a}/'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/{-$a}/')
      })
      it('an index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/{-$a}/'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/{-$a}/')
      })
      it('a non-index route CANNOT be matched by a path with a trailing slash', () => {
        const tree = makeTree(['/{-$a}'])
        expect(findRouteMatch('/a/', tree)).toBeNull()
      })
      it('a non-index route can be matched by a path without a trailing slash', () => {
        const tree = makeTree(['/{-$a}'])
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/{-$a}')
      })
    })
  })

  describe('case sensitivity competition', () => {
    it('a case sensitive segment early on should not prevent a case insensitive match', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/Foo',
            fullPath: '/Foo',
            path: 'Foo',
            options: { caseSensitive: false },
            children: [
              {
                id: '/Foo/a',
                fullPath: '/Foo/a',
                path: '/a',
              },
            ],
          },
          {
            id: '/foo',
            fullPath: '/foo',
            path: 'foo',
            options: { caseSensitive: true },
            children: [
              {
                id: '/foo/b',
                fullPath: '/foo/b',
                path: 'b',
              },
            ],
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(findRouteMatch('/foo/a', processedTree)?.route.id).toBe('/Foo/a')
      expect(findRouteMatch('/foo/b', processedTree)?.route.id).toBe('/foo/b')
    })
    it('a case sensitive segment should have priority over a case insensitive one', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/FOO',
            fullPath: '/FOO',
            path: 'FOO',
            options: { caseSensitive: true },
          },
          {
            id: '/foo',
            fullPath: '/foo',
            path: 'foo',
            options: { caseSensitive: false },
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(findRouteMatch('/FOO', processedTree)?.route.id).toBe('/FOO')
      expect(findRouteMatch('/Foo', processedTree)?.route.id).toBe('/foo')
      expect(findRouteMatch('/foo', processedTree)?.route.id).toBe('/foo')
    })
    it('a case sensitive prefix/suffix should have priority over a case insensitive one', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/aa{$id}bb',
            fullPath: '/aa{$id}bb',
            path: 'aa{$id}bb',
            options: { caseSensitive: false },
          },
          {
            id: '/A{$id}B',
            fullPath: '/A{$id}B',
            path: 'A{$id}B',
            options: { caseSensitive: true },
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(findRouteMatch('/AfooB', processedTree)?.route.id).toBe('/A{$id}B')
      expect(findRouteMatch('/AAABBB', processedTree)?.route.id).toBe(
        '/A{$id}B',
      )
    })
  })

  describe('basic matching', () => {
    it('root itself cannot match', () => {
      const tree = makeTree([])
      expect(findRouteMatch('/', tree)).toBeNull()
    })
    it('single static', () => {
      const tree = makeTree(['/a'])
      expect(findRouteMatch('/a', tree)?.route.id).toBe('/a')
    })
    it('single dynamic', () => {
      const tree = makeTree(['/$id'])
      expect(findRouteMatch('/123', tree)?.route.id).toBe('/$id')
    })
    it('single optional', () => {
      const tree = makeTree(['/{-$id}'])
      expect(findRouteMatch('/123', tree)?.route.id).toBe('/{-$id}')
      expect(findRouteMatch('/', tree)?.route.id).toBe('/{-$id}')
    })
    it('single wildcard', () => {
      const tree = makeTree(['/$'])
      expect(findRouteMatch('/a/b/c', tree)?.route.id).toBe('/$')
    })

    describe('prefix / suffix variations', () => {
      it('dynamic w/ prefix', () => {
        const tree = makeTree(['/{$id}.txt'])
        expect(findRouteMatch('/123.txt', tree)?.route.id).toBe('/{$id}.txt')
      })
      it('dynamic w/ suffix', () => {
        const tree = makeTree(['/file{$id}'])
        expect(findRouteMatch('/file123', tree)?.route.id).toBe('/file{$id}')
      })
      it('dynamic w/ prefix and suffix', () => {
        const tree = makeTree(['/file{$id}.txt'])
        expect(findRouteMatch('/file123.txt', tree)?.route.id).toBe(
          '/file{$id}.txt',
        )
      })
      it('optional w/ prefix', () => {
        const tree = makeTree(['/{-$id}.txt'])
        expect(findRouteMatch('/123.txt', tree)?.route.id).toBe('/{-$id}.txt')
        expect(findRouteMatch('/.txt', tree)?.route.id).toBe('/{-$id}.txt')
      })
      it('optional w/ suffix', () => {
        const tree = makeTree(['/file{-$id}'])
        expect(findRouteMatch('/file123', tree)?.route.id).toBe('/file{-$id}')
        expect(findRouteMatch('/file', tree)?.route.id).toBe('/file{-$id}')
      })
      it('optional w/ prefix and suffix', () => {
        const tree = makeTree(['/file{-$id}.txt'])
        expect(findRouteMatch('/file123.txt', tree)?.route.id).toBe(
          '/file{-$id}.txt',
        )
        expect(findRouteMatch('/file.txt', tree)?.route.id).toBe(
          '/file{-$id}.txt',
        )
      })
    })

    it('optional at the end can still be omitted', () => {
      const tree = makeTree(['/a/{-$id}'])
      expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/{-$id}')
    })
    it('multiple optionals at the end can still be omitted', () => {
      const tree = makeTree(['/a/{-$b}/{-$c}/{-$d}'])
      expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/{-$b}/{-$c}/{-$d}')
    })
    it('multiple optionals at the end -> favor earlier segments', () => {
      const tree = makeTree(['/a/{-$b}/{-$c}/{-$d}/{-$e}'])
      expect(findRouteMatch('/a/b/c', tree)?.rawParams).toEqual({
        b: 'b',
        c: 'c',
      })
    })
    it('optional and wildcard at the end can still be omitted', () => {
      const tree = makeTree(['/a/{-$id}/$'])
      const result = findRouteMatch('/a', tree)
      expect(result?.route.id).toBe('/a/{-$id}/$')
      expect(result?.rawParams).toEqual({ '*': '', _splat: '' })
    })
    it('multi-segment wildcard w/ prefix', () => {
      const tree = makeTree(['/file{$}'])
      expect(findRouteMatch('/file/a/b/c', tree)?.route.id).toBe('/file{$}')
    })
    it('multi-segment wildcard w/ suffix', () => {
      const tree = makeTree(['/{$}/c/file'])
      expect(findRouteMatch('/a/b/c/file', tree)?.route.id).toBe('/{$}/c/file')
    })
    it('multi-segment wildcard w/ prefix and suffix', () => {
      const tree = makeTree(['/file{$}end'])
      expect(findRouteMatch('/file/a/b/c/end', tree)?.route.id).toBe(
        '/file{$}end',
      )
    })

    it('edge-case: a single required param early on doesnt prevent another match further down', () => {
      const tree = makeTree(['/$one/a/b', '/$two/a/c'])
      expect(findRouteMatch('/1/a/b', tree)?.route.id).toBe('/$one/a/b')
      expect(findRouteMatch('/2/a/c', tree)?.route.id).toBe('/$two/a/c')
    })
    it('edge-case: a single static param early on doesnt prevent another match further down', () => {
      const tree = makeTree(['/x/y/z', '/$id/y/w'])
      expect(findRouteMatch('/x/y/z', tree)?.route.id).toBe('/x/y/z')
      expect(findRouteMatch('/x/y/w', tree)?.route.id).toBe('/$id/y/w')
    })
    it('edge-case: presence of a valid wildcard doesnt prevent other matches', () => {
      const tree = makeTree(['/yo/foo{-$id}bar/ma', '/yo/$'])
      const absent = findRouteMatch('/yo/foobar/ma', tree)
      expect(absent?.route.id).toBe('/yo/foo{-$id}bar/ma')
      const present = findRouteMatch('/yo/foo123bar/ma', tree)
      expect(present?.route.id).toBe('/yo/foo{-$id}bar/ma')
    })
    it('edge-case: deeper optional chain vs. shallower optional chain', () => {
      // This test comes from the previous processRouteTree tests.
      // > This demonstrates that `/foo/{-$p}/{-$x}.tsx` will be matched, not `/foo/{-$p}.tsx`
      // > This route has 2 optional parameter, making it more specific than the route with 1
      const tree = makeTree(['/foo/{-$p}.tsx', '/foo/{-$p}/{-$x}.tsx'])
      expect(findRouteMatch('/foo', tree)?.route.id).toBe(
        '/foo/{-$p}/{-$x}.tsx',
      )
      expect(findRouteMatch('/foo/bar.tsx', tree)?.route.id).toBe(
        '/foo/{-$p}/{-$x}.tsx',
      )

      // but index can still win over deeper optional chain
      const treeWithIndex = makeTree([
        '/foo/{-$p}.tsx/',
        '/foo/{-$p}/{-$x}.tsx',
      ])
      expect(findRouteMatch('/foo/', treeWithIndex)?.route.id).toBe(
        '/foo/{-$p}.tsx/',
      )
    })

    it('edge-case: two competing nodes at the same depth still produce a valid segment tree', () => {
      // this case is not easy to explain, but at some point in the implementation
      // the presence of `/a/c/{$foo}suffix` made `processRouteTree` assign an incorrect `depth`
      // value to the `/a/b/$` node, causing the params extraction to return incorrect results.
      const tree = {
        id: '__root__',
        fullPath: '/',
        path: '/',
        isRoot: true,
        children: [
          {
            id: '/a/c/{$foo}suffix',
            fullPath: '/a/c/{$foo}suffix',
            path: 'a/c/{$foo}suffix',
          },
          {
            id: '/a/b/$',
            fullPath: '/a/b/$',
            path: 'a/b/$',
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      const res = findRouteMatch('/a/b/foo', processedTree, true)
      expect(res?.route.id).toBe('/a/b/$')
      expect(res?.rawParams).toEqual({ _splat: 'foo', '*': 'foo' })
    })
    describe('edge-case #5969: trailing empty wildcard should match', () => {
      it('basic', () => {
        const tree = makeTree(['/a/$'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/a/$')
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/$')
      })
      it('with layout route', () => {
        const tree = makeTree(['/a', '/a/$'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/a/$')
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/$')
      })
      it('with index route (should not match)', () => {
        const tree = makeTree(['/a/', '/a/$'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe('/a/')
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/a/')
      })
      it('edge-case: deeper index route through skipped optional segments (should not match)', () => {
        const tree = makeTree(['/{-$foo}/{-$bar}/a/', '/a/$'])
        expect(findRouteMatch('/a/', tree)?.route.id).toBe(
          '/{-$foo}/{-$bar}/a/',
        )
        expect(findRouteMatch('/a', tree)?.route.id).toBe('/{-$foo}/{-$bar}/a/')
      })
    })
  })

  describe('nested routes', () => {
    const routeTree = {
      id: '__root__',
      isRoot: true,
      fullPath: '/',
      path: '/',
      children: [
        {
          id: '/a',
          fullPath: '/a',
          path: 'a',
          children: [
            {
              id: '/a/b',
              fullPath: '/a/b',
              path: '/b',
              children: [
                {
                  id: '/a/b/c/d',
                  fullPath: '/a/b/c/d',
                  path: '/c/d',
                },
              ],
            },
          ],
        },
      ],
    }
    const { processedTree } = processRouteTree(routeTree)
    it('matches the deepest route', () => {
      expect(findRouteMatch('/a/b/c/d', processedTree)?.route.id).toBe(
        '/a/b/c/d',
      )
    })
    it('matches an intermediate route', () => {
      expect(findRouteMatch('/a/b', processedTree)?.route.id).toBe('/a/b')
    })
    it('matches the root child route', () => {
      expect(findRouteMatch('/a', processedTree)?.route.id).toBe('/a')
    })
    it('nothing can match the root route', () => {
      expect(findRouteMatch('/', processedTree)).toBeNull()
    })
    it('does not match a route that doesnt exist', () => {
      expect(findRouteMatch('/a/b/c', processedTree)).toBeNull()
    })
  })

  describe('not found / fuzzy matching', () => {
    it('returns null when no match is found', () => {
      const tree = makeTree(['/', '/a/b/c', '/d/e/f'])
      expect(findRouteMatch('/x/y/z', tree)).toBeNull()
    })

    it('cannot consider the root route as a fuzzy match', () => {
      const tree = makeTree(['/', '/a/b/c', '/d/e/f'])
      const match = findRouteMatch('/x/y/z', tree, true)
      expect(match).toBeNull()
    })

    it('finds the greatest partial match', () => {
      const tree = makeTree(['/a/b/c', '/a/b', '/a'])
      const match = findRouteMatch('/a/b/x/y', tree, true)
      expect(match?.route?.id).toBe('/a/b')
      expect(match?.rawParams).toMatchInlineSnapshot(`
        {
          "**": "x/y",
        }
      `)
    })

    it('when both a layout route and an index route exist on the node that is fuzzy-matched, it uses the layout route', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/',
            fullPath: '/',
            path: '/',
          },
          {
            id: '/dashboard',
            fullPath: '/dashboard',
            path: 'dashboard',
            children: [
              {
                id: '/dashboard/',
                fullPath: '/dashboard/',
                path: '/',
              },
              {
                id: '/dashboard/invoices',
                fullPath: '/dashboard/invoices',
                path: 'invoices',
              },
              {
                id: '/dashboard/users',
                fullPath: '/dashboard/users',
                path: 'users',
              },
            ],
          },
          {
            id: '/_auth',
            fullPath: '/',
            children: [
              {
                id: '/_auth/profile',
                fullPath: '/profile',
                path: 'profile',
              },
            ],
          },
        ],
      }
      const processed = processRouteTree(tree)
      const match = findRouteMatch(
        '/dashboard/foo',
        processed.processedTree,
        true,
      )
      expect(match?.route.id).toBe('/dashboard')
      expect(match?.rawParams).toEqual({ '**': 'foo' })
    })

    it('cannot use an index route as a fuzzy match', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/',
            fullPath: '/',
            path: '/',
          },
          {
            id: '/dashboard/',
            fullPath: '/dashboard/',
            path: 'dashboard/',
          },
          {
            id: '/dashboard/invoices',
            fullPath: '/dashboard/invoices',
            path: 'invoices',
          },
          {
            id: '/dashboard/users',
            fullPath: '/dashboard/users',
            path: 'users',
          },
        ],
      }
      const processed = processRouteTree(tree)
      const match = findRouteMatch(
        '/dashboard/foo',
        processed.processedTree,
        true,
      )
      expect(match).toBeNull()
    })

    it('edge-case: index route is not a child of layout route', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/',
            fullPath: '/',
            path: '/',
          },
          {
            id: '/dashboard/',
            fullPath: '/dashboard/',
            path: 'dashboard/',
          },
          {
            id: '/dashboard',
            fullPath: '/dashboard',
            path: 'dashboard',
          },
        ],
      }
      const processed = processRouteTree(tree)
      const match = findRouteMatch(
        '/dashboard/foo',
        processed.processedTree,
        true,
      )
      expect(match?.route.id).toBe('/dashboard')
      expect(match?.rawParams).toEqual({ '**': 'foo' })
      const actualMatch = findRouteMatch('/dashboard', processed.processedTree)
      expect(actualMatch?.route.id).toBe('/dashboard/')
    })

    it('uses an exact wildcard match instead of a fuzzy layout match', () => {
      const tree = makeTree(['/a', '/a/$'])
      const match = findRouteMatch('/a/b/c', tree, true)
      expect(match?.route.id).toBe('/a/$')
      expect(match?.rawParams).toEqual({ '*': 'b/c', _splat: 'b/c' })
    })

    it('falls back to fuzzy layout matching when wildcard params.parse returns false', () => {
      const tree = {
        id: '__root__',
        fullPath: '/',
        path: '/',
        isRoot: true,
        options: {},
        children: [
          {
            id: '/a',
            fullPath: '/a',
            path: 'a',
          },
          {
            id: '/a/$',
            fullPath: '/a/$',
            path: 'a/$',
            options: {
              params: {
                parse: () => {
                  return false
                },
              },
            },
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      const match = findRouteMatch('/a/b/c', processedTree, true)
      expect(match?.route.id).toBe('/a')
      expect(match?.rawParams).toEqual({ '**': 'b/c' })
    })

    it('falls back to exact layout matching when empty wildcard params.parse returns false', () => {
      const tree = {
        id: '__root__',
        fullPath: '/',
        path: '/',
        isRoot: true,
        options: {},
        children: [
          {
            id: '/a',
            fullPath: '/a',
            path: 'a',
          },
          {
            id: '/a/$',
            fullPath: '/a/$',
            path: 'a/$',
            options: {
              params: {
                parse: () => {
                  return false
                },
              },
            },
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(findRouteMatch('/a', processedTree)?.route.id).toBe('/a')
    })
  })

  describe('param extraction', () => {
    describe('URI decoding', () => {
      const URISyntaxCharacters = [
        [';', '%3B'],
        [',', '%2C'],
        ['/', '%2F'],
        ['?', '%3F'],
        [':', '%3A'],
        ['@', '%40'],
        ['&', '%26'],
        ['=', '%3D'],
        ['+', '%2B'],
        ['$', '%24'],
        ['#', '%23'],
        ['\\', '%5C'],
        ['%', '%25'],
      ] as const
      it.each(URISyntaxCharacters)(
        'decodes %s in dynamic params',
        (char, encoded) => {
          const tree = makeTree([`/a/$id`])
          const result = findRouteMatch(`/a/${encoded}`, tree)
          expect(result?.rawParams).toEqual({ id: char })
        },
      )
      it.each(URISyntaxCharacters)(
        'decodes %s in optional params',
        (char, encoded) => {
          const tree = makeTree([`/a/{-$id}`])
          const result = findRouteMatch(`/a/${encoded}`, tree)
          expect(result?.rawParams).toEqual({ id: char })
        },
      )
      it.each(URISyntaxCharacters)(
        'decodes %s in wildcard params',
        (char, encoded) => {
          const tree = makeTree([`/a/$`])
          const result = findRouteMatch(`/a/${encoded}`, tree)
          expect(result?.rawParams).toEqual({ '*': char, _splat: char })
        },
      )
      it('wildcard splat supports multiple URI encoded characters in multiple URL segments', () => {
        const tree = makeTree([`/a/$`])
        const path = URISyntaxCharacters.map(([, encoded]) => encoded).join('/')
        const decoded = URISyntaxCharacters.map(([char]) => char).join('/')
        const result = findRouteMatch(`/a/${path}`, tree)
        expect(result?.rawParams).toEqual({ '*': decoded, _splat: decoded })
      })
      it('fuzzy splat supports multiple URI encoded characters in multiple URL segments', () => {
        const tree = makeTree(['/a'])
        const path = URISyntaxCharacters.map(([, encoded]) => encoded).join('/')
        const decoded = URISyntaxCharacters.map(([char]) => char).join('/')
        const result = findRouteMatch(`/a/${path}`, tree, true)
        expect(result?.rawParams).toEqual({ '**': decoded })
      })
    })
    describe('edge-cases', () => {
      it('#6012: optional index at root with param extraction', () => {
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/{-$year}/{-$month}/{-$day}',
              fullPath: '/{-$year}/{-$month}/{-$day}',
              path: '{-$year}/{-$month}/{-$day}',
              isRoot: false,
              options: {},
            },
            {
              id: '/_pathless/{-$language}/',
              fullPath: '/{-$language}/',
              path: '{-$language}/',
              isRoot: false,
              options: {},
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch(`/sv`, processedTree)
        expect(result?.route.id).toBe('/_pathless/{-$language}/')
        expect(result?.rawParams).toEqual({ language: 'sv' })
      })
      it('skipped optional, ends with wildcard', () => {
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/{-$foo}/bar/$',
              fullPath: '/{-$foo}/bar/$',
              path: '{-$foo}/bar/$',
              isRoot: false,
              options: {},
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch(`/bar/rest`, processedTree)
        expect(result?.route.id).toBe('/{-$foo}/bar/$')
        expect(result?.rawParams).toEqual({ '*': 'rest', _splat: 'rest' })
      })
      it('validates a stacked wildcard route once', () => {
        let calls = 0
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    calls++
                    return params
                  },
                },
              },
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/rest', processedTree)
        expect(result?.route.id).toBe('/a/$')
        expect(result?.rawParams).toEqual({ '*': 'rest', _splat: 'rest' })
        expect(calls).toBe(1)
      })
      it('can fall back to a lower-priority wildcard when wildcard params.parse returns false', () => {
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/foo{$}',
              fullPath: '/a/foo{$}',
              path: 'a/foo{$}',
              isRoot: false,
              options: {
                params: {
                  parse: () => {
                    return false
                  },
                },
              },
            },
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {},
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/foobar', processedTree)
        expect(result?.route.id).toBe('/a/$')
        expect(result?.rawParams).toEqual({ '*': 'foobar', _splat: 'foobar' })
      })
      it('falls back to the next matching wildcard by priority when the best wildcard params.parse returns false', () => {
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/foo{$}bar',
              fullPath: '/a/foo{$}bar',
              path: 'a/foo{$}bar',
              isRoot: false,
              options: {
                params: {
                  parse: () => {
                    return false
                  },
                },
              },
            },
            {
              id: '/a/foo{$}',
              fullPath: '/a/foo{$}',
              path: 'a/foo{$}',
              isRoot: false,
              options: {},
            },
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {},
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/fooxbar', processedTree)
        expect(result?.route.id).toBe('/a/foo{$}')
        expect(result?.rawParams).toEqual({ '*': 'xbar', _splat: 'xbar' })
      })
      it('does not validate a lower-priority wildcard after a better wildcard matches', () => {
        let higherPriorityCalls = 0
        let lowerPriorityCalls = 0
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/foo{$}',
              fullPath: '/a/foo{$}',
              path: 'a/foo{$}',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    higherPriorityCalls++
                    return params
                  },
                },
              },
            },
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    lowerPriorityCalls++
                    return params
                  },
                },
              },
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/foobar', processedTree)
        expect(result?.route.id).toBe('/a/foo{$}')
        expect(result?.rawParams).toEqual({ '*': 'bar', _splat: 'bar' })
        expect(higherPriorityCalls).toBe(1)
        expect(lowerPriorityCalls).toBe(0)
      })
      it('does not validate wildcard fallback after a static sibling matches', () => {
        let calls = 0
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/b',
              fullPath: '/a/b',
              path: 'a/b',
              isRoot: false,
              options: {},
            },
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    calls++
                    return params
                  },
                },
              },
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/b', processedTree)
        expect(result?.route.id).toBe('/a/b')
        expect(calls).toBe(0)
      })
      it('does not validate empty wildcard fallback after an index sibling matches', () => {
        let calls = 0
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/',
              fullPath: '/a/',
              path: 'a/',
              isRoot: false,
              options: {},
            },
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    calls++
                    return params
                  },
                },
              },
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a', processedTree)
        expect(result?.route.id).toBe('/a/')
        expect(calls).toBe(0)
      })
      it('passes wildcard raw params to params.parse', () => {
        let parsedParams: Record<string, string> | undefined
        const tree = {
          id: '__root__',
          fullPath: '/',
          path: '/',
          isRoot: true,
          options: {},
          children: [
            {
              id: '/a/$',
              fullPath: '/a/$',
              path: 'a/$',
              isRoot: false,
              options: {
                params: {
                  parse: (params: Record<string, string>) => {
                    parsedParams = params
                    return { length: params._splat!.length }
                  },
                },
              },
            },
          ],
        }
        const { processedTree } = processRouteTree(tree)
        const result = findRouteMatch('/a/foo/bar', processedTree)
        expect(result?.route.id).toBe('/a/$')
        expect(result?.rawParams).toEqual({ '*': 'foo/bar', _splat: 'foo/bar' })
        expect(parsedParams).toEqual({ '*': 'foo/bar', _splat: 'foo/bar' })
      })
    })
  })
  describe('pathless routes', () => {
    it('pathless nodes do not shift positional priority scores', () => {
      const tree = {
        id: '__root__',
        fullPath: '/',
        path: '/',
        isRoot: true,
        children: [
          {
            id: '/_layout',
            fullPath: '/',
            children: [
              {
                id: '/_layout/a/b',
                fullPath: '/a/b',
                path: 'a/b',
              },
            ],
          },
          {
            id: '/a/$',
            fullPath: '/a/$',
            path: 'a/$',
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(findRouteMatch('/a/b', processedTree)?.route.id).toBe(
        '/_layout/a/b',
      )
    })
    it('builds segment tree correctly', () => {
      const tree = {
        path: '/',
        isRoot: true,
        id: '__root__',
        fullPath: '/',
        children: [
          {
            path: '/',
            id: '/',
            fullPath: '/',
            options: {},
          },
          {
            id: '/$foo/_layout',
            path: '$foo',
            fullPath: '/$foo',
            options: {
              params: { parse: (params: Record<string, string>) => params },
            },
            children: [
              {
                id: '/$foo/_layout/bar',
                path: 'bar',
                fullPath: '/$foo/bar',
                options: {},
              },
              {
                id: '/$foo/_layout/',
                path: '/',
                fullPath: '/$foo/',
                options: {},
              },
            ],
          },
          {
            id: '/$foo/hello',
            path: '$foo/hello',
            fullPath: '/$foo/hello',
            options: {},
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      expect(processedTree.segmentTree).toMatchInlineSnapshot(`
        {
          "depth": 0,
          "dynamic": [
            {
              "caseSensitive": false,
              "depth": 1,
              "dynamic": null,
              "fullPath": "/$foo",
              "index": null,
              "kind": 1,
              "optional": null,
              "parent": [Circular],
              "parse": null,
              "pathless": [
                {
                  "depth": 2,
                  "dynamic": null,
                  "fullPath": "/$foo",
                  "index": {
                    "depth": 3,
                    "dynamic": null,
                    "fullPath": "/$foo/",
                    "index": null,
                    "kind": 4,
                    "optional": null,
                    "parent": [Circular],
                    "parse": null,
                    "pathless": null,
                    "priority": 0,
                    "route": {
                      "fullPath": "/$foo/",
                      "id": "/$foo/_layout/",
                      "options": {},
                      "path": "/",
                    },
                    "static": null,
                    "staticInsensitive": null,
                    "wildcard": null,
                  },
                  "kind": 5,
                  "optional": null,
                  "parent": [Circular],
                  "parse": [Function],
                  "pathless": null,
                  "priority": 0,
                  "route": {
                    "children": [
                      {
                        "fullPath": "/$foo/bar",
                        "id": "/$foo/_layout/bar",
                        "options": {},
                        "path": "bar",
                      },
                      {
                        "fullPath": "/$foo/",
                        "id": "/$foo/_layout/",
                        "options": {},
                        "path": "/",
                      },
                    ],
                    "fullPath": "/$foo",
                    "id": "/$foo/_layout",
                    "options": {
                      "params": {
                        "parse": [Function],
                      },
                    },
                    "path": "$foo",
                  },
                  "static": null,
                  "staticInsensitive": Map {
                    "bar" => {
                      "depth": 3,
                      "dynamic": null,
                      "fullPath": "/$foo/bar",
                      "index": null,
                      "kind": 0,
                      "optional": null,
                      "parent": [Circular],
                      "parse": null,
                      "pathless": null,
                      "priority": 0,
                      "route": {
                        "fullPath": "/$foo/bar",
                        "id": "/$foo/_layout/bar",
                        "options": {},
                        "path": "bar",
                      },
                      "static": null,
                      "staticInsensitive": null,
                      "wildcard": null,
                    },
                  },
                  "wildcard": null,
                },
              ],
              "prefix": undefined,
              "priority": 0,
              "route": null,
              "static": null,
              "staticInsensitive": Map {
                "hello" => {
                  "depth": 2,
                  "dynamic": null,
                  "fullPath": "/$foo/hello",
                  "index": null,
                  "kind": 0,
                  "optional": null,
                  "parent": [Circular],
                  "parse": null,
                  "pathless": null,
                  "priority": 0,
                  "route": {
                    "fullPath": "/$foo/hello",
                    "id": "/$foo/hello",
                    "options": {},
                    "path": "$foo/hello",
                  },
                  "static": null,
                  "staticInsensitive": null,
                  "wildcard": null,
                },
              },
              "suffix": undefined,
              "wildcard": null,
            },
          ],
          "fullPath": "/",
          "index": {
            "depth": 1,
            "dynamic": null,
            "fullPath": "/",
            "index": null,
            "kind": 4,
            "optional": null,
            "parent": [Circular],
            "parse": null,
            "pathless": null,
            "priority": 0,
            "route": {
              "fullPath": "/",
              "id": "/",
              "options": {},
              "path": "/",
            },
            "static": null,
            "staticInsensitive": null,
            "wildcard": null,
          },
          "kind": 0,
          "optional": null,
          "parent": null,
          "parse": null,
          "pathless": null,
          "priority": 0,
          "route": null,
          "static": null,
          "staticInsensitive": null,
          "wildcard": null,
        }
      `)
    })
    it('does not consume a path segment during param extraction', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/$foo/_layout',
            fullPath: '/$foo',
            path: '$foo',
            options: {
              params: {
                parse: (params: Record<string, string>) => params,
              },
              // force the creation of a pathless node
            },
            children: [
              {
                id: '/$foo/_layout/$bar',
                fullPath: '/$foo/$bar',
                path: '$bar',
                options: {},
              },
            ],
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      const result = findRouteMatch('/abc/def', processedTree)
      expect(result?.route.id).toBe('/$foo/_layout/$bar')
      expect(result?.rawParams).toEqual({ foo: 'abc', bar: 'def' })
    })
    it('skipped optional uses the correct node index with pathless nodes', () => {
      const tree = {
        id: '__root__',
        isRoot: true,
        fullPath: '/',
        path: '/',
        children: [
          {
            id: '/one_{-$foo}/_layout',
            fullPath: '/one_{-$foo}',
            path: 'one_{-$foo}',
            options: {
              params: {
                parse: (params: Record<string, string>) => params,
              },
              // force the creation of a pathless node
            },
            children: [
              {
                id: '/one_{-$foo}/_layout/two_{-$bar}/baz',
                fullPath: '/one_{-$foo}/two_{-$bar}/baz',
                path: 'two_{-$bar}/baz',
                options: {},
              },
            ],
          },
        ],
      }
      const { processedTree } = processRouteTree(tree)
      // match first, skip second
      {
        const result = findRouteMatch('/one_value/baz', processedTree)
        expect(result?.route.id).toBe('/one_{-$foo}/_layout/two_{-$bar}/baz')
        expect(result?.rawParams).toEqual({ foo: 'value' })
      }
      // skip first, match second
      {
        const result = findRouteMatch('/two_value/baz', processedTree)
        expect(result?.route.id).toBe('/one_{-$foo}/_layout/two_{-$bar}/baz')
        expect(result?.rawParams).toEqual({ bar: 'value' })
      }
    })
  })
})

describe('processRouteMasks', { sequential: true }, () => {
  const routeTree = {
    id: '__root__',
    isRoot: true,
    fullPath: '/',
  } as AnyRoute
  const { processedTree } = processRouteTree(routeTree)
  it('processes a route masks list into a segment tree', () => {
    const routeMasks: Array<RouteMask<AnyRoute>> = [
      { from: '/a/b/c', routeTree },
      { from: '/a/b/d', routeTree },
      { from: '/a/$param/d', routeTree },
      { from: '/a/{-$optional}/d', routeTree },
      { from: '/a/b/{$}.txt', routeTree },
    ]
    processRouteMasks(routeMasks, processedTree)
    const aBranch = processedTree.masksTree?.staticInsensitive?.get('a')
    expect(aBranch).toBeDefined()
    expect(aBranch?.staticInsensitive?.get('b')).toBeDefined()
    expect(aBranch?.dynamic).toHaveLength(1)
    expect(aBranch?.optional).toHaveLength(1)
  })
  it('can match static routes masks w/ `findFlatMatch`', () => {
    const res = findFlatMatch('/a/b/c', processedTree)
    expect(res?.route.from).toBe('/a/b/c')
  })
  it('can match dynamic route masks w/ `findFlatMatch`', () => {
    const res = findFlatMatch('/a/123/d', processedTree)
    expect(res?.route.from).toBe('/a/$param/d')
    expect(res?.rawParams).toEqual({ param: '123' })
  })
  it('can match optional route masks w/ `findFlatMatch`', () => {
    const res = findFlatMatch('/a/d', processedTree)
    expect(res?.route.from).toBe('/a/{-$optional}/d')
    expect(res?.rawParams).toEqual({})
  })
  it('can match prefix/suffix wildcard route masks w/ `findFlatMatch`', () => {
    const res = findFlatMatch('/a/b/file/path.txt', processedTree)
    expect(res?.route.from).toBe('/a/b/{$}.txt')
    expect(res?.rawParams).toEqual({ '*': 'file/path', _splat: 'file/path' })
  })
})
