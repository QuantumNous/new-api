/**
 * @param func 节流函数
 * @param time 节流时间配置
 * @param immediately 第一次是否立即执行
 */
export function throttle(fn, time = 500, immediately = false) {
  let timer = null
  return function () {
    if (immediately) {
      fn.apply(this, arguments)
      immediately = false
      timer = setTimeout(() => {
        immediately = true
      }, time)
    } else {
      if (timer) return
      timer = setTimeout(function () {
        fn.apply(this, arguments)
        timer = null
      }, time)
    }
  }
}

/**
 * @param func 防抖函数
 * @param delay 防抖时间配置
 */
let timer = null
export const debounce = (func, delay = SHAKE_TIME) => {
  return function (...args) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    timer = setTimeout(() => {
      func.apply(this, args)
      timer && clearTimeout(timer)
      timer = null
    }, delay)
  }
}