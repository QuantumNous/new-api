export function Spinner(props: { show?: boolean; wait?: `delay-${number}` }) {
  return (
    <div
      class={`inline-block animate-spin px-3 transition ${
        (props.show ?? true)
          ? `opacity-100 duration-500 ${props.wait ?? 'delay-300'}`
          : 'duration-500 opacity-0 delay-0'
      }`}
    >
      ⍥
    </div>
  )
}
