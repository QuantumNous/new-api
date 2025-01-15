/**
 * @description 上传图片
 * @author wangfupeng
 */

import Editor from '../../editor/index'
import { arrForEach, forEach } from '../../utils/util'
import post from '../../editor/upload/upload-core'
import Progress from '../../editor/upload/progress'

type ResImgItemType = string | { url: string; alt?: string; href?: string }

export type ResType = {
    errno: number | string
    data: ResImgItemType[]
}

class UploadImg {
    private editor: Editor

    constructor(editor: Editor) {
        this.editor = editor
    }

    /**
     * 往编辑区域插入图片
     * @param src 图片地址
     */
    public insertImg(src: string, alt?: string, href?: string): void {
        const editor = this.editor
        const config = editor.config

        const i18nPrefix = 'validate.'
        const t = (text: string, prefix: string = i18nPrefix): string => {
            return editor.i18next.t(prefix + text)
        }

        /**
         * fix: insertImg xss
         */

        // 过滤src, 防止xss
        let resultSrc = src.replace(/</g, '&lt;').replace(/>/g, '&gt;')

        // 因为下面要单引号拼接字符串, 所以要将单引号替换成双引号
        resultSrc = resultSrc.replace("'", '"')

        let hrefText = ''

        // 设置图片的元数据 data-
        if (href) {
            hrefText = href.replace("'", '"')

            hrefText = `data-href='${encodeURIComponent(hrefText)}' `
        }

        let altText = ''
        // 设置图片alt, 过滤xss标签攻击
        if (alt) {
            altText = alt.replace(/</g, '&lt;').replace(/>/g, '&gt;')

            // 因为下面要单引号拼接字符串, 所以要将单引号替换成双引号
            altText = altText.replace("'", '"')

            altText = `alt='${altText}' `
        }

        // 先插入图片，无论是否能成功
        editor.cmd.do(
            'insertHTML',
            `<img src='${resultSrc}' ${altText}${hrefText}style="max-width:100%;" contenteditable="false"/>`
        )
        // 执行回调函数
        config.linkImgCallback(src, alt, href)

        // 加载图片
        let img: any = document.createElement('img')
        img.onload = () => {
            img = null
        }
        img.onerror = () => {
            config.customAlert(
                t('插入图片错误'),
                'error',
                `wangEditor: ${t('插入图片错误')}，${t('图片链接')} "${src}"，${t('下载链接失败')}`
            )
            img = null
        }
        img.onabort = () => (img = null)
        img.src = src
    }

