import { For, createEffect } from 'solid-js'
import { Link, useParams, useSearch } from '@tanstack/solid-router'

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

function ParamsProbe(props: { salt: number }) {
  const params = useParams({
    strict: false,
    select: (nextParams) =>
      runSelectorWork(
        `${nextParams.a ?? ''}/${nextParams.b ?? ''}/${nextParams.c ?? ''}/${nextParams.d ?? ''}`,
        props.salt,
      ),
  })

  createEffect(() => {
    void params()
  })

  return null
}

function SearchProbe(props: { salt: number }) {
  const search = useSearch({
    strict: false,
    select: (nextSearch) =>
      runSelectorWork(String(nextSearch.q ?? ''), props.salt),
  })

  createEffect(() => {
    void search()
  })

  return null
}

function LinkProbe(props: { salt: number }) {
  const value = String((props.salt % 97) + 1)

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
      <For each={probes}>{(probe) => <ParamsProbe salt={probe + 1} />}</For>
      <For each={probes}>{(probe) => <SearchProbe salt={probe + 11} />}</For>
      <For each={probes}>{(probe) => <LinkProbe salt={probe + 21} />}</For>
    </>
  )
}
