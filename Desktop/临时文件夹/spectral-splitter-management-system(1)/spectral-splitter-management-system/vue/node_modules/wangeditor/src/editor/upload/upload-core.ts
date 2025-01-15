/**
 * @description 上传的核心方法
 * @author wangfupeng
 */

import { forEach } from '../../utils/util'
import { DicType } from '../../config/index'

type PostOptionType<T> = {
    timeout?: number
    formData?: FormData
    headers?: DicType
    withCredentials?: boolean
    onTimeout?: (xhr: XMLHttpRequest) => void
    onProgress?: (percent: number, event: ProgressEvent) => void
    beforeSend?: (xhr: XMLHttpRequest) => { prevent: boolean; msg: string } | void
    onError?: (xhr: XMLHttpRequest) => void
    onFail?: (xhr: XMLHttpRequest, msg: string) => void
    onSuccess: (xhr: XMLHttpRequest, result: T) => void
}

/**
 * 发送 post 请求（用于文件上传）
 * @param url url
 * @param option 配置项
 */
function post<T extends Object>(url: string, option: PostOptionType<T>): XMLHttpRequest | string {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    // 超时，默认 10s
    xhr.timeout = option.timeout || 10 * 1000
    xhr.ontimeout = () => {
        console.error('wangEditor - 请求超时')
        option.onTimeout && option.onTimeout(xhr)
    }

    // 进度
    if (xhr.upload) {
        xhr.upload.onprogress = (e: ProgressEvent) => {
            const percent = e.loaded / e.total
            option.onProgress && option.onProgress(percent, e)
        }
    }

    // 自定义 header
    if (option.headers) {
        forEach(option.headers, (key: string, val: string) => {
            xhr.setRequestHeader(key, val)
        })
    }

    // 跨域传 cookie
    xhr.withCredentials = !!option.withCredentials

    // 上传之前的钩子函数，在 xhr.send() 之前执行
    if (option.beforeSend) {
        const beforeResult = option.beforeSend(xhr)
        if (beforeResult && typeof beforeResult === 'object') {
            if (beforeResult.prevent) {
                // 如果返回的结果是 {prevent: true, msg: 'xxxx'} 则表示用户放弃上传
                return beforeResult.msg
            }
        }
    }

    // 服务端返回之后
    xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return
        const status = xhr.status
        if (status < 200) return // 请求发送过程中，尚未返回
        if (status >= 300 && status < 400) return // 重定向
        if (status >= 400) {
            // 40x 50x 报错
            console.error('wangEditor - XHR 报错，状态码 ' + status)
            if (option.onError) option.onError(xhr) // 有，则执行 onError 函数即可
            return
        }

        // status = 200 ，得到结果
        const resultStr = xhr.responseText
        let result: T
        if (typeof resultStr !== 'object') {
            try {
                result = JSON.parse(resultStr)
            } catch (ex) {
                console.error('wangEditor - 返回结果不是 JSON 格式', resultStr)
                if (option.onFail) option.onFail(xhr, resultStr)
                return
            }
        } else {
            result = resultStr
        }
        option.onSuccess(xhr, result)
    }

    // 发送请求
    xhr.send(option.formData || null)

    return xhr
}

export default post