    /**
     * 上传图片
     * @param files 文件列表
     */
    public uploadImg(files: FileList | File[]): void {
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
        let uploadImgServer = config.uploadImgServer
        // base64 格式
        const uploadImgShowBase64 = config.uploadImgShowBase64
        // 图片最大体积
        const maxSize = config.uploadImgMaxSize
        const maxSizeM = maxSize / 1024 / 1024
        // 一次最多上传图片数量
        const maxLength = config.uploadImgMaxLength
        // 自定义 fileName
        const uploadFileName = config.uploadFileName
        // 自定义参数
        const uploadImgParams = config.uploadImgParams
        // 参数拼接到 url 中
        const uploadImgParamsWithUrl = config.uploadImgParamsWithUrl
        // 自定义 header
        const uploadImgHeaders = config.uploadImgHeaders
        // 钩子函数
        const hooks = config.uploadImgHooks
        // 上传图片超时时间
        const timeout = config.uploadImgTimeout
        // 跨域带 cookie
        const withCredentials = config.withCredentials
        // 自定义上传图片
        const customUploadImg = config.customUploadImg

        if (!customUploadImg) {
            // 没有 customUploadImg 的情况下，需要如下两个配置才能继续进行图片上传
            if (!uploadImgServer && !uploadImgShowBase64) {
                return
            }
        }

        // ------------------------------ 验证文件信息 ------------------------------
        const resultFiles: File[] = []
        const errInfos: string[] = []
        arrForEach(files, file => {
            // chrome 低版本 粘贴一张图时files为 [null, File]
            if (!file) return

            const name = file.name || file.type.replace('/', '.') // 兼容低版本chrome 没有name
            const size = file.size

            // chrome 低版本 name === undefined
            if (!name || !size) {
                return
            }

            // 将uploadImgAccept数组转换为正则对象
            const imgType = editor.config.uploadImgAccept.join('|')
            const imgTypeRuleStr = `.(${imgType})$`
            const uploadImgAcceptRule = new RegExp(imgTypeRuleStr, 'i')
            if (uploadImgAcceptRule.test(name) === false) {
                // 后缀名不合法，不是图片
                errInfos.push(`【${name}】${t('不是图片')}`)
                return
            }

            if (maxSize < size) {
                // 上传图片过大
                errInfos.push(`【${name}】${t('大于')} ${maxSizeM}M`)
                return
            }

            // 验证通过的加入结果列表
            resultFiles.push(file)
        })
        // 抛出验证信息
        if (errInfos.length) {
            config.customAlert(`${t('图片验证未通过')}: \n` + errInfos.join('\n'), 'warning')
            return
        }

        // 如果过滤后文件列表为空直接返回
        if (resultFiles.length === 0) {
            config.customAlert(t('传入的文件不合法'), 'warning')
            return
        }

        if (resultFiles.length > maxLength) {
            config.customAlert(t('一次最多上传') + maxLength + t('张图片'), 'warning')
            return
        }

        // ------------------------------ 自定义上传 ------------------------------
        if (customUploadImg && typeof customUploadImg === 'function') {
            customUploadImg(resultFiles, this.insertImg.bind(this))

            // 阻止以下代码执行，重要！！！
            return
        }

        // ------------------------------ 上传图片 ------------------------------

        // 添加图片数据
        const formData = new FormData()
        resultFiles.forEach((file: File, index: number) => {
            let name = uploadFileName || file.name
            if (resultFiles.length > 1) {
                // 多个文件时，filename 不能重复
                name = name + (index + 1)
            }
            formData.append(name, file)
        })
        if (uploadImgServer) {
            // 添加自定义参数
            const uploadImgServerArr = uploadImgServer.split('#')
            uploadImgServer = uploadImgServerArr[0]
            const uploadImgServerHash = uploadImgServerArr[1] || ''
            forEach(uploadImgParams, (key: string, val: string) => {
                // 因使用者反应，自定义参数不能默认 encode ，由 v3.1.1 版本开始注释掉
                // val = encodeURIComponent(val)

                // 第一，将参数拼接到 url 中
                if (uploadImgParamsWithUrl) {
                    if (uploadImgServer.indexOf('?') > 0) {
                        uploadImgServer += '&'
                    } else {
                        uploadImgServer += '?'
                    }
                    uploadImgServer = uploadImgServer + key + '=' + val
                }

                // 第二，将参数添加到 formData 中
                formData.append(key, val)
            })
            if (uploadImgServerHash) {
                uploadImgServer += '#' + uploadImgServerHash
            }

            // 开始上传
            const xhr = post(uploadImgServer, {
                timeout,
                formData,
                headers: uploadImgHeaders,
                withCredentials: !!withCredentials,
                beforeSend: xhr => {
                    if (hooks.before) return hooks.before(xhr, editor, resultFiles)
                },
                onTimeout: xhr => {
                    config.customAlert(t('上传图片超时'), 'error')
                    if (hooks.timeout) hooks.timeout(xhr, editor)
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
                        t('上传图片错误'),
                        'error',
                        `${t('上传图片错误')}，${t('服务器返回状态')}: ${xhr.status}`
                    )
                    if (hooks.error) hooks.error(xhr, editor)
                },
                onFail: (xhr, resultStr) => {
                    config.customAlert(
                        t('上传图片失败'),
                        'error',
                        t('上传图片返回结果错误') + `，${t('返回结果')}: ` + resultStr
                    )
                    if (hooks.fail) hooks.fail(xhr, editor, resultStr)
                },
                onSuccess: (xhr, result: ResType) => {
                    if (hooks.customInsert) {
                        // 自定义插入图片
                        hooks.customInsert(this.insertImg.bind(this), result, editor)
                        return
                    }
                    if (result.errno != '0') {
                        // 返回格式不对，应该为 { errno: 0, data: [...] }
                        config.customAlert(
                            t('上传图片失败'),
                            'error',
                            `${t('上传图片返回结果错误')}，${t('返回结果')} errno=${result.errno}`
                        )
                        if (hooks.fail) hooks.fail(xhr, editor, result)
                        return
                    }

                    // 成功，插入图片
                    const data = result.data
                    data.forEach(link => {
                        if (typeof link === 'string') {
                            this.insertImg(link)
                        } else {
                            this.insertImg(link.url, link.alt, link.href)
                        }
                    })

                    // 钩子函数
                    if (hooks.success) hooks.success(xhr, editor, result)
                },
            })
            if (typeof xhr === 'string') {
                // 上传被阻止
                config.customAlert(xhr, 'error')
            }

            // 阻止以下代码执行，重要！！！
            return
        }

        // ------------------------------ 显示 base64 格式 ------------------------------
        if (uploadImgShowBase64) {
            arrForEach(files, file => {
                const _this = this
                const reader = new FileReader()
                reader.readAsDataURL(file)
                reader.onload = function () {
                    if (!this.result) return
                    const imgLink = this.result.toString()
                    _this.insertImg(imgLink, imgLink)
                }
            })
        }
    }
}

export default UploadImg
