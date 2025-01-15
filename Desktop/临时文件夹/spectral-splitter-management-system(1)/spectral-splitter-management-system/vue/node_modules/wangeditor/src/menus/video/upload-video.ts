/**
 * @description 上传视频
 * @author lichunlin
 */

import Editor from '../../editor/index'
import { arrForEach, forEach } from '../../utils/util'
import post from '../../editor/upload/upload-core'
import Progress from '../../editor/upload/progress'
import { EMPTY_P } from '../../utils/const'
import { UA } from '../../utils/util'

type ResData = {
    url: string
}

// 后台返回的格式
export type ResType = {
    errno: number | string
    data: ResData
}

class UploadVideo {
    private editor: Editor

    constructor(editor: Editor) {
        this.editor = editor
    }

    /**
     * 上传视频
     * @param files 文件列表
     */
    public uploadVideo(files: FileList | File[]): void {
        if (!files.length) {
            return
        }

        const editor = this.editor
        const config = editor.config

        // ------------------------------ i18next ------------------------------

        const i18nPrefix = 'validate.'
        const t = (text: string): string => {
            return editor.i18next.t(i18nPrefix + text)
        }

        // ------------------------------ 获取配置信息 ------------------------------
        // 服务端地址
        let uploadVideoServer = config.uploadVideoServer
        // 上传视频的最大体积，默认 1024M
        const maxSize = config.uploadVideoMaxSize
        const uploadVideoMaxSize = maxSize / 1024
        // 一次最多上传多少个视频
        // const uploadVideoMaxLength = config.uploadVideoMaxLength
        // 自定义上传视频的名称
        const uploadVideoName = config.uploadVideoName
        // 上传视频自定义参数
        const uploadVideoParams = config.uploadVideoParams
        // 自定义参数拼接到 url 中
        const uploadVideoParamsWithUrl = config.uploadVideoParamsWithUrl
        // 上传视频自定义 header
        const uploadVideoHeaders = config.uploadVideoHeaders
        // 钩子函数
        const uploadVideoHooks = config.uploadVideoHooks
        // 上传视频超时时间 ms 默认2个小时
        const uploadVideoTimeout = config.uploadVideoTimeout
        // 跨域带 cookie
        const withVideoCredentials = config.withVideoCredentials
        // 自定义上传
        const customUploadVideo = config.customUploadVideo
        // 格式校验
        const uploadVideoAccept = config.uploadVideoAccept

        // ------------------------------ 验证文件信息 ------------------------------
        const resultFiles: File[] = []
        const errInfos: string[] = []
        arrForEach(files, file => {
            const name = file.name
            const size = file.size / 1024 / 1024

            // chrome 低版本 name === undefined
            if (!name || !size) {
                return
            }

            if (!(uploadVideoAccept instanceof Array)) {
                // 格式不是数组
                errInfos.push(`【${uploadVideoAccept}】${t('uploadVideoAccept 不是Array')}`)
                return
            }

            if (
                !uploadVideoAccept.some(
                    item => item === name.split('.')[name.split('.').length - 1]
                )
            ) {
                // 后缀名不合法，不是视频
                errInfos.push(`【${name}】${t('不是视频')}`)
                return
            }

            if (uploadVideoMaxSize < size) {
                // 上传视频过大
                errInfos.push(`【${name}】${t('大于')} ${uploadVideoMaxSize}M`)
                return
            }
            //验证通过的加入结果列表
            resultFiles.push(file)
        })
        // 抛出验证信息
        if (errInfos.length) {
            config.customAlert(`${t('视频验证未通过')}: \n` + errInfos.join('\n'), 'warning')
            return
        }
        // 如果过滤后文件列表为空直接返回
        if (resultFiles.length === 0) {
            config.customAlert(t('传入的文件不合法'), 'warning')
            return
        }

        // ------------------------------ 自定义上传 ------------------------------
        if (customUploadVideo && typeof customUploadVideo === 'function') {
            customUploadVideo(resultFiles, this.insertVideo.bind(this))
            return
        }

        // 添加视频数据
        const formData = new FormData()
        resultFiles.forEach((file: File, index: number) => {
            let name = uploadVideoName || file.name
            if (resultFiles.length > 1) {
                // 多个文件时，filename 不能重复
                name = name + (index + 1)
            }
            formData.append(name, file)
        })

        // ------------------------------ 上传视频 ------------------------------

        //添加自定义参数  基于有服务端地址的情况下
        if (uploadVideoServer) {
            // 添加自定义参数
            const uploadVideoServerArr = uploadVideoServer.split('#')
            uploadVideoServer = uploadVideoServerArr[0]
            const uploadVideoServerHash = uploadVideoServerArr[1] || ''
            forEach(uploadVideoParams, (key: string, val: string) => {
                // 因使用者反应，自定义参数不能默认 encode ，由 v3.1.1 版本开始注释掉
                // val = encodeURIComponent(val)

                // 第一，将参数拼接到 url 中
                if (uploadVideoParamsWithUrl) {
                    if (uploadVideoServer.indexOf('?') > 0) {
                        uploadVideoServer += '&'
                    } else {
                        uploadVideoServer += '?'
                    }
                    uploadVideoServer = uploadVideoServer + key + '=' + val
                }

                // 第二，将参数添加到 formData 中
                formData.append(key, val)
            })
            if (uploadVideoServerHash) {
                uploadVideoServer += '#' + uploadVideoServerHash
            }

            // 开始上传
            const xhr = post(uploadVideoServer, {
                timeout: uploadVideoTimeout,
                formData,
                headers: uploadVideoHeaders,
                withCredentials: !!withVideoCredentials,
                beforeSend: xhr => {
                    if (uploadVideoHooks.before)
                        return uploadVideoHooks.before(xhr, editor, resultFiles)
                },
                onTimeout: xhr => {
                    config.customAlert(t('上传视频超时'), 'error')
                    if (uploadVideoHooks.timeout) uploadVideoHooks.timeout(xhr, editor)
                },
                onProgress: (percent, e) => {
                    const progressBar = new Progress(editor)
                    if (e.lengthComputable) {
                        percent = e.loaded / e.total
                        progressBar.show(percent)
                    }
                },
                onError: xhr => {
                    config.customAlert(
                        t('上传视频错误'),
                        'error',
                        `${t('上传视频错误')}，${t('服务器返回状态')}: ${xhr.status}`
                    )
                    if (uploadVideoHooks.error) uploadVideoHooks.error(xhr, editor)
                },
                onFail: (xhr, resultStr) => {
                    config.customAlert(
                        t('上传视频失败'),
                        'error',
                        t('上传视频返回结果错误') + `，${t('返回结果')}: ` + resultStr
                    )
                    if (uploadVideoHooks.fail) uploadVideoHooks.fail(xhr, editor, resultStr)
                },
                onSuccess: (xhr, result: ResType) => {
                    if (uploadVideoHooks.customInsert) {
                        // 自定义插入视频
                        uploadVideoHooks.customInsert(this.insertVideo.bind(this), result, editor)
                        return
                    }
                    if (result.errno != '0') {
                        // 返回格式不对，应该为 { errno: 0, data: [...] }
                        config.customAlert(
                            t('上传视频失败'),
                            'error',
                            `${t('上传视频返回结果错误')}，${t('返回结果')} errno=${result.errno}`
                        )
                        if (uploadVideoHooks.fail) uploadVideoHooks.fail(xhr, editor, result)
                        return
                    }

                    // 成功，插入视频
                    const data = result.data

                    this.insertVideo(data.url)

                    // 钩子函数
                    if (uploadVideoHooks.success) uploadVideoHooks.success(xhr, editor, result)
                },
            })
            if (typeof xhr === 'string') {
                // 上传被阻止
                config.customAlert(xhr, 'error')
            }
        }
    }

