import { Link, useParams, useSearch } from '@tanstack/react-router'

const probes = Array.from({ length: 10 }, (_, index) => index)

function runSelectorWork(input: string, salt: number) {
  let value = salt

  for (let index = 0; index < input.length; index++) {
    value = (value * 33 + input.charCodeAt(index) + index) >>> 0
  }

  for (let index = 0; index < 16; index++) {
    value = (value ^ (value << 13)) >>> 0
    value = (value ^ (value >> 17)) >>> 0
    value = (value ^ (value << 5)) >>> 0
  }

  return value
}

function ParamsProbe({ salt }: { salt: number }) {
  const params = useParams({
    strict: false,
    select: (nextParams) =>
      runSelectorWork(
        `${nextParams.a ?? ''}/${nextParams.b ?? ''}/${nextParams.c ?? ''}/${nextParams.d ?? ''}`,
        salt,
      ),
  })

  void params

  return null
}

function SearchProbe({ salt }: { salt: number }) {
  const search = useSearch({
    strict: false,
    select: (nextSearch) => runSelectorWork(String(nextSearch.q ?? ''), salt),
  })

  void search

  return null
}

function LinkProbe({ salt }: { salt: number }) {
  const value = String((salt % 97) + 1)

  return (
    <Link
      to="/$a/$b/$c/$d"
      params={{
        a: `a-${value}`,
        b: `b-${value}`,
        c: `c-${value}`,
        d: `d-${value}`,
      }}
      search={{ q: `q-${value}` }}
      preload={false}
    >
      Link
    </Link>
  )
}

export function RouteWorkload() {
  return (
    <>
      {probes.map((probe) => (
        <ParamsProbe key={`params-${probe}`} salt={probe + 1} />
      ))}
      {probes.map((probe) => (
        <SearchProbe key={`search-${probe}`} salt={probe + 11} />
      ))}
      {probes.map((probe) => (
        <LinkProbe key={`link-${probe}`} salt={probe + 21} />
      ))}
    </>
  )
}
