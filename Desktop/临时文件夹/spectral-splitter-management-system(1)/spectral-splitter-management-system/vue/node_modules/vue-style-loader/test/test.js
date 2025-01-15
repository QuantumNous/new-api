import addStylesClient from '../lib/addStylesClient'
import addStylesServer from '../lib/addStylesServer'

const mockedList = [
  [1, 'h1 { color: red; }', ''],
  [1, 'p { color: green; }', ''],
  [2, 'span { color: blue; }', ''],
  [2, 'span { color: blue; }', 'print']
]

test('addStylesClient (dev)', () => {
  const update = addStylesClient('foo', mockedList, false)
  assertStylesMatch(mockedList)
  const mockedList2 = mockedList.slice(1, 3)
  update(mockedList2)
  assertStylesMatch(mockedList2)
  update()
  expect(document.querySelectorAll('style').length).toBe(0)
})

test('addStylesClient (prod)', () => {
  const update = addStylesClient('foo', mockedList, true)
  assertStylesMatch(mockedList)
  const mockedList2 = mockedList.slice(2)
  update(mockedList2)
  assertStylesMatch(mockedList2)
  update()
  expect(document.querySelectorAll('style').length).toBe(0)
})

test('addStylesClient (dev + ssr)', () => {
  mockSSRTags(mockedList, 'foo')
  const update = addStylesClient('foo', mockedList, false)
  assertStylesMatch(mockedList)
  update()
  expect(document.querySelectorAll('style').length).toBe(0)
})

test('addStylesClient (prod + ssr)', () => {
  mockProdSSRTags(mockedList, 'foo')
  const update = addStylesClient('foo', mockedList, true)
  expect(document.querySelectorAll('style').length).toBe(1)
})

test('addStylesServer (dev)', () => {
  const context = global.__VUE_SSR_CONTEXT__ = {}
  addStylesServer('foo', mockedList, false)
  expect(context.styles).toBe(
    `<style data-vue-ssr-id="foo:0">h1 { color: red; }</style>` +
    `<style data-vue-ssr-id="foo:1">p { color: green; }</style>` +
    `<style data-vue-ssr-id="foo:2">span { color: blue; }</style>` +
    `<style data-vue-ssr-id="foo:3" media="print">span { color: blue; }</style>`
  )
})

test('addStylesServer (prod)', () => {
  const context = global.__VUE_SSR_CONTEXT__ = {}
  addStylesServer('foo', mockedList, true)
  expect(context.styles).toBe(
    `<style data-vue-ssr-id="foo:0 foo:1 foo:2">` +
      `h1 { color: red; }\np { color: green; }\nspan { color: blue; }` +
    `</style>` +
    `<style data-vue-ssr-id="foo:3" media="print">span { color: blue; }</style>`
  )
})

// --- helpers ---

function assertStylesMatch (list) {
  const styles = document.querySelectorAll('style')
  expect(styles.length).toBe(list.length)
  ;[].forEach.call(styles, (style, i) => {
    expect(style.textContent.indexOf(list[i][1]) > -1).toBe(true)
  })
}

function mockSSRTags (list, parentId) {
  list.forEach((item, i) => {
    const style = document.createElement('style')
    style.setAttribute('data-vue-ssr-id', `${parentId}:${i}`)
    style.textContent = item[1]
    if (item[2]) {
      style.setAttribute('media', item[2])
    }
    document.head.appendChild(style)
  })
}

function mockProdSSRTags (list, parentId) {
  const style = document.createElement('style')
  style.setAttribute('data-vue-ssr-id', list.map((item, i) => `${parentId}:${i}`).join(' '))
  style.textContent = list.map(item => item[1]).join('\n')
  document.head.appendChild(style)
}