    /**
     * 往编辑器区域插入视频
     * @param url 视频访问地址
     */
    public insertVideo(url: string): void {
        const editor = this.editor
        const config = editor.config

        const i18nPrefix = 'validate.'
        const t = (text: string, prefix: string = i18nPrefix): string => {
            return editor.i18next.t(prefix + text)
        }

        // 判断用户是否自定义插入视频
        if (!config.customInsertVideo) {
            if (UA.isFirefox) {
                editor.cmd.do(
                    'insertHTML',
                    `<p data-we-video-p="true"><video src="${url}" controls="controls" style="max-width:100%"></video></p><p>&#8203</p>`
                )
            } else {
                editor.cmd.do(
                    'insertHTML',
                    `<video src="${url}" controls="controls" style="max-width:100%"></video>${EMPTY_P}`
                )
            }
        } else {
            config.customInsertVideo(url)
            return
        }

        // 加载视频
        let video: any = document.createElement('video')
        video.onload = () => {
            video = null
        }
        video.onerror = () => {
            config.customAlert(
                t('插入视频错误'),
                'error',
                `wangEditor: ${t('插入视频错误')}，${t('视频链接')} "${url}"，${t('下载链接失败')}`
            )
            video = null
        }
        video.onabort = () => (video = null)
        video.src = url
    }
}

export default UploadVideo
