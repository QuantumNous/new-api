import * as Vue from 'vue'
import { Link, useParams, useSearch } from '@tanstack/vue-router'

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

const ParamsProbe = Vue.defineComponent({
  props: {
    salt: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    const params = useParams({
      strict: false,
      select: (nextParams) =>
        runSelectorWork(
          `${nextParams.a ?? ''}/${nextParams.b ?? ''}/${nextParams.c ?? ''}/${nextParams.d ?? ''}`,
          props.salt,
        ),
    })

    return () => {
      void params.value
      return null
    }
  },
})

const SearchProbe = Vue.defineComponent({
  props: {
    salt: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    const search = useSearch({
      strict: false,
      select: (nextSearch) =>
        runSelectorWork(String(nextSearch.q ?? ''), props.salt),
    })

    return () => {
      void search.value
      return null
    }
  },
})

const LinkProbe = Vue.defineComponent({
  props: {
    salt: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    const value = String((props.salt % 97) + 1)

    return () => (
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
  },
})

export const RouteWorkload = Vue.defineComponent({
  setup() {
    return () => (
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
  },
})
