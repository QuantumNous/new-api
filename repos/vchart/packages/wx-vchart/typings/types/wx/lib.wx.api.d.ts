/*! *****************************************************************************
Copyright (c) 2023 Tencent, Inc. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
***************************************************************************** */

/// <reference path="./lib.wx.xr-frame.d.ts" />

declare namespace WechatMiniprogram {
  interface AccessOption {
    /** 要判断是否存在的文件/目录路径 (本地路径) */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AccessCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AccessFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AccessSuccessCallback;
  }
  /** 帐号信息 */
  interface AccountInfo {
    /** 小程序帐号信息 */
    miniProgram: MiniProgram;
    /** 插件帐号信息（仅在插件中调用时包含这一项） */
    plugin: Plugin;
  }
  interface AddArcOption {
    /** 终点 */
    end: MapPostion;
    /** 圆弧 id */
    id: number;
    /** 起始点 */
    start: MapPostion;
    /** 夹角角度 */
    angle?: number;
    /** 线的颜色 */
    color?: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddArcCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddArcFailCallback;
    /** 途经点 */
    pass?: MapPostion;
    /** 接口调用成功的回调函数 */
    success?: AddArcSuccessCallback;
    /** 线宽 */
    width?: number;
  }
  interface AddCardOption {
    /** 需要添加的卡券列表 */
    cardList: AddCardRequestInfo[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddCardCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddCardFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AddCardSuccessCallback;
  }
  /** 需要添加的卡券列表 */
  interface AddCardRequestInfo {
    /** 卡券的扩展参数。需将 CardExt 对象 JSON 序列化为**字符串**传入 */
    cardExt: string;
    /** 卡券 ID */
    cardId: string;
  }
  /** 卡券添加结果列表 */
  interface AddCardResponseInfo {
    /** 卡券的扩展参数，结构请参考下文 */
    cardExt: string;
    /** 用户领取到卡券的 ID */
    cardId: string;
    /** 加密 code，为用户领取到卡券的code加密后的字符串，解密请参照：[code 解码接口](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1499332673_Unm7V) */
    code: string;
    /** 是否成功 */
    isSuccess: boolean;
  }
  interface AddCardSuccessCallbackResult {
    /** 卡券添加结果列表 */
    cardList: AddCardResponseInfo[];
    errMsg: string;
  }
  interface AddCustomLayerOption {
    /** 个性化图层id */
    layerId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddCustomLayerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddCustomLayerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AddCustomLayerSuccessCallback;
  }
  interface AddFileToFavoritesOption {
    /** 要收藏的文件地址，必须为本地路径或临时路径 */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddFileToFavoritesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddFileToFavoritesFailCallback;
    /** 自定义文件名，若留空则使用filePath中的文件名 */
    fileName?: string;
    /** 接口调用成功的回调函数 */
    success?: AddFileToFavoritesSuccessCallback;
  }
  interface AddGroundOverlayOption {
    /** 图片覆盖的经纬度范围 */
    bounds: MapBounds;
    /** 图片图层 id */
    id: string;
    /** 图片路径，支持网络图片、临时路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddGroundOverlayCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddGroundOverlayFailCallback;
    /** 图层透明度 */
    opacity?: number;
    /** 接口调用成功的回调函数 */
    success?: AddGroundOverlaySuccessCallback;
    /** 是否可见 */
    visible?: boolean;
    /** 图层绘制顺序 */
    zIndex?: number;
  }
  interface AddMarkersOption {
    /** 同传入 map 组件的 marker 属性 */
    markers: any[];
    /** 是否先清空地图上所有 marker */
    clear?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddMarkersCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddMarkersFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AddMarkersSuccessCallback;
  }
  interface AddPhoneCalendarOption {
    /** 开始时间的 unix 时间戳 */
    startTime: number;
    /** 日历事件标题 */
    title: string;
    /** 是否提醒，默认 true */
    alarm?: boolean;
    /** 提醒提前量，单位秒，默认 0 表示开始时提醒 */
    alarmOffset?: number;
    /** 是否全天事件，默认 false */
    allDay?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddPhoneCalendarCompleteCallback;
    /** 事件说明 */
    description?: string;
    /** 结束时间的 unix 时间戳，默认与开始时间相同 */
    endTime?: string;
    /** 接口调用失败的回调函数 */
    fail?: AddPhoneCalendarFailCallback;
    /** 事件位置 */
    location?: string;
    /** 接口调用成功的回调函数 */
    success?: AddPhoneCalendarSuccessCallback;
  }
  interface AddPhoneContactOption {
    /** 名字 */
    firstName: string;
    /** 联系地址城市 */
    addressCity?: string;
    /** 联系地址国家 */
    addressCountry?: string;
    /** 联系地址邮政编码 */
    addressPostalCode?: string;
    /** 联系地址省份 */
    addressState?: string;
    /** 联系地址街道 */
    addressStreet?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddPhoneContactCompleteCallback;
    /** 电子邮件 */
    email?: string;
    /** 接口调用失败的回调函数 */
    fail?: AddPhoneContactFailCallback;
    /** 住宅地址城市 */
    homeAddressCity?: string;
    /** 住宅地址国家 */
    homeAddressCountry?: string;
    /** 住宅地址邮政编码 */
    homeAddressPostalCode?: string;
    /** 住宅地址省份 */
    homeAddressState?: string;
    /** 住宅地址街道 */
    homeAddressStreet?: string;
    /** 住宅传真 */
    homeFaxNumber?: string;
    /** 住宅电话 */
    homePhoneNumber?: string;
    /** 公司电话 */
    hostNumber?: string;
    /** 姓氏 */
    lastName?: string;
    /** 中间名 */
    middleName?: string;
    /** 手机号 */
    mobilePhoneNumber?: string;
    /** 昵称 */
    nickName?: string;
    /** 公司 */
    organization?: string;
    /** 头像本地文件路径 */
    photoFilePath?: string;
    /** 备注 */
    remark?: string;
    /** 接口调用成功的回调函数 */
    success?: AddPhoneContactSuccessCallback;
    /** 职位 */
    title?: string;
    /** 网站 */
    url?: string;
    /** 微信号 */
    weChatNumber?: string;
    /** 工作地址城市 */
    workAddressCity?: string;
    /** 工作地址国家 */
    workAddressCountry?: string;
    /** 工作地址邮政编码 */
    workAddressPostalCode?: string;
    /** 工作地址省份 */
    workAddressState?: string;
    /** 工作地址街道 */
    workAddressStreet?: string;
    /** 工作传真 */
    workFaxNumber?: string;
    /** 工作电话 */
    workPhoneNumber?: string;
  }
  interface AddPhoneRepeatCalendarOption {
    /** 开始时间的 unix 时间戳 (1970年1月1日开始所经过的秒数) */
    startTime: number;
    /** 日历事件标题 */
    title: string;
    /** 是否提醒，默认 true */
    alarm?: boolean;
    /** 提醒提前量，单位秒，默认 0 表示开始时提醒 */
    alarmOffset?: number;
    /** 是否全天事件，默认 false */
    allDay?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddPhoneRepeatCalendarCompleteCallback;
    /** 事件说明 */
    description?: string;
    /** 结束时间的 unix 时间戳，默认与开始时间相同 */
    endTime?: string;
    /** 接口调用失败的回调函数 */
    fail?: AddPhoneRepeatCalendarFailCallback;
    /** 事件位置 */
    location?: string;
    /** 重复周期结束时间的 unix 时间戳，不填表示一直重复 */
    repeatEndTime?: number;
    /** 重复周期，默认 month 每月重复
     *
     * 可选值：
     * - 'day': 每天重复;
     * - 'week': 每周重复;
     * - 'month': 每月重复。该模式日期不能大于 28 日;
     * - 'year': 每年重复; */
    repeatInterval?: 'day' | 'week' | 'month' | 'year';
    /** 接口调用成功的回调函数 */
    success?: AddPhoneRepeatCalendarSuccessCallback;
  }
  interface AddServiceOption {
    /** 描述service的Object */
    service: BLEPeripheralService;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddServiceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddServiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AddServiceSuccessCallback;
  }
  interface AddVideoToFavoritesOption {
    /** 要收藏的视频地址，必须为本地路径或临时路径 */
    videoPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddVideoToFavoritesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddVideoToFavoritesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AddVideoToFavoritesSuccessCallback;
    /** 缩略图路径，若留空则使用视频首帧 */
    thumbPath?: string;
  }
  interface AddVisualLayerOption {
    /** 可视化图层id（[创建图层指引](https://lbs.qq.com/dev/console/layers/layerEdit)) */
    layerId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AddVisualLayerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AddVisualLayerFailCallback;
    /** 刷新周期，单位秒 */
    interval?: number;
    /** 图层透明度 */
    opacity?: number;
    /** 接口调用成功的回调函数 */
    success?: AddVisualLayerSuccessCallback;
    /** 图层绘制顺序 */
    zIndex?: number;
  }
  /** 广播自定义参数 */
  interface AdvertiseReqObj {
    /** 需要基础库： `2.20.1`
     *
     * 以 beacon 设备形式广播的参数。 */
    beacon?: BeaconInfoObj;
    /** 当前设备是否可连接 */
    connectable?: boolean;
    /** 广播中 deviceName 字段，默认为空 */
    deviceName?: string;
    /** 广播的制造商信息。仅安卓支持，iOS 因系统限制无法定制。 */
    manufacturerData?: ManufacturerData[];
    /** 要广播的服务 UUID 列表。使用 16/32 位 UUID 时请参考注意事项。 */
    serviceUuids?: string[];
  }
  /** animationData */
  interface AnimationExportResult {
    actions: IAnyObject[];
  }
  /** 动画效果 */
  interface AnimationOption {
    /** 动画变化时间，单位 ms */
    duration?: number;
    /** 动画变化方式
     *
     * 可选值：
     * - 'linear': 动画从头到尾的速度是相同的;
     * - 'easeIn': 动画以低速开始;
     * - 'easeOut': 动画以低速结束;
     * - 'easeInOut': 动画以低速开始和结束; */
    timingFunc?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  }
  interface AppAuthorizeSetting {
    /** 允许微信使用相册的开关（仅 iOS 有效） */
    albumAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信使用蓝牙的开关（仅 iOS 有效） */
    bluetoothAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信使用摄像头的开关 */
    cameraAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信使用定位的开关 */
    locationAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 定位准确度。true 表示模糊定位，false 表示精确定位（仅 iOS 有效） */
    locationReducedAccuracy: boolean;
    /** 允许微信使用麦克风的开关 */
    microphoneAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信通知带有提醒的开关（仅 iOS 有效） */
    notificationAlertAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信通知的开关 */
    notificationAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信通知带有标记的开关（仅 iOS 有效） */
    notificationBadgeAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信通知带有声音的开关（仅 iOS 有效） */
    notificationSoundAuthorized: 'authorized' | 'denied' | 'not determined';
    /** 允许微信读写日历的开关 */
    phoneCalendarAuthorized: 'authorized' | 'denied' | 'not determined';
  }
  interface AppBaseInfo {
    /** 客户端基础库版本 */
    SDKVersion: string;
    /** 是否已打开调试。可通过右上角菜单或 [wx.setEnableDebug](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.setEnableDebug.html) 打开调试。 */
    enableDebug: boolean;
    /** 当前小程序运行的宿主环境 */
    host: AppBaseInfoHost;
    /** 微信设置的语言 */
    language: string;
    /** 微信版本号 */
    version: string;
    /** 系统当前主题，取值为`light`或`dark`，全局配置`"darkmode":true`时才能获取，否则为 undefined （不支持小游戏）
     *
     * 可选值：
     * - 'dark': 深色主题;
     * - 'light': 浅色主题; */
    theme?: 'dark' | 'light';
  }
  /** 当前小程序运行的宿主环境 */
  interface AppBaseInfoHost {
    /** 宿主 app（第三方App） 对应的 appId （当小程序运行在第三方App环境时才返回） */
    appId: string;
  }
  interface AppendFileOption {
    /** 要追加的文本或二进制数据 */
    data: string | ArrayBuffer;
    /** 要追加内容的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AppendFileCompleteCallback;
    /** 指定写入文件的字符编码
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 接口调用失败的回调函数 */
    fail?: AppendFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AppendFileSuccessCallback;
  }
  interface ApplyBlusherStickMakeupOption {
    /** 上色程度 0-1 */
    alpha: number;
    blendMode: string;
    /** 左腮红资源路径 */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyBlusherStickMakeupCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyBlusherStickMakeupFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ApplyBlusherStickMakeupSuccessCallback;
  }
  interface ApplyEyeBrowMakeupOption {
    /** 上色程度 0-1 */
    alpha: number;
    blendMode: string;
    path: string;
    shrinkRate: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyEyeBrowMakeupCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyEyeBrowMakeupFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ApplyEyeBrowMakeupSuccessCallback;
  }
  interface ApplyEyeShadowMakeupOption {
    /** 上色程度 0-1 */
    alpha: number;
    blendMode: string;
    /** 眼影资源路径 */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyEyeShadowMakeupCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyEyeShadowMakeupFailCallback;
    /** 细致效果图片资源路径 */
    shimmerPosition?: string;
    /** 细致效果图片资源 md5 */
    shimmerPositionMD5?: string;
    /** 接口调用成功的回调函数 */
    success?: ApplyEyeShadowMakeupSuccessCallback;
  }
  interface ApplyFaceContourMakeupOption {
    alpha: number;
    /** 高光资源路径 */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyFaceContourMakeupCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyFaceContourMakeupFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ApplyFaceContourMakeupSuccessCallback;
  }
  interface ApplyFilterOption {
    /** 滤镜效果透明度，范围是 0-1 */
    alpha: number;
    /** 滤镜资源路径 */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyFilterCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyFilterFailCallback;
    /** 滤镜资源 md5 */
    md5?: string;
    /** 接口调用成功的回调函数 */
    success?: ApplyFilterSuccessCallback;
  }
  interface ApplyLipStickMakeupOption {
    /** 上色程度 0-1 */
    alpha: number;
    blendMode: string;
    faceModel: string;
    path: string;
    shimmerPath: string;
    shimmerType: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyLipStickMakeupCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyLipStickMakeupFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ApplyLipStickMakeupSuccessCallback;
  }
  interface ApplyStickerOption {
    /** 贴纸类型 */
    stickers: Sticker[];
    /** 贴纸类型 */
    type: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ApplyStickerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ApplyStickerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ApplyStickerSuccessCallback;
    templateTransSet?: IAnyObject;
  }
  interface Asset {
    src: string;
    /** 可选值：
     * - 'font': 字体;
     * - 'image': 图片; */
    type: 'font' | 'image';
  }
  /** 需要基础库： `2.19.0`
   *
   * AudioBuffer接口表示存在内存里的一段短小的音频资源，利用[WebAudioContext.decodeAudioData](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.decodeAudioData.html)方法从一个音频文件构建，或者利用 [AudioContext.createBuffer](#)从原始数据构建。把音频放入AudioBuffer后，可以传入到一个 AudioBufferSourceNode进行播放。 */
  interface AudioBuffer {
    /** 返回存储在缓存区的PCM数据的时长（单位为秒） */
    duration: number;
    /** 返回存储在缓存区的PCM数据的采样帧率 */
    length: number;
    /** 储存在缓存区的PCM数据的通道数 */
    numberOfChannels: number;
    /** 存储在缓存区的PCM数据的采样率（单位为sample/s) */
    sampleRate: number;
  }
  interface AuthPrivateMessageOption {
    /** shareTicket。可以从 wx.onShow 中获取。详情 [shareTicket](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html) */
    shareTicket: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AuthPrivateMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AuthPrivateMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AuthPrivateMessageSuccessCallback;
  }
  interface AuthPrivateMessageSuccessCallbackResult {
    /** 经过加密的activityId，解密后可得到原始的activityId。若解密后得到的activityId可以与开发者后台的活动id对应上则验证通过，否则表明valid字段不可靠（被篡改） 详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    encryptedData: string;
    /** 错误信息 */
    errMsg: string;
    /** 加密算法的初始向量，详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    iv: string;
    /** 验证是否通过 */
    valid: boolean;
  }
  /** 用户授权设置信息，详情参考[权限](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html) */
  interface AuthSetting {
    /** 是否授权系统日历，对应接口 [wx.addPhoneRepeatCalendar](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneRepeatCalendar.html)、[wx.addPhoneCalendar](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneCalendar.html) */
    'scope.addPhoneCalendar'?: boolean;
    /** 是否添加通讯录联系人，对应接口 [wx.addPhoneContact](https://developers.weixin.qq.com/miniprogram/dev/api/device/contact/wx.addPhoneContact.html) */
    'scope.addPhoneContact'?: boolean;
    /** 是否授权通讯地址，已取消此项授权，会默认返回true */
    'scope.address'?: boolean;
    /** 是否授权蓝牙，对应接口 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html)、[wx.createBLEPeripheralServer](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.createBLEPeripheralServer.html) */
    'scope.bluetooth'?: boolean;
    /** 是否授权摄像头，对应[[camera](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html)](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html) 组件 */
    'scope.camera'?: boolean;
    /** 是否授权获取发票，已取消此项授权，会默认返回true */
    'scope.invoice'?: boolean;
    /** 是否授权发票抬头，已取消此项授权，会默认返回true */
    'scope.invoiceTitle'?: boolean;
    /** 是否授权录音功能，对应接口 [wx.startRecord](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.startRecord.html) */
    'scope.record'?: boolean;
    /** 是否授权用户信息，对应接口 [wx.getUserInfo](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html) */
    'scope.userInfo'?: boolean;
    /** 是否授权地理位置，对应接口 [wx.getLocation](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html), [wx.chooseLocation](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.chooseLocation.html) */
    'scope.userLocation'?: boolean;
    /** 是否授权微信运动步数，对应接口 [wx.getWeRunData](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/werun/wx.getWeRunData.html) */
    'scope.werun'?: boolean;
    /** 是否授权保存到相册 [wx.saveImageToPhotosAlbum](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.saveImageToPhotosAlbum.html), [wx.saveVideoToPhotosAlbum](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.saveVideoToPhotosAlbum.html) */
    'scope.writePhotosAlbum'?: boolean;
  }
  interface AuthorizeForMiniProgramOption {
    /** 需要获取权限的 scope，详见 [scope 列表](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html#scope-列表)
     *
     * 可选值：
     * - 'scope.record': ;
     * - 'scope.writePhotosAlbum': ;
     * - 'scope.camera': ; */
    scope: 'scope.record' | 'scope.writePhotosAlbum' | 'scope.camera';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AuthorizeForMiniProgramCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AuthorizeForMiniProgramFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AuthorizeForMiniProgramSuccessCallback;
  }
  interface AuthorizeOption {
    /** 需要获取权限的 scope，详见 [scope 列表](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html#scope-列表) */
    scope: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: AuthorizeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: AuthorizeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: AuthorizeSuccessCallback;
  }
  /** 设备特征列表 */
  interface BLECharacteristic {
    /** 该特征支持的操作类型 */
    properties: BLECharacteristicProperties;
    /** 蓝牙设备特征的 UUID */
    uuid: string;
  }
  /** 该特征支持的操作类型 */
  interface BLECharacteristicProperties {
    /** 该特征是否支持 indicate 操作 */
    indicate: boolean;
    /** 该特征是否支持 notify 操作 */
    notify: boolean;
    /** 该特征是否支持 read 操作 */
    read: boolean;
    /** 该特征是否支持 write 操作 */
    write: boolean;
    /** 该特征是否支持有回复写操作 */
    writeDefault: boolean;
    /** 该特征是否支持无回复写操作 */
    writeNoResponse: boolean;
  }
  interface BLEPeripheralServerCloseOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SocketTaskCloseCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SocketTaskCloseFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SocketTaskCloseSuccessCallback;
  }
  /** 描述service的Object */
  interface BLEPeripheralService {
    /** characteristics列表 */
    characteristics: Characteristic[];
    /** 蓝牙服务的 UUID */
    uuid: string;
  }
  /** 设备服务列表 */
  interface BLEService {
    /** 该服务是否为主服务 */
    isPrimary: boolean;
    /** 蓝牙设备服务的 UUID */
    uuid: string;
  }
  /** BackgroundAudioManager 实例，可通过 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 获取。
*
* **示例代码**
*
* ```js
const backgroundAudioManager = wx.getBackgroundAudioManager()

backgroundAudioManager.title = '此时此刻'
backgroundAudioManager.epname = '此时此刻'
backgroundAudioManager.singer = '许巍'
backgroundAudioManager.coverImgUrl = 'http://y.gtimg.cn/music/photo_new/T002R300x300M000003rsKF44GyaSk.jpg?max_age=2592000'
// 设置了 src 之后会自动播放
``` */
  interface BackgroundAudioManager {
    /** 音频已缓冲的时间，仅保证当前播放时间点到此时间点内容已缓冲。（只读） */
    buffered: number;
    /** 封面图 URL，用于做原生音频播放器背景图。原生音频播放器中的分享功能，分享出去的卡片配图及背景也将使用该图。 */
    coverImgUrl: string;
    /** 当前音频的播放位置（单位：s），只有在有合法 src 时返回。（只读） */
    currentTime: number;
    /** 当前音频的长度（单位：s），只有在有合法 src 时返回。（只读） */
    duration: number;
    /** 专辑名，原生音频播放器中的分享功能，分享出去的卡片简介，也将使用该值。 */
    epname: string;
    /** 当前是否暂停或停止。（只读） */
    paused: boolean;
    /** 需要基础库： `2.11.0`
     *
     * 播放速度。范围 0.5-2.0，默认为 1。（Android 需要 6 及以上版本） */
    playbackRate: number;
    /** 需要基础库： `1.9.94`
     *
     * 音频协议。默认值为 'http'，设置 'hls' 可以支持播放 HLS 协议的直播音频。 */
    protocol: string;
    /** 需要基础库： `2.13.0`
     *
     * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
    referrerPolicy: string;
    /** 歌手名，原生音频播放器中的分享功能，分享出去的卡片简介，也将使用该值。 */
    singer: string;
    /** 音频的数据源（[2.2.3](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 开始支持云文件ID）。默认为空字符串，**当设置了新的 src 时，会自动开始播放**，目前支持的格式有 m4a, aac, mp3, wav。 */
    src: string;
    /** 音频开始播放的位置（单位：s）。 */
    startTime: number;
    /** 音频标题，用于原生音频播放器音频标题（必填）。原生音频播放器中的分享功能，分享出去的卡片标题，也将使用该值。 */
    title: string;
    /** 页面链接，原生音频播放器中的分享功能，分享出去的卡片简介，也将使用该值。 */
    webUrl: string;
  }
  interface BatchGetStorageOption {
    /** 本地缓存中指定的 keyList */
    keyList: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: BatchGetStorageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: BatchGetStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: BatchGetStorageSuccessCallback;
  }
  interface BatchSetStorageOption {
    /** [{ key, value }] */
    kvList: any[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: BatchSetStorageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: BatchSetStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: BatchSetStorageSuccessCallback;
  }
  /** Beacon 设备 */
  interface BeaconInfo {
    /** Beacon 设备的距离，单位 m。iOS 上，proximity 为 0 时，accuracy 为 -1。 */
    accuracy: number;
    /** Beacon 设备的主 ID */
    major: number;
    /** Beacon 设备的次 ID */
    minor: number;
    /** 表示设备距离的枚举值（仅iOS）
     *
     * 可选值：
     * - 0: 信号太弱不足以计算距离，或非 iOS 设备;
     * - 1: 十分近;
     * - 2: 比较近;
     * - 3: 远; */
    proximity: 0 | 1 | 2 | 3;
    /** 表示设备的信号强度，单位 dBm */
    rssi: number;
    /** Beacon 设备广播的 UUID */
    uuid: string;
  }
  /** 需要基础库： `2.20.1`
   *
   * 以 beacon 设备形式广播的参数。 */
  interface BeaconInfoObj {
    /** Beacon 设备的主 ID */
    major: number;
    /** Beacon 设备的次 ID */
    minor: number;
    /** Beacon 设备广播的 UUID */
    uuid: string;
    /** 用于判断距离设备 1 米时 RSSI 大小的参考值 */
    measuredPower?: number;
  }
  interface BindWifiOption {
    /** 当前 wifi 网络的 BSSID ，可通过 wx.getConnectedWifi 获取 */
    BSSID: string;
  }
  interface BlueToothDevice {
    /** 当前蓝牙设备的信号强度，单位 dBm */
    RSSI: number;
    /** 当前蓝牙设备的广播数据段中的 ManufacturerData 数据段。 */
    advertisData: ArrayBuffer;
    /** 当前蓝牙设备的广播数据段中的 ServiceUUIDs 数据段 */
    advertisServiceUUIDs: string[];
    /** 当前蓝牙设备是否可连接（ Android 8.0 以下不支持返回该值 ） */
    connectable: boolean;
    /** 蓝牙设备 id */
    deviceId: string;
    /** 当前蓝牙设备的广播数据段中的 LocalName 数据段 */
    localName: string;
    /** 蓝牙设备名称，某些设备可能没有 */
    name: string;
    /** 当前蓝牙设备的广播数据段中的 ServiceData 数据段 */
    serviceData: IAnyObject;
  }
  /** 搜索到的设备列表 */
  interface BluetoothDeviceInfo {
    /** 用于区分设备的 id */
    deviceId: string;
    /** 蓝牙设备名称，某些设备可能没有 */
    name: string;
  }
  interface BlurOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: BlurCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: BlurFailCallback;
    /** 接口调用成功的回调函数 */
    success?: BlurSuccessCallback;
  }
  /** 需要基础库： `2.28.0`
   *
   * 人体检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html)。 */
  interface BodyTrack {
    /** 需要基础库： `2.28.0`
     *
     * 人体检测模式
     *
     * 可选值：
     * - 1: 通过摄像头实时检测;
     * - 2: 静态图片检测; */
    mode: 1 | 2;
  }
  interface BoundingClientRectCallbackResult {
    /** 节点的下边界坐标 */
    bottom: number;
    /** 节点的 dataset */
    dataset: IAnyObject;
    /** 节点的高度 */
    height: number;
    /** 节点的 ID */
    id: string;
    /** 节点的左边界坐标 */
    left: number;
    /** 节点的右边界坐标 */
    right: number;
    /** 节点的上边界坐标 */
    top: number;
    /** 节点的宽度 */
    width: number;
  }
  /** 目标边界 */
  interface BoundingClientRectResult {
    /** 下边界 */
    bottom: number;
    /** 高度 */
    height: number;
    /** 左边界 */
    left: number;
    /** 右边界 */
    right: number;
    /** 上边界 */
    top: number;
    /** 宽度 */
    width: number;
  }
  /** 需要基础库： `2.24.0`
   *
   * 缓存管理器。全局只有唯一实例，一旦被创建出来即表示接入缓存管理器。其有以下几个能力：
   *
   * 1. 在网络通畅时，符合一定规则的用户网络请求（目前只包括普通 wx.request 请求）会被缓存。
   * 2. 在网络通畅时，某些 wx api 调用会被缓存。
   * 3. 进入弱网/离线状态时，会提供事件给用户，用户可以决定是否使用缓存返回。
   * 4. 提供进入和退出弱网/离线状态的事件。
   *
   * > 1. 缓存管理器中涉及的网络请求如无特指，均指普通的 wx.request 异步请求，参数和返回值中均不考虑涉及 ArrayBuffer 或 TypedArray 的情形。
   * > 2. 缓存管理器中的缓存不会占用 storage 空间，但是有大小限制，请勿在非必要的请求上使用缓存。 */
  interface CacheManager {
    /** 全局缓存有效时间 */
    maxAge: string;
    /** 当前缓存模式
     *
     * 可选值：
     * - 'weakNetwork': 默认值，弱网/离线使用缓存返回;
     * - 'always': 总是使用缓存返回;
     * - 'none': 不开启，后续可手动开启/停止使用缓存返回; */
    mode: 'weakNetwork' | 'always' | 'none';
    /** 全局 origin */
    origin: string;
    /** 当前缓存管理器状态
     *
     * 可选值：
     * - 0: 不使用缓存返回;
     * - 1: 使用缓存返回;
     * - 2: 未知; */
    state: 0 | 1 | 2;
  }
  interface CameraContextSetZoomOption {
    /** 缩放级别，范围[1, maxZoom]。zoom 可取小数，精确到小数后一位。maxZoom 可在 bindinitdone 返回值中获取。 */
    zoom: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetZoomCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetZoomFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CameraContextSetZoomSuccessCallback;
  }
  interface CameraContextStartRecordOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartRecordCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartRecordFailCallback;
    /** 需要基础库： `2.22.0`
     *
     * 是否开启镜像 */
    selfieMirror?: boolean;
    /** 接口调用成功的回调函数 */
    success?: CameraContextStartRecordSuccessCallback;
    /** 需要基础库： `2.22.0`
     *
     * 录制时长上限，单位为秒，最长不能超过 5 分钟 */
    timeout?: number;
    /** 超过录制时长上限时会结束录像并触发此回调，录像异常退出时也会触发此回调 */
    timeoutCallback?: StartRecordTimeoutCallback;
  }
  interface CameraContextStopRecordOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopRecordCompleteCallback;
    /** 启动视频压缩，压缩效果同`chooseVideo` */
    compressed?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: StopRecordFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CameraContextStopRecordSuccessCallback;
  }
  interface CameraFrameListenerStartOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartSuccessCallback;
    /** [Worker](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.html)
     *
     * 需要基础库： `2.25.1`
     *
     * 可选参数。如果需要在 iOS ExperimentalWorker 内监听摄像头帧数据，则需要传入对应 Worker 对象。详情 [Worker.getCameraFrameData](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.getCameraFrameData.html) */
    worker?: Worker;
  }
  /** 需要基础库： `2.7.0`
   *
   * Canvas 实例，可通过 [SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) 获取。
   *
   * **示例代码**
   *
   * 2D Canvas 示例
   * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/SHfgCmmq7UcM)
   *
   * WebGL 示例
   * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/qEGUOqmf7T8z) */
  interface Canvas {
    /** 画布高度 */
    height: number;
    /** 画布宽度 */
    width: number;
  }
  /** @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
   *
   * canvas 组件的绘图上下文。CanvasContext 是旧版的接口， 新版 Canvas 2D 接口与 Web 一致。 */
  interface CanvasContext {
    /** 需要基础库： `1.9.90`
     *
     * 填充颜色。用法同 [CanvasContext.setFillStyle()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setFillStyle.html)。 */
    fillStyle: string | CanvasGradient;
    /** 需要基础库： `1.9.90`
     *
     * 当前字体样式的属性。符合 [CSS font 语法](https://developer.mozilla.org/zh-CN/docs/Web/CSS/font) 的 DOMString 字符串，至少需要提供字体大小和字体族名。默认值为 10px sans-serif。 */
    font: string;
    /** 全局画笔透明度。范围 0-1，0 表示完全透明，1 表示完全不透明。 */
    globalAlpha: number;
    /** 需要基础库： `1.9.90`
     *
     * 在绘制新形状时应用的合成操作的类型。目前安卓版本只适用于 `fill` 填充块的合成，用于 `stroke` 线段的合成效果都是 `source-over`。
     *
     * 目前支持的操作有
     * - 安卓：xor, source-over, source-atop, destination-out, lighter, overlay, darken, lighten, hard-light
     * - iOS：xor, source-over, source-atop, destination-over, destination-out, lighter, multiply, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, saturation, luminosity */
    globalCompositeOperation: string;
    /** 需要基础库： `1.9.90`
     *
     * 线条的端点样式。用法同 [CanvasContext.setLineCap()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineCap.html)。 */
    lineCap: string;
    /** 需要基础库： `1.9.90`
     *
     * 虚线偏移量，初始值为0 */
    lineDashOffset: number;
    /** 需要基础库： `1.9.90`
     *
     * 线条的交点样式。用法同 [CanvasContext.setLineJoin()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineJoin.html)。
     *
     * 可选值：
     * - 'bevel': 斜角;
     * - 'round': 圆角;
     * - 'miter': 尖角; */
    lineJoin: 'bevel' | 'round' | 'miter';
    /** 需要基础库： `1.9.90`
     *
     * 线条的宽度。用法同 [CanvasContext.setLineWidth()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineWidth.html)。 */
    lineWidth: number;
    /** 需要基础库： `1.9.90`
     *
     * 最大斜接长度。用法同 [CanvasContext.setMiterLimit()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setMiterLimit.html)。 */
    miterLimit: number;
    /** 需要基础库： `1.9.90`
     *
     * 阴影的模糊级别 */
    shadowBlur: number;
    /** 需要基础库： `1.9.90`
     *
     * 阴影的颜色 */
    shadowColor: number;
    /** 需要基础库： `1.9.90`
     *
     * 阴影相对于形状在水平方向的偏移 */
    shadowOffsetX: number;
    /** 需要基础库： `1.9.90`
     *
     * 阴影相对于形状在竖直方向的偏移 */
    shadowOffsetY: number;
    /** 需要基础库： `1.9.90`
     *
     * 边框颜色。用法同 [CanvasContext.setStrokeStyle()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setStrokeStyle.html)。 */
    strokeStyle: string | CanvasGradient;
  }
  interface CanvasGetImageDataOption {
    /** 画布标识，传入 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件的 `canvas-id` 属性。 */
    canvasId: string;
    /** 将要被提取的图像数据矩形区域的高度 */
    height: number;
    /** 将要被提取的图像数据矩形区域的宽度 */
    width: number;
    /** 将要被提取的图像数据矩形区域的左上角横坐标 */
    x: number;
    /** 将要被提取的图像数据矩形区域的左上角纵坐标 */
    y: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CanvasGetImageDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CanvasGetImageDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CanvasGetImageDataSuccessCallback;
  }
  interface CanvasGetImageDataSuccessCallbackResult {
    /** 图像像素点数据，一维数组，每四项表示一个像素点的 rgba */
    data: Uint8ClampedArray;
    /** 图像数据矩形的高度 */
    height: number;
    /** 图像数据矩形的宽度 */
    width: number;
    errMsg: string;
  }
  interface CanvasPutImageDataOption {
    /** 画布标识，传入 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件的 canvas-id 属性。 */
    canvasId: string;
    /** 图像像素点数据，一维数组，每四项表示一个像素点的 rgba */
    data: Uint8ClampedArray;
    /** 源图像数据矩形区域的高度 */
    height: number;
    /** 源图像数据矩形区域的宽度 */
    width: number;
    /** 源图像数据在目标画布中的位置偏移量（x 轴方向的偏移量） */
    x: number;
    /** 源图像数据在目标画布中的位置偏移量（y 轴方向的偏移量） */
    y: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CanvasPutImageDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CanvasPutImageDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CanvasPutImageDataSuccessCallback;
  }
  interface CanvasToTempFilePathOption {
    /** 画布标识，传入 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件实例 （canvas type="2d" 时使用该属性）。 */
    canvas?: IAnyObject;
    /** 画布标识，传入 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件的 canvas-id */
    canvasId?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CanvasToTempFilePathCompleteCallback;
    /** 需要基础库： `1.2.0`
     *
     * 输出的图片的高度 */
    destHeight?: number;
    /** 需要基础库： `1.2.0`
     *
     * 输出的图片的宽度 */
    destWidth?: number;
    /** 接口调用失败的回调函数 */
    fail?: CanvasToTempFilePathFailCallback;
    /** 需要基础库： `1.7.0`
     *
     * 目标文件的类型
     *
     * 可选值：
     * - 'jpg': jpg 图片;
     * - 'png': png 图片; */
    fileType?: 'jpg' | 'png';
    /** 需要基础库： `1.2.0`
     *
     * 指定的画布区域的高度 */
    height?: number;
    /** 需要基础库： `1.7.0`
     *
     * 图片的质量，目前仅对 jpg 有效。取值范围为 (0, 1]，不在范围内时当作 1.0 处理。 */
    quality?: number;
    /** 接口调用成功的回调函数 */
    success?: CanvasToTempFilePathSuccessCallback;
    /** 需要基础库： `1.2.0`
     *
     * 指定的画布区域的宽度 */
    width?: number;
    /** 需要基础库： `1.2.0`
     *
     * 指定的画布区域的左上角横坐标 */
    x?: number;
    /** 需要基础库： `1.2.0`
     *
     * 指定的画布区域的左上角纵坐标 */
    y?: number;
  }
  interface CanvasToTempFilePathSuccessCallbackResult {
    /** 生成文件的临时路径 (本地路径) */
    tempFilePath: string;
    errMsg: string;
  }
  /** characteristics列表 */
  interface Characteristic {
    /** characteristic 的 UUID */
    uuid: string;
    /** 描述符数据 */
    descriptors?: CharacteristicDescriptor[];
    /** 特征权限 */
    permission?: CharacteristicPermission;
    /** 特征支持的操作 */
    properties?: CharacteristicProperties;
    /** 特征对应的二进制值 */
    value?: ArrayBuffer;
  }
  /** 描述符数据 */
  interface CharacteristicDescriptor {
    /** Descriptor 的 UUID */
    uuid: string;
    /** 描述符的权限 */
    permission?: DescriptorPermission;
    /** 描述符数据 */
    value?: ArrayBuffer;
  }
  /** 特征权限 */
  interface CharacteristicPermission {
    /** 加密读请求 */
    readEncryptionRequired?: boolean;
    /** 可读 */
    readable?: boolean;
    /** 加密写请求 */
    writeEncryptionRequired?: boolean;
    /** 可写 */
    writeable?: boolean;
  }
  /** 特征支持的操作 */
  interface CharacteristicProperties {
    /** 回包 */
    indicate?: boolean;
    /** 订阅 */
    notify?: boolean;
    /** 读 */
    read?: boolean;
    /** 写 */
    write?: boolean;
    /** 无回复写 */
    writeNoResponse?: boolean;
  }
  interface CheckIsAddedToMyMiniProgramOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CheckIsAddedToMyMiniProgramCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CheckIsAddedToMyMiniProgramFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CheckIsAddedToMyMiniProgramSuccessCallback;
  }
  interface CheckIsAddedToMyMiniProgramSuccessCallbackResult {
    /** 是否被添加至 「我的小程序」 */
    added: boolean;
    errMsg: string;
  }
  interface CheckIsOpenAccessibilityOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CheckIsOpenAccessibilityCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CheckIsOpenAccessibilityFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CheckIsOpenAccessibilitySuccessCallback;
  }
  interface CheckIsOpenAccessibilitySuccessCallbackOption {
    /** iOS 上开启辅助功能旁白，安卓开启 talkback 时返回 true */
    open: boolean;
    errMsg: string;
  }
  interface CheckIsSoterEnrolledInDeviceOption {
    /** 认证方式
     *
     * 可选值：
     * - 'fingerPrint': 指纹识别;
     * - 'facial': 人脸识别;
     * - 'speech': 声纹识别（暂未支持）; */
    checkAuthMode: 'fingerPrint' | 'facial' | 'speech';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CheckIsSoterEnrolledInDeviceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CheckIsSoterEnrolledInDeviceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CheckIsSoterEnrolledInDeviceSuccessCallback;
  }
  interface CheckIsSoterEnrolledInDeviceSuccessCallbackResult {
    /** 错误信息 */
    errMsg: string;
    /** 是否已录入信息 */
    isEnrolled: boolean;
  }
  interface CheckIsSupportSoterAuthenticationOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CheckIsSupportSoterAuthenticationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CheckIsSupportSoterAuthenticationFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CheckIsSupportSoterAuthenticationSuccessCallback;
  }
  interface CheckIsSupportSoterAuthenticationSuccessCallbackResult {
    /** 该设备支持的可被SOTER识别的生物识别方式
     *
     * 可选值：
     * - 'fingerPrint': 指纹识别;
     * - 'facial': 人脸识别;
     * - 'speech': 声纹识别（暂未支持）; */
    supportMode: Array<'fingerPrint' | 'facial' | 'speech'>;
    errMsg: string;
  }
  interface CheckSessionOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CheckSessionCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CheckSessionFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CheckSessionSuccessCallback;
  }
  interface ChooseAddressOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseAddressCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseAddressFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseAddressSuccessCallback;
  }
  interface ChooseAddressSuccessCallbackResult {
    /** 国标收货地址第二级地址 */
    cityName: string;
    /** 国标收货地址第三级地址 */
    countyName: string;
    /** 详细收货地址信息（包括街道地址） */
    detailInfo: string;
    /** 新选择器详细收货地址信息 */
    detailInfoNew: string;
    /** 错误信息 */
    errMsg: string;
    /** 收货地址国家码 */
    nationalCode: string;
    /** 邮编 */
    postalCode: string;
    /** 国标收货地址第一级地址 */
    provinceName: string;
    /** 国标收货地址第四级地址 */
    streetName: string;
    /** 收货人手机号码 */
    telNumber: string;
    /** 收货人姓名 */
    userName: string;
  }
  interface ChooseContactOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseContactCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseContactFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseContactSuccessCallback;
  }
  interface ChooseContactSuccessCallbackOption {
    /** 联系人姓名 */
    displayName: string;
    /** 手机号 */
    phoneNumber: string;
    /** 选定联系人的所有手机号（部分 Android 系统只能选联系人而不能选特定手机号） */
    phoneNumberList: string;
    errMsg: string;
  }
  /** 返回选择的文件的本地临时文件对象数组 */
  interface ChooseFile {
    /** 选择的文件名称 */
    name: string;
    /** 本地临时文件路径 (本地路径) */
    path: string;
    /** 本地临时文件大小，单位 B */
    size: number;
    /** 选择的文件的会话发送时间，Unix时间戳，工具暂不支持此属性 */
    time: number;
    /** 选择的文件类型
     *
     * 可选值：
     * - 'video': 选择了视频文件;
     * - 'image': 选择了图片文件;
     * - 'file': 选择了除图片和视频的文件; */
    type: 'video' | 'image' | 'file';
  }
  interface ChooseImageOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseImageCompleteCallback;
    /** 最多可以选择的图片张数 */
    count?: number;
    /** 接口调用失败的回调函数 */
    fail?: ChooseImageFailCallback;
    /** 所选的图片的尺寸
     *
     * 可选值：
     * - 'original': 原图;
     * - 'compressed': 压缩图; */
    sizeType?: Array<'original' | 'compressed'>;
    /** 选择图片的来源
     *
     * 可选值：
     * - 'album': 从相册选图;
     * - 'camera': 使用相机; */
    sourceType?: Array<'album' | 'camera'>;
    /** 接口调用成功的回调函数 */
    success?: ChooseImageSuccessCallback;
  }
  interface ChooseImageSuccessCallbackResult {
    /** 图片的本地临时文件路径列表 (本地路径) */
    tempFilePaths: string[];
    /** 需要基础库： `1.2.0`
     *
     * 图片的本地临时文件列表 */
    tempFiles: ImageFile[];
    errMsg: string;
  }
  interface ChooseInvoiceOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseInvoiceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseInvoiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseInvoiceSuccessCallback;
  }
  interface ChooseInvoiceSuccessCallbackResult {
    /** 用户选中的发票信息，格式为一个 JSON 字符串，包含三个字段： card_id：所选发票卡券的 cardId，encrypt_code：所选发票卡券的加密 code，报销方可以通过 cardId 和 encryptCode 获得报销发票的信息，app_id： 发票方的 appId。 */
    invoiceInfo: string;
    errMsg: string;
  }
  interface ChooseInvoiceTitleOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseInvoiceTitleCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseInvoiceTitleFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseInvoiceTitleSuccessCallback;
  }
  interface ChooseInvoiceTitleSuccessCallbackResult {
    /** 银行账号 */
    bankAccount: string;
    /** 银行名称 */
    bankName: string;
    /** 单位地址 */
    companyAddress: string;
    /** 错误信息 */
    errMsg: string;
    /** 抬头税号 */
    taxNumber: string;
    /** 手机号码 */
    telephone: string;
    /** 抬头名称 */
    title: string;
    /** 抬头类型
     *
     * 可选值：
     * - 0: 单位;
     * - 1: 个人; */
    type: 0 | 1;
  }
  interface ChooseLicensePlateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseLicensePlateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseLicensePlateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseLicensePlateSuccessCallback;
  }
  interface ChooseLicensePlateSuccessCallbackResult {
    /** 用户选择的车牌号 */
    plateNumber: string;
    errMsg: string;
  }
  interface ChooseLocationOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChooseLocationFailCallback;
    /** 需要基础库： `2.9.0`
     *
     * 目标地纬度 */
    latitude?: number;
    /** 需要基础库： `2.9.0`
     *
     * 目标地经度 */
    longitude?: number;
    /** 接口调用成功的回调函数 */
    success?: ChooseLocationSuccessCallback;
  }
  interface ChooseLocationSuccessCallbackResult {
    /** 详细地址 */
    address: string;
    /** 纬度，浮点数，范围为-90~90，负数表示南纬。使用 gcj02 国测局坐标系 */
    latitude: number;
    /** 经度，浮点数，范围为-180~180，负数表示西经。使用 gcj02 国测局坐标系 */
    longitude: number;
    /** 位置名称 */
    name: string;
    errMsg: string;
  }
  interface ChooseMediaOption {
    /** 仅在 sourceType 为 camera 时生效，使用前置或后置摄像头
     *
     * 可选值：
     * - 'back': 使用后置摄像头;
     * - 'front': 使用前置摄像头; */
    camera?: 'back' | 'front';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseMediaCompleteCallback;
    /** 最多可以选择的文件个数，基础库2.25.0前，最多可支持9个文件，2.25.0及以后最多可支持20个文件 */
    count?: number;
    /** 接口调用失败的回调函数 */
    fail?: ChooseMediaFailCallback;
    /** 拍摄视频最长拍摄时间，单位秒。时间范围为 3s 至 60s 之间。不限制相册。 */
    maxDuration?: number;
    /** 文件类型
     *
     * 可选值：
     * - 'image': 只能拍摄图片或从相册选择图片;
     * - 'video': 只能拍摄视频或从相册选择视频;
     * - 'mix': 可同时选择图片和视频; */
    mediaType?: Array<'image' | 'video' | 'mix'>;
    /** 是否压缩所选文件，基础库2.25.0前仅对 mediaType 为 image 时有效，2.25.0及以后对全量 mediaType 有效 */
    sizeType?: string[];
    /** 图片和视频选择的来源
     *
     * 可选值：
     * - 'album': 从相册选择;
     * - 'camera': 使用相机拍摄; */
    sourceType?: Array<'album' | 'camera'>;
    /** 接口调用成功的回调函数 */
    success?: ChooseMediaSuccessCallback;
  }
  interface ChooseMediaSuccessCallbackResult {
    /** 本地临时文件列表 */
    tempFiles: MediaFile[];
    /** 文件类型，有效值有 image 、video、mix */
    type: string;
    errMsg: string;
  }
  interface ChooseMessageFileOption {
    /** 最多可以选择的文件个数，可以 0～100 */
    count: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseMessageFileCompleteCallback;
    /** 需要基础库： `2.6.0`
     *
     * 根据文件拓展名过滤，仅 type==file 时有效。每一项都不能是空字符串。默认不过滤。 */
    extension?: string[];
    /** 接口调用失败的回调函数 */
    fail?: ChooseMessageFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChooseMessageFileSuccessCallback;
    /** 所选的文件的类型
     *
     * 可选值：
     * - 'all': 从所有文件选择;
     * - 'video': 只能选择视频文件;
     * - 'image': 只能选择图片文件;
     * - 'file': 可以选择除了图片和视频之外的其它的文件; */
    type?: 'all' | 'video' | 'image' | 'file';
  }
  interface ChooseMessageFileSuccessCallbackResult {
    /** 返回选择的文件的本地临时文件对象数组 */
    tempFiles: ChooseFile[];
    errMsg: string;
  }
  interface ChoosePoiOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChoosePoiCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ChoosePoiFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ChoosePoiSuccessCallback;
  }
  interface ChoosePoiSuccessCallbackResult {
    /** 详细地址 */
    address: string;
    /** 城市名称 */
    city: number;
    /** 纬度，浮点数，范围为-90~90，负数表示南纬。使用 gcj02 国测局坐标系（即将废弃） */
    latitude: number;
    /** 经度，浮点数，范围为-180~180，负数表示西经。使用 gcj02 国测局坐标系（即将废弃） */
    longitude: number;
    /** 位置名称 */
    name: string;
    /** 选择城市时，值为 1，选择精确位置时，值为 2 */
    type: number;
    errMsg: string;
  }
  interface ChooseVideoOption {
    /** 默认拉起的是前置或者后置摄像头。部分 Android 手机下由于系统 ROM 不支持无法生效
     *
     * 可选值：
     * - 'back': 默认拉起后置摄像头;
     * - 'front': 默认拉起前置摄像头; */
    camera?: 'back' | 'front';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ChooseVideoCompleteCallback;
    /** 需要基础库： `1.6.0`
     *
     * 是否压缩所选择的视频文件 */
    compressed?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: ChooseVideoFailCallback;
    /** 拍摄视频最长拍摄时间，单位秒 */
    maxDuration?: number;
    /** 视频选择的来源
     *
     * 可选值：
     * - 'album': 从相册选择视频;
     * - 'camera': 使用相机拍摄视频; */
    sourceType?: Array<'album' | 'camera'>;
    /** 接口调用成功的回调函数 */
    success?: ChooseVideoSuccessCallback;
  }
  interface ChooseVideoSuccessCallbackResult {
    /** 选定视频的时间长度 */
    duration: number;
    /** 返回选定视频的高度 */
    height: number;
    /** 选定视频的数据量大小 */
    size: number;
    /** 选定视频的临时文件路径 (本地路径) */
    tempFilePath: string;
    /** 返回选定视频的宽度 */
    width: number;
    errMsg: string;
  }
  interface ClearFiltersOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ClearFiltersCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ClearFiltersFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ClearFiltersSuccessCallback;
  }
  interface ClearMakeupsOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ClearMakeupsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ClearMakeupsFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ClearMakeupsSuccessCallback;
  }
  interface ClearOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ClearCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ClearFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ClearSuccessCallback;
  }
  interface ClearStickersOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ClearStickersCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ClearStickersFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ClearStickersSuccessCallback;
  }
  interface ClearStorageOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ClearStorageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ClearStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ClearStorageSuccessCallback;
  }
  /** 菜单按钮的布局位置信息 */
  interface ClientRect {
    /** 下边界坐标，单位：px */
    bottom: number;
    /** 高度，单位：px */
    height: number;
    /** 左边界坐标，单位：px */
    left: number;
    /** 右边界坐标，单位：px */
    right: number;
    /** 上边界坐标，单位：px */
    top: number;
    /** 宽度，单位：px */
    width: number;
  }
  interface CloseBLEConnectionOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CloseBLEConnectionCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CloseBLEConnectionFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CloseBLEConnectionSuccessCallback;
  }
  interface CloseBluetoothAdapterOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CloseBluetoothAdapterCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CloseBluetoothAdapterFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CloseBluetoothAdapterSuccessCallback;
  }
  interface CloseSocketOption {
    /** 一个数字值表示关闭连接的状态号，表示连接被关闭的原因。 */
    code?: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CloseSocketCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CloseSocketFailCallback;
    /** 一个可读的字符串，表示连接被关闭的原因。这个字符串必须是不长于 123 字节的 UTF-8 文本（不是字符）。 */
    reason?: string;
    /** 接口调用成功的回调函数 */
    success?: CloseSocketSuccessCallback;
  }
  interface CloseSyncOption {
    /** 需要被关闭的文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
  }
  /** 颜色。可以用以下几种方式来表示 canvas 中使用的颜色：
   *
   * - RGB 颜色： 如 `'rgb(255, 0, 0)'`
   * - RGBA 颜色：如 `'rgba(255, 0, 0, 0.3)'`
   * - 16 进制颜色： 如 `'#FF0000'`
   * - 预定义的颜色： 如 `'red'`
   *
   * 其中预定义颜色有以下148个：
   * *注意**: Color Name 大小写不敏感
   *
   * | Color Name           | HEX     |
   * | -------------------- | ------- |
   * | AliceBlue            | #F0F8FF |
   * | AntiqueWhite         | #FAEBD7 |
   * | Aqua                 | #00FFFF |
   * | Aquamarine           | #7FFFD4 |
   * | Azure                | #F0FFFF |
   * | Beige                | #F5F5DC |
   * | Bisque               | #FFE4C4 |
   * | Black                | #000000 |
   * | BlanchedAlmond       | #FFEBCD |
   * | Blue                 | #0000FF |
   * | BlueViolet           | #8A2BE2 |
   * | Brown                | #A52A2A |
   * | BurlyWood            | #DEB887 |
   * | CadetBlue            | #5F9EA0 |
   * | Chartreuse           | #7FFF00 |
   * | Chocolate            | #D2691E |
   * | Coral                | #FF7F50 |
   * | CornflowerBlue       | #6495ED |
   * | Cornsilk             | #FFF8DC |
   * | Crimson              | #DC143C |
   * | Cyan                 | #00FFFF |
   * | DarkBlue             | #00008B |
   * | DarkCyan             | #008B8B |
   * | DarkGoldenRod        | #B8860B |
   * | DarkGray             | #A9A9A9 |
   * | DarkGrey             | #A9A9A9 |
   * | DarkGreen            | #006400 |
   * | DarkKhaki            | #BDB76B |
   * | DarkMagenta          | #8B008B |
   * | DarkOliveGreen       | #556B2F |
   * | DarkOrange           | #FF8C00 |
   * | DarkOrchid           | #9932CC |
   * | DarkRed              | #8B0000 |
   * | DarkSalmon           | #E9967A |
   * | DarkSeaGreen         | #8FBC8F |
   * | DarkSlateBlue        | #483D8B |
   * | DarkSlateGray        | #2F4F4F |
   * | DarkSlateGrey        | #2F4F4F |
   * | DarkTurquoise        | #00CED1 |
   * | DarkViolet           | #9400D3 |
   * | DeepPink             | #FF1493 |
   * | DeepSkyBlue          | #00BFFF |
   * | DimGray              | #696969 |
   * | DimGrey              | #696969 |
   * | DodgerBlue           | #1E90FF |
   * | FireBrick            | #B22222 |
   * | FloralWhite          | #FFFAF0 |
   * | ForestGreen          | #228B22 |
   * | Fuchsia              | #FF00FF |
   * | Gainsboro            | #DCDCDC |
   * | GhostWhite           | #F8F8FF |
   * | Gold                 | #FFD700 |
   * | GoldenRod            | #DAA520 |
   * | Gray                 | #808080 |
   * | Grey                 | #808080 |
   * | Green                | #008000 |
   * | GreenYellow          | #ADFF2F |
   * | HoneyDew             | #F0FFF0 |
   * | HotPink              | #FF69B4 |
   * | IndianRed            | #CD5C5C |
   * | Indigo               | #4B0082 |
   * | Ivory                | #FFFFF0 |
   * | Khaki                | #F0E68C |
   * | Lavender             | #E6E6FA |
   * | LavenderBlush        | #FFF0F5 |
   * | LawnGreen            | #7CFC00 |
   * | LemonChiffon         | #FFFACD |
   * | LightBlue            | #ADD8E6 |
   * | LightCoral           | #F08080 |
   * | LightCyan            | #E0FFFF |
   * | LightGoldenRodYellow | #FAFAD2 |
   * | LightGray            | #D3D3D3 |
   * | LightGrey            | #D3D3D3 |
   * | LightGreen           | #90EE90 |
   * | LightPink            | #FFB6C1 |
   * | LightSalmon          | #FFA07A |
   * | LightSeaGreen        | #20B2AA |
   * | LightSkyBlue         | #87CEFA |
   * | LightSlateGray       | #778899 |
   * | LightSlateGrey       | #778899 |
   * | LightSteelBlue       | #B0C4DE |
   * | LightYellow          | #FFFFE0 |
   * | Lime                 | #00FF00 |
   * | LimeGreen            | #32CD32 |
   * | Linen                | #FAF0E6 |
   * | Magenta              | #FF00FF |
   * | Maroon               | #800000 |
   * | MediumAquaMarine     | #66CDAA |
   * | MediumBlue           | #0000CD |
   * | MediumOrchid         | #BA55D3 |
   * | MediumPurple         | #9370DB |
   * | MediumSeaGreen       | #3CB371 |
   * | MediumSlateBlue      | #7B68EE |
   * | MediumSpringGreen    | #00FA9A |
   * | MediumTurquoise      | #48D1CC |
   * | MediumVioletRed      | #C71585 |
   * | MidnightBlue         | #191970 |
   * | MintCream            | #F5FFFA |
   * | MistyRose            | #FFE4E1 |
   * | Moccasin             | #FFE4B5 |
   * | NavajoWhite          | #FFDEAD |
   * | Navy                 | #000080 |
   * | OldLace              | #FDF5E6 |
   * | Olive                | #808000 |
   * | OliveDrab            | #6B8E23 |
   * | Orange               | #FFA500 |
   * | OrangeRed            | #FF4500 |
   * | Orchid               | #DA70D6 |
   * | PaleGoldenRod        | #EEE8AA |
   * | PaleGreen            | #98FB98 |
   * | PaleTurquoise        | #AFEEEE |
   * | PaleVioletRed        | #DB7093 |
   * | PapayaWhip           | #FFEFD5 |
   * | PeachPuff            | #FFDAB9 |
   * | Peru                 | #CD853F |
   * | Pink                 | #FFC0CB |
   * | Plum                 | #DDA0DD |
   * | PowderBlue           | #B0E0E6 |
   * | Purple               | #800080 |
   * | RebeccaPurple        | #663399 |
   * | Red                  | #FF0000 |
   * | RosyBrown            | #BC8F8F |
   * | RoyalBlue            | #4169E1 |
   * | SaddleBrown          | #8B4513 |
   * | Salmon               | #FA8072 |
   * | SandyBrown           | #F4A460 |
   * | SeaGreen             | #2E8B57 |
   * | SeaShell             | #FFF5EE |
   * | Sienna               | #A0522D |
   * | Silver               | #C0C0C0 |
   * | SkyBlue              | #87CEEB |
   * | SlateBlue            | #6A5ACD |
   * | SlateGray            | #708090 |
   * | SlateGrey            | #708090 |
   * | Snow                 | #FFFAFA |
   * | SpringGreen          | #00FF7F |
   * | SteelBlue            | #4682B4 |
   * | Tan                  | #D2B48C |
   * | Teal                 | #008080 |
   * | Thistle              | #D8BFD8 |
   * | Tomato               | #FF6347 |
   * | Turquoise            | #40E0D0 |
   * | Violet               | #EE82EE |
   * | Wheat                | #F5DEB3 |
   * | White                | #FFFFFF |
   * | WhiteSmoke           | #F5F5F5 |
   * | Yellow               | #FFFF00 |
   * | YellowGreen          | #9ACD32 | */
  interface Color {}
  interface CompressImageOption {
    /** 图片路径，图片的路径，支持本地路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CompressImageCompleteCallback;
    /** 需要基础库： `2.26.0`
     *
     * 压缩后图片的高度，单位为px，若不填写则默认以compressedWidth为准等比缩放 */
    compressedHeight?: number;
    /** 需要基础库： `2.26.0`
     *
     * 压缩后图片的宽度，单位为px，若不填写则默认以compressedHeight为准等比缩放。 */
    compressedWidth?: number;
    /** 接口调用失败的回调函数 */
    fail?: CompressImageFailCallback;
    /** 压缩质量，范围0～100，数值越小，质量越低，压缩率越高（仅对jpg有效）。 */
    quality?: number;
    /** 接口调用成功的回调函数 */
    success?: CompressImageSuccessCallback;
  }
  interface CompressImageSuccessCallbackResult {
    /** 压缩后图片的临时文件路径 (本地路径) */
    tempFilePath: string;
    errMsg: string;
  }
  interface CompressVideoOption {
    /** 码率，单位 kbps */
    bitrate: number;
    /** 帧率 */
    fps: number;
    /** 压缩质量
     *
     * 可选值：
     * - 'low': 低;
     * - 'medium': 中;
     * - 'high': 高; */
    quality: 'low' | 'medium' | 'high';
    /** 相对于原视频的分辨率比例，取值范围(0, 1] */
    resolution: number;
    /** 视频文件路径，可以是临时文件路径也可以是永久文件路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CompressVideoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CompressVideoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CompressVideoSuccessCallback;
  }
  interface CompressVideoSuccessCallbackResult {
    /** 压缩后的大小，单位 kB */
    size: string;
    /** 压缩后的临时文件地址 */
    tempFilePath: string;
    errMsg: string;
  }
  interface ConnectSocketOption {
    /** 开发者服务器 wss 接口地址 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ConnectSocketCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ConnectSocketFailCallback;
    /** 需要基础库： `2.29.0`
     *
     * wifi下使用移动网络发送请求 */
    forceCellularNetwork?: boolean;
    /** HTTP Header，Header 中不能设置 Referer */
    header?: IAnyObject;
    /** 需要基础库： `2.8.0`
     *
     * 是否开启压缩扩展 */
    perMessageDeflate?: boolean;
    /** 需要基础库： `1.4.0`
     *
     * 子协议数组 */
    protocols?: string[];
    /** 接口调用成功的回调函数 */
    success?: ConnectSocketSuccessCallback;
    /** 需要基础库： `2.4.0`
     *
     * 建立 TCP 连接的时候的 TCP_NODELAY 设置 */
    tcpNoDelay?: boolean;
    /** 需要基础库： `2.10.0`
     *
     * 超时时间，单位为毫秒 */
    timeout?: number;
  }
  interface ConnectWifiOption {
    /** Wi-Fi 设备 SSID */
    SSID: string;
    /** Wi-Fi 设备密码 */
    password: string;
    /** Wi-Fi 设备 BSSID */
    BSSID?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ConnectWifiCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ConnectWifiFailCallback;
    /** 需要基础库： `2.12.0`
     *
     * 跳转到系统设置页进行连接 */
    maunal?: boolean;
    /** 需要基础库： `2.22.0`
     *
     * 是否需要返回部分 Wi-Fi 信息，仅安卓生效 */
    partialInfo?: boolean;
    /** 接口调用成功的回调函数 */
    success?: ConnectWifiSuccessCallback;
  }
  /** 一个字典对象，它指定是否应该禁用规范化(默认启用规范化) */
  interface Constraints {
    /** 如果指定为true则禁用标准化，默认为false */
    disableNormalization?: boolean;
  }
  interface ContextCallbackResult {
    /** 节点对应的 Context 对象 */
    context: IAnyObject;
  }
  interface CopyFileOption {
    /** 目标文件路径，支持本地路径 */
    destPath: string;
    /** 源文件路径，支持本地路径 */
    srcPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CopyFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CopyFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CopyFileSuccessCallback;
  }
  interface CreateBLEConnectionOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CreateBLEConnectionCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CreateBLEConnectionFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CreateBLEConnectionSuccessCallback;
    /** 超时时间，单位 ms，不填表示不会超时 */
    timeout?: number;
  }
  interface CreateBLEPeripheralServerOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CreateBLEPeripheralServerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CreateBLEPeripheralServerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CreateBLEPeripheralServerSuccessCallback;
  }
  interface CreateBLEPeripheralServerSuccessCallbackResult {
    /** [BLEPeripheralServer](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.html)
     *
     * 外围设备的服务端。 */
    server: BLEPeripheralServer;
    errMsg: string;
  }
  interface CreateCacheManagerOption {
    /** 额外的缓存处理 */
    extra?: ExtraOption;
    /** 全局缓存有效时间，单位为毫秒，默认为 7 天，最长不超过 30 天 */
    maxAge?: number;
    /** 缓存模式
     *
     * 可选值：
     * - 'weakNetwork': 弱网/离线使用缓存返回;
     * - 'always': 总是使用缓存返回;
     * - 'none': 不开启，后续可手动开启/停止使用缓存返回; */
    mode?: 'weakNetwork' | 'always' | 'none';
    /** 全局 origin */
    origin?: string;
  }
  interface CreateInferenceSessionOption {
    /** 模型文件路径，目前只执行后缀为.onnx格式(支持代码包路径，和本地文件系统路径） */
    model: string;
    /** 是否使用NPU推理，仅对IOS有效 */
    allowNPU?: boolean;
    /** 是否生成量化模型推理 */
    allowQuantize?: boolean;
    /** 推理精度，有效值为 0 - 4。一般来说，使用的precesionLevel等级越低，推理速度越快，但可能会损失精度。推荐开发者在开发时，在效果满足需求时优先使用更低精度以提高推理速度，节约能耗。
     *
     * 可选值：
     * - 0: 使用fp16 存储浮点，fp16计算，Winograd 算法也采取fp16 计算，开启近似math计算;
     * - 1: 使用fp16 存储浮点，fp16计算，禁用 Winograd 算法，开启近似math计算;
     * - 2: 使用fp16 存储浮点，fp32计算，开启 Winograd，开启近似math计算;
     * - 3: 使用fp32 存储浮点，fp32计算，开启 Winograd，开启近似math计算;
     * - 4: 使用fp32 存储浮点，fp32计算，开启 Winograd，关闭近似math计算; */
    precesionLevel?: 0 | 1 | 2 | 3 | 4;
    /** 输入典型分辨率 */
    typicalShape?: IAnyObject;
  }
  interface CreateInnerAudioContextOption {
    /** 需要基础库： `2.19.0`
     *
     * 是否使用 WebAudio 作为底层音频驱动，默认关闭。对于短音频、播放频繁的音频建议开启此选项，开启后将获得更优的性能表现。由于开启此选项后也会带来一定的内存增长，因此对于长音频建议关闭此选项。 */
    useWebAudioImplement?: boolean;
  }
  /** 选项 */
  interface CreateIntersectionObserverOption {
    /** 初始的相交比例，如果调用时检测到的相交比例与这个值不相等且达到阈值，则会触发一次监听器的回调函数。 */
    initialRatio?: number;
    /** 需要基础库： `2.0.0`
     *
     * 是否同时观测多个目标节点（而非一个），如果设为 true ，observe 的 targetSelector 将选中多个节点（注意：同时选中过多节点将影响渲染性能） */
    observeAll?: boolean;
    /** 一个数值数组，包含所有阈值。 */
    thresholds?: number[];
  }
  interface CreateInterstitialAdOption {
    /** 广告单元 id */
    adUnitId: string;
  }
  interface CreateMediaRecorderOption {
    /** 指定录制的时长（s)，到达自动停止。最大 7200，最小 5 */
    duration?: number;
    /** 视频 fps */
    fps?: number;
    /** 视频关键帧间隔 */
    gop?: number;
    /** 视频比特率（kbps），最小值 600，最大值 3000 */
    videoBitsPerSecond?: number;
  }
  interface CreateOffscreenCanvasOption {
    /** 在自定义组件下，当前组件实例的 this */
    compInst?: Component.TrivialInstance | Page.TrivialInstance;
    /** 画布高度 */
    height?: number;
    /** 创建的离屏 canvas 类型
     *
     * 可选值：
     * - 'webgl': webgl类型上下文;
     * - '2d': 2d类型上下文; */
    type?: 'webgl' | '2d';
    /** 画布宽度 */
    width?: number;
  }
  interface CreateRewardedVideoAdOption {
    /** 广告单元 id */
    adUnitId: string;
    /** 需要基础库： `2.8.0`
     *
     * 是否启用多例模式，默认为false */
    multiton?: boolean;
  }
  /** 可选参数 */
  interface CreateWorkerOption {
    /** 需要基础库： `2.13.0`
     *
     * 是否使用实验worker。在iOS下，实验worker的JS运行效率比非实验worker提升数倍，如需在worker内进行重度计算的建议开启此选项。同时，实验worker存在极小概率会在系统资源紧张时被系统回收，因此建议配合 worker.onProcessKilled 事件使用，在worker被回收后可重新创建一个。 */
    useExperimentalWorker?: boolean;
  }
  interface CropImageOption {
    /** 裁剪比例
     *
     * 可选值：
     * - '16:9': 宽高比为16比9;
     * - '9:16': 宽高比为9比16;
     * - '4:3': 宽高比为4比3;
     * - '3:4': 宽高比为3比4;
     * - '5:4': 宽高比为5比4;
     * - '4:5': 宽高比为4比5;
     * - '1:1': 宽高比为1比1; */
    cropScale: '16:9' | '9:16' | '4:3' | '3:4' | '5:4' | '4:5' | '1:1';
    /** 图片路径，图片的路径，支持本地路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: CropImageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: CropImageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: CropImageSuccessCallback;
  }
  interface CurrentState {
    /** 当前缓存中的日志条数 */
    logCount: number;
    /** 当前缓存中最大可存日志条数 */
    maxLogCount: number;
    /** 当前缓存最大可用空间，以字节为单位 */
    maxSize: number;
    /** 当前缓存中已使用空间，以字节为单位 */
    size: number;
  }
  /** 自定义路由动画配置 */
  interface CustomRouteConfig {
    /** 遮罩层背景色，支持 `rgba()` 和 `#RRGGBBAA` 写法 */
    barrierColor: string;
    /** 点击遮罩层返回上一页 */
    barrierDismissible: boolean;
    /** 无障碍语义 */
    barrierLabel: string;
    /** 是否与前一个页面联动，决定前一个页 `secondaryAnimation` 是否生效 */
    canTransitionFrom: boolean;
    /** 是否与下一个页面联动，决定当前页 `secondaryAnimation` 是否生效 */
    canTransitionTo: boolean;
    /** 是否保持前一个页面状态 */
    maintainState: boolean;
    /** 下一个页面推入后，不显示前一个页面 */
    opaque: boolean;
    /** 页面推出动画时长，单位 ms */
    reverseTransitionDuration: number;
    /** 页面推入动画时长，单位 ms */
    transitionDuration: number;
  }
  /** 自定义路由上下文对象 */
  interface CustomRouteContext {
    /** 返回上一级，效果同 `wx.navigateBack`，仅可用于 `worklet` 函数内 */
    didPop: (...args: any[]) => any;
    /** 动画控制器，影响推入页面的进入和退出过渡效果 */
    primaryAnimation: SharedValue<number>;
    /** 动画控制器状态 */
    primaryAnimationStatus: SharedValue<number>;
    /** 动画控制器，影响栈顶页面的推出过渡效果 */
    secondaryAnimation: SharedValue<number>;
    /** 动画控制器状态 */
    secondaryAnimationStatus: SharedValue<number>;
    /** 手势开始控制路由，与共享元素动画有关 */
    startUserGesture: (...args: any[]) => any;
    /** 手势不再控制路由，与 `startUserGesture` 成对调用 */
    stopUserGesture: (...args: any[]) => any;
    /** 当前路由进度由手势控制 */
    userGestureInProgress: SharedValue<number>;
  }
  /** 弹幕内容 */
  interface Danmu {
    /** 弹幕文字 */
    text: string;
    /** 弹幕颜色 */
    color?: string;
  }
  /** 动画配置 */
  interface DecayOption {
    /** 边界值，长度为 2 的数组 */
    clamp?: any[];
    /** 衰减速率 */
    deceleration?: number;
    /** 初速度 */
    velocity?: number;
  }
  /** 可选的字体描述符 */
  interface DescOption {
    /** 字体样式，可选值为 normal / italic / oblique */
    style?: string;
    /** 设置小型大写字母的字体显示文本，可选值为 normal / small-caps / inherit */
    variant?: string;
    /** 字体粗细，可选值为 normal / bold / 100 / 200../ 900 */
    weight?: string;
  }
  /** 描述符的权限 */
  interface DescriptorPermission {
    /** 读 */
    read?: boolean;
    /** 写 */
    write?: boolean;
  }
  /** 指定 marker 移动到的目标点 */
  interface DestinationOption {
    /** 纬度 */
    latitude: number;
    /** 经度 */
    longitude: number;
  }
  interface DetectBodyOption {
    /** 人脸图像像素点数据，每四项表示一个像素点的 RGBA */
    frameBuffer: ArrayBuffer;
    /** 图像高度 */
    height: number;
    /** 图像宽度 */
    width: number;
    /** 评分阈值。正常情况传入 0.8 即可。 */
    scoreThreshold?: number;
    /** 图像源类型。正常情况传入 1 即可。当输入的图片是来自一个连续视频的每一帧图像时，sourceType 传入 0 会得到更优的效果
     *
     * 可选值：
     * - 1: 表示输入的图片是随机的图片;
     * - 0: 表示输入的图片是来自一个连续视频的每一帧图像; */
    sourceType?: 1 | 0;
  }
  interface DetectFaceOption {
    /** 人脸图像像素点数据，每四项表示一个像素点的 RGBA */
    frameBuffer: ArrayBuffer;
    /** 图像高度 */
    height: number;
    /** 图像宽度 */
    width: number;
    /** 算法模型类型。正常情况传入 1 即可。0、1、2 分别表示小、中、大模型，模型越大识别准确率越高，但资源占用也越高。建议根据用户设备性能进行选择。
     *
     * 可选值：
     * - 0: 小模型;
     * - 1: 中模型;
     * - 2: 大模型; */
    modelModel?: 0 | 1 | 2;
    /** 评分阈值。正常情况传入 0.8 即可。 */
    scoreThreshold?: number;
    /** 图像源类型。正常情况传入 1 即可。当输入的图片是来自一个连续视频的每一帧图像时，sourceType 传入 0 会得到更优的效果
     *
     * 可选值：
     * - 1: 表示输入的图片是随机的图片;
     * - 0: 表示输入的图片是来自一个连续视频的每一帧图像; */
    sourceType?: 1 | 0;
  }
  interface DetectHandOption {
    /** 人脸图像像素点数据，每四项表示一个像素点的 RGBA */
    frameBuffer: ArrayBuffer;
    /** 图像高度 */
    height: number;
    /** 图像宽度 */
    width: number;
    /** 算法检测模式
     *
     * 可选值：
     * - 0: 检测模式，输出框和点;
     * - 1: 手势模式，输出框和手势分类;
     * - 2: 结合0和1模式，输出框、点、手势分类; */
    algoMode?: 0 | 1 | 2;
    /** 评分阈值。正常情况传入 0.8 即可。 */
    scoreThreshold?: number;
  }
  interface DeviceInfo {
    /** 应用（微信APP）二进制接口类型（仅 Android 支持） */
    abi: string;
    /** 设备性能等级（仅 Android 支持）。取值为：-2 或 0（该设备无法运行小游戏），-1（性能未知），>=1（设备性能值，该值越高，设备性能越好，目前最高不到50） */
    benchmarkLevel: number;
    /** 设备品牌 */
    brand: string;
    /** 需要基础库： `2.29.0`
     *
     * 设备 CPU 型号（仅 Android 支持）（Tips: GPU 型号可通过 WebGLRenderingContext.getExtension('WEBGL_debug_renderer_info') 来获取） */
    cpuType: string;
    /** 需要基础库： `2.25.1`
     *
     * 设备二进制接口类型（仅 Android 支持） */
    deviceAbi: string;
    /** 需要基础库： `2.30.0`
     *
     * 设备内存大小，单位为 MB */
    memorySize: string;
    /** 设备型号。新机型刚推出一段时间会显示unknown，微信会尽快进行适配。 */
    model: string;
    /** 客户端平台 */
    platform: string;
    /** 操作系统及版本 */
    system: string;
  }
  interface DeviceVoIPInfo {
    /** 需要基础库： `2.30.4`
     *
     * 设备组的唯一标识 id（仅设备组时） */
    group_id: string;
    /** 设备型号 id。通过微信公众平台注册设备获得。（仅单台设备时） */
    model_id: string;
    /** 设备唯一序列号。（仅单台设备时） */
    sn: string;
    /** 设备（组）授权状态。0：未授权；1：已授权 */
    status: number;
  }
  interface DisableAlertBeforeUnloadOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: DisableAlertBeforeUnloadCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: DisableAlertBeforeUnloadFailCallback;
    /** 接口调用成功的回调函数 */
    success?: DisableAlertBeforeUnloadSuccessCallback;
  }
  interface DownloadFileOption {
    /** 下载资源的 url */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: DownloadFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: DownloadFileFailCallback;
    /** 需要基础库： `1.8.0`
     *
     * 指定文件下载后存储的路径 (本地路径) */
    filePath?: string;
    /** HTTP 请求的 Header，Header 中不能设置 Referer */
    header?: IAnyObject;
    /** 接口调用成功的回调函数 */
    success?: DownloadFileSuccessCallback;
    /** 需要基础库： `2.10.0`
     *
     * 超时时间，单位为毫秒 */
    timeout?: number;
  }
  interface DownloadFileSuccessCallbackResult {
    /** 用户文件路径 (本地路径)。传入 filePath 时会返回，跟传入的 filePath 一致 */
    filePath: string;
    /** 需要基础库： `2.10.4`
     *
     * 网络请求过程中一些调试信息，[查看详细说明](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/network.html) */
    profile: RequestProfile;
    /** 开发者服务器返回的 HTTP 状态码 */
    statusCode: number;
    /** 临时文件路径 (本地路径)。没传入 filePath 指定文件存储路径时会返回，下载后的文件会存储到一个临时文件 */
    tempFilePath: string;
    errMsg: string;
  }
  interface DownloadTaskOnProgressUpdateListenerResult {
    /** 下载进度百分比 */
    progress: number;
    /** 预期需要下载的数据总长度，单位 Bytes */
    totalBytesExpectedToWrite: number;
    /** 已经下载的数据长度，单位 Bytes */
    totalBytesWritten: number;
  }
  interface EditImageOption {
    /** 图片路径，图片的路径，支持本地路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: EditImageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: EditImageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: EditImageSuccessCallback;
  }
  interface EditImageSuccessCallbackResult {
    /** 编辑后图片的临时文件路径 (本地路径) */
    tempFilePath: string;
    errMsg: string;
  }
  interface EnableAlertBeforeUnloadOption {
    /** 询问对话框内容 */
    message: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: EnableAlertBeforeUnloadCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: EnableAlertBeforeUnloadFailCallback;
    /** 接口调用成功的回调函数 */
    success?: EnableAlertBeforeUnloadSuccessCallback;
  }
  /** 文件读取结果。res.entries 是一个对象，key是文件路径，value是一个对象 FileItem ，表示该文件的读取结果。每个 FileItem 包含 data （文件内容） 和 errMsg （错误信息） 属性。 */
  interface EntriesResult {
    /** 文件路径 */
    [path: string]: ZipFileItem;
  }
  /** 要读取的压缩包内的文件列表（当传入"all" 时表示读取压缩包内所有文件） */
  interface EntryItem {
    /** 压缩包内文件路径 */
    path: string;
    /** 指定读取文件的字符编码，如果不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 指定文件的长度，如果不指定，则读到文件末尾。有效范围：[1, fileLength]。单位：byte */
    length?: number;
    /** 从文件指定位置开始读，如果不指定，则从文件头开始读。读取的范围应该是左闭右开区间 [position, position+length)。有效范围：[0, fileLength - 1]。单位：byte */
    position?: number;
  }
  /** 要擦除的线段数组。详见 [polyline 属性](https://developers.weixin.qq.com/miniprogram/dev/component/map.html#polyline)。 */
  interface EraseLineOptions {
    /** 线段的 id。 */
    id: number;
    /** 指定线段的某一段，线段起点 index 为 0 */
    index: number;
    /** 指定线段某一段中的点 */
    point: MapPostion;
    /** 为 true 时擦除，false 时置灰 */
    clear?: boolean;
  }
  interface EraseLinesOption {
    /** 要擦除的线段数组。详见 [polyline 属性](https://developers.weixin.qq.com/miniprogram/dev/component/map.html#polyline)。 */
    lines: EraseLineOptions[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: EraseLinesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: EraseLinesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: EraseLinesSuccessCallback;
  }
  interface Err {
    /** 错误信息 */
    errMsg: string;
    /** 需要基础库： `2.24.0`
     *
     * errno 错误码，错误码的详细说明参考 [Errno错误码](https://developers.weixin.qq.com/miniprogram/dev/framework/usability/PublicErrno.html) */
    errno: number;
  }
  interface ExecuteVisualLayerCommandOption {
    /** 图层指令 */
    command: string;
    /** 可视化图层id */
    layerId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExecuteVisualLayerCommandCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExecuteVisualLayerCommandFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExecuteVisualLayerCommandSuccessCallback;
  }
  interface ExecuteVisualLayerCommandSuccessCallbackResult {
    /** SDK 返回的 JSON 数据 */
    data: string;
    /** 调用结果 */
    errMsg: string;
  }
  interface ExitCastingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExitCastingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExitCastingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExitCastingSuccessCallback;
  }
  interface ExitFullScreenOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExitFullScreenCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExitFullScreenFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExitFullScreenSuccessCallback;
  }
  interface ExitMiniProgramOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExitMiniProgramCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExitMiniProgramFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExitMiniProgramSuccessCallback;
  }
  interface ExitPictureInPictureOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExitPictureInPictureCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExitPictureInPictureFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExitPictureInPictureSuccessCallback;
  }
  interface ExitVoIPChatOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ExitVoIPChatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ExitVoIPChatFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ExitVoIPChatSuccessCallback;
  }
  /** 客服信息 */
  interface ExtInfoOption {
    /** 客服链接 */
    url: string;
  }
  /** 额外的缓存处理 */
  interface ExtraOption {
    /** 需要缓存的 wx api 接口，不传则表示支持缓存的接口全都做缓存处理。返回的如果是缓存数据，开发者可通过 fromCache 标记区分
     *
     * 可选值：
     * - 'wx.login': ;
     * - 'wx.checkSession': ;
     * - 'wx.getSetting': ; */
    apiList?: Array<'wx.login' | 'wx.checkSession' | 'wx.getSetting'>;
  }
  interface ExtractDataSourceOption {
    /** 视频源地址，只支持本地文件 */
    source: string;
  }
  /** 人脸角度信息，取值范围 [-1, 1]，数值越接近 0 表示越正对摄像头 */
  interface FaceAngel {
    /** 仰俯角（点头） */
    pitch: number;
    /** 翻滚角（左右倾） */
    roll: number;
    /** 偏航角（摇头） */
    yaw: number;
  }
  /** 人脸置信度，取值范围 [0, 1]，数值越大置信度越高（遮挡越少） */
  interface FaceConf {
    /** 整体可信度 */
    global: number;
    /** 左眼可信度 */
    leftEye: number;
    /** 嘴巴可信度 */
    mouth: number;
    /** 鼻子可信度 */
    nose: number;
    /** 右眼可信度 */
    rightEye: number;
  }
  interface FaceDetectOption {
    /** 图像像素点数据，每四项表示一个像素点的 RGBA */
    frameBuffer: ArrayBuffer;
    /** 图像高度 */
    height: number;
    /** 图像宽度 */
    width: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: FaceDetectCompleteCallback;
    /** 是否返回当前图像的人脸角度信息 */
    enableAngle?: boolean;
    /** 是否返回当前图像的人脸的置信度（可表示器官遮挡情况） */
    enableConf?: boolean;
    /** 是否返回多张人脸的信息 */
    enableMultiFace?: boolean;
    /** 是否返回当前图像的人脸（106 个点） */
    enablePoint?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: FaceDetectFailCallback;
    /** 接口调用成功的回调函数 */
    success?: FaceDetectSuccessCallback;
  }
  interface FaceDetectSuccessCallbackResult {
    /** 人脸角度信息，取值范围 [-1, 1]，数值越接近 0 表示越正对摄像头 */
    angleArray: FaceAngel;
    /** 人脸置信度，取值范围 [0, 1]，数值越大置信度越高（遮挡越少） */
    confArray: FaceConf;
    /** 脸部方框数值，对象包含 height, width, originX, originY 四个属性 (origin 为方框左上角坐标) */
    detectRect: IAnyObject;
    /** 多人模式（enableMultiFace）下的人脸信息，每个对象包含上述其它属性 */
    faceInfo: IAnyObject[];
    /** 标记人脸轮廓的 106 个点位置数组，数组每个对象包含 x 和 y */
    pointArray: IAnyObject[];
    /** 脸部中心点横坐标，检测不到人脸则为 -1 */
    x: number;
    /** 脸部中心点纵坐标，检测不到人脸则为 -1 */
    y: number;
    errMsg: string;
  }
  /** 需要基础库： `2.25.0`
   *
   * 人脸检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html)。安卓微信8.0.25开始支持，iOS微信8.0.24开始支持。 */
  interface FaceTrack {
    /** 需要基础库： `2.25.0`
     *
     * 人脸检测模式
     *
     * 可选值：
     * - 1: 通过摄像头实时检测;
     * - 2: 静态图片检测; */
    mode: 1 | 2;
  }
  interface Fields {
    /** 需要基础库： `2.1.0`
     *
     * 指定样式名列表，返回节点对应样式名的当前值 */
    computedStyle?: string[];
    /** 需要基础库： `2.4.2`
     *
     * 是否返回节点对应的 Context 对象 */
    context?: boolean;
    /** 是否返回节点 dataset */
    dataset?: boolean;
    /** 是否返回节点 id */
    id?: boolean;
    /** 是否返回节点 mark */
    mark?: boolean;
    /** 需要基础库： `2.7.0`
     *
     * 是否返回节点对应的 Node 实例 */
    node?: boolean;
    /** 指定属性名列表，返回节点对应属性名的当前属性值（只能获得组件文档中标注的常规属性值，id class style 和事件绑定的属性值不可获取） */
    properties?: string[];
    /** 是否返回节点布局位置（`left` `right` `top` `bottom`） */
    rect?: boolean;
    /** 否 是否返回节点的 `scrollLeft` `scrollTop`，节点必须是 `scroll-view` 或者 `viewport` */
    scrollOffset?: boolean;
    /** 是否返回节点尺寸（`width` `height`） */
    size?: boolean;
  }
  /** 文件数组 */
  interface FileItem {
    /** 文件保存时的时间戳，从1970/01/01 08:00:00 到当前时间的秒数 */
    createTime: number;
    /** 文件路径 (本地路径) */
    filePath: string;
    /** 本地文件大小，以字节为单位 */
    size: number;
  }
  interface FileSystemManagerCloseOption {
    /** 需要被关闭的文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: FileSystemManagerCloseCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: FileSystemManagerCloseFailCallback;
    /** 接口调用成功的回调函数 */
    success?: FileSystemManagerCloseSuccessCallback;
  }
  /** 打开的文件信息数组，只有从聊天素材场景打开（scene为1173）才会携带该参数 */
  interface ForwardMaterials {
    /** 文件名 */
    name: string;
    /** 文件路径（如果是webview则是url） */
    path: string;
    /** 文件大小 */
    size: number;
    /** 文件的mimetype类型 */
    type: string;
  }
  /** 视频帧数据，若取不到则返回 null。当缓冲区为空的时候可能暂停取不到数据。 */
  interface FrameDataOptions {
    /** 帧数据 */
    data: ArrayBuffer;
    /** 帧数据高度 */
    height: number;
    /** 帧原始 dts */
    pkDts: number;
    /** 帧原始 pts */
    pkPts: number;
    /** 帧数据宽度 */
    width: number;
  }
  interface FromScreenLocationOption {
    /** x 坐标值 */
    x: number;
    /** y 坐标值 */
    y: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: FromScreenLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: FromScreenLocationFailCallback;
    /** 接口调用成功的回调函数 */
    success?: FromScreenLocationSuccessCallback;
  }
  interface FstatOption {
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: FstatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: FstatFailCallback;
    /** 接口调用成功的回调函数 */
    success?: FstatSuccessCallback;
  }
  interface FstatSuccessCallbackResult {
    /** [Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html)
     *
     * Stats 对象，包含了文件的状态信息 */
    stats: Stats;
    errMsg: string;
  }
  interface FstatSyncOption {
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
  }
  interface FtruncateOption {
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 截断位置，默认0。如果 length 小于文件长度（单位：字节），则只有前面 length 个字节会保留在文件中，其余内容会被删除；如果 length 大于文件长度，则会对其进行扩展，并且扩展部分将填充空字节（'\0'） */
    length: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: FtruncateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: FtruncateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: FtruncateSuccessCallback;
  }
  interface FtruncateSyncOption {
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 截断位置，默认0。如果 length 小于文件长度（单位：字节），则只有前面 length 个字节会保留在文件中，其余内容会被删除；如果 length 大于文件长度，则会对其进行扩展，并且扩展部分将填充空字节（'\0'） */
    length: number;
  }
  interface GeneralCallbackResult {
    /** 错误信息 */
    errMsg: string;
  }
  interface GetAtqaOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetAtqaCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetAtqaFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetAtqaSuccessCallback;
  }
  interface GetAtqaSuccessCallbackResult {
    /** 返回 ATQA/SENS_RES 数据 */
    atqa: ArrayBuffer;
    errMsg: string;
  }
  interface GetAvailableAudioSourcesOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetAvailableAudioSourcesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetAvailableAudioSourcesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetAvailableAudioSourcesSuccessCallback;
  }
  interface GetAvailableAudioSourcesSuccessCallbackResult {
    /** 支持的音频输入源列表，可在 [RecorderManager.start()](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html) 接口中使用。返回值定义参考 https://developer.android.com/reference/kotlin/android/media/MediaRecorder.AudioSource
     *
     * 可选值：
     * - 'auto': 自动设置，默认使用手机麦克风，插上耳麦后自动切换使用耳机麦克风，所有平台适用;
     * - 'buildInMic': 手机麦克风，仅限 iOS;
     * - 'headsetMic': 耳机麦克风，仅限 iOS;
     * - 'mic': 麦克风（没插耳麦时是手机麦克风，插耳麦时是耳机麦克风），仅限 Android;
     * - 'camcorder': 同 mic，适用于录制音视频内容，仅限 Android;
     * - 'voice_communication': 同 mic，适用于实时沟通，仅限 Android;
     * - 'voice_recognition': 同 mic，适用于语音识别，仅限 Android; */
    audioSources: Array<
      'auto' | 'buildInMic' | 'headsetMic' | 'mic' | 'camcorder' | 'voice_communication' | 'voice_recognition'
    >;
    errMsg: string;
  }
  interface GetBLEDeviceCharacteristicsOption {
    /** 蓝牙设备 id。需要已经通过 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 建立连接 */
    deviceId: string;
    /** 蓝牙服务 UUID。需要先调用 [wx.getBLEDeviceServices](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceServices.html) 获取 */
    serviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBLEDeviceCharacteristicsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBLEDeviceCharacteristicsFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBLEDeviceCharacteristicsSuccessCallback;
  }
  interface GetBLEDeviceCharacteristicsSuccessCallbackResult {
    /** 设备特征列表 */
    characteristics: BLECharacteristic[];
    errMsg: string;
  }
  interface GetBLEDeviceRSSIOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBLEDeviceRSSICompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBLEDeviceRSSIFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBLEDeviceRSSISuccessCallback;
  }
  interface GetBLEDeviceRSSISuccessCallbackResult {
    /** 信号强度，单位 dBm */
    RSSI: number;
    errMsg: string;
  }
  interface GetBLEDeviceServicesOption {
    /** 蓝牙设备 id。需要已经通过 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 建立连接 */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBLEDeviceServicesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBLEDeviceServicesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBLEDeviceServicesSuccessCallback;
  }
  interface GetBLEDeviceServicesSuccessCallbackResult {
    /** 设备服务列表 */
    services: BLEService[];
    errMsg: string;
  }
  interface GetBLEMTUOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBLEMTUCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBLEMTUFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBLEMTUSuccessCallback;
    /** 写模式 （iOS 特有参数）
     *
     * 可选值：
     * - 'write': 有回复写;
     * - 'writeNoResponse': 无回复写; */
    writeType?: 'write' | 'writeNoResponse';
  }
  interface GetBLEMTUSuccessCallbackResult {
    /** 最大传输单元 */
    mtu: number;
    errMsg: string;
  }
  interface GetBackgroundAudioPlayerStateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBackgroundAudioPlayerStateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBackgroundAudioPlayerStateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBackgroundAudioPlayerStateSuccessCallback;
  }
  interface GetBackgroundAudioPlayerStateSuccessCallbackResult {
    /** 选定音频的播放位置（单位：s），只有在音乐播放中时返回 */
    currentPosition: number;
    /** 歌曲数据链接，只有在音乐播放中时返回 */
    dataUrl: string;
    /** 音频的下载进度百分比，只有在音乐播放中时返回 */
    downloadPercent: number;
    /** 选定音频的长度（单位：s），只有在音乐播放中时返回 */
    duration: number;
    /** 播放状态
     *
     * 可选值：
     * - 0: 暂停中;
     * - 1: 播放中;
     * - 2: 没有音乐播放; */
    status: 0 | 1 | 2;
    errMsg: string;
  }
  interface GetBackgroundFetchDataOption {
    /** 缓存数据类别，取值为 periodic 或 pre */
    fetchType: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBackgroundFetchDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBackgroundFetchDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBackgroundFetchDataSuccessCallback;
  }
  interface GetBackgroundFetchDataSuccessCallbackResult {
    /** 缓存数据 */
    fetchedData: string;
    /** 小程序页面路径 */
    path: string;
    /** 传给页面的 query 参数 */
    query: string;
    /** 进入小程序的场景值 */
    scene: number;
    /** 客户端拿到缓存数据的时间戳 ms。(iOS 时间戳存在异常，8.0.27 修复) */
    timeStamp: number;
    errMsg: string;
  }
  interface GetBackgroundFetchTokenOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBackgroundFetchTokenCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBackgroundFetchTokenFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBackgroundFetchTokenSuccessCallback;
  }
  interface GetBackgroundFetchTokenSuccessCallbackResult {
    /** 接口调用结果 */
    errMsg: string;
    /** 自定义的登录态 */
    token: number;
  }
  interface GetBatteryInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBatteryInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBatteryInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBatteryInfoSuccessCallback;
  }
  interface GetBatteryInfoSuccessCallbackResult {
    /** 是否正在充电中 */
    isCharging: boolean;
    /** 设备电量，范围 1 - 100 */
    level: number;
    errMsg: string;
  }
  interface GetBatteryInfoSyncResult {
    /** 是否正在充电中 */
    isCharging: boolean;
    /** 设备电量，范围 1 - 100 */
    level: number;
  }
  interface GetBeaconsOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBeaconsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBeaconsFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBeaconsSuccessCallback;
  }
  interface GetBeaconsSuccessCallbackResult {
    /** Beacon 设备列表 */
    beacons: BeaconInfo[];
    errMsg: string;
  }
  interface GetBluetoothAdapterStateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBluetoothAdapterStateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBluetoothAdapterStateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBluetoothAdapterStateSuccessCallback;
  }
  interface GetBluetoothAdapterStateSuccessCallbackResult {
    /** 蓝牙适配器是否可用 */
    available: boolean;
    /** 是否正在搜索设备 */
    discovering: boolean;
    errMsg: string;
  }
  interface GetBluetoothDevicesOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetBluetoothDevicesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetBluetoothDevicesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetBluetoothDevicesSuccessCallback;
  }
  interface GetBluetoothDevicesSuccessCallbackResult {
    /** UUID 对应的已连接设备列表 */
    devices: BlueToothDevice[];
    errMsg: string;
  }
  interface GetCenterLocationOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetCenterLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetCenterLocationFailCallback;
    /** 图标路径，支持网络路径、本地路径、代码包路径 */
    iconPath?: string;
    /** 接口调用成功的回调函数 */
    success?: GetCenterLocationSuccessCallback;
  }
  interface GetCenterLocationSuccessCallbackResult {
    /** 纬度 */
    latitude: number;
    /** 经度 */
    longitude: number;
    errMsg: string;
  }
  interface GetChannelsLiveInfoOption {
    /** 视频号 id，以“sph”开头的id，可在视频号助手获取 */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetChannelsLiveInfoCompleteCallback;
    /** 需要基础库： `2.29.0`
     *
     * 结束时间，筛选指定时间段的直播。若上传了startTime，未上传endTime，则endTime默认取当前时间 */
    endTime?: number;
    /** 接口调用失败的回调函数 */
    fail?: GetChannelsLiveInfoFailCallback;
    /** 需要基础库： `2.29.0`
     *
     * 起始时间，筛选指定时间段的直播。若上传了endTime，未上传startTime，则startTime默认为0 */
    startTime?: number;
    /** 接口调用成功的回调函数 */
    success?: GetChannelsLiveInfoSuccessCallback;
  }
  interface GetChannelsLiveInfoSuccessCallbackResult {
    /** 直播主题 */
    description: string;
    /** 直播 feedId */
    feedId: string;
    /** 视频号头像 */
    headUrl: string;
    /** 视频号昵称 */
    nickname: string;
    /** 直播 nonceId */
    nonceId: string;
    /** 需要基础库： `2.29.0`
     *
     * 除最近的一条直播外，其他的直播列表（注意：每次最多返回按时间戳增序排列的15个直播信息，其中时间最近的那个直播会在接口其他的返回参数中展示，其余的直播会在该字段中展示）。 */
    otherInfos: any[];
    /** 需要基础库： `2.29.0`
     *
     * 直播回放状态
     *
     * 可选值：
     * - 0: 未生成;
     * - 1: 已生成;
     * - 3: 生成中;
     * - 6: 已过期; */
    replayStatus: 0 | 1 | 3 | 6;
    /** 直播状态
     *
     * 可选值：
     * - 2: 直播中;
     * - 3: 直播结束; */
    status: 2 | 3;
    errMsg: string;
  }
  interface GetChannelsLiveNoticeInfoOption {
    /** 视频号 id，以“sph”开头的id，可在视频号助手获取 */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetChannelsLiveNoticeInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetChannelsLiveNoticeInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetChannelsLiveNoticeInfoSuccessCallback;
  }
  interface GetChannelsLiveNoticeInfoSuccessCallbackResult {
    /** 直播封面 */
    headUrl: string;
    /** 视频号昵称 */
    nickname: string;
    /** 预告 id */
    noticeId: string;
    /** 需要基础库： `2.24.6`
     *
     * 除最近的一条预告信息外，其他的预告信息列表（注意：每次最多返回按时间戳增序排列的15个预告信息，其中时间最近的那个预告信息会在接口其他的返回参数中展示，其余的预告信息会在该字段中展示）。 */
    otherInfos: any[];
    /** 是否可预约 */
    reservable: boolean;
    /** 开始时间 */
    startTime: string;
    /** 预告状态：0可用 1取消 2已用 */
    status: number;
    errMsg: string;
  }
  interface GetChannelsShareKeyOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetChannelsShareKeyCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetChannelsShareKeyFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetChannelsShareKeySuccessCallback;
  }
  interface GetChannelsShareKeySuccessCallbackResult {
    /** 推广员 */
    promoter: PromoterResult;
    /** 分享者 openid */
    sharerOpenId: string;
    errMsg: string;
  }
  interface GetClipboardDataOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetClipboardDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetClipboardDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetClipboardDataSuccessCallback;
  }
  interface GetClipboardDataSuccessCallbackOption {
    /** 剪贴板的内容 */
    data: string;
    errMsg: string;
  }
  interface GetConnectedBluetoothDevicesOption {
    /** 蓝牙设备主服务的 UUID 列表（支持 16/32/128 位 UUID） */
    services: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetConnectedBluetoothDevicesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetConnectedBluetoothDevicesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetConnectedBluetoothDevicesSuccessCallback;
  }
  interface GetConnectedBluetoothDevicesSuccessCallbackResult {
    /** 搜索到的设备列表 */
    devices: BluetoothDeviceInfo[];
    errMsg: string;
  }
  interface GetConnectedWifiOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetConnectedWifiCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetConnectedWifiFailCallback;
    /** 需要基础库： `2.22.0`
     *
     * 是否需要返回部分 Wi-Fi 信息 */
    partialInfo?: boolean;
    /** 接口调用成功的回调函数 */
    success?: GetConnectedWifiSuccessCallback;
  }
  interface GetConnectedWifiSuccessCallbackResult {
    /** [WifiInfo](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/WifiInfo.html)
     *
     * Wi-Fi 信息 */
    wifi: WifiInfo;
    errMsg: string;
  }
  interface GetContentsOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetContentsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetContentsFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetContentsSuccessCallback;
  }
  interface GetContentsSuccessCallbackResult {
    /** 表示内容的delta对象 */
    delta: IAnyObject;
    /** 带标签的HTML内容 */
    html: string;
    /** 纯文本内容 */
    text: string;
    errMsg: string;
  }
  interface GetDeviceVoIPListOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetDeviceVoIPListCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetDeviceVoIPListFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetDeviceVoIPListSuccessCallback;
  }
  interface GetDeviceVoIPListSuccessCallbackResult {
    list: DeviceVoIPInfo[];
    errMsg: string;
  }
  interface GetExtConfigOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetExtConfigCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetExtConfigFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetExtConfigSuccessCallback;
  }
  interface GetExtConfigSuccessCallbackResult {
    /** 第三方平台自定义的数据 */
    extConfig: IAnyObject;
    errMsg: string;
  }
  interface GetFileInfoOption {
    /** 要读取的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetFileInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetFileInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetFileInfoSuccessCallback;
  }
  interface GetFileInfoSuccessCallbackResult {
    /** 文件大小，以字节为单位 */
    size: number;
    errMsg: string;
  }
  interface GetFuzzyLocationOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetFuzzyLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetFuzzyLocationFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetFuzzyLocationSuccessCallback;
    /** wgs84 返回 gps 坐标，gcj02 返回可用于 wx.openLocation 的坐标 */
    type?: string;
  }
  interface GetFuzzyLocationSuccessCallbackResult {
    /** 纬度，范围为 -90~90，负数表示南纬 */
    latitude: number;
    /** 经度，范围为 -180~180，负数表示西经 */
    longitude: number;
    errMsg: string;
  }
  interface GetGroupEnterInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetGroupEnterInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetGroupEnterInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetGroupEnterInfoSuccessCallback;
  }
  interface GetGroupEnterInfoSuccessCallbackResult {
    /** 需要基础库： `2.7.0`
     *
     * 敏感数据对应的云 ID，开通[云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)的小程序才会返回，可通过云调用直接获取开放数据，详细见[云调用直接获取开放数据](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#method-cloud) */
    cloudID: string;
    /** 包括敏感数据在内的完整转发信息的加密数据，详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    encryptedData: string;
    /** 错误信息 */
    errMsg: string;
    /** 加密算法的初始向量，详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    iv: string;
  }
  interface GetHCEStateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetHCEStateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetHCEStateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetHCEStateSuccessCallback;
  }
  interface GetHistoricalBytesOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetHistoricalBytesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetHistoricalBytesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetHistoricalBytesSuccessCallback;
  }
  interface GetHistoricalBytesSuccessCallbackResult {
    /** 返回历史二进制数据 */
    histBytes: ArrayBuffer;
    errMsg: string;
  }
  interface GetImageInfoOption {
    /** 图片的路径，支持网络路径、本地路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetImageInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetImageInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetImageInfoSuccessCallback;
  }
  interface GetImageInfoSuccessCallbackResult {
    /** 图片原始高度，单位px。不考虑旋转。 */
    height: number;
    /** 需要基础库： `1.9.90`
     *
     * [拍照时设备方向](http://sylvana.net/jpegcrop/exif_orientation.html)
     *
     * 可选值：
     * - 'up': 默认方向（手机横持拍照），对应 Exif 中的 1。或无 orientation 信息。;
     * - 'up-mirrored': 同 up，但镜像翻转，对应 Exif 中的 2;
     * - 'down': 旋转180度，对应 Exif 中的 3;
     * - 'down-mirrored': 同 down，但镜像翻转，对应 Exif 中的 4;
     * - 'left-mirrored': 同 left，但镜像翻转，对应 Exif 中的 5;
     * - 'right': 顺时针旋转90度，对应 Exif 中的 6;
     * - 'right-mirrored': 同 right，但镜像翻转，对应 Exif 中的 7;
     * - 'left': 逆时针旋转90度，对应 Exif 中的 8; */
    orientation:
      | 'up'
      | 'up-mirrored'
      | 'down'
      | 'down-mirrored'
      | 'left-mirrored'
      | 'right'
      | 'right-mirrored'
      | 'left';
    /** 图片的本地路径 */
    path: string;
    /** 需要基础库： `1.9.90`
     *
     * 图片格式
     *
     * 可选值：
     * - 'unknown': 未知格式;
     * - 'jpeg': jpeg压缩格式;
     * - 'png': png压缩格式;
     * - 'gif': gif压缩格式;
     * - 'tiff': tiff压缩格式; */
    type: 'unknown' | 'jpeg' | 'png' | 'gif' | 'tiff';
    /** 图片原始宽度，单位px。不考虑旋转。 */
    width: number;
    errMsg: string;
  }
  interface GetInferenceEnvInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetInferenceEnvInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetInferenceEnvInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetInferenceEnvInfoSuccessCallback;
  }
  interface GetInferenceEnvInfoSuccessCallbackResult {
    /** AI推理引擎版本 */
    ver: string;
    errMsg: string;
  }
  interface GetLatestUserKeyOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetLatestUserKeyCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetLatestUserKeyFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetLatestUserKeySuccessCallback;
  }
  interface GetLatestUserKeySuccessCallbackResult {
    /** 用户加密密钥 */
    encryptKey: string;
    /** 密钥过期时间 */
    expireTime: number;
    /** 密钥初始向量 */
    iv: string;
    /** 密钥版本 */
    version: number;
    errMsg: string;
  }
  interface GetLocalIPAddressOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetLocalIPAddressCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetLocalIPAddressFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetLocalIPAddressSuccessCallback;
  }
  interface GetLocalIPAddressSuccessCallbackResult {
    /** 错误信息 */
    errMsg: string;
    /** 本机局域网IP地址 */
    localip: string;
    /** 本机局域网子网掩码，基础库 2.24.0 开始支持 */
    netmask: string;
  }
  interface GetLocationOption {
    /** 需要基础库： `1.6.0`
     *
     * 传入 true 会返回高度信息，由于获取高度需要较高精确度，会减慢接口返回速度 */
    altitude?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetLocationFailCallback;
    /** 需要基础库： `2.9.0`
     *
     * 高精度定位超时时间(ms)，指定时间内返回最高精度，该值3000ms以上高精度定位才有效果 */
    highAccuracyExpireTime?: number;
    /** 需要基础库： `2.9.0`
     *
     * 开启高精度定位 */
    isHighAccuracy?: boolean;
    /** 接口调用成功的回调函数 */
    success?: GetLocationSuccessCallback;
    /** wgs84 返回 gps 坐标，gcj02 返回可用于 wx.openLocation 的坐标 */
    type?: string;
  }
  interface GetLocationSuccessCallbackResult {
    /** 位置的精确度，反应与真实位置之间的接近程度，可以理解成10即与真实位置相差10m，越小越精确 */
    accuracy: number;
    /** 需要基础库： `1.2.0`
     *
     * 高度，单位 m */
    altitude: number;
    /** 需要基础库： `1.2.0`
     *
     * 水平精度，单位 m */
    horizontalAccuracy: number;
    /** 纬度，范围为 -90~90，负数表示南纬 */
    latitude: number;
    /** 经度，范围为 -180~180，负数表示西经 */
    longitude: number;
    /** 速度，单位 m/s */
    speed: number;
    /** 需要基础库： `1.2.0`
     *
     * 垂直精度，单位 m（Android 无法获取，返回 0） */
    verticalAccuracy: number;
    errMsg: string;
  }
  interface GetLogManagerOption {
    /** 需要基础库： `2.3.2`
     *
     * 取值为0/1，取值为0表示会把 `App`、`Page` 的生命周期函数和 `wx` 命名空间下的函数调用写入日志，取值为1则不会。默认值是 0 */
    level?: number;
  }
  interface GetMaxTransceiveLengthOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetMaxTransceiveLengthCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetMaxTransceiveLengthFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetMaxTransceiveLengthSuccessCallback;
  }
  interface GetMaxTransceiveLengthSuccessCallbackResult {
    /** 最大传输长度 */
    length: number;
    errMsg: string;
  }
  interface GetMaxZoomOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetMaxZoomCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetMaxZoomFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetMaxZoomSuccessCallback;
  }
  interface GetMaxZoomSuccessCallbackResult {
    /** 最大放缩级别 */
    maxZoom: string;
    errMsg: string;
  }
  interface GetNetworkTypeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetNetworkTypeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetNetworkTypeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetNetworkTypeSuccessCallback;
  }
  interface GetNetworkTypeSuccessCallbackResult {
    /** 需要基础库： `2.22.1`
     *
     * 设备是否使用了网络代理 */
    hasSystemProxy: boolean;
    /** 网络类型
     *
     * 可选值：
     * - 'wifi': wifi 网络;
     * - '2g': 2g 网络;
     * - '3g': 3g 网络;
     * - '4g': 4g 网络;
     * - '5g': 5g 网络;
     * - 'unknown': Android 下不常见的网络类型;
     * - 'none': 无网络; */
    networkType: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none';
    /** 信号强弱，单位 dbm */
    signalStrength: number;
    errMsg: string;
  }
  interface GetRandomValuesOption {
    /** 整数，生成随机数的字节数，最大 1048576 */
    length: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetRandomValuesCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetRandomValuesFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetRandomValuesSuccessCallback;
  }
  interface GetRandomValuesSuccessCallbackResult {
    /** 随机数内容，长度为传入的字节数 */
    randomValues: ArrayBuffer;
    errMsg: string;
  }
  interface GetRegionOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetRegionCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetRegionFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetRegionSuccessCallback;
  }
  interface GetRegionSuccessCallbackResult {
    /** 东北角经纬度 */
    northeast: MapPostion;
    /** 西南角经纬度 */
    southwest: MapPostion;
    errMsg: string;
  }
  interface GetRendererUserAgentOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetRendererUserAgentCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetRendererUserAgentFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetRendererUserAgentSuccessCallback;
  }
  interface GetRotateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetRotateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetRotateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetRotateSuccessCallback;
  }
  interface GetRotateSuccessCallbackResult {
    /** 旋转角 */
    rotate: number;
    errMsg: string;
  }
  interface GetSakOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSakCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSakFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSakSuccessCallback;
  }
  interface GetSakSuccessCallbackResult {
    /** 返回 SAK/SEL_RES 数据 */
    sak: number;
    errMsg: string;
  }
  interface GetSavedFileListOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSavedFileListCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSavedFileListFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSavedFileListSuccessCallback;
  }
  interface GetSavedFileListSuccessCallbackResult {
    /** 文件数组 */
    fileList: FileItem[];
    errMsg: string;
  }
  interface GetScaleOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetScaleCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetScaleFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetScaleSuccessCallback;
  }
  interface GetScaleSuccessCallbackResult {
    /** 缩放值 */
    scale: number;
    errMsg: string;
  }
  interface GetScreenBrightnessOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetScreenBrightnessCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetScreenBrightnessFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetScreenBrightnessSuccessCallback;
  }
  interface GetScreenBrightnessSuccessCallbackOption {
    /** 屏幕亮度值，范围 0 ~ 1，0 最暗，1 最亮 */
    value: number;
    errMsg: string;
  }
  interface GetScreenRecordingStateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetScreenRecordingStateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetScreenRecordingStateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetScreenRecordingStateSuccessCallback;
  }
  interface GetScreenRecordingStateSuccessCallbackResult {
    /** 录屏状态
     *
     * 可选值：
     * - 'on': 开启;
     * - 'off': 关闭; */
    state: 'on' | 'off';
    errMsg: string;
  }
  interface GetSelectedTextRangeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSelectedTextRangeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSelectedTextRangeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSelectedTextRangeSuccessCallback;
  }
  interface GetSelectedTextRangeSuccessCallbackResult {
    /** 输入框光标结束位置 */
    end: number;
    /** 输入框光标起始位置 */
    start: number;
    errMsg: string;
  }
  interface GetSelectionTextOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSelectionTextCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSelectionTextFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSelectionTextSuccessCallback;
  }
  interface GetSelectionTextSuccessCallbackResult {
    /** 纯文本内容 */
    text: string;
    errMsg: string;
  }
  interface GetSettingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSettingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSettingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSettingSuccessCallback;
    /** 需要基础库： `2.10.1`
     *
     * 是否同时获取用户订阅消息的订阅状态，默认不获取。注意：withSubscriptions 只返回用户勾选过订阅面板中的“总是保持以上选择，不再询问”的订阅消息。 */
    withSubscriptions?: boolean;
  }
  interface GetSettingSuccessCallbackResult {
    /** [AuthSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/AuthSetting.html)
     *
     * 用户授权结果 */
    authSetting: AuthSetting;
    /** [SubscriptionsSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/SubscriptionsSetting.html)
     *
     * 需要基础库： `2.10.1`
     *
     * 用户订阅消息设置，接口参数`withSubscriptions`值为`true`时才会返回。 */
    subscriptionsSetting: SubscriptionsSetting;
    /** [AuthSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/AuthSetting.html)
     *
     * 在插件中调用时，当前宿主小程序的用户授权结果 */
    miniprogramAuthSetting?: AuthSetting;
    errMsg: string;
  }
  interface GetShareInfoOption {
    /** shareTicket */
    shareTicket: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetShareInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetShareInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetShareInfoSuccessCallback;
    /** 需要基础库： `1.9.90`
     *
     * 超时时间，单位 ms */
    timeout?: number;
  }
  interface GetSkewOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSkewCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSkewFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSkewSuccessCallback;
  }
  interface GetSkewSuccessCallbackResult {
    /** 倾斜角 */
    skew: number;
    errMsg: string;
  }
  interface GetSkylineInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSkylineInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSkylineInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSkylineInfoSuccessCallback;
  }
  interface GetStorageInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetStorageInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetStorageInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetStorageInfoSuccessCallback;
  }
  interface GetStorageInfoSuccessCallbackOption {
    /** 当前占用的空间大小, 单位 KB */
    currentSize: number;
    /** 当前 storage 中所有的 key */
    keys: string[];
    /** 限制的空间大小，单位 KB */
    limitSize: number;
    errMsg: string;
  }
  interface GetStorageInfoSyncOption {
    /** 当前占用的空间大小, 单位 KB */
    currentSize: number;
    /** 当前 storage 中所有的 key */
    keys: string[];
    /** 限制的空间大小，单位 KB */
    limitSize: number;
  }
  interface GetStorageOption<T = any> {
    /** 本地缓存中指定的 key */
    key: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetStorageCompleteCallback;
    /** 需要基础库： `2.21.3`
     *
     * 是否开启加密存储。只有异步的 getStorage 接口支持开启加密存储。开启后，将会对 data 使用 AES128 解密，接口回调耗时将会增加。若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true */
    encrypt?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: GetStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetStorageSuccessCallback<T>;
  }
  interface GetStorageSuccessCallbackResult<T = any> {
    /** key对应的内容 */
    data: T;
    errMsg: string;
  }
  interface GetSystemInfoAsyncOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSystemInfoAsyncCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSystemInfoAsyncFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSystemInfoAsyncSuccessCallback;
  }
  interface GetSystemInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetSystemInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetSystemInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetSystemInfoSuccessCallback;
  }
  interface GetUserInfoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetUserInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetUserInfoFailCallback;
    /** 显示用户信息的语言
     *
     * 可选值：
     * - 'en': 英文;
     * - 'zh_CN': 简体中文;
     * - 'zh_TW': 繁体中文; */
    lang?: 'en' | 'zh_CN' | 'zh_TW';
    /** 接口调用成功的回调函数 */
    success?: GetUserInfoSuccessCallback;
    /** 是否带上登录态信息。当 withCredentials 为 true 时，要求此前有调用过 wx.login 且登录态尚未过期，此时返回的数据会包含 encryptedData, iv 等敏感信息；当 withCredentials 为 false 时，不要求有登录态，返回的数据不包含 encryptedData, iv 等敏感信息。 */
    withCredentials?: boolean;
  }
  interface GetUserInfoSuccessCallbackResult {
    /** 需要基础库： `2.7.0`
     *
     * 敏感数据对应的云 ID，开通[云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)的小程序才会返回，可通过云调用直接获取开放数据，详细见[云调用直接获取开放数据](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#method-cloud) */
    cloudID: string;
    /** 包括敏感数据在内的完整用户信息的加密数据，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) */
    encryptedData: string;
    /** 加密算法的初始向量，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) */
    iv: string;
    /** 不包括敏感信息的原始数据字符串，用于计算签名 */
    rawData: string;
    /** 使用 sha1( rawData + sessionkey ) 得到字符串，用于校验用户信息，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    signature: string;
    /** [UserInfo](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/UserInfo.html)
     *
     * 用户信息对象，不包含 openid 等敏感信息 */
    userInfo: UserInfo;
    errMsg: string;
  }
  interface GetUserProfileOption {
    /** 声明获取用户个人信息后的用途，不超过30个字符 */
    desc: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetUserProfileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetUserProfileFailCallback;
    /** 显示用户信息的语言
     *
     * 可选值：
     * - 'en': 英文;
     * - 'zh_CN': 简体中文;
     * - 'zh_TW': 繁体中文; */
    lang?: 'en' | 'zh_CN' | 'zh_TW';
    /** 接口调用成功的回调函数 */
    success?: GetUserProfileSuccessCallback;
  }
  interface GetUserProfileSuccessCallbackResult {
    /** 需要基础库： `2.10.4`
     *
     * 敏感数据对应的云 ID，开通[云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)的小程序才会返回，可通过云调用直接获取开放数据，详细见[云调用直接获取开放数据](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#method-cloud) */
    cloudID: string;
    /** 需要基础库： `2.10.4`
     *
     * 包括敏感数据在内的完整用户信息的加密数据，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) */
    encryptedData: string;
    /** 需要基础库： `2.10.4`
     *
     * 加密算法的初始向量，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) */
    iv: string;
    /** 需要基础库： `2.10.4`
     *
     * 不包括敏感信息的原始数据字符串，用于计算签名 */
    rawData: string;
    /** 需要基础库： `2.10.4`
     *
     * 使用 sha1( rawData + sessionkey ) 得到字符串，用于校验用户信息，详见 [用户数据的签名验证和加解密](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    signature: string;
    /** [UserInfo](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/UserInfo.html)
     *
     * 需要基础库： `2.10.4`
     *
     * 用户信息对象 */
    userInfo: UserInfo;
    errMsg: string;
  }
  interface GetVideoInfoOption {
    /** 视频文件路径，可以是临时文件路径也可以是永久文件路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetVideoInfoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetVideoInfoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetVideoInfoSuccessCallback;
  }
  interface GetVideoInfoSuccessCallbackResult {
    /** 视频码率，单位 kbps */
    bitrate: number;
    /** 视频长度 */
    duration: number;
    /** 视频帧率 */
    fps: number;
    /** 视频的长，单位 px */
    height: number;
    /** 画面方向
     *
     * 可选值：
     * - 'up': 默认;
     * - 'down': 180度旋转;
     * - 'left': 逆时针旋转90度;
     * - 'right': 顺时针旋转90度;
     * - 'up-mirrored': 同up，但水平翻转;
     * - 'down-mirrored': 同down，但水平翻转;
     * - 'left-mirrored': 同left，但垂直翻转;
     * - 'right-mirrored': 同right，但垂直翻转; */
    orientation:
      | 'up'
      | 'down'
      | 'left'
      | 'right'
      | 'up-mirrored'
      | 'down-mirrored'
      | 'left-mirrored'
      | 'right-mirrored';
    /** 视频大小，单位 kB */
    size: number;
    /** 视频格式 */
    type: string;
    /** 视频的宽，单位 px */
    width: number;
    errMsg: string;
  }
  interface GetWeRunDataOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetWeRunDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetWeRunDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetWeRunDataSuccessCallback;
  }
  interface GetWeRunDataSuccessCallbackResult {
    /** 需要基础库： `2.7.0`
     *
     * 敏感数据对应的云 ID，开通云开发的小程序才会返回，可通过云调用直接获取开放数据，详细见[云调用直接获取开放数据](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#method-cloud) */
    cloudID: string;
    /** 包括敏感数据在内的完整用户信息的加密数据，详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html)。解密后得到的数据结构见后文 */
    encryptedData: string;
    /** 加密算法的初始向量，详细见[加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html) */
    iv: string;
    errMsg: string;
  }
  interface GetWifiListOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: GetWifiListCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: GetWifiListFailCallback;
    /** 接口调用成功的回调函数 */
    success?: GetWifiListSuccessCallback;
  }
  /** 需要基础库： `2.28.0`
   *
   * 手势检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/hand.html)。 */
  interface HandTrack {
    /** 需要基础库： `2.28.0`
     *
     * 手势检测模式
     *
     * 可选值：
     * - 1: 通过摄像头实时检测;
     * - 2: 静态图片检测; */
    mode: 1 | 2;
  }
  interface HideHomeButtonOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideHomeButtonCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideHomeButtonFailCallback;
    /** 接口调用成功的回调函数 */
    success?: HideHomeButtonSuccessCallback;
  }
  interface HideKeyboardOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideKeyboardCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideKeyboardFailCallback;
    /** 接口调用成功的回调函数 */
    success?: HideKeyboardSuccessCallback;
  }
  interface HideLoadingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideLoadingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideLoadingFailCallback;
    /** 需要基础库： `2.22.1`
     *
     * 目前 toast 和 loading 相关接口可以相互混用，此参数可用于取消混用特性 */
    noConflict?: boolean;
    /** 接口调用成功的回调函数 */
    success?: HideLoadingSuccessCallback;
  }
  interface HideNavigationBarLoadingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideNavigationBarLoadingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideNavigationBarLoadingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: HideNavigationBarLoadingSuccessCallback;
  }
  interface HideShareMenuOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideShareMenuCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideShareMenuFailCallback;
    /** 需要基础库： `2.11.3`
     *
     * 本接口为 Beta 版本，暂只在 Android 平台支持。需要隐藏的转发按钮名称列表，默认['shareAppMessage', 'shareTimeline']。按钮名称合法值包含 "shareAppMessage"、"shareTimeline" 两种 */
    menus?: string[];
    /** 接口调用成功的回调函数 */
    success?: HideShareMenuSuccessCallback;
  }
  interface HideTabBarOption {
    /** 是否需要动画效果 */
    animation?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideTabBarCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideTabBarFailCallback;
    /** 接口调用成功的回调函数 */
    success?: HideTabBarSuccessCallback;
  }
  interface HideTabBarRedDotOption {
    /** tabBar 的哪一项，从左边算起 */
    index: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideTabBarRedDotCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideTabBarRedDotFailCallback;
    /** 接口调用成功的回调函数 */
    success?: HideTabBarRedDotSuccessCallback;
  }
  interface HideToastOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: HideToastCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: HideToastFailCallback;
    /** 需要基础库： `2.22.1`
     *
     * 目前 toast 和 loading 相关接口可以相互混用，此参数可用于取消混用特性 */
    noConflict?: boolean;
    /** 接口调用成功的回调函数 */
    success?: HideToastSuccessCallback;
  }
  /** 检测结果 */
  interface HitTestRes {
    /** 包含位置、旋转、放缩信息的矩阵，以列为主序 */
    transform: Float32Array;
  }
  /** 需要基础库： `2.7.0`
   *
   * 图片对象 */
  interface Image {
    /** 图片的真实高度 */
    height: number;
    /** 图片加载发生错误后触发的回调函数 */
    onerror: (...args: any[]) => any;
    /** 图片加载完成后触发的回调函数 */
    onload: (...args: any[]) => any;
    /** 需要基础库： `2.13.0`
     *
     * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
    referrerPolicy: string;
    /** 图片的 URL。v2.11.0 起支持传递 base64 Data URI */
    src: string;
    /** 图片的真实宽度 */
    width: number;
  }
  /** 需要基础库： `2.9.0`
   *
   * ImageData 对象 */
  interface ImageData {
    /** 一维数组，包含以 RGBA 顺序的数据，数据使用 0 至 255（包含）的整数表示 */
    data: Uint8ClampedArray;
    /** 使用像素描述 ImageData 的实际高度 */
    height: number;
    /** 使用像素描述 ImageData 的实际宽度 */
    width: number;
  }
  /** 需要基础库： `1.2.0`
   *
   * 图片的本地临时文件列表 */
  interface ImageFile {
    /** 本地临时文件路径 (本地路径) */
    path: string;
    /** 本地临时文件大小，单位 B */
    size: number;
  }
  interface IncludePointsOption {
    /** 要显示在可视区域内的坐标点列表 */
    points: MapPostion[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: IncludePointsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: IncludePointsFailCallback;
    /** 坐标点形成的矩形边缘到地图边缘的距离，单位像素。格式为[上,右,下,左]。开发者工具暂不支持padding参数。 */
    padding?: number[];
    /** 接口调用成功的回调函数 */
    success?: IncludePointsSuccessCallback;
  }
  interface InitFaceDetectOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: InitFaceDetectCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: InitFaceDetectFailCallback;
    /** 接口调用成功的回调函数 */
    success?: InitFaceDetectSuccessCallback;
  }
  interface InitMarkerClusterOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: InitMarkerClusterCompleteCallback;
    /** 启用默认的聚合样式 */
    enableDefaultStyle?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: InitMarkerClusterFailCallback;
    /** 聚合算法的可聚合距离，即距离小于该值的点会聚合至一起，以像素为单位 */
    gridSize?: number;
    /** 接口调用成功的回调函数 */
    success?: InitMarkerClusterSuccessCallback;
    /** 点击已经聚合的标记点时是否实现聚合分离 */
    zoomOnClick?: boolean;
  }
  /** InnerAudioContext 实例，可通过 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 接口获取实例。注意，音频播放过程中，可能被系统中断，可通过 [wx.onAudioInterruptionBegin](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionBegin.html)、[wx.onAudioInterruptionEnd](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionEnd.html)事件来处理这种情况。
*
* **支持格式**
*
* | 格式 | iOS  | Android |
* | ---- | ---- | ------- |
* | flac | x    | √       |
* | m4a  | √    | √       |
* | ogg  | x    | √       |
* | ape  | x    | √       |
* | amr  | x    | √       |
* | wma  | x    | √       |
* | wav  | √    | √       |
* | mp3  | √    | √       |
* | mp4  | x    | √       |
* | aac  | √    | √       |
* | aiff | √    | x       |
* | caf  | √    | x       |
*
* **示例代码**
*
* ```js
const innerAudioContext = wx.createInnerAudioContext()
innerAudioContext.autoplay = true
innerAudioContext.onPlay(() => {
  console.log('开始播放')
})
innerAudioContext.onError((res) => {
  console.log(res.errMsg)
  console.log(res.errCode)
})
``` */
  interface InnerAudioContext {
    /** 是否自动开始播放，默认为 `false` */
    autoplay: boolean;
    /** 音频缓冲的时间点，仅保证当前播放时间点到此时间点内容已缓冲（只读） */
    buffered: number;
    /** 当前音频的播放位置（单位 s）。只有在当前有合法的 src 时返回，时间保留小数点后 6 位（currentTime 属性在基础库 2.26.2 之前只读，基础库 2.26.2 开始可读可写，改变 currentTime 值等同于调用 seek） */
    currentTime: number;
    /** 当前音频的长度（单位 s）。只有在当前有合法的 src 时返回（只读） */
    duration: number;
    /** 是否循环播放，默认为 `false` */
    loop: boolean;
    /** 是否遵循系统静音开关，默认为 `true`。当此参数为 `false` 时，即使用户打开了静音开关，也能继续发出声音。从 2.3.0 版本开始此参数不生效，使用 [wx.setInnerAudioOption](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.setInnerAudioOption.html) 接口统一设置。 */
    obeyMuteSwitch: boolean;
    /** 当前是是否暂停或停止状态（只读） */
    paused: boolean;
    /** 需要基础库： `2.11.0`
     *
     * 播放速度。范围 0.5-2.0，默认为 1。（Android 需要 6 及以上版本） */
    playbackRate: number;
    /** 需要基础库： `2.13.0`
     *
     * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
    referrerPolicy: string;
    /** 音频资源的地址，用于直接播放。[2.2.3](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 开始支持云文件ID */
    src: string;
    /** 开始播放的位置（单位：s），默认为 0 */
    startTime: number;
    /** 需要基础库： `1.9.90`
     *
     * 音量。范围 0~1。默认为 1 */
    volume: number;
  }
  interface InnerAudioContextOnErrorListenerResult {
    /** 可选值：
     * - 10001: 系统错误;
     * - 10002: 网络错误;
     * - 10003: 文件错误;
     * - 10004: 格式错误;
     * - -1: 未知错误; */
    errCode: 10001 | 10002 | 10003 | 10004 | -1;
    errMsg: string;
  }
  interface InsertDividerOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: InsertDividerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: InsertDividerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: InsertDividerSuccessCallback;
  }
  interface InsertImageOption {
    /** 图片地址，仅支持 http(s)、base64、云图片(2.8.0)、临时文件(2.8.3)。 */
    src: string;
    /** 图像无法显示时的替代文本 */
    alt?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: InsertImageCompleteCallback;
    /** data 被序列化为 name=value;name1=value2 的格式挂在属性 data-custom 上 */
    data?: IAnyObject;
    /** 添加到图片 img 标签上的类名 */
    extClass?: string;
    /** 接口调用失败的回调函数 */
    fail?: InsertImageFailCallback;
    /** 图片高度 (pixels/百分比) */
    height?: string;
    /** 插入图片后是否自动换行，默认换行 */
    nowrap?: boolean;
    /** 接口调用成功的回调函数 */
    success?: InsertImageSuccessCallback;
    /** 图片宽度（pixels/百分比) */
    width?: string;
  }
  interface InsertTextOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: InsertTextCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: InsertTextFailCallback;
    /** 接口调用成功的回调函数 */
    success?: InsertTextSuccessCallback;
    /** 文本内容 */
    text?: string;
  }
  interface IntersectionObserverObserveCallbackResult {
    /** 目标边界 */
    boundingClientRect: BoundingClientRectResult;
    /** 节点自定义数据属性 */
    dataset: Record<string, any>;
    /** 节点 ID */
    id: string;
    /** 相交比例 */
    intersectionRatio: number;
    /** 相交区域的边界 */
    intersectionRect: IntersectionRectResult;
    /** 参照区域的边界 */
    relativeRect: RelativeRectResult;
    /** 相交检测时的时间戳 */
    time: number;
  }
  /** 相交区域的边界 */
  interface IntersectionRectResult {
    /** 下边界 */
    bottom: number;
    /** 高度 */
    height: number;
    /** 左边界 */
    left: number;
    /** 右边界 */
    right: number;
    /** 上边界 */
    top: number;
    /** 宽度 */
    width: number;
  }
  interface InterstitialAdOnErrorListenerResult {
    /** 错误码
     *
     * 可选值：
     * - 1000: 后端接口调用失败;
     * - 1001: 参数错误;
     * - 1002: 广告单元无效;
     * - 1003: 内部错误;
     * - 1004: 无合适的广告;
     * - 1005: 广告组件审核中;
     * - 1006: 广告组件被驳回;
     * - 1007: 广告组件被封禁;
     * - 1008: 广告单元已关闭; */
    errCode: 1000 | 1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007 | 1008;
    /** 错误信息 */
    errMsg: string;
  }
  interface IsBluetoothDevicePairedOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: IsBluetoothDevicePairedCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: IsBluetoothDevicePairedFailCallback;
    /** 接口调用成功的回调函数 */
    success?: IsBluetoothDevicePairedSuccessCallback;
  }
  interface IsConnectedOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: IsConnectedCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: IsConnectedFailCallback;
    /** 接口调用成功的回调函数 */
    success?: IsConnectedSuccessCallback;
  }
  interface Join1v1ChatOption {
    /** 呼叫方信息 */
    caller: VoIP1v1ChatUser;
    /** 接听方信息 */
    listener: VoIP1v1ChatUser;
    /** 窗口背景色(音频通话背景以及小窗模式背景)
     *
     * 可选值：
     * - 0: #262930;
     * - 1: #FA5151;
     * - 2: #FA9D3B;
     * - 3: #3D7257;
     * - 4: #1485EE;
     * - 5: #6467F0; */
    backgroundType?: 0 | 1 | 2 | 3 | 4 | 5;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: Join1v1ChatCompleteCallback;
    /** 不允许切换到语音通话 */
    disableSwitchVoice?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: Join1v1ChatFailCallback;
    /** 小窗样式 */
    minWindowType?: number;
    /** 通话类型
     *
     * 可选值：
     * - 'voice': 语音通话;
     * - 'video': 视频通话; */
    roomType?: 'voice' | 'video';
    /** 接口调用成功的回调函数 */
    success?: Join1v1ChatSuccessCallback;
  }
  interface JoinVoIPChatOption {
    /** 小游戏内此房间/群聊的 ID。同一时刻传入相同 groupId 的用户会进入到同个实时语音房间。 */
    groupId: string;
    /** 验证所需的随机字符串 */
    nonceStr: string;
    /** 签名，用于验证小游戏的身份 */
    signature: string;
    /** 验证所需的时间戳 */
    timeStamp: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: JoinVoIPChatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: JoinVoIPChatFailCallback;
    /** 需要基础库： `2.29.0`
     *
     * wifi下使用移动网络发送请求 */
    forceCellularNetwork?: boolean;
    /** 静音设置 */
    muteConfig?: MuteConfig;
    /** 房间类型
     *
     * 可选值：
     * - 'voice': 音频房间，用于语音通话;
     * - 'video': 视频房间，结合 [voip-room](https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html) 组件可显示成员画面; */
    roomType?: 'voice' | 'video';
    /** 接口调用成功的回调函数 */
    success?: JoinVoIPChatSuccessCallback;
  }
  interface JoinVoIPChatSuccessCallbackResult {
    /** 错误码 */
    errCode: number;
    /** 调用结果 */
    errMsg: string;
    /** 在此通话中的成员 openId 名单 */
    openIdList: string[];
  }
  interface KvList {
    /** key 本地缓存中指定的 key */
    key: string;
    /** data 需要存储的内容。只支持原生类型、Date、及能够通过`JSON.stringify`序列化的对象。 */
    value: any;
  }
  /** 启动参数 */
  interface LaunchOptionsApp {
    /** 需要基础库： `2.20.0`
     *
     * API 类别
     *
     * 可选值：
     * - 'default': 默认类别;
     * - 'nativeFunctionalized': 原生功能化，视频号直播商品、商品橱窗等场景打开的小程序;
     * - 'browseOnly': 仅浏览，朋友圈快照页等场景打开的小程序;
     * - 'embedded': 内嵌，通过打开半屏小程序能力打开的小程序; */
    apiCategory: 'default' | 'nativeFunctionalized' | 'browseOnly' | 'embedded';
    /** 打开的文件信息数组，只有从聊天素材场景打开（scene为1173）才会携带该参数 */
    forwardMaterials: ForwardMaterials[];
    /** 启动小程序的路径 (代码包路径) */
    path: string;
    /** 启动小程序的 query 参数 */
    query: IAnyObject;
    /** 来源信息。从另一个小程序、公众号或 App 进入小程序时返回。否则返回 `{}`。(参见后文注意) */
    referrerInfo: ReferrerInfo;
    /** 启动小程序的[场景值](https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/scene.html) */
    scene: number;
    /** 从微信群聊/单聊打开小程序时，chatType 表示具体微信群聊/单聊类型
     *
     * 可选值：
     * - 1: 微信联系人单聊;
     * - 2: 企业微信联系人单聊;
     * - 3: 普通微信群聊;
     * - 4: 企业微信互通群聊; */
    chatType?: 1 | 2 | 3 | 4;
    /** shareTicket，详见[获取更多转发信息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html) */
    shareTicket?: string;
  }
  interface LivePlayerContextRequestFullScreenOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestFullScreenCompleteCallback;
    /** 设置全屏时的方向
     *
     * 可选值：
     * - 0: 正常竖向;
     * - 90: 屏幕逆时针90度;
     * - -90: 屏幕顺时针90度; */
    direction?: 0 | 90 | -90;
    /** 接口调用失败的回调函数 */
    fail?: RequestFullScreenFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RequestFullScreenSuccessCallback;
  }
  interface LivePlayerContextSnapshotOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SnapshotCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SnapshotFailCallback;
    /** 需要基础库： `2.10.0`
     *
     * 图片的质量
     *
     * 可选值：
     * - 'raw': 原图;
     * - 'compressed': 压缩图; */
    quality?: 'raw' | 'compressed';
    /** 需要基础库： `2.25.0`
     *
     * 截取的源类型
     *
     * 可选值：
     * - 'stream': 截取视频源;
     * - 'view': 截取渲染后的画面; */
    sourceType?: 'stream' | 'view';
    /** 接口调用成功的回调函数 */
    success?: LivePlayerContextSnapshotSuccessCallback;
  }
  interface LivePlayerContextSnapshotSuccessCallbackResult {
    /** 图片的高度 */
    height: string;
    /** 图片文件的临时路径 (本地路径) */
    tempImagePath: string;
    /** 图片的宽度 */
    width: string;
    errMsg: string;
  }
  interface LivePusherContextSetZoomOption {
    /** 缩放级别，范围[1, maxZoom]。zoom 可取小数，精确到小数后一位。 */
    zoom: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetZoomCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetZoomFailCallback;
    /** 接口调用成功的回调函数 */
    success?: LivePusherContextSetZoomSuccessCallback;
  }
  interface LivePusherContextSnapshotOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SnapshotCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SnapshotFailCallback;
    /** 需要基础库： `2.10.0`
     *
     * 图片的质量
     *
     * 可选值：
     * - 'raw': 原图;
     * - 'compressed': 压缩图; */
    quality?: 'raw' | 'compressed';
    /** 需要基础库： `2.25.0`
     *
     * 截取的源类型
     *
     * 可选值：
     * - 'stream': 截取视频源;
     * - 'view': 截取渲染后的画面; */
    sourceType?: 'stream' | 'view';
    /** 接口调用成功的回调函数 */
    success?: LivePusherContextSnapshotSuccessCallback;
  }
  interface LivePusherContextSnapshotSuccessCallbackResult {
    /** 图片的高度 */
    height: string;
    /** 图片文件的临时路径 */
    tempImagePath: string;
    /** 图片的宽度 */
    width: string;
    errMsg: string;
  }
  interface LivePusherContextStartOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartSuccessCallback;
  }
  interface LoadFontFaceCompleteCallbackResult {
    /** 加载字体结果 */
    status: string;
  }
  interface LoadFontFaceOption {
    /** 定义的字体名称 */
    family: string;
    /** 字体资源的地址。建议格式为 TTF 和 WOFF，WOFF2 在低版本的iOS上会不兼容。 */
    source: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: LoadFontFaceCompleteCallback;
    /** 可选的字体描述符 */
    desc?: DescOption;
    /** 接口调用失败的回调函数 */
    fail?: LoadFontFaceFailCallback;
    /** 需要基础库： `2.10.0`
     *
     * 是否全局生效 */
    global?: boolean;
    /** 字体作用范围，可选值为 webview / native，默认 webview，设置 native 可在 Canvas 2D 下使用 */
    scopes?: any[];
    /** 接口调用成功的回调函数 */
    success?: LoadFontFaceSuccessCallback;
  }
  interface LocalInfo {
    /** 接收消息的 socket 的地址 */
    address: string;
    /** 使用的协议族，为 IPv4 或者 IPv6 */
    family: string;
    /** 端口号 */
    port: number;
  }
  interface LoginOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: LoginCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: LoginFailCallback;
    /** 接口调用成功的回调函数 */
    success?: LoginSuccessCallback;
    /** 需要基础库： `1.9.90`
     *
     * 超时时间，单位ms */
    timeout?: number;
  }
  interface LoginSuccessCallbackResult {
    /** 用户登录凭证（有效期五分钟）。开发者需要在开发者服务器后台调用 [code2Session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)，使用 code 换取 openid、unionid、session_key 等信息 */
    code: string;
    errMsg: string;
  }
  interface MakeBluetoothPairOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** pin 码，Base64 格式。 */
    pin: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MakeBluetoothPairCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MakeBluetoothPairFailCallback;
    /** 接口调用成功的回调函数 */
    success?: MakeBluetoothPairSuccessCallback;
    /** 超时时间，单位 ms */
    timeout?: number;
  }
  interface MakePhoneCallOption {
    /** 需要拨打的电话号码 */
    phoneNumber: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MakePhoneCallCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MakePhoneCallFailCallback;
    /** 接口调用成功的回调函数 */
    success?: MakePhoneCallSuccessCallback;
  }
  /** 广播的制造商信息。仅安卓支持，iOS 因系统限制无法定制。 */
  interface ManufacturerData {
    /** 制造商ID，0x 开头的十六进制 */
    manufacturerId: string;
    /** 制造商信息 */
    manufacturerSpecificData?: ArrayBuffer;
  }
  /** 图片覆盖的经纬度范围 */
  interface MapBounds {
    /** 东北角经纬度 */
    northeast: MapPostion;
    /** 西南角经纬度 */
    southwest: MapPostion;
  }
  interface MapPostion {
    /** 纬度 */
    latitude: number;
    /** 经度 */
    longitude: number;
  }
  /** 用来扩展（或收缩）参照节点布局区域的边界 */
  interface Margins {
    /** 节点布局区域的下边界 */
    bottom?: number;
    /** 节点布局区域的左边界 */
    left?: number;
    /** 节点布局区域的右边界 */
    right?: number;
    /** 节点布局区域的上边界 */
    top?: number;
  }
  /** 匹配到的缓存 */
  interface MatchCache {
    /** 缓存 id */
    cacheId: string;
    /** 缓存创建时间 */
    createTime: number;
    /** 缓存内容，会带有 fromCache 标记，方便开发者区分内容是否来自缓存 */
    data: any;
    /** 缓存有效时间 */
    maxAge: number;
    /** 命中的规则 id */
    ruleId: string;
  }
  /** MediaAudioPlayer 实例，可通过 [wx.createMediaAudioPlayer](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createMediaAudioPlayer.html) 接口获取实例。 */
  interface MediaAudioPlayer {
    /** 音量。范围 0~1。默认为 1 */
    volume: number;
  }
  /** 本地临时文件列表 */
  interface MediaFile {
    /** 视频的时间长度 */
    duration: number;
    /** 文件类型
     *
     * 可选值：
     * - 'image': 图片;
     * - 'video': 视频; */
    fileType: 'image' | 'video';
    /** 视频的高度 */
    height: number;
    /** 本地临时文件大小，单位 B */
    size: number;
    /** 本地临时文件路径 (本地路径) */
    tempFilePath: string;
    /** 视频缩略图临时文件路径 */
    thumbTempFilePath: string;
    /** 视频的宽度 */
    width: number;
  }
  interface MediaQueryObserverObserveCallbackResult {
    /** 页面的当前状态是否满足所指定的 media query */
    matches: boolean;
  }
  /** 需要预览的资源列表 */
  interface MediaSource {
    /** 图片或视频的地址 */
    url: string;
    /** 视频的封面图片 */
    poster?: string;
    /** 资源的类型，默认为图片
     *
     * 可选值：
     * - 'image': 图片;
     * - 'video': 视频; */
    type?: 'image' | 'video';
  }
  /** 需要基础库： `2.9.0`
   *
   * 可通过 [MediaContainer.extractDataSource](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.extractDataSource.html) 返回。
   *
   * [MediaTrack](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaTrack.html) 音频或视频轨道，可以对轨道进行一些操作 */
  interface MediaTrack {
    /** 轨道长度，只读 */
    duration: number;
    /** 轨道类型，只读
     *
     * 可选值：
     * - 'audio': 音频轨道;
     * - 'video': 视频轨道; */
    kind: 'audio' | 'video';
    /** 音量，音频轨道下有效，可写 */
    volume: number;
  }
  /** 小程序帐号信息 */
  interface MiniProgram {
    /** 小程序 appId */
    appId: string;
    /** 需要基础库： `2.10.0`
     *
     * 小程序版本
     *
     * 可选值：
     * - 'develop': 开发版;
     * - 'trial': 体验版;
     * - 'release': 正式版; */
    envVersion: 'develop' | 'trial' | 'release';
    /** 需要基础库： `2.10.2`
     *
     * 线上小程序版本号 */
    version: string;
  }
  interface MkdirOption {
    /** 创建的目录路径 (本地路径) */
    dirPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MkdirCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MkdirFailCallback;
    /** 需要基础库： `2.3.0`
     *
     * 是否在递归创建该目录的上级目录后再创建该目录。如果对应的上级目录已经存在，则不创建该上级目录。如 dirPath 为 a/b/c/d 且 recursive 为 true，将创建 a 目录，再在 a 目录下创建 b 目录，以此类推直至创建 a/b/c 目录下的 d 目录。 */
    recursive?: boolean;
    /** 接口调用成功的回调函数 */
    success?: MkdirSuccessCallback;
  }
  interface MoveAlongOption {
    /** 平滑移动的时间 */
    duration: number;
    /** 指定 marker */
    markerId: number;
    /** 移动路径的坐标串，坐标点格式 `{longitude, latitude}` */
    path: any[];
    /** 根据路径方向自动改变 marker 的旋转角度 */
    autoRotate?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MoveAlongCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MoveAlongFailCallback;
    /** 接口调用成功的回调函数 */
    success?: MoveAlongSuccessCallback;
  }
  interface MoveToLocationOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MoveToLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MoveToLocationFailCallback;
    /** 需要基础库： `2.8.0`
     *
     * 纬度 */
    latitude?: number;
    /** 需要基础库： `2.8.0`
     *
     * 经度 */
    longitude?: number;
    /** 接口调用成功的回调函数 */
    success?: MoveToLocationSuccessCallback;
  }
  /** 静音设置 */
  interface MuteConfig {
    /** 是否静音耳机 */
    muteEarphone?: boolean;
    /** 是否静音麦克风 */
    muteMicrophone?: boolean;
  }
  interface MuteOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: MuteCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: MuteFailCallback;
    /** 接口调用成功的回调函数 */
    success?: MuteSuccessCallback;
  }
  /** 需要基础库： `2.11.2` */
  interface NFCAdapter {
    /** 标签类型枚举 */
    tech: TechType;
  }
  interface NavigateBackMiniProgramOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NavigateBackMiniProgramCompleteCallback;
    /** 需要返回给上一个小程序的数据，上一个小程序可在 `App.onShow` 中获取到这份数据。 [详情](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html)。 */
    extraData?: IAnyObject;
    /** 接口调用失败的回调函数 */
    fail?: NavigateBackMiniProgramFailCallback;
    /** 接口调用成功的回调函数 */
    success?: NavigateBackMiniProgramSuccessCallback;
  }
  interface NavigateBackOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NavigateBackCompleteCallback;
    /** 返回的页面数，如果 delta 大于现有页面数，则返回到首页。 */
    delta?: number;
    /** 接口调用失败的回调函数 */
    fail?: NavigateBackFailCallback;
    /** 接口调用成功的回调函数 */
    success?: NavigateBackSuccessCallback;
  }
  interface NavigateToMiniProgramOption {
    /** 要打开的小程序 appId */
    appId?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NavigateToMiniProgramCompleteCallback;
    /** 要打开的小程序版本。仅在当前小程序为开发版或体验版时此参数有效。如果当前小程序是正式版，则打开的小程序必定是正式版。
     *
     * 可选值：
     * - 'develop': 开发版;
     * - 'trial': 体验版;
     * - 'release': 正式版; */
    envVersion?: 'develop' | 'trial' | 'release';
    /** 需要传递给目标小程序的数据，目标小程序可在 `App.onLaunch`，`App.onShow` 中获取到这份数据。如果跳转的是小游戏，可以在 [wx.onShow](#)、[wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 中可以获取到这份数据数据。 */
    extraData?: IAnyObject;
    /** 接口调用失败的回调函数 */
    fail?: NavigateToMiniProgramFailCallback;
    /** 需要基础库： `2.24.0`
     *
     * 不reLaunch目标小程序，直接打开目标跳转的小程序退后台时的页面，需满足以下条件：1. 目标跳转的小程序生命周期未被销毁；2. 且目标当次启动的path、query、apiCategory与上次启动相同。 */
    noRelaunchIfPathUnchanged?: boolean;
    /** 打开的页面路径，如果为空则打开首页。path 中 ? 后面的部分会成为 query，在小程序的 `App.onLaunch`、`App.onShow` 和 `Page.onLoad` 的回调函数或小游戏的 [wx.onShow](#) 回调函数、[wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 中可以获取到 query 数据。对于小游戏，可以只传入 query 部分，来实现传参效果，如：传入 "?foo=bar"。 */
    path?: string;
    /** 需要基础库： `2.18.1`
     *
     * 小程序链接，当传递该参数后，可以不传 appId 和 path。链接可以通过【小程序菜单】->【复制链接】获取。 */
    shortLink?: string;
    /** 接口调用成功的回调函数 */
    success?: NavigateToMiniProgramSuccessCallback;
  }
  interface NavigateToOption {
    /** 需要跳转的应用内非 tabBar 的页面的路径 (代码包路径), 路径后可以带参数。参数与路径之间使用 `?` 分隔，参数键与参数值用 `=` 相连，不同参数用 `&` 分隔；如 'path?key=value&key2=value2' */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NavigateToCompleteCallback;
    /** 页面间通信接口，用于监听被打开页面发送到当前页面的数据。基础库 2.7.3 开始支持。 */
    events?: IAnyObject;
    /** 接口调用失败的回调函数 */
    fail?: NavigateToFailCallback;
    /** 2.29.2 自定义路由类型，相关文档 [自定义路由](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/custom-route.html) */
    routeType?: string;
    /** 接口调用成功的回调函数 */
    success?: NavigateToSuccessCallback;
  }
  interface NavigateToSuccessCallbackResult {
    /** [EventChannel](https://developers.weixin.qq.com/miniprogram/dev/api/route/EventChannel.html)
     *
     * 和被打开页面进行通信 */
    eventChannel: EventChannel;
    errMsg: string;
  }
  interface NdefCloseOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NdefCloseCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: NdefCloseFailCallback;
    /** 接口调用成功的回调函数 */
    success?: NdefCloseSuccessCallback;
  }
  interface NdefConnectOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ConnectCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ConnectFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ConnectSuccessCallback;
  }
  interface NodeCallbackResult {
    /** 节点对应的 Node 实例 */
    node: IAnyObject;
  }
  interface NotifyBLECharacteristicValueChangeOption {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙设备 id */
    deviceId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** 是否启用 notify */
    state: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: NotifyBLECharacteristicValueChangeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: NotifyBLECharacteristicValueChangeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: NotifyBLECharacteristicValueChangeSuccessCallback;
    /** 需要基础库： `2.4.0`
     *
     * 设置特征订阅类型，有效值有 `notification` 和 `indication` */
    type?: string;
  }
  /** 需要基础库： `2.27.0`
   *
   * OCR检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/ocr.html)。 */
  interface OCRTrack {
    /** 需要基础库： `2.27.0`
     *
     * OCR检测模式
     *
     * 可选值：
     * - 1: 通过摄像头实时检测;
     * - 2: 静态图片检测; */
    mode: 1 | 2;
  }
  /** media query 描述符 */
  interface ObserveDescriptor {
    /** 页面高度（ px 为单位） */
    height: number;
    /** 页面最大高度（ px 为单位） */
    maxHeight: number;
    /** 页面最大宽度（ px 为单位） */
    maxWidth: number;
    /** 页面最小高度（ px 为单位） */
    minHeight: number;
    /** 页面最小宽度（ px 为单位） */
    minWidth: number;
    /** 屏幕方向（ `landscape` 或 `portrait` ） */
    orientation: string;
    /** 页面宽度（ px 为单位） */
    width: number;
  }
  /** 设置 type 监听单个类型的指标，设置 entryTypes 监听多个类型指标。 */
  interface ObserveOption {
    /** 指标类型列表。不能和 type 同时使用。 */
    entryTypes?: string[];
    /** 指标类型。不能和 entryTypes 同时使用
     *
     * 可选值：
     * - 'navigation': 路由;
     * - 'render': 渲染;
     * - 'script': 脚本; */
    type?: 'navigation' | 'render' | 'script';
  }
  /** 需要基础库： `2.7.0`
   *
   * 离屏 canvas 实例，可通过 [wx.createOffscreenCanvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html) 创建。 */
  interface OffscreenCanvas {
    /** 画布高度 */
    height: number;
    /** 画布宽度 */
    width: number;
  }
  interface OnAccelerometerChangeListenerResult {
    /** X 轴 */
    x: number;
    /** Y 轴 */
    y: number;
    /** Z 轴 */
    z: number;
  }
  interface OnBLECharacteristicValueChangeListenerResult {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙设备 id */
    deviceId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** 特征最新的值 */
    value: ArrayBuffer;
  }
  interface OnBLEConnectionStateChangeListenerResult {
    /** 是否处于已连接状态 */
    connected: boolean;
    /** 蓝牙设备 id */
    deviceId: string;
  }
  interface OnBLEMTUChangeListenerResult {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 最大传输单元 */
    mtu: number;
  }
  interface OnBLEPeripheralConnectionStateChangedListenerResult {
    /** 连接目前状态 */
    connected: boolean;
    /** 连接状态变化的设备 id */
    deviceId: string;
    /** server 的 UUID */
    serverId: string;
  }
  interface OnBackgroundFetchDataListenerResult {
    /** 缓存数据类别，取值为 periodic 或 pre */
    fetchType: string;
    /** 缓存数据 */
    fetchedData: string;
    /** 小程序页面路径 */
    path: string;
    /** 传给页面的 query 参数 */
    query: string;
    /** 进入小程序的场景值 */
    scene: number;
    /** 客户端拿到缓存数据的时间戳 */
    timeStamp: number;
  }
  interface OnBeaconServiceChangeListenerResult {
    /** 服务目前是否可用 */
    available: boolean;
    /** 目前是否处于搜索状态 */
    discovering: boolean;
  }
  interface OnBeaconUpdateListenerResult {
    /** 当前搜寻到的所有 Beacon 设备列表 */
    beacons: BeaconInfo[];
  }
  interface OnBluetoothAdapterStateChangeListenerResult {
    /** 蓝牙适配器是否可用 */
    available: boolean;
    /** 蓝牙适配器是否处于搜索状态 */
    discovering: boolean;
  }
  interface OnBluetoothDeviceFoundListenerResult {
    /** 新搜索到的设备列表 */
    devices: BlueToothDevice[];
  }
  interface OnCameraFrameCallbackResult {
    /** 图像像素点数据，一维数组，每四项表示一个像素点的 rgba */
    data: ArrayBuffer;
    /** 图像数据矩形的高度 */
    height: number;
    /** 图像数据矩形的宽度 */
    width: number;
  }
  interface OnCharacteristicReadRequestListenerResult {
    /** 唯一标识码，调用 [writeCharacteristicValue](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.writeCharacteristicValue.html) 时使用 */
    callbackId: number;
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
  }
  interface OnCharacteristicSubscribedListenerResult {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
  }
  interface OnCharacteristicWriteRequestListenerResult {
    /** 唯一标识码，调用 [writeCharacteristicValue](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.writeCharacteristicValue.html) 时使用 */
    callbackId: number;
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** 请求写入特征的二进制数据值 */
    value: ArrayBuffer;
  }
  interface OnCheckForUpdateListenerResult {
    /** 是否有新版本 */
    hasUpdate: boolean;
  }
  interface OnChunkReceivedListenerResult {
    /** 开发者服务器每次返回新chunk时的Response */
    res: Result;
  }
  interface OnCompassChangeListenerResult {
    /** 需要基础库： `2.4.0`
     *
     * 精度 */
    accuracy: number | string;
    /** 面对的方向度数 */
    direction: number;
  }
  interface OnCopyUrlListenerResult {
    /** 用短链打开小程序时当前页面携带的查询字符串。小程序中使用时，应在进入页面时调用 `wx.onCopyUrl` 自定义 `query`，退出页面时调用 `wx.offCopyUrl`，防止影响其它页面。 */
    query: string;
  }
  interface OnCustomRendererEventCallbackResult {
    /** 推流高度 */
    height: number;
    /** 推流宽度 */
    width: number;
  }
  interface OnDeviceMotionChangeListenerResult {
    /** 当 手机坐标 X/Y 和 地球 X/Y 重合时，绕着 Z 轴转动的夹角为 alpha，范围值为 [0, 2*PI)。逆时针转动为正。 */
    alpha: number;
    /** 当手机坐标 Y/Z 和地球 Y/Z 重合时，绕着 X 轴转动的夹角为 beta。范围值为 [-1*PI, PI) 。顶部朝着地球表面转动为正。也有可能朝着用户为正。 */
    beta: number;
    /** 当手机 X/Z 和地球 X/Z 重合时，绕着 Y 轴转动的夹角为 gamma。范围值为 [-1*PI/2, PI/2)。右边朝着地球表面转动为正。 */
    gamma: number;
  }
  interface OnDiscoveredListenerResult {
    id: ArrayBuffer;
    /** 可选，NdefMessage 数组，消息格式为 {id: ArrayBuffer, type: ArrayBuffer, payload: ArrayBuffer} */
    messages: any[];
    /** tech 数组，用于匹配NFC卡片具体可以使用什么标准（NfcA等实例）处理 */
    techs: any[];
  }
  interface OnFrameRecordedListenerResult {
    /** 录音分片数据 */
    frameBuffer: ArrayBuffer;
    /** 当前帧是否正常录音结束前的最后一帧 */
    isLastFrame: boolean;
  }
  interface OnGetWifiListListenerResult {
    /** Wi-Fi 列表数据 */
    wifiList: WifiInfo[];
  }
  interface OnGyroscopeChangeListenerResult {
    /** x 轴的角速度 */
    x: number;
    /** y 轴的角速度 */
    y: number;
    /** z 轴的角速度 */
    z: number;
  }
  interface OnHCEMessageListenerResult {
    /** `messageType=1` 时 ,客户端接收到 NFC 设备的指令 */
    data: ArrayBuffer;
    /** 消息类型
     *
     * 可选值：
     * - 1: HCE APDU Command类型，小程序需对此指令进行处理，并调用 sendHCEMessage 接口返回处理指令;
     * - 2: 设备离场事件类型; */
    messageType: 1 | 2;
    /** `messageType=2` 时，原因 */
    reason: number;
  }
  interface OnHeadersReceivedListenerResult {
    /** 开发者服务器返回的 HTTP Response Header */
    header: IAnyObject;
  }
  interface OnKeyboardHeightChangeListenerResult {
    /** 键盘高度 */
    height: number;
  }
  interface OnLazyLoadErrorListenerResult {
    /** 详细信息 */
    errMsg: string;
    /** 异步组件所属的分包 */
    subpackage: any[];
    /** 'subpackage' 失败类型 */
    type: string;
  }
  interface OnLocalServiceFoundListenerResult {
    /** 服务的 ip 地址 */
    ip: string;
    /** 服务的端口 */
    port: number;
    /** 服务的名称 */
    serviceName: string;
    /** 服务的类型 */
    serviceType: string;
  }
  interface OnLocalServiceLostListenerResult {
    /** 服务的名称 */
    serviceName: string;
    /** 服务的类型 */
    serviceType: string;
  }
  interface OnLocationChangeErrorListenerResult {
    /** 错误码 */
    errCode: number;
  }
  interface OnLocationChangeListenerResult {
    /** 位置的精确度 */
    accuracy: number;
    /** 需要基础库： `1.2.0`
     *
     * 高度，单位 m */
    altitude: number;
    /** 需要基础库： `1.2.0`
     *
     * 水平精度，单位 m */
    horizontalAccuracy: number;
    /** 纬度，范围为 -90~90，负数表示南纬。使用 gcj02 国测局坐标系 */
    latitude: number;
    /** 经度，范围为 -180~180，负数表示西经。使用 gcj02 国测局坐标系 */
    longitude: number;
    /** 速度，单位 m/s */
    speed: number;
    /** 需要基础库： `1.2.0`
     *
     * 垂直精度，单位 m（Android 无法获取，返回 0） */
    verticalAccuracy: number;
  }
  interface OnMemoryWarningListenerResult {
    /** 内存告警等级，只有 Android 才有，对应系统宏定义
     *
     * 可选值：
     * - 5: TRIM_MEMORY_RUNNING_MODERATE;
     * - 10: TRIM_MEMORY_RUNNING_LOW;
     * - 15: TRIM_MEMORY_RUNNING_CRITICAL; */
    level: 5 | 10 | 15;
  }
  interface OnNetworkStatusChangeListenerResult {
    /** 当前是否有网络连接 */
    isConnected: boolean;
    /** 网络类型
     *
     * 可选值：
     * - 'wifi': wifi 网络;
     * - '2g': 2g 网络;
     * - '3g': 3g 网络;
     * - '4g': 4g 网络;
     * - '5g': 5g 网络;
     * - 'unknown': Android 下不常见的网络类型;
     * - 'none': 无网络; */
    networkType: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none';
  }
  interface OnNetworkWeakChangeListenerResult {
    /** 当前网络类型 */
    networkType: string;
    /** 当前是否处于弱网状态 */
    weakNet: boolean;
  }
  interface OnOpenListenerResult {
    /** 需要基础库： `2.0.0`
     *
     * 连接成功的 HTTP 响应 Header */
    header: IAnyObject;
    /** 需要基础库： `2.10.4`
     *
     * 网络请求过程中一些调试信息 */
    profile: SocketProfile;
  }
  interface OnPageNotFoundListenerResult {
    /** 是否本次启动的首个页面（例如从分享等入口进来，首个页面是开发者配置的分享页面） */
    isEntryPage: boolean;
    /** 不存在页面的路径 (代码包路径) */
    path: string;
    /** 打开不存在页面的 query 参数 */
    query: IAnyObject;
  }
  interface OnScreenRecordingStateChangedListenerResult {
    /** 录屏状态
     *
     * 可选值：
     * - 'start': 开始录屏;
     * - 'stop': 结束录屏; */
    state: 'start' | 'stop';
  }
  interface OnSocketOpenListenerResult {
    /** 需要基础库： `2.0.0`
     *
     * 连接成功的 HTTP 响应 Header */
    header: IAnyObject;
  }
  interface OnStopListenerResult {
    /** 录音总时长，单位：ms */
    duration: number;
    /** 录音文件大小，单位：Byte */
    fileSize: number;
    /** 录音文件的临时路径 (本地路径) */
    tempFilePath: string;
  }
  interface OnThemeChangeListenerResult {
    /** 系统当前的主题，取值为`light`或`dark`
     *
     * 可选值：
     * - 'dark': 深色主题;
     * - 'light': 浅色主题; */
    theme: 'dark' | 'light';
  }
  interface OnUnhandledRejectionListenerResult {
    /** 被拒绝的 Promise 对象 */
    promise: Promise<any>;
    /** 拒绝原因，一般是一个 Error 对象 */
    reason: string;
  }
  interface OnVoIPChatInterruptedListenerResult {
    /** 错误码 */
    errCode: number;
    /** 调用结果（错误原因） */
    errMsg: string;
  }
  interface OnVoIPChatMembersChangedListenerResult {
    /** 错误码 */
    errCode: number;
    /** 调用结果 */
    errMsg: string;
    /** 还在实时语音通话中的成员 openId 名单 */
    openIdList: string[];
  }
  interface OnVoIPChatSpeakersChangedListenerResult {
    /** 错误码 */
    errCode: number;
    /** 调用结果（错误原因） */
    errMsg: string;
    /** 还在实时语音通话中的成员 openId 名单 */
    openIdList: string[];
  }
  interface OnVoIPChatStateChangedListenerResult {
    /** 事件码 */
    code: number;
    /** 附加信息 */
    data: IAnyObject;
    /** 错误码 */
    errCode: number;
    /** 调用结果 */
    errMsg: string;
  }
  interface OnVoIPVideoMembersChangedListenerResult {
    /** 错误码 */
    errCode: number;
    /** 调用结果 */
    errMsg: string;
    /** 开启视频的成员名单 */
    openIdList: string[];
  }
  interface OnWifiConnectedListenerResult {
    /** [WifiInfo](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/WifiInfo.html)
     *
     * Wi-Fi 信息 */
    wifi: WifiInfo;
  }
  interface OnWifiConnectedWithPartialInfoListenerResult {
    /** [WifiInfo](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/WifiInfo.html)
     *
     * 只包含 SSID 属性的 WifiInfo 对象 */
    wifi: WifiInfo;
  }
  interface OnWindowResizeListenerResult {
    size: Size;
  }
  interface OpenAppAuthorizeSettingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenAppAuthorizeSettingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenAppAuthorizeSettingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenAppAuthorizeSettingSuccessCallback;
  }
  interface OpenBluetoothAdapterOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenBluetoothAdapterCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenBluetoothAdapterFailCallback;
    /** 需要基础库： `2.10.0`
     *
     * 蓝牙模式，可作为主/从设备，仅 iOS 需要。
     *
     * 可选值：
     * - 'central': 主机模式;
     * - 'peripheral': 从机（外围设备）模式; */
    mode?: 'central' | 'peripheral';
    /** 接口调用成功的回调函数 */
    success?: OpenBluetoothAdapterSuccessCallback;
  }
  interface OpenCardOption {
    /** 需要打开的卡券列表 */
    cardList: OpenCardRequestInfo[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenCardCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenCardFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenCardSuccessCallback;
  }
  /** 需要打开的卡券列表 */
  interface OpenCardRequestInfo {
    /** 卡券 ID */
    cardId: string;
    /** 由 [wx.addCard](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/card/wx.addCard.html) 的返回对象中的加密 code 通过解密后得到，解密请参照：[code 解码接口](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1499332673_Unm7V) */
    code: string;
  }
  interface OpenChannelsActivityOption {
    /** 视频 feedId */
    feedId: string;
    /** 视频号 id，以“sph”开头的id，可在视频号助手获取 */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenChannelsActivityCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenChannelsActivityFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenChannelsActivitySuccessCallback;
  }
  interface OpenChannelsEventOption {
    /** 活动 id */
    eventId: string;
    /** 视频号 id，以“sph”开头的id，可在视频号助手获取 */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenChannelsEventCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenChannelsEventFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenChannelsEventSuccessCallback;
  }
  interface OpenChannelsLiveOption {
    /** 视频号 id，以“sph”开头的id，可在视频号助手获取 */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenChannelsLiveCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenChannelsLiveFailCallback;
    /** 直播 feedId，通过 getChannelsLiveInfo 接口获取（基础库 v2.19.2 之前的版本需要填写） */
    feedId?: string;
    /** 直播 nonceId，通过 getChannelsLiveInfo 接口获取（基础库 v2.19.2 之前的版本需要填写） */
    nonceId?: string;
    /** 接口调用成功的回调函数 */
    success?: OpenChannelsLiveSuccessCallback;
  }
  interface OpenChannelsUserProfileOption {
    /** 视频号 id */
    finderUserName: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenChannelsUserProfileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenChannelsUserProfileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenChannelsUserProfileSuccessCallback;
  }
  interface OpenCustomerServiceChatOption {
    /** 企业ID */
    corpId: string;
    /** 客服信息 */
    extInfo: ExtInfoOption;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenCustomerServiceChatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenCustomerServiceChatFailCallback;
    /** 气泡消息图片 */
    sendMessageImg?: string;
    /** 气泡消息小程序路径 */
    sendMessagePath?: string;
    /** 气泡消息标题 */
    sendMessageTitle?: string;
    /** 是否发送小程序气泡消息 */
    showMessageCard?: boolean;
    /** 接口调用成功的回调函数 */
    success?: OpenCustomerServiceChatSuccessCallback;
  }
  interface OpenDocumentOption {
    /** 文件路径 (本地路径) ，可通过 downloadFile 获得 */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenDocumentCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenDocumentFailCallback;
    /** 需要基础库： `1.4.0`
     *
     * 文件类型，指定文件类型打开文件
     *
     * 可选值：
     * - 'doc': doc 格式;
     * - 'docx': docx 格式;
     * - 'xls': xls 格式;
     * - 'xlsx': xlsx 格式;
     * - 'ppt': ppt 格式;
     * - 'pptx': pptx 格式;
     * - 'pdf': pdf 格式; */
    fileType?: 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'pdf';
    /** 需要基础库： `2.11.0`
     *
     * 是否显示右上角菜单 */
    showMenu?: boolean;
    /** 接口调用成功的回调函数 */
    success?: OpenDocumentSuccessCallback;
  }
  interface OpenEmbeddedMiniProgramOption {
    /** 要打开的小程序 appId */
    appId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenEmbeddedMiniProgramCompleteCallback;
    /** 要打开的小程序版本。仅在当前小程序为开发版或体验版时此参数有效。如果当前小程序是正式版，则打开的小程序必定是正式版。
     *
     * 可选值：
     * - 'develop': 开发版;
     * - 'trial': 体验版;
     * - 'release': 正式版; */
    envVersion?: 'develop' | 'trial' | 'release';
    /** 需要传递给目标小程序的数据，目标小程序可在 `App.onLaunch`，`App.onShow` 中获取到这份数据。如果跳转的是小游戏，可以在 [wx.onShow](#)、[wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 中可以获取到这份数据数据。 */
    extraData?: IAnyObject;
    /** 接口调用失败的回调函数 */
    fail?: OpenEmbeddedMiniProgramFailCallback;
    /** 需要基础库： `2.24.0`
     *
     * 不reLaunch目标小程序，直接打开目标跳转的小程序退后台时的页面，需满足以下条件：1. 目标跳转的小程序生命周期未被销毁；2. 且目标当次启动的path、query、apiCategory与上次启动相同。 */
    noRelaunchIfPathUnchanged?: boolean;
    /** 打开的页面路径，如果为空则打开首页。path 中 ? 后面的部分会成为 query，在小程序的 `App.onLaunch`、`App.onShow` 和 `Page.onLoad` 的回调函数或小游戏的 [wx.onShow](#) 回调函数、[wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 中可以获取到 query 数据。对于小游戏，可以只传入 query 部分，来实现传参效果，如：传入 "?foo=bar"。 */
    path?: string;
    /** 小程序链接，当传递该参数后，可以不传 appId 和 path。链接可以通过【小程序菜单】->【复制链接】获取。仅 verify=binding 支持。 */
    shortLink?: string;
    /** 接口调用成功的回调函数 */
    success?: OpenEmbeddedMiniProgramSuccessCallback;
    /** 需要基础库： `2.24.3`
     *
     * 校验方式。
     *
     * 可选值：
     * - 'binding': 校验小程序管理后台的绑定关系。;
     * - 'unionProduct': 校验目标打开链接是否为[小程序联盟](https://developers.weixin.qq.com/doc/ministore/union/brief-introduction.html)商品。; */
    verify?: 'binding' | 'unionProduct';
  }
  interface OpenLocationOption {
    /** 纬度，范围为-90~90，负数表示南纬。使用 gcj02 国测局坐标系 */
    latitude: number;
    /** 经度，范围为-180~180，负数表示西经。使用 gcj02 国测局坐标系 */
    longitude: number;
    /** 地址的详细说明 */
    address?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenLocationFailCallback;
    /** 位置名 */
    name?: string;
    /** 缩放比例，范围5~18 */
    scale?: number;
    /** 接口调用成功的回调函数 */
    success?: OpenLocationSuccessCallback;
  }
  interface OpenMapAppOption {
    /** 目的地名称 */
    destination: string;
    /** 目的地纬度 */
    latitude: number;
    /** 目的地经度 */
    longitude: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenMapAppCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenMapAppFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenMapAppSuccessCallback;
  }
  interface OpenOption {
    /** 文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenFailCallback;
    /** 文件系统标志，默认值: 'r'
     *
     * 可选值：
     * - 'a': 打开文件用于追加。 如果文件不存在，则创建该文件;
     * - 'ax': 类似于 'a'，但如果路径存在，则失败;
     * - 'a+': 打开文件用于读取和追加。 如果文件不存在，则创建该文件;
     * - 'ax+': 类似于 'a+'，但如果路径存在，则失败;
     * - 'as': 打开文件用于追加（在同步模式中）。 如果文件不存在，则创建该文件;
     * - 'as+': 打开文件用于读取和追加（在同步模式中）。 如果文件不存在，则创建该文件;
     * - 'r': 打开文件用于读取。 如果文件不存在，则会发生异常;
     * - 'r+': 打开文件用于读取和写入。 如果文件不存在，则会发生异常;
     * - 'w': 打开文件用于写入。 如果文件不存在则创建文件，如果文件存在则截断文件;
     * - 'wx': 类似于 'w'，但如果路径存在，则失败;
     * - 'w+': 打开文件用于读取和写入。 如果文件不存在则创建文件，如果文件存在则截断文件;
     * - 'wx+': 类似于 'w+'，但如果路径存在，则失败; */
    flag?: 'a' | 'ax' | 'a+' | 'ax+' | 'as' | 'as+' | 'r' | 'r+' | 'w' | 'wx' | 'w+' | 'wx+';
    /** 接口调用成功的回调函数 */
    success?: OpenSuccessCallback;
  }
  interface OpenSettingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenSettingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenSettingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenSettingSuccessCallback;
    /** 需要基础库： `2.10.3`
     *
     * 是否同时获取用户订阅消息的订阅状态，默认不获取。注意：withSubscriptions 只返回用户勾选过订阅面板中的“总是保持以上选择，不再询问”的订阅消息。 */
    withSubscriptions?: boolean;
  }
  interface OpenSettingSuccessCallbackResult {
    /** [AuthSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/AuthSetting.html)
     *
     * 用户授权结果 */
    authSetting: AuthSetting;
    /** [SubscriptionsSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/SubscriptionsSetting.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 用户订阅消息设置，接口参数`withSubscriptions`值为`true`时才会返回。 */
    subscriptionsSetting: SubscriptionsSetting;
    errMsg: string;
  }
  interface OpenSuccessCallbackResult {
    /** 文件描述符 */
    fd: string;
    errMsg: string;
  }
  interface OpenSyncOption {
    /** 文件路径 (本地路径) */
    filePath: string;
    /** 文件系统标志，默认值: 'r'
     *
     * 可选值：
     * - 'a': 打开文件用于追加。 如果文件不存在，则创建该文件;
     * - 'ax': 类似于 'a'，但如果路径存在，则失败;
     * - 'a+': 打开文件用于读取和追加。 如果文件不存在，则创建该文件;
     * - 'ax+': 类似于 'a+'，但如果路径存在，则失败;
     * - 'as': 打开文件用于追加（在同步模式中）。 如果文件不存在，则创建该文件;
     * - 'as+': 打开文件用于读取和追加（在同步模式中）。 如果文件不存在，则创建该文件;
     * - 'r': 打开文件用于读取。 如果文件不存在，则会发生异常;
     * - 'r+': 打开文件用于读取和写入。 如果文件不存在，则会发生异常;
     * - 'w': 打开文件用于写入。 如果文件不存在则创建文件，如果文件存在则截断文件;
     * - 'wx': 类似于 'w'，但如果路径存在，则失败;
     * - 'w+': 打开文件用于读取和写入。 如果文件不存在则创建文件，如果文件存在则截断文件;
     * - 'wx+': 类似于 'w+'，但如果路径存在，则失败; */
    flag?: 'a' | 'ax' | 'a+' | 'ax+' | 'as' | 'as+' | 'r' | 'r+' | 'w' | 'wx' | 'w+' | 'wx+';
  }
  interface OpenSystemBluetoothSettingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenSystemBluetoothSettingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenSystemBluetoothSettingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenSystemBluetoothSettingSuccessCallback;
  }
  interface OpenVideoEditorOption {
    /** 视频源的路径，只支持本地路径 */
    filePath: string;
    /** 需要基础库： `2.16.1`
     *
     * 视频裁剪的最大长度 */
    maxDuration: string;
    /** 需要基础库： `2.16.1`
     *
     * 视频裁剪的最小长度 */
    minDuration: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: OpenVideoEditorCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: OpenVideoEditorFailCallback;
    /** 接口调用成功的回调函数 */
    success?: OpenVideoEditorSuccessCallback;
  }
  interface OpenVideoEditorSuccessCallbackResult {
    /** 剪辑后生成的视频文件的时长，单位毫秒（ms） */
    duration: number;
    /** 剪辑后生成的视频文件大小，单位字节数（byte） */
    size: number;
    /** 编辑后生成的视频文件的临时路径 */
    tempFilePath: string;
    /** 编辑后生成的缩略图文件的临时路径 */
    tempThumbPath: string;
    errMsg: string;
  }
  interface PageScrollToOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PageScrollToCompleteCallback;
    /** 滚动动画的时长，单位 ms */
    duration?: number;
    /** 接口调用失败的回调函数 */
    fail?: PageScrollToFailCallback;
    /** 需要基础库： `2.23.1`
     *
     * 偏移距离，需要和 selector 参数搭配使用，可以滚动到 selector 加偏移距离的位置，单位 px */
    offsetTop?: number;
    /** 滚动到页面的目标位置，单位 px */
    scrollTop?: number;
    /** 需要基础库： `2.7.3`
     *
     * 选择器 */
    selector?: string;
    /** 接口调用成功的回调函数 */
    success?: PageScrollToSuccessCallback;
  }
  interface PauseBGMOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PauseBGMCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PauseBGMFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PauseBGMSuccessCallback;
  }
  interface PauseBackgroundAudioOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PauseBackgroundAudioCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PauseBackgroundAudioFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PauseBackgroundAudioSuccessCallback;
  }
  interface PauseOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PauseCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PauseFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PauseSuccessCallback;
  }
  interface PauseVoiceOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PauseVoiceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PauseVoiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PauseVoiceSuccessCallback;
  }
  /** 单条性能数据。具体数据口径请参考[性能数据文档]((performance/perf_data##_1-4-%E9%80%9A%E8%BF%87-wx-getPerformance-%E5%9C%A8%E5%B0%8F%E7%A8%8B%E5%BA%8F%E5%86%85%E8%8E%B7%E5%8F%96)) */
  interface PerformanceEntry {
    /** 需要基础库： `2.24.0`
     *
     * 解析域名结束时间。仅 resourceTiming 指标有效。 */
    domainLookupEnd: number;
    /** 需要基础库： `2.24.0`
     *
     * 解析域名开始时间。仅 resourceTiming 指标有效。 */
    domainLookupStart: number;
    /** 耗时 ms。仅对于表示阶段的指标有效。 */
    duration: number;
    /** 指标类型
     *
     * 可选值：
     * - 'navigation': 路由;
     * - 'render': 渲染;
     * - 'script': 脚本; */
    entryType: 'navigation' | 'render' | 'script';
    /** 需要基础库： `2.21.2`
     *
     * 注入文件列表。仅 evaluateScript 指标有效。 */
    fileList: string[];
    /** 需要基础库： `2.21.2`
     *
     * 首次渲染参数在渲染层收到的时间。仅 firstRender 指标有效。 */
    initDataRecvTime: number;
    /** 需要基础库： `2.21.2`
     *
     * 首次渲染参数从逻辑层发出的时间。仅 firstRender 指标有效。 */
    initDataSendTime: number;
    /** 需要基础库： `2.24.0`
     *
     * 初始化性能条目的资源类型。仅 resourceTiming 指标有效。
     *
     * 可选值：
     * - 'audio': 音频;
     * - 'cover-image': cover-image 组件的图片;
     * - 'image': 组件的图片;
     * - 'open-data': 组件的图片; */
    initiatorType: 'audio' | 'cover-image' | 'image' | 'open-data';
    /** 分包名，主包表示为 __APP__ (2.21.2 开始)。仅 evaluateScript 指标有效。 */
    moduleName: string;
    /** 指标名称
     *
     * 可选值：
     * - 'appLaunch': 小程序启动耗时。(entryType: navigation);
     * - 'route': 路由处理耗时。(entryType: navigation);
     * - 'firstRender': 页面首次渲染耗时。(entryType: render);
     * - 'firstPaint': 页面首次绘制(FP)时间点，无 duration。（iOS 不支持）(entryType: render);
     * - 'firstContentfulPaint': 页面首次内容绘制(FCP)时间点，无 duration。（iOS 14.5 以下版本不支持）(entryType: render);
     * - 'largestContentfulPaint': 页面最大内容绘制(LCP)时间点，无 duration。（iOS 不支持）(entryType: render);
     * - 'evaluateScript': 逻辑层 JS 代码注入耗时。(entryType: script);
     * - 'downloadPackage': 代码包下载耗时。(entryType: loadPackage);
     * - 'resourceTiming': 视图层资源加载耗时。(entryType: resource); */
    name:
      | 'appLaunch'
      | 'route'
      | 'firstRender'
      | 'firstPaint'
      | 'firstContentfulPaint'
      | 'largestContentfulPaint'
      | 'evaluateScript'
      | 'downloadPackage'
      | 'resourceTiming';
    /** 路由真正响应开始时间。仅 navigation 类型指标有效。 */
    navigationStart: number;
    /** 路由详细类型，与小程序路由方法对应。仅 navigation 类型指标有效。 */
    navigationType: string;
    /** 需要基础库： `2.24.0`
     *
     * 代码包名称。仅 downloadPackage 指标有效。 */
    packageName: string;
    /** 需要基础库： `2.24.0`
     *
     * 代码包大小。仅 downloadPackage 指标有效。 */
    packageSize: number;
    /** 需要基础库： `2.23.1`
     *
     * path 对应页面实例 Id（随机生成，不保证递增）。仅 render/navigation 指标有效。 */
    pageId: number;
    /** 页面路径。仅 render 和 navigation 类型指标有效。 */
    path: string;
    /** 需要基础库： `2.23.1`
     *
     * referrerPath对应页面实例 Id（随机生成，不保证递增）。仅 route 指标有效。 */
    referrerPageId: number;
    /** 需要基础库： `2.23.1`
     *
     * 页面跳转来源页面路径。仅 route 指标有效。 */
    referrerPath: number;
    /** 开始时间，不同指标的具体含义会有差异。 */
    startTime: number;
    /** 需要基础库： `2.24.0`
     *
     * 表示获取资源的大小（以八位字节为单位）的数字。仅 resourceTiming 指标有效。(iOS 不支持） */
    transferSize: number;
    /** 需要基础库： `2.24.0`
     *
     * 资源路径。仅 resourceTiming 指标有效。 */
    uri: string;
    /** 需要基础库： `2.21.2`
     *
     * 渲染层代码注入完成时间。仅 firstRender 指标有效。 */
    viewLayerReadyTime: number;
    /** 需要基础库： `2.21.2`
     *
     * 渲染层执行渲染结束时间。仅 firstRender 指标有效。 */
    viewLayerRenderEndTime: number;
    /** 需要基础库： `2.21.2`
     *
     * 渲染层执行渲染开始时间。仅 firstRender 指标有效。 */
    viewLayerRenderStartTime: number;
  }
  /** 需要基础库： `2.11.0`
   *
   * PerformanceObserver 对象，用于监听性能相关事件 */
  interface PerformanceObserver {
    /** 获取当前支持的所有性能指标类型 */
    supportedEntryTypes: any[];
  }
  /** 平面跟踪配置 */
  interface PlaneTrack {
    /** 平面跟踪配置模式
     *
     * 可选值：
     * - 1: 检测横向平面;
     * - 2: 检测纵向平面，只有 v2 版本支持;
     * - 3: 检测横向和纵向平面，只有 v2 版本支持; */
    mode: 1 | 2 | 3;
  }
  interface PlayBGMOption {
    /** 加入背景混音的资源地址 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PlayBGMCompleteCallback;
    /** 需要基础库： `2.31.0`
     *
     * BGM结束播放时间点，单位ms，0代表播放至文件结尾，若入参为负或超过文件长度，则默认播放至文件结尾 */
    endTimeMs?: number;
    /** 接口调用失败的回调函数 */
    fail?: PlayBGMFailCallback;
    /** 需要基础库： `2.31.0`
     *
     * BGM开始播时间点，单位ms，若入参为负或超过文件长度，则默认从文件开头进行播放 */
    startTimeMs?: number;
    /** 接口调用成功的回调函数 */
    success?: PlayBGMSuccessCallback;
  }
  interface PlayBackgroundAudioOption {
    /** 音乐链接，目前支持的格式有 m4a, aac, mp3, wav */
    dataUrl: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PlayBackgroundAudioCompleteCallback;
    /** 封面URL */
    coverImgUrl?: string;
    /** 接口调用失败的回调函数 */
    fail?: PlayBackgroundAudioFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PlayBackgroundAudioSuccessCallback;
    /** 音乐标题 */
    title?: string;
  }
  interface PlayOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PlayCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PlayFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PlaySuccessCallback;
  }
  interface PlayVoiceOption {
    /** 需要播放的语音文件的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PlayVoiceCompleteCallback;
    /** 需要基础库： `1.6.0`
     *
     * 指定播放时长，到达指定的播放时长后会自动停止播放，单位：秒 */
    duration?: number;
    /** 接口调用失败的回调函数 */
    fail?: PlayVoiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PlayVoiceSuccessCallback;
  }
  /** 插件帐号信息（仅在插件中调用时包含这一项） */
  interface Plugin {
    /** 插件 appId */
    appId: string;
    /** 插件版本号 */
    version: string;
  }
  interface PluginLoginOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PluginLoginCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PluginLoginFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PluginLoginSuccessCallback;
  }
  interface PluginLoginSuccessCallbackResult {
    /** 用于换取 openpid 的凭证（有效期五分钟）。插件开发者可以用此 code 在开发者服务器后台调用 [getPluginOpenPId](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/basic-info/getPluginOpenPId.html) 换取 openpid。 */
    code: string;
    errMsg: string;
  }
  interface PreDownloadSubpackageOption {
    /** 分包加载结束回调事件(加载成功、失败都会执行） */
    complete: (...args: any[]) => any;
    /** 分包加载失败回调事件 */
    fail: (...args: any[]) => any;
    /** 分包的类型。目前仅支持填 "workers"，表示 workers 分包。 */
    packageType: string;
    /** 分包加载成功回调事件 */
    success: (...args: any[]) => any;
  }
  interface PreDownloadSubpackageTaskOnProgressUpdateListenerResult {
    /** 分包下载进度百分比 */
    progress: number;
    /** 预期需要下载的数据总长度，单位 Bytes */
    totalBytesExpectedToWrite: number;
    /** 已经下载的数据长度，单位 Bytes */
    totalBytesWritten: number;
  }
  interface PreloadAssetsOption {
    data: Asset[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PreloadAssetsCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PreloadAssetsFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PreloadAssetsSuccessCallback;
  }
  interface PreloadSkylineViewOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PreloadSkylineViewCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PreloadSkylineViewFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PreloadSkylineViewSuccessCallback;
  }
  interface PreloadWebviewOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PreloadWebviewCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: PreloadWebviewFailCallback;
    /** 接口调用成功的回调函数 */
    success?: PreloadWebviewSuccessCallback;
  }
  interface PreviewImageOption {
    /** 需要预览的图片链接列表。[2.2.3](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起支持云文件ID。 */
    urls: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PreviewImageCompleteCallback;
    /** 当前显示图片的链接 */
    current?: string;
    /** 接口调用失败的回调函数 */
    fail?: PreviewImageFailCallback;
    /** 需要基础库： `2.13.0`
     *
     * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
    referrerPolicy?: string;
    /** 需要基础库： `2.13.0`
     *
     * 是否显示长按菜单。 */
    showmenu?: boolean;
    /** 接口调用成功的回调函数 */
    success?: PreviewImageSuccessCallback;
  }
  interface PreviewMediaOption {
    /** 需要预览的资源列表 */
    sources: MediaSource[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: PreviewMediaCompleteCallback;
    /** 当前显示的资源序号 */
    current?: number;
    /** 接口调用失败的回调函数 */
    fail?: PreviewMediaFailCallback;
    /** 需要基础库： `2.13.0`
     *
     * `origin`: 发送完整的referrer; `no-referrer`: 不发送。格式固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`，其中 {appid} 为小程序的 appid，{version} 为小程序的版本号，版本号为 0 表示为开发版、体验版以及审核版本，版本号为 devtools 表示为开发者工具，其余为正式版本； */
    referrerPolicy?: string;
    /** 需要基础库： `2.13.0`
     *
     * 是否显示长按菜单。 */
    showmenu?: boolean;
    /** 接口调用成功的回调函数 */
    success?: PreviewMediaSuccessCallback;
  }
  /** 推广员 */
  interface PromoterResult {
    /** 推广员昵称 */
    finderNickname: string;
    /** 推广员 id */
    promoterId: string;
    /** 推广员 openid */
    promoterOpenId: string;
  }
  interface ReLaunchOption {
    /** 需要跳转的应用内页面路径 (代码包路径)，路径后可以带参数。参数与路径之间使用?分隔，参数键与参数值用=相连，不同参数用&分隔；如 'path?key=value&key2=value2' */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReLaunchCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReLaunchFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReLaunchSuccessCallback;
  }
  interface ReadBLECharacteristicValueOption {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙设备 id */
    deviceId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReadBLECharacteristicValueCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReadBLECharacteristicValueFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReadBLECharacteristicValueSuccessCallback;
  }
  interface ReadCompressedFileOption {
    /** 文件压缩类型，目前仅支持 'br'。
     *
     * 可选值：
     * - 'br': brotli压缩文件; */
    compressionAlgorithm: 'br';
    /** 要读取的文件的路径 (本地用户文件或代码包文件) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReadCompressedFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReadCompressedFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReadCompressedFileSuccessCallback;
  }
  interface ReadCompressedFileSuccessCallbackResult {
    /** 文件内容 */
    data: ArrayBuffer;
    errMsg: string;
  }
  interface ReadCompressedFileSyncOption {
    /** 文件压缩类型，目前仅支持 'br'。
     *
     * 可选值：
     * - 'br': brotli压缩文件; */
    compressionAlgorithm: 'br';
    /** 要读取的文件的路径 (本地用户文件或代码包文件) */
    filePath: string;
  }
  interface ReadFileOption {
    /** 要读取的文件的路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReadFileCompleteCallback;
    /** 指定读取文件的字符编码，如果不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 接口调用失败的回调函数 */
    fail?: ReadFileFailCallback;
    /** 需要基础库： `2.10.0`
     *
     * 指定文件的长度，如果不指定，则读到文件末尾。有效范围：[1, fileLength]。单位：byte */
    length?: number;
    /** 需要基础库： `2.10.0`
     *
     * 从文件指定位置开始读，如果不指定，则从文件头开始读。读取的范围应该是左闭右开区间 [position, position+length)。有效范围：[0, fileLength - 1]。单位：byte */
    position?: number;
    /** 接口调用成功的回调函数 */
    success?: ReadFileSuccessCallback;
  }
  interface ReadFileSuccessCallbackResult {
    /** 文件内容 */
    data: string | ArrayBuffer;
    errMsg: string;
  }
  interface ReadOption {
    /** 数据写入的缓冲区，必须是 ArrayBuffer 实例 */
    arrayBuffer: ArrayBuffer;
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReadCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReadFailCallback;
    /** 要从文件中读取的字节数，默认0 */
    length?: number;
    /** 缓冲区中的写入偏移量，默认0 */
    offset?: number;
    /** 文件读取的起始位置，如不传或传 null，则会从当前文件指针的位置读取。如果 position 是正整数，则文件指针位置会保持不变并从 position 读取文件。 */
    position?: number;
    /** 接口调用成功的回调函数 */
    success?: ReadSuccessCallback;
  }
  /** 文件读取结果。 通过 [FileSystemManager.readSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readSync.html) 接口返回 */
  interface ReadResult {
    /** 被写入的缓存区的对象，即接口入参的 arrayBuffer */
    arrayBuffer: ArrayBuffer;
    /** 实际读取的字节数 */
    bytesRead: number;
  }
  interface ReadSuccessCallbackResult {
    /** 被写入的缓存区的对象，即接口入参的 arrayBuffer */
    arrayBuffer: ArrayBuffer;
    /** 实际读取的字节数 */
    bytesRead: number;
    errMsg: string;
  }
  interface ReadSyncOption {
    /** 数据写入的缓冲区，必须是 ArrayBuffer 实例 */
    arrayBuffer: ArrayBuffer;
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 要从文件中读取的字节数，默认0 */
    length?: number;
    /** 缓冲区中的写入偏移量，默认0 */
    offset?: number;
    /** 文件读取的起始位置，如不传或传 null，则会从当前文件指针的位置读取。如果 position 是正整数，则文件指针位置会保持不变并从 position 读取文件。 */
    position?: number;
  }
  interface ReadZipEntryOption {
    /** 要读取的压缩包内的文件列表（当传入"all" 时表示读取压缩包内所有文件） */
    entries: EntryItem[] | 'all';
    /** 要读取的压缩包的路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReadZipEntryCompleteCallback;
    /** 统一指定读取文件的字符编码，只在 entries 值为"all"时有效。如果 entries 值为"all"且不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 接口调用失败的回调函数 */
    fail?: ReadZipEntryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReadZipEntrySuccessCallback;
  }
  interface ReadZipEntrySuccessCallbackResult {
    /** 文件读取结果。res.entries 是一个对象，key是文件路径，value是一个对象 FileItem ，表示该文件的读取结果。每个 FileItem 包含 data （文件内容） 和 errMsg （错误信息） 属性。 */
    entries: EntriesResult;
    errMsg: string;
  }
  interface ReaddirOption {
    /** 要读取的目录路径 (本地路径) */
    dirPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReaddirCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReaddirFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReaddirSuccessCallback;
  }
  interface ReaddirSuccessCallbackResult {
    /** 指定目录下的文件名数组。 */
    files: string[];
    errMsg: string;
  }
  interface ReconnectCastingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ReconnectCastingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ReconnectCastingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ReconnectCastingSuccessCallback;
  }
  interface RecorderManagerStartOption {
    /** 需要基础库： `2.1.0`
     *
     * 指定录音的音频输入源，可通过 [wx.getAvailableAudioSources()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.getAvailableAudioSources.html) 获取当前可用的音频源
     *
     * 可选值：
     * - 'auto': 自动设置，默认使用手机麦克风，插上耳麦后自动切换使用耳机麦克风，所有平台适用;
     * - 'buildInMic': 手机麦克风，仅限 iOS;
     * - 'headsetMic': 有线耳机麦克风，仅限 iOS;
     * - 'mic': 麦克风（没插耳麦时是手机麦克风，插耳麦时是耳机麦克风），仅限 Android;
     * - 'camcorder': 同 mic，适用于录制音视频内容，仅限 Android;
     * - 'voice_communication': 同 mic，适用于实时沟通，仅限 Android;
     * - 'voice_recognition': 同 mic，适用于语音识别，仅限 Android; */
    audioSource?:
      | 'auto'
      | 'buildInMic'
      | 'headsetMic'
      | 'mic'
      | 'camcorder'
      | 'voice_communication'
      | 'voice_recognition';
    /** 录音的时长，单位 ms，最大值 600000（10 分钟） */
    duration?: number;
    /** 编码码率，有效值见下表格 */
    encodeBitRate?: number;
    /** 音频格式
     *
     * 可选值：
     * - 'mp3': mp3 格式;
     * - 'aac': aac 格式;
     * - 'wav': wav 格式;
     * - 'PCM': pcm 格式; */
    format?: 'mp3' | 'aac' | 'wav' | 'PCM';
    /** 指定帧大小，单位 KB。传入 frameSize 后，每录制指定帧大小的内容后，会回调录制的文件内容，不指定则不会回调。暂仅支持 mp3、pcm 格式。 */
    frameSize?: number;
    /** 录音通道数
     *
     * 可选值：
     * - 1: 1 个通道;
     * - 2: 2 个通道; */
    numberOfChannels?: 1 | 2;
    /** 采样率（pc不支持）
     *
     * 可选值：
     * - 8000: 8000 采样率;
     * - 11025: 11025 采样率;
     * - 12000: 12000 采样率;
     * - 16000: 16000 采样率;
     * - 22050: 22050 采样率;
     * - 24000: 24000 采样率;
     * - 32000: 32000 采样率;
     * - 44100: 44100 采样率;
     * - 48000: 48000 采样率; */
    sampleRate?: 8000 | 11025 | 12000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
  }
  interface RedirectToOption {
    /** 需要跳转的应用内非 tabBar 的页面的路径 (代码包路径), 路径后可以带参数。参数与路径之间使用 `?` 分隔，参数键与参数值用 `=` 相连，不同参数用 `&` 分隔；如 'path?key=value&key2=value2' */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RedirectToCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RedirectToFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RedirectToSuccessCallback;
  }
  interface RedoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RedoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RedoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RedoSuccessCallback;
  }
  /** 来源信息。从另一个小程序、公众号或 App 进入小程序时返回。否则返回 `{}`。(参见后文注意) */
  interface ReferrerInfo {
    /** 来源小程序、公众号或 App 的 appId */
    appId: string;
    /** 来源小程序传过来的数据，scene=1037或1038时支持 */
    extraData: IAnyObject;
  }
  /** 参照区域的边界 */
  interface RelativeRectResult {
    /** 下边界 */
    bottom: number;
    /** 左边界 */
    left: number;
    /** 右边界 */
    right: number;
    /** 上边界 */
    top: number;
  }
  /** 发送端地址信息 */
  interface RemoteInfo {
    /** 发送消息的 socket 的地址 */
    address: string;
    /** 使用的协议族，为 IPv4 或者 IPv6 */
    family: string;
    /** 端口号 */
    port: number;
    /** message 的大小，单位：字节 */
    size: number;
  }
  interface RemoveArcOption {
    /** 圆弧 id */
    id: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveArcCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveArcFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveArcSuccessCallback;
  }
  interface RemoveCustomLayerOption {
    /** 个性化图层id */
    layerId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveCustomLayerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveCustomLayerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveCustomLayerSuccessCallback;
  }
  interface RemoveFormatOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveFormatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveFormatFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveFormatSuccessCallback;
  }
  interface RemoveGroundOverlayOption {
    /** 图片图层 id */
    id: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveGroundOverlayCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveGroundOverlayFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveGroundOverlaySuccessCallback;
  }
  interface RemoveMarkersOption {
    /** marker 的 id 集合。 */
    markerIds: any[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveMarkersCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveMarkersFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveMarkersSuccessCallback;
  }
  interface RemoveSavedFileOption {
    /** 需要删除的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveSavedFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveSavedFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveSavedFileSuccessCallback;
  }
  interface RemoveServiceOption {
    /** service 的 UUID */
    serviceId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveServiceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveServiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveServiceSuccessCallback;
  }
  interface RemoveStorageOption {
    /** 本地缓存中指定的 key */
    key: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveStorageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveStorageSuccessCallback;
  }
  interface RemoveTabBarBadgeOption {
    /** tabBar 的哪一项，从左边算起 */
    index: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveTabBarBadgeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveTabBarBadgeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveTabBarBadgeSuccessCallback;
  }
  interface RemoveVisualLayerOption {
    /** 可视化图层id */
    layerId: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RemoveVisualLayerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RemoveVisualLayerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RemoveVisualLayerSuccessCallback;
  }
  interface RenameOption {
    /** 新文件路径，支持本地路径 */
    newPath: string;
    /** 源文件路径，支持本地路径 */
    oldPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RenameCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RenameFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RenameSuccessCallback;
  }
  /** Canvas 绘图上下文。
   *
   * ****
   *
   * - 通过 Canvas.getContext('2d') 接口可以获取 CanvasRenderingContext2D 对象，实现了 [HTML Canvas 2D Context](https://www.w3.org/TR/2dcontext/) 定义的属性、方法。
   * - 通过 Canvas.getContext('webgl') 或 OffscreenCanvas.getContext('webgl') 接口可以获取 WebGLRenderingContext 对象，实现了 [WebGL 1.0](https://www.khronos.org/registry/webgl/specs/latest/1.0/) 定义的所有属性、方法、常量。
   * - CanvasRenderingContext2D 的 drawImage 方法 2.10.0 起支持传入通过 [SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) 获取的 video 对象，2.29.0 起支持传入开启了自定义渲染的 [LivePusherContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.html) 对象。
   *
   * **示例代码**
   *
   * video 画到 2D Canvas 示例
   * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/tJTak7mU7sfX) */
  interface RenderingContext {}
  interface RequestDeviceVoIPOption {
    /** 设备名称，将显示在授权弹窗内（长度不超过13）。授权框中「设备名字」= 「deviceName」 + 「modelId 对应设备型号」。 */
    deviceName: string;
    /** 需要基础库： `2.30.4`
     *
     * 设备组的唯一标识 id 。isGroup 为 true 时只需要传该参数，isGroup 为 false 时不需要传该参数，但需要传 sn、snTicket、modelId、deviceName 。 */
    groupId: string;
    /** 设备型号 id。通过微信公众平台注册设备获得。 */
    modelId: string;
    /** 设备唯一序列号。由厂商分配，长度不能超过128字节。字符只接受数字，大小写字母，下划线（_）和连字符（-）。 */
    sn: string;
    /** [设备票据](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/hardware-device/getSnTicket.html)，5分钟内有效。 */
    snTicket: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestDeviceVoIPCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RequestDeviceVoIPFailCallback;
    /** 需要基础库： `2.30.4`
     *
     * 是否为授权设备组，默认 false 。 */
    isGroup?: boolean;
    /** 接口调用成功的回调函数 */
    success?: RequestDeviceVoIPSuccessCallback;
  }
  interface RequestOption<T extends string | IAnyObject | ArrayBuffer = string | IAnyObject | ArrayBuffer> {
    /** 开发者服务器接口地址 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestCompleteCallback;
    /** 请求的参数 */
    data?: string | IAnyObject | ArrayBuffer;
    /** 返回的数据格式
     *
     * 可选值：
     * - 'json': 返回的数据为 JSON，返回后会对返回的数据进行一次 JSON.parse;
     * - '其他': 不对返回的内容进行 JSON.parse; */
    dataType?: 'json' | '其他';
    /** 需要基础库： `2.10.4`
     *
     * 开启 cache */
    enableCache?: boolean;
    /** 需要基础库： `2.20.2`
     *
     * 开启 transfer-encoding chunked。 */
    enableChunked?: boolean;
    /** 需要基础库： `2.10.4`
     *
     * 开启 http2 */
    enableHttp2?: boolean;
    /** 需要基础库： `2.19.1`
     *
     * 是否开启 HttpDNS 服务。如开启，需要同时填入 httpDNSServiceId 。 HttpDNS 用法详见 [移动解析HttpDNS](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/HTTPDNS.html) */
    enableHttpDNS?: boolean;
    /** 需要基础库： `2.10.4`
     *
     * 开启 quic */
    enableQuic?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: RequestFailCallback;
    /** 需要基础库： `2.21.0`
     *
     * wifi下使用移动网络发送请求 */
    forceCellularNetwork?: boolean;
    /** 设置请求的 header，header 中不能设置 Referer。
     *
     * `content-type` 默认为 `application/json` */
    header?: IAnyObject;
    /** 需要基础库： `2.19.1`
     *
     * HttpDNS 服务商 Id。 HttpDNS 用法详见 [移动解析HttpDNS](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/HTTPDNS.html) */
    httpDNSServiceId?: string;
    /** HTTP 请求方法
     *
     * 可选值：
     * - 'OPTIONS': HTTP 请求 OPTIONS;
     * - 'GET': HTTP 请求 GET;
     * - 'HEAD': HTTP 请求 HEAD;
     * - 'POST': HTTP 请求 POST;
     * - 'PUT': HTTP 请求 PUT;
     * - 'DELETE': HTTP 请求 DELETE;
     * - 'TRACE': HTTP 请求 TRACE;
     * - 'CONNECT': HTTP 请求 CONNECT; */
    method?: 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT';
    /** 需要基础库： `1.7.0`
     *
     * 响应的数据类型
     *
     * 可选值：
     * - 'text': 响应的数据为文本;
     * - 'arraybuffer': 响应的数据为 ArrayBuffer; */
    responseType?: 'text' | 'arraybuffer';
    /** 接口调用成功的回调函数 */
    success?: RequestSuccessCallback<T>;
    /** 需要基础库： `2.10.0`
     *
     * 超时时间，单位为毫秒。默认值为 60000 */
    timeout?: number;
  }
  interface RequestOrderPaymentOption {
    /** 随机字符串，长度为32个字符以下 */
    nonceStr: string;
    /** 统一下单接口返回的 prepay_id 参数值，提交格式如：prepay_id=*** */
    package: string;
    /** 签名，具体见微信支付文档 */
    paySign: string;
    /** 时间戳，从 1970 年 1 月 1 日 00:00:00 至今的秒数，即当前的时间 */
    timeStamp: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestOrderPaymentCompleteCallback;
    /** 外部APP用户ID */
    extUserUin?: string;
    /** 接口调用失败的回调函数 */
    fail?: RequestOrderPaymentFailCallback;
    /** 订单信息，仅在需要校验的场景下需要传递，具体见[接口说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ministore/minishopopencomponent2/API/order/requestOrderPayment) */
    orderInfo?: IAnyObject;
    /** 签名算法，应与后台下单时的值一致
     *
     * 可选值：
     * - 'MD5': 仅在 v2 版本接口适用;
     * - 'HMAC-SHA256': 仅在 v2 版本接口适用;
     * - 'RSA': 仅在 v3 版本接口适用; */
    signType?: 'MD5' | 'HMAC-SHA256' | 'RSA';
    /** 接口调用成功的回调函数 */
    success?: RequestOrderPaymentSuccessCallback;
  }
  interface RequestPaymentOption {
    /** 随机字符串，长度为32个字符以下 */
    nonceStr: string;
    /** 统一下单接口返回的 prepay_id 参数值，提交格式如：prepay_id=*** */
    package: string;
    /** 签名，具体见微信支付文档 */
    paySign: string;
    /** 时间戳，从 1970 年 1 月 1 日 00:00:00 至今的秒数，即当前的时间 */
    timeStamp: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestPaymentCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RequestPaymentFailCallback;
    /** 签名算法，应与后台下单时的值一致
     *
     * 可选值：
     * - 'MD5': 仅在 v2 版本接口适用;
     * - 'HMAC-SHA256': 仅在 v2 版本接口适用;
     * - 'RSA': 仅在 v3 版本接口适用; */
    signType?: 'MD5' | 'HMAC-SHA256' | 'RSA';
    /** 接口调用成功的回调函数 */
    success?: RequestPaymentSuccessCallback;
  }
  interface RequestPictureInPictureOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestPictureInPictureCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RequestPictureInPictureFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RequestPictureInPictureSuccessCallback;
  }
  interface RequestPluginPaymentOption {
    /** 需要显示在页面中的金额，单位为分 */
    fee: number;
    /** 任意数据，传递给功能页中的响应函数 */
    paymentArgs: IAnyObject;
    /** 插件版本
     *
     * 可选值：
     * - 'develop': 开发版;
     * - 'trial': 体验版;
     * - 'release': 正式版; */
    version: 'develop' | 'trial' | 'release';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestPluginPaymentCompleteCallback;
    /** 需要显示在页面中的货币符号的代码 */
    currencyType?: string;
    /** 接口调用失败的回调函数 */
    fail?: RequestPluginPaymentFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RequestPluginPaymentSuccessCallback;
  }
  /** 需要基础库： `2.10.4`
   *
   * 网络请求过程中一些调试信息，[查看详细说明](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/network.html) */
  interface RequestProfile {
    /** SSL建立完成的时间,如果不是安全连接,则值为 0 */
    SSLconnectionEnd: number;
    /** SSL建立连接的时间,如果不是安全连接,则值为 0 */
    SSLconnectionStart: number;
    /** HTTP（TCP） 完成建立连接的时间（完成握手），如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接完成的时间。注意这里握手结束，包括安全连接建立完成、SOCKS 授权通过 */
    connectEnd: number;
    /** HTTP（TCP） 开始建立连接的时间，如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接开始的时间 */
    connectStart: number;
    /** DNS 域名查询完成的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
    domainLookupEnd: number;
    /** DNS 域名查询开始的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
    domainLookupStart: number;
    /** 评估当前网络下载的kbps */
    downstreamThroughputKbpsEstimate: number;
    /** 评估的网络状态 unknown, offline, slow 2g, 2g, 3g, 4g, last/0, 1, 2, 3, 4, 5, 6 */
    estimate_nettype: number;
    /** 组件准备好使用 HTTP 请求抓取资源的时间，这发生在检查本地缓存之前 */
    fetchStart: number;
    /** 协议层根据多个请求评估当前网络的 rtt（仅供参考） */
    httpRttEstimate: number;
    /** 当前请求的IP */
    peerIP: string;
    /** 当前请求的端口 */
    port: number;
    /** 使用协议类型，有效值：http1.1, h2, quic, unknown */
    protocol: string;
    /** 收到字节数 */
    receivedBytedCount: number;
    /** 最后一个 HTTP 重定向完成时的时间。有跳转且是同域名内部的重定向才算，否则值为 0 */
    redirectEnd: number;
    /** 第一个 HTTP 重定向发生时的时间。有跳转且是同域名内的重定向才算，否则值为 0 */
    redirectStart: number;
    /** HTTP请求读取真实文档结束的时间 */
    requestEnd: number;
    /** HTTP请求读取真实文档开始的时间（完成建立连接），包括从本地读取缓存。连接错误重连时，这里显示的也是新建立连接的时间 */
    requestStart: number;
    /** HTTP 响应全部接收完成的时间（获取到最后一个字节），包括从本地读取缓存 */
    responseEnd: number;
    /** HTTP 开始接收响应的时间（获取到第一个字节），包括从本地读取缓存 */
    responseStart: number;
    /** 当次请求连接过程中实时 rtt */
    rtt: number;
    /** 发送的字节数 */
    sendBytesCount: number;
    /** 是否复用连接 */
    socketReused: boolean;
    /** 当前网络的实际下载kbps */
    throughputKbps: number;
    /** 传输层根据多个请求评估的当前网络的 rtt（仅供参考） */
    transportRttEstimate: number;
  }
  interface RequestSubscribeDeviceMessageFailCallbackResult {
    /** 接口调用失败错误码，有可能为空 */
    errCode: number;
    /** 接口调用失败错误信息 */
    errMsg: string;
  }
  interface RequestSubscribeDeviceMessageOption {
    /** 设备型号 id 。通过微信公众平台注册设备获得。 */
    modelId: string;
    /** 设备唯一序列号。由厂商分配，长度不能超过128字节。字符只接受数字，大小写字母，下划线（_）和连字符（-）。 */
    sn: string;
    /** 设备票据，5分钟内有效。 */
    snTicket: string;
    /** 需要订阅的消息模板的 id 的集合，一次调用最多可订阅3条消息 */
    tmplIds: any[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestSubscribeDeviceMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RequestSubscribeDeviceMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RequestSubscribeDeviceMessageSuccessCallback;
  }
  interface RequestSubscribeDeviceMessageSuccessCallbackResult {
    /** [TEMPLATE_ID]是动态的键，即模板id，值包括'accept'、'reject'、'ban'、'filter'、'acceptWithAudio'。'accept'表示用户同意订阅该条id对应的模板消息，'reject'表示用户拒绝订阅该条id对应的模板消息，'ban'表示已被后台封禁，'acceptWithAudio' 表示用户接收订阅消息并开启了语音提醒，'filter'表示该模板因为模板标题同名被后台过滤。例如 { errMsg: "requestSubscribeDeviceMessage:ok", zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE: "accept"} 表示用户同意订阅zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE这条消息 */
    [TEMPLATE_ID: string]: string;
    /** 接口调用成功时errMsg值为'requestSubscribeDeviceMessage:ok' */
    errMsg: string;
  }
  interface RequestSubscribeMessageFailCallbackResult {
    /** 接口调用失败错误码 */
    errCode: number;
    /** 接口调用失败错误信息 */
    errMsg: string;
  }
  interface RequestSubscribeMessageOption {
    /** 需要订阅的消息模板的id的集合，一次调用最多可订阅3条消息（注意：iOS客户端7.0.6版本、Android客户端7.0.7版本之后的一次性订阅/长期订阅才支持多个模板消息，iOS客户端7.0.5版本、Android客户端7.0.6版本之前的一次订阅只支持一个模板消息）消息模板id在[微信公众平台(mp.weixin.qq.com)-功能-订阅消息]中配置。每个tmplId对应的模板标题需要不相同，否则会被过滤。 */
    tmplIds: any[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RequestSubscribeMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RequestSubscribeMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: RequestSubscribeMessageSuccessCallback;
  }
  interface RequestSubscribeMessageSuccessCallbackResult {
    /** [TEMPLATE_ID]是动态的键，即模板id，值包括'accept'、'reject'、'ban'、'filter'。'accept'表示用户同意订阅该条id对应的模板消息，'reject'表示用户拒绝订阅该条id对应的模板消息，'ban'表示已被后台封禁，'filter'表示该模板因为模板标题同名被后台过滤。例如 { errMsg: "requestSubscribeMessage:ok", zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE: "accept"} 表示用户同意订阅zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE这条消息 */
    [TEMPLATE_ID: string]: string;
    /** 接口调用成功时errMsg值为'requestSubscribeMessage:ok' */
    errMsg: string;
  }
  interface RequestSuccessCallbackResult<
    T extends string | IAnyObject | ArrayBuffer = string | IAnyObject | ArrayBuffer
  > {
    /** 需要基础库： `2.10.0`
     *
     * 开发者服务器返回的 cookies，格式为字符串数组 */
    cookies: string[];
    /** 开发者服务器返回的数据 */
    data: T;
    /** 需要基础库： `1.2.0`
     *
     * 开发者服务器返回的 HTTP Response Header */
    header: IAnyObject;
    /** 需要基础库： `2.10.4`
     *
     * 网络请求过程中一些调试信息，[查看详细说明](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/network.html) */
    profile: RequestProfile;
    /** 开发者服务器返回的 HTTP 状态码 */
    statusCode: number;
    errMsg: string;
  }
  interface ReserveChannelsLiveOption {
    /** 预告 id，通过 getChannelsLiveNoticeInfo 接口获取 */
    noticeId: string;
  }
  /** 开发者服务器每次返回新chunk时的Response */
  interface Result {
    /** 返回的chunk buffer */
    data: ArrayBuffer;
  }
  interface ResumeBGMOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ResumeBGMCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ResumeBGMFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ResumeBGMSuccessCallback;
  }
  interface ResumeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ResumeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ResumeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ResumeSuccessCallback;
  }
  interface RewardedVideoAdOnCloseListenerResult {
    /** 需要基础库： `2.1.0`
     *
     * 视频是否是在用户完整观看的情况下被关闭的 */
    isEnded: boolean;
  }
  interface RewardedVideoAdOnErrorListenerResult {
    /** 需要基础库： `2.2.2`
     *
     * 错误码
     *
     * 可选值：
     * - 1000: 后端接口调用失败;
     * - 1001: 参数错误;
     * - 1002: 广告单元无效;
     * - 1003: 内部错误;
     * - 1004: 无合适的广告;
     * - 1005: 广告组件审核中;
     * - 1006: 广告组件被驳回;
     * - 1007: 广告组件被封禁;
     * - 1008: 广告单元已关闭; */
    errCode: 1000 | 1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007 | 1008;
    /** 错误信息 */
    errMsg: string;
  }
  interface RmdirOption {
    /** 要删除的目录路径 (本地路径) */
    dirPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: RmdirCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: RmdirFailCallback;
    /** 需要基础库： `2.3.0`
     *
     * 是否递归删除目录。如果为 true，则删除该目录和该目录下的所有子目录以及文件。 */
    recursive?: boolean;
    /** 接口调用成功的回调函数 */
    success?: RmdirSuccessCallback;
  }
  interface RunOCROption {
    /** 待识别图像的像素点数据，每四项表示一个像素点的 RGBA */
    frameBuffer: ArrayBuffer;
    /** 图像高度 */
    height: number;
    /** 图像宽度 */
    width: number;
  }
  interface SafeArea {
    /** 安全区域右下角纵坐标 */
    bottom: number;
    /** 安全区域的高度，单位逻辑像素 */
    height: number;
    /** 安全区域左上角横坐标 */
    left: number;
    /** 安全区域右下角横坐标 */
    right: number;
    /** 安全区域左上角纵坐标 */
    top: number;
    /** 安全区域的宽度，单位逻辑像素 */
    width: number;
  }
  interface SaveFileOption {
    /** 临时存储文件路径 (本地路径) */
    tempFilePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SaveFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SaveFileFailCallback;
    /** 要存储的文件路径 (本地路径) */
    filePath?: string;
    /** 接口调用成功的回调函数 */
    success?: SaveFileSuccessCallback;
  }
  interface SaveFileSuccessCallbackResult {
    /** 存储后的文件路径 (本地路径) */
    savedFilePath: string;
    errMsg: string;
  }
  interface SaveFileToDiskOption {
    /** 待保存文件路径 */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SaveFileToDiskCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SaveFileToDiskFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SaveFileToDiskSuccessCallback;
  }
  interface SaveImageToPhotosAlbumOption {
    /** 图片文件路径，可以是临时文件路径或永久文件路径 (本地路径) ，不支持网络路径 */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SaveImageToPhotosAlbumCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SaveImageToPhotosAlbumFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SaveImageToPhotosAlbumSuccessCallback;
  }
  interface SaveVideoToPhotosAlbumOption {
    /** 视频文件路径，可以是临时文件路径也可以是永久文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SaveVideoToPhotosAlbumCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SaveVideoToPhotosAlbumFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SaveVideoToPhotosAlbumSuccessCallback;
  }
  interface ScanCodeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ScanCodeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ScanCodeFailCallback;
    /** 需要基础库： `1.2.0`
     *
     * 是否只能从相机扫码，不允许从相册选择图片 */
    onlyFromCamera?: boolean;
    /** 需要基础库： `1.7.0`
     *
     * 扫码类型
     *
     * 可选值：
     * - 'barCode': 一维码;
     * - 'qrCode': 二维码;
     * - 'datamatrix': Data Matrix 码;
     * - 'pdf417': PDF417 条码; */
    scanType?: Array<'barCode' | 'qrCode' | 'datamatrix' | 'pdf417'>;
    /** 接口调用成功的回调函数 */
    success?: ScanCodeSuccessCallback;
  }
  interface ScanCodeSuccessCallbackResult {
    /** 所扫码的字符集 */
    charSet: string;
    /** 当所扫的码为当前小程序二维码时，会返回此字段，内容为二维码携带的 path */
    path: string;
    /** 原始数据，base64编码 */
    rawData: string;
    /** 所扫码的内容 */
    result: string;
    /** 所扫码的类型
     *
     * 可选值：
     * - 'QR_CODE': 二维码;
     * - 'AZTEC': 一维码;
     * - 'CODABAR': 一维码;
     * - 'CODE_39': 一维码;
     * - 'CODE_93': 一维码;
     * - 'CODE_128': 一维码;
     * - 'DATA_MATRIX': 二维码;
     * - 'EAN_8': 一维码;
     * - 'EAN_13': 一维码;
     * - 'ITF': 一维码;
     * - 'MAXICODE': 一维码;
     * - 'PDF_417': 二维码;
     * - 'RSS_14': 一维码;
     * - 'RSS_EXPANDED': 一维码;
     * - 'UPC_A': 一维码;
     * - 'UPC_E': 一维码;
     * - 'UPC_EAN_EXTENSION': 一维码;
     * - 'WX_CODE': 二维码;
     * - 'CODE_25': 一维码; */
    scanType:
      | 'QR_CODE'
      | 'AZTEC'
      | 'CODABAR'
      | 'CODE_39'
      | 'CODE_93'
      | 'CODE_128'
      | 'DATA_MATRIX'
      | 'EAN_8'
      | 'EAN_13'
      | 'ITF'
      | 'MAXICODE'
      | 'PDF_417'
      | 'RSS_14'
      | 'RSS_EXPANDED'
      | 'UPC_A'
      | 'UPC_E'
      | 'UPC_EAN_EXTENSION'
      | 'WX_CODE'
      | 'CODE_25';
    errMsg: string;
  }
  interface ScrollOffsetCallbackResult {
    /** 节点的 dataset */
    dataset: IAnyObject;
    /** 节点的 ID */
    id: string;
    /** 节点的水平滚动位置 */
    scrollLeft: number;
    /** 节点的竖直滚动位置 */
    scrollTop: number;
  }
  interface ScrollToOption {
    /** 是否启用滚动动画 */
    animated?: boolean;
    /** 滚动动画时长 (仅在 iOS 下生效) */
    duration?: number;
    /** 左边界距离 */
    left?: number;
    /** 顶部距离 */
    top?: number;
    /** 初始速度 (仅在 iOS 下生效) */
    velocity?: number;
  }
  /** 需要基础库： `2.14.4`
*
* 增强 ScrollView 实例，可通过 [wx.createSelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html) 的 [NodesRef.node](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.node.html) 方法获取。 仅在 scroll-view 组件开启 enhanced 属性后生效。
*
* **示例代码**
*
* ```js
wx.createSelectorQuery()
  .select('#scrollview')
  .node()
  .exec((res) => {
    const scrollView = res[0].node;
    scrollView.scrollEnabled = false;
  })
``` */
  interface ScrollViewContext {
    /** 设置滚动边界弹性 (仅在 iOS 下生效) */
    bounces: boolean;
    /** 取消滚动惯性 (仅在 iOS 下生效) */
    decelerationDisabled: boolean;
    /** 设置滚动减速速率 (仅在 iOS 下生效) */
    fastDeceleration: boolean;
    /** 分页滑动开关 */
    pagingEnabled: boolean;
    /** 滚动开关 */
    scrollEnabled: boolean;
    /** 设置是否显示滚动条 */
    showScrollbar: boolean;
  }
  interface SeekBackgroundAudioOption {
    /** 音乐位置，单位：秒 */
    position: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SeekBackgroundAudioCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SeekBackgroundAudioFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SeekBackgroundAudioSuccessCallback;
  }
  interface SendHCEMessageOption {
    /** 二进制数据 */
    data: ArrayBuffer;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SendHCEMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SendHCEMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SendHCEMessageSuccessCallback;
  }
  interface SendMessageOption {
    /** SEI消息 */
    msg: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SendMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SendMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SendMessageSuccessCallback;
  }
  interface SendSmsOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SendSmsCompleteCallback;
    /** 预填到发送短信面板的内容 */
    content?: string;
    /** 接口调用失败的回调函数 */
    fail?: SendSmsFailCallback;
    /** 预填到发送短信面板的手机号 */
    phoneNumber?: string;
    /** 接口调用成功的回调函数 */
    success?: SendSmsSuccessCallback;
  }
  interface SendSocketMessageOption {
    /** 需要发送的内容 */
    data: string | ArrayBuffer;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SendSocketMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SendSocketMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SendSocketMessageSuccessCallback;
  }
  interface SetBGMVolumeOption {
    /** 音量大小，范围是 0-1 */
    volume: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBGMVolumeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBGMVolumeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBGMVolumeSuccessCallback;
  }
  interface SetBLEMTUFailCallbackResult {
    /** 最终协商的 MTU 值。如果协商失败则无此参数。安卓客户端 8.0.9 开始支持。 */
    mtu: number;
  }
  interface SetBLEMTUOption {
    /** 蓝牙设备 id */
    deviceId: string;
    /** 最大传输单元。设置范围为 (22,512) 区间内，单位 bytes */
    mtu: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBLEMTUCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBLEMTUFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBLEMTUSuccessCallback;
  }
  interface SetBLEMTUSuccessCallbackResult {
    /** 最终协商的 MTU 值，与传入参数一致。安卓客户端 8.0.9 开始支持。 */
    mtu: number;
    errMsg: string;
  }
  interface SetBackgroundColorOption {
    /** 窗口的背景色，必须为十六进制颜色值 */
    backgroundColor?: string;
    /** 底部窗口的背景色，必须为十六进制颜色值，仅 iOS 支持 */
    backgroundColorBottom?: string;
    /** 顶部窗口的背景色，必须为十六进制颜色值，仅 iOS 支持 */
    backgroundColorTop?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBackgroundColorCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBackgroundColorFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBackgroundColorSuccessCallback;
  }
  interface SetBackgroundFetchTokenOption {
    /** 自定义的登录态 */
    token: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBackgroundFetchTokenCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBackgroundFetchTokenFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBackgroundFetchTokenSuccessCallback;
  }
  interface SetBackgroundTextStyleOption {
    /** 下拉背景字体、loading 图的样式。
     *
     * 可选值：
     * - 'dark': dark 样式;
     * - 'light': light 样式; */
    textStyle: 'dark' | 'light';
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBackgroundTextStyleCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBackgroundTextStyleFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBackgroundTextStyleSuccessCallback;
  }
  interface SetBoundaryOption {
    /** 东北角经纬度 */
    northeast: MapPostion;
    /** 西南角经纬度 */
    southwest: MapPostion;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetBoundaryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetBoundaryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetBoundarySuccessCallback;
  }
  interface SetCenterOffsetOption {
    /** 偏移量，两位数组 */
    offset: number[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetCenterOffsetCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetCenterOffsetFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetCenterOffsetSuccessCallback;
  }
  interface SetClipboardDataOption {
    /** 剪贴板的内容 */
    data: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetClipboardDataCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetClipboardDataFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetClipboardDataSuccessCallback;
  }
  interface SetContentsOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetContentsCompleteCallback;
    /** 表示内容的delta对象 */
    delta?: IAnyObject;
    /** 接口调用失败的回调函数 */
    fail?: SetContentsFailCallback;
    /** 带标签的HTML内容 */
    html?: string;
    /** 接口调用成功的回调函数 */
    success?: SetContentsSuccessCallback;
  }
  interface SetEnable1v1ChatOption {
    /** 是否开启 */
    enable: boolean;
    /** 窗口背景色(音频通话背景以及小窗模式背景)
     *
     * 可选值：
     * - 0: #262930;
     * - 1: #FA5151;
     * - 2: #FA9D3B;
     * - 3: #3D7257;
     * - 4: #1485EE;
     * - 5: #6467F0; */
    backgroundType?: 0 | 1 | 2 | 3 | 4 | 5;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetEnable1v1ChatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetEnable1v1ChatFailCallback;
    /** 小窗样式 */
    minWindowType?: number;
    /** 接口调用成功的回调函数 */
    success?: SetEnable1v1ChatSuccessCallback;
  }
  interface SetEnableDebugOption {
    /** 是否打开调试 */
    enableDebug: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetEnableDebugCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetEnableDebugFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetEnableDebugSuccessCallback;
  }
  interface SetInnerAudioOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetInnerAudioOptionCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetInnerAudioOptionFailCallback;
    /** 是否与其他音频混播，设置为 true 之后，不会终止其他应用或微信内的音乐 */
    mixWithOther?: boolean;
    /** （仅在 iOS 生效）是否遵循静音开关，设置为 false 之后，即使是在静音模式下，也能播放声音 */
    obeyMuteSwitch?: boolean;
    /** true 代表用扬声器播放，false 代表听筒播放，默认值为 true。 */
    speakerOn?: boolean;
    /** 接口调用成功的回调函数 */
    success?: SetInnerAudioOptionSuccessCallback;
  }
  interface SetKeepScreenOnOption {
    /** 是否保持屏幕常亮 */
    keepScreenOn: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetKeepScreenOnCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetKeepScreenOnFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetKeepScreenOnSuccessCallback;
  }
  interface SetLocMarkerIconOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetLocMarkerIconCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetLocMarkerIconFailCallback;
    /** 图标路径，支持网络路径、本地路径、代码包路径 */
    iconPath?: string;
    /** 接口调用成功的回调函数 */
    success?: SetLocMarkerIconSuccessCallback;
  }
  interface SetMICVolumeOption {
    /** 音量大小，范围是 0.0-1.0 */
    volume: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetMICVolumeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetMICVolumeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetMICVolumeSuccessCallback;
  }
  interface SetNavigationBarColorOption {
    /** 背景颜色值，有效值为十六进制颜色 */
    backgroundColor: string;
    /** 前景颜色值，包括按钮、标题、状态栏的颜色，仅支持 #ffffff 和 #000000 */
    frontColor: string;
    /** 动画效果 */
    animation?: AnimationOption;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetNavigationBarColorCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetNavigationBarColorFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetNavigationBarColorSuccessCallback;
  }
  interface SetNavigationBarTitleOption {
    /** 页面标题 */
    title: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetNavigationBarTitleCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetNavigationBarTitleFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetNavigationBarTitleSuccessCallback;
  }
  interface SetScreenBrightnessOption {
    /** 屏幕亮度值，范围 0 ~ 1，0 最暗，1 最亮。在安卓端支持传入特殊值 -1，表示屏幕亮度跟随系统变化 */
    value: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetScreenBrightnessCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetScreenBrightnessFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetScreenBrightnessSuccessCallback;
  }
  interface SetStorageOption<T = any> {
    /** 需要存储的内容。只支持原生类型、Date、及能够通过`JSON.stringify`序列化的对象。 */
    data: T;
    /** 本地缓存中指定的 key */
    key: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetStorageCompleteCallback;
    /** 需要基础库： `2.21.3`
     *
     * 是否开启加密存储。只有异步的 setStorage 接口支持开启加密存储。开启后，将会对 data 使用 AES128 加密，接口回调耗时将会增加。若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true。此外，由于加密后的数据会比原始数据膨胀1.4倍，因此开启 encrypt 的情况下，单个 key 允许存储的最大数据长度为 0.7MB，所有数据存储上限为 7.1MB */
    encrypt?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: SetStorageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetStorageSuccessCallback;
  }
  interface SetTabBarBadgeOption {
    /** tabBar 的哪一项，从左边算起 */
    index: number;
    /** 显示的文本，超过 4 个字符则显示成 ... */
    text: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetTabBarBadgeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetTabBarBadgeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetTabBarBadgeSuccessCallback;
  }
  interface SetTabBarItemOption {
    /** tabBar 的哪一项，从左边算起 */
    index: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetTabBarItemCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetTabBarItemFailCallback;
    /** 图片路径，icon 大小限制为 40kb，建议尺寸为 81px * 81px，当 postion 为 top 时，此参数无效 */
    iconPath?: string;
    /** 选中时的图片路径，icon 大小限制为 40kb，建议尺寸为 81px * 81px ，当 postion 为 top 时，此参数无效 */
    selectedIconPath?: string;
    /** 接口调用成功的回调函数 */
    success?: SetTabBarItemSuccessCallback;
    /** tab 上的按钮文字 */
    text?: string;
  }
  interface SetTabBarStyleOption {
    /** tab 的背景色，HexColor */
    backgroundColor?: string;
    /** tabBar上边框的颜色， 仅支持 black/white */
    borderStyle?: string;
    /** tab 上的文字默认颜色，HexColor */
    color?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetTabBarStyleCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetTabBarStyleFailCallback;
    /** tab 上的文字选中时的颜色，HexColor */
    selectedColor?: string;
    /** 接口调用成功的回调函数 */
    success?: SetTabBarStyleSuccessCallback;
  }
  interface SetTimeoutOption {
    /** 设置超时时间 (ms) */
    timeout: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetTimeoutCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetTimeoutFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetTimeoutSuccessCallback;
  }
  interface SetTopBarTextOption {
    /** 置顶栏文字 */
    text: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetTopBarTextCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetTopBarTextFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetTopBarTextSuccessCallback;
  }
  interface SetVisualEffectOnCaptureOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetVisualEffectOnCaptureCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetVisualEffectOnCaptureFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetVisualEffectOnCaptureSuccessCallback;
    /** 截屏/录屏时的表现，仅支持 none / hidden，传入 hidden 则表示在截屏/录屏时隐藏屏幕 */
    visualEffect?: string;
  }
  interface SetWifiListOption {
    /** 提供预设的 Wi-Fi 信息列表 */
    wifiList: WifiData[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetWifiListCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetWifiListFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetWifiListSuccessCallback;
  }
  interface SetWindowSizeOption {
    /** 窗口高度，以像素为单位 */
    height: number;
    /** 窗口宽度，以像素为单位 */
    width: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SetWindowSizeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SetWindowSizeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SetWindowSizeSuccessCallback;
  }
  interface SetZoomSuccessCallbackResult {
    /** 实际设置的缩放级别。由于系统限制，某些机型可能无法设置成指定值，会改用最接近的可设值。 */
    zoom: number;
    errMsg: string;
  }
  interface ShareFileMessageOption {
    /** 要分享的文件地址，必须为本地路径或临时路径 */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShareFileMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShareFileMessageFailCallback;
    /** 自定义文件名，若留空则使用filePath中的文件名 */
    fileName?: string;
    /** 接口调用成功的回调函数 */
    success?: ShareFileMessageSuccessCallback;
  }
  interface ShareToWeRunOption {
    /** 运动数据列表 */
    recordList: WxaSportRecord[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShareToWeRunCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShareToWeRunFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShareToWeRunSuccessCallback;
  }
  interface ShareVideoMessageOption {
    /** 要分享的视频地址，必须为本地路径或临时路径 */
    videoPath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShareVideoMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShareVideoMessageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShareVideoMessageSuccessCallback;
    /** 缩略图路径，若留空则使用视频首帧 */
    thumbPath?: string;
  }
  interface ShowActionSheetOption {
    /** 按钮的文字数组，数组长度最大为 6 */
    itemList: string[];
    /** 需要基础库： `2.14.0`
     *
     * 警示文案 */
    alertText?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowActionSheetCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowActionSheetFailCallback;
    /** 按钮的文字颜色 */
    itemColor?: string;
    /** 接口调用成功的回调函数 */
    success?: ShowActionSheetSuccessCallback;
  }
  interface ShowActionSheetSuccessCallbackResult {
    /** 用户点击的按钮序号，从上到下的顺序，从0开始 */
    tapIndex: number;
    errMsg: string;
  }
  interface ShowLoadingOption {
    /** 提示的内容 */
    title: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowLoadingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowLoadingFailCallback;
    /** 是否显示透明蒙层，防止触摸穿透 */
    mask?: boolean;
    /** 接口调用成功的回调函数 */
    success?: ShowLoadingSuccessCallback;
  }
  interface ShowModalOption {
    /** 取消按钮的文字颜色，必须是 16 进制格式的颜色字符串 */
    cancelColor?: string;
    /** 取消按钮的文字，最多 4 个字符 */
    cancelText?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowModalCompleteCallback;
    /** 确认按钮的文字颜色，必须是 16 进制格式的颜色字符串 */
    confirmColor?: string;
    /** 确认按钮的文字，最多 4 个字符 */
    confirmText?: string;
    /** 提示的内容 */
    content?: string;
    /** 需要基础库： `2.17.1`
     *
     * 是否显示输入框 */
    editable?: boolean;
    /** 接口调用失败的回调函数 */
    fail?: ShowModalFailCallback;
    /** 需要基础库： `2.17.1`
     *
     * 显示输入框时的提示文本 */
    placeholderText?: string;
    /** 是否显示取消按钮 */
    showCancel?: boolean;
    /** 接口调用成功的回调函数 */
    success?: ShowModalSuccessCallback;
    /** 提示的标题 */
    title?: string;
  }
  interface ShowModalSuccessCallbackResult {
    /** 需要基础库： `1.1.0`
     *
     * 为 true 时，表示用户点击了取消（用于 Android 系统区分点击蒙层关闭还是点击取消按钮关闭） */
    cancel: boolean;
    /** 为 true 时，表示用户点击了确定按钮 */
    confirm: boolean;
    /** editable 为 true 时，用户输入的文本 */
    content: string;
    errMsg: string;
  }
  interface ShowNavigationBarLoadingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowNavigationBarLoadingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowNavigationBarLoadingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShowNavigationBarLoadingSuccessCallback;
  }
  interface ShowRedPackageOption {
    /** 封面地址 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowRedPackageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowRedPackageFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShowRedPackageSuccessCallback;
  }
  interface ShowShareImageMenuOption {
    /** 要分享的图片地址，必须为本地路径或临时路径 */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowShareImageMenuCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowShareImageMenuFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShowShareImageMenuSuccessCallback;
  }
  interface ShowShareMenuOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowShareMenuCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowShareMenuFailCallback;
    /** 需要基础库： `2.11.3`
     *
     * 本接口为 Beta 版本，暂只在 Android 平台支持。需要显示的转发按钮名称列表，默认['shareAppMessage']。按钮名称合法值包含 "shareAppMessage"、"shareTimeline" 两种 */
    menus?: string[];
    /** 接口调用成功的回调函数 */
    success?: ShowShareMenuSuccessCallback;
    /** 是否使用带 shareTicket 的转发[详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html) */
    withShareTicket?: boolean;
  }
  interface ShowTabBarOption {
    /** 是否需要动画效果 */
    animation?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowTabBarCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowTabBarFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShowTabBarSuccessCallback;
  }
  interface ShowTabBarRedDotOption {
    /** tabBar 的哪一项，从左边算起 */
    index: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowTabBarRedDotCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ShowTabBarRedDotFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ShowTabBarRedDotSuccessCallback;
  }
  interface ShowToastOption {
    /** 提示的内容 */
    title: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ShowToastCompleteCallback;
    /** 提示的延迟时间 */
    duration?: number;
    /** 接口调用失败的回调函数 */
    fail?: ShowToastFailCallback;
    /** 图标
     *
     * 可选值：
     * - 'success': 显示成功图标，此时 title 文本最多显示 7 个汉字长度;
     * - 'error': 显示失败图标，此时 title 文本最多显示 7 个汉字长度;
     * - 'loading': 显示加载图标，此时 title 文本最多显示 7 个汉字长度;
     * - 'none': 不显示图标，此时 title 文本最多可显示两行，[1.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)及以上版本支持; */
    icon?: 'success' | 'error' | 'loading' | 'none';
    /** 需要基础库： `1.1.0`
     *
     * 自定义图标的本地路径，image 的优先级高于 icon */
    image?: string;
    /** 是否显示透明蒙层，防止触摸穿透 */
    mask?: boolean;
    /** 接口调用成功的回调函数 */
    success?: ShowToastSuccessCallback;
  }
  interface Size {
    /** 变化后的窗口高度，单位 px */
    windowHeight: number;
    /** 变化后的窗口宽度，单位 px */
    windowWidth: number;
  }
  /** 当前运行环境对于 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的支持情况 */
  interface SkylineInfo {
    /** 当前运行环境是否支持 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) */
    isSupported: boolean;
    /** 当前运行环境不支持 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的原因，仅在 `isSupported` 为 `false` 时出现
     *
     * 可选值：
     * - 'client not supported': 当前微信客户端不支持 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html)，可以尝试通过升级微信客户端解决;
     * - 'baselib not supported': 当前基础库不支持 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html)，基础库会自动更新到当前客户端所能支持的最新的版本，基础库不支持时也可以尝试通过升级微信客户端解决;
     * - 'a-b test not enabled': 命中了 _We 分析_ 平台上的 AB 实验关闭的情况。详细可以查看 [Skyline 起步 > 配置 We 分析 AB 实验](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/#%E9%85%8D%E7%BD%AE-We-%E5%88%86%E6%9E%90-AB-%E5%AE%9E%E9%AA%8C) 一节;
     * - 'SwitchRender option set to webview': 本地调试的快捷切换入口被设置为了强制使用 Webview. 详情可以查看 [Skyline 起步 > 快捷切换入口](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/#%E5%BF%AB%E6%8D%B7%E5%88%87%E6%8D%A2%E5%85%A5%E5%8F%A3) 一节; */
    reason:
      | 'client not supported'
      | 'baselib not supported'
      | 'a-b test not enabled'
      | 'SwitchRender option set to webview';
    /** 当前运行环境 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的版本号，形如 `0.9.7` */
    version: string;
  }
  /** 需要基础库： `2.10.4`
   *
   * 网络请求过程中一些调试信息 */
  interface SocketProfile {
    /** 完成建立连接的时间（完成握手），如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接完成的时间。注意这里握手结束，包括安全连接建立完成、SOCKS 授权通过 */
    connectEnd: number;
    /** 开始建立连接的时间，如果是持久连接，则与 fetchStart 值相等。注意如果在传输层发生了错误且重新建立连接，则这里显示的是新建立的连接开始的时间 */
    connectStart: number;
    /** 上层请求到返回的耗时 */
    cost: number;
    /** DNS 域名查询完成的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
    domainLookupEnd: number;
    /** DNS 域名查询开始的时间，如果使用了本地缓存（即无 DNS 查询）或持久连接，则与 fetchStart 值相等 */
    domainLookupStart: number;
    /** 组件准备好使用 SOCKET 建立请求的时间，这发生在检查本地缓存之前 */
    fetchStart: number;
    /** 握手耗时 */
    handshakeCost: number;
    /** 单次连接的耗时，包括 connect ，tls */
    rtt: number;
  }
  interface SocketTaskCloseOption {
    /** 一个数字值表示关闭连接的状态号，表示连接被关闭的原因。 */
    code?: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SocketTaskCloseCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SocketTaskCloseFailCallback;
    /** 一个可读的字符串，表示连接被关闭的原因。这个字符串必须是不长于 123 字节的 UTF-8 文本（不是字符）。 */
    reason?: string;
    /** 接口调用成功的回调函数 */
    success?: SocketTaskCloseSuccessCallback;
  }
  interface SocketTaskOnCloseListenerResult {
    /** 一个数字值表示关闭连接的状态号，表示连接被关闭的原因。 */
    code: number;
    /** 一个可读的字符串，表示连接被关闭的原因。 */
    reason: string;
  }
  interface SocketTaskOnMessageListenerResult {
    /** 服务器返回的消息 */
    data: string | ArrayBuffer;
  }
  interface SocketTaskSendOption {
    /** 需要发送的内容 */
    data: string | ArrayBuffer;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SendCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SendFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SendSuccessCallback;
  }
  /** 动画配置 */
  interface SpringOption {
    /** 阻尼系数 */
    damping?: number;
    /** 重量系数，值越大移动越慢 */
    mass?: number;
    /** 动画是否可以在指定值上反弹 */
    overshootClamping?: boolean;
    /** 弹簧静止时的位移 */
    restDisplacementThreshold?: number;
    /** 弹簧静止的速度 */
    restSpeedThreshold?: number;
    /** 弹性系数 */
    stiffness?: number;
    /** 速度 */
    velocity?: number;
  }
  interface StartAccelerometerOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartAccelerometerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartAccelerometerFailCallback;
    /** 需要基础库： `2.1.0`
     *
     * 监听加速度数据回调函数的执行频率
     *
     * 可选值：
     * - 'game': 适用于更新游戏的回调频率，在 20ms/次 左右;
     * - 'ui': 适用于更新 UI 的回调频率，在 60ms/次 左右;
     * - 'normal': 普通的回调频率，在 200ms/次 左右; */
    interval?: 'game' | 'ui' | 'normal';
    /** 接口调用成功的回调函数 */
    success?: StartAccelerometerSuccessCallback;
  }
  interface StartAdvertisingObject {
    /** 广播自定义参数 */
    advertiseRequest: AdvertiseReqObj;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartAdvertisingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartAdvertisingFailCallback;
    /** 广播功率
     *
     * 可选值：
     * - 'low': 功率低;
     * - 'medium': 功率适中;
     * - 'high': 功率高; */
    powerLevel?: 'low' | 'medium' | 'high';
    /** 接口调用成功的回调函数 */
    success?: StartAdvertisingSuccessCallback;
  }
  interface StartBeaconDiscoveryOption {
    /** Beacon 设备广播的 UUID 列表 */
    uuids: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartBeaconDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartBeaconDiscoveryFailCallback;
    /** 是否校验蓝牙开关，仅在 iOS 下有效。iOS 11 起，控制面板里关掉蓝牙，还是能继续使用 Beacon 服务。 */
    ignoreBluetoothAvailable?: boolean;
    /** 接口调用成功的回调函数 */
    success?: StartBeaconDiscoverySuccessCallback;
  }
  interface StartBluetoothDevicesDiscoveryOption {
    /** 是否允许重复上报同一设备。如果允许重复上报，则 [wx.onBlueToothDeviceFound](#) 方法会多次上报同一设备，但是 RSSI 值会有不同。 */
    allowDuplicatesKey?: boolean;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartBluetoothDevicesDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartBluetoothDevicesDiscoveryFailCallback;
    /** 上报设备的间隔，单位 ms。0 表示找到新设备立即上报，其他数值根据传入的间隔上报。 */
    interval?: number;
    /** 扫描模式，越高扫描越快，也越耗电。仅安卓微信客户端 7.0.12 及以上支持。
     *
     * 可选值：
     * - 'low': 低;
     * - 'medium': 中;
     * - 'high': 高; */
    powerLevel?: 'low' | 'medium' | 'high';
    /** 要搜索的蓝牙设备主服务的 UUID 列表（支持 16/32/128 位 UUID）。某些蓝牙设备会广播自己的主 service 的 UUID。如果设置此参数，则只搜索广播包有对应 UUID 的主服务的蓝牙设备。建议通过该参数过滤掉周边不需要处理的其他蓝牙设备。 */
    services?: string[];
    /** 接口调用成功的回调函数 */
    success?: StartBluetoothDevicesDiscoverySuccessCallback;
  }
  interface StartCastingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartCastingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartCastingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartCastingSuccessCallback;
  }
  interface StartCompassOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartCompassCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartCompassFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartCompassSuccessCallback;
  }
  interface StartDeviceMotionListeningOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartDeviceMotionListeningCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartDeviceMotionListeningFailCallback;
    /** 监听设备方向的变化回调函数的执行频率
     *
     * 可选值：
     * - 'game': 适用于更新游戏的回调频率，在 20ms/次 左右;
     * - 'ui': 适用于更新 UI 的回调频率，在 60ms/次 左右;
     * - 'normal': 普通的回调频率，在 200ms/次 左右; */
    interval?: 'game' | 'ui' | 'normal';
    /** 接口调用成功的回调函数 */
    success?: StartDeviceMotionListeningSuccessCallback;
  }
  interface StartDiscoveryOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartDiscoverySuccessCallback;
  }
  interface StartGyroscopeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartGyroscopeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartGyroscopeFailCallback;
    /** 监听陀螺仪数据回调函数的执行频率
     *
     * 可选值：
     * - 'game': 适用于更新游戏的回调频率，在 20ms/次 左右;
     * - 'ui': 适用于更新 UI 的回调频率，在 60ms/次 左右;
     * - 'normal': 普通的回调频率，在 200ms/次 左右; */
    interval?: 'game' | 'ui' | 'normal';
    /** 接口调用成功的回调函数 */
    success?: StartGyroscopeSuccessCallback;
  }
  interface StartHCEOption {
    /** 需要注册到系统的 AID 列表 */
    aid_list: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartHCECompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartHCEFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartHCESuccessCallback;
  }
  interface StartLocalServiceDiscoveryFailCallbackResult {
    /** 错误信息
     *
     * 可选值：
     * - 'invalid param': serviceType 为空;
     * - 'scan task already exist': 在当前 startLocalServiceDiscovery 发起的搜索未停止的情况下，再次调用 startLocalServiceDiscovery; */
    errMsg: string;
  }
  interface StartLocalServiceDiscoveryOption {
    /** 要搜索的服务类型 */
    serviceType: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartLocalServiceDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartLocalServiceDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartLocalServiceDiscoverySuccessCallback;
  }
  interface StartLocationUpdateBackgroundOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartLocationUpdateBackgroundCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartLocationUpdateBackgroundFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartLocationUpdateBackgroundSuccessCallback;
    /** wgs84 返回 gps 坐标，gcj02 返回可用于 wx.openLocation 的坐标 */
    type?: string;
  }
  interface StartLocationUpdateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartLocationUpdateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartLocationUpdateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartLocationUpdateSuccessCallback;
    /** wgs84 返回 gps 坐标，gcj02 返回可用于 wx.openLocation 的坐标 */
    type?: string;
  }
  interface StartPreviewOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartPreviewCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartPreviewFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartPreviewSuccessCallback;
  }
  interface StartPullDownRefreshOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartPullDownRefreshCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartPullDownRefreshFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartPullDownRefreshSuccessCallback;
  }
  interface StartRecordSuccessCallbackResult {
    /** 录音文件的临时路径 (本地路径) */
    tempFilePath: string;
    errMsg: string;
  }
  interface StartRecordTimeoutCallbackResult {
    /** 封面图片文件的临时路径 (本地路径) */
    tempThumbPath: string;
    /** 视频的文件的临时路径 (本地路径) */
    tempVideoPath: string;
  }
  interface StartSoterAuthenticationOption {
    /** 挑战因子。挑战因子为调用者为此次生物鉴权准备的用于签名的字符串关键识别信息，将作为 `resultJSON` 的一部分，供调用者识别本次请求。例如：如果场景为请求用户对某订单进行授权确认，则可以将订单号填入此参数。 */
    challenge: string;
    /** 请求使用的可接受的生物认证方式
     *
     * 可选值：
     * - 'fingerPrint': 指纹识别;
     * - 'facial': 人脸识别;
     * - 'speech': 声纹识别（暂未支持）; */
    requestAuthModes: Array<'fingerPrint' | 'facial' | 'speech'>;
    /** 验证描述，即识别过程中显示在界面上的对话框提示内容 */
    authContent?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartSoterAuthenticationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartSoterAuthenticationFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartSoterAuthenticationSuccessCallback;
  }
  interface StartSoterAuthenticationSuccessCallbackResult {
    /** 生物认证方式 */
    authMode: string;
    /** 错误码 */
    errCode: number;
    /** 错误信息 */
    errMsg: string;
    /** 在设备安全区域（TEE）内获得的本机安全信息（如TEE名称版本号等以及防重放参数）以及本次认证信息（仅Android支持，本次认证的指纹ID）。具体说明见下文 */
    resultJSON: string;
    /** 用SOTER安全密钥对 `resultJSON` 的签名(SHA256 with RSA/PSS, saltlen=20) */
    resultJSONSignature: string;
  }
  interface StartWifiOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartWifiCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartWifiFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StartWifiSuccessCallback;
  }
  interface StatOption {
    /** 文件/目录路径 (本地路径) */
    path: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StatCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StatFailCallback;
    /** 需要基础库： `2.3.0`
     *
     * 是否递归获取目录下的每个文件的 Stats 信息 */
    recursive?: boolean;
    /** 接口调用成功的回调函数 */
    success?: StatSuccessCallback;
  }
  interface StatSuccessCallbackResult {
    /** [Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html)|Array.&lt;[Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html)&gt;
     *
     * 当 recursive 为 false 时，res.stats 是一个 Stats 对象。当 recursive 为 true 且 path 是一个目录的路径时，res.stats 是一个 Array，数组的每一项是一个对象，每个对象包含 path 和 stats。 */
    stats: Stats | Stats[];
    errMsg: string;
  }
  /** 描述文件状态的对象 */
  interface Stats {
    /** 文件最近一次被存取或被执行的时间，UNIX 时间戳，对应 POSIX stat.st_atime */
    lastAccessedTime: number;
    /** 文件最后一次被修改的时间，UNIX 时间戳，对应 POSIX stat.st_mtime */
    lastModifiedTime: number;
    /** 文件的类型和存取的权限，对应 POSIX stat.st_mode */
    mode: string;
    /** 文件大小，单位：B，对应 POSIX stat.st_size */
    size: number;
  }
  interface StepOption {
    /** 动画延迟时间，单位 ms */
    delay?: number;
    /** 动画持续时间，单位 ms */
    duration?: number;
    /** 动画的效果
     *
     * 可选值：
     * - 'linear': 动画从头到尾的速度是相同的;
     * - 'ease': 动画以低速开始，然后加快，在结束前变慢;
     * - 'ease-in': 动画以低速开始;
     * - 'ease-in-out': 动画以低速开始和结束;
     * - 'ease-out': 动画以低速结束;
     * - 'step-start': 动画第一帧就跳至结束状态直到结束;
     * - 'step-end': 动画一直保持开始状态，最后一帧跳到结束状态; */
    timingFunction?: 'linear' | 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out' | 'step-start' | 'step-end';
    transformOrigin?: string;
  }
  /** 贴纸类型 */
  interface Sticker {
    /** 贴纸帧数 */
    len: number;
    /** 贴纸资源路径。资源必须为一个资源文件夹路径或一个压缩包路径，文件夹或压缩包内的贴纸资源必须按照 `{title}_{index}.{ext}` 格式命名。其中 `{title}` 为贴纸名称；`{index}` 为帧序号，从0开始；`{ext}` 为拓展名。 */
    path: string;
    /** 贴纸名称 */
    title: string;
    /** 贴纸触发动作
     *
     * 可选值：
     * - -1: 循环播放;
     * - 10: 张嘴;
     * - 11: 噘嘴/kiss;
     * - 12: 眨/闭左眼;
     * - 13: 眨/闭右眼;
     * - 14: 眨/闭眼;
     * - 15: 挑眉毛;
     * - 16: 左右摇头;
     * - 17: 上下点头;
     * - 100: 比心;
     * - 101: 张开手掌;
     * - 102: 剪刀手/比耶/胜利;
     * - 103: 握拳;
     * - 104: 数字1;
     * - 105: 我爱你;
     * - 106: 点赞;
     * - 107: OK;
     * - 108: Rock&Roll;
     * - 109: 数字6;
     * - 110: 数字8;
     * - 111: 暂不支持（留空）;
     * - 112: 双手抱拳/恭喜发财; */
    active?:
      | -1
      | 10
      | 11
      | 12
      | 13
      | 14
      | 15
      | 16
      | 17
      | 100
      | 101
      | 102
      | 103
      | 104
      | 105
      | 106
      | 107
      | 108
      | 109
      | 110
      | 111
      | 112;
    /** 贴纸ID */
    id?: string;
    /** 贴纸资源 md5 */
    md5?: string;
    /** 贴纸位置，格式为 [x1,y1,x2,y2] 。当 `type` 为 `'2D'` 或 `'front'` 时必填。仅 2D 贴纸和前景贴纸有效 */
    pos?: string[];
    /** 背景贴纸展示位置。仅背景贴纸有效
     *
     * 可选值：
     * - 0: 背景贴纸;
     * - 1: 只在人像区域显示的贴纸; */
    segtype?: 0 | 1;
  }
  interface StopAccelerometerOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopAccelerometerCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopAccelerometerFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopAccelerometerSuccessCallback;
  }
  interface StopAdvertisingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopAdvertisingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopAdvertisingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopAdvertisingSuccessCallback;
  }
  interface StopBGMOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopBGMCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopBGMFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopBGMSuccessCallback;
  }
  interface StopBackgroundAudioOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopBackgroundAudioCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopBackgroundAudioFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopBackgroundAudioSuccessCallback;
  }
  interface StopBeaconDiscoveryOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopBeaconDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopBeaconDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopBeaconDiscoverySuccessCallback;
  }
  interface StopBluetoothDevicesDiscoveryOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopBluetoothDevicesDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopBluetoothDevicesDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopBluetoothDevicesDiscoverySuccessCallback;
  }
  interface StopCompassOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopCompassCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopCompassFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopCompassSuccessCallback;
  }
  interface StopDeviceMotionListeningOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopDeviceMotionListeningCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopDeviceMotionListeningFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopDeviceMotionListeningSuccessCallback;
  }
  interface StopDiscoveryOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopDiscoverySuccessCallback;
  }
  interface StopFaceDetectOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopFaceDetectCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopFaceDetectFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopFaceDetectSuccessCallback;
  }
  interface StopGyroscopeOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopGyroscopeCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopGyroscopeFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopGyroscopeSuccessCallback;
  }
  interface StopHCEOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopHCECompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopHCEFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopHCESuccessCallback;
  }
  interface StopLocalServiceDiscoveryFailCallbackResult {
    /** 错误信息
     *
     * 可选值：
     * - 'task not found': 在当前没有处在搜索服务中的情况下调用 stopLocalServiceDiscovery; */
    errMsg: string;
  }
  interface StopLocalServiceDiscoveryOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopLocalServiceDiscoveryCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopLocalServiceDiscoveryFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopLocalServiceDiscoverySuccessCallback;
  }
  interface StopLocationUpdateOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopLocationUpdateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopLocationUpdateFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopLocationUpdateSuccessCallback;
  }
  interface StopOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopSuccessCallback;
  }
  interface StopPreviewOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopPreviewCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopPreviewFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopPreviewSuccessCallback;
  }
  interface StopPullDownRefreshOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopPullDownRefreshCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopPullDownRefreshFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopPullDownRefreshSuccessCallback;
  }
  interface StopRecordSuccessCallbackResult {
    /** 封面图片文件的临时路径 (本地路径) */
    tempThumbPath: string;
    /** 视频的文件的临时路径 (本地路径) */
    tempVideoPath: string;
    errMsg: string;
  }
  interface StopVoiceOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopVoiceCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopVoiceFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopVoiceSuccessCallback;
  }
  interface StopWifiOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopWifiCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopWifiFailCallback;
    /** 接口调用成功的回调函数 */
    success?: StopWifiSuccessCallback;
  }
  interface SubscribeVoIPVideoMembersOption {
    /** 订阅的成员列表 */
    openIdList: string[];
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SubscribeVoIPVideoMembersCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SubscribeVoIPVideoMembersFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SubscribeVoIPVideoMembersSuccessCallback;
  }
  /** 订阅消息设置
*
* **示例代码**
*
* ```javascript
wx.getSetting({
  withSubscriptions: true,
  success (res) {
    console.log(res.authSetting)
    // res.authSetting = {
    //   "scope.userInfo": true,
    //   "scope.userLocation": true
    // }
    console.log(res.subscriptionsSetting)
    // res.subscriptionsSetting = {
    //   mainSwitch: true, // 订阅消息总开关
    //   itemSettings: {   // 每一项开关
    //     SYS_MSG_TYPE_INTERACTIVE: 'accept', // 小游戏系统订阅消息
    //     SYS_MSG_TYPE_RANK: 'accept'
    //     zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE: 'reject', // 普通一次性订阅消息
    //     ke_OZC_66gZxALLcsuI7ilCJSP2OJ2vWo2ooUPpkWrw: 'ban',
    //   }
    // }
  }
})
``` */
  interface SubscriptionsSetting {
    /** 订阅消息总开关，true为开启，false为关闭 */
    mainSwitch: boolean;
    /** 每一项订阅消息的订阅状态。itemSettings对象的键为**一次性订阅消息的模板id**或**系统订阅消息的类型**，值为'accept'、'reject'、'ban'中的其中一种。'accept'表示用户同意订阅这条消息，'reject'表示用户拒绝订阅这条消息，'ban'表示已被后台封禁。一次性订阅消息使用方法详见 [wx.requestSubscribeMessage](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)，永久订阅消息（仅小游戏可用）使用方法详见[wx.requestSubscribeSystemMessage](https://developers.weixin.qq.com/minigame/dev/api/open-api/subscribe-message/wx.requestSubscribeSystemMessage.html)
     * ## 注意事项
     *  - itemSettings 只返回用户勾选过订阅面板中的“总是保持以上选择，不再询问”的订阅消息。 */
    itemSettings?: IAnyObject;
  }
  interface SwitchCameraOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SwitchCameraCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SwitchCameraFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SwitchCameraSuccessCallback;
  }
  interface SwitchCastingOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SwitchCastingCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SwitchCastingFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SwitchCastingSuccessCallback;
  }
  interface SwitchTabOption {
    /** 需要跳转的 tabBar 页面的路径 (代码包路径)（需在 app.json 的 [tabBar](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#tabbar) 字段定义的页面），路径后不能带参数。 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: SwitchTabCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: SwitchTabFailCallback;
    /** 接口调用成功的回调函数 */
    success?: SwitchTabSuccessCallback;
  }
  interface SystemInfo {
    /** 需要基础库： `1.1.0`
     *
     * 客户端基础库版本 */
    SDKVersion: string;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信使用相册的开关（仅 iOS 有效） */
    albumAuthorized: boolean;
    /** 需要基础库： `1.8.0`
     *
     * 设备性能等级（仅 Android）。取值为：-2 或 0（该设备无法运行小游戏），-1（性能未知），>=1（设备性能值，该值越高，设备性能越好，目前最高不到50） */
    benchmarkLevel: number;
    /** 需要基础库： `2.6.0`
     *
     * 蓝牙的系统开关 */
    bluetoothEnabled: boolean;
    /** 需要基础库： `1.5.0`
     *
     * 设备品牌 */
    brand: string;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信使用摄像头的开关 */
    cameraAuthorized: boolean;
    /** 设备方向
     *
     * 可选值：
     * - 'portrait': 竖屏;
     * - 'landscape': 横屏; */
    deviceOrientation: 'portrait' | 'landscape';
    /** 需要基础库： `2.15.0`
     *
     * 是否已打开调试。可通过右上角菜单或 [wx.setEnableDebug](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.setEnableDebug.html) 打开调试。 */
    enableDebug: boolean;
    /** 需要基础库： `1.5.0`
     *
     * 用户字体大小（单位px）。以微信客户端「我-设置-通用-字体大小」中的设置为准 */
    fontSizeSetting: number;
    /** 需要基础库： `2.12.3`
     *
     * 当前小程序运行的宿主环境 */
    host: SystemInfoHost;
    /** 微信设置的语言 */
    language: string;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信使用定位的开关 */
    locationAuthorized: boolean;
    /** 需要基础库： `2.6.0`
     *
     * 地理位置的系统开关 */
    locationEnabled: boolean;
    /** `true` 表示模糊定位，`false` 表示精确定位，仅 iOS 支持 */
    locationReducedAccuracy: boolean;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信使用麦克风的开关 */
    microphoneAuthorized: boolean;
    /** 设备型号。新机型刚推出一段时间会显示unknown，微信会尽快进行适配。 */
    model: string;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信通知带有提醒的开关（仅 iOS 有效） */
    notificationAlertAuthorized: boolean;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信通知的开关 */
    notificationAuthorized: boolean;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信通知带有标记的开关（仅 iOS 有效） */
    notificationBadgeAuthorized: boolean;
    /** 需要基础库： `2.6.0`
     *
     * 允许微信通知带有声音的开关（仅 iOS 有效） */
    notificationSoundAuthorized: boolean;
    /** 需要基础库： `2.19.3`
     *
     * 允许微信使用日历的开关 */
    phoneCalendarAuthorized: boolean;
    /** 设备像素比 */
    pixelRatio: number;
    /** 客户端平台
     *
     * 可选值：
     * - 'ios': iOS微信（包含 iPhone、iPad）;
     * - 'android': Android微信;
     * - 'windows': Windows微信;
     * - 'mac': macOS微信;
     * - 'devtools': 微信开发者工具; */
    platform: 'ios' | 'android' | 'windows' | 'mac' | 'devtools';
    /** 需要基础库： `2.7.0`
     *
     * 在竖屏正方向下的安全区域。部分机型没有安全区域概念，也不会返回 safeArea 字段，开发者需自行兼容。 */
    safeArea: SafeArea;
    /** 需要基础库： `1.1.0`
     *
     * 屏幕高度，单位px */
    screenHeight: number;
    /** 需要基础库： `1.1.0`
     *
     * 屏幕宽度，单位px */
    screenWidth: number;
    /** 需要基础库： `1.9.0`
     *
     * 状态栏的高度，单位px */
    statusBarHeight: number;
    /** 操作系统及版本 */
    system: string;
    /** 微信版本号 */
    version: string;
    /** 需要基础库： `2.6.0`
     *
     * Wi-Fi 的系统开关 */
    wifiEnabled: boolean;
    /** 可使用窗口高度，单位px */
    windowHeight: number;
    /** 可使用窗口宽度，单位px */
    windowWidth: number;
    /** 需要基础库： `2.11.0`
     *
     * 系统当前主题，取值为`light`或`dark`，全局配置`"darkmode":true`时才能获取，否则为 undefined （不支持小游戏）
     *
     * 可选值：
     * - 'dark': 深色主题;
     * - 'light': 浅色主题; */
    theme?: 'dark' | 'light';
  }
  /** 需要基础库： `2.12.3`
   *
   * 当前小程序运行的宿主环境 */
  interface SystemInfoHost {
    /** 宿主 app 对应的 appId */
    appId: string;
  }
  interface SystemSetting {
    /** 蓝牙的系统开关 */
    bluetoothEnabled: boolean;
    /** 设备方向
     *
     * 可选值：
     * - 'portrait': 竖屏;
     * - 'landscape': 横屏; */
    deviceOrientation: 'portrait' | 'landscape';
    /** 地理位置的系统开关 */
    locationEnabled: boolean;
    /** Wi-Fi 的系统开关 */
    wifiEnabled: boolean;
  }
  interface TCPSocketConnectOption {
    /** 套接字要连接的地址 */
    address: string;
    /** 套接字要连接的端口 */
    port: number;
    /** 套接字要连接的超时时间，默认为 2s */
    timeout?: number;
  }
  interface TCPSocketOnMessageListenerResult {
    /** 接收端地址信息 */
    localInfo: LocalInfo;
    /** 收到的消息 */
    message: ArrayBuffer;
    /** 发送端地址信息 */
    remoteInfo: RemoteInfo;
  }
  interface TakePhotoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: TakePhotoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: TakePhotoFailCallback;
    /** 成像质量
     *
     * 可选值：
     * - 'high': 高质量;
     * - 'normal': 普通质量;
     * - 'low': 低质量; */
    quality?: 'high' | 'normal' | 'low';
    /** 需要基础库： `2.22.0`
     *
     * 是否开启镜像 */
    selfieMirror?: boolean;
    /** 接口调用成功的回调函数 */
    success?: TakePhotoSuccessCallback;
  }
  interface TakePhotoSuccessCallbackResult {
    /** 照片文件的临时路径 (本地路径)，安卓是jpg图片格式，ios是png */
    tempImagePath: string;
    errMsg: string;
  }
  /** 标签类型枚举 */
  interface TechType {
    /** 对应IsoDep实例，实例支持ISO-DEP (ISO 14443-4)标准的读写 */
    isoDep: string;
    /** 对应MifareClassic实例，实例支持MIFARE Classic标签的读写 */
    mifareClassic: string;
    /** 对应MifareUltralight实例，实例支持MIFARE Ultralight标签的读写 */
    mifareUltralight: string;
    /** 对应Ndef实例，实例支持对NDEF格式的NFC标签上的NDEF数据的读写 */
    ndef: string;
    /** 对应NfcA实例，实例支持NFC-A (ISO 14443-3A)标准的读写 */
    nfcA: string;
    /** 对应NfcB实例，实例支持NFC-B (ISO 14443-3B)标准的读写 */
    nfcB: string;
    /** 对应NfcF实例，实例支持NFC-F (JIS 6319-4)标准的读写 */
    nfcF: string;
    /** 对应NfcV实例，实例支持NFC-V (ISO 15693)标准的读写 */
    nfcV: string;
  }
  /** 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* Tensor
*
* ****
*
* ```js
session.run({
  input1: {
    type: 'float32',
    data: new Float32Array(3 * 224 * 224).buffer,
    shape: [1, 3, 224, 224] // NCHW 顺序
  },
  input2: {
    type: 'uint8',
    data: new Uint8Array(224 * 224).buffer,
    shape: [1, 1, 224, 224]
  },
}).then(res => {
  console.log(res.output0)
  // output0 结构如下：
  // {
  //   type: 'uint8',
  //   data: new Uint8Array(224 * 224).buffer,
  //   shape: [1, 1, 224, 224]
  // }
})
``` */
  interface Tensor {
    /** Tensor 值，一段 ArrayBuffer */
    data: ArrayBuffer;
    /** Tensor shape （Tensor 形状，例如 `[1, 3, 224, 224]` 即表示一个4唯Tensor，每个维度的长度分别为1, 3, 224, 224） */
    shape: number[];
    /** ArrayBuffer 值的类型，合法值有 `uint8`, `int8`, `uint32`, `int32`, `float32` */
    type: string;
  }
  /** 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* Tensors 是 key-value 形式的对象，对象的 key 会作为 input/output name，对象的 value 则是 Tensor。 Tensor 结构如下。
*
* ****
*
* ```js
session.run({
  input1: {
    type: 'float32',
    data: new Float32Array(3 * 224 * 224).buffer,
    shape: [1, 3, 224, 224] // NCHW 顺序
  },
  input2: {
    type: 'uint8',
    data: new Uint8Array(224 * 224).buffer,
    shape: [1, 1, 224, 224]
  },
}).then(res => {
  console.log(res.output0)
  // output0 结构如下：
  // {
  //   type: 'uint8',
  //   data: new Uint8Array(224 * 224).buffer,
  //   shape: [1, 1, 224, 224]
  // }
})
``` */
  interface Tensors {
    /** [Tensor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/Tensor.html)
     *
     * Tensor，每个 Tensor 包含 shape、data、type 字段。 */
    key: Tensor;
  }
  interface TextMetrics {
    /** 文本的宽度 */
    width: number;
  }
  /** 动画配置 */
  interface TimingOption {
    /** 动画时长 */
    duration?: number;
    /** 动画曲线，参考 [Easing](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.Easing.html) 模块。 */
    easing?: (...args: any[]) => any;
  }
  interface ToScreenLocationOption {
    /** 纬度 */
    latitude: number;
    /** 经度 */
    longitude: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ToScreenLocationCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ToScreenLocationFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ToScreenLocationSuccessCallback;
  }
  interface ToScreenLocationSuccessCallbackResult {
    /** x 坐标值 */
    x: number;
    /** y 坐标值 */
    y: number;
    errMsg: string;
  }
  interface ToggleTorchOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: ToggleTorchCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: ToggleTorchFailCallback;
    /** 接口调用成功的回调函数 */
    success?: ToggleTorchSuccessCallback;
  }
  /** 跟踪能力配置，目前不同的跟踪能力之间是互斥的，默认使用平面跟踪能力。需要注意目前 track 中不同的跟踪配置存在互斥关系（比如 marker 跟踪配置和 OSD 跟踪配置不能同时存在），请按需配置。 */
  interface Track {
    /** 平面跟踪配置 */
    plane: PlaneTrack;
    /** 需要基础库： `2.27.0`
     *
     * OCR检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/ocr.html)。 */
    OCR?: OCRTrack;
    /** 需要基础库： `2.24.5`
     *
     * OSD 跟踪配置 */
    OSD?: boolean;
    /** 需要基础库： `2.28.0`
     *
     * 人体检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html)。 */
    body?: BodyTrack;
    /** 需要基础库： `2.25.0`
     *
     * 人脸检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html)。安卓微信8.0.25开始支持，iOS微信8.0.24开始支持。 */
    face?: FaceTrack;
    /** 需要基础库： `2.28.0`
     *
     * 手势检测配置。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/hand.html)。 */
    hand?: HandTrack;
    /** 需要基础库： `2.24.5`
     *
     * marker 跟踪配置 */
    marker?: boolean;
    /** 需要基础库： `2.28.0`
     *
     * 提供基础AR功能，输出相机旋转的3个自由度的位姿，利用手机陀螺仪传感器，实现快速稳定的AR定位能力，适用于简单AR场景。 */
    threeDof?: boolean;
  }
  interface TransceiveOption {
    /** 需要传递的二进制数据 */
    data: ArrayBuffer;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: TransceiveCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: TransceiveFailCallback;
    /** 接口调用成功的回调函数 */
    success?: TransceiveSuccessCallback;
  }
  interface TransceiveSuccessCallbackResult {
    data: ArrayBuffer;
    errMsg: string;
  }
  interface TranslateMarkerOption {
    /** 移动过程中是否自动旋转 marker */
    autoRotate: boolean;
    /** 指定 marker 移动到的目标点 */
    destination: DestinationOption;
    /** 指定 marker */
    markerId: number;
    /** marker 的旋转角度 */
    rotate: number;
    /** 动画结束回调函数 */
    animationEnd?: (...args: any[]) => any;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: TranslateMarkerCompleteCallback;
    /** 动画持续时长，平移与旋转分别计算 */
    duration?: number;
    /** 接口调用失败的回调函数 */
    fail?: TranslateMarkerFailCallback;
    /** 需要基础库： `2.13.0`
     *
     * 平移和旋转同时进行 */
    moveWithRotate?: boolean;
    /** 接口调用成功的回调函数 */
    success?: TranslateMarkerSuccessCallback;
  }
  interface TruncateOption {
    /** 要截断的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: TruncateCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: TruncateFailCallback;
    /** 截断位置，默认0。如果 length 小于文件长度（字节），则只有前面 length 个字节会保留在文件中，其余内容会被删除；如果 length 大于文件长度，则会对其进行扩展，并且扩展部分将填充空字节（'\0'） */
    length?: number;
    /** 接口调用成功的回调函数 */
    success?: TruncateSuccessCallback;
  }
  interface TruncateSyncOption {
    /** 要截断的文件路径 (本地路径) */
    filePath: string;
    /** 截断位置，默认0。如果 length 小于文件长度（字节），则只有前面 length 个字节会保留在文件中，其余内容会被删除；如果 length 大于文件长度，则会对其进行扩展，并且扩展部分将填充空字节（'\0'） */
    length?: number;
  }
  interface UDPSocketConnectOption {
    /** 要发消息的地址 */
    address: string;
    /** 要发送消息的端口号 */
    port: number;
  }
  interface UDPSocketOnMessageListenerResult {
    /** 接收端地址信息，2.18.0 起支持 */
    localInfo: LocalInfo;
    /** 收到的消息。消息长度需要小于4096。 */
    message: ArrayBuffer;
    /** 发送端地址信息 */
    remoteInfo: RemoteInfo;
  }
  interface UDPSocketSendOption {
    /** 要发消息的地址。在基础库 <= 2.9.3 版本必须是和本机同网段的 IP 地址，或安全域名列表内的域名地址；之后版本可以是任意 IP 和域名 */
    address: string;
    /** 要发送的数据 */
    message: string | ArrayBuffer;
    /** 要发送消息的端口号 */
    port: number;
    /** 发送数据的长度，仅当 message 为 ArrayBuffer 类型时有效 */
    length?: number;
    /** 发送数据的偏移量，仅当 message 为 ArrayBuffer 类型时有效 */
    offset?: number;
    /** 向指定地址发消息时，是否要开启广播，基础库 2.24.0 开始支持 */
    setBroadcast?: boolean;
  }
  interface UndoOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UndoCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UndoFailCallback;
    /** 接口调用成功的回调函数 */
    success?: UndoSuccessCallback;
  }
  interface UnlinkOption {
    /** 要删除的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UnlinkCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UnlinkFailCallback;
    /** 接口调用成功的回调函数 */
    success?: UnlinkSuccessCallback;
  }
  interface UnzipOption {
    /** 目标目录路径, 支持本地路径 */
    targetPath: string;
    /** 源文件路径，支持本地路径, 只可以是 zip 压缩文件 */
    zipFilePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UnzipCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UnzipFailCallback;
    /** 接口调用成功的回调函数 */
    success?: UnzipSuccessCallback;
  }
  /** 参数列表 */
  interface UpdatableMessageFrontEndParameter {
    /** 参数名 */
    name: string;
    /** 参数值 */
    value: string;
  }
  /** 需要基础库： `2.4.0`
   *
   * 动态消息的模板信息 */
  interface UpdatableMessageFrontEndTemplateInfo {
    /** 参数列表 */
    parameterList: UpdatableMessageFrontEndParameter[];
  }
  interface UpdateGroundOverlayOption {
    /** 图片覆盖的经纬度范围 */
    bounds: MapBounds;
    /** 图片图层 id */
    id: string;
    /** 图片路径，支持网络图片、临时路径、代码包路径 */
    src: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UpdateGroundOverlayCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UpdateGroundOverlayFailCallback;
    /** 图层透明度 */
    opacity?: number;
    /** 接口调用成功的回调函数 */
    success?: UpdateGroundOverlaySuccessCallback;
    /** 是否可见 */
    visible?: boolean;
    /** 图层绘制顺序 */
    zIndex?: number;
  }
  interface UpdateShareMenuOption {
    /** 需要基础库： `2.4.0`
     *
     * 动态消息的 activityId。通过 [updatableMessage.createActivityId](#) 接口获取 */
    activityId?: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UpdateShareMenuCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UpdateShareMenuFailCallback;
    /** 需要基础库： `2.13.0`
     *
     * 是否是私密消息。详见 [小程序私密消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/private-message.html) */
    isPrivateMessage?: boolean;
    /** 需要基础库： `2.4.0`
     *
     * 是否是动态消息，详见[动态消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/updatable-message.html) */
    isUpdatableMessage?: boolean;
    /** 接口调用成功的回调函数 */
    success?: UpdateShareMenuSuccessCallback;
    /** 需要基础库： `2.4.0`
     *
     * 动态消息的模板信息 */
    templateInfo?: UpdatableMessageFrontEndTemplateInfo;
    /** 需要基础库： `2.11.0`
     *
     * 群待办消息的id，通过toDoActivityId可以把多个群待办消息聚合为同一个。通过 [updatableMessage.createActivityId](#) 接口获取。详见[群待办消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html) */
    toDoActivityId?: string;
    /** 是否使用带 shareTicket 的转发[详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html) */
    withShareTicket?: boolean;
  }
  interface UpdateVoIPChatMuteConfigOption {
    /** 静音设置 */
    muteConfig: MuteConfig;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UpdateVoIPChatMuteConfigCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UpdateVoIPChatMuteConfigFailCallback;
    /** 接口调用成功的回调函数 */
    success?: UpdateVoIPChatMuteConfigSuccessCallback;
  }
  interface UpdateWeChatAppOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UpdateWeChatAppCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UpdateWeChatAppFailCallback;
    /** 接口调用成功的回调函数 */
    success?: UpdateWeChatAppSuccessCallback;
  }
  interface UploadFileOption {
    /** 要上传文件资源的路径 (本地路径) */
    filePath: string;
    /** 文件对应的 key，开发者在服务端可以通过这个 key 获取文件的二进制内容 */
    name: string;
    /** 开发者服务器地址 */
    url: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: UploadFileCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: UploadFileFailCallback;
    /** HTTP 请求中其他额外的 form data */
    formData?: IAnyObject;
    /** HTTP 请求 Header，Header 中不能设置 Referer */
    header?: IAnyObject;
    /** 接口调用成功的回调函数 */
    success?: UploadFileSuccessCallback;
    /** 需要基础库： `2.10.0`
     *
     * 超时时间，单位为毫秒 */
    timeout?: number;
  }
  interface UploadFileSuccessCallbackResult {
    /** 开发者服务器返回的数据 */
    data: string;
    /** 开发者服务器返回的 HTTP 状态码 */
    statusCode: number;
    errMsg: string;
  }
  interface UploadTaskOnProgressUpdateListenerResult {
    /** 上传进度百分比 */
    progress: number;
    /** 预期需要上传的数据总长度，单位 Bytes */
    totalBytesExpectedToSend: number;
    /** 已经上传的数据长度，单位 Bytes */
    totalBytesSent: number;
  }
  /** @warning **用户头像昵称获取规则已调整，参考 [用户信息接口调整说明](https://developers.weixin.qq.com/community/develop/doc/000cacfa20ce88df04cb468bc52801)、[小程序用户头像昵称获取规则调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)**
   *
   * 用户信息 */
  interface UserInfo {
    /** 用户头像图片的 URL。URL 最后一个数值代表正方形头像大小（有 0、46、64、96、132 数值可选，0 代表 640x640 的正方形头像，46 表示 46x46 的正方形头像，剩余数值以此类推。默认132），用户没有头像时该项为空。若用户更换头像，原有头像 URL 将失效。 */
    avatarUrl: string;
    /** 用户所在城市。不再返回，参考 [相关公告](https://developers.weixin.qq.com/community/develop/doc/00028edbe3c58081e7cc834705b801) */
    city: string;
    /** 用户所在国家。不再返回，参考 [相关公告](https://developers.weixin.qq.com/community/develop/doc/00028edbe3c58081e7cc834705b801) */
    country: string;
    /** 用户性别。不再返回，参考 [相关公告](https://developers.weixin.qq.com/community/develop/doc/00028edbe3c58081e7cc834705b801)
     *
     * 可选值：
     * - 0: 未知;
     * - 1: 男性;
     * - 2: 女性; */
    gender: 0 | 1 | 2;
    /** 显示 country，province，city 所用的语言。强制返回 “zh_CN”，参考 [相关公告](https://developers.weixin.qq.com/community/develop/doc/00028edbe3c58081e7cc834705b801)
     *
     * 可选值：
     * - 'en': 英文;
     * - 'zh_CN': 简体中文;
     * - 'zh_TW': 繁体中文; */
    language: 'en' | 'zh_CN' | 'zh_TW';
    /** 用户昵称 */
    nickName: string;
    /** 用户所在省份。不再返回，参考 [相关公告](https://developers.weixin.qq.com/community/develop/doc/00028edbe3c58081e7cc834705b801) */
    province: string;
  }
  /** 需要基础库： `2.28.0`
   *
   * 人体 anchor
   *
   * **示例代码**
   *
   * [静态图像body检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-body-detect)
   *
   * [实时摄像头body检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/body-detect) */
  interface VKBodyAnchor {
    /** 关键点的置信度 */
    confidence: number[];
    /** 识别序号 */
    detectId: number;
    /** 唯一标识 */
    id: number;
    /** 相对视窗的位置信息，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    origin: VKOrigin;
    /** 关键点 */
    points: VKOrigin[];
    /** 总体置信值 */
    score: number;
    /** 相对视窗的尺寸，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    size: VKSize;
    /** 类型
     *
     * 可选值：
     * - 5: 人体; */
    type: 5;
  }
  /** 需要基础库： `2.20.0`
   *
   * 相机对象 */
  interface VKCamera {
    /** 需要基础库： `2.22.0`
     *
     * 相机内参，只有 v2 版本支持 */
    intrinsics: Float32Array;
    /** 视图矩阵 */
    viewMatrix: Float32Array;
  }
  interface VKConfig {
    /** 跟踪能力配置，目前不同的跟踪能力之间是互斥的，默认使用平面跟踪能力。需要注意目前 track 中不同的跟踪配置存在互斥关系（比如 marker 跟踪配置和 OSD 跟踪配置不能同时存在），请按需配置。 */
    track: Track;
    /** 需要基础库： `2.23.0`
     *
     * 绑定的 WebGLRenderingContext 对象 */
    gl?: WebGLRenderingContext;
    /** 需要基础库： `2.22.0`
     *
     * vision kit 版本。
     *
     * 可选值：
     * - 'v1': v1适用于用户在平面场景下，例如桌面，地面，泛平面场景，放置虚拟物体，不提供真实世界距离。用户放置物体时，手机相机倾斜向下对着目标平面点击即可，具有广泛的机型支持;
     * - 'v2': v2提供真实物理距离的 ar 定位功能，提供平面识别功能，用户在平面范围点击放置虚拟物体的功能，具有[有限的机型支持](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/plane.html#%E9%99%84%E5%BD%95)。iOS 设备在基础库 2.22.0 开始支持v2。安卓设备在基础库 2.25.1 开始支持v2，另外，安卓v2不支持竖直平面。**使用v2算法需要初始化，移动手机进行左右平移初始化效果最佳。**; */
    version?: 'v1' | 'v2';
  }
  /** 需要基础库： `2.25.0`
   *
   * 人脸 anchor
   *
   * **示例代码**
   *
   * [静态图像人脸检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-face-detect)
   *
   * [实时摄像头人脸检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/face-detect) */
  interface VKFaceAnchor {
    /** 人脸角度信息 */
    angle: number[];
    /** 关键点的置信度 */
    confidence: number[];
    /** 识别序号 */
    detectId: number;
    /** 唯一标识 */
    id: number;
    /** 相对视窗的位置信息，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    origin: VKOrigin;
    /** 人脸 106 个关键点的坐标 */
    points: VKPoint[];
    /** 相对视窗的尺寸，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    size: VKSize;
    /** 类型
     *
     * 可选值：
     * - 3: 人脸; */
    type: 3;
  }
  /** 需要基础库： `2.20.0`
   *
   * vision kit 会话对象。 */
  interface VKFrame {
    /** [VKCamera](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKCamera.html)
     *
     * 相机对象 */
    camera: VKCamera;
    /** 生成时间，单位:纳秒(ns) */
    timestamp: number;
  }
  /** 需要基础库： `2.28.0`
   *
   * 手势 anchor
   *
   * **示例代码**
   *
   * [静态图像hand检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-hand-detect)
   *
   * [实时摄像头hand检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/hand-detect) */
  interface VKHandAnchor {
    /** 关键点的置信度 */
    confidence: number[];
    /** 识别序号 */
    detectId: number;
    /** 手势分类, 返回整数-1到18, -1表示无效手势
     *
     * 可选值：
     * - 0: 单手比心;
     * - 1: 布（数字5）;
     * - 2: 剪刀（数字2）;
     * - 3: 握拳;
     * - 4: 数字1;
     * - 5: 热爱;
     * - 6: 点赞;
     * - 7: 数字3;
     * - 8: 摇滚;
     * - 9: 数字6;
     * - 10: 数字8;
     * - 11: 双手抱拳（恭喜发财）;
     * - 12: 数字4;
     * - 13: 比ok;
     * - 14: 不喜欢（踩）;
     * - 15: 双手比心;
     * - 16: 祈祷（双手合十）;
     * - 17: 双手抱拳;
     * - 18: 无手势动作;
     * - -1: 无效手势; */
    gesture: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | -1;
    /** 唯一标识 */
    id: number;
    /** 相对视窗的位置信息，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    origin: VKOrigin;
    /** 关键点 */
    points: VKOrigin[];
    /** 总体置信值 */
    score: number;
    /** 相对视窗的尺寸，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    size: VKSize;
    /** 类型
     *
     * 可选值：
     * - 7: 手势; */
    type: 7;
  }
  interface VKMarker {
    /** marker id */
    markerId: number;
    /** 图片路径 */
    path: string;
  }
  /** 需要基础库： `2.24.5`
   *
   * marker anchor
   *
   * **示例代码**
   *
   * [2D Marker能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/2dmarker-ar) */
  interface VKMarkerAnchor {
    /** 唯一标识 */
    id: number;
    /** marker id */
    markerId: number;
    /** 图片路径 */
    path: string;
    /** 包含位置、旋转、放缩信息的矩阵，以列为主序 */
    transform: Float32Array;
    /** 类型
     *
     * 可选值：
     * - 1: marker; */
    type: 1;
  }
  /** 需要基础库： `2.27.0`
   *
   * OCR anchor
   *
   * **示例代码**
   *
   * [静态图像OCR检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-ocr-detect)
   *
   * [实时摄像头OCR检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/ocr-detect) */
  interface VKOCRAnchor {
    /** 唯一标识 */
    id: number;
    /** 识别的文字结果 */
    text: string;
    /** 类型
     *
     * 可选值：
     * - 6: OCR; */
    type: 6;
  }
  /** 需要基础库： `2.24.5`
   *
   * OSD anchor
   *
   * **示例代码**
   *
   * [单样本检测(OSD)能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/osd-ar) */
  interface VKOSDAnchor {
    /** 唯一标识 */
    id: number;
    /** marker id */
    markerId: number;
    /** 相对视窗的位置信息，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    origin: VKOrigin;
    /** 图片路径 */
    path: string;
    /** 相对视窗的尺寸，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘 */
    size: VKSize;
    /** 类型
     *
     * 可选值：
     * - 2: OSD; */
    type: 2;
  }
  interface VKOrigin {
    /** 横坐标 */
    x: number;
    /** 纵坐标 */
    y: number;
  }
  /** 需要基础库： `2.22.0`
   *
   * 平面 anchor，只有 v2 版本支持
   *
   * **示例代码**
   *
   * v1 版本：[水平面AR能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/plane-ar)
   * v2 版本：[水平面AR能力v2使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/plane-ar-v2) */
  interface VKPlaneAnchor {
    /** 方向 */
    alignment: number;
    /** 唯一标识 */
    id: number;
    /** 尺寸 */
    size: VKSize;
    /** 包含位置、旋转、放缩信息的矩阵，以列为主序 */
    transform: Float32Array;
    /** 类型
     *
     * 可选值：
     * - 0: 平面; */
    type: 0;
  }
  /** 人脸 106 个关键点的坐标 */
  interface VKPoint {
    /** 横坐标 */
    x: number;
    /** 纵坐标 */
    y: number;
  }
  /** 需要基础库： `2.20.0`
   *
   * vision kit 会话对象。 */
  interface VKSession {
    /** 相机尺寸 */
    cameraSize: VKSize;
    /** 会话配置 */
    config: VKConfig;
    /** 会话状态
     *
     * 可选值：
     * - 0: 不可用;
     * - 1: 运行中;
     * - 2: 暂停中;
     * - 3: 初始化中; */
    state: 0 | 1 | 2 | 3;
  }
  interface VKSize {
    /** 高度 */
    height: number;
    /** 宽度 */
    width: number;
  }
  interface VibrateLongOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: VibrateLongCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: VibrateLongFailCallback;
    /** 接口调用成功的回调函数 */
    success?: VibrateLongSuccessCallback;
  }
  interface VibrateShortFailCallbackResult {
    /** 错误信息
     *
     * 可选值：
     * - 'style is not support': 当前设备不支持设置震动等级; */
    errMsg: string;
  }
  interface VibrateShortOption {
    /** 需要基础库： `2.13.0`
     *
     * 震动强度类型，有效值为：heavy、medium、light */
    type: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: VibrateShortCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: VibrateShortFailCallback;
    /** 接口调用成功的回调函数 */
    success?: VibrateShortSuccessCallback;
  }
  interface VideoContextRequestFullScreenOption {
    /** 需要基础库： `1.7.0`
     *
     * 设置全屏时视频的方向，不指定则根据宽高比自动判断。
     *
     * 可选值：
     * - 0: 正常竖向;
     * - 90: 屏幕逆时针90度;
     * - -90: 屏幕顺时针90度; */
    direction?: 0 | 90 | -90;
  }
  interface VideoDecoderStartOption {
    /** 需要解码的视频源文件。基础库 2.13.0 以下的版本只支持本地路径。 2.13.0 开始支持 http:// 和 https:// 协议的远程路径。 */
    source: string;
    /** 需要基础库： `2.15.0`
     *
     * 是否不需要音频轨道 */
    abortAudio?: boolean;
    /** 需要基础库： `2.15.0`
     *
     * 是否不需要视频轨道 */
    abortVideo?: boolean;
    /** 解码模式。0：按 pts 解码；1：以最快速度解码 */
    mode?: number;
  }
  interface VoIP1v1ChatUser {
    /** 昵称 */
    nickname: string;
    /** 小程序内 openid */
    openid: string;
    /** 头像 */
    headImage?: string;
  }
  /** 需要基础库： `2.19.0`
*
* WebAudioContext 实例，通过[wx.createWebAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createWebAudioContext.html) 接口获取该实例。
*
* **示例代码**
*
* ```js
// 监听状态
const audioCtx = wx.createWebAudioContext()
audioCtx.onstatechange = () => {
  console.log(ctx.state)
}
setTimeout(audioCtx.suspend, 1000)
setTimeout(audioCtx.resume, 2000)
``` */
  interface WebAudioContext {
    /** 获取当前上下文的时间戳。 */
    currentTime: number;
    /** [WebAudioContextNode](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContextNode.html)
     *
     * 当前上下文的最终目标节点，一般是音频渲染设备。 */
    destination: WebAudioContextNode;
    /** 空间音频监听器。 */
    listener: AudioListener;
    /** 可写属性，开发者可以对该属性设置一个监听函数，当WebAudio状态改变的时候，会触发开发者设置的监听函数。 */
    onstatechange: (...args: any[]) => any;
    /** 采样率，通常在8000-96000之间，通常44100hz的采样率最为常见。 */
    sampleRate: number;
    /** 当前WebAudio上下文的状态。可能的值如下：suspended（暂停）、running（正在运行）、closed（已关闭）。需要注意的是，不要在 audioContext close后再访问state属性 */
    state: string;
  }
  /** 需要基础库： `2.19.0`
   *
   * 一类音频处理模块，不同的Node具备不同的功能，如GainNode(音量调整)等。一个WebAudioContextNode可以通过上下文来创建。
   * 目前已经支持以下Node：
   * IIRFilterNode
   * WaveShaperNode
   * ConstantSourceNode
   * ChannelMergerNode
   * OscillatorNode
   * GainNode
   * BiquadFilterNode
   * PeriodicWaveNode
   * BufferSourceNode
   * ChannelSplitterNode
   * ChannelMergerNode
   * DelayNode
   * DynamicsCompressorNode
   * ScriptProcessorNode
   * PannerNode
   * AnalyserNode */
  interface WebAudioContextNode {
    /** 表示监听器的前向系统在同一笛卡尔坐标系中的水平位置，作为位置（位置x，位置和位置和位置）值。 */
    forwardX: number;
    /** 表示听众的前向方向在同一笛卡尔坐标系中作为位置（位置x，位置和位置和位置）值的垂直位置。 */
    forwardY: number;
    /** 表示与position (positionX、positionY和positionZ)值在同一笛卡尔坐标系下的听者前进方向的纵向(前后)位置。 */
    forwardZ: number;
    /** 右手笛卡尔坐标系中X轴的位置。 */
    positionX: number;
    /** 右手笛卡尔坐标系中Y轴的位置。 */
    positionY: number;
    /** 右手笛卡尔坐标系中Z轴的位置。 */
    positionZ: number;
    /** 设置监听器的方向 */
    setOrientation: (...args: any[]) => any;
    /** 设置监听器的位置
     *
     * /** */
    setPosition: (...args: any[]) => any;
    /** 表示在与position (positionX、positionY和positionZ)值相同的笛卡尔坐标系中侦听器向前方向的水平位置。 */
    upX: number;
    /** 表示在与position (positionX、positionY和positionZ)值相同的笛卡尔坐标系中侦听器向上方向的水平位置。 */
    upY: number;
    /** 表示在与position (positionX、positionY和positionZ)值相同的笛卡尔坐标系中侦听器向后方向的水平位置。 */
    upZ: number;
  }
  /** 提供预设的 Wi-Fi 信息列表 */
  interface WifiData {
    /** Wi-Fi 的 BSSID */
    BSSID?: string;
    /** Wi-Fi 的 SSID */
    SSID?: string;
    /** Wi-Fi 设备密码 */
    password?: string;
  }
  /** Wifi 信息
   *
   * **注意**
   *
   * - 安卓 wx.connectWifi / wx.getConnectedWifi 若设置了 partialInfo:true ，或者调用了 wx.onWifiConnectedWithPartialInfo 事件。将会返回只包含 SSID 属性的 WifiInfo 对象。
   * - iOS wx.getConnectedWifi 若设置了 partialInfo:true ，将会返回只包含 SSID、BSSID 属性的 WifiInfo 对象，且需要用户开启微信定位权限才能正确返回结果。
   * - 在某些情况下，可能 Wi-Fi 已经连接成功，但会因为获取不到完整的 WifiInfo 对象报错。具体错误信息为 errCode: 12010, errMsg: can't gain current wifi 或 no wifi is connected 。如果开发者不需要完整的 WifiInfo 对象，则可以通过采取上述策略解决报错问题。 */
  interface WifiInfo {
    /** Wi-Fi 的 BSSID */
    BSSID: string;
    /** Wi-Fi 的 SSID */
    SSID: string;
    /** 需要基础库： `2.12.0`
     *
     * Wi-Fi 频段单位 MHz */
    frequency: number;
    /** Wi-Fi 是否安全 */
    secure: boolean;
    /** Wi-Fi 信号强度, 安卓取值 0 ～ 100 ，iOS 取值 0 ～ 1 ，值越大强度越大 */
    signalStrength: number;
  }
  interface WindowInfo {
    /** 设备像素比 */
    pixelRatio: number;
    /** 在竖屏正方向下的安全区域。部分机型没有安全区域概念，也不会返回 safeArea 字段，开发者需自行兼容。 */
    safeArea: SafeArea;
    /** 屏幕高度，单位px */
    screenHeight: number;
    /** 窗口上边缘的y值 */
    screenTop: number;
    /** 屏幕宽度，单位px */
    screenWidth: number;
    /** 状态栏的高度，单位px */
    statusBarHeight: number;
    /** 可使用窗口高度，单位px */
    windowHeight: number;
    /** 可使用窗口宽度，单位px */
    windowWidth: number;
  }
  /** Worker 实例，主线程中可通过 [wx.createWorker](https://developers.weixin.qq.com/miniprogram/dev/api/worker/wx.createWorker.html) 接口获取，worker 线程中可通过全局变量 `worker` 获取。
*
* **示例代码**
*
* 运行以下代码需先进行基础配置，详细请查阅 [小程序多线程](https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html) | [小游戏多线程](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/worker.html) 文档了解基础知识和配置方法。
*
* ```js
const worker = wx.createWorker('workers/request/index.js') // 文件名指定 worker 的入口文件路径，绝对路径

worker.onMessage(function (res) {
  console.log(res)
})
// 监听worker被系统回收事件
worker.onProcessKilled(function () {
  console.log('worker has been killed')
  // 重新创建一个worker
  // wx.createWorker()
})

worker.postMessage({
  msg: 'hello worker'
})

worker.terminate()
``` */
  interface Worker {
    /** worker内的环境变量 */
    env: WorkerEnv;
  }
  /** worker内的环境变量 */
  interface WorkerEnv {
    /** 文件系统中的用户目录路径 (本地路径) */
    USER_DATA_PATH: string;
  }
  interface WorkerOnMessageListenerResult {
    /** 主线程/Worker 线程向当前线程发送的消息 */
    message: IAnyObject;
  }
  /** Easing 模块实现了常见的动画缓动函数（动画效果参考 https://easings.net/ ），可从 [wx.worklet](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/wx.worklet.html) 对象中读取。
*
* ****
*
* ## 示例代码
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/f94TCOmg7JFH)
*
* ### 预置动画函数
*
* * [Easing.bounce](#Easing.bounce) 反弹动画
* * [Easing.ease](#Easing.ease) 惯性动画
* * [Easing.elastic](#Easing.elastic) 弹性动画
*
* ### 标准缓动函数
*
* * [Easing.linear](#Easing.linear) 线性
* * [Easing.quad](#Easing.quad) 二次方
* * [Easing.cubic](#Easing.cubic) 三次方
* * [Easing.poly](#Easing.poly) 实现其它幂函数
*
* ### 其它数学函数
*
* * [Easing.bezier](#Easing.bezier) 三次贝塞尔曲线
* * [Easing.circle](#Easing.circle) 圆形曲线
* * [Easing.sin](#Easing.sin) 正弦函数
* * [Easing.exp](#Easing.exp) 指数函数
*
* ### 缓动方式
*
* 以上效果均有三种缓动方式
*
* * [Easing.in](#in) 正向执行缓动函数
* * [Easing.out](#out) 反向执行缓动函数
* * [Easing.inOut](#inout) 前半程正向，后半程反向
* 以 `sin` 函数为例，其中 `Easing.in(Easing.sin)` 和直接使用 `Easing.sin` 效果相同。
*
* 1. `Easing.in(Easing.sin)` 动画效果参考 https://easings.net/#easeInSine
* 2. `Easing.out(Easing.sin)` 动画效果参考 https://easings.net/#easeOutSine
* 3. `Easing.inOut(Easing.sin)` 动画效果参考 https://easings.net/#easeInOutSine
*
* ### Easing.bounce
*
* 简单的反弹效果，[动画效果参考](https://easings.net/#easeInBounce)
*
* ```js
Easing.bounce(t)
```
*
* ### Easing.ease
*
* 简单的惯性动画，[动画效果参考](https://cubic-bezier.com/#.42,0,1,1)
*
* ```js
Easing.ease(t)
```
*
* ### Easing.elastic
*
* 简单的弹性动画，类似弹簧来回摆动，高阶函数。默认弹性为 1，会稍微超出一次。弹性为 0 时 不会过冲。[动画效果参考](https://easings.net/#easeInElastic)
*
* ```js
Easing.elastic(bounciness = 1)
```
*
* ### Easing.linear
*
* 线性函数，f(t) = t，[动画效果参考](https://cubic-bezier.com/#0,0,1,1)
*
* ```js
Easing.linear(t)
```
* ### Easing.quad
*
* 二次方函数，f(t) = t * t，[动画效果参考](https://easings.net/#easeInQuad)
*
* ```js
Easing.quad(t)
```
*
* ### Easing.cubic
*
* 立方函数，f(t) = t * t * t，[动画效果参考](https://easings.net/#easeInCubic)
*
* ```js
Easing.cubic(t)
```
*
* ### Easing.poly
*
* 高阶函数，返回幂函数
*
* poly(4): [动画效果参考](https://easings.net/#easeInQuart)
*
* poly(5): [动画效果参考](https://easings.net/#easeInQuint)
*
* ```js
Easing.poly(n)
```
*
* ### Easing.bezier
*
* 三次贝塞尔曲线，效果同 css `transition-timing-function`
*
* 调试参数可借助 [可视化工具](https://cubic-bezier.com/)
*
* ```js
Easing.bezier(x1, y1, x2, y2)
```
*
* ### Easing.circle
*
* 圆形曲线，[动画效果参考](https://easings.net/#easeInCirc)
*
* ```js
Easing.circle(t)
```
*
* ### Easing.sin
*
* 正弦函数，[动画效果参考](https://easings.net/#easeInSine)
*
* ```js
Easing.sin(t)
```
*
* ### Easing.exp
*
* 指数函数，[动画效果参考](https://easings.net/#easeInExpo)
*
* ```js
Easing.exp(t)
```
*
* ### Easing.in
*
* 正向运行 `easing function`，高阶函数。
*
* ```js
Easing.in(easing)
```
*
* ### Easing.out
*
* 反向运行 `easing function`，高阶函数。
*
* ```js
Easing.out(easing)
```
*
* ### Easing.inOut
*
* 前半程正向，后半程反向，高阶函数。
*
* ```js
Easing.inOut(easing)
``` */
  interface WorkletEasing {}
  interface WriteBLECharacteristicValueOption {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 蓝牙设备 id */
    deviceId: string;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** 蓝牙设备特征对应的二进制值 */
    value: ArrayBuffer;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: WriteBLECharacteristicValueCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: WriteBLECharacteristicValueFailCallback;
    /** 接口调用成功的回调函数 */
    success?: WriteBLECharacteristicValueSuccessCallback;
    /** 蓝牙特征值的写模式设置，有两种模式，iOS 优先 write，安卓优先 writeNoResponse 。（基础库 2.22.0 开始支持）
     *
     * 可选值：
     * - 'write': 强制回复写，不支持时报错;
     * - 'writeNoResponse': 强制无回复写，不支持时报错; */
    writeType?: 'write' | 'writeNoResponse';
  }
  interface WriteCharacteristicValueObject {
    /** 蓝牙特征的 UUID */
    characteristicId: string;
    /** 是否需要通知主机 value 已更新 */
    needNotify: boolean;
    /** 蓝牙特征对应服务的 UUID */
    serviceId: string;
    /** characteristic 对应的二进制值 */
    value: ArrayBuffer;
    /** 可选，处理回包时使用 */
    callbackId?: number;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: WriteCharacteristicValueCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: WriteCharacteristicValueFailCallback;
    /** 接口调用成功的回调函数 */
    success?: WriteCharacteristicValueSuccessCallback;
  }
  interface WriteFileOption {
    /** 要写入的文本或二进制数据 */
    data: string | ArrayBuffer;
    /** 要写入的文件路径 (本地路径) */
    filePath: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: WriteFileCompleteCallback;
    /** 指定写入文件的字符编码
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': （注意，选择 base64 编码，data 只需要传 base64 内容本身，不要传 Data URI 前缀，否则会报 fail base64 encode error 错误。例如，传 aGVsbG8= 而不是传 data:image/png;base64,aGVsbG8= ）;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 接口调用失败的回调函数 */
    fail?: WriteFileFailCallback;
    /** 接口调用成功的回调函数 */
    success?: WriteFileSuccessCallback;
  }
  interface WriteNdefMessageOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: WriteNdefMessageCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: WriteNdefMessageFailCallback;
    /** 二进制对象数组, 需要指明 id, type 以及 payload (均为 ArrayBuffer 类型) */
    records?: any[];
    /** 接口调用成功的回调函数 */
    success?: WriteNdefMessageSuccessCallback;
    /** text 数组 */
    texts?: any[];
    /** uri 数组 */
    uris?: any[];
  }
  interface WriteOption {
    /** 写入的内容，类型为 String 或 ArrayBuffer */
    data: string | ArrayBuffer;
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: WriteCompleteCallback;
    /** 只在 data 类型是 String 时有效，指定写入文件的字符编码，默认为 utf8
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 接口调用失败的回调函数 */
    fail?: WriteFailCallback;
    /** 只在 data 类型是 ArrayBuffer 时有效，指定要写入的字节数，默认为 arrayBuffer 从0开始偏移 offset 个字节后剩余的字节数 */
    length?: number;
    /** 只在 data 类型是 ArrayBuffer 时有效，决定 arrayBuffe 中要被写入的部位，即 arrayBuffer 中的索引，默认0 */
    offset?: number;
    /** 指定文件开头的偏移量，即数据要被写入的位置。当 position 不传或者传入非 Number 类型的值时，数据会被写入当前指针所在位置。 */
    position?: number;
    /** 接口调用成功的回调函数 */
    success?: WriteSuccessCallback;
  }
  /** 文件写入结果。 通过 [FileSystemManager.writeSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.writeSync.html) 接口返回 */
  interface WriteResult {
    /** 实际被写入到文件中的字节数（注意，被写入的字节数不一定与被写入的字符串字符数相同） */
    bytesWritten: number;
  }
  interface WriteSuccessCallbackResult {
    /** 实际被写入到文件中的字节数（注意，被写入的字节数不一定与被写入的字符串字符数相同） */
    bytesWritten: number;
    errMsg: string;
  }
  interface WriteSyncOption {
    /** 写入的内容，类型为 String 或 ArrayBuffer */
    data: string | ArrayBuffer;
    /** 文件描述符。fd 通过 [FileSystemManager.open](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html) 或 [FileSystemManager.openSync](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html) 接口获得 */
    fd: string;
    /** 只在 data 类型是 String 时有效，指定写入文件的字符编码，默认为 utf8
     *
     * 可选值：
     * - 'ascii': ;
     * - 'base64': ;
     * - 'binary': ;
     * - 'hex': ;
     * - 'ucs2': 以小端序读取;
     * - 'ucs-2': 以小端序读取;
     * - 'utf16le': 以小端序读取;
     * - 'utf-16le': 以小端序读取;
     * - 'utf-8': ;
     * - 'utf8': ;
     * - 'latin1': ; */
    encoding?:
      | 'ascii'
      | 'base64'
      | 'binary'
      | 'hex'
      | 'ucs2'
      | 'ucs-2'
      | 'utf16le'
      | 'utf-16le'
      | 'utf-8'
      | 'utf8'
      | 'latin1';
    /** 只在 data 类型是 ArrayBuffer 时有效，指定要写入的字节数，默认为 arrayBuffer 从0开始偏移 offset 个字节后剩余的字节数 */
    length?: number;
    /** 只在 data 类型是 ArrayBuffer 时有效，决定 arrayBuffe 中要被写入的部位，即 arrayBuffer 中的索引，默认0 */
    offset?: number;
    /** 指定文件开头的偏移量，即数据要被写入的位置。当 position 不传或者传入非 Number 类型的值时，数据会被写入当前指针所在位置。 */
    position?: number;
  }
  interface WxStartRecordOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StartRecordCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StartRecordFailCallback;
    /** 接口调用成功的回调函数 */
    success?: WxStartRecordSuccessCallback;
  }
  interface WxStopRecordOption {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: StopRecordCompleteCallback;
    /** 接口调用失败的回调函数 */
    fail?: StopRecordFailCallback;
    /** 接口调用成功的回调函数 */
    success?: WxStopRecordSuccessCallback;
  }
  /** 运动数据列表 */
  interface WxaSportRecord {
    /** 消耗卡路里 */
    calorie: number;
    /** 运动距离 */
    distance: number;
    /** 运动时长 */
    time: number;
    /** 运动项目id */
    typeId: number;
  }
  /** 帧纹理对象 */
  interface YUVTextureRes {
    /** UV 分量纹理 */
    uvTexture: WebGLTexture;
    /** Y 分量纹理 */
    yTexture: WebGLTexture;
  }
  /** 文件路径 */
  interface ZipFileItem {
    /** 文件内容 */
    data: string | ArrayBuffer;
    /** 错误信息 */
    errMsg: string;
  }
  interface Animation {
    /** [Object Animation.export()](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.export.html)
     *
     * 在插件中使用：支持
     *
     * 导出动画队列。**export 方法每次调用后会清掉之前的动画操作。** */
    export(): AnimationExportResult;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.backgroundColor(string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.backgroundColor.html)
     *
     * 在插件中使用：支持
     *
     * 设置背景色 */
    backgroundColor(
      /** 颜色值 */
      value: string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.bottom(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.bottom.html)
     *
     * 在插件中使用：支持
     *
     * 设置 bottom 值 */
    bottom(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.height(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.height.html)
     *
     * 在插件中使用：支持
     *
     * 设置高度 */
    height(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.left(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.left.html)
     *
     * 在插件中使用：支持
     *
     * 设置 left 值 */
    left(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.matrix()](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.matrix.html)
     *
     * 在插件中使用：支持
     *
     * 同 [transform-function matrix](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix) */
    matrix(): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.matrix3d()](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.matrix3d.html)
     *
     * 在插件中使用：支持
     *
     * 同 [transform-function matrix3d](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix3d) */
    matrix3d(): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.opacity(number value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.opacity.html)
     *
     * 在插件中使用：支持
     *
     * 设置透明度 */
    opacity(
      /** 透明度，范围 0-1 */
      value: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.right(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.right.html)
     *
     * 在插件中使用：支持
     *
     * 设置 right 值 */
    right(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.rotate(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.rotate.html)
     *
     * 在插件中使用：支持
     *
     * 从原点顺时针旋转一个角度 */
    rotate(
      /** 旋转的角度。范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.rotate3d(number x, number y, number z, number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.rotate3d.html)
     *
     * 在插件中使用：支持
     *
     * 从 固定 轴顺时针旋转一个角度 */
    rotate3d(
      /** 旋转轴的 x 坐标 */
      x: number,
      /** 旋转轴的 y 坐标 */
      y: number,
      /** 旋转轴的 z 坐标 */
      z: number,
      /** 旋转的角度。范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.rotateX(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.rotateX.html)
     *
     * 在插件中使用：支持
     *
     * 从 X 轴顺时针旋转一个角度 */
    rotateX(
      /** 旋转的角度。范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.rotateY(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.rotateY.html)
     *
     * 在插件中使用：支持
     *
     * 从 Y 轴顺时针旋转一个角度 */
    rotateY(
      /** 旋转的角度。范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.rotateZ(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.rotateZ.html)
     *
     * 在插件中使用：支持
     *
     * 从 Z 轴顺时针旋转一个角度 */
    rotateZ(
      /** 旋转的角度。范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.scale(number sx, number sy)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.scale.html)
     *
     * 在插件中使用：支持
     *
     * 缩放 */
    scale(
      /** 当仅有 sx 参数时，表示在 X 轴、Y 轴同时缩放sx倍数 */
      sx: number,
      /** 在 Y 轴缩放 sy 倍数 */
      sy?: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.scale3d(number sx, number sy, number sz)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.scale3d.html)
     *
     * 在插件中使用：支持
     *
     * 缩放 */
    scale3d(
      /** x 轴的缩放倍数 */
      sx: number,
      /** y 轴的缩放倍数 */
      sy: number,
      /** z 轴的缩放倍数 */
      sz: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.scaleX(number scale)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.scaleX.html)
     *
     * 在插件中使用：支持
     *
     * 缩放 X 轴 */
    scaleX(
      /** X 轴的缩放倍数 */
      scale: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.scaleY(number scale)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.scaleY.html)
     *
     * 在插件中使用：支持
     *
     * 缩放 Y 轴 */
    scaleY(
      /** Y 轴的缩放倍数 */
      scale: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.scaleZ(number scale)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.scaleZ.html)
     *
     * 在插件中使用：支持
     *
     * 缩放 Z 轴 */
    scaleZ(
      /** Z 轴的缩放倍数 */
      scale: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.skew(number ax, number ay)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.skew.html)
     *
     * 在插件中使用：支持
     *
     * 对 X、Y 轴坐标进行倾斜 */
    skew(
      /** 对 X 轴坐标倾斜的角度，范围 [-180, 180] */
      ax: number,
      /** 对 Y 轴坐标倾斜的角度，范围 [-180, 180] */
      ay: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.skewX(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.skewX.html)
     *
     * 在插件中使用：支持
     *
     * 对 X 轴坐标进行倾斜 */
    skewX(
      /** 倾斜的角度，范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.skewY(number angle)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.skewY.html)
     *
     * 在插件中使用：支持
     *
     * 对 Y 轴坐标进行倾斜 */
    skewY(
      /** 倾斜的角度，范围 [-180, 180] */
      angle: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.step(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.step.html)
     *
     * 在插件中使用：支持
     *
     * 表示一组动画完成。可以在一组动画中调用任意多个动画方法，一组动画中的所有动画会同时开始，一组动画完成后才会进行下一组动画。 */
    step(option?: StepOption): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.top(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.top.html)
     *
     * 在插件中使用：支持
     *
     * 设置 top 值 */
    top(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.translate(number tx, number ty)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.translate.html)
     *
     * 在插件中使用：支持
     *
     * 平移变换 */
    translate(
      /** 当仅有该参数时表示在 X 轴偏移 tx，单位 px */
      tx?: number,
      /** 在 Y 轴平移的距离，单位为 px */
      ty?: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.translate3d(number tx, number ty, number tz)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.translate3d.html)
     *
     * 在插件中使用：支持
     *
     * 对 xyz 坐标进行平移变换 */
    translate3d(
      /** 在 X 轴平移的距离，单位为 px */
      tx?: number,
      /** 在 Y 轴平移的距离，单位为 px */
      ty?: number,
      /** 在 Z 轴平移的距离，单位为 px */
      tz?: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.translateX(number translation)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.translateX.html)
     *
     * 在插件中使用：支持
     *
     * 对 X 轴平移 */
    translateX(
      /** 在 X 轴平移的距离，单位为 px */
      translation: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.translateY(number translation)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.translateY.html)
     *
     * 在插件中使用：支持
     *
     * 对 Y 轴平移 */
    translateY(
      /** 在 Y 轴平移的距离，单位为 px */
      translation: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.translateZ(number translation)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.translateZ.html)
     *
     * 在插件中使用：支持
     *
     * 对 Z 轴平移 */
    translateZ(
      /** 在 Z 轴平移的距离，单位为 px */
      translation: number
    ): Animation;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) Animation.width(number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.width.html)
     *
     * 在插件中使用：支持
     *
     * 设置宽度 */
    width(
      /** 长度值，如果传入 number 则默认使用 px，可传入其他自定义单位的长度值 */
      value: number | string
    ): Animation;
  }
  interface AudioBuffer {
    /** [AudioBuffer.copyFromChannel()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioBuffer.copyFromChannel.html)
     *
     * 在插件中使用：不支持
     *
     * 从AudioBuffer的指定频道复制到数组终端。 */
    copyFromChannel(): void;
    /** [AudioBuffer.copyToChannel(Float32Array source, number channelNumber, number startInChannel)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioBuffer.copyToChannel.html)
     *
     * 在插件中使用：不支持
     *
     * 从指定数组复制样本到audioBuffer的特定通道
     *
     * **示例代码**
     *
     * 示例代码参考AudioBuffer.copyFromChannel */
    copyToChannel(
      /** 需要复制的源数组 */
      source: Float32Array,
      /** 需要复制到的目的通道号 */
      channelNumber: number,
      /** 复制偏移数据量 */
      startInChannel: number
    ): void;
    /** [Float32Array AudioBuffer.getChannelData(number channel)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioBuffer.getChannelData.html)
     *
     * 在插件中使用：不支持
     *
     * 返回一个 Float32Array，包含了带有频道的PCM数据，由频道参数定义（有0代表第一个频道） */
    getChannelData(
      /** 要获取特定通道数据的索引 */
      channel: number
    ): Float32Array;
  }
  interface AudioContext {
    /** [AudioContext.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.pause.html)
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
     *
     * 暂停音频。 */
    pause(): void;
    /** [AudioContext.play()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.play.html)
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
     *
     * 播放音频。 */
    play(): void;
    /** [AudioContext.seek(number position)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.seek.html)
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
     *
     * 跳转到指定位置。 */
    seek(
      /** 跳转位置，单位 s */
      position: number
    ): void;
    /** [AudioContext.setSrc(string src)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.setSrc.html)
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
     *
     * 设置音频地址 */
    setSrc(
      /** 音频地址 */
      src: string
    ): void;
  }
  interface BLEPeripheralServer {
    /** [BLEPeripheralServer.addService(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.addService.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 添加服务。 */
    addService(option: AddServiceOption): void;
    /** [BLEPeripheralServer.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.close.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 关闭当前服务端。 */
    close(option?: BLEPeripheralServerCloseOption): void;
    /** [BLEPeripheralServer.offCharacteristicReadRequest(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.offCharacteristicReadRequest.html)
*
* 需要基础库： `2.10.3`
*
* 在插件中使用：不支持
*
* 移除已连接的设备请求读当前外围设备的特征值事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

BLEPeripheralServer.onCharacteristicReadRequest(listener)
BLEPeripheralServer.offCharacteristicReadRequest(listener) // 需传入与监听时同一个的函数对象
``` */
    offCharacteristicReadRequest(
      /** onCharacteristicReadRequest 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCharacteristicReadRequestCallback
    ): void;
    /** [BLEPeripheralServer.offCharacteristicSubscribed(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.offCharacteristicSubscribed.html)
*
* 需要基础库： `2.13.0`
*
* 在插件中使用：不支持
*
* 移除特征订阅事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

BLEPeripheralServer.onCharacteristicSubscribed(listener)
BLEPeripheralServer.offCharacteristicSubscribed(listener) // 需传入与监听时同一个的函数对象
``` */
    offCharacteristicSubscribed(
      /** onCharacteristicSubscribed 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCharacteristicSubscribedCallback
    ): void;
    /** [BLEPeripheralServer.offCharacteristicUnsubscribed(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.offCharacteristicUnsubscribed.html)
*
* 需要基础库： `2.13.0`
*
* 在插件中使用：不支持
*
* 移除取消特征订阅事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

BLEPeripheralServer.onCharacteristicUnsubscribed(listener)
BLEPeripheralServer.offCharacteristicUnsubscribed(listener) // 需传入与监听时同一个的函数对象
``` */
    offCharacteristicUnsubscribed(
      /** onCharacteristicUnsubscribed 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCharacteristicUnsubscribedCallback
    ): void;
    /** [BLEPeripheralServer.offCharacteristicWriteRequest(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.offCharacteristicWriteRequest.html)
*
* 需要基础库： `2.10.3`
*
* 在插件中使用：不支持
*
* 移除已连接的设备请求写当前外围设备的特征值事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

BLEPeripheralServer.onCharacteristicWriteRequest(listener)
BLEPeripheralServer.offCharacteristicWriteRequest(listener) // 需传入与监听时同一个的函数对象
``` */
    offCharacteristicWriteRequest(
      /** onCharacteristicWriteRequest 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCharacteristicWriteRequestCallback
    ): void;
    /** [BLEPeripheralServer.onCharacteristicReadRequest(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.onCharacteristicReadRequest.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 监听已连接的设备请求读当前外围设备的特征值事件。收到该消息后需要立刻调用 [writeCharacteristicValue](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.writeCharacteristicValue.html) 写回数据，否则主机不会收到响应。 */
    onCharacteristicReadRequest(
      /** 已连接的设备请求读当前外围设备的特征值事件的监听函数 */
      listener: OnCharacteristicReadRequestCallback
    ): void;
    /** [BLEPeripheralServer.onCharacteristicSubscribed(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.onCharacteristicSubscribed.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：不支持
     *
     * 监听特征订阅事件，仅 iOS 支持。 */
    onCharacteristicSubscribed(
      /** 特征订阅事件的监听函数 */
      listener: OnCharacteristicSubscribedCallback
    ): void;
    /** [BLEPeripheralServer.onCharacteristicUnsubscribed(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.onCharacteristicUnsubscribed.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：不支持
     *
     * 监听取消特征订阅事件，仅 iOS 支持。 */
    onCharacteristicUnsubscribed(
      /** 取消特征订阅事件的监听函数 */
      listener: OnCharacteristicUnsubscribedCallback
    ): void;
    /** [BLEPeripheralServer.onCharacteristicWriteRequest(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.onCharacteristicWriteRequest.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 监听已连接的设备请求写当前外围设备的特征值事件。收到该消息后需要立刻调用 [writeCharacteristicValue](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.writeCharacteristicValue.html) 写回数据，否则主机不会收到响应。 */
    onCharacteristicWriteRequest(
      /** 已连接的设备请求写当前外围设备的特征值事件的监听函数 */
      listener: OnCharacteristicWriteRequestCallback
    ): void;
    /** [BLEPeripheralServer.removeService(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.removeService.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 移除服务。 */
    removeService(option: RemoveServiceOption): void;
    /** [BLEPeripheralServer.startAdvertising(Object Object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.startAdvertising.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 开始广播本地创建的外围设备。
     *
     * **注意**
     *
     * - Android 8.0.9 开始，支持直接使用 16/32/128 位 UUID；
     * - Android 8.0.9 以下版本只支持 128 位 UUID，使用 16/32 位的 UUID 时需要进行补位（系统会自动识别是否属于预分配区间），可以参考[蓝牙指南](https://developers.weixin.qq.com/miniprogram/dev/framework/device/ble.html)；
     * - iOS 必须直接使用 16 位的 UUID，不能补位到 128 位，否则系统组包时仍会按照 128 位传输。iOS 暂不支持 32 位 UUID。
     * - iOS 同时只能发起一个广播，安卓支持同时发起多个广播。
     * - 传 beacon 参数时，不能同时传入 deviceName，serviceUuids，manufacturerData 参数。 */
    startAdvertising(Object: StartAdvertisingObject): void;
    /** [BLEPeripheralServer.stopAdvertising(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.stopAdvertising.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 停止广播。 */
    stopAdvertising(option?: StopAdvertisingOption): void;
    /** [BLEPeripheralServer.writeCharacteristicValue(Object Object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/BLEPeripheralServer.writeCharacteristicValue.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：不支持
     *
     * 往指定特征写入二进制数据值，并通知已连接的主机，从机的特征值已发生变化，该接口会处理是走回包还是走订阅。 */
    writeCharacteristicValue(Object: WriteCharacteristicValueObject): void;
  }
  interface BackgroundAudioError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 10001 |  | 系统错误 |
     * | 10002 |  | 网络错误 |
     * | 10003 |  | 文件错误，请检查是否responseheader是否缺少Content-Length |
     * | 10004 |  | 格式错误 |
     * | -1 |  | 未知错误 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 10001 |  | 系统错误 |
     * | 10002 |  | 网络错误 |
     * | 10003 |  | 文件错误，请检查是否responseheader是否缺少Content-Length |
     * | 10004 |  | 格式错误 |
     * | -1 |  | 未知错误 | */ errCode: number;
  }
  interface BackgroundAudioManager {
    /** [BackgroundAudioManager.onCanplay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onCanplay.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频进入可播放状态事件。 但不保证后面可以流畅播放 */
    onCanplay(
      /** 背景音频进入可播放状态事件的监听函数 */
      listener: OnCanplayCallback
    ): void;
    /** [BackgroundAudioManager.onEnded(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onEnded.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频自然播放结束事件 */
    onEnded(
      /** 背景音频自然播放结束事件的监听函数 */
      listener: OnEndedCallback
    ): void;
    /** [BackgroundAudioManager.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onError.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频播放错误事件 */
    onError(
      /** 背景音频播放错误事件的监听函数 */
      listener: BackgroundAudioManagerOnErrorCallback
    ): void;
    /** [BackgroundAudioManager.onNext(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onNext.html)
     *
     * 在插件中使用：支持
     *
     * 监听用户在系统音乐播放面板点击下一曲事件（仅iOS） */
    onNext(
      /** 用户在系统音乐播放面板点击下一曲事件的监听函数 */
      listener: OnNextCallback
    ): void;
    /** [BackgroundAudioManager.onPause(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onPause.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频暂停事件 */
    onPause(
      /** 背景音频暂停事件的监听函数 */
      listener: OnPauseCallback
    ): void;
    /** [BackgroundAudioManager.onPlay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onPlay.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频播放事件 */
    onPlay(
      /** 背景音频播放事件的监听函数 */
      listener: OnPlayCallback
    ): void;
    /** [BackgroundAudioManager.onPrev(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onPrev.html)
     *
     * 在插件中使用：支持
     *
     * 监听用户在系统音乐播放面板点击上一曲事件（仅iOS） */
    onPrev(
      /** 用户在系统音乐播放面板点击上一曲事件的监听函数 */
      listener: OnPrevCallback
    ): void;
    /** [BackgroundAudioManager.onSeeked(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onSeeked.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频完成跳转操作事件 */
    onSeeked(
      /** 背景音频完成跳转操作事件的监听函数 */
      listener: OnSeekedCallback
    ): void;
    /** [BackgroundAudioManager.onSeeking(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onSeeking.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频开始跳转操作事件 */
    onSeeking(
      /** 背景音频开始跳转操作事件的监听函数 */
      listener: OnSeekingCallback
    ): void;
    /** [BackgroundAudioManager.onStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onStop.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频停止事件 */
    onStop(
      /** 背景音频停止事件的监听函数 */
      listener: InnerAudioContextOnStopCallback
    ): void;
    /** [BackgroundAudioManager.onTimeUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onTimeUpdate.html)
     *
     * 在插件中使用：支持
     *
     * 监听背景音频播放进度更新事件，只有小程序在前台时会回调。 */
    onTimeUpdate(
      /** 背景音频播放进度更新事件的监听函数 */
      listener: OnTimeUpdateCallback
    ): void;
    /** [BackgroundAudioManager.onWaiting(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.onWaiting.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频加载中事件。当音频因为数据不足，需要停下来加载时会触发 */
    onWaiting(
      /** 音频加载中事件的监听函数 */
      listener: OnWaitingCallback
    ): void;
    /** [BackgroundAudioManager.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.pause.html)
     *
     * 在插件中使用：支持
     *
     * 暂停音乐 */
    pause(): void;
    /** [BackgroundAudioManager.play()](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.play.html)
     *
     * 在插件中使用：支持
     *
     * 播放音乐 */
    play(): void;
    /** [BackgroundAudioManager.seek(number currentTime)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.seek.html)
     *
     * 在插件中使用：支持
     *
     * 跳转到指定位置 */
    seek(
      /** 跳转的位置，单位 s。精确到小数点后 3 位，即支持 ms 级别精确度 */
      currentTime: number
    ): void;
    /** [BackgroundAudioManager.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止音乐 */
    stop(): void;
  }
  interface BeaconError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 11000 | unsupport | 系统或设备不支持 |
     * | 11001 | bluetooth service unavailable | 蓝牙服务不可用 |
     * | 11002 | location service unavailable | 位置服务不可用 |
     * | 11003 | already start | 已经开始搜索 |
     * | 11004 | not startBeaconDiscovery | 还未开始搜索 |
     * | 11005 | system error | 系统错误 |
     * | 11006 | invalid data | 参数不正确 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 11000 | unsupport | 系统或设备不支持 |
     * | 11001 | bluetooth service unavailable | 蓝牙服务不可用 |
     * | 11002 | location service unavailable | 位置服务不可用 |
     * | 11003 | already start | 已经开始搜索 |
     * | 11004 | not startBeaconDiscovery | 还未开始搜索 |
     * | 11005 | system error | 系统错误 |
     * | 11006 | invalid data | 参数不正确 | */ errCode: number;
  }
  interface BluetoothError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | -1 | already connect | 已连接 |
     * | 10000 | not init | 未初始化蓝牙适配器 |
     * | 10001 | not available | 当前蓝牙适配器不可用 |
     * | 10002 | no device | 没有找到指定设备 |
     * | 10003 | connection fail | 连接失败 |
     * | 10004 | no service | 没有找到指定服务 |
     * | 10005 | no characteristic | 没有找到指定特征 |
     * | 10006 | no connection | 当前连接已断开 |
     * | 10007 | property not support | 当前特征不支持此操作 |
     * | 10008 | system error | 其余所有系统上报的异常 |
     * | 10009 | system not support | Android 系统特有，系统版本低于 4.3 不支持 BLE |
     * | 10012 | operate time out | 连接超时 |
     * | 10013 | invalid_data | 连接 deviceId 为空或者是格式不正确 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | -1 | already connect | 已连接 |
     * | 10000 | not init | 未初始化蓝牙适配器 |
     * | 10001 | not available | 当前蓝牙适配器不可用 |
     * | 10002 | no device | 没有找到指定设备 |
     * | 10003 | connection fail | 连接失败 |
     * | 10004 | no service | 没有找到指定服务 |
     * | 10005 | no characteristic | 没有找到指定特征 |
     * | 10006 | no connection | 当前连接已断开 |
     * | 10007 | property not support | 当前特征不支持此操作 |
     * | 10008 | system error | 其余所有系统上报的异常 |
     * | 10009 | system not support | Android 系统特有，系统版本低于 4.3 不支持 BLE |
     * | 10012 | operate time out | 连接超时 |
     * | 10013 | invalid_data | 连接 deviceId 为空或者是格式不正确 | */ errCode: number;
  }
  interface CacheManager {
    /** [Array.&lt;string&gt; CacheManager.addRules(Object rules)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.addRules.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 批量添加规则，规则写法可参考 [CacheManager.addRule](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.addRule.html)。 */
    addRules(
      /** 规则列表 */
      rules: IAnyObject
    ): string[];
    /** [CacheManager.clearCaches()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.clearCaches.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 清空所有缓存。 */
    clearCaches(): void;
    /** [CacheManager.clearRules()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.clearRules.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 清空所有规则，同时会删除对应规则下所有缓存。 */
    clearRules(): void;
    /** [CacheManager.deleteCache(string id)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.deleteCache.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 删除缓存。 */
    deleteCache(
      /** 缓存 id */
      id: string
    ): void;
    /** [CacheManager.deleteCaches(Array.&lt;string&gt; ids)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.deleteCaches.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 批量删除缓存。 */
    deleteCaches(
      /** 缓存 id 列表 */
      ids: string[]
    ): void;
    /** [CacheManager.deleteRule(string id)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.deleteRule.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 删除规则，同时会删除对应规则下所有缓存。 */
    deleteRule(
      /** 规则 id */
      id: string
    ): void;
    /** [CacheManager.deleteRules(Array.&lt;string&gt; ids)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.deleteRules.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 批量删除规则，同时会删除对应规则下所有缓存。 */
    deleteRules(
      /** 规则 id 列表 */
      ids: string[]
    ): void;
    /** [CacheManager.off(string eventName, function handler)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.off.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 取消事件监听。 */
    off(
      /** 事件名 */
      eventName: string,
      /** 事件句柄 */
      handler: (...args: any[]) => any
    ): void;
    /** [CacheManager.on(string eventName, function handler)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.on.html)
*
* 需要基础库： `2.24.0`
*
* 在插件中使用：不支持
*
* 监听事件。
*
* ****
*
* 这里 request 事件会提供 request 事件对象，用于做后续的处理；在 request 事件中需要返回一个 promise，用来生成 wx.request 请求的返回内容。
*
* #### 示例代码
*
* ```js
async function handler(evt) {
  // evt.url - 请求 url
  // evt.data - 请求参数
  // evt.method - 请求方法
  // evt.request - 原始 request 方法，返回一个 promise

  // if (evt.url === '/xxx') {
  //   // 如果有些请求仍然希望走到网络，则可以如下处理
  //   const res = await evt.request()
  //   // res 即为网络请求返回
  // }

  return new Promsie((resolve, reject) => {
    // do sth
    if (data) {
      // 这里 resolve 的 data 就会作为 wx.request 的 success 回调结果返回
      resolve(data)
    } else {
      // 这里 reject 的错误信息就会作为 wx.request 的 fail 回调结果返回
      reject('no data')
    }
  })
}
cacheManager.on('request', handler)
``` */
    on(
      /** 事件名
       *
       * 参数 eventName 可选值：
       * - 'request': 发生 wx.request 请求，只在缓存管理器开启阶段会触发;
       * - 'enterWeakNetwork': 进入弱网/离线状态;
       * - 'exitWeakNetwork': 离开弱网/离线状态; */
      eventName: 'request' | 'enterWeakNetwork' | 'exitWeakNetwork',
      /** 事件句柄 */
      handler: (...args: any[]) => any
    ): void;
    /** [CacheManager.start()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.start.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 开启缓存，仅在 mode 为 none 时生效，调用后缓存管理器的 state 会置为 1。 */
    start(): void;
    /** [CacheManager.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.stop.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 关闭缓存，仅在 mode 为 none 时生效，调用后缓存管理器的 state 会置为 0。 */
    stop(): void;
    /** [Object CacheManager.match(Object evt)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.match.html)
*
* 需要基础库： `2.24.0`
*
* 在插件中使用：不支持
*
* 匹配命中的缓存规则，一般需要和 request 事件搭配使用。
*
* **示例代码**
*
* ```js
function handler(evt) {
  const cache = cacheManager.match(evt)
  // 若有重复监听，则取第一个 handler 返回的 promise
  return new Promise((resolve, reject) => {
    if (cache.data) {
      resolve(cache.data)
    } else {
      reject('no cache')
    }
  })
}
cacheManager.on('request', handler)
``` */
    match(
      /** request 事件对象 */
      evt: IAnyObject
    ): MatchCache;
    /** [string CacheManager.addRule(Object rule)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.addRule.html)
*
* 需要基础库： `2.24.0`
*
* 在插件中使用：不支持
*
* 添加规则。
*
* **规则说明**
*
* 支持的规则写法有字符串、正则和对象三种：
*
* ### 字符串写法
*
* 1. `addRule('/abc')`：纯 uri 串。
* 2. `addRule('GET /abc')：带方法的 uri 串，除了匹配 uri 外，还会匹配请求方法。如例子中必须是 GET 方法请求才会被匹配。
* 3. `addRule('/abc/:id')：带可变部分的 uri 串，id 可以是任意符合标准的字符串，表示这一段可以动态变化。比如 `/abc/123` 和 `/abc/321` 都会被匹配，而 `/abc/123/xxx` 因为多了一段，就不会被匹配。
* 4. `addRule('/abc?aa')：带 query 参数的 uri 串，包含 aa 参数，值可以为任意值。比如 `/abc?aa=haha` 会被匹配，但是 `/abc` 就不会被匹配，因为缺少规则中声明的 aa 参数；不过如果请求是 `/abc?aa=haha&bb=123`，虽然多带了 bb 参数，但是因为包含了 aa 参数，所以也可以被匹配。
* 5. `addRule('/abc?dd=haha')：带 query 参数的 uri 串，包含 dd 参数且值为 haha。比如 `/abc?dd=haha` 和 `/abc?dd=haha&bb=123` 会被匹配，而 `/abc?dd=123` 就不会被匹配，因为规则要求了 dd 参数的值。
*
* > 以上写法中的 uri 串如果只有 path 部分，则会取全局 origin 进行补全。比如全局 origin 是 `https://weixin.qq.com`，而规则是 `/abc`，则会补全为 `https://weixin.qq.com/abc`。因此在前面例子中 `addRule('/abc')` 和 `addRule('https://weixin.qq.com/abc')` 的写法效果一致。所以一般情况下如果需要匹配的请求 origin 和全局 origin 一致，则规则中可忽略不写 orign。
*
* ### 正则写法
*
* 1. `addRule(/\/(abc|cba)$/ig)`：直接正则匹配请求的 uri，同时会比对请求 origin 和全局 origin 是否一致。
* 2. `addRule(/^https:\/\/weixin.qq.com\/(abc|cba)$/ig)`：带有 orign 部分的正则表达式，则只匹配 uri，不再比对 origin。
*
* ### 对象写法
*
* 使用规则对象，可以更为详细的描述规则内容。（一般使用规则对象，是为了匹配请求参数）
*
* #### 规则对象：
*
* | 属性名 | 类型 | 默认值 | 备注 |
* |---|---|---|---|
* | id | string | | 规则 id，如果不填则会由基础库生成 |
* | method | string | | 请求方法，可选值 GET/POST/PATCH/PUT/DELETE，如果为空则表示前面提到的所有方法都能被匹配到 |
* | url | any | 必填 | uri 匹配规则，可参考规则字符串写法和正则写法 |
* | maxAge | number | 7 * 24 * 60 * 60 * 1000 | 缓存有效时间，单位为 ms，不填则默认取缓存管理器全局的缓存有效时间 |
* | dataSchema | Array\<DataRule\> | | 匹配请求参数 |
*
* 其中，dataSchema 用来匹配对象类型的请求参数（比如 wx.request 的 data），默认可以不填，即不做参数匹配。
*
* dataSchema 的类型是一个 DataRule 对象数组，一个 DataRule 对象描述一个参数，比如一个 wx.request 请求的 data 是 `{a: 123, b: 'haha', c: true}`，你想要用一条规则来匹配其中的 a 和 b 参数，如果 a 是数字且 b 是字符串就能命中该规则，那么就需要在 dataSchema 中补充两个 DataRule 对象，即 `[{name: 'a', schema: {type: 'number'}}, {name: 'b', schema: {type: 'string'}}]`。
*
* #### DataRule 对象：
*
* | 属性名 | 类型 | 默认值 | 备注 |
* |---|---|---|---|
* | name | string | | 需要匹配的参数名 |
* | schema | DataSchema/Array\<DataSchema\> | 需要匹配的参数模式，支持数组，表示该参数值有多种模式 |
*
* name 表示要匹配的参数名，schema 为 DataSchema 对象，用来描述该参数的类型和值。
*
* 一个 DataRule 对象也可以匹配可能拥有多种类型的参数，所以 schema 也支持为 DataSchema 对象数组。比如上述例子中，希望匹配的 a 参数必须是数值或者字符串，那么可以这么写：`{name: 'a', schema: [{type: 'number'}, {type: 'string'}]}`。
*
* #### DataSchema 对象：
*
* | 属性名 | 类型 | 默认值 | 备注 |
* |---|---|---|---|
* | type | string | | 需要匹配的 data 对象的参数类型，string、number、boolean、null、object、any（表示任意类型），同时支持数组模式（数组模式则在类型后面加 []，如 string[] 表示字符串数组） |
* | value | string/regexp/function/Array\<DataRule\> | | 需要匹配的 data 对象的参数值，当 type 为基本类型时，可以用 string/regexp 来匹配固定的值，也可以通过 function 来确定值是否匹配，如果传入的 type 是 object，那么表示需要嵌套匹配值是否正确，可以传入 Array<DataRule> |
*
* type 参数表示要匹配的参数类型，value 表示要匹配的参数值。其中 value 支持多种写法，不同写法有如下匹配方式：
*
* 1. 字符串写法：直接判值的字符串形式是否和给定字符串一样，比如 value 值为 `123`，就要求参数值必须为 123 才能与之匹配。
* 2. 正则写法：直接判值的字符串形式是否能被正则匹配，比如 value 值为 `/\d+/ig`，就要求参数值必须为数字，如果参数值为 `abc` 则不会被匹配。
* 3. 函数写法：在匹配时会调用用户传入的函数，交由用户判断是否匹配。
* 4. DataRule 数组写法：当参数类型为对象时，那么字符串写法和正则写法就无法使用，需要传入 DataRule 数组来进行匹配，即通过嵌套 DataRule 数组的方式来匹配嵌套的对象。
*
* ### 示例代码
*
* ```js
const ruleId = cacheManager.addRule({
  id: 'haha-rule',
  method: 'GET',
  url: '/haha',
  maxAge: 123455,
  dataSchema: [
    // data 字段的匹配，默认为空，表示不匹配
    // 类型可以是：string、number、boolean、null、object、any（表示任意类型均可），以及这些类型的数组表示方式
    {name: 'aaa', schema: {type: 'string'}}, // 类型为 string
    {name: 'bbb', schema: [{type: 'number'}, {type: 'string'}]}, // 类型为 number, string
    {name: 'ccc', schema: {type: 'string', value: 'abc'}}, // 值为 abc
    {name: 'ddd', schema: {type: 'string', value: /(abc|cba)/ig}}, // 值符合该正则匹配，如果该值不是字符串类型，则会被尝试转成字符串后再进行比较
    {name: 'ddd', schema: {type: 'string', value: val => val === '123'}}, // 传入函数来校验值
    {name: 'eee', schema: {type: 'object', value: [{ // 类型为对象，则通过嵌套的方式来逐层校验
      name: 'aaa', schema: {type: 'string'},
      // ...
      // 嵌套 dataSchema，同上面的方式一样来匹配嵌套的对象
    }]}},
    {name: 'fff', schema: {type: 'string[]'}}, // 类型为 string 数组
    {name: 'ggg', schema: {type: 'any'}}, // 类型为任意类型
    {name: 'hhh', schema: {type: 'any[]'}}, // 类型为任意类型的数组
  }],
})
```
*
* ### 补充说明
*
* 用户可以添加多条规则，每条规则都会去解析网络请求，然后判断是否命中规则。假设有多条规则命中，则取第一条命中的规则。
*
* ### 缓存覆盖
*
* 不同的网络请求也可能命中同一条规则，所以每条规则可能对应多个缓存。每条规则会有一个规则 id，每个缓存会有一个缓存 id，一个规则 id 可能对应多个缓存 id，而缓存管理器的缓存存储是基于缓存 id 标识的，如果两个不同的请求生成了同样的缓存 id，那么后发生的请求结果缓存会覆盖前者。因此使用时需要思考缓存的覆盖情况，目前缓存 id 生成方式如下：
*
* 1. 规则使用字符串写法：那么按 method + url + 规则中声明的 query 参数来生成缓存 id。
*
* > 需要注意的是这里不使用真实请求中的 query 参数来生成缓存 id，而是使用规则中匹配到的 query 来生成缓存 id。比如规则是 `/abc?aa=123`，请求是 GET 方法的 `/abc?aa=123&bb=123`，那么就会基于 `GET /abc?aa=123` 来生成缓存 id。而规则里没有声明 `bb=123`，所以 bb 参数不会被纳入缓存 id 的生成基准。
*
* 2. 规则使用正则写法：那么只按 method + url 生成缓存 id，不考虑 query 参数。
* 3. 规则使用对象写法：如果规则对象中的 url 是字符串写法，那么按 method + url + 规则中声明的 query 参数 + 规则中 dataSchema 声明的请求参数来生成缓存 id；如果规则对象中的 url 是正则写法，那么按 method + url + 规则中 dataSchema 声明的请求参数来生成缓存 id。
*
* > 生成缓存 id 时没有使用请求中完整的 query 参数或者请求参数来作为基准，是考虑到很多请求可能会带上 token 或时间戳等参数。因为此参数存在不确定性，会导致每次请求生成的缓存 id 都不同，进而导致缓存命中率下降，故采取规则中声明的 query 参数和 dataSchema 声明的请求参数来作为生成缓存 id 的基准。 */
    addRule(
      /** 规则 */
      rule: IAnyObject
    ): string;
  }
  interface CameraContext {
    /** [CameraContext.setZoom(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.setZoom.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：支持
     *
     * 设置缩放级别 */
    setZoom(option: CameraContextSetZoomOption): void;
    /** [CameraContext.startRecord(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.startRecord.html)
     *
     * 在插件中使用：支持
     *
     * 开始录像 */
    startRecord(option: CameraContextStartRecordOption): void;
    /** [CameraContext.stopRecord(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.stopRecord.html)
     *
     * 在插件中使用：支持
     *
     * 结束录像 */
    stopRecord(option: CameraContextStopRecordOption): void;
    /** [CameraContext.takePhoto(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.takePhoto.html)
     *
     * 在插件中使用：支持
     *
     * 拍摄照片 */
    takePhoto(option: TakePhotoOption): void;
    /** [[CameraFrameListener](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraFrameListener.html) CameraContext.onCameraFrame(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.onCameraFrame.html)
*
* 需要基础库： `2.7.0`
*
* 在插件中使用：不支持
*
* 获取 Camera 实时帧数据
*
* ****
*
* 注： 使用该接口需同时在 [camera](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html) 组件属性中指定 frame-size。
*
* **示例代码**
*
* ```js
const context = wx.createCameraContext()
const listener = context.onCameraFrame((frame) => {
  console.log(frame.data instanceof ArrayBuffer, frame.width, frame.height)
})
listener.start()
``` */
    onCameraFrame(
      /** 回调函数 */
      callback: OnCameraFrameCallback
    ): CameraFrameListener;
  }
  interface CameraFrameListener {
    /** [CameraFrameListener.start(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraFrameListener.start.html)
     *
     * 在插件中使用：不支持
     *
     * 开始监听帧数据 */
    start(option?: CameraFrameListenerStartOption): void;
    /** [CameraFrameListener.stop(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraFrameListener.stop.html)
     *
     * 在插件中使用：不支持
     *
     * 停止监听帧数据 */
    stop(option?: StopOption): void;
  }
  interface Canvas {
    /** [Canvas.cancelAnimationFrame(number requestID)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.cancelAnimationFrame.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 取消由 requestAnimationFrame 添加到计划中的动画帧请求。支持在 2D Canvas 和 WebGL Canvas 下使用, 但不支持混用 2D 和 WebGL 的方法。 */
    cancelAnimationFrame(requestID: number): void;
    /** [[ImageData](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/ImageData.html) Canvas.createImageData()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.createImageData.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 创建一个 ImageData 对象。仅支持在 2D Canvas 中使用。 */
    createImageData(): ImageData;
    /** [[Image](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Image.html) Canvas.createImage()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.createImage.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 创建一个图片对象。 支持在 2D Canvas 和 WebGL Canvas 下使用, 但不支持混用 2D 和 WebGL 的方法。 */
    createImage(): Image;
    /** [[Path2D](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.html) Canvas.createPath2D([Path2D](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.html) path)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.createPath2D.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 创建 Path2D 对象 */
    createPath2D(
      /** [Path2D](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.html) */
      path: Path2D
    ): Path2D;
    /** [[RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) Canvas.getContext(string contextType)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.getContext.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 该方法返回 Canvas 的绘图上下文
     *
     * ****
     *
     * 支持获取 2D 和 WebGL 绘图上下文 */
    getContext(
      /** 上下文类型
       *
       * 参数 contextType 可选值：
       * - '2d': 2d 绘图上下文; */
      contextType: '2d'
    ): CanvasRenderingContext.CanvasRenderingContext2D;
    /** [[RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) Canvas.getContext(string contextType)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.getContext.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 该方法返回 Canvas 的绘图上下文
     *
     * ****
     *
     * 支持获取 2D 和 WebGL 绘图上下文 */
    getContext(
      /** 上下文类型
       *
       * 参数 contextType 可选值：
       * - 'webgl': webgl 绘图上下文; */
      contextType: 'webgl'
    ): CanvasRenderingContext.WebGLRenderingContext;
    /** [[RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) Canvas.getContext(string contextType)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.getContext.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 该方法返回 Canvas 的绘图上下文
     *
     * ****
     *
     * 支持获取 2D 和 WebGL 绘图上下文 */
    getContext(
      /** 上下文类型
       *
       * 参数 contextType 可选值：
       * - 'webgl2': webgl2 绘图上下文; */
      contextType: 'webgl2'
    ): CanvasRenderingContext.WebGL2RenderingContext;
    /** [number Canvas.requestAnimationFrame(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.requestAnimationFrame.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 在下次进行重绘时执行。 支持在 2D Canvas 和 WebGL Canvas 下使用, 但不支持混用 2D 和 WebGL 的方法。 */
    requestAnimationFrame(
      /** 执行的 callback */
      callback: (...args: any[]) => any
    ): number;
    /** [string Canvas.toDataURL(string type, number encoderOptions)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.toDataURL.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 返回一个包含图片展示的 data URI 。可以使用 type 参数其类型，默认为 PNG 格式。 */
    toDataURL(
      /** 图片格式，默认为 image/png */
      type: string,
      /** 在指定图片格式为 image/jpeg 或 image/webp的情况下，可以从 0 到 1 的区间内选择图片的质量。如果超出取值范围，将会使用默认值 0.92。其他参数会被忽略。 */
      encoderOptions: number
    ): string;
  }
  interface CanvasContext {
    /** [CanvasContext.arc(number x, number y, number r, number sAngle, number eAngle, boolean counterclockwise)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.arc.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建一条弧线。
*
*   - 创建一个圆可以指定起始弧度为 0，终止弧度为 2 * Math.PI。
*   - 用 `stroke` 或者 `fill` 方法来在 `canvas` 中画弧线。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// Draw coordinates
ctx.arc(100, 75, 50, 0, 2 * Math.PI)
ctx.setFillStyle('#EEEEEE')
ctx.fill()

ctx.beginPath()
ctx.moveTo(40, 75)
ctx.lineTo(160, 75)
ctx.moveTo(100, 15)
ctx.lineTo(100, 135)
ctx.setStrokeStyle('#AAAAAA')
ctx.stroke()

ctx.setFontSize(12)
ctx.setFillStyle('black')
ctx.fillText('0', 165, 78)
ctx.fillText('0.5*PI', 83, 145)
ctx.fillText('1*PI', 15, 78)
ctx.fillText('1.5*PI', 83, 10)

// Draw points
ctx.beginPath()
ctx.arc(100, 75, 2, 0, 2 * Math.PI)
ctx.setFillStyle('lightgreen')
ctx.fill()

ctx.beginPath()
ctx.arc(100, 25, 2, 0, 2 * Math.PI)
ctx.setFillStyle('blue')
ctx.fill()

ctx.beginPath()
ctx.arc(150, 75, 2, 0, 2 * Math.PI)
ctx.setFillStyle('red')
ctx.fill()

// Draw arc
ctx.beginPath()
ctx.arc(100, 75, 50, 0, 1.5 * Math.PI)
ctx.setStrokeStyle('#333333')
ctx.stroke()

ctx.draw()
```
*
* ![](@program/dev/image/canvas/arc.png)
*
* 针对 arc(100, 75, 50, 0, 1.5 * Math.PI)的三个关键坐标如下：
*
* - 绿色: 圆心 (100, 75)
* - 红色: 起始弧度 (0)
* - 蓝色: 终止弧度 (1.5 * Math.PI) */
    arc(
      /** 圆心的 x 坐标 */
      x: number,
      /** 圆心的 y 坐标 */
      y: number,
      /** 圆的半径 */
      r: number,
      /** 起始弧度，单位弧度（在3点钟方向） */
      sAngle: number,
      /** 终止弧度 */
      eAngle: number,
      /** 弧度的方向是否是逆时针 */
      counterclockwise?: boolean
    ): void;
    /** [CanvasContext.arcTo(number x1, number y1, number x2, number y2, number radius)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.arcTo.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 根据控制点和半径绘制圆弧路径。 */
    arcTo(
      /** 第一个控制点的 x 轴坐标 */
      x1: number,
      /** 第一个控制点的 y 轴坐标 */
      y1: number,
      /** 第二个控制点的 x 轴坐标 */
      x2: number,
      /** 第二个控制点的 y 轴坐标 */
      y2: number,
      /** 圆弧的半径 */
      radius: number
    ): void;
    /** [CanvasContext.beginPath()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.beginPath.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 开始创建一个路径。需要调用 `fill` 或者 `stroke` 才会使用路径进行填充或描边
*
*   - 在最开始的时候相当于调用了一次 `beginPath`。
*   - 同一个路径内的多次 `setFillStyle`、`setStrokeStyle`、`setLineWidth`等设置，以最后一次设置为准。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
// begin path
ctx.rect(10, 10, 100, 30)
ctx.setFillStyle('yellow')
ctx.fill()

// begin another path
ctx.beginPath()
ctx.rect(10, 40, 100, 30)

// only fill this rect, not in current path
ctx.setFillStyle('blue')
ctx.fillRect(10, 70, 100, 30)

ctx.rect(10, 100, 100, 30)

// it will fill current path
ctx.setFillStyle('red')
ctx.fill()
ctx.draw()
```
*
* ![](@program/dev/image/canvas/fill-path.png) */
    beginPath(): void;
    /** [CanvasContext.bezierCurveTo(number cp1x, number cp1y, number cp2x, number cp2y, number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.bezierCurveTo.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建三次方贝塞尔曲线路径。曲线的起始点为路径中前一个点。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// Draw points
ctx.beginPath()
ctx.arc(20, 20, 2, 0, 2 * Math.PI)
ctx.setFillStyle('red')
ctx.fill()

ctx.beginPath()
ctx.arc(200, 20, 2, 0, 2 * Math.PI)
ctx.setFillStyle('lightgreen')
ctx.fill()

ctx.beginPath()
ctx.arc(20, 100, 2, 0, 2 * Math.PI)
ctx.arc(200, 100, 2, 0, 2 * Math.PI)
ctx.setFillStyle('blue')
ctx.fill()

ctx.setFillStyle('black')
ctx.setFontSize(12)

// Draw guides
ctx.beginPath()
ctx.moveTo(20, 20)
ctx.lineTo(20, 100)
ctx.lineTo(150, 75)

ctx.moveTo(200, 20)
ctx.lineTo(200, 100)
ctx.lineTo(70, 75)
ctx.setStrokeStyle('#AAAAAA')
ctx.stroke()

// Draw quadratic curve
ctx.beginPath()
ctx.moveTo(20, 20)
ctx.bezierCurveTo(20, 100, 200, 100, 200, 20)
ctx.setStrokeStyle('black')
ctx.stroke()

ctx.draw()
```
*
* ![](@program/dev/image/canvas/bezier-curve.png)
*
* 针对 moveTo(20, 20) bezierCurveTo(20, 100, 200, 100, 200, 20) 的三个关键坐标如下：
*
* - 红色：起始点(20, 20)
* - 蓝色：两个控制点(20, 100) (200, 100)
* - 绿色：终止点(200, 20) */
    bezierCurveTo(
      /** 第一个贝塞尔控制点的 x 坐标 */
      cp1x: number,
      /** 第一个贝塞尔控制点的 y 坐标 */
      cp1y: number,
      /** 第二个贝塞尔控制点的 x 坐标 */
      cp2x: number,
      /** 第二个贝塞尔控制点的 y 坐标 */
      cp2y: number,
      /** 结束点的 x 坐标 */
      x: number,
      /** 结束点的 y 坐标 */
      y: number
    ): void;
    /** [CanvasContext.clearRect(number x, number y, number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.clearRect.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 清除画布上在该矩形区域内的内容
*
* **示例代码**
*
* clearRect 并非画一个白色的矩形在地址区域，而是清空，为了有直观感受，对 canvas 加了一层背景色。
* ```html
* <canvas canvas-id="myCanvas" style="border: 1px solid; background: #123456;"/>
* ```
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.setFillStyle('red')
ctx.fillRect(0, 0, 150, 200)
ctx.setFillStyle('blue')
ctx.fillRect(150, 0, 150, 200)
ctx.clearRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/clear-rect.png) */
    clearRect(
      /** 矩形路径左上角的横坐标 */
      x: number,
      /** 矩形路径左上角的纵坐标 */
      y: number,
      /** 矩形路径的宽度 */
      width: number,
      /** 矩形路径的高度 */
      height: number
    ): void;
    /** [CanvasContext.clip()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.clip.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 从原始画布中剪切任意形状和尺寸。一旦剪切了某个区域，则所有之后的绘图都会被限制在被剪切的区域内（不能访问画布上的其他区域）。可以在使用 `clip` 方法前通过使用 `save` 方法对当前画布区域进行保存，并在以后的任意时间通过`restore`方法对其进行恢复。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

wx.downloadFile({
  url: 'http://is5.mzstatic.com/image/thumb/Purple128/v4/75/3b/90/753b907c-b7fb-5877-215a-759bd73691a4/source/50x50bb.jpg',
  success: function(res) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(50, 50, 25, 0, 2*Math.PI)
    ctx.clip()
    ctx.drawImage(res.tempFilePath, 25, 25)
    ctx.restore()
    ctx.draw()
  }
})
```
* ![](@program/dev/image/canvas/clip.png) */
    clip(): void;
    /** [CanvasContext.closePath()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.closePath.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 关闭一个路径。会连接起点和终点。如果关闭路径后没有调用 `fill` 或者 `stroke` 并开启了新的路径，那之前的路径将不会被渲染。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.moveTo(10, 10)
ctx.lineTo(100, 10)
ctx.lineTo(100, 100)
ctx.closePath()
ctx.stroke()
ctx.draw()
```
* ![](@program/dev/image/canvas/close-line.png)
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
// begin path
ctx.rect(10, 10, 100, 30)
ctx.closePath()

// begin another path
ctx.beginPath()
ctx.rect(10, 40, 100, 30)

// only fill this rect, not in current path
ctx.setFillStyle('blue')
ctx.fillRect(10, 70, 100, 30)

ctx.rect(10, 100, 100, 30)

// it will fill current path
ctx.setFillStyle('red')
ctx.fill()
ctx.draw()
```
*
* ![](@program/dev/image/canvas/close-path.png) */
    closePath(): void;
    /** [CanvasContext.createPattern(string image, string repetition)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.createPattern.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 对指定的图像创建模式的方法，可在指定的方向上重复元图像 */
    createPattern(
      /** 重复的图像源，支持代码包路径和本地临时路径 (本地路径) */
      image: string,
      /** 如何重复图像
       *
       * 参数 repetition 可选值：
       * - 'repeat': 水平竖直方向都重复;
       * - 'repeat-x': 水平方向重复;
       * - 'repeat-y': 竖直方向重复;
       * - 'no-repeat': 不重复; */
      repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
    ): void;
    /** [CanvasContext.draw(boolean reserve, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.draw.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 将之前在绘图上下文中的描述（路径、变形、样式）画到 canvas 中。
*
* **示例代码**
*
* 第二次 draw() reserve 为 true。所以保留了上一次的绘制结果，在上下文设置的 fillStyle 'red' 也变成了默认的 'black'。
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 100)
ctx.draw()
ctx.fillRect(50, 50, 150, 100)
ctx.draw(true)
```
* ![](@program/dev/image/canvas/reserve.png)
*
* **示例代码**
*
* 第二次 draw() reserve 为 false。所以没有保留了上一次的绘制结果和在上下文设置的 fillStyle 'red'。
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 100)
ctx.draw()
ctx.fillRect(50, 50, 150, 100)
ctx.draw()
```
* ![](@program/dev/image/canvas/un-reserve.png) */
    draw(
      /** 本次绘制是否接着上一次绘制。即 reserve 参数为 false，则在本次调用绘制之前 native 层会先清空画布再继续绘制；若 reserve 参数为 true，则保留当前画布上的内容，本次调用 drawCanvas 绘制的内容覆盖在上面，默认 false。 */
      reserve?: boolean,
      /** 绘制完成后执行的回调函数 */
      callback?: (...args: any[]) => any
    ): void;
    /** [CanvasContext.drawImage(string imageResource, number sx, number sy, number sWidth, number sHeight, number dx, number dy, number dWidth, number dHeight)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 绘制图像到画布
*
* **示例代码**
*
* 有三个版本的写法：
*
* - drawImage(imageResource, dx, dy)
* - drawImage(imageResource, dx, dy, dWidth, dHeight)
* - drawImage(imageResource, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) 从 1.9.0 起支持
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

wx.chooseImage({
  success: function(res){
    ctx.drawImage(res.tempFilePaths[0], 0, 0, 150, 100)
    ctx.draw()
  }
})

```
* ![](@program/dev/image/canvas/draw-image.png) */
    drawImage(
      /** 所要绘制的图片资源（网络图片要通过 getImageInfo / downloadFile 先下载） */
      imageResource: string,
      /** imageResource的左上角在目标 canvas 上 x 轴的位置 */
      dx: number,
      /** imageResource的左上角在目标 canvas 上 y 轴的位置 */
      dy: number
    ): void;
    /** [CanvasContext.drawImage(string imageResource, number sx, number sy, number sWidth, number sHeight, number dx, number dy, number dWidth, number dHeight)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 绘制图像到画布
*
* **示例代码**
*
* 有三个版本的写法：
*
* - drawImage(imageResource, dx, dy)
* - drawImage(imageResource, dx, dy, dWidth, dHeight)
* - drawImage(imageResource, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) 从 1.9.0 起支持
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

wx.chooseImage({
  success: function(res){
    ctx.drawImage(res.tempFilePaths[0], 0, 0, 150, 100)
    ctx.draw()
  }
})

```
* ![](@program/dev/image/canvas/draw-image.png) */
    drawImage(
      /** 所要绘制的图片资源（网络图片要通过 getImageInfo / downloadFile 先下载） */
      imageResource: string,
      /** imageResource的左上角在目标 canvas 上 x 轴的位置 */
      dx: number,
      /** imageResource的左上角在目标 canvas 上 y 轴的位置 */
      dy: number,
      /** 在目标画布上绘制imageResource的宽度，允许对绘制的imageResource进行缩放 */
      dWidth: number,
      /** 在目标画布上绘制imageResource的高度，允许对绘制的imageResource进行缩放 */
      dHeight: number
    ): void;
    /** [CanvasContext.drawImage(string imageResource, number sx, number sy, number sWidth, number sHeight, number dx, number dy, number dWidth, number dHeight)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 绘制图像到画布
*
* **示例代码**
*
* 有三个版本的写法：
*
* - drawImage(imageResource, dx, dy)
* - drawImage(imageResource, dx, dy, dWidth, dHeight)
* - drawImage(imageResource, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) 从 1.9.0 起支持
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

wx.chooseImage({
  success: function(res){
    ctx.drawImage(res.tempFilePaths[0], 0, 0, 150, 100)
    ctx.draw()
  }
})

```
* ![](@program/dev/image/canvas/draw-image.png) */
    drawImage(
      /** 所要绘制的图片资源（网络图片要通过 getImageInfo / downloadFile 先下载） */
      imageResource: string,
      /** 需要绘制到画布中的，imageResource的矩形（裁剪）选择框的左上角 x 坐标 */
      sx: number,
      /** 需要绘制到画布中的，imageResource的矩形（裁剪）选择框的左上角 y 坐标 */
      sy: number,
      /** 需要绘制到画布中的，imageResource的矩形（裁剪）选择框的宽度 */
      sWidth: number,
      /** 需要绘制到画布中的，imageResource的矩形（裁剪）选择框的高度 */
      sHeight: number,
      /** imageResource的左上角在目标 canvas 上 x 轴的位置 */
      dx: number,
      /** imageResource的左上角在目标 canvas 上 y 轴的位置 */
      dy: number,
      /** 在目标画布上绘制imageResource的宽度，允许对绘制的imageResource进行缩放 */
      dWidth: number,
      /** 在目标画布上绘制imageResource的高度，允许对绘制的imageResource进行缩放 */
      dHeight: number
    ): void;
    /** [CanvasContext.fill()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.fill.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 对当前路径中的内容进行填充。默认的填充色为黑色。
*
* **示例代码**
*
* 如果当前路径没有闭合，fill() 方法会将起点和终点进行连接，然后填充。
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.moveTo(10, 10)
ctx.lineTo(100, 10)
ctx.lineTo(100, 100)
ctx.fill()
ctx.draw()
```
*
* fill() 填充的的路径是从 beginPath() 开始计算，但是不会将 fillRect() 包含进去。
*
* ![](@program/dev/image/canvas/fill-line.png)
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
// begin path
ctx.rect(10, 10, 100, 30)
ctx.setFillStyle('yellow')
ctx.fill()

// begin another path
ctx.beginPath()
ctx.rect(10, 40, 100, 30)

// only fill this rect, not in current path
ctx.setFillStyle('blue')
ctx.fillRect(10, 70, 100, 30)

ctx.rect(10, 100, 100, 30)

// it will fill current path
ctx.setFillStyle('red')
ctx.fill()
ctx.draw()
```
*
* ![](@program/dev/image/canvas/fill-path.png) */
    fill(): void;
    /** [CanvasContext.fillRect(number x, number y, number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.fillRect.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 填充一个矩形。用 [`setFillStyle`](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setFillStyle.html) 设置矩形的填充色，如果没设置默认是黑色。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/fill-rect.png) */
    fillRect(
      /** 矩形路径左上角的横坐标 */
      x: number,
      /** 矩形路径左上角的纵坐标 */
      y: number,
      /** 矩形路径的宽度 */
      width: number,
      /** 矩形路径的高度 */
      height: number
    ): void;
    /** [CanvasContext.fillText(string text, number x, number y, number maxWidth)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.fillText.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 在画布上绘制被填充的文本
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setFontSize(20)
ctx.fillText('Hello', 20, 20)
ctx.fillText('MINA', 100, 100)

ctx.draw()
```
* ![](@program/dev/image/canvas/text.png) */
    fillText(
      /** 在画布上输出的文本 */
      text: string,
      /** 绘制文本的左上角 x 坐标位置 */
      x: number,
      /** 绘制文本的左上角 y 坐标位置 */
      y: number,
      /** 需要绘制的最大宽度，可选 */
      maxWidth?: number
    ): void;
    /** [CanvasContext.lineTo(number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.lineTo.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 增加一个新点，然后创建一条从上次指定点到目标点的线。用 `stroke` 方法来画线条
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.moveTo(10, 10)
ctx.rect(10, 10, 100, 50)
ctx.lineTo(110, 60)
ctx.stroke()
ctx.draw()
```
* ![](@program/dev/image/canvas/line-to.png) */
    lineTo(
      /** 目标位置的 x 坐标 */
      x: number,
      /** 目标位置的 y 坐标 */
      y: number
    ): void;
    /** [CanvasContext.moveTo(number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.moveTo.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 把路径移动到画布中的指定点，不创建线条。用 `stroke` 方法来画线条
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.moveTo(10, 10)
ctx.lineTo(100, 10)

ctx.moveTo(10, 50)
ctx.lineTo(100, 50)
ctx.stroke()
ctx.draw()
```
* ![](@program/dev/image/canvas/move-to.png) */
    moveTo(
      /** 目标位置的 x 坐标 */
      x: number,
      /** 目标位置的 y 坐标 */
      y: number
    ): void;
    /** [CanvasContext.quadraticCurveTo(number cpx, number cpy, number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.quadraticCurveTo.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建二次贝塞尔曲线路径。曲线的起始点为路径中前一个点。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// Draw points
ctx.beginPath()
ctx.arc(20, 20, 2, 0, 2 * Math.PI)
ctx.setFillStyle('red')
ctx.fill()

ctx.beginPath()
ctx.arc(200, 20, 2, 0, 2 * Math.PI)
ctx.setFillStyle('lightgreen')
ctx.fill()

ctx.beginPath()
ctx.arc(20, 100, 2, 0, 2 * Math.PI)
ctx.setFillStyle('blue')
ctx.fill()

ctx.setFillStyle('black')
ctx.setFontSize(12)

// Draw guides
ctx.beginPath()
ctx.moveTo(20, 20)
ctx.lineTo(20, 100)
ctx.lineTo(200, 20)
ctx.setStrokeStyle('#AAAAAA')
ctx.stroke()

// Draw quadratic curve
ctx.beginPath()
ctx.moveTo(20, 20)
ctx.quadraticCurveTo(20, 100, 200, 20)
ctx.setStrokeStyle('black')
ctx.stroke()

ctx.draw()
```
*
* ![](@program/dev/image/canvas/quadratic-curve-to.png)
*
* 针对 moveTo(20, 20) quadraticCurveTo(20, 100, 200, 20) 的三个关键坐标如下：
*
* - 红色：起始点(20, 20)
* - 蓝色：控制点(20, 100)
* - 绿色：终止点(200, 20) */
    quadraticCurveTo(
      /** 贝塞尔控制点的 x 坐标 */
      cpx: number,
      /** 贝塞尔控制点的 y 坐标 */
      cpy: number,
      /** 结束点的 x 坐标 */
      x: number,
      /** 结束点的 y 坐标 */
      y: number
    ): void;
    /** [CanvasContext.rect(number x, number y, number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.rect.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建一个矩形路径。需要用 [`fill`](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.fill.html) 或者 [`stroke`](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.stroke.html) 方法将矩形真正的画到 `canvas` 中
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.rect(10, 10, 150, 75)
ctx.setFillStyle('red')
ctx.fill()
ctx.draw()
```
* ![](@program/dev/image/canvas/fill-rect.png) */
    rect(
      /** 矩形路径左上角的横坐标 */
      x: number,
      /** 矩形路径左上角的纵坐标 */
      y: number,
      /** 矩形路径的宽度 */
      width: number,
      /** 矩形路径的高度 */
      height: number
    ): void;
    /** [CanvasContext.restore()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.restore.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 恢复之前保存的绘图上下文。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// save the default fill style
ctx.save()
ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 100)

// restore to the previous saved state
ctx.restore()
ctx.fillRect(50, 50, 150, 100)

ctx.draw()
```
* ![](@program/dev/image/canvas/save-restore.png) */
    restore(): void;
    /** [CanvasContext.rotate(number rotate)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.rotate.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 以原点为中心顺时针旋转当前坐标轴。多次调用旋转的角度会叠加。原点可以用 `translate` 方法修改。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.strokeRect(100, 10, 150, 100)
ctx.rotate(20 * Math.PI / 180)
ctx.strokeRect(100, 10, 150, 100)
ctx.rotate(20 * Math.PI / 180)
ctx.strokeRect(100, 10, 150, 100)

ctx.draw()
```
* ![](@program/dev/image/canvas/rotate.png) */
    rotate(
      /** 旋转角度，以弧度计 degrees * Math.PI/180；degrees 范围为 0-360 */
      rotate: number
    ): void;
    /** [CanvasContext.save()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.save.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 保存绘图上下文。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// save the default fill style
ctx.save()
ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 100)

// restore to the previous saved state
ctx.restore()
ctx.fillRect(50, 50, 150, 100)

ctx.draw()
```
* ![](@program/dev/image/canvas/save-restore.png) */
    save(): void;
    /** [CanvasContext.scale(number scaleWidth, number scaleHeight)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.scale.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 在调用后，之后创建的路径其横纵坐标会被缩放。多次调用倍数会相乘。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.strokeRect(10, 10, 25, 15)
ctx.scale(2, 2)
ctx.strokeRect(10, 10, 25, 15)
ctx.scale(2, 2)
ctx.strokeRect(10, 10, 25, 15)

ctx.draw()
```
* ![](@program/dev/image/canvas/scale.png) */
    scale(
      /** 横坐标缩放的倍数 (1 = 100%，0.5 = 50%，2 = 200%) */
      scaleWidth: number,
      /** 纵坐标轴缩放的倍数 (1 = 100%，0.5 = 50%，2 = 200%) */
      scaleHeight: number
    ): void;
    /** [CanvasContext.setFillStyle(string|[CanvasGradient](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.html) color)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setFillStyle.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.fillStyle](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置填充色。
*
* **代码示例**
*
* ```js
const ctx = wx.createCanvasContext('myCanvas')
ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/fill-rect.png) */
    setFillStyle(
      /** 填充的颜色，默认颜色为 black。 */
      color: string | CanvasGradient
    ): void;
    /** [CanvasContext.setFontSize(number fontSize)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setFontSize.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.font](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置字体的字号
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setFontSize(20)
ctx.fillText('20', 20, 20)
ctx.setFontSize(30)
ctx.fillText('30', 40, 40)
ctx.setFontSize(40)
ctx.fillText('40', 60, 60)
ctx.setFontSize(50)
ctx.fillText('50', 90, 90)

ctx.draw()
```
* ![](@program/dev/image/canvas/font-size.png) */
    setFontSize(
      /** 字体的字号 */
      fontSize: number
    ): void;
    /** [CanvasContext.setGlobalAlpha(number alpha)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setGlobalAlpha.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.globalAlpha](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置全局画笔透明度。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setFillStyle('red')
ctx.fillRect(10, 10, 150, 100)
ctx.setGlobalAlpha(0.2)
ctx.setFillStyle('blue')
ctx.fillRect(50, 50, 150, 100)
ctx.setFillStyle('yellow')
ctx.fillRect(100, 100, 150, 100)

ctx.draw()
```
* ![](@program/dev/image/canvas/global-alpha.png) */
    setGlobalAlpha(
      /** 透明度。范围 0-1，0 表示完全透明，1 表示完全不透明。 */
      alpha: number
    ): void;
    /** [CanvasContext.setLineCap(string lineCap)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineCap.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.lineCap](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置线条的端点样式
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.beginPath()
ctx.moveTo(10, 10)
ctx.lineTo(150, 10)
ctx.stroke()

ctx.beginPath()
ctx.setLineCap('butt')
ctx.setLineWidth(10)
ctx.moveTo(10, 30)
ctx.lineTo(150, 30)
ctx.stroke()

ctx.beginPath()
ctx.setLineCap('round')
ctx.setLineWidth(10)
ctx.moveTo(10, 50)
ctx.lineTo(150, 50)
ctx.stroke()

ctx.beginPath()
ctx.setLineCap('square')
ctx.setLineWidth(10)
ctx.moveTo(10, 70)
ctx.lineTo(150, 70)
ctx.stroke()

ctx.draw()
```
* ![](@program/dev/image/canvas/line-cap.png) */
    setLineCap(
      /** 线条的结束端点样式
       *
       * 参数 lineCap 可选值：
       * - 'butt': 向线条的每个末端添加平直的边缘。;
       * - 'round': 向线条的每个末端添加圆形线帽。;
       * - 'square': 向线条的每个末端添加正方形线帽。; */
      lineCap: 'butt' | 'round' | 'square'
    ): void;
    /** [CanvasContext.setLineDash(Array.&lt;number&gt; pattern, number offset)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineDash.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.lineDashOffset](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置虚线样式。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setLineDash([10, 20], 5);

ctx.beginPath();
ctx.moveTo(0,100);
ctx.lineTo(400, 100);
ctx.stroke();

ctx.draw()
```
* ![](@program/dev/image/canvas/set-line-dash.png) */
    setLineDash(
      /** 一组描述交替绘制线段和间距（坐标空间单位）长度的数字 */
      pattern: number[],
      /** 虚线偏移量 */
      offset: number
    ): void;
    /** [CanvasContext.setLineJoin(string lineJoin)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineJoin.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.lineJoin](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置线条的交点样式
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.beginPath()
ctx.moveTo(10, 10)
ctx.lineTo(100, 50)
ctx.lineTo(10, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineJoin('bevel')
ctx.setLineWidth(10)
ctx.moveTo(50, 10)
ctx.lineTo(140, 50)
ctx.lineTo(50, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineJoin('round')
ctx.setLineWidth(10)
ctx.moveTo(90, 10)
ctx.lineTo(180, 50)
ctx.lineTo(90, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineJoin('miter')
ctx.setLineWidth(10)
ctx.moveTo(130, 10)
ctx.lineTo(220, 50)
ctx.lineTo(130, 90)
ctx.stroke()

ctx.draw()
```
* ![](@program/dev/image/canvas/line-join.png) */
    setLineJoin(
      /** 线条的结束交点样式
       *
       * 参数 lineJoin 可选值：
       * - 'bevel': 斜角;
       * - 'round': 圆角;
       * - 'miter': 尖角; */
      lineJoin: 'bevel' | 'round' | 'miter'
    ): void;
    /** [CanvasContext.setLineWidth(number lineWidth)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineWidth.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.lineWidth](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置线条的宽度
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.beginPath()
ctx.moveTo(10, 10)
ctx.lineTo(150, 10)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(5)
ctx.moveTo(10, 30)
ctx.lineTo(150, 30)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(10)
ctx.moveTo(10, 50)
ctx.lineTo(150, 50)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(15)
ctx.moveTo(10, 70)
ctx.lineTo(150, 70)
ctx.stroke()

ctx.draw()
```
*
* ![](@program/dev/image/canvas/line-width.png) */
    setLineWidth(
      /** 线条的宽度，单位px */
      lineWidth: number
    ): void;
    /** [CanvasContext.setMiterLimit(number miterLimit)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setMiterLimit.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.miterLimit](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置最大斜接长度。斜接长度指的是在两条线交汇处内角和外角之间的距离。当 [CanvasContext.setLineJoin()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setLineJoin.html) 为 miter 时才有效。超过最大倾斜长度的，连接处将以 lineJoin 为 bevel 来显示。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.beginPath()
ctx.setLineWidth(10)
ctx.setLineJoin('miter')
ctx.setMiterLimit(1)
ctx.moveTo(10, 10)
ctx.lineTo(100, 50)
ctx.lineTo(10, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(10)
ctx.setLineJoin('miter')
ctx.setMiterLimit(2)
ctx.moveTo(50, 10)
ctx.lineTo(140, 50)
ctx.lineTo(50, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(10)
ctx.setLineJoin('miter')
ctx.setMiterLimit(3)
ctx.moveTo(90, 10)
ctx.lineTo(180, 50)
ctx.lineTo(90, 90)
ctx.stroke()

ctx.beginPath()
ctx.setLineWidth(10)
ctx.setLineJoin('miter')
ctx.setMiterLimit(4)
ctx.moveTo(130, 10)
ctx.lineTo(220, 50)
ctx.lineTo(130, 90)
ctx.stroke()

ctx.draw()
```
* ![](@program/dev/image/canvas/miter-limit.png) */
    setMiterLimit(
      /** 最大斜接长度 */
      miterLimit: number
    ): void;
    /** [CanvasContext.setShadow(number offsetX, number offsetY, number blur, string color)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setShadow.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.shadowOffsetX|CanvasContext.shadowOffsetY|CanvasContext.shadowColor|CanvasContext.shadowBlur](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设定阴影样式。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.setFillStyle('red')
ctx.setShadow(10, 50, 50, 'blue')
ctx.fillRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/shadow.png) */
    setShadow(
      /** 阴影相对于形状在水平方向的偏移，默认值为 0。 */
      offsetX: number,
      /** 阴影相对于形状在竖直方向的偏移，默认值为 0。 */
      offsetY: number,
      /** 阴影的模糊级别，数值越大越模糊。范围 0- 100。，默认值为 0。 */
      blur: number,
      /** 阴影的颜色。默认值为 black。 */
      color: string
    ): void;
    /** [CanvasContext.setStrokeStyle(string|[CanvasGradient](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.html) color)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setStrokeStyle.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [1.9.90](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [CanvasContext.strokeStyle](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置描边颜色。
*
* **代码示例**
*
* ```js
const ctx = wx.createCanvasContext('myCanvas')
ctx.setStrokeStyle('red')
ctx.strokeRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/stroke-rect.png) */
    setStrokeStyle(
      /** 描边的颜色，默认颜色为 black。 */
      color: string | CanvasGradient
    ): void;
    /** [CanvasContext.setTextAlign(string align)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setTextAlign.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置文字的对齐
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setStrokeStyle('red')
ctx.moveTo(150, 20)
ctx.lineTo(150, 170)
ctx.stroke()

ctx.setFontSize(15)
ctx.setTextAlign('left')
ctx.fillText('textAlign=left', 150, 60)

ctx.setTextAlign('center')
ctx.fillText('textAlign=center', 150, 80)

ctx.setTextAlign('right')
ctx.fillText('textAlign=right', 150, 100)

ctx.draw()
```
*
* ![](@program/dev/image/canvas/set-text-align.png) */
    setTextAlign(
      /** 文字的对齐方式
       *
       * 参数 align 可选值：
       * - 'left': 左对齐;
       * - 'center': 居中对齐;
       * - 'right': 右对齐; */
      align: 'left' | 'center' | 'right'
    ): void;
    /** [CanvasContext.setTextBaseline(string textBaseline)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setTextBaseline.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 设置文字的竖直对齐
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.setStrokeStyle('red')
ctx.moveTo(5, 75)
ctx.lineTo(295, 75)
ctx.stroke()

ctx.setFontSize(20)

ctx.setTextBaseline('top')
ctx.fillText('top', 5, 75)

ctx.setTextBaseline('middle')
ctx.fillText('middle', 50, 75)

ctx.setTextBaseline('bottom')
ctx.fillText('bottom', 120, 75)

ctx.setTextBaseline('normal')
ctx.fillText('normal', 200, 75)

ctx.draw()
```
* ![](@program/dev/image/canvas/set-text-baseline.png) */
    setTextBaseline(
      /** 文字的竖直对齐方式
       *
       * 参数 textBaseline 可选值：
       * - 'top': 顶部对齐;
       * - 'bottom': 底部对齐;
       * - 'middle': 居中对齐;
       * - 'normal': ; */
      textBaseline: 'top' | 'bottom' | 'middle' | 'normal'
    ): void;
    /** [CanvasContext.setTransform(number scaleX, number skewX, number skewY, number scaleY, number translateX, number translateY)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setTransform.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 使用矩阵重新设置（覆盖）当前变换的方法 */
    setTransform(
      /** 水平缩放 */
      scaleX: number,
      /** 水平倾斜 */
      skewX: number,
      /** 垂直倾斜 */
      skewY: number,
      /** 垂直缩放 */
      scaleY: number,
      /** 水平移动 */
      translateX: number,
      /** 垂直移动 */
      translateY: number
    ): void;
    /** [CanvasContext.stroke()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.stroke.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 画出当前路径的边框。默认颜色色为黑色。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.moveTo(10, 10)
ctx.lineTo(100, 10)
ctx.lineTo(100, 100)
ctx.stroke()
ctx.draw()
```
* ![](@program/dev/image/canvas/stroke-line.png)
*
* stroke() 描绘的的路径是从 beginPath() 开始计算，但是不会将 strokeRect() 包含进去。
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
// begin path
ctx.rect(10, 10, 100, 30)
ctx.setStrokeStyle('yellow')
ctx.stroke()

// begin another path
ctx.beginPath()
ctx.rect(10, 40, 100, 30)

// only stoke this rect, not in current path
ctx.setStrokeStyle('blue')
ctx.strokeRect(10, 70, 100, 30)

ctx.rect(10, 100, 100, 30)

// it will stroke current path
ctx.setStrokeStyle('red')
ctx.stroke()
ctx.draw()
```
*
* ![](@program/dev/image/canvas/stroke-path.png) */
    stroke(): void;
    /** [CanvasContext.strokeRect(number x, number y, number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.strokeRect.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 画一个矩形(非填充)。 用 [`setStrokeStyle`](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.setStrokeStyle.html) 设置矩形线条的颜色，如果没设置默认是黑色。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')
ctx.setStrokeStyle('red')
ctx.strokeRect(10, 10, 150, 75)
ctx.draw()
```
* ![](@program/dev/image/canvas/stroke-rect.png) */
    strokeRect(
      /** 矩形路径左上角的横坐标 */
      x: number,
      /** 矩形路径左上角的纵坐标 */
      y: number,
      /** 矩形路径的宽度 */
      width: number,
      /** 矩形路径的高度 */
      height: number
    ): void;
    /** [CanvasContext.strokeText(string text, number x, number y, number maxWidth)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.strokeText.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 给定的 (x, y) 位置绘制文本描边的方法 */
    strokeText(
      /** 要绘制的文本 */
      text: string,
      /** 文本起始点的 x 轴坐标 */
      x: number,
      /** 文本起始点的 y 轴坐标 */
      y: number,
      /** 需要绘制的最大宽度，可选 */
      maxWidth?: number
    ): void;
    /** [CanvasContext.transform(number scaleX, number skewX, number skewY, number scaleY, number translateX, number translateY)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.transform.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 使用矩阵多次叠加当前变换的方法 */
    transform(
      /** 水平缩放 */
      scaleX: number,
      /** 水平倾斜 */
      skewX: number,
      /** 垂直倾斜 */
      skewY: number,
      /** 垂直缩放 */
      scaleY: number,
      /** 水平移动 */
      translateX: number,
      /** 垂直移动 */
      translateY: number
    ): void;
    /** [CanvasContext.translate(number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.translate.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 对当前坐标系的原点 (0, 0) 进行变换。默认的坐标系原点为页面左上角。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

ctx.strokeRect(10, 10, 150, 100)
ctx.translate(20, 20)
ctx.strokeRect(10, 10, 150, 100)
ctx.translate(20, 20)
ctx.strokeRect(10, 10, 150, 100)

ctx.draw()
```
*
* ![](@program/dev/image/canvas/translate.png) */
    translate(
      /** 水平坐标平移量 */
      x: number,
      /** 竖直坐标平移量 */
      y: number
    ): void;
    /** [Object CanvasContext.measureText(string text)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.measureText.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
     *
     * @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
     *
     * 测量文本尺寸信息。目前仅返回文本宽度。同步接口。 */
    measureText(
      /** 要测量的文本 */
      text: string
    ): TextMetrics;
    /** [[CanvasGradient](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.html) CanvasContext.createCircularGradient(number x, number y, number r)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.createCircularGradient.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建一个圆形的渐变颜色。起点在圆心，终点在圆环。返回的`CanvasGradient`对象需要使用 [CanvasGradient.addColorStop()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.addColorStop.html) 来指定渐变点，至少要两个。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// Create circular gradient
const grd = ctx.createCircularGradient(75, 50, 50)
grd.addColorStop(0, 'red')
grd.addColorStop(1, 'white')

// Fill with gradient
ctx.setFillStyle(grd)
ctx.fillRect(10, 10, 150, 80)
ctx.draw()
```
* ![](@program/dev/image/canvas/circular-gradient.png) */
    createCircularGradient(
      /** 圆心的 x 坐标 */
      x: number,
      /** 圆心的 y 坐标 */
      y: number,
      /** 圆的半径 */
      r: number
    ): CanvasGradient;
    /** [[CanvasGradient](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.html) CanvasContext.createLinearGradient(number x0, number y0, number x1, number y1)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.createLinearGradient.html)
*
* 在插件中使用：支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 创建一个线性的渐变颜色。返回的`CanvasGradient`对象需要使用 [CanvasGradient.addColorStop()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.addColorStop.html) 来指定渐变点，至少要两个。
*
* **示例代码**
*
* ```javascript
const ctx = wx.createCanvasContext('myCanvas')

// Create linear gradient
const grd = ctx.createLinearGradient(0, 0, 200, 0)
grd.addColorStop(0, 'red')
grd.addColorStop(1, 'white')

// Fill with gradient
ctx.setFillStyle(grd)
ctx.fillRect(10, 10, 150, 80)
ctx.draw()
```
* ![](@program/dev/image/canvas/linear-gradient.png) */
    createLinearGradient(
      /** 起点的 x 坐标 */
      x0: number,
      /** 起点的 y 坐标 */
      y0: number,
      /** 终点的 x 坐标 */
      x1: number,
      /** 终点的 y 坐标 */
      y1: number
    ): CanvasGradient;
  }
  interface CanvasGradient {
    /** [CanvasGradient.addColorStop(number stop, string color)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasGradient.addColorStop.html)
*
* 在插件中使用：不支持
* @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 替换
*
* @warning **CanvasContext 是旧版的接口，新版 [Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 接口与 Web 一致**
*
* 添加颜色的渐变点。小于最小 stop 的部分会按最小 stop 的 color 来渲染，大于最大 stop 的部分会按最大 stop 的 color 来渲染
*
* **示例代码**
*
* ```js
const ctx = wx.createCanvasContext('myCanvas')

// Create circular gradient
const grd = ctx.createLinearGradient(30, 10, 120, 10)
grd.addColorStop(0, 'red')
grd.addColorStop(0.16, 'orange')
grd.addColorStop(0.33, 'yellow')
grd.addColorStop(0.5, 'green')
grd.addColorStop(0.66, 'cyan')
grd.addColorStop(0.83, 'blue')
grd.addColorStop(1, 'purple')

// Fill with gradient
ctx.setFillStyle(grd)
ctx.fillRect(10, 10, 150, 80)
ctx.draw()
```
* ![](@program/dev/image/canvas/color-stop.png) */
    addColorStop(
      /** 表示渐变中开始与结束之间的位置，范围 0-1。 */
      stop: number,
      /** 渐变点的颜色。 */
      color: string
    ): void;
  }
  interface Console {
    /** [console.debug()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.debug.html)
     *
     * 在插件中使用：不支持
     *
     * 向调试面板中打印 debug 日志 */
    debug(
      /** 日志内容，可以有任意多个。 */
      ...args: any[]
    ): void;
    /** [console.error()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.error.html)
     *
     * 在插件中使用：不支持
     *
     * 向调试面板中打印 error 日志 */
    error(
      /** 日志内容，可以有任意多个。 */
      ...args: any[]
    ): void;
    /** [console.group(string label)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.group.html)
     *
     * 在插件中使用：不支持
     *
     * 在调试面板中创建一个新的分组。随后输出的内容都会被添加一个缩进，表示该内容属于当前分组。调用 [console.groupEnd](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.groupEnd.html)之后分组结束。
     *
     * **注意**
     *
     * 仅在工具中有效，在 vConsole 中为空函数实现。 */
    group(
      /** 分组标记，可选。 */
      label?: string
    ): void;
    /** [console.groupEnd()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.groupEnd.html)
     *
     * 在插件中使用：不支持
     *
     * 结束由 [console.group](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.group.html) 创建的分组
     *
     * **注意**
     *
     * 仅在工具中有效，在 vConsole 中为空函数实现。 */
    groupEnd(): void;
    /** [console.info()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.info.html)
     *
     * 在插件中使用：不支持
     *
     * 向调试面板中打印 info 日志 */
    info(
      /** 日志内容，可以有任意多个。 */
      ...args: any[]
    ): void;
    /** [console.log()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.log.html)
     *
     * 在插件中使用：不支持
     *
     * 向调试面板中打印 log 日志 */
    log(
      /** 日志内容，可以有任意多个。 */
      ...args: any[]
    ): void;
    /** [console.warn()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/console.warn.html)
     *
     * 在插件中使用：不支持
     *
     * 向调试面板中打印 warn 日志 */
    warn(
      /** 日志内容，可以有任意多个。 */
      ...args: any[]
    ): void;
  }
  interface DownloadTask {
    /** [DownloadTask.abort()](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.abort.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 中断下载任务 */
    abort(): void;
    /** [DownloadTask.offHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.offHeadersReceived.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：支持
*
* 移除 HTTP Response Header 事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

DownloadTask.onHeadersReceived(listener)
DownloadTask.offHeadersReceived(listener) // 需传入与监听时同一个的函数对象
``` */
    offHeadersReceived(
      /** onHeadersReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffHeadersReceivedCallback
    ): void;
    /** [DownloadTask.offProgressUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.offProgressUpdate.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：支持
*
* 移除下载进度变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

DownloadTask.onProgressUpdate(listener)
DownloadTask.offProgressUpdate(listener) // 需传入与监听时同一个的函数对象
``` */
    offProgressUpdate(
      /** onProgressUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: DownloadTaskOffProgressUpdateCallback
    ): void;
    /** [DownloadTask.onHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.onHeadersReceived.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 监听 HTTP Response Header 事件。会比请求完成事件更早 */
    onHeadersReceived(
      /** HTTP Response Header 事件的监听函数 */
      listener: OnHeadersReceivedCallback
    ): void;
    /** [DownloadTask.onProgressUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.onProgressUpdate.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 监听下载进度变化事件 */
    onProgressUpdate(
      /** 下载进度变化事件的监听函数 */
      listener: DownloadTaskOnProgressUpdateCallback
    ): void;
  }
  interface EditorContext {
    /** [EditorContext.blur(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.blur.html)
     *
     * 需要基础库： `2.8.3`
     *
     * 在插件中使用：支持
     *
     * 编辑器失焦，同时收起键盘。 */
    blur(option?: BlurOption): void;
    /** [EditorContext.clear(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.clear.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 清空编辑器内容 */
    clear(option?: ClearOption): void;
    /** [EditorContext.format(string name, string value)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.format.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 修改样式
     *
     * ****
     *
     * ## 支持设置的样式列表
     * | name                                                      | value                           | verson |
     * | --------------------------------------------------------- | ------------------------------- | ------ |
     * | bold                                                      |                                 | 2.7.0  |
     * | italic                                                    |                                 | 2.7.0  |
     * | underline                                                 |                                 | 2.7.0  |
     * | strike                                                    |                                 | 2.7.0  |
     * | ins                                                       |                                 | 2.7.0  |
     * | script                                                    | sub / super                     | 2.7.0  |
     * | header                                                    | H1 / H2 / h3 / H4 / h5 /  H6    | 2.7.0  |
     * | align                                                     | left / center / right / justify | 2.7.0  |
     * | direction                                                 | rtl                             | 2.7.0  |
     * | indent                                                    | -1 / +1                         | 2.7.0  |
     * | list                                                      | ordered / bullet / check        | 2.7.0  |
     * | color                                                     | hex color                       | 2.7.0  |
     * | backgroundColor                                           | hex color                       | 2.7.0  |
     * | margin/marginTop/marginBottom/marginLeft/marginRight      | css style                       | 2.7.0  |
     * | padding/paddingTop/paddingBottom/paddingLeft/paddingRight | css style                       | 2.7.0  |
     * | font/fontSize/fontStyle/fontVariant/fontWeight/fontFamily | css style                       | 2.7.0  |
     * | lineHeight                                                | css style                       | 2.7.0  |
     * | letterSpacing                                             | css style                       | 2.7.0  |
     * | textDecoration                                            | css style                       | 2.7.0  |
     * | textIndent                                                | css style                       | 2.8.0  |
     * | wordWrap                                                  | css style                       | 2.10.2 |
     * | wordBreak                                                 | css style                       | 2.10.2 |
     * | whiteSpace                                                | css style                       | 2.10.2 |
     *
     * 对已经应用样式的选区设置会取消样式。css style 表示 css 中规定的允许值。 */
    format(
      /** 属性 */
      name: string,
      /** 值 */
      value?: string
    ): void;
    /** [EditorContext.getContents(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.getContents.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 获取编辑器内容 */
    getContents(option?: GetContentsOption): void;
    /** [EditorContext.getSelectionText(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.getSelectionText.html)
     *
     * 需要基础库： `2.10.2`
     *
     * 在插件中使用：支持
     *
     * 获取编辑器已选区域内的纯文本内容。当编辑器失焦或未选中一段区间时，返回内容为空。 */
    getSelectionText(option?: GetSelectionTextOption): void;
    /** [EditorContext.insertDivider(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.insertDivider.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 插入分割线 */
    insertDivider(option?: InsertDividerOption): void;
    /** [EditorContext.insertImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.insertImage.html)
*
* 需要基础库： `2.7.0`
*
* 在插件中使用：支持
*
* 插入图片。
*
* 地址为临时文件时，获取的编辑器html格式内容中 <img> 标签增加属性 data-local，delta 格式内容中图片 attributes 属性增加 data-local 字段，该值为传入的临时文件地址。
*
* 开发者可选择在提交阶段上传图片到服务器，获取到网络地址后进行替换。替换时对于html内容应替换掉 <img> 的 src 值，对于 delta 内容应替换掉 `insert { image: abc }` 值。
*
* **示例代码**
*
* ```javascript
this.editorCtx.insertImage({
  src: 'xx',
  width: '100px',
  height: '50px',
  extClass: className
})
``` */
    insertImage(option: InsertImageOption): void;
    /** [EditorContext.insertText(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.insertText.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 覆盖当前选区，设置一段文本 */
    insertText(option: InsertTextOption): void;
    /** [EditorContext.redo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.redo.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 恢复 */
    redo(option?: RedoOption): void;
    /** [EditorContext.removeFormat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.removeFormat.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 清除当前选区的样式 */
    removeFormat(option?: RemoveFormatOption): void;
    /** [EditorContext.scrollIntoView()](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.scrollIntoView.html)
     *
     * 需要基础库： `2.8.3`
     *
     * 在插件中使用：支持
     *
     * 使得编辑器光标处滚动到窗口可视区域内。 */
    scrollIntoView(): void;
    /** [EditorContext.setContents(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.setContents.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 初始化编辑器内容，html和delta同时存在时仅delta生效 */
    setContents(option: SetContentsOption): void;
    /** [EditorContext.undo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.undo.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 撤销 */
    undo(option?: UndoOption): void;
  }
  interface EntryList {
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; EntryList.getEntries()](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/EntryList.getEntries.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 该方法返回当前列表中的所有性能数据 */
    getEntries(): PerformanceEntry[];
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; EntryList.getEntriesByName(string name, string entryType)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/EntryList.getEntriesByName.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 获取当前列表中所有名称为 [name] 且类型为 [entryType] 的性能数据 */
    getEntriesByName(name: string, entryType?: string): PerformanceEntry[];
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; EntryList.getEntriesByType(string entryType)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/EntryList.getEntriesByType.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 获取当前列表中所有类型为 [entryType] 的性能数据 */
    getEntriesByType(entryType: string): PerformanceEntry[];
  }
  interface EventChannel {
    /** [EventChannel.emit(string eventName, any args)](https://developers.weixin.qq.com/miniprogram/dev/api/route/EventChannel.emit.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：支持
     *
     * 触发一个事件 */
    emit(
      /** 事件名称 */
      eventName: string,
      /** 事件参数 */
      ...args: any
    ): void;
    /** [EventChannel.off(string eventName, function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/route/EventChannel.off.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：支持
     *
     * 取消监听一个事件。给出第二个参数时，只取消给出的监听函数，否则取消所有监听函数 */
    off(
      /** 事件名称 */
      eventName: string,
      /** 事件监听函数 */
      fn: EventCallback
    ): void;
    /** [EventChannel.on(string eventName, function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/route/EventChannel.on.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：支持
     *
     * 持续监听一个事件 */
    on(
      /** 事件名称 */
      eventName: string,
      /** 事件监听函数 */
      fn: EventCallback
    ): void;
    /** [EventChannel.once(string eventName, function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/route/EventChannel.once.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：支持
     *
     * 监听一个事件一次，触发后失效 */
    once(
      /** 事件名称 */
      eventName: string,
      /** 事件监听函数 */
      fn: EventCallback
    ): void;
  }
  interface FileError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 1300001 | operation not permitted | 操作不被允许（例如，filePath 预期传入一个文件而实际传入一个目录） |
     * | 1300002 | no such file or directory ${path} | 文件/目录不存在，或者目标文件路径的上层目录不存在 |
     * | 1300005 | Input/output error | 输入输出流不可用 |
     * | 1300009 | bad file descriptor | 无效的文件描述符 |
     * | 1300013 | permission denied | 权限错误，文件是只读或只写 |
     * | 1300014 | Path permission denied | 传入的路径没有权限 |
     * | 1300020 | not a directory | dirPath 指定路径不是目录，常见于指定的写入路径的上级路径为一个文件的情况 |
     * | 1300021 | Is a directory | 指定路径是一个目录 |
     * | 1300022 | Invalid argument | 无效参数，可以检查length或offset是否越界 |
     * | 1300036 | File name too long | 文件名过长 |
     * | 1300066 | directory not empty | 目录不为空 |
     * | 1300201 | system error | 系统接口调用失败 |
     * | 1300202 | the maximum size of the file storage limit is exceeded | 存储空间不足，或文件大小超出上限（上限100M） |
     * | 1300203 | base64 encode error | 字符编码转换失败（例如 base64 格式错误） |
     * | 1300300 | sdcard not mounted | android sdcard 挂载失败 |
     * | 1300301 | unable to open as fileType | 无法以fileType打开文件 |
     * | 1301000 | permission denied, cannot access file path | 目标路径无访问权限（usr目录） |
     * | 1301002 | data to write is empty | 写入数据为空 |
     * | 1301003 | illegal operation on a directory | 不可对目录进行此操作（例如，指定的 filePath 是一个已经存在的目录） |
     * | 1301004 | illegal operation on a package directory | 不可对代码包目录进行此操作 |
     * | 1301005 | file already exists ${dirPath} | 已有同名文件或目录 |
     * | 1301006 | value of length is out of range | 传入的 length 不合法 |
     * | 1301007 | value of offset is out of range | 传入的 offset 不合法 |
     * | 1301009 | value of position is out of range | position值越界 |
     * | 1301100 | store directory is empty | store目录为空 |
     * | 1301102 | unzip open file fail | 压缩文件打开失败 |
     * | 1301103 | unzip entry fail | 解压单个文件失败 |
     * | 1301104 | unzip fail | 解压失败 |
     * | 1301111 | brotli decompress fail | brotli解压失败（例如，指定的 compressionAlgorithm 与文件实际压缩格式不符） |
     * | 1301112 | tempFilePath file not exist | 指定的 tempFilePath 找不到文件 |
     * | 1302001 | fail permission denied | 指定的 fd 路径没有读权限/没有写权限 |
     * | 1302002 | excced max concurrent fd limit | fd数量已达上限 |
     * | 1302003 | invalid flag | 无效的flag |
     * | 1302004 | permission denied when open using flag | 无法使用flag标志打开文件 |
     * | 1302005 | array buffer does not exist | 未传入arrayBuffer |
     * | 1302100 | array buffer is readonly | arrayBuffer只读 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 1300001 | operation not permitted | 操作不被允许（例如，filePath 预期传入一个文件而实际传入一个目录） |
     * | 1300002 | no such file or directory ${path} | 文件/目录不存在，或者目标文件路径的上层目录不存在 |
     * | 1300005 | Input/output error | 输入输出流不可用 |
     * | 1300009 | bad file descriptor | 无效的文件描述符 |
     * | 1300013 | permission denied | 权限错误，文件是只读或只写 |
     * | 1300014 | Path permission denied | 传入的路径没有权限 |
     * | 1300020 | not a directory | dirPath 指定路径不是目录，常见于指定的写入路径的上级路径为一个文件的情况 |
     * | 1300021 | Is a directory | 指定路径是一个目录 |
     * | 1300022 | Invalid argument | 无效参数，可以检查length或offset是否越界 |
     * | 1300036 | File name too long | 文件名过长 |
     * | 1300066 | directory not empty | 目录不为空 |
     * | 1300201 | system error | 系统接口调用失败 |
     * | 1300202 | the maximum size of the file storage limit is exceeded | 存储空间不足，或文件大小超出上限（上限100M） |
     * | 1300203 | base64 encode error | 字符编码转换失败（例如 base64 格式错误） |
     * | 1300300 | sdcard not mounted | android sdcard 挂载失败 |
     * | 1300301 | unable to open as fileType | 无法以fileType打开文件 |
     * | 1301000 | permission denied, cannot access file path | 目标路径无访问权限（usr目录） |
     * | 1301002 | data to write is empty | 写入数据为空 |
     * | 1301003 | illegal operation on a directory | 不可对目录进行此操作（例如，指定的 filePath 是一个已经存在的目录） |
     * | 1301004 | illegal operation on a package directory | 不可对代码包目录进行此操作 |
     * | 1301005 | file already exists ${dirPath} | 已有同名文件或目录 |
     * | 1301006 | value of length is out of range | 传入的 length 不合法 |
     * | 1301007 | value of offset is out of range | 传入的 offset 不合法 |
     * | 1301009 | value of position is out of range | position值越界 |
     * | 1301100 | store directory is empty | store目录为空 |
     * | 1301102 | unzip open file fail | 压缩文件打开失败 |
     * | 1301103 | unzip entry fail | 解压单个文件失败 |
     * | 1301104 | unzip fail | 解压失败 |
     * | 1301111 | brotli decompress fail | brotli解压失败（例如，指定的 compressionAlgorithm 与文件实际压缩格式不符） |
     * | 1301112 | tempFilePath file not exist | 指定的 tempFilePath 找不到文件 |
     * | 1302001 | fail permission denied | 指定的 fd 路径没有读权限/没有写权限 |
     * | 1302002 | excced max concurrent fd limit | fd数量已达上限 |
     * | 1302003 | invalid flag | 无效的flag |
     * | 1302004 | permission denied when open using flag | 无法使用flag标志打开文件 |
     * | 1302005 | array buffer does not exist | 未传入arrayBuffer |
     * | 1302100 | array buffer is readonly | arrayBuffer只读 | */ errCode: number;
  }
  interface FileSystemManager {
    /** [Array.&lt;string&gt; FileSystemManager.readdirSync(string dirPath)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readdirSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.readdir](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readdir.html) 的同步版本
*
* **注意事项</title>
* - readdir接口无法访问文件系统根路径(wxfile://)。
* <title>示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.readdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  success(res) {
    console.log(res.files)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.readdirSync(`${wx.env.USER_DATA_PATH}/example`)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    readdirSync(
      /** 要读取的目录路径 (本地路径) */
      dirPath: string
    ): string[];
    /** [ArrayBuffer FileSystemManager.readCompressedFileSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readCompressedFileSync.html)
*
* 需要基础库： `2.21.1`
*
* 在插件中使用：不支持
*
* 同步读取指定压缩类型的本地文件内容
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()

// 异步接口
fs.readCompressedFile({
  filePath: '${wx.env.USER_DATA_PATH}/hello.br',
  compressionAlgorithm: 'br',
  success(res) {
    console.log(res.data)
  },
  fail(res) {
    console.log('readCompressedFile fail', res)
  }
})

// 同步接口
try {
  const data = fs.readCompressedFileSync({
    filePath: '${wx.env.USER_DATA_PATH}/hello.br',
    compressionAlgorithm: 'br',
  })
  console.log(data)
} catch (err) {
  console.log(err)
}
``` */
    readCompressedFileSync(option: ReadCompressedFileSyncOption): ArrayBuffer;
    /** [FileSystemManager.access(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.access.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 判断文件/目录是否存在
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 判断文件/目录是否存在
fs.access({
  path: `${wx.env.USER_DATA_PATH}/hello.txt`,
  success(res) {
    // 文件存在
    console.log(res)
  },
  fail(res) {
    // 文件不存在或其他错误
    console.error(res)
  }
})

// 同步接口
try {
  fs.accessSync(`${wx.env.USER_DATA_PATH}/hello.txt`)
} catch(e) {
  console.error(e)
}
``` */
    access(option: AccessOption): void;
    /** [FileSystemManager.accessSync(string path)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.accessSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.access](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.access.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 判断文件/目录是否存在
fs.access({
  path: `${wx.env.USER_DATA_PATH}/hello.txt`,
  success(res) {
    // 文件存在
    console.log(res)
  },
  fail(res) {
    // 文件不存在或其他错误
    console.error(res)
  }
})

// 同步接口
try {
  fs.accessSync(`${wx.env.USER_DATA_PATH}/hello.txt`)
} catch(e) {
  console.error(e)
}
``` */
    accessSync(
      /** 要判断是否存在的文件/目录路径 (本地路径) */
      path: string
    ): void;
    /** [FileSystemManager.appendFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.appendFile.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 在文件结尾追加内容
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()

fs.appendFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  data: 'some text',
  encoding: 'utf8',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.appendFileSync(`${wx.env.USER_DATA_PATH}/hello.txt`, 'some text', 'utf8')
} catch(e) {
  console.error(e)
}
``` */
    appendFile(option: AppendFileOption): void;
    /** [FileSystemManager.appendFileSync(string filePath, string|ArrayBuffer data, string encoding)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.appendFileSync.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.appendFile](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.appendFile.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()

fs.appendFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  data: 'some text',
  encoding: 'utf8',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.appendFileSync(`${wx.env.USER_DATA_PATH}/hello.txt`, 'some text', 'utf8')
} catch(e) {
  console.error(e)
}
``` */
    appendFileSync(
      /** 要追加内容的文件路径 (本地路径) */
      filePath: string,
      /** 要追加的文本或二进制数据 */
      data: string | ArrayBuffer,
      /** 指定写入文件的字符编码
       *
       * 参数 encoding 可选值：
       * - 'ascii': ;
       * - 'base64': ;
       * - 'binary': ;
       * - 'hex': ;
       * - 'ucs2': 以小端序读取;
       * - 'ucs-2': 以小端序读取;
       * - 'utf16le': 以小端序读取;
       * - 'utf-16le': 以小端序读取;
       * - 'utf-8': ;
       * - 'utf8': ;
       * - 'latin1': ; */
      encoding?:
        | 'ascii'
        | 'base64'
        | 'binary'
        | 'hex'
        | 'ucs2'
        | 'ucs-2'
        | 'utf16le'
        | 'utf-16le'
        | 'utf-8'
        | 'utf8'
        | 'latin1'
    ): void;
    /** [FileSystemManager.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.close.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 关闭文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 打开文件
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    // 关闭文件
    fs.close({
      fd: res.fd
    })
  }
})
``` */
    close(option: FileSystemManagerCloseOption): void;
    /** [FileSystemManager.copyFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.copyFile.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 复制文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.copyFile({
  srcPath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  destPath: `${wx.env.USER_DATA_PATH}/hello_copy.txt`
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.copyFileSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    `${wx.env.USER_DATA_PATH}/hello_copy.txt`
  )
} catch(e) {
  console.error(e)
}
``` */
    copyFile(option: CopyFileOption): void;
    /** [FileSystemManager.copyFileSync(string srcPath, string destPath)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.copyFileSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.copyFile](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.copyFile.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.copyFile({
  srcPath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  destPath: `${wx.env.USER_DATA_PATH}/hello_copy.txt`
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.copyFileSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    `${wx.env.USER_DATA_PATH}/hello_copy.txt`
  )
} catch(e) {
  console.error(e)
}
``` */
    copyFileSync(
      /** 源文件路径，支持本地路径 */
      srcPath: string,
      /** 目标文件路径，支持本地路径 */
      destPath: string
    ): void;
    /** [FileSystemManager.fstat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.fstat.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 获取文件的状态信息
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 打开文件
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    // 获取文件的状态信息
    fs.fstat({
      fd: res.fd,
      success(res) {
        console.log(res.stats)
      }
    })
  }
})
``` */
    fstat(option: FstatOption): void;
    /** [FileSystemManager.ftruncate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.ftruncate.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 对文件内容进行截断操作
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 打开文件
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    // 对文件内容进行截断操作
    fs.ftruncate({
      fd: res.fd,
      length: 10, // 从第10个字节开始截断文件
      success(res) {
        console.log(res)
      }
    })
  }
})
``` */
    ftruncate(option: FtruncateOption): void;
    /** [FileSystemManager.getFileInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.getFileInfo.html)
     *
     * 在插件中使用：不支持
     *
     * 获取该小程序下的 本地临时文件 或 本地缓存文件 信息 */
    getFileInfo(option: GetFileInfoOption): void;
    /** [FileSystemManager.getSavedFileList(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.getSavedFileList.html)
     *
     * 在插件中使用：不支持
     *
     * 获取该小程序下已保存的本地缓存文件列表 */
    getSavedFileList(option?: GetSavedFileListOption): void;
    /** [FileSystemManager.mkdir(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.mkdir.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 创建目录
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.mkdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  recursive: false
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.mkdirSync(`${wx.env.USER_DATA_PATH}/example`, false)
} catch(e) {
  console.error(e)
}
``` */
    mkdir(option: MkdirOption): void;
    /** [FileSystemManager.mkdirSync(string dirPath, boolean recursive)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.mkdirSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.mkdir](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.mkdir.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.mkdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  recursive: false
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  fs.mkdirSync(`${wx.env.USER_DATA_PATH}/example`, false)
} catch(e) {
  console.error(e)
}
``` */
    mkdirSync(
      /** 创建的目录路径 (本地路径) */
      dirPath: string,
      /** 需要基础库： `2.3.0`
       *
       * 是否在递归创建该目录的上级目录后再创建该目录。如果对应的上级目录已经存在，则不创建该上级目录。如 dirPath 为 a/b/c/d 且 recursive 为 true，将创建 a 目录，再在 a 目录下创建 b 目录，以此类推直至创建 a/b/c 目录下的 d 目录。 */
      recursive?: boolean
    ): void;
    /** [FileSystemManager.open(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.open.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 打开文件，返回文件描述符
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    console.log(res.fd)
  }
})
``` */
    open(option: OpenOption): void;
    /** [FileSystemManager.read(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.read.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 读文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const ab = new ArrayBuffer(1024)
// 打开文件
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    // 读取文件到 ArrayBuffer 中
    fs.read({
      fd: res.fd,
      arrayBuffer: ab,
      length: 10,
      success(res) {
        console.log(res)
      }
    })
  }
})
``` */
    read(option: ReadOption): void;
    /** [FileSystemManager.readCompressedFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readCompressedFile.html)
*
* 需要基础库： `2.21.1`
*
* 在插件中使用：不支持
*
* 读取指定压缩类型的本地文件内容
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()

// 异步接口
fs.readCompressedFile({
  filePath: '${wx.env.USER_DATA_PATH}/hello.br',
  compressionAlgorithm: 'br',
  success(res) {
    console.log(res.data)
  },
  fail(res) {
    console.log('readCompressedFile fail', res)
  }
})

// 同步接口
const data = fs.readCompressedFileSync({
  filePath: '${wx.env.USER_DATA_PATH}/hello.br',
  compressionAlgorithm: 'br',
})
console.log(data)
``` */
    readCompressedFile(option: ReadCompressedFileOption): void;
    /** [FileSystemManager.readFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readFile.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 读取本地文件内容。单个文件大小上限为100M。
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.readFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  encoding: 'utf8',
  position: 0,
  success(res) {
    console.log(res.data)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.readFileSync(`${wx.env.USER_DATA_PATH}/hello.txt`, 'utf8', 0)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    readFile(option: ReadFileOption): void;
    /** [FileSystemManager.readZipEntry(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readZipEntry.html)
*
* 需要基础库： `2.17.3`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 读取压缩包内的文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 读取zip内某个或多个文件
fs.readZipEntry({
  filePath: 'wxfile://from/to.zip',
  entries: [{
    path: 'some_folder/my_file.txt', // zip内文件路径
    encoding: 'utf-8', // 指定读取文件的字符编码，如果不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
    position: 0, // 从文件指定位置开始读，如果不指定，则从文件头开始读。读取的范围应该是左闭右开区间 [position, position+length)。有效范围：[0, fileLength - 1]。单位：byte
    length: 10000, // 指定文件的长度，如果不指定，则读到文件末尾。有效范围：[1, fileLength]。单位：byte
  }, {
    path: 'other_folder/orther_file.txt', // zip内文件路径
  }],
  success(res) {
    console.log(res.entries)
    // res.entries === {
    //     'some_folder/my_file.txt': {
    //         errMsg: 'readZipEntry:ok',
    //         data: 'xxxxxx'
    //     },
    //     'other_folder/orther_file.txt': {
    //         data: (ArrayBuffer)
    //     }
    // }
  },
  fail(res) {
    console.log(res.errMsg)
  },
})

// 读取zip内所有文件。允许指定统一的encoding。position、length则不再允许指定，分别默认为0和文件长度
fs.readZipEntry({
  filePath: 'wxfile://from/to.zip',
  entries: 'all'
  encoding: 'utf-8', // 统一指定读取文件的字符编码，如果不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
  success(res) {
    console.log(res.entries)
    // res.entries === {
    //     'some_folder/my_file.txt': {
    //         errMsg: 'readZipEntry:ok',
    //         data: 'xxxxxx'
    //     },
    //     'other_folder/orther_file.txt': {
    //         errMsg: 'readZipEntry:ok',
    //         data: 'xxxxxx'
    //     }
    //  }
  },
  fail(res) {
    console.log(res.errMsg)
  },
})
``` */
    readZipEntry(option: ReadZipEntryOption): void;
    /** [FileSystemManager.readdir(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readdir.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 读取目录内文件列表
*
* **注意事项</title>
* - readdir接口无法访问文件系统根路径(wxfile://)。
* <title>示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.readdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  success(res) {
    console.log(res.files)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.readdirSync(`${wx.env.USER_DATA_PATH}/example`)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    readdir(option: ReaddirOption): void;
    /** [FileSystemManager.removeSavedFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.removeSavedFile.html)
     *
     * 在插件中使用：不支持
     *
     * 删除该小程序下已保存的本地缓存文件 */
    removeSavedFile(option: RemoveSavedFileOption): void;
    /** [FileSystemManager.rename(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.rename.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 重命名文件。可以把文件从 oldPath 移动到 newPath
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.rename({
  oldPath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  newPath: `${wx.env.USER_DATA_PATH}/hello_new.txt`,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.renameSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    `${wx.env.USER_DATA_PATH}/hello_new.txt`
  )
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    rename(option: RenameOption): void;
    /** [FileSystemManager.renameSync(string oldPath, string newPath)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.renameSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.rename](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.rename.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.rename({
  oldPath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  newPath: `${wx.env.USER_DATA_PATH}/hello_new.txt`,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.renameSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    `${wx.env.USER_DATA_PATH}/hello_new.txt`
  )
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    renameSync(
      /** 源文件路径，支持本地路径 */
      oldPath: string,
      /** 新文件路径，支持本地路径 */
      newPath: string
    ): void;
    /** [FileSystemManager.rmdir(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.rmdir.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 删除目录
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.rmdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  recursive: false,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.rmdirSync(`${wx.env.USER_DATA_PATH}/example`, false)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    rmdir(option: RmdirOption): void;
    /** [FileSystemManager.rmdirSync(string dirPath, boolean recursive)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.rmdirSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.rmdir](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.rmdir.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.rmdir({
  dirPath: `${wx.env.USER_DATA_PATH}/example`,
  recursive: false,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.rmdirSync(`${wx.env.USER_DATA_PATH}/example`, false)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    rmdirSync(
      /** 要删除的目录路径 (本地路径) */
      dirPath: string,
      /** 需要基础库： `2.3.0`
       *
       * 是否递归删除目录。如果为 true，则删除该目录和该目录下的所有子目录以及文件。 */
      recursive?: boolean
    ): void;
    /** [FileSystemManager.saveFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.saveFile.html)
     *
     * 在插件中使用：不支持
     *
     * 保存临时文件到本地。此接口会移动临时文件，因此调用成功后，tempFilePath 将不可用。 */
    saveFile(option: SaveFileOption): void;
    /** [FileSystemManager.stat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.stat.html)
     *
     * 在插件中使用：需要基础库 `2.19.2`
     *
     * 获取文件 Stats 对象 */
    stat(option: StatOption): void;
    /** [FileSystemManager.truncate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.truncate.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 对文件内容进行截断操作
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.truncate({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  length: 10, // 从第10个字节开始截断
  success(res) {
    console.log(res)
  }
})
``` */
    truncate(option: TruncateOption): void;
    /** [FileSystemManager.unlink(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.unlink.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 删除文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.unlink({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.unlinkSync(`${wx.env.USER_DATA_PATH}/hello.txt`)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    unlink(option: UnlinkOption): void;
    /** [FileSystemManager.unlinkSync(string filePath)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.unlinkSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.unlink](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.unlink.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.unlink({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.unlinkSync(`${wx.env.USER_DATA_PATH}/hello.txt`)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    unlinkSync(
      /** 要删除的文件路径 (本地路径) */
      filePath: string
    ): void;
    /** [FileSystemManager.unzip(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.unzip.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 解压文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.unzip({
  zipFilePath: `${wx.env.USER_DATA_PATH}/example.zip`,
  targetPath: '${wx.env.USER_DATA_PATH}/example',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})
``` */
    unzip(option: UnzipOption): void;
    /** [FileSystemManager.write(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.write.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 写入文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
// 打开文件
fs.open({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+',
  success(res) {
    // 写入文件
    fs.write({
      fd: res.fd,
      data: 'some text',
      success(res) {
        console.log(res.bytesWritten)
      }
    })
  }
})
``` */
    write(option: WriteOption): void;
    /** [FileSystemManager.writeFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.writeFile.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 写文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.writeFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  data: 'some text or arrayBuffer',
  encoding: 'utf8',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.writeFileSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    'some text or arrayBuffer',
    'utf8'
  )
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    writeFile(option: WriteFileOption): void;
    /** [FileSystemManager.writeFileSync(string filePath, string|ArrayBuffer data, string encoding)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.writeFileSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.writeFile](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.writeFile.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.writeFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  data: 'some text or arrayBuffer',
  encoding: 'utf8',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.writeFileSync(
    `${wx.env.USER_DATA_PATH}/hello.txt`,
    'some text or arrayBuffer',
    'utf8'
  )
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    writeFileSync(
      /** 要写入的文件路径 (本地路径) */
      filePath: string,
      /** 要写入的文本或二进制数据 */
      data: string | ArrayBuffer,
      /** 指定写入文件的字符编码
       *
       * 参数 encoding 可选值：
       * - 'ascii': ;
       * - 'base64': （注意，选择 base64 编码，data 只需要传 base64 内容本身，不要传 Data URI 前缀，否则会报 fail base64 encode error 错误。例如，传 aGVsbG8= 而不是传 data:image/png;base64,aGVsbG8= ）;
       * - 'binary': ;
       * - 'hex': ;
       * - 'ucs2': 以小端序读取;
       * - 'ucs-2': 以小端序读取;
       * - 'utf16le': 以小端序读取;
       * - 'utf-16le': 以小端序读取;
       * - 'utf-8': ;
       * - 'utf8': ;
       * - 'latin1': ; */
      encoding?:
        | 'ascii'
        | 'base64'
        | 'binary'
        | 'hex'
        | 'ucs2'
        | 'ucs-2'
        | 'utf16le'
        | 'utf-16le'
        | 'utf-8'
        | 'utf8'
        | 'latin1'
    ): void;
    /** [[ReadResult](https://developers.weixin.qq.com/miniprogram/dev/api/file/ReadResult.html) FileSystemManager.readSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 读文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const ab = new ArrayBuffer(1024)
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})
const res = fs.readSync({
  fd: fd,
  arrayBuffer: ab,
  length: 10
})
console.log(res)
``` */
    readSync(option: ReadSyncOption): ReadResult;
    /** [[Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html) FileSystemManager.fstatSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.fstatSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 同步获取文件的状态信息
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})
const stats = fs.fstatSync({fd: fd})
console.log(stats)
``` */
    fstatSync(option: FstatSyncOption): Stats;
    /** [[Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html)|Array.&lt;[Stats](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.html)&gt; FileSystemManager.statSync(string path, boolean recursive)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.statSync.html)
     *
     * 在插件中使用：需要基础库 `2.19.2`
     *
     * [FileSystemManager.stat](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.stat.html) 的同步版本 */
    statSync(
      /** 文件/目录路径 (本地路径) */
      path: string,
      /** 需要基础库： `2.3.0`
       *
       * 是否递归获取目录下的每个文件的 Stats 信息 */
      recursive?: boolean
    ): Stats | Stats[];
    /** [[WriteResult](https://developers.weixin.qq.com/miniprogram/dev/api/file/WriteResult.html) FileSystemManager.writeSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.writeSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 同步写入文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})
const res = fs.writeSync({
  fd: fd,
  data: 'some text'
})
console.log(res.bytesWritten)
``` */
    writeSync(option: WriteSyncOption): WriteResult;
    /** [string FileSystemManager.openSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.openSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 同步打开文件，返回文件描述符
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})
console.log(fd)
``` */
    openSync(option: OpenSyncOption): string;
    /** [string FileSystemManager.saveFileSync(string tempFilePath, string filePath)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.saveFileSync.html)
     *
     * 在插件中使用：不支持
     *
     * [FileSystemManager.saveFile](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.saveFile.html) 的同步版本 */
    saveFileSync(
      /** 临时存储文件路径 (本地路径) */
      tempFilePath: string,
      /** 要存储的文件路径 (本地路径) */
      filePath?: string
    ): string;
    /** [string|ArrayBuffer FileSystemManager.readFileSync(string filePath, string encoding, number position, number length)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readFileSync.html)
*
* 在插件中使用：需要基础库 `2.19.2`
*
* [FileSystemManager.readFile](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.readFile.html) 的同步版本
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.readFile({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  encoding: 'utf8',
  position: 0,
  success(res) {
    console.log(res.data)
  },
  fail(res) {
    console.error(res)
  }
})

// 同步接口
try {
  const res = fs.readFileSync(`${wx.env.USER_DATA_PATH}/hello.txt`, 'utf8', 0)
  console.log(res)
} catch(e) {
  console.error(e)
}
``` */
    readFileSync(
      /** 要读取的文件的路径 (本地路径) */
      filePath: string,
      /** 指定读取文件的字符编码，如果不传 encoding，则以 ArrayBuffer 格式读取文件的二进制内容
       *
       * 参数 encoding 可选值：
       * - 'ascii': ;
       * - 'base64': ;
       * - 'binary': ;
       * - 'hex': ;
       * - 'ucs2': 以小端序读取;
       * - 'ucs-2': 以小端序读取;
       * - 'utf16le': 以小端序读取;
       * - 'utf-16le': 以小端序读取;
       * - 'utf-8': ;
       * - 'utf8': ;
       * - 'latin1': ; */
      encoding?:
        | 'ascii'
        | 'base64'
        | 'binary'
        | 'hex'
        | 'ucs2'
        | 'ucs-2'
        | 'utf16le'
        | 'utf-16le'
        | 'utf-8'
        | 'utf8'
        | 'latin1',
      /** 需要基础库： `2.10.0`
       *
       * 从文件指定位置开始读，如果不指定，则从文件头开始读。读取的范围应该是左闭右开区间 [position, position+length)。有效范围：[0, fileLength - 1]。单位：byte */
      position?: number,
      /** 需要基础库： `2.10.0`
       *
       * 指定文件的长度，如果不指定，则读到文件末尾。有效范围：[1, fileLength]。单位：byte */
      length?: number
    ): string | ArrayBuffer;
    /** [undefined FileSystemManager.closeSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.closeSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 同步关闭文件
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})

// 关闭文件
fs.closeSync({fd: fd})
``` */
    closeSync(option: CloseSyncOption): undefined;
    /** [undefined FileSystemManager.ftruncateSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.ftruncateSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 对文件内容进行截断操作
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
const fd = fs.openSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  flag: 'a+'
})
fs.ftruncateSync({
  fd: fd,
  length: 10 // 从第10个字节开始截断文件
})
``` */
    ftruncateSync(option: FtruncateSyncOption): undefined;
    /** [undefined FileSystemManager.truncateSync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.truncateSync.html)
*
* 需要基础库： `2.16.1`
*
* 在插件中使用：需要基础库 `2.19.2`
*
* 对文件内容进行截断操作 (truncate 的同步版本)
*
* **示例代码**
*
* ```js
const fs = wx.getFileSystemManager()
fs.truncateSync({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  length: 10, // 从第10个字节开始截断
})
``` */
    truncateSync(option: TruncateSyncOption): undefined;
  }
  interface InferenceSession {
    /** [InferenceSession.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.destroy.html)
*
* 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* 销毁 InferenceSession 实例
*
* **示例代码**
*
* ```js
// 销毁会话
session.destroy()
``` */
    destroy(): void;
    /** [InferenceSession.offError(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.offError.html)
     *
     * 需要基础库： `2.30.0`
     *
     * 在插件中使用：需要基础库 `2.30.0`
     *
     * 取消监听模型加载失败事件 */
    offError(
      /** 模型加载失败回调函数。传入指定回调函数则只取消指定回调，不传则取消所有回调 */
      callback: (...args: any[]) => any
    ): void;
    /** [InferenceSession.offLoad(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.offLoad.html)
     *
     * 需要基础库： `2.30.0`
     *
     * 在插件中使用：需要基础库 `2.30.0`
     *
     * 取消监听模型加载完成事件 */
    offLoad(
      /** 模型加载完成回调函数。传入指定回调函数则只取消指定回调，不传则取消所有回调 */
      callback: (...args: any[]) => any
    ): void;
    /** [InferenceSession.onError(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.onError.html)
*
* 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* 监听模型加载失败事件
*
* **示例代码**
*
* ```js
// 创建会话，加载模型
const session = wx.createInferenceSession({
  model: `${wx.env.USER_DATA_PATH}/MNIST.onnx`,
  precisionLevel: 4,
  typicalShape:{input1:[1, 3, 224, 224], input2:[1, 1, 224, 224]},  //除非使用动态轴，一般不用显式指定
  allowNPU: false,
  allowQuantize: false
})

// 监听error事件
session.onError(err => {
  console.error(err)
})
``` */
    onError(
      /** 模型加载失败回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [InferenceSession.onLoad(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.onLoad.html)
*
* 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* 监听模型加载完成事件
*
* **示例代码**
*
* ```js
// 创建会话，加载模型
const session = wx.createInferenceSession({
  model: `${wx.env.USER_DATA_PATH}/MNIST.onnx`,
  precisionLevel: 4,
  typicalShape:{input1:[1, 3, 224, 224], input2:[1, 1, 224, 224]},  //除非使用动态轴，一般不用显式指定
  allowNPU: false,
  allowQuantize: false
})

// 监听模型加载完成事件
session.onLoad(() => {
  // 运行推理
  // 其中input1, input2, output0 必须与使用的onnx模型中实际的输入输出名字完全一致，不可随意填写。
  // 模型输入输出信息可以通过Netron 打开onnx模型看到
  session.run({
    input1: {
      type: 'float32',
      data: new Float32Array(3 * 224 * 224).buffer,
      shape: [1, 3, 224, 224] // NCHW 顺序
    },
    // 多个input的添加方法，假设第二个input需要数据类型为uint8
    input2: {
      type: 'uint8',
      data: new Uint8Array(224 * 224).buffer,
      shape: [1, 1, 224, 224]
    },
  }).then(res => {
    console.log(res.output0)
  })
})
``` */
    onLoad(
      /** 模型加载完成回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [Promise<[Tensors](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/Tensors.html)> InferenceSession.run([Tensors](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/Tensors.html) tensors)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.run.html)
*
* 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* 运行推断。需要在 session.onLoad 回调后使用。接口参数为 Tensors 对象，返回 Promise。一个 InferenceSession 被创建完成后可以重复多次调用 InferenceSession.run(), 直到调用 session.destroy() 进行销毁。
*
* **示例代码**
*
* ```js
// 创建会话，加载模型
const session = wx.createInferenceSession({
  model: `${wx.env.USER_DATA_PATH}/MNIST.onnx`,
  precisionLevel: 4,
  typicalShape:{input1:[1, 3, 224, 224], input2:[1, 1, 224, 224]},  //除非使用动态轴，一般不用显式指定
  allowNPU: false,
  allowQuantize: false
})

// 监听模型加载完成事件
session.onLoad(() => {
  // 运行推理
  // 其中input1, input2, output0 必须与使用的onnx模型中实际的输入输出名字完全一致，不可随意填写。
  // 模型输入输出信息可以通过Netron 打开onnx模型看到
  session.run({
    input1: {
      type: 'float32',
      data: new Float32Array(3 * 224 * 224).buffer,
      shape: [1, 3, 224, 224] // NCHW 顺序
    },
    // 多个input的添加方法，假设第二个input需要数据类型为uint8
    input2: {
      type: 'uint8',
      data: new Uint8Array(224 * 224).buffer,
      shape: [1, 1, 224, 224]
    },
  }).then(res => {
    console.log(res.output0)
  })
})
``` */
    run(
      /** [Tensors](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/Tensors.html)
       *
       * key-value 形式的对象，对象的 key 会作为 input name，对象的 value 则是 Tensor。 Tensor 结构如下。 */
      tensors: Tensors
    ): Promise<Tensors>;
  }
  interface InnerAudioContext {
    /** [InnerAudioContext.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.destroy.html)
     *
     * 在插件中使用：支持
     *
     * 销毁当前实例 */
    destroy(): void;
    /** [InnerAudioContext.offCanplay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offCanplay.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频进入可以播放状态的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onCanplay(listener)
InnerAudioContext.offCanplay(listener) // 需传入与监听时同一个的函数对象
``` */
    offCanplay(
      /** onCanplay 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCanplayCallback
    ): void;
    /** [InnerAudioContext.offEnded(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offEnded.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频自然播放至结束的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onEnded(listener)
InnerAudioContext.offEnded(listener) // 需传入与监听时同一个的函数对象
``` */
    offEnded(
      /** onEnded 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffEndedCallback
    ): void;
    /** [InnerAudioContext.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offError.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频播放错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onError(listener)
InnerAudioContext.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: InnerAudioContextOffErrorCallback
    ): void;
    /** [InnerAudioContext.offPause(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offPause.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频暂停事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onPause(listener)
InnerAudioContext.offPause(listener) // 需传入与监听时同一个的函数对象
``` */
    offPause(
      /** onPause 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffPauseCallback
    ): void;
    /** [InnerAudioContext.offPlay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offPlay.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频播放事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onPlay(listener)
InnerAudioContext.offPlay(listener) // 需传入与监听时同一个的函数对象
``` */
    offPlay(
      /** onPlay 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffPlayCallback
    ): void;
    /** [InnerAudioContext.offSeeked(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offSeeked.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频完成跳转操作的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onSeeked(listener)
InnerAudioContext.offSeeked(listener) // 需传入与监听时同一个的函数对象
``` */
    offSeeked(
      /** onSeeked 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffSeekedCallback
    ): void;
    /** [InnerAudioContext.offSeeking(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offSeeking.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频进行跳转操作的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onSeeking(listener)
InnerAudioContext.offSeeking(listener) // 需传入与监听时同一个的函数对象
``` */
    offSeeking(
      /** onSeeking 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffSeekingCallback
    ): void;
    /** [InnerAudioContext.offStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offStop.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频停止事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onStop(listener)
InnerAudioContext.offStop(listener) // 需传入与监听时同一个的函数对象
``` */
    offStop(
      /** onStop 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffStopCallback
    ): void;
    /** [InnerAudioContext.offTimeUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offTimeUpdate.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频播放进度更新事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onTimeUpdate(listener)
InnerAudioContext.offTimeUpdate(listener) // 需传入与监听时同一个的函数对象
``` */
    offTimeUpdate(
      /** onTimeUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffTimeUpdateCallback
    ): void;
    /** [InnerAudioContext.offWaiting(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.offWaiting.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：支持
*
* 移除音频加载中事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InnerAudioContext.onWaiting(listener)
InnerAudioContext.offWaiting(listener) // 需传入与监听时同一个的函数对象
``` */
    offWaiting(
      /** onWaiting 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffWaitingCallback
    ): void;
    /** [InnerAudioContext.onCanplay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onCanplay.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频进入可以播放状态的事件。但不保证后面可以流畅播放 */
    onCanplay(
      /** 音频进入可以播放状态的事件的监听函数 */
      listener: OnCanplayCallback
    ): void;
    /** [InnerAudioContext.onEnded(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onEnded.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频自然播放至结束的事件 */
    onEnded(
      /** 音频自然播放至结束的事件的监听函数 */
      listener: OnEndedCallback
    ): void;
    /** [InnerAudioContext.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onError.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频播放错误事件
     *
     * **Tips**
     *
     * 1. errCode=100001 时，如若 errMsg 中有 INNERCODE -11828 ，请先检查 response header 是否缺少 Content-Length
     * 2. errCode=100001 时，如若 errMsg 中有 systemErrCode:200333420，请检查文件编码格式和 fileExtension 是否一致 */
    onError(
      /** 音频播放错误事件的监听函数 */
      listener: InnerAudioContextOnErrorCallback
    ): void;
    /** [InnerAudioContext.onPause(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onPause.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频暂停事件 */
    onPause(
      /** 音频暂停事件的监听函数 */
      listener: OnPauseCallback
    ): void;
    /** [InnerAudioContext.onPlay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onPlay.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频播放事件 */
    onPlay(
      /** 音频播放事件的监听函数 */
      listener: OnPlayCallback
    ): void;
    /** [InnerAudioContext.onSeeked(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onSeeked.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频完成跳转操作的事件 */
    onSeeked(
      /** 音频完成跳转操作的事件的监听函数 */
      listener: OnSeekedCallback
    ): void;
    /** [InnerAudioContext.onSeeking(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onSeeking.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频进行跳转操作的事件 */
    onSeeking(
      /** 音频进行跳转操作的事件的监听函数 */
      listener: OnSeekingCallback
    ): void;
    /** [InnerAudioContext.onStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onStop.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频停止事件 */
    onStop(
      /** 音频停止事件的监听函数 */
      listener: InnerAudioContextOnStopCallback
    ): void;
    /** [InnerAudioContext.onTimeUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onTimeUpdate.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频播放进度更新事件 */
    onTimeUpdate(
      /** 音频播放进度更新事件的监听函数 */
      listener: OnTimeUpdateCallback
    ): void;
    /** [InnerAudioContext.onWaiting(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.onWaiting.html)
     *
     * 在插件中使用：支持
     *
     * 监听音频加载中事件。当音频因为数据不足，需要停下来加载时会触发 */
    onWaiting(
      /** 音频加载中事件的监听函数 */
      listener: OnWaitingCallback
    ): void;
    /** [InnerAudioContext.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.pause.html)
     *
     * 在插件中使用：支持
     *
     * 暂停。暂停后的音频再播放会从暂停处开始播放 */
    pause(): void;
    /** [InnerAudioContext.play()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.play.html)
     *
     * 在插件中使用：支持
     *
     * 播放 */
    play(): void;
    /** [InnerAudioContext.seek(number position)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.seek.html)
     *
     * 在插件中使用：支持
     *
     * 跳转到指定位置 */
    seek(
      /** 跳转的时间，单位 s。精确到小数点后 3 位，即支持 ms 级别精确度 */
      position: number
    ): void;
    /** [InnerAudioContext.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止。停止后的音频再播放会从头开始播放。 */
    stop(): void;
  }
  interface IntersectionObserver {
    /** [IntersectionObserver.disconnect()](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.disconnect.html)
     *
     * 在插件中使用：支持
     *
     * 停止监听。回调函数将不再触发 */
    disconnect(): void;
    /** [IntersectionObserver.observe(string targetSelector, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.observe.html)
     *
     * 在插件中使用：支持
     *
     * 指定目标节点并开始监听相交状态变化情况 */
    observe(
      /** 选择器 */
      targetSelector: string,
      /** 监听相交状态变化的回调函数 */
      callback: IntersectionObserverObserveCallback
    ): void;
    /** [[IntersectionObserver](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.html) IntersectionObserver.relativeTo(string selector, Object margins)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.relativeTo.html)
     *
     * 在插件中使用：支持
     *
     * 使用选择器指定一个节点，作为参照区域之一。 */
    relativeTo(
      /** 选择器 */
      selector: string,
      /** 用来扩展（或收缩）参照节点布局区域的边界 */
      margins?: Margins
    ): IntersectionObserver;
    /** [[IntersectionObserver](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.html) IntersectionObserver.relativeToViewport(Object margins)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.relativeToViewport.html)
*
* 在插件中使用：支持
*
* 指定页面显示区域作为参照区域之一
*
* **示例代码**
*
* 下面的示例代码中，如果目标节点（用选择器 .target-class 指定）进入显示区域以下 100px 时，就会触发回调函数。
* ```javascript
Page({
  onLoad: function(){
    wx.createIntersectionObserver().relativeToViewport({bottom: 100}).observe('.target-class', (res) => {
      res.intersectionRatio // 相交区域占目标节点的布局区域的比例
      res.intersectionRect // 相交区域
      res.intersectionRect.left // 相交区域的左边界坐标
      res.intersectionRect.top // 相交区域的上边界坐标
      res.intersectionRect.width // 相交区域的宽度
      res.intersectionRect.height // 相交区域的高度
    })
  }
})
``` */
    relativeToViewport(
      /** 用来扩展（或收缩）参照节点布局区域的边界 */
      margins?: Margins
    ): IntersectionObserver;
  }
  interface InterstitialAd {
    /** [InterstitialAd.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.destroy.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 销毁插屏广告实例。 */
    destroy(): void;
    /** [InterstitialAd.offClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.offClose.html)
*
* 在插件中使用：不支持
*
* 移除插屏广告关闭事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InterstitialAd.onClose(listener)
InterstitialAd.offClose(listener) // 需传入与监听时同一个的函数对象
``` */
    offClose(
      /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffCloseCallback
    ): void;
    /** [InterstitialAd.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.offError.html)
*
* 在插件中使用：不支持
*
* 移除插屏错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InterstitialAd.onError(listener)
InterstitialAd.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: InterstitialAdOffErrorCallback
    ): void;
    /** [InterstitialAd.offLoad(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.offLoad.html)
*
* 在插件中使用：不支持
*
* 移除插屏广告加载事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

InterstitialAd.onLoad(listener)
InterstitialAd.offLoad(listener) // 需传入与监听时同一个的函数对象
``` */
    offLoad(
      /** onLoad 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLoadCallback
    ): void;
    /** [InterstitialAd.onClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onClose.html)
     *
     * 在插件中使用：不支持
     *
     * 监听插屏广告关闭事件。 */
    onClose(
      /** 插屏广告关闭事件的监听函数 */
      listener: UDPSocketOnCloseCallback
    ): void;
    /** [InterstitialAd.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onError.html)
     *
     * 在插件中使用：不支持
     *
     * 监听插屏错误事件。
     *
     * **错误码信息与解决方案表**
     *
     *  错误码是通过onError获取到的错误信息。调试期间，可以通过异常返回来捕获信息。
     *  在小程序发布上线之后，如果遇到异常问题，可以在[“运维中心“](https://mp.weixin.qq.com/)里面搜寻错误日志，还可以针对异常返回加上适当的监控信息。
     *
     * | 代码 | 异常情况 | 理由 | 解决方案 |
     * | ------ | -------------- | --------------- | -------------------------- |
     * | 1000  | 后端错误调用失败  | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。 |
     * | 1001  | 参数错误    | 使用方法错误 | 可以前往developers.weixin.qq.com确认具体教程（小程序和小游戏分别有各自的教程，可以在顶部选项中，“设计”一栏的右侧进行切换。|
     * | 1002  | 广告单元无效    | 可能是拼写错误、或者误用了其他APP的广告ID | 请重新前往mp.weixin.qq.com确认广告位ID。 |
     * | 1003  | 内部错误    | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。|
     * | 1004  | 无适合的广告   | 广告不是每一次都会出现，这次没有出现可能是由于该用户不适合浏览广告 | 属于正常情况，且开发者需要针对这种情况做形态上的兼容。 |
     * | 1005  | 广告组件审核中  | 你的广告正在被审核，无法展现广告 | 请前往mp.weixin.qq.com确认审核状态，且开发者需要针对这种情况做形态上的兼容。|
     * | 1006  | 广告组件被驳回  | 你的广告审核失败，无法展现广告 | 请前往mp.weixin.qq.com确认审核状态，且开发者需要针对这种情况做形态上的兼容。|
     * | 1007  | 广告组件被封禁  | 你的广告能力已经被封禁，封禁期间无法展现广告 | 请前往mp.weixin.qq.com确认小程序广告封禁状态。 |
     * | 1008  | 广告单元已关闭  | 该广告位的广告能力已经被关闭 | 请前往mp.weixin.qq.com重新打开对应广告位的展现。| */
    onError(
      /** 插屏错误事件的监听函数 */
      listener: InterstitialAdOnErrorCallback
    ): void;
    /** [InterstitialAd.onLoad(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onLoad.html)
     *
     * 在插件中使用：不支持
     *
     * 监听插屏广告加载事件。 */
    onLoad(
      /** 插屏广告加载事件的监听函数 */
      listener: OnLoadCallback
    ): void;
    /** [Promise InterstitialAd.load()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.load.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 加载插屏广告。 */
    load(): Promise<any>;
    /** [Promise InterstitialAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.show.html)
     *
     * 在插件中使用：不支持
     *
     * 显示插屏广告。
     *
     * **错误码信息表**
     *
     *  如果插屏广告显示失败，InterstitialAd.show() 方法会返回一个rejected Promise，开发者可以获取到错误码及对应的错误信息。
     *
     * | 代码 | 异常情况 | 理由 |
     * | ------ | -------------- | -------------------------- |
     * | 2001  | 触发频率限制  | 小程序启动一定时间内不允许展示插屏广告 |
     * | 2002  | 触发频率限制  | 距离小程序插屏广告或者激励视频广告上次播放时间间隔不足，不允许展示插屏广告 |
     * | 2003  | 触发频率限制  | 当前正在播放激励视频广告或者插屏广告，不允许再次展示插屏广告 |
     * | 2004  | 广告渲染失败  | 该项错误不是开发者的异常情况，或因小程序页面切换导致广告渲染失败 |
     * | 2005  | 广告调用异常  | 插屏广告实例不允许跨页面调用 | */
    show(): Promise<any>;
  }
  interface IsoDep {
    /** [IsoDep.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [IsoDep.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [IsoDep.getHistoricalBytes(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.getHistoricalBytes.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取复位信息 */
    getHistoricalBytes(option?: GetHistoricalBytesOption): void;
    /** [IsoDep.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [IsoDep.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [IsoDep.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [IsoDep.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface Join1v1ChatError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | -20000 | not open 1v1 Chat | 未开通双人通话 |
     * | -20001 | device not support | 当前设备不支持 |
     * | -20002 | on call | 正在通话中 |
     * | -20003 | occupied by other miniprogram | 其它小程序正在通话中 |
     * | -30000 | system error | 内部系统错误 |
     * | -30001 | wechat has no camera authorization | 微信缺失相机权限 |
     * | -30002 | wechat has no record authorization | 微信缺失录音权限 |
     * | -30003 | miniprogram has no record authorization | 小程序缺失录音权限 |
     * | -30004 | miniprogram has no camera authorization | 小程序缺失相机权限 |
     * | -1 |  | 当前已在房间内 |
     * | -2 |  | 录音设备被占用，可能是当前正在使用微信内语音通话或系统通话 |
     * | -3 |  | 加入会话期间退出（可能是用户主动退出，或者退后台、来电等原因），因此加入失败 |
     * | -1000 |  | 系统错误 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | -20000 | not open 1v1 Chat | 未开通双人通话 |
     * | -20001 | device not support | 当前设备不支持 |
     * | -20002 | on call | 正在通话中 |
     * | -20003 | occupied by other miniprogram | 其它小程序正在通话中 |
     * | -30000 | system error | 内部系统错误 |
     * | -30001 | wechat has no camera authorization | 微信缺失相机权限 |
     * | -30002 | wechat has no record authorization | 微信缺失录音权限 |
     * | -30003 | miniprogram has no record authorization | 小程序缺失录音权限 |
     * | -30004 | miniprogram has no camera authorization | 小程序缺失相机权限 |
     * | -1 |  | 当前已在房间内 |
     * | -2 |  | 录音设备被占用，可能是当前正在使用微信内语音通话或系统通话 |
     * | -3 |  | 加入会话期间退出（可能是用户主动退出，或者退后台、来电等原因），因此加入失败 |
     * | -1000 |  | 系统错误 | */ errCode: number;
  }
  interface JoinVoIPChatError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | -1 | 当前已在房间内 |  |
     * | -2 | 录音设备被占用，可能是当前正在使用微信内语音通话或系统通话 |  |
     * | -3 | 加入会话期间退出（可能是用户主动退出，或者退后台、来电等原因），因此加入失败 |  |
     * | -1000 | 系统错误 |  | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | -1 | 当前已在房间内 |  |
     * | -2 | 录音设备被占用，可能是当前正在使用微信内语音通话或系统通话 |  |
     * | -3 | 加入会话期间退出（可能是用户主动退出，或者退后台、来电等原因），因此加入失败 |  |
     * | -1000 | 系统错误 |  | */ errCode: number;
  }
  interface LivePlayerContext {
    /** [LivePlayerContext.exitCasting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.exitCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 退出投屏。仅支持在 tap 事件回调内调用。 */
    exitCasting(option?: ExitCastingOption): void;
    /** [LivePlayerContext.exitFullScreen(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.exitFullScreen.html)
     *
     * 在插件中使用：支持
     *
     * 退出全屏 */
    exitFullScreen(option?: ExitFullScreenOption): void;
    /** [LivePlayerContext.exitPictureInPicture(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.exitPictureInPicture.html)
     *
     * 在插件中使用：支持
     *
     * 退出小窗，该方法可在任意页面调用 */
    exitPictureInPicture(option?: ExitPictureInPictureOption): void;
    /** [LivePlayerContext.mute(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.mute.html)
     *
     * 在插件中使用：支持
     *
     * 静音 */
    mute(option?: MuteOption): void;
    /** [LivePlayerContext.pause(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.pause.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     *
     * 暂停 */
    pause(option?: PauseOption): void;
    /** [LivePlayerContext.play(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.play.html)
     *
     * 在插件中使用：支持
     *
     * 播放 */
    play(option?: PlayOption): void;
    /** [LivePlayerContext.reconnectCasting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.reconnectCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 重连投屏设备。仅支持在 tap 事件回调内调用。 */
    reconnectCasting(option?: ReconnectCastingOption): void;
    /** [LivePlayerContext.requestFullScreen(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.requestFullScreen.html)
     *
     * 在插件中使用：支持
     *
     * 进入全屏 */
    requestFullScreen(option: LivePlayerContextRequestFullScreenOption): void;
    /** [LivePlayerContext.requestPictureInPicture(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.requestPictureInPicture.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：支持
     *
     * 进入小窗 */
    requestPictureInPicture(option?: RequestPictureInPictureOption): void;
    /** [LivePlayerContext.resume(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.resume.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     *
     * 恢复 */
    resume(option?: ResumeOption): void;
    /** [LivePlayerContext.snapshot(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.snapshot.html)
     *
     * 需要基础库： `2.7.1`
     *
     * 在插件中使用：支持
     *
     * 截图 */
    snapshot(option: LivePlayerContextSnapshotOption): void;
    /** [LivePlayerContext.startCasting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.startCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 开始投屏, 拉起半屏搜索设备。仅支持在 tap 事件回调内调用。 */
    startCasting(option?: StartCastingOption): void;
    /** [LivePlayerContext.stop(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止 */
    stop(option?: StopOption): void;
    /** [LivePlayerContext.switchCasting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.switchCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 切换投屏设备。仅支持在 tap 事件回调内调用。 */
    switchCasting(option?: SwitchCastingOption): void;
  }
  interface LivePusherContext {
    /** [LivePusherContext.applyBlusherStickMakeup(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyBlusherStickMakeup.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加腮红美妆特效 */
    applyBlusherStickMakeup(option: ApplyBlusherStickMakeupOption): void;
    /** [LivePusherContext.applyEyeBrowMakeup(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyEyeBrowMakeup.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加眉毛美妆特效 */
    applyEyeBrowMakeup(option: ApplyEyeBrowMakeupOption): void;
    /** [LivePusherContext.applyEyeShadowMakeup(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyEyeShadowMakeup.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加眼影美妆特效 */
    applyEyeShadowMakeup(option: ApplyEyeShadowMakeupOption): void;
    /** [LivePusherContext.applyFaceContourMakeup(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyFaceContourMakeup.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加修容美妆特效 */
    applyFaceContourMakeup(option: ApplyFaceContourMakeupOption): void;
    /** [LivePusherContext.applyFilter(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyFilter.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加滤镜效果 */
    applyFilter(option: ApplyFilterOption): void;
    /** [LivePusherContext.applyLipStickMakeup(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applyLipStickMakeup.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加口红美妆特效 */
    applyLipStickMakeup(option: ApplyLipStickMakeupOption): void;
    /** [LivePusherContext.applySticker(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.applySticker.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 添加贴纸特效 */
    applySticker(option: ApplyStickerOption): void;
    /** [LivePusherContext.clearFilters(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.clearFilters.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 清除所有滤镜效果 */
    clearFilters(option?: ClearFiltersOption): void;
    /** [LivePusherContext.clearMakeups(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.clearMakeups.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 清除所有美妆特效 */
    clearMakeups(option?: ClearMakeupsOption): void;
    /** [LivePusherContext.clearStickers(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.clearStickers.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 清除所有贴纸特效 */
    clearStickers(option?: ClearStickersOption): void;
    /** [LivePusherContext.createOffscreenCanvas(object options)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.createOffscreenCanvas.html)
     *
     * 需要基础库： `2.29.0`
     *
     * 在插件中使用：支持
     *
     * 创建一个能够承接 LivePusher 采集纹理的离屏 Canvas，客户端 8.0.31 版本开始支持。 */
    createOffscreenCanvas(
      /** 同[wx.createOffscreenCanvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html) */
      options: IAnyObject
    ): void;
    /** [LivePusherContext.exitPictureInPicture(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.exitPictureInPicture.html)
     *
     * 需要基础库： `2.25.0`
     *
     * 在插件中使用：支持
     *
     * 退出小窗，该方法可在任意页面调用 */
    exitPictureInPicture(option?: ExitPictureInPictureOption): void;
    /** [LivePusherContext.getMaxZoom(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.getMaxZoom.html)
     *
     * 需要基础库： `2.31.0`
     *
     * 在插件中使用：支持
     *
     * 获取最大缩放级别 */
    getMaxZoom(option?: GetMaxZoomOption): void;
    /** [LivePusherContext.onCustomRendererEvent(string event, function|function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.onCustomRendererEvent.html)
     *
     * 需要基础库： `2.29.0`
     *
     * 在插件中使用：支持
     *
     * 开启自定义渲染时，开发者通过此方法订阅相关事件，客户端 8.0.31 版本开始支持。 */
    onCustomRendererEvent(
      /** 事件类型，后订阅的监听器会取消之前的监听器
       *
       * 参数 event 可选值：
       * - 'frame': 采集到视频帧后触发;
       * - 'update': 推流尺寸变更时触发; */
      event: 'frame' | 'update',
      /** 自定义渲染事件处理回调函数 */
      callback: CustomRendererFrameEventCallback
    ): void;
    /** [LivePusherContext.pause(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.pause.html)
     *
     * 在插件中使用：支持
     *
     * 暂停推流 */
    pause(option?: PauseOption): void;
    /** [LivePusherContext.pauseBGM(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.pauseBGM.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：支持
     *
     * 暂停背景音 */
    pauseBGM(option?: PauseBGMOption): void;
    /** [LivePusherContext.playBGM(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.playBGM.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：支持
     *
     * 播放背景音 */
    playBGM(option: PlayBGMOption): void;
    /** [LivePusherContext.resume(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.resume.html)
     *
     * 在插件中使用：支持
     *
     * 恢复推流 */
    resume(option?: ResumeOption): void;
    /** [LivePusherContext.resumeBGM(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.resumeBGM.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：支持
     *
     * 恢复背景音 */
    resumeBGM(option?: ResumeBGMOption): void;
    /** [LivePusherContext.sendMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.sendMessage.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：支持
     *
     * 发送SEI消息 */
    sendMessage(option: SendMessageOption): void;
    /** [LivePusherContext.setBGMVolume(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.setBGMVolume.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：支持
     *
     * 设置背景音音量 */
    setBGMVolume(option: SetBGMVolumeOption): void;
    /** [LivePusherContext.setMICVolume(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.setMICVolume.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：支持
     *
     * 设置麦克风音量 */
    setMICVolume(option: SetMICVolumeOption): void;
    /** [LivePusherContext.setZoom(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.setZoom.html)
     *
     * 需要基础库： `2.31.0`
     *
     * 在插件中使用：支持
     *
     * 设置缩放级别 */
    setZoom(option: LivePusherContextSetZoomOption): void;
    /** [LivePusherContext.snapshot(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.snapshot.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：支持
     *
     * 快照 */
    snapshot(option: LivePusherContextSnapshotOption): void;
    /** [LivePusherContext.start(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.start.html)
     *
     * 在插件中使用：支持
     *
     * 开始推流，同时开启摄像头预览 */
    start(option?: LivePusherContextStartOption): void;
    /** [LivePusherContext.startPreview(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.startPreview.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 开启摄像头预览 */
    startPreview(option?: StartPreviewOption): void;
    /** [LivePusherContext.stop(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止推流，同时停止摄像头预览 */
    stop(option?: StopOption): void;
    /** [LivePusherContext.stopBGM(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.stopBGM.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：支持
     *
     * 停止背景音 */
    stopBGM(option?: StopBGMOption): void;
    /** [LivePusherContext.stopPreview(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.stopPreview.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：支持
     *
     * 关闭摄像头预览 */
    stopPreview(option?: StopPreviewOption): void;
    /** [LivePusherContext.switchCamera(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.switchCamera.html)
     *
     * 在插件中使用：支持
     *
     * 切换前后摄像头 */
    switchCamera(option?: SwitchCameraOption): void;
    /** [LivePusherContext.toggleTorch(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.toggleTorch.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 切换手电筒 */
    toggleTorch(option?: ToggleTorchOption): void;
  }
  interface LogManager {
    /** [LogManager.debug()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.debug.html)
     *
     * 在插件中使用：不支持
     *
     * 写 debug 日志 */
    debug(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过100Kb */
      ...args: any[]
    ): void;
    /** [LogManager.info()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.info.html)
     *
     * 在插件中使用：不支持
     *
     * 写 info 日志 */
    info(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过100Kb */
      ...args: any[]
    ): void;
    /** [LogManager.log()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.log.html)
     *
     * 在插件中使用：不支持
     *
     * 写 log 日志 */
    log(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过100Kb */
      ...args: any[]
    ): void;
    /** [LogManager.warn()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.warn.html)
     *
     * 在插件中使用：不支持
     *
     * 写 warn 日志 */
    warn(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过100Kb */
      ...args: any[]
    ): void;
  }
  interface MapContext {
    /** [MapContext.addArc(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.addArc.html)
     *
     * 需要基础库： `2.22.0`
     *
     * 在插件中使用：支持
     *
     * 添加弧线，途经点与夹角必须设置一个。途经点必须在起终点有效坐标范围内，否则不能生成正确的弧线，同时设置夹角角度时，以夹角角度为准。夹角定义为起点到终点，与起点外切线逆时针旋转的角度。工具侧暂未支持。 */
    addArc(option: AddArcOption): void;
    /** [MapContext.addCustomLayer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.addCustomLayer.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：支持
     *
     * 添加个性化图层。图层创建[参考文档](https://lbs.qq.com/dev/console/customLayer/create) */
    addCustomLayer(option: AddCustomLayerOption): void;
    /** [MapContext.addGroundOverlay(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.addGroundOverlay.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 创建自定义图片图层，图片会随着地图缩放而缩放。 */
    addGroundOverlay(option: AddGroundOverlayOption): void;
    /** [MapContext.addMarkers(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.addMarkers.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：支持
     *
     * 添加 marker。 */
    addMarkers(option: AddMarkersOption): void;
    /** [MapContext.addVisualLayer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.addVisualLayer.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：支持
     *
     * 添加可视化图层。需要刷新时，interval 可设置的最小值为 15 s。 */
    addVisualLayer(option: AddVisualLayerOption): void;
    /** [MapContext.eraseLines(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.eraseLines.html)
     *
     * 需要基础库： `2.5.0`
     *
     * 在插件中使用：支持
     *
     * 擦除或置灰已添加到地图中的线段。 */
    eraseLines(option: EraseLinesOption): void;
    /** [MapContext.executeVisualLayerCommand(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.executeVisualLayerCommand.html)
     *
     * 需要基础库： `2.26.0`
     *
     * 在插件中使用：支持
     *
     * 执行可视化图层指令，结合 `MapContext.on('visualLayerEvent')` 监听事件使用。 */
    executeVisualLayerCommand(option: ExecuteVisualLayerCommandOption): void;
    /** [MapContext.fromScreenLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.fromScreenLocation.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 获取屏幕上的点对应的经纬度，坐标原点为地图左上角。 */
    fromScreenLocation(option: FromScreenLocationOption): void;
    /** [MapContext.getCenterLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.getCenterLocation.html)
     *
     * 在插件中使用：支持
     *
     * 获取当前地图中心的经纬度。返回的是 gcj02 坐标系，可以用于 [wx.openLocation()](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.openLocation.html) */
    getCenterLocation(option: GetCenterLocationOption): void;
    /** [MapContext.getRegion(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.getRegion.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 获取当前地图的视野范围 */
    getRegion(option?: GetRegionOption): void;
    /** [MapContext.getRotate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.getRotate.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：支持
     *
     * 获取当前地图的旋转角 */
    getRotate(option?: GetRotateOption): void;
    /** [MapContext.getScale(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.getScale.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 获取当前地图的缩放级别 */
    getScale(option?: GetScaleOption): void;
    /** [MapContext.getSkew(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.getSkew.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：支持
     *
     * 获取当前地图的倾斜角 */
    getSkew(option?: GetSkewOption): void;
    /** [MapContext.includePoints(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.includePoints.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：支持
     *
     * 缩放视野展示所有经纬度 */
    includePoints(option: IncludePointsOption): void;
    /** [MapContext.initMarkerCluster(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.initMarkerCluster.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：支持
     *
     * 初始化点聚合的配置，未调用时采用默认配置。 */
    initMarkerCluster(option: InitMarkerClusterOption): void;
    /** [MapContext.moveAlong(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.moveAlong.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：支持
     *
     * 沿指定路径移动 `marker`，用于轨迹回放等场景。动画完成时触发回调事件，若动画进行中，对同一 `marker` 再次调用 `moveAlong` 方法，前一次的动画将被打断。 */
    moveAlong(option: MoveAlongOption): void;
    /** [MapContext.moveToLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.moveToLocation.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：支持
     *
     * 将地图中心移置当前定位点，此时需设置地图组件 show-location 为true。[2.8.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起支持将地图中心移动到指定位置。 */
    moveToLocation(option?: MoveToLocationOption): void;
    /** [MapContext.on(string event, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.on.html)
*
* 需要基础库： `2.13.0`
*
* 在插件中使用：支持
*
* 监听地图事件。
*
* ### visualLayerEvent
*
* 可视化图层 visualLayer 统一回调出口，[2.26.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起支持。
*
* #### 返回参数
*
* | 参数      | 类型   | 说明     |
* | --------- | ------ | -------- |
* | layerId   | String | 图层 id  |
* | eventType | String | 事件类型 |
* | eventInfo | String | 事件信息 |
*
* ### markerClusterCreate
*
* 缩放或拖动导致新的聚合簇产生时触发，仅返回新创建的聚合簇信息。
*
* #### 返回参数
*
* | 参数     | 类型                 | 说明       |
* | -------- | -------------------- | ---------- |
* | clusters | `Array<ClusterInfo>` | 聚合簇数据 |
*
* ### markerClusterClick
*
* 聚合簇的点击事件。
*
* #### 返回参数
*
* | 参数      | 类型          | 说明      |
* | --------- | ------------- | --------- |
* | cluster   | ClusterInfo   | 聚合簇    |
*
* #### ClusterInfo 结构
*
* | 参数      | 类型            | 说明                       |
* | --------- | --------------- | -------------------------- |
* | clusterId | Number          | 聚合簇的 id                |
* | center    | LatLng          | 聚合簇的坐标               |
* | markerIds | `Array<Number>` | 该聚合簇内的点标记数据数组 |
*
* **示例代码**
*
* ```js
  MapContext.on('visualLayerEvent', (res) => {})
  MapContext.on('markerClusterCreate', (res) => {})
  MapContext.on('markerClusterClick', (res) => {})
``` */
    on(
      /** 事件名
       *
       * 参数 event 可选值：
       * - 'markerClusterCreate': ;
       * - 'markerClusterClick': ;
       * - 'visualLayerEvent': ; */
      event: 'markerClusterCreate' | 'markerClusterClick' | 'visualLayerEvent',
      /** 事件的回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [MapContext.openMapApp(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.openMapApp.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 拉起地图APP选择导航。 */
    openMapApp(option: OpenMapAppOption): void;
    /** [MapContext.removeArc(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.removeArc.html)
     *
     * 需要基础库： `2.22.0`
     *
     * 在插件中使用：支持
     *
     * 删除弧线。工具侧暂未支持。 */
    removeArc(option: RemoveArcOption): void;
    /** [MapContext.removeCustomLayer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.removeCustomLayer.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：支持
     *
     * 移除个性化图层。 */
    removeCustomLayer(option: RemoveCustomLayerOption): void;
    /** [MapContext.removeGroundOverlay(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.removeGroundOverlay.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 移除自定义图片图层。 */
    removeGroundOverlay(option: RemoveGroundOverlayOption): void;
    /** [MapContext.removeMarkers(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.removeMarkers.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：支持
     *
     * 移除 marker。 */
    removeMarkers(option: RemoveMarkersOption): void;
    /** [MapContext.removeVisualLayer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.removeVisualLayer.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：支持
     *
     * 移除可视化图层。 */
    removeVisualLayer(option: RemoveVisualLayerOption): void;
    /** [MapContext.setBoundary(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.setBoundary.html)
     *
     * 需要基础库： `2.22.0`
     *
     * 在插件中使用：支持
     *
     * 限制地图的显示范围。此接口同时会限制地图的最小缩放整数级别。 */
    setBoundary(option: SetBoundaryOption): void;
    /** [MapContext.setCenterOffset(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.setCenterOffset.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：支持
     *
     * 设置地图中心点偏移，向后向下为增长，屏幕比例范围(0.25~0.75)，默认偏移为[0.5, 0.5] */
    setCenterOffset(option: SetCenterOffsetOption): void;
    /** [MapContext.setLocMarkerIcon(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.setLocMarkerIcon.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：支持
     *
     * 设置定位点图标，支持网络路径、本地路径、代码包路径 */
    setLocMarkerIcon(option: SetLocMarkerIconOption): void;
    /** [MapContext.toScreenLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.toScreenLocation.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 获取经纬度对应的屏幕坐标，坐标原点为地图左上角。 */
    toScreenLocation(option: ToScreenLocationOption): void;
    /** [MapContext.translateMarker(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.translateMarker.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：支持
     *
     * 平移marker，带动画。 */
    translateMarker(option: TranslateMarkerOption): void;
    /** [MapContext.updateGroundOverlay(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.updateGroundOverlay.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：支持
     *
     * 更新自定义图片图层。 */
    updateGroundOverlay(option: UpdateGroundOverlayOption): void;
  }
  interface MediaAudioPlayer {
    /** [Promise MediaAudioPlayer.addAudioSource([VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html) source)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.addAudioSource.html)
     *
     * 在插件中使用：支持
     *
     * 添加音频源 */
    addAudioSource(
      /** [VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html)
       *
       * 视频解码器实例。作为音频源添加到音频播放器中 */
      source: VideoDecoder
    ): Promise<any>;
    /** [Promise MediaAudioPlayer.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.destroy.html)
     *
     * 在插件中使用：支持
     *
     * 销毁播放器 */
    destroy(): Promise<any>;
    /** [Promise MediaAudioPlayer.removeAudioSource([VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html) source)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.removeAudioSource.html)
     *
     * 在插件中使用：支持
     *
     * 移除音频源 */
    removeAudioSource(
      /** [VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html)
       *
       * 视频解码器实例 */
      source: VideoDecoder
    ): Promise<any>;
    /** [Promise MediaAudioPlayer.start()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.start.html)
     *
     * 在插件中使用：支持
     *
     * 启动播放器 */
    start(): Promise<any>;
    /** [Promise MediaAudioPlayer.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止播放器 */
    stop(): Promise<any>;
  }
  interface MediaContainer {
    /** [MediaContainer.addTrack([MediaTrack](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaTrack.html) track)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.addTrack.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 将音频或视频轨道添加到容器 */
    addTrack(
      /** [MediaTrack](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaTrack.html)
       *
       * 要添加的音频或视频轨道 */
      track: MediaTrack
    ): void;
    /** [MediaContainer.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.destroy.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 将容器销毁，释放资源 */
    destroy(): void;
    /** [MediaContainer.export()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.export.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 将容器内的轨道合并并导出视频文件 */
    export(): void;
    /** [MediaContainer.extractDataSource(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.extractDataSource.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 将传入的视频源分离轨道。不会自动将轨道添加到待合成的容器里。 */
    extractDataSource(option: ExtractDataSourceOption): void;
    /** [MediaContainer.removeTrack([MediaTrack](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaTrack.html) track)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.removeTrack.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：支持
     *
     * 将音频或视频轨道从容器中移除 */
    removeTrack(
      /** [MediaTrack](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaTrack.html)
       *
       * 要移除的音频或视频轨道 */
      track: MediaTrack
    ): void;
  }
  interface MediaQueryObserver {
    /** [MediaQueryObserver.disconnect()](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/MediaQueryObserver.disconnect.html)
     *
     * 在插件中使用：支持
     *
     * 停止监听。回调函数将不再触发 */
    disconnect(): void;
    /** [MediaQueryObserver.observe(Object descriptor, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/MediaQueryObserver.observe.html)
     *
     * 在插件中使用：支持
     *
     * 开始监听页面 media query 变化情况 */
    observe(
      /** media query 描述符 */
      descriptor: ObserveDescriptor,
      /** 监听 media query 状态变化的回调函数 */
      callback: MediaQueryObserverObserveCallback
    ): void;
  }
  interface MediaRecorder {
    /** [MediaRecorder.off(string eventName, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.off.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 取消监听录制事件。当对应事件触发时，该回调函数不再执行。 */
    off(
      /** 事件名 */
      eventName: string,
      /** 事件触发时执行的回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [MediaRecorder.on(string eventName, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.on.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 注册监听录制事件的回调函数。当对应事件触发时，回调函数会被执行。 */
    on(
      /** 事件名
       *
       * 参数 eventName 可选值：
       * - 'start': 录制开始事件。;
       * - 'stop': 录制结束事件。返回 {tempFilePath, duration, fileSize};
       * - 'pause': 录制暂停事件。;
       * - 'resume': 录制继续事件。;
       * - 'timeupdate': 录制时间更新事件。; */
      eventName: 'start' | 'stop' | 'pause' | 'resume' | 'timeupdate',
      /** 事件触发时执行的回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [Promise MediaRecorder.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.destroy.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 销毁录制器 */
    destroy(): Promise<any>;
    /** [Promise MediaRecorder.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.pause.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 暂停录制 */
    pause(): Promise<any>;
    /** [Promise MediaRecorder.requestFrame(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.requestFrame.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 请求下一帧录制，在 callback 里完成一帧渲染后开始录制当前帧 */
    requestFrame(callback: (...args: any[]) => any): Promise<any>;
    /** [Promise MediaRecorder.resume()](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.resume.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 恢复录制 */
    resume(): Promise<any>;
    /** [Promise MediaRecorder.start()](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.start.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 开始录制 */
    start(): Promise<any>;
    /** [Promise MediaRecorder.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.stop.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 结束录制 */
    stop(): Promise<any>;
  }
  interface MifareClassic {
    /** [MifareClassic.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [MifareClassic.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [MifareClassic.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [MifareClassic.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [MifareClassic.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [MifareClassic.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface MifareUltralight {
    /** [MifareUltralight.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [MifareUltralight.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [MifareUltralight.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [MifareUltralight.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [MifareUltralight.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [MifareUltralight.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface NFCAdapter {
    /** [NFCAdapter.offDiscovered(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.offDiscovered.html)
*
* 需要基础库： `2.11.2`
*
* 在插件中使用：支持
*
* 移除 NFC Tag的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

NFCAdapter.onDiscovered(listener)
NFCAdapter.offDiscovered(listener) // 需传入与监听时同一个的函数对象
``` */
    offDiscovered(
      /** onDiscovered 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffDiscoveredCallback
    ): void;
    /** [NFCAdapter.onDiscovered(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.onDiscovered.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 监听 NFC Tag */
    onDiscovered(
      /** 的监听函数 */
      listener: OnDiscoveredCallback
    ): void;
    /** [NFCAdapter.startDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.startDiscovery.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持 */
    startDiscovery(option?: StartDiscoveryOption): void;
    /** [NFCAdapter.stopDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.stopDiscovery.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持 */
    stopDiscovery(option?: StopDiscoveryOption): void;
    /** [[IsoDep](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/IsoDep.html) NFCAdapter.getIsoDep()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getIsoDep.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取IsoDep实例，实例支持ISO-DEP (ISO 14443-4)标准的读写 */
    getIsoDep(): IsoDep;
    /** [[MifareClassic](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareClassic.html) NFCAdapter.getMifareClassic()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getMifareClassic.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取MifareClassic实例，实例支持MIFARE Classic标签的读写 */
    getMifareClassic(): MifareClassic;
    /** [[MifareUltralight](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/MifareUltralight.html) NFCAdapter.getMifareUltralight()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getMifareUltralight.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取MifareUltralight实例，实例支持MIFARE Ultralight标签的读写 */
    getMifareUltralight(): MifareUltralight;
    /** [[Ndef](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.html) NFCAdapter.getNdef()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getNdef.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取Ndef实例，实例支持对NDEF格式的NFC标签上的NDEF数据的读写 */
    getNdef(): Ndef;
    /** [[NfcA](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.html) NFCAdapter.getNfcA()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getNfcA.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取NfcA实例，实例支持NFC-A (ISO 14443-3A)标准的读写 */
    getNfcA(): NfcA;
    /** [[NfcB](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.html) NFCAdapter.getNfcB()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getNfcB.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取NfcB实例，实例支持NFC-B (ISO 14443-3B)标准的读写 */
    getNfcB(): NfcB;
    /** [[NfcF](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.html) NFCAdapter.getNfcF()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getNfcF.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取NfcF实例，实例支持NFC-F (JIS 6319-4)标准的读写 */
    getNfcF(): NfcF;
    /** [[NfcV](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.html) NFCAdapter.getNfcV()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.getNfcV.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取NfcV实例，实例支持NFC-V (ISO 15693)标准的读写 */
    getNfcV(): NfcV;
  }
  interface NFCError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 13000 |  | 当前设备不支持NFC |
     * | 13001 |  | 当前设备支持NFC，但系统NFC开关未开启 |
     * | 13002 |  | 当前设备支持NFC，但不支持HCE |
     * | 13003 |  | AID列表参数格式错误 |
     * | 13004 |  | 未设置微信为默认NFC支付应用 |
     * | 13005 |  | 返回的指令不合法 |
     * | 13006 |  | 注册AID失败 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 13000 |  | 当前设备不支持NFC |
     * | 13001 |  | 当前设备支持NFC，但系统NFC开关未开启 |
     * | 13002 |  | 当前设备支持NFC，但不支持HCE |
     * | 13003 |  | AID列表参数格式错误 |
     * | 13004 |  | 未设置微信为默认NFC支付应用 |
     * | 13005 |  | 返回的指令不合法 |
     * | 13006 |  | 注册AID失败 | */ errCode: number;
  }
  interface Ndef {
    /** [Ndef.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [Ndef.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [Ndef.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [Ndef.offNdefMessage(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.offNdefMessage.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 取消监听 Ndef 消息 */
    offNdefMessage(callback: (...args: any[]) => any): void;
    /** [Ndef.onNdefMessage(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.onNdefMessage.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 监听 Ndef 消息 */
    onNdefMessage(callback: (...args: any[]) => any): void;
    /** [Ndef.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [Ndef.writeNdefMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/Ndef.writeNdefMessage.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 重写 Ndef 标签内容 */
    writeNdefMessage(option: WriteNdefMessageOption): void;
  }
  interface NfcA {
    /** [NfcA.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [NfcA.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [NfcA.getAtqa(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.getAtqa.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取ATQA信息 */
    getAtqa(option?: GetAtqaOption): void;
    /** [NfcA.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [NfcA.getSak(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.getSak.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取SAK信息 */
    getSak(option?: GetSakOption): void;
    /** [NfcA.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [NfcA.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [NfcA.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcA.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface NfcB {
    /** [NfcB.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [NfcB.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [NfcB.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [NfcB.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [NfcB.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [NfcB.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcB.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface NfcF {
    /** [NfcF.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [NfcF.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [NfcF.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [NfcF.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [NfcF.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [NfcF.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcF.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface NfcV {
    /** [NfcV.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.close.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 断开连接 */
    close(option?: NdefCloseOption): void;
    /** [NfcV.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.connect.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 连接 NFC 标签 */
    connect(option?: NdefConnectOption): void;
    /** [NfcV.getMaxTransceiveLength(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.getMaxTransceiveLength.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 获取最大传输长度 */
    getMaxTransceiveLength(option?: GetMaxTransceiveLengthOption): void;
    /** [NfcV.isConnected(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.isConnected.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * @warning **该接口已废弃，连接状态开发者自行维护即可**
     *
     * 检查是否已连接 */
    isConnected(option?: IsConnectedOption): void;
    /** [NfcV.setTimeout(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.setTimeout.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 设置超时时间 */
    setTimeout(option: SetTimeoutOption): void;
    /** [NfcV.transceive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NfcV.transceive.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：支持
     *
     * 发送数据 */
    transceive(option: TransceiveOption): void;
  }
  interface Nfcrwerror {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 13000 | 设备不支持NFC |  |
     * | 13001 | 系统NFC开关未打开 |  |
     * | 13010 | 未知错误 |  |
     * | 13019 | user is not authorized | 用户未授权 |
     * | 13011 | invalid parameter | 参数无效 |
     * | 13012 | parse NdefMessage failed | 将参数解析为NdefMessage失败 |
     * | 13021 | NFC discovery already started | 已经开始NFC扫描 |
     * | 13018 | NFC discovery has not started | 尝试在未开始NFC扫描时停止NFC扫描 |
     * | 13022 | Tech already connected | 标签已经连接 |
     * | 13023 | Tech has not connected | 尝试在未连接标签时断开连接 |
     * | 13013 | NFC tag has not been discovered | 未扫描到NFC标签 |
     * | 13014 | invalid tech | 无效的标签技术 |
     * | 13015 | unavailable tech | 从标签上获取对应技术失败 |
     * | 13024 | function not support | 当前标签技术不支持该功能 |
     * | 13017 | system internal error | 相关读写操作失败 |
     * | 13016 | connect fail | 连接失败 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 13000 | 设备不支持NFC |  |
     * | 13001 | 系统NFC开关未打开 |  |
     * | 13010 | 未知错误 |  |
     * | 13019 | user is not authorized | 用户未授权 |
     * | 13011 | invalid parameter | 参数无效 |
     * | 13012 | parse NdefMessage failed | 将参数解析为NdefMessage失败 |
     * | 13021 | NFC discovery already started | 已经开始NFC扫描 |
     * | 13018 | NFC discovery has not started | 尝试在未开始NFC扫描时停止NFC扫描 |
     * | 13022 | Tech already connected | 标签已经连接 |
     * | 13023 | Tech has not connected | 尝试在未连接标签时断开连接 |
     * | 13013 | NFC tag has not been discovered | 未扫描到NFC标签 |
     * | 13014 | invalid tech | 无效的标签技术 |
     * | 13015 | unavailable tech | 从标签上获取对应技术失败 |
     * | 13024 | function not support | 当前标签技术不支持该功能 |
     * | 13017 | system internal error | 相关读写操作失败 |
     * | 13016 | connect fail | 连接失败 | */ errCode: number;
  }
  interface NodesRef {
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) NodesRef.boundingClientRect(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.boundingClientRect.html)
*
* 在插件中使用：支持
*
* 添加节点的布局位置的查询请求。相对于显示区域，以像素为单位。其功能类似于 DOM 的 `getBoundingClientRect`。返回 `NodesRef` 对应的 `SelectorQuery`。
*
* **示例代码**
*
* ```js
Page({
  getRect () {
    wx.createSelectorQuery().select('#the-id').boundingClientRect(function(rect){
      rect.id      // 节点的ID
      rect.dataset // 节点的dataset
      rect.left    // 节点的左边界坐标
      rect.right   // 节点的右边界坐标
      rect.top     // 节点的上边界坐标
      rect.bottom  // 节点的下边界坐标
      rect.width   // 节点的宽度
      rect.height  // 节点的高度
    }).exec()
  },
  getAllRects () {
    wx.createSelectorQuery().selectAll('.a-class').boundingClientRect(function(rects){
      rects.forEach(function(rect){
        rect.id      // 节点的ID
        rect.dataset // 节点的dataset
        rect.left    // 节点的左边界坐标
        rect.right   // 节点的右边界坐标
        rect.top     // 节点的上边界坐标
        rect.bottom  // 节点的下边界坐标
        rect.width   // 节点的宽度
        rect.height  // 节点的高度
      })
    }).exec()
  }
})
``` */
    boundingClientRect(
      /** 回调函数，在执行 `SelectorQuery.exec` 方法后，节点信息会在 `callback` 中返回。 */
      callback?: BoundingClientRectCallback
    ): SelectorQuery;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) NodesRef.context(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.context.html)
*
* 需要基础库： `2.4.2`
*
* 在插件中使用：支持
*
* 添加节点的 Context 对象查询请求。目前支持 [VideoContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.html)、[CanvasContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html)、[LivePlayerContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.html)、[EditorContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.html)和 [MapContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.html) 的获取。
*
* **示例代码**
*
* ```js
Page({
  getContext () {
    wx.createSelectorQuery().select('.the-video-class').context(function(res){
      console.log(res.context) // 节点对应的 Context 对象。如：选中的节点是 <video> 组件，那么此处即返回 VideoContext 对象
    }).exec()
  }
})
``` */
    context(
      /** 回调函数，在执行 `SelectorQuery.exec` 方法后，返回节点信息。 */
      callback?: ContextCallback
    ): SelectorQuery;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) NodesRef.fields(Object fields, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.fields.html)
*
* 在插件中使用：支持
*
* 获取节点的相关信息。需要获取的字段在fields中指定。返回值是 `nodesRef` 对应的 `selectorQuery`
*
* **注意**
*
* computedStyle 的优先级高于 size，当同时在 computedStyle 里指定了 width/height 和传入了 size: true，则优先返回 computedStyle 获取到的 width/height。
*
* **示例代码**
*
* ```js
Page({
  getFields () {
    wx.createSelectorQuery().select('#the-id').fields({
      dataset: true,
      size: true,
      scrollOffset: true,
      properties: ['scrollX', 'scrollY'],
      computedStyle: ['margin', 'backgroundColor'],
      context: true,
    }, function (res) {
      res.dataset    // 节点的dataset
      res.width      // 节点的宽度
      res.height     // 节点的高度
      res.scrollLeft // 节点的水平滚动位置
      res.scrollTop  // 节点的竖直滚动位置
      res.scrollX    // 节点 scroll-x 属性的当前值
      res.scrollY    // 节点 scroll-y 属性的当前值
      // 此处返回指定要返回的样式名
      res.margin
      res.backgroundColor
      res.context    // 节点对应的 Context 对象
    }).exec()
  }
})
``` */
    fields(
      fields: Fields,
      /** 回调函数 */
      callback?: FieldsCallback
    ): SelectorQuery;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) NodesRef.node(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.node.html)
*
* 需要基础库： `2.7.0`
*
* 在插件中使用：支持
*
* 获取 Node 节点实例。目前支持 [Canvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html) 和 [ScrollViewContext](https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/ScrollViewContext.html) 的获取。
*
* **示例代码**
*
* ```js
Page({
  getNode() {
    wx.createSelectorQuery().select('.canvas').node(function(res){
      console.log(res.node) // 节点对应的 Canvas 实例。
    }).exec()
  }
})
``` */
    node(
      /** 回调函数，在执行 `SelectorQuery.exec` 方法后，返回节点信息。 */
      callback?: NodeCallback
    ): SelectorQuery;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) NodesRef.scrollOffset(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.scrollOffset.html)
*
* 在插件中使用：支持
*
* 添加节点的滚动位置查询请求。以像素为单位。节点必须是 `scroll-view` 或者 `viewport`，返回 `NodesRef` 对应的 `SelectorQuery`。
*
* **示例代码**
*
* ```js
Page({
  getScrollOffset () {
    wx.createSelectorQuery().selectViewport().scrollOffset(function(res){
      res.id      // 节点的ID
      res.dataset // 节点的dataset
      res.scrollLeft // 节点的水平滚动位置
      res.scrollTop  // 节点的竖直滚动位置
    }).exec()
  }
})
``` */
    scrollOffset(
      /** 回调函数，在执行 `SelectorQuery.exec` 方法后，节点信息会在 `callback` 中返回。 */
      callback?: ScrollOffsetCallback
    ): SelectorQuery;
  }
  interface OffscreenCanvas {
    /** [[Image](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Image.html) OffscreenCanvas.createImage()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/OffscreenCanvas.createImage.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：需要基础库 `2.16.1`
     *
     * 创建一个图片对象。支持在 2D Canvas 和 WebGL Canvas 下使用, 但不支持混用 2D 和 WebGL 的方法。
     *
     * ****
     *
     * 注意不允许混用 webgl 和 2d 画布创建的图片对象，使用时请注意尽量使用 canvas 自身的 `createImage` 创建图片对象。 */
    createImage(): Image;
    /** [[RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) OffscreenCanvas.getContext(string contextType)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/OffscreenCanvas.getContext.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.16.1`
     *
     * 该方法返回 OffscreenCanvas 的绘图上下文
     *
     * ****
     *
     * 注意不允许混用 webgl 和 2d 绘图上下文，传入的 contextType 必须要与 `wx.createOffscreenCanvas` 传入的 type 类型一致。 */
    getContext(
      /** 绘图上下文类型，需要与 createOffscreenCanvas 时传入的 type 一致
       *
       * 参数 contextType 可选值：
       * - 'webgl': webgl类型上下文;
       * - '2d': 2d类型上下文; */
      contextType: 'webgl' | '2d'
    ): any;
  }
  interface Path2D {
    /** [Path2D.addPath([Path2D](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.html) path)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.addPath.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加路径到当前路径。 */
    addPath(
      /** [Path2D](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.html)
       *
       * 添加的 Path2D 路径。 */
      path: Path2D
    ): void;
    /** [Path2D.arc(number x, number y, number radius, number startAngle, number endAngle, boolean counterclockwise)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.arc.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加一段圆弧路径。 */
    arc(
      /** 圆心横坐标。 */
      x: number,
      /** 圆心纵坐标。 */
      y: number,
      /** 圆形半径，必须为正数。 */
      radius: number,
      /** 圆弧开始角度。 */
      startAngle: number,
      /** 圆弧结束角度。 */
      endAngle: number,
      /** 是否逆时针绘制。如果传 true, 则会从 endAngle 开始绘制到 startAngle。 */
      counterclockwise?: boolean
    ): void;
    /** [Path2D.arcTo(number x1, number y1, number x2, number y2, number radius)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.arcTo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 通过给定控制点添加一段圆弧路径。 */
    arcTo(
      /** 第一个控制点横坐标。 */
      x1: number,
      /** 第一个控制点纵坐标。 */
      y1: number,
      /** 第二个控制点横坐标。 */
      x2: number,
      /** 第二个控制点纵坐标。 */
      y2: number,
      /** 圆形半径，必须为非负数。 */
      radius: number
    ): void;
    /** [Path2D.bezierCurveTo(number cp1x, number cp1y, number cp2x, number cp2y, number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.bezierCurveTo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加三次贝塞尔曲线路径。 */
    bezierCurveTo(
      /** 第一个控制点横坐标。 */
      cp1x: number,
      /** 第一个控制点纵坐标。 */
      cp1y: number,
      /** 第二个控制点横坐标。 */
      cp2x: number,
      /** 第二个控制点纵坐标。 */
      cp2y: number,
      /** 结束点横坐标。 */
      x: number,
      /** 结束点纵坐标。 */
      y: number
    ): void;
    /** [Path2D.closePath()](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.closePath.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 闭合路径到起点。 */
    closePath(): void;
    /** [Path2D.ellipse(number x, number y, number radiusX, number radiusY, number rotation, number startAngle, number endAngle, boolean counterclockwise)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.ellipse.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加椭圆弧路径 */
    ellipse(
      /** 椭圆圆心横坐标。 */
      x: number,
      /** 椭圆圆心纵坐标。 */
      y: number,
      /** 椭圆长轴半径，必须为非负数。 */
      radiusX: number,
      /** 椭圆短轴半径，必须为非负数。 */
      radiusY: number,
      /** 椭圆旋转角度。 */
      rotation: number,
      /** 圆弧开始角度。 */
      startAngle: number,
      /** 圆弧结束角度。 */
      endAngle: number,
      /** 是否逆时针绘制。如果传 true, 则会从 endAngle 开始绘制到 startAngle。 */
      counterclockwise?: boolean
    ): void;
    /** [Path2D.lineTo(number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.lineTo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加直线路径 */
    lineTo(
      /** 结束点横坐标。 */
      x: number,
      /** 结束点纵坐标。 */
      y: number
    ): void;
    /** [Path2D.moveTo(number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.moveTo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 移动路径开始点 */
    moveTo(
      /** 横坐标。 */
      x: number,
      /** 纵坐标。 */
      y: number
    ): void;
    /** [Path2D.quadraticCurveTo(number cpx, number cpy, number x, number y)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.quadraticCurveTo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加二次贝塞尔曲线路径。 */
    quadraticCurveTo(
      /** 控制点横坐标。 */
      cpx: number,
      /** 控制点纵坐标。 */
      cpy: number,
      /** 结束点横坐标。 */
      x: number,
      /** 结束点纵坐标。 */
      y: number
    ): void;
    /** [Path2D.rect(number x, number y, number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Path2D.rect.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 添加方形路径。 */
    rect(
      /** 开始点横坐标。 */
      x: number,
      /** 开始点纵坐标。 */
      y: number,
      /** 方形宽度，正数向右，负数向左。 */
      width: number,
      /** 方形高度，正数向下，负数向上。 */
      height: number
    ): void;
  }
  interface Performance {
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; Performance.getEntries()](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.getEntries.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 该方法返回当前缓冲区中的所有性能数据 */
    getEntries(): PerformanceEntry[];
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; Performance.getEntriesByName(string name, string entryType)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.getEntriesByName.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 获取当前缓冲区中所有名称为 [name] 且类型为 [entryType] 的性能数据 */
    getEntriesByName(
      /** 名称 */
      name: string,
      /** 类型 */
      entryType?: string
    ): PerformanceEntry[];
    /** [Array.&lt;[PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)&gt; Performance.getEntriesByType(string entryType)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.getEntriesByType.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 获取当前缓冲区中所有类型为 [entryType] 的性能数据 */
    getEntriesByType(
      /** 类型 */
      entryType: string
    ): PerformanceEntry[];
    /** [Performance.setBufferSize(number size)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.setBufferSize.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 设置缓冲区大小，默认缓冲 30 条性能数据 */
    setBufferSize(size: number): void;
    /** [[PerformanceObserver](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceObserver.html) Performance.createObserver(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.createObserver.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 创建全局性能事件监听器 */
    createObserver(
      /** 回调函数 */
      callback: (...args: any[]) => any
    ): PerformanceObserver;
  }
  interface PerformanceObserver {
    /** [PerformanceObserver.disconnect()](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceObserver.disconnect.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 停止监听 */
    disconnect(): void;
    /** [PerformanceObserver.observe(Object options)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceObserver.observe.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 开始监听 */
    observe(
      /** 设置 type 监听单个类型的指标，设置 entryTypes 监听多个类型指标。 */
      options: ObserveOption
    ): void;
  }
  interface PreDownloadSubpackageTask {
    /** [PreDownloadSubpackageTask.onProgressUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/subpackage/PreDownloadSubpackageTask.onProgressUpdate.html)
     *
     * 需要基础库： `2.27.3`
     *
     * 在插件中使用：不支持
     *
     * 监听分包加载进度变化事件 */
    onProgressUpdate(
      /** 分包加载进度变化事件的监听函数 */
      listener: PreDownloadSubpackageTaskOnProgressUpdateCallback
    ): void;
  }
  interface RealtimeLogManager {
    /** [Object RealtimeLogManager.getCurrentState()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.getCurrentState.html)
     *
     * 需要基础库： `2.19.4`
     *
     * 在插件中使用：不支持
     *
     * 实时日志会将一定时间间隔内缓存的日志聚合上报，如果该时间内缓存的内容超出限制，则会被丢弃。此方法可以获取当前缓存剩余空间。
     *
     * > 注意：基础库内部在对日志进行上报时会补充一些结构化数据，如果遇到上报溢出的情况也会补充警告日志，所以此方法获取到的当前占用信息会比预期的大一些。 */
    getCurrentState(): CurrentState;
    /** [RealtimeLogManager.addFilterMsg(string msg)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.addFilterMsg.html)
     *
     * 需要基础库： `2.8.1`
     *
     * 在插件中使用：不支持
     *
     * 添加过滤关键字，暂不支持在插件使用 */
    addFilterMsg(
      /** 是setFilterMsg的添加接口。用于设置多个过滤关键字。 */
      msg: string
    ): void;
    /** [RealtimeLogManager.error()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.error.html)
     *
     * 需要基础库： `2.7.1`
     *
     * 在插件中使用：不支持
     *
     * 写 error 日志，暂不支持在插件使用 */
    error(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过5Kb */
      ...args: any[]
    ): void;
    /** [RealtimeLogManager.in(Page pageInstance)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.in.html)
     *
     * 需要基础库： `2.9.1`
     *
     * 在插件中使用：不支持
     *
     * 设置实时日志page参数所在的页面，暂不支持在插件使用 */
    in(
      /** page实例 */
      pageInstance: Page.TrivialInstance
    ): void;
    /** [RealtimeLogManager.info()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.info.html)
     *
     * 需要基础库： `2.7.1`
     *
     * 在插件中使用：不支持
     *
     * 写 info 日志，暂不支持在插件使用 */
    info(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过5Kb */
      ...args: any[]
    ): void;
    /** [RealtimeLogManager.setFilterMsg(string msg)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.setFilterMsg.html)
     *
     * 需要基础库： `2.7.3`
     *
     * 在插件中使用：不支持
     *
     * 设置过滤关键字，暂不支持在插件使用 */
    setFilterMsg(
      /** 过滤关键字，最多不超过1Kb，可以在小程序管理后台根据设置的内容搜索得到对应的日志。 */
      msg: string
    ): void;
    /** [RealtimeLogManager.warn()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.warn.html)
     *
     * 需要基础库： `2.7.1`
     *
     * 在插件中使用：不支持
     *
     * 写 warn 日志，暂不支持在插件使用 */
    warn(
      /** 日志内容，可以有任意多个。每次调用的参数的总大小不超过5Kb */
      ...args: any[]
    ): void;
    /** [[RealtimeTagLogManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.html) RealtimeLogManager.tag(string tagName)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.tag.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 获取给定标签的日志管理器实例，目前只支持在插件使用 */
    tag(
      /** 标签名 */
      tagName: string
    ): RealtimeTagLogManager;
  }
  interface RealtimeTagLogManager {
    /** [RealtimeTagLogManager.addFilterMsg(string msg)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.addFilterMsg.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 添加过滤关键字 */
    addFilterMsg(
      /** 是setFilterMsg的添加接口。用于设置多个过滤关键字。 */
      msg: string
    ): void;
    /** [RealtimeTagLogManager.error(string key, Object|Array.&lt;any&gt;|number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.error.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 写 error 日志 */
    error(
      /** 日志的 key */
      key: string,
      /** 日志的值，每次调用的参数的总大小不超过5Kb */
      value: IAnyObject | any[] | number | string
    ): void;
    /** [RealtimeTagLogManager.info(string key, Object|Array.&lt;any&gt;|number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.info.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 写 info 日志 */
    info(
      /** 日志的 key */
      key: string,
      /** 日志的值，每次调用的参数的总大小不超过5Kb */
      value: IAnyObject | any[] | number | string
    ): void;
    /** [RealtimeTagLogManager.setFilterMsg(string msg)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.setFilterMsg.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 设置过滤关键字 */
    setFilterMsg(
      /** 过滤关键字，最多不超过1Kb，可以在小程序管理后台根据设置的内容搜索得到对应的日志。 */
      msg: string
    ): void;
    /** [RealtimeTagLogManager.warn(string key, Object|Array.&lt;any&gt;|number|string value)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeTagLogManager.warn.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 写 warn 日志 */
    warn(
      /** 日志的 key */
      key: string,
      /** 日志的值，每次调用的参数的总大小不超过5Kb */
      value: IAnyObject | any[] | number | string
    ): void;
  }
  interface RecorderManager {
    /** [RecorderManager.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onError.html)
     *
     * 在插件中使用：支持
     *
     * 监听录音错误事件 */
    onError(
      /** 录音错误事件的监听函数 */
      listener: UDPSocketOnErrorCallback
    ): void;
    /** [RecorderManager.onFrameRecorded(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onFrameRecorded.html)
     *
     * 在插件中使用：支持
     *
     * 监听已录制完指定帧大小的文件事件。如果设置了 frameSize，则会回调此事件。 */
    onFrameRecorded(
      /** 已录制完指定帧大小的文件事件的监听函数 */
      listener: OnFrameRecordedCallback
    ): void;
    /** [RecorderManager.onInterruptionBegin(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onInterruptionBegin.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：支持
     *
     * 监听录音因为受到系统占用而被中断开始事件。以下场景会触发此事件：微信语音聊天、微信视频聊天。此事件触发后，录音会被暂停。pause 事件在此事件后触发 */
    onInterruptionBegin(
      /** 录音因为受到系统占用而被中断开始事件的监听函数 */
      listener: OnInterruptionBeginCallback
    ): void;
    /** [RecorderManager.onInterruptionEnd(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onInterruptionEnd.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：支持
     *
     * 监听录音中断结束事件。在收到 interruptionBegin 事件之后，小程序内所有录音会暂停，收到此事件之后才可再次录音成功。 */
    onInterruptionEnd(
      /** 录音中断结束事件的监听函数 */
      listener: OnInterruptionEndCallback
    ): void;
    /** [RecorderManager.onPause(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onPause.html)
     *
     * 在插件中使用：支持
     *
     * 监听录音暂停事件 */
    onPause(
      /** 录音暂停事件的监听函数 */
      listener: OnPauseCallback
    ): void;
    /** [RecorderManager.onResume(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onResume.html)
     *
     * 在插件中使用：支持
     *
     * 监听录音继续事件 */
    onResume(
      /** 录音继续事件的监听函数 */
      listener: OnResumeCallback
    ): void;
    /** [RecorderManager.onStart(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onStart.html)
     *
     * 在插件中使用：支持
     *
     * 监听录音开始事件 */
    onStart(
      /** 录音开始事件的监听函数 */
      listener: OnStartCallback
    ): void;
    /** [RecorderManager.onStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.onStop.html)
     *
     * 在插件中使用：支持
     *
     * 监听录音结束事件 */
    onStop(
      /** 录音结束事件的监听函数 */
      listener: RecorderManagerOnStopCallback
    ): void;
    /** [RecorderManager.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.pause.html)
     *
     * 在插件中使用：支持
     *
     * 暂停录音 */
    pause(): void;
    /** [RecorderManager.resume()](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.resume.html)
     *
     * 在插件中使用：支持
     *
     * 继续录音 */
    resume(): void;
    /** [RecorderManager.start(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html)
     *
     * 在插件中使用：支持
     *
     * 开始录音
     *
     * **采样率与编码码率限制**
     *
     *  每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败，具体对应关系如下表。
     *
     * | 采样率 | 编码码率       |
     * | ------ | -------------- |
     * | 8000   | 16000 ~ 48000  |
     * | 11025  | 16000 ~ 48000  |
     * | 12000  | 24000 ~ 64000  |
     * | 16000  | 24000 ~ 96000  |
     * | 22050  | 32000 ~ 128000 |
     * | 24000  | 32000 ~ 128000 |
     * | 32000  | 48000 ~ 192000 |
     * | 44100  | 64000 ~ 320000 |
     * | 48000  | 64000 ~ 320000 | */
    start(option: RecorderManagerStartOption): void;
    /** [RecorderManager.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.stop.html)
     *
     * 在插件中使用：支持
     *
     * 停止录音 */
    stop(): void;
  }
  interface RequestTask {
    /** [RequestTask.abort()](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.abort.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 中断请求任务 */
    abort(): void;
    /** [RequestTask.offChunkReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.offChunkReceived.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：支持
*
* 移除 Transfer-Encoding Chunk Received 事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

RequestTask.onChunkReceived(listener)
RequestTask.offChunkReceived(listener) // 需传入与监听时同一个的函数对象
``` */
    offChunkReceived(
      /** onChunkReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffChunkReceivedCallback
    ): void;
    /** [RequestTask.offHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.offHeadersReceived.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：支持
*
* 移除 HTTP Response Header 事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

RequestTask.onHeadersReceived(listener)
RequestTask.offHeadersReceived(listener) // 需传入与监听时同一个的函数对象
``` */
    offHeadersReceived(
      /** onHeadersReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffHeadersReceivedCallback
    ): void;
    /** [RequestTask.onChunkReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.onChunkReceived.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：支持
     *
     * 监听 Transfer-Encoding Chunk Received 事件。当接收到新的chunk时触发。 */
    onChunkReceived(
      /** Transfer-Encoding Chunk Received 事件的监听函数 */
      listener: OnChunkReceivedCallback
    ): void;
    /** [RequestTask.onHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.onHeadersReceived.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 监听 HTTP Response Header 事件。会比请求完成事件更早 */
    onHeadersReceived(
      /** HTTP Response Header 事件的监听函数 */
      listener: OnHeadersReceivedCallback
    ): void;
  }
  interface RewardedVideoAd {
    /** [Promise RewardedVideoAd.load()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.load.html)
     *
     * 在插件中使用：不支持
     *
     * 加载激励视频广告。 */
    load(): Promise<any>;
    /** [Promise RewardedVideoAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.show.html)
     *
     * 在插件中使用：不支持
     *
     * 显示激励视频广告。激励视频广告将从屏幕下方推入。 */
    show(): Promise<any>;
    /** [RewardedVideoAd.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.destroy.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 销毁激励视频广告实例。 */
    destroy(): void;
    /** [RewardedVideoAd.offClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.offClose.html)
*
* 在插件中使用：不支持
*
* 移除用户点击 `关闭广告` 按钮的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

RewardedVideoAd.onClose(listener)
RewardedVideoAd.offClose(listener) // 需传入与监听时同一个的函数对象
``` */
    offClose(
      /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: RewardedVideoAdOffCloseCallback
    ): void;
    /** [RewardedVideoAd.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.offError.html)
*
* 在插件中使用：不支持
*
* 移除激励视频错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

RewardedVideoAd.onError(listener)
RewardedVideoAd.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: RewardedVideoAdOffErrorCallback
    ): void;
    /** [RewardedVideoAd.offLoad(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.offLoad.html)
*
* 在插件中使用：不支持
*
* 移除激励视频广告加载事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

RewardedVideoAd.onLoad(listener)
RewardedVideoAd.offLoad(listener) // 需传入与监听时同一个的函数对象
``` */
    offLoad(
      /** onLoad 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLoadCallback
    ): void;
    /** [RewardedVideoAd.onClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onClose.html)
     *
     * 在插件中使用：不支持
     *
     * 监听用户点击 `关闭广告` 按钮的事件。 */
    onClose(
      /** 用户点击 `关闭广告` 按钮的事件的监听函数 */
      listener: RewardedVideoAdOnCloseCallback
    ): void;
    /** [RewardedVideoAd.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onError.html)
     *
     * 在插件中使用：不支持
     *
     * 监听激励视频错误事件。
     *
     * **错误码信息与解决方案表**
     *
     *  错误码是通过onError获取到的错误信息。调试期间，可以通过异常返回来捕获信息。
     *  在小程序发布上线之后，如果遇到异常问题，可以在[“运维中心“](https://mp.weixin.qq.com/)里面搜寻错误日志，还可以针对异常返回加上适当的监控信息。
     *
     * | 代码 | 异常情况 | 理由 | 解决方案 |
     * | ------ | -------------- | --------------- | -------------------------- |
     * | 1000  | 后端错误调用失败  | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。 |
     * | 1001  | 参数错误    | 使用方法错误 | 可以前往developers.weixin.qq.com确认具体教程（小程序和小游戏分别有各自的教程，可以在顶部选项中，“设计”一栏的右侧进行切换。|
     * | 1002  | 广告单元无效    | 可能是拼写错误、或者误用了其他APP的广告ID | 请重新前往mp.weixin.qq.com确认广告位ID。 |
     * | 1003  | 内部错误    | 该项错误不是开发者的异常情况 | 一般情况下忽略一段时间即可恢复。|
     * | 1004  | 无适合的广告   | 广告不是每一次都会出现，这次没有出现可能是由于该用户不适合浏览广告 | 属于正常情况，且开发者需要针对这种情况做形态上的兼容。 |
     * | 1005  | 广告组件审核中  | 你的广告正在被审核，无法展现广告 | 请前往mp.weixin.qq.com确认审核状态，且开发者需要针对这种情况做形态上的兼容。|
     * | 1006  | 广告组件被驳回  | 你的广告审核失败，无法展现广告 | 请前往mp.weixin.qq.com确认审核状态，且开发者需要针对这种情况做形态上的兼容。|
     * | 1007  | 广告组件被封禁  | 你的广告能力已经被封禁，封禁期间无法展现广告 | 请前往mp.weixin.qq.com确认小程序广告封禁状态。 |
     * | 1008  | 广告单元已关闭  | 该广告位的广告能力已经被关闭 | 请前往mp.weixin.qq.com重新打开对应广告位的展现。| */
    onError(
      /** 激励视频错误事件的监听函数 */
      listener: RewardedVideoAdOnErrorCallback
    ): void;
    /** [RewardedVideoAd.onLoad(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onLoad.html)
     *
     * 在插件中使用：不支持
     *
     * 监听激励视频广告加载事件。 */
    onLoad(
      /** 激励视频广告加载事件的监听函数 */
      listener: OnLoadCallback
    ): void;
  }
  interface Router {
    /** [router.addRouteBuilder(string routeType, function routeBuilder)](https://developers.weixin.qq.com/miniprogram/dev/api/route/router/base/router.addRouteBuilder.html)
*
* 在插件中使用：不支持
*
* 添加自定义路由配置
*
* **自定义路由示例**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/y1IbQpmA7wGZ)
*
* ```js
// 定义自定义效果，从右侧推入
const slideRouteBuilder = (customRouteContext) => {
  const { primaryAnimation } = customRouteContext
  const handlePrimaryAnimation = () => {
    'worklet'
    const transX = windowWidth * (1 - primaryAnimation.value)
	   return {
		   transform: `translateX(${transX}px)`,
	   }
  }
  return {
    handlePrimaryAnimation
  }
}

wx.router.addRouteBuilder('slide', slideRouteBuilder)

// 使用自定义路由
wx.navigateTo({
  url: 'xxx',
  routeType: 'slide'
})
``` */
    addRouteBuilder(
      /** 路由类型 */
      routeType: string,
      /** [路由动画定义函数](#) */
      routeBuilder: CustomRouteBuilder
    ): void;
    /** [router.getRouteContext(Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/route/router/base/router.getRouteContext.html)
     *
     * 在插件中使用：不支持
     *
     * 获取页面对应的自定义路由上下文对象 */
    getRouteContext(
      /** 页面/自定义组件实例 */
      component: Component.TrivialInstance | Page.TrivialInstance
    ): void;
    /** [router.removeRouteBuilder(string routeType)](https://developers.weixin.qq.com/miniprogram/dev/api/route/router/base/router.removeRouteBuilder.html)
     *
     * 在插件中使用：不支持
     *
     * 移除自定义路由配置 */
    removeRouteBuilder(
      /** 路由类型 */
      routeType: string
    ): void;
  }
  interface ScrollViewContext {
    /** [ScrollViewContext.scrollIntoView(string selector)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/ScrollViewContext.scrollIntoView.html)
     *
     * 需要基础库： `2.14.4`
     *
     * 在插件中使用：支持
     *
     * 滚动至指定位置 */
    scrollIntoView(
      /** 元素选择器 */
      selector: string
    ): void;
    /** [ScrollViewContext.scrollTo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/ScrollViewContext.scrollTo.html)
     *
     * 需要基础库： `2.14.4`
     *
     * 在插件中使用：支持
     *
     * 滚动至指定位置 */
    scrollTo(option: ScrollToOption): void;
  }
  interface SelectorQuery {
    /** [[NodesRef](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.html) SelectorQuery.exec(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.exec.html)
     *
     * 在插件中使用：支持
     *
     * 执行所有的请求。请求结果按请求次序构成数组，在callback的第一个参数中返回。 */
    exec(
      /** 回调函数 */
      callback?: (...args: any[]) => any
    ): NodesRef;
    /** [[NodesRef](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.html) SelectorQuery.select(string selector)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.select.html)
     *
     * 在插件中使用：支持
     *
     * 在当前页面下选择第一个匹配选择器 `selector` 的节点。返回一个 `NodesRef` 对象实例，可以用于获取节点信息。
     *
     * **selector 语法**
     *
     * selector类似于 CSS 的选择器，但仅支持下列语法。
     *
     * - ID选择器：#the-id
     * - class选择器（可以连续指定多个）：.a-class.another-class
     * - 子元素选择器：.the-parent > .the-child
     * - 后代选择器：.the-ancestor .the-descendant
     * - 跨自定义组件的后代选择器：.the-ancestor >>> .the-descendant
     * - 多选择器的并集：#a-node, .some-other-nodes */
    select(
      /** 选择器 */
      selector: string
    ): NodesRef;
    /** [[NodesRef](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.html) SelectorQuery.selectAll(string selector)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.selectAll.html)
     *
     * 在插件中使用：支持
     *
     * 在当前页面下选择匹配选择器 selector 的所有节点。
     *
     * **selector 语法**
     *
     * selector类似于 CSS 的选择器，但仅支持下列语法。
     *
     * - ID选择器：#the-id
     * - class选择器（可以连续指定多个）：.a-class.another-class
     * - 子元素选择器：.the-parent > .the-child
     * - 后代选择器：.the-ancestor .the-descendant
     * - 跨自定义组件的后代选择器：.the-ancestor >>> .the-descendant
     * - 多选择器的并集：#a-node, .some-other-nodes */
    selectAll(
      /** 选择器 */
      selector: string
    ): NodesRef;
    /** [[NodesRef](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.html) SelectorQuery.selectViewport()](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.selectViewport.html)
     *
     * 在插件中使用：支持
     *
     * 选择显示区域。可用于获取显示区域的尺寸、滚动位置等信息。 */
    selectViewport(): NodesRef;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) SelectorQuery.in(Component component)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.in.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：支持
*
* 将选择器的选取范围更改为自定义组件 `component` 内。（初始时，选择器仅选取页面范围的节点，不会选取任何自定义组件中的节点）。
*
* **示例代码**
*
* ```js
Component({
  queryMultipleNodes (){
    const query = wx.createSelectorQuery().in(this)
    query.select('#the-id').boundingClientRect(function(res){
      res.top // 这个组件内 #the-id 节点的上边界坐标
    }).exec()
  }
})
``` */
    in(
      /** 自定义组件实例 */
      component: Component.TrivialInstance | Page.TrivialInstance
    ): SelectorQuery;
  }
  interface SocketTask {
    /** [SocketTask.close(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.close.html)
     *
     * 在插件中使用：支持
     *
     * 关闭 WebSocket 连接 */
    close(option: SocketTaskCloseOption): void;
    /** [SocketTask.onClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.onClose.html)
     *
     * 在插件中使用：支持
     *
     * 监听 WebSocket 连接关闭事件 */
    onClose(
      /** WebSocket 连接关闭事件的监听函数 */
      listener: SocketTaskOnCloseCallback
    ): void;
    /** [SocketTask.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.onError.html)
     *
     * 在插件中使用：支持
     *
     * 监听 WebSocket 错误事件 */
    onError(
      /** WebSocket 错误事件的监听函数 */
      listener: UDPSocketOnErrorCallback
    ): void;
    /** [SocketTask.onMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.onMessage.html)
     *
     * 在插件中使用：支持
     *
     * 监听 WebSocket 接收到服务器的消息事件 */
    onMessage(
      /** WebSocket 接收到服务器的消息事件的监听函数 */
      listener: SocketTaskOnMessageCallback
    ): void;
    /** [SocketTask.onOpen(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.onOpen.html)
     *
     * 在插件中使用：支持
     *
     * 监听 WebSocket 连接打开事件 */
    onOpen(
      /** WebSocket 连接打开事件的监听函数 */
      listener: OnOpenCallback
    ): void;
    /** [SocketTask.send(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.send.html)
     *
     * 在插件中使用：支持
     *
     * 通过 WebSocket 连接发送数据 */
    send(option: SocketTaskSendOption): void;
  }
  interface Stats {
    /** [boolean Stats.isDirectory()](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.isDirectory.html)
     *
     * 在插件中使用：需要基础库 `2.19.2`
     *
     * 判断当前文件是否一个目录 */
    isDirectory(): boolean;
    /** [boolean Stats.isFile()](https://developers.weixin.qq.com/miniprogram/dev/api/file/Stats.isFile.html)
     *
     * 在插件中使用：需要基础库 `2.19.2`
     *
     * 判断当前文件是否一个普通文件 */
    isFile(): boolean;
  }
  interface TCPSocket {
    /** [TCPSocket.bindWifi(Object options)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.bindWifi.html)
     *
     * 需要基础库： `2.25.0`
     *
     * 在插件中使用：不支持
     *
     * 将 TCP Socket 绑定到当前 wifi 网络，成功后会触发 onBindWifi 事件（仅安卓支持） */
    bindWifi(options: BindWifiOption): void;
    /** [TCPSocket.close()](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.close.html)
     *
     * 在插件中使用：不支持
     *
     * 关闭连接 */
    close(): void;
    /** [TCPSocket.connect(Object options)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.connect.html)
     *
     * 在插件中使用：不支持
     *
     * 在给定的套接字上启动连接 */
    connect(options: TCPSocketConnectOption): void;
    /** [TCPSocket.offBindWifi(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.offBindWifi.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：不支持
*
* 移除当一个 socket 绑定当前 wifi 网络成功时触发该事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

TCPSocket.onBindWifi(listener)
TCPSocket.offBindWifi(listener) // 需传入与监听时同一个的函数对象
``` */
    offBindWifi(
      /** onBindWifi 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffBindWifiCallback
    ): void;
    /** [TCPSocket.offClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.offClose.html)
*
* 在插件中使用：不支持
*
* 移除一旦 socket 完全关闭就发出该事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

TCPSocket.onClose(listener)
TCPSocket.offClose(listener) // 需传入与监听时同一个的函数对象
``` */
    offClose(
      /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffCloseCallback
    ): void;
    /** [TCPSocket.offConnect(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.offConnect.html)
*
* 在插件中使用：不支持
*
* 移除当一个 socket 连接成功建立的时候触发该事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

TCPSocket.onConnect(listener)
TCPSocket.offConnect(listener) // 需传入与监听时同一个的函数对象
``` */
    offConnect(
      /** onConnect 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffConnectCallback
    ): void;
    /** [TCPSocket.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.offError.html)
*
* 在插件中使用：不支持
*
* 移除当错误发生时触发的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

TCPSocket.onError(listener)
TCPSocket.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffErrorCallback
    ): void;
    /** [TCPSocket.offMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.offMessage.html)
*
* 在插件中使用：不支持
*
* 移除当接收到数据的时触发该事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

TCPSocket.onMessage(listener)
TCPSocket.offMessage(listener) // 需传入与监听时同一个的函数对象
``` */
    offMessage(
      /** onMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: TCPSocketOffMessageCallback
    ): void;
    /** [TCPSocket.onBindWifi(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.onBindWifi.html)
     *
     * 需要基础库： `2.25.0`
     *
     * 在插件中使用：不支持
     *
     * 监听当一个 socket 绑定当前 wifi 网络成功时触发该事件 */
    onBindWifi(
      /** 当一个 socket 绑定当前 wifi 网络成功时触发该事件的监听函数 */
      listener: OnBindWifiCallback
    ): void;
    /** [TCPSocket.onClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.onClose.html)
     *
     * 在插件中使用：不支持
     *
     * 监听一旦 socket 完全关闭就发出该事件 */
    onClose(
      /** 一旦 socket 完全关闭就发出该事件的监听函数 */
      listener: UDPSocketOnCloseCallback
    ): void;
    /** [TCPSocket.onConnect(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.onConnect.html)
     *
     * 在插件中使用：不支持
     *
     * 监听当一个 socket 连接成功建立的时候触发该事件 */
    onConnect(
      /** 当一个 socket 连接成功建立的时候触发该事件的监听函数 */
      listener: OnConnectCallback
    ): void;
    /** [TCPSocket.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.onError.html)
     *
     * 在插件中使用：不支持
     *
     * 监听当错误发生时触发 */
    onError(
      /** 的监听函数 */
      listener: UDPSocketOnErrorCallback
    ): void;
    /** [TCPSocket.onMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.onMessage.html)
     *
     * 在插件中使用：不支持
     *
     * 监听当接收到数据的时触发该事件 */
    onMessage(
      /** 当接收到数据的时触发该事件的监听函数 */
      listener: TCPSocketOnMessageCallback
    ): void;
    /** [TCPSocket.write(string|ArrayBuffer data)](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.write.html)
     *
     * 在插件中使用：不支持
     *
     * 在 socket 上发送数据 */
    write(
      /** 要发送的数据 */
      data: string | ArrayBuffer
    ): void;
  }
  interface UDPSocket {
    /** [UDPSocket.close()](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.close.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 关闭 UDP Socket 实例，相当于销毁。 在关闭之后，UDP Socket 实例不能再发送消息，每次调用 `UDPSocket.send` 将会触发错误事件，并且 message 事件回调函数也不会再也执行。在 `UDPSocket` 实例被创建后将被 Native 强引用，保证其不被 GC。在 `UDPSocket.close` 后将解除对其的强引用，让 UDPSocket 实例遵从 GC。 */
    close(): void;
    /** [UDPSocket.connect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.connect.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 预先连接到指定的 IP 和 port，需要配合 write 方法一起使用 */
    connect(option: UDPSocketConnectOption): void;
    /** [UDPSocket.offClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.offClose.html)
*
* 在插件中使用：需要基础库 `2.11.1`
*
* 移除关闭事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UDPSocket.onClose(listener)
UDPSocket.offClose(listener) // 需传入与监听时同一个的函数对象
``` */
    offClose(
      /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffCloseCallback
    ): void;
    /** [UDPSocket.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.offError.html)
*
* 在插件中使用：需要基础库 `2.11.1`
*
* 移除错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UDPSocket.onError(listener)
UDPSocket.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffErrorCallback
    ): void;
    /** [UDPSocket.offListening(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.offListening.html)
*
* 在插件中使用：需要基础库 `2.11.1`
*
* 移除开始监听数据包消息的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UDPSocket.onListening(listener)
UDPSocket.offListening(listener) // 需传入与监听时同一个的函数对象
``` */
    offListening(
      /** onListening 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffListeningCallback
    ): void;
    /** [UDPSocket.offMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.offMessage.html)
*
* 在插件中使用：需要基础库 `2.11.1`
*
* 移除收到消息的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UDPSocket.onMessage(listener)
UDPSocket.offMessage(listener) // 需传入与监听时同一个的函数对象
``` */
    offMessage(
      /** onMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UDPSocketOffMessageCallback
    ): void;
    /** [UDPSocket.onClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.onClose.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 监听关闭事件 */
    onClose(
      /** 关闭事件的监听函数 */
      listener: UDPSocketOnCloseCallback
    ): void;
    /** [UDPSocket.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.onError.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 监听错误事件 */
    onError(
      /** 错误事件的监听函数 */
      listener: UDPSocketOnErrorCallback
    ): void;
    /** [UDPSocket.onListening(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.onListening.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 监听开始监听数据包消息的事件 */
    onListening(
      /** 开始监听数据包消息的事件的监听函数 */
      listener: OnListeningCallback
    ): void;
    /** [UDPSocket.onMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.onMessage.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 监听收到消息的事件 */
    onMessage(
      /** 收到消息的事件的监听函数 */
      listener: UDPSocketOnMessageCallback
    ): void;
    /** [UDPSocket.send(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.send.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 向指定的 IP 和 port 发送消息。基础库 2.9.0 起支持广播 (指定地址为 255.255.255.255)。 */
    send(option: UDPSocketSendOption): void;
    /** [UDPSocket.setTTL(number ttl)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.setTTL.html)
     *
     * 需要基础库： `2.18.0`
     *
     * 在插件中使用：支持
     *
     * 设置 IP_TTL 套接字选项，用于设置一个 IP 数据包传输时允许的最大跳步数 */
    setTTL(
      /** ttl 参数可以是 0 到 255 之间 */
      ttl: number
    ): void;
    /** [UDPSocket.write()](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.write.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 用法与 send 方法相同，如果没有预先调用 connect 则与 send 无差异（注意即使调用了 connect 也需要在本接口填入地址和端口参数） */
    write(): void;
    /** [number UDPSocket.bind(number port)](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.bind.html)
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 绑定一个系统随机分配的可用端口，或绑定一个指定的端口号 */
    bind(
      /** 需要基础库： `2.9.0`
       *
       * 指定要绑定的端口号，不传则返回系统随机分配的可用端口 */
      port?: number
    ): number;
  }
  interface UpdateManager {
    /** [UpdateManager.applyUpdate()](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.applyUpdate.html)
     *
     * 在插件中使用：不支持
     *
     * 强制小程序重启并使用新版本。在小程序新版本下载完成后（即收到 `onUpdateReady` 回调）调用。
     *
     * **示例代码**
     *
     * [示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html#示例代码) */
    applyUpdate(): void;
    /** [UpdateManager.onCheckForUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.onCheckForUpdate.html)
     *
     * 在插件中使用：不支持
     *
     * 监听向微信后台请求检查更新结果事件。微信在小程序每次启动（包括热启动）时自动检查更新，不需由开发者主动触发。
     *
     * **示例代码**
     *
     * [示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html#示例代码) */
    onCheckForUpdate(
      /** 向微信后台请求检查更新结果事件的监听函数 */
      listener: OnCheckForUpdateCallback
    ): void;
    /** [UpdateManager.onUpdateFailed(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.onUpdateFailed.html)
     *
     * 在插件中使用：不支持
     *
     * 监听小程序更新失败事件。小程序有新版本，客户端主动触发下载（无需开发者触发），下载失败（可能是网络原因等）后回调
     *
     * **示例代码**
     *
     * [示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html#示例代码) */
    onUpdateFailed(
      /** 小程序更新失败事件的监听函数 */
      listener: OnUpdateFailedCallback
    ): void;
    /** [UpdateManager.onUpdateReady(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.onUpdateReady.html)
     *
     * 在插件中使用：不支持
     *
     * 监听小程序有版本更新事件。客户端主动触发下载（无需开发者触发），下载成功后回调
     *
     * **示例代码**
     *
     * [示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html#示例代码) */
    onUpdateReady(
      /** 小程序有版本更新事件的监听函数 */
      listener: OnUpdateReadyCallback
    ): void;
  }
  interface UploadTask {
    /** [UploadTask.abort()](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.abort.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 中断上传任务 */
    abort(): void;
    /** [UploadTask.offHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.offHeadersReceived.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：支持
*
* 移除 HTTP Response Header 事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UploadTask.onHeadersReceived(listener)
UploadTask.offHeadersReceived(listener) // 需传入与监听时同一个的函数对象
``` */
    offHeadersReceived(
      /** onHeadersReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffHeadersReceivedCallback
    ): void;
    /** [UploadTask.offProgressUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.offProgressUpdate.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：支持
*
* 移除上传进度变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

UploadTask.onProgressUpdate(listener)
UploadTask.offProgressUpdate(listener) // 需传入与监听时同一个的函数对象
``` */
    offProgressUpdate(
      /** onProgressUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: UploadTaskOffProgressUpdateCallback
    ): void;
    /** [UploadTask.onHeadersReceived(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.onHeadersReceived.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 监听 HTTP Response Header 事件。会比请求完成事件更早 */
    onHeadersReceived(
      /** HTTP Response Header 事件的监听函数 */
      listener: OnHeadersReceivedCallback
    ): void;
    /** [UploadTask.onProgressUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.onProgressUpdate.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 监听上传进度变化事件 */
    onProgressUpdate(
      /** 上传进度变化事件的监听函数 */
      listener: UploadTaskOnProgressUpdateCallback
    ): void;
  }
  interface UserCryptoManager {
    /** [UserCryptoManager.getLatestUserKey(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/crypto/UserCryptoManager.getLatestUserKey.html)
*
* 需要基础库： `2.17.3`
*
* 在插件中使用：不支持
*
* 获取最新的用户加密密钥
*
* **示例代码**
*
* ```js
const userCryptoManager = wx.getUserCryptoManager()
userCryptoManager.getLatestUserKey({
  success: res => {
    const {encryptKey, iv, version, expireTime} = res
    console.log(encryptKey, iv, version, expireTime)
  }
})
``` */
    getLatestUserKey(option?: GetLatestUserKeyOption): void;
    /** [UserCryptoManager.getRandomValues(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/crypto/UserCryptoManager.getRandomValues.html)
*
* 需要基础库： `2.17.3`
*
* 在插件中使用：不支持
*
* 获取密码学安全随机数
*
* **示例代码**
*
* ```js
wx.getRandomValues({
  length: 6 // 生成 6 个字节长度的随机数,
  success: res => {
    console.log(wx.arrayBufferToBase64(res.randomValues)) // 转换为 base64 字符串后打印
  }
})
``` */
    getRandomValues(option: GetRandomValuesOption): void;
  }
  interface VKCamera {
    /** [Float32Array VKCamera.getProjectionMatrix(number near, number far)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKCamera.getProjectionMatrix.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 获取投影矩阵 */
    getProjectionMatrix(
      /** 近视点 */
      near: number,
      /** 远视点 */
      far: number
    ): Float32Array;
  }
  interface VKFrame {
    /** [ArrayBuffer VKFrame.getCameraBuffer(number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFrame.getCameraBuffer.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 获取当前帧 rgba buffer。iOS 端微信在 v8.0.20 开始支持，安卓端微信在 v8.0.30 开始支持。按 aspect-fill 规则裁剪，此接口要求在创建 VKSession 对象时必须传入 gl 参数。此接口仅建议拿来做帧分析使用，上屏请使用 getCameraTexture 来代替。 */
    getCameraBuffer(
      /** 宽度，受系统限制，必须是 16 的整数倍 */
      width: number,
      /** 高度 */
      height: number
    ): ArrayBuffer;
    /** [Float32Array VKFrame.getDisplayTransform()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFrame.getDisplayTransform.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 获取纹理调整矩阵。默认获取到的纹理是未经裁剪调整的纹理，此矩阵可用于在着色器中根据帧对象尺寸对纹理进行裁剪。 */
    getDisplayTransform(): Float32Array;
    /** [Object VKFrame.getCameraTexture(WebGLRenderingContext gl)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFrame.getCameraTexture.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 获取当前帧纹理，目前只支持 YUV 纹理。 */
    getCameraTexture(
      /** 画布 */
      gl: WebGLRenderingContext
    ): YUVTextureRes;
  }
  interface VKSession {
    /** [Array.&lt;Object&gt; VKSession.getAllMarker()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.getAllMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 获取所有 marker，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.marker 为 true */
    getAllMarker(): VKMarker[];
    /** [Array.&lt;Object&gt; VKSession.getAllOSDMarker()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.getAllOSDMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 获取所有 OSD marker，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.OSD 为 true */
    getAllOSDMarker(): VKMarker[];
    /** [Array.&lt;Object&gt; VKSession.hitTest(number x, number y, Object reset)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.hitTest.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 触摸检测，v1 版本只支持单平面（即 hitTest 生成一次平面后，后续 hitTest 均不会再生成平面，而是以之前生成的平面为基础进行检测）。如果需要重新识别其他平面，可以在调用此方法时将 reset 参数置为 true。 */
    hitTest(
      /** 相对视窗的横坐标，取值范围为 [0, 1]，0 为左边缘，1 为右边缘 */
      x: number,
      /** 相对视窗的纵坐标，取值范围为 [0, 1]，0 为上边缘，1 为下边缘 */
      y: number,
      /** 是否需要重新识别其他平面，v2 版本不再需要此参数 */
      reset: IAnyObject
    ): HitTestRes[];
    /** [VKSession.cancelAnimationFrame(number requestID)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.cancelAnimationFrame.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 取消由 requestAnimationFrame 添加到计划中的动画帧请求。 */
    cancelAnimationFrame(requestID: number): void;
    /** [VKSession.destroy()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.destroy.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 销毁会话。 */
    destroy(): void;
    /** [VKSession.detectBody(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.detectBody.html)
     *
     * 需要基础库： `2.28.0`
     *
     * 在插件中使用：需要基础库 `2.28.0`
     *
     * 静态图像人体关键点检测。当 wx.createVKSession 参数传入 {track: {body: {mode: 2} } } 时可用。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html)。 */
    detectBody(option: DetectBodyOption): void;
    /** [VKSession.detectFace(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.detectFace.html)
     *
     * 需要基础库： `2.25.0`
     *
     * 在插件中使用：需要基础库 `2.25.0`
     *
     * 静态图像人脸关键点检测。当 wx.createVKSession 参数传入 {track: {face: {mode: 2} } } 时可用。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html)。安卓微信8.0.25开始支持，iOS微信8.0.24开始支持。
     *
     * ****
     *
     * ### 特别说明
     * 若小程序人脸识别功能涉及采集、存储用户生物特征（如人脸照片或视频、身份证和手持身份证、身份证照和免冠照等），此类型服务需使用[微信原生人脸识别接口](https://developers.weixin.qq.com/community/develop/doc/000442d352c1202bd498ecb105c00d?highline=%E4%BA%BA%E8%84%B8%E6%A0%B8%E8%BA%AB)。 */
    detectFace(option: DetectFaceOption): void;
    /** [VKSession.detectHand(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.detectHand.html)
     *
     * 需要基础库： `2.28.0`
     *
     * 在插件中使用：需要基础库 `2.28.0`
     *
     * 静态图像手势关键点检测。当 wx.createVKSession 参数传入 {track: {hand: {mode: 2} } } 时可用。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/hand.html)。 */
    detectHand(option: DetectHandOption): void;
    /** [VKSession.off(string eventName, function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.off.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 取消监听会话事件。 */
    off(
      /** 事件名称 */
      eventName: string,
      /** 事件监听函数 */
      fn: (...args: any[]) => any
    ): void;
    /** [VKSession.on(string eventName, function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.on.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 监听会话事件。 */
    on(
      /** 事件名称
       *
       * 参数 eventName 可选值：
       * - 'resize': 相机尺寸变化事件，回调参数为相机尺寸;
       * - 'addAnchors': 增加 anchor 事件，回调参数为 [VKPlaneAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKPlaneAnchor.html)/[VKMarkerAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKMarkerAnchor.html)/[VKOSDAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKOSDAnchor.html) 列表（只有v2版本支持）;
       * - 'updateAnchors': 更新 anchor 事件，回调参数为 [VKPlaneAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKPlaneAnchor.html)/[VKMarkerAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKMarkerAnchor.html)/[VKOSDAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKOSDAnchor.html) 列表（只有v2版本支持） 或 [VKFaceAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFaceAnchor.html)/[VKOCRAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKOCRAnchor.html)/[VKHandAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKHandAnchor.html)/[VKBodyAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKBodyAnchor.html)列表（v1、v2都支持）;
       * - 'removeAnchors': 删除 anchor 事件，回调参数为 [VKPlaneAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKPlaneAnchor.html)/[VKMarkerAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKMarkerAnchor.html)/[VKOSDAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKOSDAnchor.html) 列表（只有v2版本支持） 或 [VKFaceAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFaceAnchor.html)/[VKOCRAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKOCRAnchor.html)/[VKHandAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKHandAnchor.html)/[VKBodyAnchor](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKBodyAnchor.html) 列表（v1、v2都支持）; */
      eventName: 'resize' | 'addAnchors' | 'updateAnchors' | 'removeAnchors',
      /** 事件监听函数 */
      fn: (...args: any[]) => any
    ): void;
    /** [VKSession.removeMarker(number markerId)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.removeMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 删除一个 marker，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.marker 为 true */
    removeMarker(
      /** marker id */
      markerId: number
    ): void;
    /** [VKSession.removeOSDMarker(number markerId)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.removeOSDMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 删除一个 OSD marker，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.OSD 为 true */
    removeOSDMarker(
      /** marker id */
      markerId: number
    ): void;
    /** [VKSession.runOCR(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.runOCR.html)
     *
     * 需要基础库： `2.27.0`
     *
     * 在插件中使用：需要基础库 `2.27.0`
     *
     * 静态图像OCR检测。当 wx.createVKSession 参数传入 {track: {OCR: {mode: 2} } } 时可用。用法详情[指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/ocr.html)。 */
    runOCR(option: RunOCROption): void;
    /** [VKSession.start(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.start.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 开启会话。 */
    start(
      /** 开启会话回调 */
      callback: VKSessionStartCallback
    ): void;
    /** [VKSession.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.stop.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 停止会话。 */
    stop(): void;
    /** [VKSession.update3DMode(boolean open3d)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.update3DMode.html)
     *
     * 需要基础库： `2.30.2`
     *
     * 在插件中使用：需要基础库 `2.30.2`
     *
     * 开启3D模式 */
    update3DMode(
      /** 是否开启 */
      open3d: boolean
    ): void;
    /** [VKSession.updateOSDThreshold(number threshold)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.updateOSDThreshold.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 更新 OSD 识别精确度，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.OSD 为 true */
    updateOSDThreshold(
      /** 阈值 */
      threshold: number
    ): void;
    /** [[VKFrame](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKFrame.html) VKSession.getVKFrame(number width, number height)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.getVKFrame.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 获取帧对象，每调用一次都会触发一次帧分析过程。目前 VKSession 相机的最大帧数是 30 fps，因此调用 getVKFrame 的频率也可以限制在 30 fps，以减少渲染开销。 */
    getVKFrame(
      /** 宽度 */
      width: number,
      /** 高度 */
      height: number
    ): VKFrame;
    /** [number VKSession.addMarker(string path)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.addMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 添加一个 marker，要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.marker 为 true
     *
     * **使用提示**
     *
     * 注意事项：
     * 1. 使用 addMarker 接口之前，需要在 createVKSession 的时候声明开启 marker 跟踪。即 wx.createVKSession({ track: { marker: true } })
     * 2. 可以添加多个 marker 图片，但不能重复添加相同的 marker 图片。
     *
     * ### 2Dmarker
     * 对传入的图片有如下要求：
     * 1. 格式：jpg/png 格式三通道彩图或者 1 通道灰度图
     * 2. 分辨率：尺寸在 480x480 ~ 1920x1920 之间，建议为 1080 分辨率
     * 3. 宽高比：在 1:1 ~ 16:9 之间，要求尽量方正，避免狭长的图片
     * 4. 质量：目标图像为平面模型，需要占画面主体，避免大面积留白，建议用扫描件
     *
     * 示例：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/sJPS5gttY4yQq-CmG9crrtaOpjb6Yc6mDhJKdUmrIpmtbWBMfAUAFavtKT6-tEZIh-8zT8tfBJBtvH048ge5Vw" alt="image.png" />
     *
     * 建议：
     *
     * 1. 图片具有丰富的细节
     * 2. 避免重复单一的纹理，例如：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/VfNcS-M6nPWWXq_CJ483Dq3iLsNXMvLiM6Wb5ZHOrVVGR2u5ixbQlbiSSuNHzVcMQQY5V0dvnlyOGihUIbyTvA" alt="image.png" />
     * <br>
     * <img width="500px" src="https://res.wx.qq.com/op_res/VfNcS-M6nPWWXq_CJ483Dq-_lR2j4eOi23IOJ2LHFQY_PWufbx3s3uROgLi_flJMHQA8DNvlebs9UwumozPlXg" alt="image.png" />
     * <br>
     * <img width="500px" src="https://res.wx.qq.com/op_res/VfNcS-M6nPWWXq_CJ483Dr9IaSPF18UPnz4KrbAhGW9pIb8oWxzHgmClGIRZK59N4gUnJh69yoQW1TFGqce8ew" alt="image.png" />
     * <br>
     *
     * 3. 避免使用柔和平滑边缘的纹理及大量渐变图像，例如：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCq6DPj88qSVwHFZiumbE0IMq9ibzbnhjewzUSa-n5_VgF_lF9g07FFHHYyrY14KTSfA" alt="image.png" />
     *
     * 4. 避免模糊，建议采用高清、高对比度图像作为识别对象
     * 5. 建议图像有均匀的特征（角点）分布，正确示例：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/sJPS5gttY4yQq-CmG9crrrBRWB_Cw2aFXAn1KY0YtfjnQ7WNt854gA8H2zfmZUztlFcJbdEHouBGs63hUO4Mxg" alt="image.png" />
     *
     * 避免角点较少、中间大量空白、没有特征及角点的图像，错误示例：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCqzjY2LY-ylRjFS7TVD-cZsEE8TTB-xzR2YiWKhWyWg1bgpbRqQq-4l6OWPDii4S3Xg" alt="image.png" />
     *
     * ### 3Dmarker
     * 现小程序demo支持通过上传视频, 生成对应模型的3dmarker识别文件,后缀名为.map
     *
     * 对传入的视频有如下要求：
     * 1.视频长宽比为16:9或4:3; 短边大于480px
     * 2.目标物体易于和背景物体区分出来，同时目标物体放置与背景物体一定距离，放置底面与物体易于区分，底面可以放置一张白纸，例如：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/a0ooLtlHHfpfb37tq3AxZWPrfqINIs2MvJnZxQeTLzkpbgAGn6m8CaWAoy_osmlVDVhWm16e-yBDXjIY0dhCEQ" alt="image.png" />
     *
     * 3.目标物体最好为刚体，本身不会发生较大形变， 容易变形的物体不适合用作识别对象
     * 4.视频匀速移动，避免模糊，对目标识别面环绕物体拍摄，需要保证相机有足够的平移移动
     * 5.marker物体要求与2d图像要求类似，具有丰富细节，避免重复单一纹理，不反光，无高光
     * 6.拍摄视频中特征纹理丰富，如果marker本身问题较弱，可以在背景中适当添加纹理物体
     * 服务耗时：当前版本30s视频耗时约20分钟，请静待算法返回模型
     *
     * 建议：
     *
     * 1.视频格式：视频帧率30fps，分辨率建议1080p
     * 2.视频时长：视频建议时长在20s~30s，超过30s会被截断，时长过短会导致marker效果欠佳 */
    addMarker(
      /** 图片路径，目前只支持本地用户图片 */
      path: string
    ): number;
    /** [number VKSession.addOSDMarker(string path)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.addOSDMarker.html)
     *
     * 需要基础库： `2.24.5`
     *
     * 在插件中使用：需要基础库 `2.24.5`
     *
     * 添加一个 OSD marker（one-shot detection marker），要求调 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 时传入的 track.OSD 为 true
     *
     * **使用提示**
     *
     * 注意事项：
     * 1. 使用 addOSDMarker 接口之前，需要在 createVKSession 的时候声明开启 OSD 跟踪。即 wx.createVKSession({ track: { OSD: true } })
     * 2. 可以添加多个 OSDMarker 图片，但不能重复添加相同的 OSDMarker 图片。
     *
     * 对传入的图片有如下要求：
     * 1. 格式：jpg 格式彩色图片
     * 2. 分辨率：尺寸不低于 240x240
     * 3. 宽高比：在 1:1 ~ 16:9 之间，要求尽量方正，避免狭长的图片
     * 4. 质量：目标物体需要占画面主体，避免大面积留白，避免大面积文字，不能含其他物体。
     *
     * 示例：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCq_Mq0ReXEA5nOzDIvnYYPttmwxn0V1e_yI6UUgkNT6K6aOQj2QRba5IHQglHULkrKg" alt="image.png" />
     * <br>
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCqwiRcyGk9oenkCpd3vAHWSTSZPPJcgIrPzcpwnSpmk_9bMiCqUdS8Ds789Rjhy0CtA" alt="image.png" />
     * <br>
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCqx8fYUYypBmFmB1_zX-APH06j1oMZDz7K0CE2To_982NDOB5fmM4Y2Rrr1uQF6J4gg" alt="image.png" />
     * <br>
     *
     * 建议：
     *
     * 1. 具有丰富的细节，避免纯色且形状特点不鲜明的物体，例如：
     *
     * <img width="500px" src="https://res.wx.qq.com/op_res/rg0BkiSl-LPBybgJtcQCq-6WwSZKlNbN-if0NCag-Dm6AmNJeBFi5dvR-bRZINlZmuA9G1e4wpngvhlr2z6CXQ" alt="image.png" />
     *
     * 2. 避免模糊，最好采用高清图片 */
    addOSDMarker(
      /** 图片路径，目前只支持本地用户图片 */
      path: string
    ): number;
    /** [number VKSession.requestAnimationFrame(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.requestAnimationFrame.html)
     *
     * 需要基础库： `2.20.0`
     *
     * 在插件中使用：需要基础库 `2.20.0`
     *
     * 在下次进行重绘时执行。 */
    requestAnimationFrame(
      /** 执行的 callback */
      callback: (...args: any[]) => any
    ): number;
  }
  interface VideoContext {
    /** [VideoContext.exitBackgroundPlayback()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.exitBackgroundPlayback.html)
     *
     * 需要基础库： `2.14.3`
     *
     * 在插件中使用：支持
     *
     * 退出后台音频播放模式。 */
    exitBackgroundPlayback(): void;
    /** [VideoContext.exitCasting()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.exitCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 退出投屏。仅支持在 tap 事件回调内调用。 */
    exitCasting(): void;
    /** [VideoContext.exitFullScreen()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.exitFullScreen.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 退出全屏 */
    exitFullScreen(): void;
    /** [VideoContext.exitPictureInPicture(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.exitPictureInPicture.html)
     *
     * 在插件中使用：支持
     *
     * 退出小窗，该方法可在任意页面调用 */
    exitPictureInPicture(option?: ExitPictureInPictureOption): void;
    /** [VideoContext.hideStatusBar()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.hideStatusBar.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 隐藏状态栏，仅在iOS全屏下有效 */
    hideStatusBar(): void;
    /** [VideoContext.pause()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.pause.html)
     *
     * 在插件中使用：支持
     *
     * 暂停视频 */
    pause(): void;
    /** [VideoContext.play()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.play.html)
     *
     * 在插件中使用：支持
     *
     * 播放视频 */
    play(): void;
    /** [VideoContext.playbackRate(number rate)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.playbackRate.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 设置倍速播放 */
    playbackRate(
      /** 倍率，支持 0.5/0.8/1.0/1.25/1.5，2.6.3 起支持 2.0 倍速 */
      rate: number
    ): void;
    /** [VideoContext.reconnectCasting()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.reconnectCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 重连投屏设备。仅支持在 tap 事件回调内调用。 */
    reconnectCasting(): void;
    /** [VideoContext.requestBackgroundPlayback()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.requestBackgroundPlayback.html)
     *
     * 需要基础库： `2.14.3`
     *
     * 在插件中使用：支持
     *
     * 进入后台音频播放模式。 */
    requestBackgroundPlayback(): void;
    /** [VideoContext.requestFullScreen(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.requestFullScreen.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：支持
     *
     * 进入全屏。若有自定义内容需在全屏时展示，需将内容节点放置到 video 节点内。 */
    requestFullScreen(option: VideoContextRequestFullScreenOption): void;
    /** [VideoContext.seek(number position)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.seek.html)
     *
     * 在插件中使用：支持
     *
     * 跳转到指定位置 */
    seek(
      /** 跳转到的位置，单位 s */
      position: number
    ): void;
    /** [VideoContext.sendDanmu(Object data)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.sendDanmu.html)
     *
     * 在插件中使用：支持
     *
     * 发送弹幕 */
    sendDanmu(
      /** 弹幕内容 */
      data: Danmu
    ): void;
    /** [VideoContext.showStatusBar()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.showStatusBar.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：支持
     *
     * 显示状态栏，仅在iOS全屏下有效 */
    showStatusBar(): void;
    /** [VideoContext.startCasting()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.startCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 开始投屏, 拉起半屏搜索设备。仅支持在 tap 事件回调内调用。 */
    startCasting(): void;
    /** [VideoContext.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.stop.html)
     *
     * 需要基础库： `1.7.0`
     *
     * 在插件中使用：支持
     *
     * 停止视频 */
    stop(): void;
    /** [VideoContext.switchCasting()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.switchCasting.html)
     *
     * 需要基础库： `2.32.0`
     *
     * 在插件中使用：支持
     *
     * 切换投屏设备。仅支持在 tap 事件回调内调用。 */
    switchCasting(): void;
  }
  interface VideoDecoder {
    /** [Object VideoDecoder.getFrameData()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.getFrameData.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 获取下一帧的解码数据 */
    getFrameData(): FrameDataOptions;
    /** [Promise VideoDecoder.remove()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.remove.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 移除解码器 */
    remove(): Promise<any>;
    /** [Promise VideoDecoder.seek(number position)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.seek.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 跳到某个时间点解码 */
    seek(
      /** 跳转的解码位置，单位 ms */
      position: number
    ): Promise<any>;
    /** [Promise VideoDecoder.start(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.start.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 开始解码 */
    start(option: VideoDecoderStartOption): Promise<any>;
    /** [Promise VideoDecoder.stop()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.stop.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 停止解码 */
    stop(): Promise<any>;
    /** [VideoDecoder.off(string eventName, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.off.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 取消监听录制事件。当对应事件触发时，该回调函数不再执行 */
    off(
      /** 事件名 */
      eventName: string,
      /** 事件触发时执行的回调函数 */
      callback: (...args: any[]) => any
    ): void;
    /** [VideoDecoder.on(string eventName, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.on.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 注册监听录制事件的回调函数。当对应事件触发时，回调函数会被执行 */
    on(
      /** 事件名
       *
       * 参数 eventName 可选值：
       * - 'start': 开始事件。返回 {width, height};
       * - 'stop': 结束事件。;
       * - 'seek': seek 完成事件。;
       * - 'bufferchange': 缓冲区变化事件。;
       * - 'ended': 解码结束事件。; */
      eventName: 'start' | 'stop' | 'seek' | 'bufferchange' | 'ended',
      /** 事件触发时执行的回调函数 */
      callback: (...args: any[]) => any
    ): void;
  }
  interface WebAudioContext {
    /** [AnalyserNode WebAudioContext.createAnalyser()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createAnalyser.html)
     *
     * 需要基础库： `2.22.0`
     *
     * 在插件中使用：不支持
     *
     * 创建一个 AnalyserNode 。可以用来获取音频时间和频率数据，以及实现数据可视化。 */
    createAnalyser(): AnalyserNode;
    /** [BiquadFilterNode WebAudioContext.createBiquadFilter()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createBiquadFilter.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个BiquadFilterNode */
    createBiquadFilter(): BiquadFilterNode;
    /** [BufferSourceNode WebAudioContext.createBufferSource()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createBufferSource.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个BufferSourceNode实例，通过AudioBuffer对象来播放音频数据。 */
    createBufferSource(): BufferSourceNode;
    /** [ChannelMergerNode WebAudioContext.createChannelMerger(number numberOfInputs)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createChannelMerger.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个ChannelMergerNode */
    createChannelMerger(
      /** 输出流中需要保持的输入流的个数 */
      numberOfInputs: number
    ): ChannelMergerNode;
    /** [ChannelSplitterNode WebAudioContext.createChannelSplitter(number numberOfOutputs)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createChannelSplitter.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个ChannelSplitterNode */
    createChannelSplitter(
      /** 要分别输出的输入音频流中的通道数 */
      numberOfOutputs: number
    ): ChannelSplitterNode;
    /** [ConstantSourceNode WebAudioContext.createConstantSource()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createConstantSource.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个ConstantSourceNode */
    createConstantSource(): ConstantSourceNode;
    /** [DelayNode WebAudioContext.createDelay(number maxDelayTime)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createDelay.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个DelayNode */
    createDelay(
      /** 最大延迟时间 */
      maxDelayTime: number
    ): DelayNode;
    /** [DynamicsCompressorNode WebAudioContext.createDynamicsCompressor()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createDynamicsCompressor.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个DynamicsCompressorNode */
    createDynamicsCompressor(): DynamicsCompressorNode;
    /** [GainNode WebAudioContext.createGain()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createGain.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个GainNode */
    createGain(): GainNode;
    /** [IIRFilterNode WebAudioContext.createIIRFilter(Array.&lt;number&gt; feedforward, Array.&lt;number&gt; feedback)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createIIRFilter.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个IIRFilterNode */
    createIIRFilter(
      /** 一个浮点值数组，指定IIR滤波器传递函数的前馈(分子)系数。 */
      feedforward: number[],
      /** 一个浮点值数组，指定IIR滤波器传递函数的反馈(分母)系数。 */
      feedback: number[]
    ): IIRFilterNode;
    /** [OscillatorNode WebAudioContext.createOscillator()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createOscillator.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个OscillatorNode */
    createOscillator(): OscillatorNode;
    /** [PannerNode WebAudioContext.createPanner()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createPanner.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个PannerNode */
    createPanner(): PannerNode;
    /** [PeriodicWaveNode WebAudioContext.createPeriodicWave(Float32Array real, Float32Array imag, object constraints)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createPeriodicWave.html)
*
* 在插件中使用：不支持
*
* 创建一个PeriodicWaveNode
*
* **注意**
*
* `real`和`imag`数组必须拥有一样的长度，否则抛出错误
* ```js
const real = new Float32Array(2)
const imag = new Float32Array(2)
real[0] = 0
imag[0] = 0
real[1] = 1
imag[1] = 0

const waveNode = audioContext.createPeriodicWave(real, imag, {disableNormalization: true})
``` */
    createPeriodicWave(
      /** 一组余弦项(传统上是A项) */
      real: Float32Array,
      /** 一组余弦项(传统上是A项) */
      imag: Float32Array,
      /** 一个字典对象，它指定是否应该禁用规范化(默认启用规范化) */
      constraints: Constraints
    ): PeriodicWaveNode;
    /** [Promise WebAudioContext.close()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.close.html)
*
* 在插件中使用：不支持
*
* 关闭WebAudioContext
*
* **注意事项**
*
* 同步关闭对应的WebAudio上下文。close后会立即释放当前上下文的资源，<b>不要在close后再次访问state属性。</b>
* ```js
const audioCtx = wx.createWebAudioContext()
audioCtx.close().then(() => {
  console.log(audioCtx.state) // bad case：不应该在close后再访问state
})
``` */
    close(): Promise<any>;
    /** [Promise WebAudioContext.resume()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.resume.html)
     *
     * 在插件中使用：不支持
     *
     * 同步恢复已经被暂停的WebAudioContext上下文 */
    resume(): Promise<any>;
    /** [Promise WebAudioContext.suspend()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.suspend.html)
     *
     * 在插件中使用：不支持
     *
     * 同步暂停WebAudioContext上下文 */
    suspend(): Promise<any>;
    /** [ScriptProcessorNode WebAudioContext.createScriptProcessor(number bufferSize, number numberOfInputChannels, number numberOfOutputChannels)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createScriptProcessor.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个ScriptProcessorNode */
    createScriptProcessor(
      /** 缓冲区大小，以样本帧为单位 */
      bufferSize: number,
      /** 用于指定输入node的声道的数量 */
      numberOfInputChannels: number,
      /** 用于指定输出node的声道的数量 */
      numberOfOutputChannels: number
    ): ScriptProcessorNode;
    /** [WaveShaperNode WebAudioContext.createWaveShaper()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createWaveShaper.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个WaveShaperNode */
    createWaveShaper(): WaveShaperNode;
    /** [[AudioBuffer](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioBuffer.html) WebAudioContext.createBuffer(number numOfChannels, number length, number sampleRate)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.createBuffer.html)
     *
     * 在插件中使用：不支持
     *
     * 创建一个AudioBuffer，代表着一段驻留在内存中的短音频 */
    createBuffer(
      /** 定义了 buffer 中包含的声频通道数量的整数 */
      numOfChannels: number,
      /** 代表 buffer 中的样本帧数的整数 */
      length: number,
      /** 线性音频样本的采样率，即每一秒包含的关键帧的个数 */
      sampleRate: number
    ): AudioBuffer;
    /** [[AudioBuffer](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioBuffer.html) WebAudioContext.decodeAudioData()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.decodeAudioData.html)
     *
     * 在插件中使用：不支持
     *
     * 异步解码一段资源为AudioBuffer。 */
    decodeAudioData(): AudioBuffer;
  }
  interface WifiError {
    /** 错误信息
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 12000 | not init | 未先调用 `startWifi` 接口 |
     * | 12001 | system not support | 当前系统不支持相关能力 |
     * | 12002 | password error Wi-Fi | 密码错误 |
     * | 12003 | connection timeout | 连接超时, 仅 Android 支持 |
     * | 12004 | duplicate request | 重复连接 Wi-Fi |
     * | 12005 | wifi not turned on | Android 特有，未打开 Wi-Fi 开关 |
     * | 12006 | gps not turned on | Android 特有，未打开 GPS 定位开关 |
     * | 12007 | user denied | 用户拒绝授权链接 Wi-Fi |
     * | 12008 | invalid SSID | 无效 SSID |
     * | 12009 | system config err | 系统运营商配置拒绝连接 Wi-Fi |
     * | 12010 | system internal error | 系统其他错误，需要在 errmsg 打印具体的错误原因 |
     * | 12011 | weapp in background | 应用在后台无法配置 Wi-Fi |
     * | 12013 | wifi config may be expired | 系统保存的 Wi-Fi 配置过期，建议忘记 Wi-Fi 后重试，仅 Android 支持 |
     * | 12014 | invalid WEP / WPA password | iOS 特有，无效的 WEP / WPA 密码 | */ errMsg: string;
    /** 错误码
     *
     * | 错误码 | 错误信息 | 说明 |
     * | - | - | - |
     * | 0 | ok | 正常 |
     * | 12000 | not init | 未先调用 `startWifi` 接口 |
     * | 12001 | system not support | 当前系统不支持相关能力 |
     * | 12002 | password error Wi-Fi | 密码错误 |
     * | 12003 | connection timeout | 连接超时, 仅 Android 支持 |
     * | 12004 | duplicate request | 重复连接 Wi-Fi |
     * | 12005 | wifi not turned on | Android 特有，未打开 Wi-Fi 开关 |
     * | 12006 | gps not turned on | Android 特有，未打开 GPS 定位开关 |
     * | 12007 | user denied | 用户拒绝授权链接 Wi-Fi |
     * | 12008 | invalid SSID | 无效 SSID |
     * | 12009 | system config err | 系统运营商配置拒绝连接 Wi-Fi |
     * | 12010 | system internal error | 系统其他错误，需要在 errmsg 打印具体的错误原因 |
     * | 12011 | weapp in background | 应用在后台无法配置 Wi-Fi |
     * | 12013 | wifi config may be expired | 系统保存的 Wi-Fi 配置过期，建议忘记 Wi-Fi 后重试，仅 Android 支持 |
     * | 12014 | invalid WEP / WPA password | iOS 特有，无效的 WEP / WPA 密码 | */ errCode: number;
  }
  interface Worker {
    /** [ArrayBuffer Worker.getCameraFrameData()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.getCameraFrameData.html)
*
* 需要基础库： `2.25.1`
*
* 在插件中使用：不支持
*
* 获取摄像头当前帧图像，返回ArrayBuffer数据。仅限在 worker 线程中使用。
*
* **示例代码**
*
* ```js
// app.js
const worker = wx.createWorker('workers/index.js', {
  useExperimentalWorker: true
})

const cameraContext = wx.createCameraContext()
const cameraFrameListener = cameraContext.onCameraFrame(function() {})
cameraFrameListener.start({
  worker: worker
})
```
*
* ```js
// workers/index.js
const data = worker.getCameraFrameData()
console.log(data)
``` */
    getCameraFrameData(): ArrayBuffer;
    /** [Worker.onMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.onMessage.html)
     *
     * 在插件中使用：不支持
     *
     * 监听主线程/Worker 线程向当前线程发送的消息的事件。 */
    onMessage(
      /** 主线程/Worker 线程向当前线程发送的消息的事件的监听函数 */
      listener: WorkerOnMessageCallback
    ): void;
    /** [Worker.onProcessKilled(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.onProcessKilled.html)
     *
     * 在插件中使用：不支持
     *
     * 监听 worker线程被系统回收事件（开启 useExperimentalWorker 后，当iOS系统资源紧张时，ExperimentalWorker 线程存在被系统回收的可能，开发者可监听此事件并重新创建一个worker）。仅限在主线程 worker 对象上调用。 */
    onProcessKilled(
      /** worker线程被系统回收事件的监听函数 */
      listener: OnProcessKilledCallback
    ): void;
    /** [Worker.postMessage(Object message)](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.postMessage.html)
*
* 在插件中使用：不支持
*
* 向主线程/Worker 线程发送的消息。
*
* **示例代码**
*
* worker 线程中
* ```js
worker.postMessage({
  msg: 'hello from worker'
})
```
*
* 主线程中
* ```js
const worker = wx.createWorker('workers/request/index.js')

worker.postMessage({
  msg: 'hello from main'
})
```
*
* **提醒**
*
* 在基础库版本2.20.2之前，postMessage仅支持传递可序列化的key-value对象。
* 在基础库2.20.2之后，postMessage支持传递任意类型的数据。 */
    postMessage(
      /** 需要发送的消息。 */
      message: IAnyObject
    ): void;
    /** [Worker.terminate()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.terminate.html)
     *
     * 在插件中使用：不支持
     *
     * 结束当前 Worker 线程。仅限在主线程 worker 对象上调用。 */
    terminate(): void;
    /** [Worker.testOnProcessKilled()](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.testOnProcessKilled.html)
*
* 需要基础库： `2.27.1`
*
* 在插件中使用：不支持
*
* 用于模拟 iOS ExperimentalWorker 线程被系统回收事件，以便于调试。接口仅在 worker 线程内可用。参考 [Worker.onProcessKilled](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.onProcessKilled.html)
*
* **示例代码**
*
* ```js
// game.js
const worker = wx.createWorker('workers/index.js', {
  useExperimentalWorker: true
})

// 监听 ExperimentalWorker 被系统回收事件
worker.onProcessKilled(function () {
  console.log('worker has been killed')
  // 重新创建一个worker
  // wx.createWorker()
})
```
*
* ```js
// workers/index.js
setTimeout(() => {
  // 模拟 ExperimentalWorker 线程被系统回收事件
  worker.testOnProcessKilled()
}, 2000)
``` */
    testOnProcessKilled(): void;
  }
  interface Worklet {
    /** Easing 模块实现了常见的动画缓动函数（动画效果参考 https://easings.net/ ），可从 [wx.worklet](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/wx.worklet.html) 对象中读取。
*
* ****
*
* ## 示例代码
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/f94TCOmg7JFH)
*
* ### 预置动画函数
*
* * [Easing.bounce](#Easing.bounce) 反弹动画
* * [Easing.ease](#Easing.ease) 惯性动画
* * [Easing.elastic](#Easing.elastic) 弹性动画
*
* ### 标准缓动函数
*
* * [Easing.linear](#Easing.linear) 线性
* * [Easing.quad](#Easing.quad) 二次方
* * [Easing.cubic](#Easing.cubic) 三次方
* * [Easing.poly](#Easing.poly) 实现其它幂函数
*
* ### 其它数学函数
*
* * [Easing.bezier](#Easing.bezier) 三次贝塞尔曲线
* * [Easing.circle](#Easing.circle) 圆形曲线
* * [Easing.sin](#Easing.sin) 正弦函数
* * [Easing.exp](#Easing.exp) 指数函数
*
* ### 缓动方式
*
* 以上效果均有三种缓动方式
*
* * [Easing.in](#in) 正向执行缓动函数
* * [Easing.out](#out) 反向执行缓动函数
* * [Easing.inOut](#inout) 前半程正向，后半程反向
* 以 `sin` 函数为例，其中 `Easing.in(Easing.sin)` 和直接使用 `Easing.sin` 效果相同。
*
* 1. `Easing.in(Easing.sin)` 动画效果参考 https://easings.net/#easeInSine
* 2. `Easing.out(Easing.sin)` 动画效果参考 https://easings.net/#easeOutSine
* 3. `Easing.inOut(Easing.sin)` 动画效果参考 https://easings.net/#easeInOutSine
*
* ### Easing.bounce
*
* 简单的反弹效果，[动画效果参考](https://easings.net/#easeInBounce)
*
* ```js
Easing.bounce(t)
```
*
* ### Easing.ease
*
* 简单的惯性动画，[动画效果参考](https://cubic-bezier.com/#.42,0,1,1)
*
* ```js
Easing.ease(t)
```
*
* ### Easing.elastic
*
* 简单的弹性动画，类似弹簧来回摆动，高阶函数。默认弹性为 1，会稍微超出一次。弹性为 0 时 不会过冲。[动画效果参考](https://easings.net/#easeInElastic)
*
* ```js
Easing.elastic(bounciness = 1)
```
*
* ### Easing.linear
*
* 线性函数，f(t) = t，[动画效果参考](https://cubic-bezier.com/#0,0,1,1)
*
* ```js
Easing.linear(t)
```
* ### Easing.quad
*
* 二次方函数，f(t) = t * t，[动画效果参考](https://easings.net/#easeInQuad)
*
* ```js
Easing.quad(t)
```
*
* ### Easing.cubic
*
* 立方函数，f(t) = t * t * t，[动画效果参考](https://easings.net/#easeInCubic)
*
* ```js
Easing.cubic(t)
```
*
* ### Easing.poly
*
* 高阶函数，返回幂函数
*
* poly(4): [动画效果参考](https://easings.net/#easeInQuart)
*
* poly(5): [动画效果参考](https://easings.net/#easeInQuint)
*
* ```js
Easing.poly(n)
```
*
* ### Easing.bezier
*
* 三次贝塞尔曲线，效果同 css `transition-timing-function`
*
* 调试参数可借助 [可视化工具](https://cubic-bezier.com/)
*
* ```js
Easing.bezier(x1, y1, x2, y2)
```
*
* ### Easing.circle
*
* 圆形曲线，[动画效果参考](https://easings.net/#easeInCirc)
*
* ```js
Easing.circle(t)
```
*
* ### Easing.sin
*
* 正弦函数，[动画效果参考](https://easings.net/#easeInSine)
*
* ```js
Easing.sin(t)
```
*
* ### Easing.exp
*
* 指数函数，[动画效果参考](https://easings.net/#easeInExpo)
*
* ```js
Easing.exp(t)
```
*
* ### Easing.in
*
* 正向运行 `easing function`，高阶函数。
*
* ```js
Easing.in(easing)
```
*
* ### Easing.out
*
* 反向运行 `easing function`，高阶函数。
*
* ```js
Easing.out(easing)
```
*
* ### Easing.inOut
*
* 前半程正向，后半程反向，高阶函数。
*
* ```js
Easing.inOut(easing)
``` */
    Easing: WorkletEasing;
    /** [AnimationObject worklet.decay(Object options, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.decay.html)
*
* 在插件中使用：不支持
*
* 基于滚动衰减的动画。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/zaI8sgmw7lGW)
*
* ```html
* <pan-gesture-handler onGestureEvent="handlepan">
*   <view class="circle"></view>
* </pan-gesture-handler>
* ```
*
* ```js
const { shared, decay } = wx.worklet
Page({
  onLoad() {
    this._offset = shared(0);
    this.applyAnimatedStyle('.circle', () => {
      'worklet';
      return {
        transform: `translateX(${this._offset.value}px)`
      };
    });
  },
  handlepan(evt) {
    'worklet';
    if (evt.state === GestureState.ACTIVE) {
      this._offset.value += evt.deltaX;
    } else if (evt.state === GestureState.END) {
      this._offset.value = decay({
         velocity: evt.velocityX,
         clamp: [-200, 200],
        },
        () => {
           'worklet'
           console.info('@@@ decay finish')
        }
      );
    }
  }
});
``` */
    decay(
      /** 动画配置 */
      options: DecayOption,
      /** 动画完成回调。动画被取消时，返回 fasle，正常完成时返回 true。 */
      callback: (...args: any[]) => any
    ): AnimationObject;
    /** [AnimationObject worklet.delay(number delayMS, AnimationObject delayedAnimation)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.delay.html)
     *
     * 在插件中使用：不支持
     *
     * 延迟执行动画。 */
    delay(
      /** 动画开始前等待的时间，单位：毫秒。 */
      delayMS: number,
      /** 动画对象。 */
      delayedAnimation: AnimationObject
    ): AnimationObject;
    /** [AnimationObject worklet.repeat(AnimationObject animation, number numberOfReps, boolean reverse, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.repeat.html)
     *
     * 在插件中使用：不支持
     *
     * 重复执行动画。 */
    repeat(
      /** 动画对象 */
      animation: AnimationObject,
      /** 重复次数。为负值时一直循环，直到被取消动画。 */
      numberOfReps?: number,
      /** 反向运行动画，每周期结束动画由尾到头运行。该字段仅对 timing 和 spring 返回的动画对象生效。 */
      reverse?: boolean,
      /** 动画完成回调。动画被取消时，返回 fasle，正常完成时返回 true。 */
      callback?: (...args: any[]) => any
    ): AnimationObject;
    /** [AnimationObject worklet.sequence(AnimationObject animationN)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.sequence.html)
     *
     * 在插件中使用：不支持
     *
     * 组合动画序列，依次执行传入的动画。 */
    sequence(
      /** 动画对象 */
      animationN: AnimationObject
    ): AnimationObject;
    /** [AnimationObject worklet.spring(number|string toValue, Object options, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.spring.html)
     *
     * 在插件中使用：不支持
     *
     * 基于物理的动画。 */
    spring(
      /** 目标值 */
      toValue: number | string,
      /** 动画配置 */
      options: SpringOption,
      /** 动画完成回调。动画被取消时，返回 fasle，正常完成时返回 true。 */
      callback: (...args: any[]) => any
    ): AnimationObject;
    /** [AnimationObject worklet.timing(number toValue, Object options, function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.timing.html)
     *
     * 在插件中使用：不支持
     *
     * 基于时间的动画。 */
    timing(
      /** 目标值 */
      toValue: number,
      /** 动画配置 */
      options: TimingOption,
      /** 动画完成回调。动画被取消时，返回 fasle，正常完成时返回 true。 */
      callback: (...args: any[]) => any
    ): AnimationObject;
    /** [DerivedValue worklet.derived(WorkletFunction updaterWorklet)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.derived.html)
     *
     * 在插件中使用：不支持
     *
     * 衍生值 `DerivedValue`，可基于已有的 `SharedValue` 生成其它共享变量。 */
    derived(
      /** worklet 函数类型，该函数被立即执行，返回值作为 DerivedValue 的初始值。当函数内捕获的 SharedValue 类型值发生变化时，updaterWorklet 被驱动执行，返回值用于更新 DerivedValue。可类比 computed 计算属性进行理解。 */
      updaterWorklet: WorkletFunction
    ): DerivedValue;
    /** [SharedValue worklet.shared(any initialValue)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.shared.html)
     *
     * 在插件中使用：不支持
     *
     * 创建共享变量 `SharedValue`，用于跨线程共享数据和驱动动画。 */
    shared(
      /** 初始值，可通过 `.value` 属性进行读取和修改。类型可以是 `number | string | bool | null | undefined | Object | Array | Function`。 */
      initialValue: any
    ): SharedValue;
    /** [function worklet.runOnJS(function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/tool-function/worklet.runOnJS.html)
     *
     * 在插件中使用：不支持
     *
     * `worklet` 函数运行在 `UI` 线程时，捕获的外部函数可能为 `worklet` 类型或普通函数，为了更明显的对其区分，要求必须使用 `runOnJS` 调回 `JS` 线程的普通函数。
     * 有这样的要求是因为，调用其它 `worklet` 函数时是同步调用，但在 `UI` 线程执行 `JS` 线程的函数只能是异步，开发者容易混淆，试图同步获取 `JS` 线程的返回值。 */
    runOnJS(
      /** 未声明为 worklet 类型的普通函数。 */
      fn: (...args: any[]) => any
    ): (...args: any[]) => any;
    /** [function worklet.runOnUI(function fn)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/tool-function/worklet.runOnUI.html)
     *
     * 在插件中使用：不支持
     *
     * 在 UI 线程执行 worklet 函数。 */
    runOnUI(
      /** worklet 类型函数。 */
      fn: (...args: any[]) => any
    ): (...args: any[]) => any;
    /** [worklet.cancelAnimation(SharedValue SharedValue)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.cancelAnimation.html)
     *
     * 在插件中使用：不支持
     *
     * 取消由 `SharedValue` 驱动的动画。 */
    cancelAnimation(
      /** 共享变量。 */
      SharedValue: SharedValue
    ): void;
  }
  interface Wx {
    /** [Array.&lt;any&gt; wx.batchGetStorageSync(Array.&lt;string&gt; keyList)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchGetStorageSync.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：不支持
*
* 从本地缓存中同步批量获取指定 key 的内容。
*
* **示例代码**
*
* ```js
try {
  var valueList = wx.batchGetStorageSync(['key'])
  if (valueList) {
    // Do something with return value
  }
} catch (e) {
  // Do something when catch error
}
```
*
* ****
*
* 对于多个key的读取, 批量读取在性能上优于多次getStorageSync读取 */
    batchGetStorageSync(
      /** 本地缓存中指定的 key 数组 */
      keyList: string[]
    ): any[];
    /** [ArrayBuffer wx.base64ToArrayBuffer(string base64)](https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.base64ToArrayBuffer.html)
     *
     * 需要基础库： `1.1.0`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃
     *
     * 将 Base64 字符串转成 ArrayBuffer 对象 */
    base64ToArrayBuffer(
      /** 要转化成 ArrayBuffer 对象的 Base64 字符串 */
      base64: string
    ): ArrayBuffer;
    /** [Object wx.getAccountInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/account-info/wx.getAccountInfoSync.html)
*
* 需要基础库： `2.2.2`
*
* 在插件中使用：需要基础库 `2.2.2`
*
* 获取当前帐号信息。线上小程序版本号仅支持在正式版小程序中获取，开发版和体验版中无法获取。
*
* **示例代码**
*
* ```js
const accountInfo = wx.getAccountInfoSync();
console.log(accountInfo.miniProgram.appId) // 小程序 appId
console.log(accountInfo.plugin.appId) // 插件 appId
console.log(accountInfo.plugin.version) // 插件版本号， 'a.b.c' 这样的形式
``` */
    getAccountInfoSync(): AccountInfo;
    /** [Object wx.getAppAuthorizeSetting()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getAppAuthorizeSetting.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取微信APP授权设置
*
* **示例代码**
*
* ```js
const appAuthorizeSetting = wx.getAppAuthorizeSetting()

console.log(appAuthorizeSetting.albumAuthorized)
console.log(appAuthorizeSetting.bluetoothAuthorized)
console.log(appAuthorizeSetting.cameraAuthorized)
console.log(appAuthorizeSetting.locationAuthorized)
console.log(appAuthorizeSetting.locationReducedAccuracy)
console.log(appAuthorizeSetting.microphoneAuthorized)
console.log(appAuthorizeSetting.notificationAlertAuthorized)
console.log(appAuthorizeSetting.notificationAuthorized)
console.log(appAuthorizeSetting.notificationBadgeAuthorized)
console.log(appAuthorizeSetting.notificationSoundAuthorized)
console.log(appAuthorizeSetting.phoneCalendarAuthorized)
```
*
* **返回值说明**
*
* `'authorized'` 表示已经获得授权，无需再次请求授权；
* `'denied'` 表示请求授权被拒绝，无法再次请求授权；（此情况需要引导用户[打开系统设置](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openAppAuthorizeSetting.html)，在设置页中打开权限）
* `'non determined'` 表示尚未请求授权，会在微信下一次调用系统相应权限时请求；（仅 iOS 会出现。此种情况下引导用户打开系统设置，不展示开关） */
    getAppAuthorizeSetting(): AppAuthorizeSetting;
    /** [Object wx.getAppBaseInfo()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getAppBaseInfo.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取微信APP基础信息
*
* **示例代码**
*
* ```js
const appBaseInfo = wx.getAppBaseInfo()

console.log(appBaseInfo.SDKVersion)
console.log(appBaseInfo.enableDebug)
console.log(appBaseInfo.host)
console.log(appBaseInfo.language)
console.log(appBaseInfo.version)
console.log(appBaseInfo.theme)
``` */
    getAppBaseInfo(): AppBaseInfo;
    /** [Object wx.getBatteryInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfoSync.html)
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * [wx.getBatteryInfo](https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfo.html) 的同步版本 */
    getBatteryInfoSync(): GetBatteryInfoSyncResult;
    /** [Object wx.getDeviceInfo()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getDeviceInfo.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取设备基础信息
*
* **示例代码**
*
* ```js
const deviceInfo = wx.getDeviceInfo()

console.log(deviceInfo.abi)
console.log(deviceInfo.benchmarkLevel)
console.log(deviceInfo.brand)
console.log(deviceInfo.model)
console.log(deviceInfo.platform)
console.log(deviceInfo.system)
``` */
    getDeviceInfo(): DeviceInfo;
    /** [Object wx.getEnterOptionsSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getEnterOptionsSync.html)
     *
     * 需要基础库： `2.9.4`
     *
     * 在插件中使用：需要基础库 `2.9.4`
     *
     * 获取本次小程序启动时的参数。如果当前是冷启动，则返回值与 [`App.onLaunch`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onLaunch-Object-object) 的回调参数一致；如果当前是热启动，则返回值与 [`App.onShow`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onShow-Object-object) 一致。
     *
     * **返回有效 referrerInfo 的场景**
     *
     * | 场景值 | 场景                            | appId含义  |
     * | ------ | ------------------------------- | ---------- |
     * | 1020   | 公众号 profile 页相关小程序列表 | 来源公众号 |
     * | 1035   | 公众号自定义菜单                | 来源公众号 |
     * | 1036   | App 分享消息卡片                | 来源App    |
     * | 1037   | 小程序打开小程序                | 来源小程序 |
     * | 1038   | 从另一个小程序返回              | 来源小程序 |
     * | 1043   | 公众号模板消息                  | 来源公众号 |
     *
     * **不同 apiCategory 场景下的 API 限制**
     *
     * `X` 表示 API 被限制无法使用；不在表格中的 API 不限制。
     *
     * |                                       | default | nativeFunctionalized | browseOnly | embedded |
     * |-|-|-|-|-|
     * |navigateToMiniProgram                  |         | `X`                  | `X`        |          |
     * |openSetting                            |         |                      | `X`        |          |
     * |&lt;button open-type="share"&gt;       |         | `X`                  | `X`        | `X`      |
     * |&lt;button open-type="feedback"&gt;    |         |                      | `X`        |          |
     * |&lt;button open-type="open-setting"&gt;|         |                      | `X`        |          |
     * |openEmbeddedMiniProgram                |         | `X`                  | `X`        | `X`      |
     *
     * **注意**
     *
     * 部分版本在无 `referrerInfo` 的时候会返回 `undefined`，建议使用 `options.referrerInfo && options.referrerInfo.appId` 进行判断。 */
    getEnterOptionsSync(): LaunchOptionsApp;
    /** [Object wx.getExptInfoSync(Array.&lt;string&gt; keys)](https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.getExptInfoSync.html)
     *
     * 需要基础库： `2.17.0`
     *
     * 在插件中使用：不支持
     *
     * 给定实验参数数组，获取对应的实验参数值
     *
     * **提示**
     *
     * 假设实验参数有 `color`, `size`
     * 调用 wx.getExptInfoSync() 会返回 `{color:'#fff',size:20}` 类似的结果
     * 而 wx.getExptInfoSync(['color']) 则只会返回 `{color:'#fff'}` */
    getExptInfoSync(
      /** 实验参数数组，不填则获取所有实验参数 */
      keys?: string[]
    ): IAnyObject;
    /** [Object wx.getExtConfigSync()](https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfigSync.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：不支持
*
* [wx.getExtConfig](https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfig.html) 的同步版本。
*
* **Tips**
*
* 1. 本接口暂时无法通过 [wx.canIUse](https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.canIUse.html) 判断是否兼容，开发者需要自行判断 [wx.getExtConfigSync](https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfigSync.html) 是否存在来兼容
*
* ****
*
* ```js
let extConfig = wx.getExtConfigSync? wx.getExtConfigSync(): {}
console.log(extConfig)
``` */
    getExtConfigSync(): IAnyObject;
    /** [Object wx.getLaunchOptionsSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html)
     *
     * 需要基础库： `2.1.2`
     *
     * 在插件中使用：需要基础库 `2.9.4`
     *
     * 获取小程序启动时的参数。与 [`App.onLaunch`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onlaunchobject-object) 的回调参数一致。
     *
     * **返回有效 referrerInfo 的场景**
     *
     * | 场景值 | 场景                            | appId含义  |
     * | ------ | ------------------------------- | ---------- |
     * | 1020   | 公众号 profile 页相关小程序列表 | 来源公众号 |
     * | 1035   | 公众号自定义菜单                | 来源公众号 |
     * | 1036   | App 分享消息卡片                | 来源App    |
     * | 1037   | 小程序打开小程序                | 来源小程序 |
     * | 1038   | 从另一个小程序返回              | 来源小程序 |
     * | 1043   | 公众号模板消息                  | 来源公众号 |
     * | 1069   | 移动应用                    | 来源App |
     *
     * **不同 apiCategory 场景下的 API 限制**
     *
     * `X` 表示 API 被限制无法使用；不在表格中的 API 不限制。
     *
     * |                                       | default | nativeFunctionalized | browseOnly | embedded |
     * |-|-|-|-|-|
     * |navigateToMiniProgram                  |         | `X`                  | `X`        |          |
     * |openSetting                            |         |                      | `X`        |          |
     * |&lt;button open-type="share"&gt;       |         | `X`                  | `X`        | `X`      |
     * |&lt;button open-type="feedback"&gt;    |         |                      | `X`        |          |
     * |&lt;button open-type="open-setting"&gt;|         |                      | `X`        |          |
     * |openEmbeddedMiniProgram                |         | `X`                  | `X`        | `X`      |
     *
     * **注意**
     *
     * 部分版本在无`referrerInfo`的时候会返回 `undefined`，建议使用 `options.referrerInfo && options.referrerInfo.appId` 进行判断。 */
    getLaunchOptionsSync(): LaunchOptionsApp;
    /** [Object wx.getMenuButtonBoundingClientRect()](https://developers.weixin.qq.com/miniprogram/dev/api/ui/menu/wx.getMenuButtonBoundingClientRect.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 获取菜单按钮（右上角胶囊按钮）的布局位置信息。坐标信息以屏幕左上角为原点。
*
* **示例代码**
*
* ```js
const res = wx.getMenuButtonBoundingClientRect()

console.log(res.width)
console.log(res.height)
console.log(res.top)
console.log(res.right)
console.log(res.bottom)
console.log(res.left)
``` */
    getMenuButtonBoundingClientRect(): ClientRect;
    /** [Object wx.getSkylineInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSkylineInfoSync.html)
     *
     * 需要基础库： `2.26.2`
     *
     * 在插件中使用：需要基础库 `2.26.2`
     *
     * 获取当前运行环境对于 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的支持情况 */
    getSkylineInfoSync(): SkylineInfo;
    /** [Object wx.getStorageInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfoSync.html)
*
* 在插件中使用：不支持
*
* [wx.getStorageInfo](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfo.html) 的同步版本
*
* **示例代码**
*
* ```js
wx.getStorageInfo({
  success (res) {
    console.log(res.keys)
    console.log(res.currentSize)
    console.log(res.limitSize)
  }
})
```
*
* ```js
try {
  const res = wx.getStorageInfoSync()
  console.log(res.keys)
  console.log(res.currentSize)
  console.log(res.limitSize)
} catch (e) {
  // Do something when catch error
}
``` */
    getStorageInfoSync(): GetStorageInfoSyncOption;
    /** [Object wx.getSystemInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoSync.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* [wx.getSystemInfo](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfo.html) 的同步版本
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/WkUCgXmS7mqO)
*
* ```js
wx.getSystemInfo({
  success (res) {
    console.log(res.model)
    console.log(res.pixelRatio)
    console.log(res.windowWidth)
    console.log(res.windowHeight)
    console.log(res.language)
    console.log(res.version)
    console.log(res.platform)
  }
})
```
*
* ```js
try {
  const res = wx.getSystemInfoSync()
  console.log(res.model)
  console.log(res.pixelRatio)
  console.log(res.windowWidth)
  console.log(res.windowHeight)
  console.log(res.language)
  console.log(res.version)
  console.log(res.platform)
} catch (e) {
  // Do something when catch error
}
``` */
    getSystemInfoSync(): SystemInfo;
    /** [Object wx.getSystemSetting()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemSetting.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取设备设置
*
* **示例代码**
*
* ```js
const systemSetting = wx.getSystemSetting()

console.log(systemSetting.bluetoothEnabled)
console.log(systemSetting.deviceOrientation)
console.log(systemSetting.locationEnabled)
console.log(systemSetting.wifiEnabled)
``` */
    getSystemSetting(): SystemSetting;
    /** [Object wx.getWindowInfo()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取窗口信息
*
* **示例代码**
*
* ```js
const windowInfo = wx.getWindowInfo()

console.log(windowInfo.pixelRatio)
console.log(windowInfo.screenWidth)
console.log(windowInfo.screenHeight)
console.log(windowInfo.windowWidth)
console.log(windowInfo.windowHeight)
console.log(windowInfo.statusBarHeight)
console.log(windowInfo.safeArea)
console.log(windowInfo.screenTop)
``` */
    getWindowInfo(): WindowInfo;
    /** [Promise<string> wx.getRendererUserAgent(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getRendererUserAgent.html)
*
* 需要基础库： `2.26.3`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取 Webview 小程序的 UserAgent
*
* **示例代码**
*
* ```js
// v2.30.4 前，仅支持 promise 风格调用
wx.getRendererUserAgent().then(userAgent => console.log(userAgent))
// v2.30.4 起，除 promise 风格调用外，也支持 invoke 风格使用
wx.getRendererUserAgent({
  success(res) { console.log(res.userAgent) }
})
``` */
    getRendererUserAgent(option?: GetRendererUserAgentOption): Promise<string>;
    /** [[Animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html) wx.createAnimation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/wx.createAnimation.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建一个动画实例 [animation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/Animation.html)。调用实例的方法来描述动画。最后通过动画实例的 export 方法导出动画数据传递给组件的 animation 属性。 */
    createAnimation(option: StepOption): Animation;
    /** [[AudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.html) wx.createAudioContext(string id, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createAudioContext.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     * @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
     *
     * 创建 [audio](https://developers.weixin.qq.com/miniprogram/dev/component/audio.html) 上下文 [AudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/AudioContext.html) 对象。 */
    createAudioContext(
      /** [audio](https://developers.weixin.qq.com/miniprogram/dev/component/audio.html) 组件的 id */
      id: string,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [audio](https://developers.weixin.qq.com/miniprogram/dev/component/audio.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): AudioContext;
    /** [[BackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/BackgroundAudioManager.html) wx.getBackgroundAudioManager()](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 获取**全局唯一**的背景音频管理器。
     * 小程序切入后台，如果音频处于播放状态，可以继续播放。但是后台状态不能通过调用API操纵音频的播放状态。
     *
     * 从微信客户端6.7.2版本开始，若需要在小程序切后台后继续播放音频，需要在 [app.json](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html) 中配置 `requiredBackgroundModes` 属性。开发版和体验版上可以直接生效，正式版还需通过审核。 */
    getBackgroundAudioManager(): BackgroundAudioManager;
    /** [[CacheManager](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/CacheManager.html) wx.createCacheManager(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/cachemanager/wx.createCacheManager.html)
*
* 需要基础库： `2.24.0`
*
* 在插件中使用：不支持
*
* 创建缓存管理器
*
* **示例代码**
*
* <a href="https://github.com/wechat-miniprogram/miniprogram-offline-demo" target="_blank">查看完整示例代码</a>
*
* ```js
const cacheManager = createCacheManager()
cacheManager.addRule(/https:\/\/(?:.*)/ig) // 表示所有 https 请求都匹配

cacheManager.on('request', evt => {
 // 在弱网时接收到 wx.request 请求
 return new Promise((resolve, reject) => {
   const matchRes = cm.match(evt)
   if (matchRes && matchRes.data) {
     // 有缓存，返回
     resolve(matchRes.data)
   } else {
     // 没缓存，抛错
     reject({ errMsg: 'no cache' })
   }
 })
})
``` */
    createCacheManager(option: CreateCacheManagerOption): CacheManager;
    /** [[CameraContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.html) wx.createCameraContext()](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/wx.createCameraContext.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建 [camera](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html) 上下文 [CameraContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.html) 对象。 */
    createCameraContext(): CameraContext;
    /** [[CanvasContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) wx.createCanvasContext(string canvasId, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createCanvasContext.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     * @deprecated 基础库版本 [2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [Canvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html) 替换
     *
     * 创建 canvas 的绘图上下文 [CanvasContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 对象 */
    createCanvasContext(
      /** 要获取上下文的 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件 canvas-id 属性 */
      canvasId: string,
      /** 在自定义组件下，当前组件实例的this，表示在这个自定义组件下查找拥有 canvas-id 的 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) ，如果省略则不在任何自定义组件内查找 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): CanvasContext;
    /** [[DownloadTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/DownloadTask.html) wx.downloadFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/wx.downloadFile.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 下载文件资源到本地。客户端直接发起一个 HTTPS GET 请求，返回文件的本地临时路径 (本地路径)，单次下载允许的最大文件为 200MB。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。
*
* 注意：请在服务端响应的 header 中指定合理的 `Content-Type` 字段，以保证客户端正确处理文件类型。
*
* **示例代码**
*
* ```js
wx.downloadFile({
  url: 'https://example.com/audio/123', //仅为示例，并非真实的资源
  success (res) {
    // 只要服务器有响应数据，就会把响应内容写入文件并进入 success 回调，业务需要自行判断是否下载到了想要的内容
    if (res.statusCode === 200) {
      wx.playVoice({
        filePath: res.tempFilePath
      })
    }
  }
})
``` */
    downloadFile(option: DownloadFileOption): DownloadTask;
    /** [[FileSystemManager](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.html) wx.getFileSystemManager()](https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.getFileSystemManager.html)
     *
     * 需要基础库： `1.9.9`
     *
     * 在插件中使用：需要基础库 `2.19.2`
     *
     * 获取全局唯一的文件管理器 */
    getFileSystemManager(): FileSystemManager;
    /** [[InferenceSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/InferenceSession.html) wx.createInferenceSession(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/wx.createInferenceSession.html)
*
* 需要基础库： `2.30.0`
*
* 在插件中使用：需要基础库 `2.30.0`
*
* 创建 AI 推理 Session。使用前可参考[AI指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/inference/tutorial.html)
*
* **示例代码**
*
* ```js
// 创建会话，加载模型
const session = wx.createInferenceSession({
  model: `${wx.env.USER_DATA_PATH}/MNIST.onnx`,
  precisionLevel: 4,
  typicalShape:{input1:[1, 3, 224, 224], input2:[1, 1, 224, 224]},  //除非使用动态轴，一般不用显式指定
  allowNPU: false,
  allowQuantize: false
})

// 监听error事件
session.onError(err => {
  console.error(err)
})

// 监听模型加载完成事件
session.onLoad(() => {
  // 运行推理
  // 其中input1, input2, output0 必须与使用的onnx模型中实际的输入输出名字完全一致，不可随意填写。
  // 模型输入输出信息可以通过Netron 打开onnx模型看到
  session.run({
    input1: {
      type: 'float32',
      data: new Float32Array(3 * 224 * 224).buffer,
      shape: [1, 3, 224, 224] // NCHW 顺序
    },
    // 多个input的添加方法，假设第二个input需要数据类型为uint8
    input2: {
      type: 'uint8',
      data: new Uint8Array(224 * 224).buffer,
      shape: [1, 1, 224, 224]
    },
  }).then(res => {
    console.log(res.output0)
  })
})

// 销毁Session
// session完成创建后可以多次调用run进行推理，直到调用`session.destroy()`释放相关内存。

// 销毁会话
session.destroy()
``` */
    createInferenceSession(option: CreateInferenceSessionOption): InferenceSession;
    /** [[InnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.html) wx.createInnerAudioContext(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 创建内部 [audio](https://developers.weixin.qq.com/miniprogram/dev/component/audio.html) 上下文 [InnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.html) 对象。
*
* **示例代码**
*
* ```js
const innerAudioContext = wx.createInnerAudioContext({
  useWebAudioImplement: false // 是否使用 WebAudio 作为底层音频驱动，默认关闭。对于短音频、播放频繁的音频建议开启此选项，开启后将获得更优的性能表现。由于开启此选项后也会带来一定的内存增长，因此对于长音频建议关闭此选项
})

innerAudioContext.play() // 播放

innerAudioContext.pause() // 暂停

innerAudioContext.stop() // 停止
``` */
    createInnerAudioContext(option?: CreateInnerAudioContextOption): InnerAudioContext;
    /** [[IntersectionObserver](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/IntersectionObserver.html) wx.createIntersectionObserver(Object component, Object options)](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createIntersectionObserver.html)
     *
     * 需要基础库： `1.9.3`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建并返回一个 IntersectionObserver 对象实例。在自定义组件或包含自定义组件的页面中，应使用 `this.createIntersectionObserver([options])` 来代替。
     *
     * **示例代码**
     *
     * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/LAbMxkmI7F2A) */
    createIntersectionObserver(
      /** 自定义组件实例 */
      component: IAnyObject,
      /** 选项 */
      options?: CreateIntersectionObserverOption
    ): IntersectionObserver;
    /** [[InterstitialAd](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.html) wx.createInterstitialAd(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createInterstitialAd.html)
     *
     * 需要基础库： `2.6.0`
     *
     * 在插件中使用：需要基础库 `2.8.1`
     *
     * 创建插屏广告组件。请通过 [wx.getSystemInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoSync.html) 返回对象的 SDKVersion 判断基础库版本号后再使用该 API。每次调用该方法创建插屏广告都会返回一个全新的实例（小程序端的插屏广告实例不允许跨页面使用）。 */
    createInterstitialAd(option: CreateInterstitialAdOption): InterstitialAd;
    /** [[LivePlayerContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.html) wx.createLivePlayerContext(string id, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/wx.createLivePlayerContext.html)
     *
     * 需要基础库： `1.7.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建 [live-player](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html) 上下文 [LivePlayerContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePlayerContext.html) 对象。建议使用 [wx.createSelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html) 获取 context 对象。 */
    createLivePlayerContext(
      /** [live-player](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html) 组件的 id */
      id: string,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [live-player](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): LivePlayerContext;
    /** [[LivePusherContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.html) wx.createLivePusherContext()](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/wx.createLivePusherContext.html)
     *
     * 需要基础库： `1.7.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建 [live-pusher](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html) 上下文 [LivePusherContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/live/LivePusherContext.html) 对象。 */
    createLivePusherContext(): LivePusherContext;
    /** [[LogManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/LogManager.html) wx.getLogManager(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.getLogManager.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：不支持
*
* 获取日志管理器对象。
*
* **示例代码**
*
* ```js
const logger = wx.getLogManager({level: 1})
logger.log({str: 'hello world'}, 'basic log', 100, [1, 2, 3])
logger.info({str: 'hello world'}, 'info log', 100, [1, 2, 3])
logger.debug({str: 'hello world'}, 'debug log', 100, [1, 2, 3])
logger.warn({str: 'hello world'}, 'warn log', 100, [1, 2, 3])
``` */
    getLogManager(option: GetLogManagerOption): LogManager;
    /** [[MapContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.html) wx.createMapContext(string mapId, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/wx.createMapContext.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建 [map](https://developers.weixin.qq.com/miniprogram/dev/component/map.html) 上下文 [MapContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/map/MapContext.html) 对象。建议使用 [wx.createSelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html) 获取 context 对象。 */
    createMapContext(
      /** [map](https://developers.weixin.qq.com/miniprogram/dev/component/map.html) 组件的 id */
      mapId: string,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [map](https://developers.weixin.qq.com/miniprogram/dev/component/map.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): MapContext;
    /** [[MediaAudioPlayer](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.html) wx.createMediaAudioPlayer()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createMediaAudioPlayer.html)
*
* 需要基础库： `2.13.0`
*
* 在插件中使用：支持
*
* 创建媒体音频播放器对象 [MediaAudioPlayer](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/MediaAudioPlayer.html) 对象，可用于播放视频解码器 [VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html) 输出的音频。
*
* **示例代码**
*
* ```js
  // 创建视频解码器，具体参数见 createVideoDecoder 文档
  const videoDecoder = wx.createVideoDecoder()
  // 创建媒体音频播放器
  const mediaAudioPlayer = wx.createMediaAudioPlayer()
  // 启动视频解码器
  videoDecoder.start()
  // 启动播放器
  mediaAudioPlayer.start().then(() => {
    // 添加播放器音频来源
    mediaAudioPlayer.addAudioSource(videoDecoder).then(res => {
      videoDecoder.getFrameData() // 建议在 requestAnimationFrame 里获取每一帧视频数据
      console.log(res)
    })

    // 移除播放器音频来源
    mediaAudioPlayer.removeAudioSource(videoDecoder).then()
    // 停止播放器
    mediaAudioPlayer.stop().then()
    // 销毁播放器
    mediaAudioPlayer.destroy().then()
    // 设置播放器音量
    mediaAudioPlayer.volume = 0.5
  })
```
*
* **完整demo（小游戏）**
*
* - https://developers.weixin.qq.com/s/SF2duHmb7MjI */
    createMediaAudioPlayer(): MediaAudioPlayer;
    /** [[MediaContainer](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/MediaContainer.html) wx.createMediaContainer()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-processing/wx.createMediaContainer.html)
     *
     * 需要基础库： `2.9.0`
     *
     * 在插件中使用：需要基础库 `2.10.0`
     *
     * 创建音视频处理容器，最终可将容器中的轨道合成一个视频 */
    createMediaContainer(): MediaContainer;
    /** [[MediaRecorder](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.html) wx.createMediaRecorder(Object canvas, Object options)](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/wx.createMediaRecorder.html)
*
* 需要基础库： `2.11.0`
*
* 在插件中使用：需要基础库 `2.11.0`
*
* 创建 WebGL 画面录制器，可逐帧录制在 WebGL 上渲染的画面并导出视频文件
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/MCz3kPmC7zpa)
*
* **低版本异步接口兼容**
*
* 对基础库 2.16.1 版本前的 mediaRecorder，所有的接口都没有返回 Promise 对象，若需要兼容低版本，则可采用如下方式的写法：
* ```javascript
// 启动 mediaRecorder
await new Promise(resolve => {
  recorder.on('start', resolve)
  recorder.start()
})

// 逐帧绘制
while (frames--) {
  await new Promise(resolve => recorder.requestFrame(resolve))
  render()
}

// 绘制完成，生成视频
const {tempFilePath} = await new Promise(resolve => {
  recorder.on('stop', resolve)
  recorder.stop()
})
``` */
    createMediaRecorder(
      /** WebGL 对象，通过 [SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) 获取到的 node 对象或通过 [wx.createOffscreenCanvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html) 创建的离屏 WebGL Canvas 对象 */
      canvas: IAnyObject,
      options: CreateMediaRecorderOption
    ): MediaRecorder;
    /** [[NFCAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/NFCAdapter.html) wx.getNFCAdapter()](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc/wx.getNFCAdapter.html)
     *
     * 需要基础库： `2.11.2`
     *
     * 在插件中使用：需要基础库 `2.11.2`
     *
     * 获取 NFC 实例
     *
     * **示例代码**
     *
     * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/1WsbDwmb75ig) */
    getNFCAdapter(): NFCAdapter;
    /** [[OffscreenCanvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/OffscreenCanvas.html) wx.createOffscreenCanvas(object object, number width, number height, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：需要基础库 `2.16.1`
     *
     * 创建离屏 canvas 实例
     *
     * **离屏 Canvas 类型不可混用**
     *
     * 由于 webgl canvas 和 2d canvas 的底层实现方式不同，因此必须要在调用 `wx.createOffscreenCanvas` 时提前指定类型。
     *
     * 指定类型后，离屏 canvas `getContext(type)` 调用不允许混用，如不能对 webgl canvas 调用 `getContext('2d')`。
     *
     * 同样的，不同类型 canvas 调用 `createImage` 创建的图片对象也不支持混用，使用时请注意尽量使用 canvas 自身的 `createImage` 创建图片对象。
     *
     * **与 MediaRecorder 结合**
     *
     * 离屏 webgl canvas 支持作为参数传递给 [`wx.createMediaRecorder`](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/wx.createMediaRecorder.html), 离屏 2d canvas 暂不支持。
     *
     * **旧版 createOffscreenCanvas**
     *
     * 旧版函数签名为 `wx.createOffscreenCanvas(width: number, height: number, this: object): OffscreenCanvas`，从基础库 2.7.0 开始支持
     *
     * 从基础库 2.16.1 开始改为 `wx.createOffscreenCanvas(options: object): OffscreenCanvas`，向下兼容旧版入参。
     * 但需注意旧版入参只能创建 webgl 类型，如需创建 2d 类型则必须使用新版。 */
    createOffscreenCanvas(
      /** 画布宽度 */
      width: number,
      /** 画布高度 */
      height: number,
      /** 在自定义组件下，当前组件实例的 this */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): OffscreenCanvas;
    /** [[OffscreenCanvas](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/OffscreenCanvas.html) wx.createOffscreenCanvas(object object, number width, number height, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createOffscreenCanvas.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：需要基础库 `2.16.1`
     *
     * 创建离屏 canvas 实例
     *
     * **离屏 Canvas 类型不可混用**
     *
     * 由于 webgl canvas 和 2d canvas 的底层实现方式不同，因此必须要在调用 `wx.createOffscreenCanvas` 时提前指定类型。
     *
     * 指定类型后，离屏 canvas `getContext(type)` 调用不允许混用，如不能对 webgl canvas 调用 `getContext('2d')`。
     *
     * 同样的，不同类型 canvas 调用 `createImage` 创建的图片对象也不支持混用，使用时请注意尽量使用 canvas 自身的 `createImage` 创建图片对象。
     *
     * **与 MediaRecorder 结合**
     *
     * 离屏 webgl canvas 支持作为参数传递给 [`wx.createMediaRecorder`](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/wx.createMediaRecorder.html), 离屏 2d canvas 暂不支持。
     *
     * **旧版 createOffscreenCanvas**
     *
     * 旧版函数签名为 `wx.createOffscreenCanvas(width: number, height: number, this: object): OffscreenCanvas`，从基础库 2.7.0 开始支持
     *
     * 从基础库 2.16.1 开始改为 `wx.createOffscreenCanvas(options: object): OffscreenCanvas`，向下兼容旧版入参。
     * 但需注意旧版入参只能创建 webgl 类型，如需创建 2d 类型则必须使用新版。 */
    createOffscreenCanvas(option: CreateOffscreenCanvasOption): OffscreenCanvas;
    /** [[Performance](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/Performance.html) wx.getPerformance()](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.getPerformance.html)
*
* 需要基础库： `2.11.0`
*
* 在插件中使用：支持
*
* 获取当前小程序性能相关的信息。关于小程序启动性能优化的更多内容，请参考[启动性能指南](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start.html)。
*
* ****
*
* 目前支持获取以下几类性能指标，具体内容请参考 [PerformanceEntry](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/PerformanceEntry.html)：
*
* | 指标类型（entryType） | 指标名称          | 最低版本 ｜
* | ------------------- | ---------------- | ------ |
* | 路由（navigation）   | route: 路由性能 | |
* | 路由（navigation）   | appLaunch: 小程序启动耗时 | |
* | 渲染（render）       | firstRender: 页面首次渲染耗时 | |
* | 渲染（render）       | firstPaint: 页面首次绘制 | <2.21.2> |
* | 渲染（render）       | firstContentfulPaint: 页面首次内容绘制 |  <2.21.2> |
* | 渲染（render）       | largestContentfulPaint: 页面最大内容绘制 | <2.23.1> |
* | 脚本（script）       | evaluateScript: 注入脚本耗时  | |
* | 包加载（loadPackage）| downloadPackage: 代码包下载耗时  | <2.24.0> |
* | 资源（resource）     | resourceTiming: 视图层资源加载耗时  | <2.24.0> |
*
* **示例代码**
*
* ```js
const performance = wx.getPerformance()
const observer = performance.createObserver((entryList) => {
  console.log(entryList.getEntries())
})
observer.observe({ entryTypes: ['render', 'script', 'navigation'] })
```
*
* **注意**
*
* - 目前，当开启代码 [按需注入](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/lazyload.html) 时，`evaluateScript` 将仅包含公有部分代码（2.21.2 开始会区分公共部分/页面和组件的部分），页面和组件的代码注入的时间会包含在 `firstRender` 中（因为页面和组件的代码注入过程成为了首次渲染过程的一部分）。因此开启按需注入后，脚本耗时降低，渲染时间提高属于正常现象，优化效果可以关注整体启动耗时（`appLaunch`）来评估。
* - firstPaint 和 firstContentfulPaint 指标在开启 vConsole 的情况下，由于绘制 vConsole 面板，会导致数据提前。 */
    getPerformance(): Performance;
    /** [[PreDownloadSubpackageTask](https://developers.weixin.qq.com/miniprogram/dev/api/base/subpackage/PreDownloadSubpackageTask.html) wx.preDownloadSubpackage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/subpackage/wx.preDownloadSubpackage.html)
*
* 需要基础库： `2.27.3`
*
* 在插件中使用：不支持
*
* 触发分包预下载。
*
* **示例代码**
*
* ```js
// 首先要在 app.json / game.json 中配置workers作为分包
{
  "workers": {
    "path": "myWorkersFolder",
    "isSubpackage": true  // true 表示把 worker 打包为分包。默认 false。填 false 时等同于 { "workers": "workers" }
  }
}
```
* ```js
// 然后调用 wx.preDownloadSubpackage 下载 worker 分包，下载成功后才可以创建 worker
var task = wx.preDownloadSubpackage({
  packageType: "workers",
  success(res) {
    console.log("load worker success", res)
    wx.createWorker("myWorkersFolder/request/index.js")   // 创建 worker。 如果 worker 分包没下载完就调 createWorker 的话将报错
  },
  fail(res) {
    console.log("load worker fail", res)
  }
})

task.onProgressUpdate(res => {
  console.log(res.progress) // 可通过 onProgressUpdate 接口监听下载进度
  console.log(res.totalBytesWritten)
  console.log(res.totalBytesExpectedToWrite)
})
``` */
    preDownloadSubpackage(option: PreDownloadSubpackageOption): PreDownloadSubpackageTask;
    /** [[RealtimeLogManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/RealtimeLogManager.html) wx.getRealtimeLogManager()](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.getRealtimeLogManager.html)
*
* 需要基础库： `2.7.1`
*
* 在插件中使用：需要基础库 `2.16.0`
*
* 获取实时日志管理器对象。
*
* **示例代码**
*
* ```js
// 小程序端
const logger = wx.getRealtimeLogManager()
logger.info({str: 'hello world'}, 'info log', 100, [1, 2, 3])
logger.error({str: 'hello world'}, 'error log', 100, [1, 2, 3])
logger.warn({str: 'hello world'}, 'warn log', 100, [1, 2, 3])

// 插件端，基础库 2.16.0 版本后支持，只允许采用 key-value 的新格式上报
const logManager = wx.getRealtimeLogManager()
const logger = logManager.tag('plugin-log1')
logger.info('key1', 'value1')
logger.error('key2', {str: 'value2'})
logger.warn('key3', 'value3')
``` */
    getRealtimeLogManager(): RealtimeLogManager;
    /** [[RecorderManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.html) wx.getRecorderManager()](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.getRecorderManager.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `1.9.94`
     *
     * 获取**全局唯一**的录音管理器 RecorderManager */
    getRecorderManager(): RecorderManager;
    /** [[RequestTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/RequestTask.html) wx.request(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 发起 HTTPS 网络请求。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。
*
* **data 参数说明**
*
* 最终发送给服务器的数据是 String 类型，如果传入的 data 不是 String 类型，会被转换成 String 。转换规则如下：
* - 对于 `GET` 方法的数据，会将数据转换成 query string（`encodeURIComponent(k)=encodeURIComponent(v)&encodeURIComponent(k)=encodeURIComponent(v)...`）
* - 对于 `POST` 方法且 `header['content-type']` 为 `application/json` 的数据，会对数据进行 JSON 序列化
* - 对于 `POST` 方法且 `header['content-type']` 为 `application/x-www-form-urlencoded` 的数据，会将数据转换成 query string `（encodeURIComponent(k)=encodeURIComponent(v)&encodeURIComponent(k)=encodeURIComponent(v)...）`
*
* **示例代码**
*
* ```js
wx.request({
  url: 'example.php', //仅为示例，并非真实的接口地址
  data: {
    x: '',
    y: ''
  },
  header: {
    'content-type': 'application/json' // 默认值
  },
  success (res) {
    console.log(res.data)
  }
})
``` */
    request<T extends string | IAnyObject | ArrayBuffer = string | IAnyObject | ArrayBuffer>(
      option: RequestOption<T>
    ): RequestTask;
    /** [[RewardedVideoAd](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.html) wx.createRewardedVideoAd(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createRewardedVideoAd.html)
     *
     * 需要基础库： `2.0.4`
     *
     * 在插件中使用：需要基础库 `2.8.1`
     *
     * 创建激励视频广告组件。请通过 [wx.getSystemInfoSync()](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoSync.html) 返回对象的 SDKVersion 判断基础库版本号后再使用该 API（小游戏端要求 >= 2.0.4， 小程序端要求 >= 2.6.0）。调用该方法创建的激励视频广告是一个单例（小游戏端是全局单例，小程序端是页面内单例，在小程序端的单例对象不允许跨页面使用）。 */
    createRewardedVideoAd(option: CreateRewardedVideoAdOption): RewardedVideoAd;
    /** [[SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) wx.createSelectorQuery()](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 返回一个 SelectorQuery 对象实例。在自定义组件或包含自定义组件的页面中，应使用 `this.createSelectorQuery()` 来代替。
*
* **示例代码**
*
* ```js
const query = wx.createSelectorQuery()
query.select('#the-id').boundingClientRect()
query.selectViewport().scrollOffset()
query.exec(function(res){
  res[0].top       // #the-id节点的上边界坐标
  res[1].scrollTop // 显示区域的竖直滚动位置
})
``` */
    createSelectorQuery(): SelectorQuery;
    /** [[SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) wx.connectSocket(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.connectSocket.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
*
* 创建一个 WebSocket 连接。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。
*
* **并发数**
*
* - 1.7.0 及以上版本，最多可以同时存在 5 个 WebSocket 连接。
* - 1.7.0 以下版本，一个小程序同时只能有一个 WebSocket 连接，如果当前已存在一个 WebSocket 连接，会自动关闭该连接，并重新创建一个 WebSocket 连接。
*
* **示例代码**
*
* ```js
wx.connectSocket({
  url: 'wss://example.qq.com',
  header:{
    'content-type': 'application/json'
  },
  protocols: ['protocol1']
})
``` */
    connectSocket(option: ConnectSocketOption): SocketTask;
    /** [[TCPSocket](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/TCPSocket.html) wx.createTCPSocket()](https://developers.weixin.qq.com/miniprogram/dev/api/network/tcp/wx.createTCPSocket.html)
     *
     * 需要基础库： `2.18.0`
     *
     * 在插件中使用：支持
     *
     * 创建一个 TCP Socket 实例。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。
     *
     * **连接限制**
     *
     * - 允许与局域网内的非本机 IP 通信
     * - 允许与配置过的服务器域名通信，详见[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
     * - 禁止与以下端口号连接：`1024 以下` `1099` `1433` `1521` `1719` `1720` `1723` `2049` `2375` `3128` `3306` `3389` `3659` `4045` `5060` `5061` `5432` `5984` `6379` `6000` `6566` `7001` `7002` `8000-8100` `8443` `8888` `9200` `9300` `10051` `10080` `11211` `27017` `27018` `27019`
     * - 每 5 分钟内最多创建 20 个 TCPSocket */
    createTCPSocket(): TCPSocket;
    /** [[UDPSocket](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/UDPSocket.html) wx.createUDPSocket()](https://developers.weixin.qq.com/miniprogram/dev/api/network/udp/wx.createUDPSocket.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 创建一个 UDP Socket 实例。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。 */
    createUDPSocket(): UDPSocket;
    /** [[UpdateManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html) wx.getUpdateManager()](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/wx.getUpdateManager.html)
     *
     * 需要基础库： `1.9.90`
     *
     * 在插件中使用：不支持
     *
     * 获取**全局唯一**的版本更新管理器，用于管理小程序更新。关于小程序的更新机制，可以查看[运行机制](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html)文档。
     *
     * **示例代码**
     *
     * [示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/UpdateManager.html#示例代码) */
    getUpdateManager(): UpdateManager;
    /** [[UploadTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/UploadTask.html) wx.uploadFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/wx.uploadFile.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 将本地资源上传到服务器。客户端发起一个 HTTPS POST 请求，其中 `content-type` 为 `multipart/form-data`。使用前请注意阅读[相关说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)。
*
* **示例代码**
*
* ```js
wx.chooseImage({
  success (res) {
    const tempFilePaths = res.tempFilePaths
    wx.uploadFile({
      url: 'https://example.weixin.qq.com/upload', //仅为示例，非真实的接口地址
      filePath: tempFilePaths[0],
      name: 'file',
      formData: {
        'user': 'test'
      },
      success (res){
        const data = res.data
        //do something
      }
    })
  }
})
``` */
    uploadFile(option: UploadFileOption): UploadTask;
    /** [[UserCryptoManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/crypto/UserCryptoManager.html) wx.getUserCryptoManager()](https://developers.weixin.qq.com/miniprogram/dev/api/base/crypto/wx.getUserCryptoManager.html)
     *
     * 需要基础库： `2.17.3`
     *
     * 在插件中使用：不支持
     *
     * 获取用户加密模块 */
    getUserCryptoManager(): UserCryptoManager;
    /** [[VKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.html) wx.createVKSession(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html)
*
* 需要基础库： `2.20.0`
*
* 在插件中使用：需要基础库 `2.20.0`
*
* 创建 vision kit 会话对象。
*
* **示例代码**
*
* v1 版本：[VisionKit基础能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/visionkit-basic)
* v2 版本：[VisionKit-v2基础能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/visionkit-basic-v2)
* ```js
// 以下 demo 以 v2 为例
// 创建 session 对象
const ssession = wx.createVKSession({
  track: {
    plane: {mode: 3},
  },
  version: 'v2',
  gl, // WebGLRenderingContext
})

// 逐帧分析
const onFrame = timestamp => {
  // 开发者可以自己控制帧率
  const frame = session.getVKFrame(canvasWidth, canvasHeight)
    if (frame) {
      // 分析完毕，可以拿到帧对象
      doRender(frame)
    }

  session.requestAnimationFrame(onFrame)
}
session.start(err => {
  if (!err) session.requestAnimationFrame(onFrame)
})

// 渲染函数
const doRender = frame => {
  // ...
}
``` */
    createVKSession(option: VKConfig): VKSession;
    /** [[VideoContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.html) wx.createVideoContext(string id, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.createVideoContext.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 创建 [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 上下文 [VideoContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/VideoContext.html) 对象。建议使用 [wx.createSelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html) 获取 context 对象。 */
    createVideoContext(
      /** [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 组件的 id */
      id: string,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): VideoContext;
    /** [[VideoDecoder](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/VideoDecoder.html) wx.createVideoDecoder()](https://developers.weixin.qq.com/miniprogram/dev/api/media/video-decoder/wx.createVideoDecoder.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：需要基础库 `2.11.0`
     *
     * 创建视频解码器，可逐帧获取解码后的数据 */
    createVideoDecoder(): VideoDecoder;
    /** [[WebAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.html) wx.createWebAudioContext()](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createWebAudioContext.html)
     *
     * 需要基础库： `2.19.0`
     *
     * 在插件中使用：不支持
     *
     * 创建 WebAudio 上下文。 */
    createWebAudioContext(): WebAudioContext;
    /** [[Worker](https://developers.weixin.qq.com/miniprogram/dev/api/worker/Worker.html) wx.createWorker(string scriptPath, object options)](https://developers.weixin.qq.com/miniprogram/dev/api/worker/wx.createWorker.html)
*
* 需要基础库： `1.9.90`
*
* 在插件中使用：需要基础库 `2.18.1`
*
* 创建一个 Worker 线程
*
* **示例代码**
*
* ```js
// 创建普通worker
wx.createWorker('workers/index.js')
```
* ```js
function createNewWorker() {
  const worker = wx.createWorker('workers/index.js', {
    useExperimentalWorker: true
  })
  // 监听worker被系统回收事件
  worker.onProcessKilled(() => {
    // 重新创建一个worker
    createNewWorker()
  })
}
// 创建实验worker
createNewWorker()
``` */
    createWorker(
      /** worker 入口文件的**绝对路径** */
      scriptPath: string,
      /** 可选参数 */
      options?: CreateWorkerOption
    ): Worker;
    /** [any wx.getStorageSync(string key)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageSync.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 从本地缓存中同步获取指定 key 的内容。
*
* **注意**
*
* storage 应只用来进行数据的持久化存储，不应用于运行时的数据传递或全局状态管理。启动过程中过多的同步读写存储，会显著影响启动耗时。
*
* **示例代码**
*
* ```js
try {
  var value = wx.getStorageSync('key')
  if (value) {
    // Do something with return value
  }
} catch (e) {
  // Do something when catch error
}
``` */
    getStorageSync<T = any>(
      /** 本地缓存中指定的 key */
      key: string
    ): T;
    /** [boolean wx.canIUse(string schema)](https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.canIUse.html)
*
* 需要基础库： `1.1.1`
*
* 在插件中使用：不支持
*
* 判断小程序的API，回调，参数，组件等是否在当前版本可用。
*
* **参数说明**
*
* - `${API}` 代表 API 名字
* - `${method}` 代表调用方式，有效值为return, success, object, callback
* - `${param}` 代表参数或者返回值
* - `${option}` 代表参数的可选值或者返回值的属性
* - `${component}` 代表组件名字
* - `${attribute}` 代表组件属性
* - `${option}` 代表组件属性的可选值
*
* **示例代码**
*
* ```js
// 对象的属性或方法
wx.canIUse('console.log')
wx.canIUse('CameraContext.onCameraFrame')
wx.canIUse('CameraFrameListener.start')
wx.canIUse('Image.src')

// wx接口参数、回调或者返回值
wx.canIUse('openBluetoothAdapter')
wx.canIUse('getSystemInfoSync.return.safeArea.left')
wx.canIUse('getSystemInfo.success.screenWidth')
wx.canIUse('showToast.object.image')
wx.canIUse('onCompassChange.callback.direction')
wx.canIUse('request.object.method.GET')

// 组件的属性
wx.canIUse('live-player')
wx.canIUse('text.selectable')
wx.canIUse('button.open-type.contact')
``` */
    canIUse(
      /** 使用 `${API}.${method}.${param}.${option}` 或者 `${component}.${attribute}.${option}` 方式来调用 */
      schema: string
    ): boolean;
    /** [boolean wx.checkIsPictureInPictureActive()](https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.checkIsPictureInPictureActive.html)
     *
     * 需要基础库： `2.29.2`
     *
     * 在插件中使用：不支持
     *
     * 返回当前是否存在小窗播放（小窗在 video/live-player/live-pusher 下可用） */
    checkIsPictureInPictureActive(): boolean;
    /** [boolean wx.isVKSupport(string version)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.isVKSupport.html)
*
* 需要基础库： `2.22.0`
*
* 在插件中使用：需要基础库 `2.22.0`
*
* 判断支持版本
*
* **示例代码**
*
* ```js
const isSupportV2 = wx.isVKSupport('v2')
``` */
    isVKSupport(
      /** 参数 version 可选值：
       * - 'v1': 旧版本;
       * - 'v2': v2 版本，目前只有 iOS 基础库 2.22.0 以上支持; */
      version: 'v1' | 'v2'
    ): boolean;
    /** [string wx.arrayBufferToBase64(ArrayBuffer arrayBuffer)](https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.arrayBufferToBase64.html)
     *
     * 需要基础库： `1.1.0`
     *
     * 在插件中使用：支持
     * @deprecated 基础库版本 [2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃
     *
     * 将 ArrayBuffer 对象转成 Base64 字符串 */
    arrayBufferToBase64(
      /** 要转换成 Base64 字符串的 ArrayBuffer 对象 */
      arrayBuffer: ArrayBuffer
    ): string;
    /** [string wx.createBufferURL(ArrayBuffer|TypedArray buffer)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.createBufferURL.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 根据传入的 buffer 创建一个唯一的 URL 存在内存中 */
    createBufferURL(
      /** 需要存入内存的二进制数据 */
      buffer:
        | ArrayBuffer
        | Int8Array
        | Uint8Array
        | Uint8ClampedArray
        | Int16Array
        | Uint16Array
        | Int32Array
        | Uint32Array
        | Float32Array
        | Float64Array
    ): string;
    /** [wx.addCard(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/card/wx.addCard.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：不支持
*
* 批量添加卡券。只有通过 [认证](https://developers.weixin.qq.com/miniprogram/product/renzheng.html) 的小程序或文化互动类目的小游戏才能使用。更多文档请参考 [微信卡券接口文档](https://mp.weixin.qq.com/cgi-bin/announce?action=getannouncement&key=1490190158&version=1&lang=zh_CN&platform=2)。
*
* **cardExt 说明**
*
* cardExt 是卡券的扩展参数，其值是一个 JSON 字符串。
*
* **示例代码**
*
* ```js
wx.addCard({
  cardList: [
    {
      cardId: '',
      cardExt: '{"code": "", "openid": "", "timestamp": "", "signature":""}'
    }, {
      cardId: '',
      cardExt: '{"code": "", "openid": "", "timestamp": "", "signature":""}'
    }
  ],
  success (res) {
    console.log(res.cardList) // 卡券添加结果
  }
})
``` */
    addCard<T extends AddCardOption = AddCardOption>(option: T): PromisifySuccessResult<T, AddCardOption>;
    /** [wx.addFileToFavorites(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/favorites/wx.addFileToFavorites.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：不支持
     *
     * 收藏文件 */
    addFileToFavorites<T extends AddFileToFavoritesOption = AddFileToFavoritesOption>(
      option: T
    ): PromisifySuccessResult<T, AddFileToFavoritesOption>;
    /** [wx.addPhoneCalendar(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneCalendar.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：不支持
     *
     * 向系统日历添加事件 */
    addPhoneCalendar<T extends AddPhoneCalendarOption = AddPhoneCalendarOption>(
      option: T
    ): PromisifySuccessResult<T, AddPhoneCalendarOption>;
    /** [wx.addPhoneContact(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/contact/wx.addPhoneContact.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 添加手机通讯录联系人。用户可以选择将该表单以「新增联系人」或「添加到已有联系人」的方式，写入手机系统通讯录。 */
    addPhoneContact<T extends AddPhoneContactOption = AddPhoneContactOption>(
      option: T
    ): PromisifySuccessResult<T, AddPhoneContactOption>;
    /** [wx.addPhoneRepeatCalendar(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneRepeatCalendar.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：不支持
     *
     * 向系统日历添加重复事件 */
    addPhoneRepeatCalendar<T extends AddPhoneRepeatCalendarOption = AddPhoneRepeatCalendarOption>(
      option: T
    ): PromisifySuccessResult<T, AddPhoneRepeatCalendarOption>;
    /** [wx.addVideoToFavorites(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/favorites/wx.addVideoToFavorites.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：不支持
     *
     * 收藏视频 */
    addVideoToFavorites<T extends AddVideoToFavoritesOption = AddVideoToFavoritesOption>(
      option: T
    ): PromisifySuccessResult<T, AddVideoToFavoritesOption>;
    /** [wx.authPrivateMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.authPrivateMessage.html)
*
* 需要基础库： `2.13.0`
*
* 在插件中使用：不支持
*
* 验证私密消息。用法详情见 [小程序私密消息使用指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/private-message.html)
*
* **示例代码**
*
* ```js
wx.authPrivateMessage({
  shareTicket: 'xxxxxx',
  success(res) {
    console.log('authPrivateMessage success', res)
    // res
    // {
    //   errMsg: 'authPrivateMessage:ok'
    //   valid: true
    //   iv: 'xxxx',
    //   encryptedData: 'xxxxxx'
    // }
  },
  fail(res) {
    console.log('authPrivateMessage fail', res)
  }
})
``` */
    authPrivateMessage(option?: AuthPrivateMessageOption): void;
    /** [wx.authorize(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorize.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：不支持
*
* 提前向用户发起授权请求。调用后会立刻弹窗询问用户是否同意授权小程序使用某项功能或获取用户的某些数据，但不会实际调用对应接口。如果用户之前已经同意授权，则不会出现弹窗，直接返回成功。更多用法详见 [用户授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html)。
* > 小程序插件可以使用 [wx.authorizeForMiniProgram](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorizeForMiniProgram.html)
*
* **示例代码**
*
* ```js
// 可以通过 wx.getSetting 先查询一下用户是否授权了 "scope.record" 这个 scope
wx.getSetting({
  success(res) {
    if (!res.authSetting['scope.record']) {
      wx.authorize({
        scope: 'scope.record',
        success () {
          // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
          wx.startRecord()
        }
      })
    }
  }
})
``` */
    authorize<T extends AuthorizeOption = AuthorizeOption>(option: T): PromisifySuccessResult<T, AuthorizeOption>;
    /** [wx.authorizeForMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorizeForMiniProgram.html)
*
* 需要基础库： `2.14.4`
*
* 在插件中使用：需要基础库 `2.14.4`
*
* **仅小程序插件中能调用该接口**，用法同 [wx.authorize](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorize.html)。目前仅支持三种 scope（见下）
*
* **示例代码**
*
* ```js
wx.authorizeForMiniProgram({
  scope: 'scope.record',
  success () {
    // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
    wx.startRecord()
  }
})
``` */
    authorizeForMiniProgram(option: AuthorizeForMiniProgramOption): void;
    /** [wx.batchGetStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchGetStorage.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：不支持
*
* 从本地缓存中异步批量获取指定 key 的内容。
*
* **示例代码**
*
* ```js
wx.batchGetStorage({
  keyList: ['key'],
  success (res) {
    console.log(res)
  }
})
``` */
    batchGetStorage<T extends BatchGetStorageOption = BatchGetStorageOption>(
      option: T
    ): PromisifySuccessResult<T, BatchGetStorageOption>;
    /** [wx.batchSetStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchSetStorage.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 将数据批量存储在本地缓存中指定的 key 中。会覆盖掉原来该 key 对应的内容。除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用。单个 key 允许存储的最大数据长度为 1MB，所有数据存储上限为 10MB。
*
* **示例代码**
*
* ```js
wx.setStorage({
  key:"key",
  data:"value"
})
```
*
* ```js
// 开启加密存储
wx.batchSetStorage({
  kvList: [{
    key: 'key',
    value: 'value',
  }],
})
``` */
    batchSetStorage<T extends BatchSetStorageOption = BatchSetStorageOption>(
      option: T
    ): PromisifySuccessResult<T, BatchSetStorageOption>;
    /** [wx.batchSetStorageSync(Array.&lt;Object&gt; kvList)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.batchSetStorageSync.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 将数据批量存储在本地缓存中指定的 key 中。会覆盖掉原来该 key 对应的内容。除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用。单个 key 允许存储的最大数据长度为 1MB，所有数据存储上限为 10MB。
*
* **示例代码**
*
* ```js
try {
  wx.batchSetStorageSync([{key: 'key', value: 'value'}])
} catch (e) { }
``` */
    batchSetStorageSync(kvList: KvList[]): void;
    /** [wx.canvasGetImageData(Object object, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasGetImageData.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取 canvas 区域隐含的像素数据。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/yufmRjmZ7W8f)
*
* ```js
wx.canvasGetImageData({
  canvasId: 'myCanvas',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  success(res) {
    console.log(res.width) // 100
    console.log(res.height) // 100
    console.log(res.data instanceof Uint8ClampedArray) // true
    console.log(res.data.length) // 100 * 100 * 4
  }
})
``` */
    canvasGetImageData<T extends CanvasGetImageDataOption = CanvasGetImageDataOption>(
      option: T,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): PromisifySuccessResult<T, CanvasGetImageDataOption>;
    /** [wx.canvasPutImageData(Object object, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasPutImageData.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 将像素数据绘制到画布。在自定义组件下，第二个参数传入自定义组件实例 this，以操作组件内 <canvas> 组件 */
    canvasPutImageData<T extends CanvasPutImageDataOption = CanvasPutImageDataOption>(
      option: T,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): PromisifySuccessResult<T, CanvasPutImageDataOption>;
    /** [wx.canvasToTempFilePath(Object object, Object this)](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasToTempFilePath.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 把当前画布指定区域的内容导出生成指定大小的图片。在 `draw()` 回调里调用该方法才能保证图片导出成功。暂不支持离屏 canvas。 */
    canvasToTempFilePath<T extends CanvasToTempFilePathOption = CanvasToTempFilePathOption>(
      option: T,
      /** 在自定义组件下，当前组件实例的this，以操作组件内 [canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 组件 */
      component?: Component.TrivialInstance | Page.TrivialInstance
    ): PromisifySuccessResult<T, CanvasToTempFilePathOption>;
    /** [wx.checkIsAddedToMyMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/my-miniprogram/wx.checkIsAddedToMyMiniProgram.html)
     *
     * 需要基础库： `2.29.1`
     *
     * 在插件中使用：不支持
     *
     * 检查小程序是否被添加至 「我的小程序」 */
    checkIsAddedToMyMiniProgram(option: CheckIsAddedToMyMiniProgramOption): void;
    /** [wx.checkIsOpenAccessibility(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/accessibility/wx.checkIsOpenAccessibility.html)
     *
     * 需要基础库： `2.13.0`
     *
     * 在插件中使用：不支持
     *
     * 检测是否开启视觉无障碍功能。 */
    checkIsOpenAccessibility<T extends CheckIsOpenAccessibilityOption = CheckIsOpenAccessibilityOption>(
      option?: T
    ): PromisifySuccessResult<T, CheckIsOpenAccessibilityOption>;
    /** [wx.checkIsSoterEnrolledInDevice(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/soter/wx.checkIsSoterEnrolledInDevice.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：不支持
*
* 获取设备内是否录入如指纹等生物信息的接口
*
* **示例代码**
*
* ```js
wx.checkIsSoterEnrolledInDevice({
  checkAuthMode: 'fingerPrint',
  success(res) {
    console.log(res.isEnrolled)
  }
})
``` */
    checkIsSoterEnrolledInDevice<T extends CheckIsSoterEnrolledInDeviceOption = CheckIsSoterEnrolledInDeviceOption>(
      option: T
    ): PromisifySuccessResult<T, CheckIsSoterEnrolledInDeviceOption>;
    /** [wx.checkIsSupportSoterAuthentication(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/soter/wx.checkIsSupportSoterAuthentication.html)
*
* 需要基础库： `1.5.0`
*
* 在插件中使用：不支持
*
* 获取本机支持的 SOTER 生物认证方式
*
* **示例代码**
*
* ```js
wx.checkIsSupportSoterAuthentication({
  success(res) {
    // res.supportMode = [] 不具备任何被SOTER支持的生物识别方式
    // res.supportMode = ['fingerPrint'] 只支持指纹识别
    // res.supportMode = ['fingerPrint', 'facial'] 支持指纹识别和人脸识别
  }
})
``` */
    checkIsSupportSoterAuthentication<
      T extends CheckIsSupportSoterAuthenticationOption = CheckIsSupportSoterAuthenticationOption
    >(
      option?: T
    ): PromisifySuccessResult<T, CheckIsSupportSoterAuthenticationOption>;
    /** [wx.checkSession(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)
*
* 在插件中使用：不支持
*
* 检查登录态是否过期。
* 通过 wx.login 接口获得的用户登录态拥有一定的时效性。用户越久未使用小程序，用户登录态越有可能失效。反之如果用户一直在使用小程序，则用户登录态一直保持有效。具体时效逻辑由微信维护，对开发者透明。开发者只需要调用 wx.checkSession 接口检测当前用户登录态是否有效。
*
* 登录态过期后开发者可以再调用 wx.login 获取新的用户登录态。调用成功说明当前 session_key 未过期，调用失败说明 session_key 已过期。
*
* **示例代码**
*
* ```js
wx.checkSession({
  success () {
    //session_key 未过期，并且在本生命周期一直有效
  },
  fail () {
    // session_key 已经失效，需要重新执行登录流程
    wx.login() //重新登录
  }
})
``` */
    checkSession<T extends CheckSessionOption = CheckSessionOption>(
      option?: T
    ): PromisifySuccessResult<T, CheckSessionOption>;
    /** [wx.chooseAddress(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/address/wx.chooseAddress.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.16.1`
*
* 获取用户收货地址。调起用户编辑收货地址原生界面，并在编辑完成后返回用户选择的地址。
* ## 使用方法
* 自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
* ## 申请开通
* 暂只针对具备与地理位置强相关的使用场景的小程序开放，在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。
* 接口权限申请入口将于2022年3月11日开始内测，于3月31日全量上线。并从4月18日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/024hHnmd772y)
* ```js
wx.chooseAddress({
  success (res) {
    console.log(res.userName)
    console.log(res.postalCode)
    console.log(res.provinceName)
    console.log(res.cityName)
    console.log(res.countyName)
    console.log(res.detailInfo)
    console.log(res.nationalCode)
    console.log(res.telNumber)
  }
})
``` */
    chooseAddress<T extends ChooseAddressOption = ChooseAddressOption>(
      option?: T
    ): PromisifySuccessResult<T, ChooseAddressOption>;
    /** [wx.chooseContact(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/contact/wx.chooseContact.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 拉起手机通讯录，选择联系人。 */
    chooseContact(option?: ChooseContactOption): void;
    /** [wx.chooseImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseImage.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [2.21.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.chooseMedia](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html) 替换
*
* 从本地相册选择图片或使用相机拍照。
*
* ****
*
* ```js
wx.chooseImage({
  count: 1,
  sizeType: ['original', 'compressed'],
  sourceType: ['album', 'camera'],
  success (res) {
    // tempFilePath可以作为img标签的src属性显示图片
    const tempFilePaths = res.tempFilePaths
  }
})
``` */
    chooseImage<T extends ChooseImageOption = ChooseImageOption>(
      option?: T
    ): PromisifySuccessResult<T, ChooseImageOption>;
    /** [wx.chooseInvoice(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/invoice/wx.chooseInvoice.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.16.1`
     *
     * 选择用户已有的发票。
     *
     * **通过 cardId 和 encryptCode 获得报销发票的信息**
     *
     * 请参考[微信电子发票文档](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=21517918939oae3U)中，「查询报销发票信息」部分。
     * 其中 `access_token` 的获取请参考[auth.getAccessToken](#)文档 */
    chooseInvoice<T extends ChooseInvoiceOption = ChooseInvoiceOption>(
      option?: T
    ): PromisifySuccessResult<T, ChooseInvoiceOption>;
    /** [wx.chooseInvoiceTitle(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/invoice/wx.chooseInvoiceTitle.html)
*
* 需要基础库： `1.5.0`
*
* 在插件中使用：需要基础库 `2.16.1`
*
* 选择用户的发票抬头。当前小程序必须关联一个公众号，且这个公众号是完成了[微信认证](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1496554031_RD4xe)的，才能调用 chooseInvoiceTitle。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/GJ4S9nmQ7x2E)
*
* ```js
wx.chooseInvoiceTitle({
  success(res) {}
})
``` */
    chooseInvoiceTitle<T extends ChooseInvoiceTitleOption = ChooseInvoiceTitleOption>(
      option?: T
    ): PromisifySuccessResult<T, ChooseInvoiceTitleOption>;
    /** [wx.chooseLicensePlate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/license-plate/wx.chooseLicensePlate.html)
     *
     * 需要基础库： `2.19.0`
     *
     * 在插件中使用：不支持
     *
     * 选择车牌号 */
    chooseLicensePlate<T extends ChooseLicensePlateOption = ChooseLicensePlateOption>(
      option?: T
    ): PromisifySuccessResult<T, ChooseLicensePlateOption>;
    /** [wx.chooseLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.chooseLocation.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * @warning **为确保选择地理位置接口的合理使用，位置接口调整参考 [选择地理位置接口调整公告](https://developers.weixin.qq.com/community/develop/doc/0006e45df2cac030e6edf367c56001)**
     *
     * 打开地图选择位置。
     *  ## 使用方法
     *  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
     *  ## 申请开通
     *  暂只针对具备与地理位置强相关的使用场景的小程序开放，在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。
     *  接口权限申请入口将于2022年3月11日开始内测，于3月31日全量上线。并从4月18日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
     *
     * **示例**
     *
     * ![](https://res.wx.qq.com/op_res/WDFC8aB4FI8rJ9oEmbYfbH_Fl3EIv91471YVxezVfLRESkUuCgfODZcbOoyteKU4j-OLZa2EFKY9BDPd3g-tfg#width:260px) */
    chooseLocation<T extends ChooseLocationOption = ChooseLocationOption>(
      option: T
    ): PromisifySuccessResult<T, ChooseLocationOption>;
    /** [wx.chooseMedia(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html)
*
* 需要基础库： `2.10.0`
*
* 在插件中使用：需要基础库 `2.11.1`
*
* 拍摄或从手机相册中选择图片或视频。
*
* **示例代码**
*
* ```js
wx.chooseMedia({
  count: 9,
  mediaType: ['image','video'],
  sourceType: ['album', 'camera'],
  maxDuration: 30,
  camera: 'back',
  success(res) {
    console.log(res.tempFiles.tempFilePath)
    console.log(res.tempFiles.size)
  }
})
``` */
    chooseMedia<T extends ChooseMediaOption = ChooseMediaOption>(
      option: T
    ): PromisifySuccessResult<T, ChooseMediaOption>;
    /** [wx.chooseMessageFile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseMessageFile.html)
*
* 需要基础库： `2.5.0`
*
* 在插件中使用：不支持
*
* 从客户端会话选择文件。
*
* ****
*
* ```js
wx.chooseMessageFile({
  count: 10,
  type: 'image',
  success (res) {
    // tempFilePath可以作为img标签的src属性显示图片
    const tempFilePaths = res.tempFiles
  }
})
``` */
    chooseMessageFile<T extends ChooseMessageFileOption = ChooseMessageFileOption>(
      option: T
    ): PromisifySuccessResult<T, ChooseMessageFileOption>;
    /** [wx.choosePoi(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.choosePoi.html)
     *
     * 在插件中使用：不支持
     *
     * @warning **为确保选择地理位置接口的合理使用，位置接口调整参考 [选择地理位置接口调整公告](https://developers.weixin.qq.com/community/develop/doc/0006e45df2cac030e6edf367c56001)**
     *
     * 打开POI列表选择位置，支持模糊定位（精确到市）和精确定位混选。
     *  ## 使用方法
     *  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
     *  ## 申请开通
     *  暂只针对具备与地理位置强相关的使用场景的小程序开放，在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。
     *  接口权限申请入口将于2022年3月11日开始内测，于3月31日全量上线。并从4月18日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
     *
     * **示例**
     *
     * ![](https://res.wx.qq.com/op_res/lzDsNyBNifLczyLX0ms7ZpPQysgAgdhrQTGzzTQPiXkAB2HJIf1Slvl4rnN9I1q0AT3xqoGTg98jMsNexDLbbA#width:260px) */
    choosePoi<T extends ChoosePoiOption = ChoosePoiOption>(option: T): PromisifySuccessResult<T, ChoosePoiOption>;
    /** [wx.chooseVideo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseVideo.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [2.21.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.chooseMedia](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html) 替换
*
* 拍摄视频或从手机相册中选视频。
*
* **示例代码**
*
* ```js
wx.chooseVideo({
  sourceType: ['album','camera'],
  maxDuration: 60,
  camera: 'back',
  success(res) {
    console.log(res.tempFilePath)
  }
})
``` */
    chooseVideo<T extends ChooseVideoOption = ChooseVideoOption>(
      option: T
    ): PromisifySuccessResult<T, ChooseVideoOption>;
    /** [wx.clearStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorage.html)
*
* 在插件中使用：不支持
*
* 清理本地数据缓存。
*
* **示例代码**
*
* ```js
wx.clearStorage()
```
*
* ```js
try {
  wx.clearStorageSync()
} catch(e) {
  // Do something when catch error
}
``` */
    clearStorage<T extends ClearStorageOption = ClearStorageOption>(
      option?: T
    ): PromisifySuccessResult<T, ClearStorageOption>;
    /** [wx.clearStorageSync()](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorageSync.html)
*
* 在插件中使用：不支持
*
* [wx.clearStorage](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorage.html) 的同步版本
*
* **示例代码**
*
* ```js
wx.clearStorage()
```
*
* ```js
try {
  wx.clearStorageSync()
} catch(e) {
  // Do something when catch error
}
``` */
    clearStorageSync(): void;
    /** [wx.closeBLEConnection(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.closeBLEConnection.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 断开与蓝牙低功耗设备的连接。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.closeBLEConnection({
  deviceId,
  success (res) {
    console.log(res)
  }
})
``` */
    closeBLEConnection<T extends CloseBLEConnectionOption = CloseBLEConnectionOption>(
      option: T
    ): PromisifySuccessResult<T, CloseBLEConnectionOption>;
    /** [wx.closeBluetoothAdapter(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.closeBluetoothAdapter.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 关闭蓝牙模块。调用该方法将断开所有已建立的连接并释放系统资源。建议在使用蓝牙流程后，与 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 成对调用。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.closeBluetoothAdapter({
  success (res) {
    console.log(res)
  }
})
``` */
    closeBluetoothAdapter<T extends CloseBluetoothAdapterOption = CloseBluetoothAdapterOption>(
      option?: T
    ): PromisifySuccessResult<T, CloseBluetoothAdapterOption>;
    /** [wx.closeSocket(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.closeSocket.html)
*
* 在插件中使用：不支持
*
* @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
*
* 关闭 WebSocket 连接。
*
* **示例代码**
*
* ```js
wx.connectSocket({
  url: 'test.php'
})

//注意这里有时序问题，
//如果 wx.connectSocket 还没回调 wx.onSocketOpen，而先调用 wx.closeSocket，那么就做不到关闭 WebSocket 的目的。
//必须在 WebSocket 打开期间调用 wx.closeSocket 才能关闭。
wx.onSocketOpen(function() {
  wx.closeSocket()
})

wx.onSocketClose(function(res) {
  console.log('WebSocket 已关闭！')
})
``` */
    closeSocket<T extends CloseSocketOption = CloseSocketOption>(
      option?: T
    ): PromisifySuccessResult<T, CloseSocketOption>;
    /** [wx.compressImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.compressImage.html)
*
* 需要基础库： `2.4.0`
*
* 在插件中使用：需要基础库 `2.12.0`
*
* 压缩图片接口，可选压缩质量
*
* **示例代码**
*
* ```js
wx.compressImage({
  src: '', // 图片路径
  quality: 80 // 压缩质量
})
``` */
    compressImage<T extends CompressImageOption = CompressImageOption>(
      option: T
    ): PromisifySuccessResult<T, CompressImageOption>;
    /** [wx.compressVideo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.compressVideo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：需要基础库 `2.11.1`
     *
     * 压缩视频接口。开发者可指定压缩质量 `quality` 进行压缩。当需要更精细的控制时，可指定 `bitrate`、`fps`、和 `resolution`，当 `quality` 传入时，这三个参数将被忽略。原视频的相关信息可通过 [getVideoInfo](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.getVideoInfo.html) 获取。 */
    compressVideo<T extends CompressVideoOption = CompressVideoOption>(
      option: T
    ): PromisifySuccessResult<T, CompressVideoOption>;
    /** [wx.connectWifi(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.connectWifi.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 连接 Wi-Fi。若已知 Wi-Fi 信息，可以直接利用该接口连接。仅 Android 与 iOS 11 以上版本支持。
*
* **示例代码**
*
* ```js
wx.connectWifi({
  SSID: '',
  password: '',
  success (res) {
    console.log(res.errMsg)
  }
})
```
*
* **注意**
*
* - Android 微信客户端 7.0.22 以上版本，connectWifi 的实现在 Android 10 及以上的手机无法生效，对于 Android 10 及以上版本，设备连接 wifi 之后，（受系统能力限制）其他进程无法使用当前连接的 wifi ；即连接上的 wifi 只对当前小程序有效，如果想要对整个系统生效，需要配置 maunal 来连接 wifi。
* - iOS 系统底层没有给开发者提供因 wifi 密码错误而连接失败的事件，但用户可以收到密码错误的系统弹窗。建议开发者通过 onWifiConnected 事件来判断 wifi 是否连接成功；即设置定时器，若超时后仍没有 onWifiConnected 事件，则认定此次 wifi 连接无效。
* - Android / iOS 在系统已经连上目标 wifi 的情况下，小程序再次连接目标 wifi，此时无论输入的密码是否正确，系统都会默认此次连接成功，且没有 onWifiConnected 事件。
* - onWifiConnected 事件可能会返回空对象，此时代表 wifi 断开连接，开发者可忽略这种情况。 */
    connectWifi<T extends ConnectWifiOption = ConnectWifiOption>(
      option: T
    ): PromisifySuccessResult<T, ConnectWifiOption>;
    /** [wx.createBLEConnection(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 连接蓝牙低功耗设备。
*
* 若小程序在之前已有搜索过某个蓝牙设备，并成功建立连接，可直接传入之前搜索获取的 deviceId 直接尝试连接该设备，无需再次进行搜索操作。
*
* **注意**
*
* - 请保证尽量成对的调用 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 和 [wx.closeBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.closeBLEConnection.html) 接口。安卓如果重复调用 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 创建连接，有可能导致系统持有同一设备多个连接的实例，导致调用 `closeBLEConnection` 的时候并不能真正的断开与设备的连接。
* - 蓝牙连接随时可能断开，建议监听 [wx.onBLEConnectionStateChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEConnectionStateChange.html) 回调事件，当蓝牙设备断开时按需执行重连操作
* - 若对未连接的设备或已断开连接的设备调用数据读写操作的接口，会返回 10006 错误，建议进行重连操作。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.createBLEConnection({
  deviceId,
  success (res) {
    console.log(res)
  }
})
``` */
    createBLEConnection<T extends CreateBLEConnectionOption = CreateBLEConnectionOption>(
      option: T
    ): PromisifySuccessResult<T, CreateBLEConnectionOption>;
    /** [wx.createBLEPeripheralServer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.createBLEPeripheralServer.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：需要基础库 `2.22.1`
     *
     * 建立本地作为蓝牙低功耗外围设备的服务端，可创建多个。 */
    createBLEPeripheralServer<T extends CreateBLEPeripheralServerOption = CreateBLEPeripheralServerOption>(
      option?: T
    ): PromisifySuccessResult<T, CreateBLEPeripheralServerOption>;
    /** [wx.cropImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.cropImage.html)
*
* 需要基础库： `2.26.0`
*
* 在插件中使用：不支持
*
* 裁剪图片接口
*
* **示例代码**
*
* ```js
wx.cropImage({
  src: '', // 图片路径
  cropScale: '16:9', // 裁剪比例
})
``` */
    cropImage(option: CropImageOption): void;
    /** [wx.disableAlertBeforeUnload(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.disableAlertBeforeUnload.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：不支持
     *
     * 关闭小程序页面返回询问对话框。 */
    disableAlertBeforeUnload(option?: DisableAlertBeforeUnloadOption): void;
    /** [wx.editImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.editImage.html)
*
* 需要基础库： `2.22.0`
*
* 在插件中使用：不支持
*
* 编辑图片接口
*
* **示例代码**
*
* ```js
wx.editImage({
  src: '', // 图片路径
})
``` */
    editImage(option: EditImageOption): void;
    /** [wx.enableAlertBeforeUnload(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.enableAlertBeforeUnload.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：不支持
     *
     * 开启小程序页面返回询问对话框。
     *
     * ## 弹窗条件
     * * 当用户在小程序内非首页页面/最底层页
     * * 官方导航栏上的的返回
     * * 全屏模式下自绘返回键
     * * android 系统 back 键时
     *
     * ## 注意事项
     * * 手势滑动返回时不做拦截
     * * 在任何场景下，此功能都不应拦住用户退出小程序的行为
     *
     * **示例代码**
     *
     * [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/MTPm9Cmh7VfT) */
    enableAlertBeforeUnload(option: EnableAlertBeforeUnloadOption): void;
    /** [wx.exitMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.exitMiniProgram.html)
     *
     * 需要基础库： `2.17.3`
     *
     * 在插件中使用：需要基础库 `2.30.1`
     *
     * 退出当前小程序。必须有点击行为才能调用成功。 */
    exitMiniProgram<T extends ExitMiniProgramOption = ExitMiniProgramOption>(
      option?: T
    ): PromisifySuccessResult<T, ExitMiniProgramOption>;
    /** [wx.exitVoIPChat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.exitVoIPChat.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.0`
     *
     * 退出（销毁）实时语音通话 */
    exitVoIPChat<T extends ExitVoIPChatOption = ExitVoIPChatOption>(
      option?: T
    ): PromisifySuccessResult<T, ExitVoIPChatOption>;
    /** [wx.faceDetect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/face/wx.faceDetect.html)
     *
     * 需要基础库： `2.18.0`
     *
     * 在插件中使用：需要基础库 `2.21.3`
     *
     * @warning **该接口已停止维护，推荐使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 代替**
     *
     * 人脸检测，使用前需要通过 wx.initFaceDetect 进行一次初始化，推荐使用相机接口返回的帧数据。本接口不再维护，请使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 接口代替。详情参考[人脸检测指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html)
     *
     * ****
     *
     * ### 特别说明
     * 若小程序人脸识别功能涉及采集、存储用户生物特征（如人脸照片或视频、身份证和手持身份证、身份证照和免冠照等），此类型服务需使用[微信原生人脸识别接口](https://developers.weixin.qq.com/community/develop/doc/000442d352c1202bd498ecb105c00d?highline=%E4%BA%BA%E8%84%B8%E6%A0%B8%E8%BA%AB)。 */
    faceDetect(option: FaceDetectOption): void;
    /** [wx.getAvailableAudioSources(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.getAvailableAudioSources.html)
     *
     * 需要基础库： `2.1.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 获取当前支持的音频输入源 */
    getAvailableAudioSources<T extends GetAvailableAudioSourcesOption = GetAvailableAudioSourcesOption>(
      option?: T
    ): PromisifySuccessResult<T, GetAvailableAudioSourcesOption>;
    /** [wx.getBLEDeviceCharacteristics(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceCharacteristics.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取蓝牙低功耗设备某个服务中所有特征 (characteristic)。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.getBLEDeviceCharacteristics({
  // 这里的 deviceId 需要已经通过 wx.createBLEConnection 与对应设备建立链接
  deviceId,
  // 这里的 serviceId 需要在 wx.getBLEDeviceServices 接口中获取
  serviceId,
  success (res) {
    console.log('device getBLEDeviceCharacteristics:', res.characteristics)
  }
})
``` */
    getBLEDeviceCharacteristics<T extends GetBLEDeviceCharacteristicsOption = GetBLEDeviceCharacteristicsOption>(
      option: T
    ): PromisifySuccessResult<T, GetBLEDeviceCharacteristicsOption>;
    /** [wx.getBLEDeviceRSSI(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceRSSI.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：需要基础库 `2.11.0`
     *
     * 获取蓝牙低功耗设备的信号强度 (Received Signal Strength Indication, RSSI)。 */
    getBLEDeviceRSSI<T extends GetBLEDeviceRSSIOption = GetBLEDeviceRSSIOption>(
      option: T
    ): PromisifySuccessResult<T, GetBLEDeviceRSSIOption>;
    /** [wx.getBLEDeviceServices(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEDeviceServices.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取蓝牙低功耗设备所有服务 (service)。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.getBLEDeviceServices({
  // 这里的 deviceId 需要已经通过 wx.createBLEConnection 与对应设备建立连接
  deviceId,
  success (res) {
    console.log('device services:', res.services)
  }
})
``` */
    getBLEDeviceServices<T extends GetBLEDeviceServicesOption = GetBLEDeviceServicesOption>(
      option: T
    ): PromisifySuccessResult<T, GetBLEDeviceServicesOption>;
    /** [wx.getBLEMTU(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.getBLEMTU.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.20.1`
*
* 获取蓝牙低功耗的最大传输单元。需在 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 调用成功后调用。
*
* **注意**
*
* - 小程序中 MTU 为 ATT_MTU，包含 Op-Code 和 Attribute Handle 的长度，实际可以传输的数据长度为 `ATT_MTU - 3`
* - iOS 系统中 MTU 为固定值；安卓系统中，MTU 会在系统协商成功之后发生改变，建议使用 [wx.onBLEMTUChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEMTUChange.html) 监听。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.getBLEMTU({
  deviceId: '',
  writeType: 'write',
  success (res) {
    console.log(res)
  }
})
``` */
    getBLEMTU<T extends GetBLEMTUOption = GetBLEMTUOption>(option: T): PromisifySuccessResult<T, GetBLEMTUOption>;
    /** [wx.getBackgroundAudioPlayerState(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioPlayerState.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
*
* 获取后台音乐播放状态。
*
* **示例代码**
*
* ```js
wx.getBackgroundAudioPlayerState({
  success (res) {
    const status = res.status
    const dataUrl = res.dataUrl
    const currentPosition = res.currentPosition
    const duration = res.duration
    const downloadPercent = res.downloadPercent
  }
})
``` */
    getBackgroundAudioPlayerState<T extends GetBackgroundAudioPlayerStateOption = GetBackgroundAudioPlayerStateOption>(
      option?: T
    ): PromisifySuccessResult<T, GetBackgroundAudioPlayerStateOption>;
    /** [wx.getBackgroundFetchData(object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.getBackgroundFetchData.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 拉取 backgroundFetch 客户端缓存数据。
     * 当调用接口时，若当次请求未结束，会先返回本地的旧数据（之前打开小程序时请求的），如果本地没有旧数据会返回失败，而不会等待请求完成。 */
    getBackgroundFetchData<T extends GetBackgroundFetchDataOption = GetBackgroundFetchDataOption>(
      option: T
    ): PromisifySuccessResult<T, GetBackgroundFetchDataOption>;
    /** [wx.getBackgroundFetchToken(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.getBackgroundFetchToken.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 获取设置过的自定义登录态。若无，则返回 fail。 */
    getBackgroundFetchToken<T extends GetBackgroundFetchTokenOption = GetBackgroundFetchTokenOption>(
      option?: T
    ): PromisifySuccessResult<T, GetBackgroundFetchTokenOption>;
    /** [wx.getBatteryInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfo.html)
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 获取设备电量。同步 API [wx.getBatteryInfoSync](https://developers.weixin.qq.com/miniprogram/dev/api/device/battery/wx.getBatteryInfoSync.html) 在 iOS 上不可用。 */
    getBatteryInfo<T extends GetBatteryInfoOption = GetBatteryInfoOption>(
      option?: T
    ): PromisifySuccessResult<T, GetBatteryInfoOption>;
    /** [wx.getBeacons(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.getBeacons.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 获取所有已搜索到的 Beacon 设备 */
    getBeacons<T extends GetBeaconsOption = GetBeaconsOption>(option?: T): PromisifySuccessResult<T, GetBeaconsOption>;
    /** [wx.getBluetoothAdapterState(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getBluetoothAdapterState.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取本机蓝牙适配器状态。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.getBluetoothAdapterState({
  success (res) {
    console.log(res)
  }
})
``` */
    getBluetoothAdapterState<T extends GetBluetoothAdapterStateOption = GetBluetoothAdapterStateOption>(
      option?: T
    ): PromisifySuccessResult<T, GetBluetoothAdapterStateOption>;
    /** [wx.getBluetoothDevices(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getBluetoothDevices.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取在蓝牙模块生效期间所有搜索到的蓝牙设备。包括已经和本机处于连接状态的设备。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
*
* ```js
// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function(bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}
wx.getBluetoothDevices({
  success: function (res) {
    console.log(res)
    if (res.devices[0]) {
      console.log(ab2hex(res.devices[0].advertisData))
    }
  }
})
```
*
* **注意**
*
* - 该接口获取到的设备列表为**蓝牙模块生效期间所有搜索到的蓝牙设备**，若在蓝牙模块使用流程结束后未及时调用 [wx.closeBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.closeBluetoothAdapter.html) 释放资源，会存在调用该接口会返回之前的蓝牙使用流程中搜索到的蓝牙设备，可能设备已经不在用户身边，无法连接。 */
    getBluetoothDevices<T extends GetBluetoothDevicesOption = GetBluetoothDevicesOption>(
      option?: T
    ): PromisifySuccessResult<T, GetBluetoothDevicesOption>;
    /** [wx.getChannelsLiveInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.getChannelsLiveInfo.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：不支持
     *
     * 获取视频号直播信息 */
    getChannelsLiveInfo(option: GetChannelsLiveInfoOption): void;
    /** [wx.getChannelsLiveNoticeInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.getChannelsLiveNoticeInfo.html)
     *
     * 需要基础库： `2.19.0`
     *
     * 在插件中使用：不支持
     *
     * 获取视频号直播预告信息 */
    getChannelsLiveNoticeInfo(option: GetChannelsLiveNoticeInfoOption): void;
    /** [wx.getChannelsShareKey(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.getChannelsShareKey.html)
     *
     * 需要基础库： `2.22.1`
     *
     * 在插件中使用：不支持
     *
     * 获取视频号直播卡片/视频卡片的分享来源，仅当卡片携带了分享信息、同时用户已授权该小程序获取视频号分享信息且启动场景值为 1177、1184、1195、1208 时可用。 */
    getChannelsShareKey(option?: GetChannelsShareKeyOption): void;
    /** [wx.getClipboardData(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/clipboard/wx.getClipboardData.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取系统剪贴板的内容
*
* **示例代码**
*
* ```js
wx.getClipboardData({
  success (res){
    console.log(res.data)
  }
})
``` */
    getClipboardData<T extends GetClipboardDataOption = GetClipboardDataOption>(
      option?: T
    ): PromisifySuccessResult<T, GetClipboardDataOption>;
    /** [wx.getConnectedBluetoothDevices(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getConnectedBluetoothDevices.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 根据主服务 UUID 获取已连接的蓝牙设备。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.getConnectedBluetoothDevices({
  services: ['FEE7'],
  success (res) {
    console.log(res)
  }
})
``` */
    getConnectedBluetoothDevices<T extends GetConnectedBluetoothDevicesOption = GetConnectedBluetoothDevicesOption>(
      option: T
    ): PromisifySuccessResult<T, GetConnectedBluetoothDevicesOption>;
    /** [wx.getConnectedWifi(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.getConnectedWifi.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 获取已连接中的 Wi-Fi 信息。 */
    getConnectedWifi<T extends GetConnectedWifiOption = GetConnectedWifiOption>(
      option: T
    ): PromisifySuccessResult<T, GetConnectedWifiOption>;
    /** [wx.getDeviceVoIPList(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.getDeviceVoIPList.html)
*
* 需要基础库： `2.30.3`
*
* 在插件中使用：不支持
*
* 查询当前用户授权的音视频通话设备（组）信息
*
* **示例代码**
*
* ```js
wx.getDeviceVoIPList({
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.log(res)
  }
})
``` */
    getDeviceVoIPList(option?: GetDeviceVoIPListOption): void;
    /** [wx.getExtConfig(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfig.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：不支持
*
* 获取[第三方平台](https://developers.weixin.qq.com/miniprogram/dev/devtools/ext.html)自定义的数据字段。
*
* **Tips**
*
* 1. 本接口暂时无法通过 [wx.canIUse](https://developers.weixin.qq.com/miniprogram/dev/api/base/wx.canIUse.html) 判断是否兼容，开发者需要自行判断 [wx.getExtConfig](https://developers.weixin.qq.com/miniprogram/dev/api/ext/wx.getExtConfig.html) 是否存在来兼容
*
* ****
*
* ```js
if (wx.getExtConfig) {
  wx.getExtConfig({
    success (res) {
      console.log(res.extConfig)
    }
  })
}
``` */
    getExtConfig<T extends GetExtConfigOption = GetExtConfigOption>(
      option?: T
    ): PromisifySuccessResult<T, GetExtConfigOption>;
    /** [wx.getFuzzyLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getFuzzyLocation.html)
*
* 需要基础库： `2.25.0`
*
* 在插件中使用：支持
*
* 获取当前的模糊地理位置。
*  ## 使用方法
*  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
*  ## 申请开通
*  暂只针对具备与地理位置强相关的使用场景的小程序开放，在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。 从2022年7月14日开始在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
*
* **示例代码**
*
*  ```js
 wx.getFuzzyLocation({
  type: 'wgs84',
  success (res) {
    const latitude = res.latitude
    const longitude = res.longitude
  }
})
 ``` */
    getFuzzyLocation(option: GetFuzzyLocationOption): void;
    /** [wx.getGroupEnterInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html)
*
* 需要基础库： `2.10.4`
*
* 在插件中使用：不支持
*
* 获取微信群聊场景下的小程序启动信息。群聊场景包括群聊小程序消息卡片、群待办、群工具。可用于获取当前群的 opengid。
* ## 注意事项
*  - 基础库 v2.10.4 开始支持获取群工具小程序启动信息
*  - 基础库 v2.17.3 开始支持获取群聊小程序消息卡片、群待办小程序启动信息
*
* **示例代码**
*
* ```js
wx.getGroupEnterInfo({
  success(res) {
    // res
    {
      errMsg: 'getGroupEnterInfo:ok',
      encryptedData: '',
      iv: ''
    }
  },
  fail() {

  }
})
```
*
* 敏感数据有两种获取方式，一是使用 [加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) 。
* 获取得到的开放数据为以下 json 结构（其中 opengid 为当前群的唯一标识）：
*
* ```json
{
 "opengid": "OPENGID"
}
```
*
* **Tips**
*
* - 如需要展示群名称，小程序可以使用[开放数据组件](https://developers.weixin.qq.com/miniprogram/dev/component/open-data.html)
* - 小游戏可以通过 `wx.getGroupInfo` 接口获取群名称 */
    getGroupEnterInfo(option: GetGroupEnterInfoOption): void;
    /** [wx.getHCEState(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.getHCEState.html)
*
* 需要基础库： `1.7.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 判断当前设备是否支持 HCE 能力。
*
* **示例代码**
*
* ```js
wx.getHCEState({
  success (res) {
    console.log(res.errCode)
  }
})
``` */
    getHCEState<T extends GetHCEStateOption = GetHCEStateOption>(
      option?: T
    ): PromisifySuccessResult<T, GetHCEStateOption>;
    /** [wx.getImageInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.getImageInfo.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取图片信息。网络图片需先配置download域名才能生效。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/Kd47Sbmr6yYu)
*
* ```js
wx.getImageInfo({
  src: 'images/a.jpg',
  success (res) {
    console.log(res.width)
    console.log(res.height)
  }
})

wx.chooseImage({
  success (res) {
    wx.getImageInfo({
      src: res.tempFilePaths[0],
      success (res) {
        console.log(res.width)
        console.log(res.height)
      }
    })
  }
})
``` */
    getImageInfo<T extends GetImageInfoOption = GetImageInfoOption>(
      option: T
    ): PromisifySuccessResult<T, GetImageInfoOption>;
    /** [wx.getInferenceEnvInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/inference/wx.getInferenceEnvInfo.html)
*
* 需要基础库： `2.30.1`
*
* 在插件中使用：需要基础库 `2.30.1`
*
* 获取通用AI推理引擎版本。使用前可参考[AI指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/inference/tutorial.html)
*
* **示例代码**
*
* ```js
// 获取通用AI推理引擎版本
wx.getInferenceEnvInfo({
      complete: (res) => {
        console.log(res.ver)
        console.log(res.errMsg)
      },
})
``` */
    getInferenceEnvInfo(option?: GetInferenceEnvInfoOption): void;
    /** [wx.getLocalIPAddress(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.getLocalIPAddress.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 获取局域网IP地址
*
* **示例代码**
*
* ```js
wx.getLocalIPAddress({
  success (res) {
    const localip = res.localip
  }
})
``` */
    getLocalIPAddress(option: GetLocalIPAddressOption): void;
    /** [wx.getLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取当前的地理位置、速度。当用户离开小程序后，此接口无法调用。开启高精度定位，接口耗时会增加，可指定 highAccuracyExpireTime 作为超时时间。地图相关使用的坐标格式应为 gcj02。
*  高频率调用会导致耗电，如有需要可使用持续定位接口 `wx.onLocationChange`。
*  基础库 `2.17.0` 版本起 `wx.getLocation` 增加调用频率限制，[相关公告](https://developers.weixin.qq.com/community/develop/doc/000aee91a98d206bc6dbe722b51801)。
*
*   ## 使用方法
*  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
*
*   ## 申请开通
*   暂只针对如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。
*   接口权限申请入口将于2022年3月11日开始内测，于3月31日全量上线。并从4月18日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
*
*   ### 国内主体开放类目
*
*   | 一级类目/主体类型	| 二级类目	| 应用场景 |
*   | -------------- | -------| -------- |
*   | 电商平台 |	/	| 售卖商品线下发货、线下收货服务 |
*   | 商家自营 |	/	| 提供售卖商品线下发货、线下收货服务、线下商超导览、导航服务 |
*   | 医疗服务 | 公立医疗机构、三级私立医疗机构、其他私立医疗机构、就医服务、其他医学健康服务、药品（非处方药）销售、非处方药销售平台、医疗器械生产企业、医疗器械自营、医疗器械经营销售平台、互联网医院血液、干细胞服务、临床试验		| 1、实际物品/药品接收服务 2、基于地理位置取号并现场报到、附近医院导航等服务 |
*   | 交通服务 |	/	| 代驾服务、租车网点导航等相关服务 |
*   | 生活服务 |	/	| 上门服务作业等线下场景  |
*   | 物流服务 |	收件/派件、查件、邮政、装卸搬运、快递柜、货物运输	 |	快递/货物收发服务 |
*   | 餐饮服务 | 	点餐平台、外卖平台、餐饮服务场所/餐饮服务管理企业	| 线下送餐服务 |
*   | 工具	| 天气、信息查询、办公、设备管理 |	与地理位置相关的服务，比如潮汐查询、海拔查询、天气查询、智能穿戴、智能门禁、与地理位置相关的打卡服务等 |
*   | 金融  | 银行、非金融机构自营小额贷款/融资担保/商业保理、保险 | 提供线下网点预约、基于地理位置取号并现场报到、附近网点导航等服务 |
*   | 旅游  | 景区服务、住宿服务 | 提供景区导航、导览服务、酒店导航服务 |
*   | 汽车服务 | 维修保养、汽车用品、汽车经销商/4S店、汽车厂商、汽车预售、二手车 | 提供汽车售卖、维保洗美服务、查找附近的维修点/洗车网点等导航服务 |
*   | IT科技 | 基础电信运营商、电信业务代理商 | 提供运营商线下网点的预约、基于地理位置取号并现场报到、网点导航等服务 |
*   | 房地产服务 | 物业管理、房屋中介、房屋装修 | 提供房地产开发商及物业公司门店导览导航服务 |
*   | 政务民生 |	/	 | 提供政务单位相关业务 |
*   | 政府主体帐号 |	/	| 提供政务单位相关业务 |
*
*   ### 海外主体开放类目
*
*   | 一级类目/主体类型	| 二级类目	| 应用场景 |
*   | -------------- | -------| -------- |
*   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
*   | 快递业与邮政	 | /	 | 快递/货物收发服务 |
*   | 餐饮	 | /	 | 线下送餐服务 |
*   | 电商平台	 | /	 | 售卖商品线下发货、线下收货服务 |
*   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
*   | 跨境电商	 | /	 | 提供售卖商品线下发货、收货服务、线下商超导览、导航服务 |
*   | 本地服务	 | 服装/鞋/箱包、玩具、家电/数码/手机、美妆/洗护、珠宝/饰品/眼镜/钟表、运动/户外/乐器、鲜花/园艺/工艺品、家居/家饰/家纺、办公/文具、机械/电子器件、酒、食品、百货、超市/便利店、宠物食品/用品	 | 提供售卖商品线下发货、线下收货服务、线下商超导览、导航服务 |
*   | 生活服务	 | 家政、外送	 | 上门服务作业等线下场景 |
*
* **示例代码**
*
*  ```js
 wx.getLocation({
  type: 'wgs84',
  success (res) {
    const latitude = res.latitude
    const longitude = res.longitude
    const speed = res.speed
    const accuracy = res.accuracy
  }
})
 ```
*
* **注意**
*
* - `2.17.0 起 `wx.getLocation` 增加调用频率限制，[相关公告](https://developers.weixin.qq.com/community/develop/doc/000aee91a98d206bc6dbe722b51801)
* - 工具中定位模拟使用IP定位，可能会有一定误差。且工具目前仅支持 gcj02 坐标。
* - 使用第三方服务进行逆地址解析时，请确认第三方服务默认的坐标系，正确进行坐标转换。 */
    getLocation<T extends GetLocationOption = GetLocationOption>(
      option: T
    ): PromisifySuccessResult<T, GetLocationOption>;
    /** [wx.getNetworkType(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.getNetworkType.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取网络类型
*
* **示例代码**
*
* ```js
wx.getNetworkType({
  success (res) {
    const networkType = res.networkType
  }
})
``` */
    getNetworkType<T extends GetNetworkTypeOption = GetNetworkTypeOption>(
      option?: T
    ): PromisifySuccessResult<T, GetNetworkTypeOption>;
    /** [wx.getRandomValues(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/crypto/wx.getRandomValues.html)
*
* 需要基础库： `2.15.0`
*
* 在插件中使用：不支持
*
* 获取密码学安全随机数
*
* **示例代码**
*
* ```js
wx.getRandomValues({
  length: 6 // 生成 6 个字节长度的随机数,
  success: res => {
    console.log(wx.arrayBufferToBase64(res.randomValues)) // 转换为 base64 字符串后打印
  }
})
``` */
    getRandomValues<T extends GetRandomValuesOption = GetRandomValuesOption>(
      option: T
    ): PromisifySuccessResult<T, GetRandomValuesOption>;
    /** [wx.getScreenBrightness(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.getScreenBrightness.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 获取屏幕亮度
     *
     * **说明**
     *
     * - 若安卓系统设置中开启了自动调节亮度功能，则屏幕亮度会根据光线自动调整，该接口仅能获取自动调节亮度之前的值，而非实时的亮度值。 */
    getScreenBrightness<T extends GetScreenBrightnessOption = GetScreenBrightnessOption>(
      option?: T
    ): PromisifySuccessResult<T, GetScreenBrightnessOption>;
    /** [wx.getScreenRecordingState(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.getScreenRecordingState.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 查询用户是否在录屏。
     *
     * **示例代码**
     *
     * ```js
     * wx.getScreenRecordingState({
     *   success: function (res) {
     *     console.log(res.state)
     *   },
     * }) */
    getScreenRecordingState(option?: GetScreenRecordingStateOption): void;
    /** [wx.getSelectedTextRange(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.getSelectedTextRange.html)
*
* 需要基础库： `2.7.0`
*
* 在插件中使用：不支持
*
* 在input、textarea等focus之后，获取输入框的光标位置。注意：只有在focus的时候调用此接口才有效。
*
* **示例代码**
*
* ```js
wx.getSelectedTextRange({
  complete: res => {
    console.log('getSelectedTextRange res', res.start, res.end)
  }
})
``` */
    getSelectedTextRange<T extends GetSelectedTextRangeOption = GetSelectedTextRangeOption>(
      option?: T
    ): PromisifySuccessResult<T, GetSelectedTextRangeOption>;
    /** [wx.getSetting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.getSetting.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `2.6.3`
*
* 在插件中使用时，接口有以下不同：
* - `withSubscriptions` 无效（插件暂无订阅消息）
* - 返回值中的 `authSetting` 字段中是插件的权限（如用户信息功能页授权）
* - [2.14.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起返回值中有 `miniprogramAuthSetting` 字段，内容等于当前小程序 `getSetting` 的结果（不含订阅状态）
*
* 获取用户的当前设置。**返回值中只会出现小程序已经向用户请求过的[权限](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html)**。
*
* **示例代码**
*
* ```js
wx.getSetting({
  success (res) {
    console.log(res.authSetting)
    // res.authSetting = {
    //   "scope.userInfo": true,
    //   "scope.userLocation": true
    // }
  }
})
```
*
* ```js
wx.getSetting({
  withSubscriptions: true,
  success (res) {
    console.log(res.authSetting)
    // res.authSetting = {
    //   "scope.userInfo": true,
    //   "scope.userLocation": true
    // }
    console.log(res.subscriptionsSetting)
    // res.subscriptionsSetting = {
    //   mainSwitch: true, // 订阅消息总开关
    //   itemSettings: {   // 每一项开关
    //     SYS_MSG_TYPE_INTERACTIVE: 'accept', // 小游戏系统订阅消息
    //     SYS_MSG_TYPE_RANK: 'accept'
    //     zun-LzcQyW-edafCVvzPkK4de2Rllr1fFpw2A_x0oXE: 'reject', // 普通一次性订阅消息
    //     ke_OZC_66gZxALLcsuI7ilCJSP2OJ2vWo2ooUPpkWrw: 'ban',
    //   }
    // }
  }
})
``` */
    getSetting<T extends GetSettingOption = GetSettingOption>(option?: T): PromisifySuccessResult<T, GetSettingOption>;
    /** [wx.getShareInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.getShareInfo.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 获取转发详细信息
*
* **示例代码**
*
* 敏感数据获取方式 [加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) 。
* 获取得到的开放数据为以下 json 结构（其中 openGId 为当前群的唯一标识）：
*
* ```json
{
 "openGId": "OPENGID"
}
```
*
* **Tips**
*
* - 如需要展示群名称，小程序可以使用 [开放数据组件](https://developers.weixin.qq.com/miniprogram/dev/component/open-data.html)
* - 小游戏可以通过 [`wx.getGroupInfo`](#) 接口获取群名称 */
    getShareInfo<T extends GetShareInfoOption = GetShareInfoOption>(
      option: T
    ): PromisifySuccessResult<T, GetShareInfoOption>;
    /** [wx.getSkylineInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSkylineInfo.html)
     *
     * 需要基础库： `2.26.2`
     *
     * 在插件中使用：需要基础库 `2.26.2`
     *
     * 获取当前运行环境对于 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的支持情况 */
    getSkylineInfo(option?: GetSkylineInfoOption): void;
    /** [wx.getStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorage.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 从本地缓存中异步获取指定 key 的内容。
*
* **示例代码**
*
* ```js
wx.getStorage({
  key: 'key',
  success (res) {
    console.log(res.data)
  }
})
```
*
* ```js
// 开启加密存储
wx.setStorage({
  key: "key",
  data: "value",
  encrypt: true, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
  success() {
    wx.getStorage({
      key: "key",
      encrypt: true, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
      success(res) {
        console.log(res.data)
      }
    })
  }
})
``` */
    getStorage<T = any, U extends GetStorageOption<T> = GetStorageOption<T>>(
      option: U
    ): PromisifySuccessResult<U, GetStorageOption<T>>;
    /** [wx.getStorageInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfo.html)
*
* 在插件中使用：不支持
*
* 异步获取当前storage的相关信息。
*
* **示例代码**
*
* ```js
wx.getStorageInfo({
  success (res) {
    console.log(res.keys)
    console.log(res.currentSize)
    console.log(res.limitSize)
  }
})
```
*
* ```js
try {
  const res = wx.getStorageInfoSync()
  console.log(res.keys)
  console.log(res.currentSize)
  console.log(res.limitSize)
} catch (e) {
  // Do something when catch error
}
``` */
    getStorageInfo<T extends GetStorageInfoOption = GetStorageInfoOption>(
      option?: T
    ): PromisifySuccessResult<T, GetStorageInfoOption>;
    /** [wx.getSystemInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfo.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 获取系统信息。**由于历史原因，wx.getSystemInfo 是异步的调用格式，但是是同步返回，需要异步获取系统信息请使用 [wx.getSystemInfoAsync](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoAsync.html)。**
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/WkUCgXmS7mqO)
*
* ```js
wx.getSystemInfo({
  success (res) {
    console.log(res.model)
    console.log(res.pixelRatio)
    console.log(res.windowWidth)
    console.log(res.windowHeight)
    console.log(res.language)
    console.log(res.version)
    console.log(res.platform)
  }
})
```
*
* ```js
try {
  const res = wx.getSystemInfoSync()
  console.log(res.model)
  console.log(res.pixelRatio)
  console.log(res.windowWidth)
  console.log(res.windowHeight)
  console.log(res.language)
  console.log(res.version)
  console.log(res.platform)
} catch (e) {
  // Do something when catch error
}
``` */
    getSystemInfo<T extends GetSystemInfoOption = GetSystemInfoOption>(
      option?: T
    ): PromisifySuccessResult<T, GetSystemInfoOption>;
    /** [wx.getSystemInfoAsync(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoAsync.html)
*
* 需要基础库： `2.14.1`
*
* 在插件中使用：不支持
*
* 异步获取系统信息。需要一定的微信客户端版本支持，在不支持的客户端上，会使用同步实现来返回。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/WkUCgXmS7mqO)
*
* ```js
wx.getSystemInfoAsync({
  success (res) {
    console.log(res.model)
    console.log(res.pixelRatio)
    console.log(res.windowWidth)
    console.log(res.windowHeight)
    console.log(res.language)
    console.log(res.version)
    console.log(res.platform)
  }
})
``` */
    getSystemInfoAsync(option?: GetSystemInfoAsyncOption): void;
    /** [wx.getUserInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html)
*
* 在插件中使用：需要基础库 `2.3.1`
*
* 在插件中使用时，需要在用户信息功能页中获得用户授权或满足一定条件后调用。否则将返回 fail。详见 [用户信息功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/user-info.html)
*
* @warning **用户头像昵称获取规则已调整，参考 [用户信息接口调整说明](https://developers.weixin.qq.com/community/develop/doc/000cacfa20ce88df04cb468bc52801)、[小程序用户头像昵称获取规则调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)**
*
* 获取用户信息。
*
* **示例代码**
*
* ```js
// 必须是在用户已经授权的情况下调用
wx.getUserInfo({
  success: function(res) {
    var userInfo = res.userInfo
    var nickName = userInfo.nickName
    var avatarUrl = userInfo.avatarUrl
    var gender = userInfo.gender //性别 0：未知、1：男、2：女
    var province = userInfo.province
    var city = userInfo.city
    var country = userInfo.country
  }
})
```
*
* 敏感数据有两种获取方式：
* 1. 使用 [加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法)
* 2. 使用 [云调用直接获取开放数据](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#云调用直接获取开放数据)
* 获取得到的开放数据为以下 json 结构：
*
* ```json
{
  "openId": "OPENID",
  "nickName": "NICKNAME",
  "gender": GENDER,
  "city": "CITY",
  "province": "PROVINCE",
  "country": "COUNTRY",
  "avatarUrl": "AVATARURL",
  "unionId": "UNIONID",
  "watermark": {
    "appid":"APPID",
    "timestamp":TIMESTAMP
  }
}
```
*
* **小程序用户信息组件示例代码**
*
* ```html
* <!-- 如果只是展示用户头像昵称，可以使用 <open-data /> 组件 -->
* <open-data type="userAvatarUrl"></open-data>
* <open-data type="userNickName"></open-data>
* <!-- 需要使用 button 来授权登录 -->
* <button wx:if="{{canIUse}}" open-type="getUserInfo" bindgetuserinfo="bindGetUserInfo">授权登录</button>
* <view wx:else>请升级微信版本</view>
* ```
*
* ```js
Page({
  data: {
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  onLoad: function() {
    // 查看是否授权
    wx.getSetting({
      success (res){
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称
          wx.getUserInfo({
            success: function(res) {
              console.log(res.userInfo)
            }
          })
        }
      }
    })
  },
  bindGetUserInfo (e) {
    console.log(e.detail.userInfo)
  }
})
``` */
    getUserInfo<T extends GetUserInfoOption = GetUserInfoOption>(
      option: T
    ): PromisifySuccessResult<T, GetUserInfoOption>;
    /** [wx.getUserProfile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)
*
* 需要基础库： `2.10.4`
*
* 在插件中使用：不支持
*
* @warning **用户头像昵称获取规则已调整，参考 [小程序用户头像昵称获取规则调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)**
*
* 获取用户信息。页面产生点击事件（例如 `button` 上 `bindtap` 的回调中）后才可调用，每次请求都会弹出授权窗口，用户同意后返回 `userInfo`。该接口用于替换 `wx.getUserInfo`，详见 [用户信息接口调整说明](https://developers.weixin.qq.com/community/develop/doc/000cacfa20ce88df04cb468bc52801?highLine=login)。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/tsJaq2mP7Mp4)
*
* **Bug & Tip**
*
* 1. `tip`：仅小程序中 `wx.getUserInfo` 接口进行调整，小游戏中不受影响；
* 2. `tip`：开发者工具中仅 2.10.4 及以上版本可访问 `wx.getUserProfile` 接口，在真机上可参考示例代码进行判断，无需根据版本号或者 `canIUse` 进行条件。
* 3. `tip`：`wx.getUserProfile` 返回的加密数据中不包含 `openId` 和 `unionId` 字段。
* 4. `bug`：开发者工具中 `2.10.4`~`2.16.1` 基础库版本通过 `<button open-type="getUserInfo">` 会返回真实数据，真机上此区间会按照公告返回匿名数据。
*
* ```html
* <view class="container">
*   <view class="userinfo">
*     <block wx:if="{{!hasUserInfo}}">
*       <button wx:if="{{canIUseGetUserProfile}}" bindtap="getUserProfile"> 获取头像昵称 </button>
*       <button wx:else open-type="getUserInfo" bindgetuserinfo="getUserInfo"> 获取头像昵称 </button>
*     </block>
*     <block wx:else>
*       <image bindtap="bindViewTap" class="userinfo-avatar" src="{{userInfo.avatarUrl}}" mode="cover"></image>
*       <text class="userinfo-nickname">{{userInfo.nickName}}</text>
*     </block>
*   </view>
* </view>
* ```
*
* ```js
Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
  },
  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
  },
  getUserProfile(e) {
    // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认
    // 开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
    wx.getUserProfile({
      desc: '用于完善会员资料', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },
  getUserInfo(e) {
    // 不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
})
``` */
    getUserProfile<T extends GetUserProfileOption = GetUserProfileOption>(
      option: T
    ): PromisifySuccessResult<T, GetUserProfileOption>;
    /** [wx.getVideoInfo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.getVideoInfo.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：支持
     *
     * 获取视频详细信息。 */
    getVideoInfo<T extends GetVideoInfoOption = GetVideoInfoOption>(
      option: T
    ): PromisifySuccessResult<T, GetVideoInfoOption>;
    /** [wx.getWeRunData(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/werun/wx.getWeRunData.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：不支持
*
* 获取用户过去三十一天微信运动步数。需要先调用 [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) 接口。步数信息会在用户主动进入小程序时更新。
*
* **示例代码**
*
* ```js
wx.getWeRunData({
  success (res) {
    // 拿 encryptedData 到开发者后台解密开放数据
    const encryptedData = res.encryptedData
    // 或拿 cloudID 通过云调用直接获取开放数据
    const cloudID = res.cloudID
  }
})
```
*
* **开放数据 JSON 结构**
*
* 敏感数据有两种获取方式，一是使用 [加密数据解密算法](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html#加密数据解密算法) 。
* 获取得到的开放数据为以下 json 结构：
*
* ```json
{
  "stepInfoList": [
    {
      "timestamp": 1445866601,
      "step": 100
    },
    {
      "timestamp": 1445876601,
      "step": 120
    }
  ]
}
```
*
* stepInfoList 中，每一项结构如下：
*
* | 属性 | 类型 | 说明 |
* | --- | ---- | --- |
* | timestamp | number | 时间戳，表示数据对应的时间 |
* | step | number | 微信运动步数 | */
    getWeRunData<T extends GetWeRunDataOption = GetWeRunDataOption>(
      option?: T
    ): PromisifySuccessResult<T, GetWeRunDataOption>;
    /** [wx.getWifiList(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.getWifiList.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 请求获取 Wi-Fi 列表。`wifiList` 数据会在 [onGetWifiList](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onGetWifiList.html) 注册的回调中返回。 **Android 调用前需要 [用户授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html) scope.userLocation。**
     *
     * iOS 上将跳转到系统设置中的微信设置页，需要用户手动进入「无线局域网」设置页，并在系统扫描到设备后，小程序才能收到 onGetWifiList 回调。Android 不会跳转。
     *
     * **注意**
     *
     * 因系统问题，本方法在 iOS 11.0 及 11.1 两个版本失效。但在 iOS 11.2 中已修复。 */
    getWifiList<T extends GetWifiListOption = GetWifiListOption>(
      option?: T
    ): PromisifySuccessResult<T, GetWifiListOption>;
    /** [wx.hideHomeButton(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.hideHomeButton.html)
     *
     * 需要基础库： `2.8.3`
     *
     * 在插件中使用：不支持
     *
     * 隐藏返回首页按钮。微信7.0.7版本起，当用户打开的小程序最底层页面是非首页时，默认展示“返回首页”按钮，开发者可在页面 onShow 中调用 hideHomeButton 进行隐藏。 */
    hideHomeButton<T extends HideHomeButtonOption = HideHomeButtonOption>(
      option?: T
    ): PromisifySuccessResult<T, HideHomeButtonOption>;
    /** [wx.hideKeyboard(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.hideKeyboard.html)
*
* 需要基础库： `2.8.2`
*
* 在插件中使用：不支持
*
* 在input、textarea等focus拉起键盘之后，手动调用此接口收起键盘
*
* **示例代码**
*
* ```js
wx.hideKeyboard({
  complete: res => {
    console.log('hideKeyboard res', res)
  }
})
``` */
    hideKeyboard<T extends HideKeyboardOption = HideKeyboardOption>(
      option?: T
    ): PromisifySuccessResult<T, HideKeyboardOption>;
    /** [wx.hideLoading(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideLoading.html)
     *
     * 需要基础库： `1.1.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 隐藏 loading 提示框 */
    hideLoading<T extends HideLoadingOption = HideLoadingOption>(
      option?: T
    ): PromisifySuccessResult<T, HideLoadingOption>;
    /** [wx.hideNavigationBarLoading(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.hideNavigationBarLoading.html)
     *
     * 在插件中使用：需要基础库 `2.1.0`
     *
     * 在插件中使用时，只能在当前插件的页面中调用
     *
     * 在当前页面隐藏导航条加载动画 */
    hideNavigationBarLoading<T extends HideNavigationBarLoadingOption = HideNavigationBarLoadingOption>(
      option?: T
    ): PromisifySuccessResult<T, HideNavigationBarLoadingOption>;
    /** [wx.hideShareMenu(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.hideShareMenu.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 隐藏当前页面的转发按钮
*
* ****
*
* ## 注意事项
*  - "shareAppMessage"表示“发送给朋友”按钮，"shareTimeline"表示“分享到朋友圈”按钮
*  - 隐藏“发送给朋友”按钮时必须同时隐藏“分享到朋友圈”按钮，隐藏“分享到朋友圈”按钮时则允许不隐藏“发送给朋友”按钮
*
* **示例代码**
*
* ```js
wx.hideShareMenu({
  menus: ['shareAppMessage', 'shareTimeline']
})
``` */
    hideShareMenu<T extends HideShareMenuOption = HideShareMenuOption>(
      option?: T
    ): PromisifySuccessResult<T, HideShareMenuOption>;
    /** [wx.hideTabBar(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.hideTabBar.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：不支持
     *
     * 隐藏 tabBar */
    hideTabBar<T extends HideTabBarOption = HideTabBarOption>(option: T): PromisifySuccessResult<T, HideTabBarOption>;
    /** [wx.hideTabBarRedDot(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.hideTabBarRedDot.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：不支持
     *
     * 隐藏 tabBar 某一项的右上角的红点 */
    hideTabBarRedDot<T extends HideTabBarRedDotOption = HideTabBarRedDotOption>(
      option: T
    ): PromisifySuccessResult<T, HideTabBarRedDotOption>;
    /** [wx.hideToast(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideToast.html)
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 隐藏消息提示框 */
    hideToast<T extends HideToastOption = HideToastOption>(option?: T): PromisifySuccessResult<T, HideToastOption>;
    /** [wx.initFaceDetect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/face/wx.initFaceDetect.html)
     *
     * 需要基础库： `2.18.0`
     *
     * 在插件中使用：需要基础库 `2.21.3`
     *
     * @warning **该接口已停止维护，推荐使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 代替**
     *
     * 初始化人脸检测。本接口不再维护，请使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 接口代替。详情参考[人脸检测指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html)
     *
     * ****
     *
     * ### 特别说明
     * 若小程序人脸识别功能涉及采集、存储用户生物特征（如人脸照片或视频、身份证和手持身份证、身份证照和免冠照等），此类型服务需使用[微信原生人脸识别接口](https://developers.weixin.qq.com/community/develop/doc/000442d352c1202bd498ecb105c00d?highline=%E4%BA%BA%E8%84%B8%E6%A0%B8%E8%BA%AB)。 */
    initFaceDetect(option?: InitFaceDetectOption): void;
    /** [wx.isBluetoothDevicePaired(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.isBluetoothDevicePaired.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：需要基础库 `2.19.1`
     *
     * 查询蓝牙设备是否配对，仅安卓支持。 */
    isBluetoothDevicePaired<T extends IsBluetoothDevicePairedOption = IsBluetoothDevicePairedOption>(
      option: T
    ): PromisifySuccessResult<T, IsBluetoothDevicePairedOption>;
    /** [wx.join1v1Chat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.join1v1Chat.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：不支持
     *
     * 加入（创建）双人通话。 */
    join1v1Chat(option: Join1v1ChatOption): void;
    /** [wx.joinVoIPChat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.joinVoIPChat.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.0`
     *
     * 加入 (创建) 实时语音通话，更多信息可见 [实时语音指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/voip-chat.html)。调用前需要用户授权 `scope.record`，若房间类型为视频房间需要用户授权 `scope.camera`。 */
    joinVoIPChat<T extends JoinVoIPChatOption = JoinVoIPChatOption>(
      option: T
    ): PromisifySuccessResult<T, JoinVoIPChatOption>;
    /** [wx.loadFontFace(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 动态加载网络字体，文件地址需为下载类型。[2.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持全局生效，需在 `app.js` 中调用。
*
* 注意：
* 1. 字体文件返回的 contet-type 参考 [font](https://www.iana.org/assignments/media-types/media-types.xhtml#font)，格式不正确时会解析失败。
* 2. 字体链接必须是https（ios不支持http)
* 3. 字体链接必须是同源下的，或开启了cors支持，小程序的域名是`servicewechat.com`
* 4. 工具里提示 Faild to load font可以忽略
* 5. [2.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 以前仅在调用页面生效。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/b6Zrajm67R2x)
* ```js
wx.loadFontFace({
  family: 'Bitstream Vera Serif Bold',
  source: 'url("https://sungd.github.io/Pacifico.ttf")',
  success: console.log
})
``` */
    loadFontFace<T extends LoadFontFaceOption = LoadFontFaceOption>(
      option: T
    ): PromisifySuccessResult<T, LoadFontFaceOption>;
    /** [wx.login(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
*
* 在插件中使用：需要基础库 `2.3.1`
*
* 在插件中使用时，需要在用户信息功能页中获得用户授权或满足一定条件后调用。否则将返回 fail。详见 [用户信息功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/user-info.html)
*
* 调用接口获取登录凭证（code）。通过凭证进而换取用户登录态信息，包括用户在当前小程序的唯一标识（openid）、微信开放平台帐号下的唯一标识（unionid，若当前小程序已绑定到微信开放平台帐号）及本次登录的会话密钥（session_key）等。用户数据的加解密通讯需要依赖会话密钥完成。
*
* **示例代码**
*
* ```js
wx.login({
  success (res) {
    if (res.code) {
      //发起网络请求
      wx.request({
        url: 'https://example.com/onLogin',
        data: {
          code: res.code
        }
      })
    } else {
      console.log('登录失败！' + res.errMsg)
    }
  }
})
``` */
    login<T extends LoginOption = LoginOption>(option?: T): PromisifySuccessResult<T, LoginOption>;
    /** [wx.makeBluetoothPair(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.makeBluetoothPair.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：需要基础库 `2.12.0`
     *
     * 蓝牙配对接口，仅安卓支持。
     *
     * 通常情况下（需要指定 `pin` 码或者密码时）系统会接管配对流程，直接调用 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 即可。该接口只应当在开发者不想让用户手动输入 `pin` 码且真机验证确认可以正常生效情况下用。 */
    makeBluetoothPair<T extends MakeBluetoothPairOption = MakeBluetoothPairOption>(
      option: T
    ): PromisifySuccessResult<T, MakeBluetoothPairOption>;
    /** [wx.makePhoneCall(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/phone/wx.makePhoneCall.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 拨打电话
*
* **示例代码**
*
* ```js
wx.makePhoneCall({
  phoneNumber: '1340000' //仅为示例，并非真实的电话号码
})
``` */
    makePhoneCall<T extends MakePhoneCallOption = MakePhoneCallOption>(
      option: T
    ): PromisifySuccessResult<T, MakePhoneCallOption>;
    /** [wx.navigateBack(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html)
     *
     * 在插件中使用：需要基础库 `2.1.0`
     *
     * 在插件中使用时，只能在当前插件的页面中调用
     *
     * 关闭当前页面，返回上一页面或多级页面。可通过 [getCurrentPages](https://developers.weixin.qq.com/miniprogram/dev/reference/api/getCurrentPages.html) 获取当前的页面栈，决定需要返回几层。 */
    navigateBack<T extends NavigateBackOption = NavigateBackOption>(
      option?: T
    ): PromisifySuccessResult<T, NavigateBackOption>;
    /** [wx.navigateBackMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateBackMiniProgram.html)
*
* 需要基础库： `1.3.0`
*
* 在插件中使用：不支持
*
* 返回到上一个小程序。只有在当前小程序是被其他小程序打开时可以调用成功
*
* 注意：**微信客户端 iOS 6.5.9，Android 6.5.10 及以上版本支持**
*
* **示例代码**
*
* ```js
wx.navigateBackMiniProgram({
  extraData: {
    foo: 'bar'
  },
  success(res) {
    // 返回成功
  }
})
``` */
    navigateBackMiniProgram<T extends NavigateBackMiniProgramOption = NavigateBackMiniProgramOption>(
      option: T
    ): PromisifySuccessResult<T, NavigateBackMiniProgramOption>;
    /** [wx.navigateTo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html)
*
* 在插件中使用：需要基础库 `2.2.2`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 保留当前页面，跳转到应用内的某个页面。但是不能跳到 tabbar 页面。使用 [wx.navigateBack](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html) 可以返回到原页面。小程序中页面栈最多十层。
*
* **示例代码**
*
* ```js
wx.navigateTo({
  url: 'test?id=1',
  events: {
    // 为指定事件添加一个监听器，获取被打开页面传送到当前页面的数据
    acceptDataFromOpenedPage: function(data) {
      console.log(data)
    },
    someEvent: function(data) {
      console.log(data)
    }
    ...
  },
  success: function(res) {
    // 通过eventChannel向被打开页面传送数据
    res.eventChannel.emit('acceptDataFromOpenerPage', { data: 'test' })
  }
})
```
*
* ```javascript
//test.js
Page({
  onLoad: function(option){
    console.log(option.query)
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.emit('acceptDataFromOpenedPage', {data: 'test'});
    eventChannel.emit('someEvent', {data: 'test'});
    // 监听acceptDataFromOpenerPage事件，获取上一页面通过eventChannel传送到当前页面的数据
    eventChannel.on('acceptDataFromOpenerPage', function(data) {
      console.log(data)
    })
  }
})
``` */
    navigateTo<T extends NavigateToOption = NavigateToOption>(option: T): PromisifySuccessResult<T, NavigateToOption>;
    /** [wx.navigateToMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateToMiniProgram.html)
*
* 需要基础库： `1.3.0`
*
* 在插件中使用：需要基础库 `2.18.1`
*
* 打开另一个小程序
*
* **使用限制**
*
*  ##### 需要用户触发跳转
*  从 2.3.0 版本开始，若用户未点击小程序页面任意位置，则开发者将无法调用此接口自动跳转至其他小程序。
*  ##### 需要用户确认跳转
*  从 2.3.0 版本开始，在跳转至其他小程序前，将统一增加弹窗，询问是否跳转，用户确认后才可以跳转其他小程序。如果用户点击取消，则回调 `fail cancel`。
*  ##### 无需声明跳转名单，不限跳转数量（众测中）
* 1. 从2020年4月24日起，使用跳转其他小程序功能将无需在全局配置中声明跳转名单，调用此接口时将不再校验所跳转的 AppID 是否在 navigateToMiniProgramAppIdList 中。
* 2. 从2020年4月24日起，跳转其他小程序将不再受数量限制，使用此功能时请注意遵守运营规范。
*
* **运营规范**
*
* 平台将坚决打击小程序盒子等互推行为，使用此功能时请严格遵守[《微信小程序平台运营规范》](https://developers.weixin.qq.com/miniprogram/product/#_5-10-%E4%BA%92%E6%8E%A8%E8%A1%8C%E4%B8%BA)，若发现小程序违反运营规范将被下架处理。
*
* **关于调试**
*
* - 在开发者工具上调用此 API 并不会真实的跳转到另外的小程序，但是开发者工具会校验本次调用跳转是否成功。[详情](https://developers.weixin.qq.com/miniprogram/dev/devtools/different.html#跳转小程序调试支持)
* - 开发者工具上支持被跳转的小程序处理接收参数的调试。[详情](https://developers.weixin.qq.com/miniprogram/dev/devtools/different.html#跳转小程序调试支持)
*
* **示例代码**
*
* ```js
wx.navigateToMiniProgram({
  appId: '',
  path: 'page/index/index?id=123',
  extraData: {
    foo: 'bar'
  },
  envVersion: 'develop',
  success(res) {
    // 打开成功
  }
})
``` */
    navigateToMiniProgram<T extends NavigateToMiniProgramOption = NavigateToMiniProgramOption>(
      option: T
    ): PromisifySuccessResult<T, NavigateToMiniProgramOption>;
    /** [wx.nextTick(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/custom-component/wx.nextTick.html)
*
* 需要基础库： `2.2.3`
*
* 在插件中使用：需要基础库 `2.7.1`
*
* 延迟一部分操作到下一个时间片再执行。（类似于 setTimeout）
*
* **说明**
*
* 因为自定义组件中的 setData 和 triggerEvent 等接口本身是同步的操作，当这几个接口被连续调用时，都是在一个同步流程中执行完的，因此若逻辑不当可能会导致出错。
*
* 一个极端的案例：当父组件的 setData 引发了子组件的 triggerEvent，进而使得父组件又进行了一次 setData，期间有通过 wx:if 语句对子组件进行卸载，就有可能引发奇怪的错误，所以对于不需要在一个同步流程内完成的逻辑，可以使用此接口延迟到下一个时间片再执行。
*
* **示例代码**
*
* ```js
Component({
  doSth() {
    this.setData({ number: 1 }) // 直接在当前同步流程中执行

    wx.nextTick(() => {
      this.setData({ number: 3 }) // 在当前同步流程结束后，下一个时间片执行
    })

    this.setData({ number: 2 }) // 直接在当前同步流程中执行
  }
})
``` */
    nextTick(callback: (...args: any[]) => any): void;
    /** [wx.notifyBLECharacteristicValueChange(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 启用蓝牙低功耗设备特征值变化时的 notify 功能，订阅特征。注意：必须设备的特征支持 notify 或者 indicate 才可以成功调用。
*
* 另外，必须先启用 [wx.notifyBLECharacteristicValueChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html) 才能监听到设备 `characteristicValueChange` 事件
*
* **注意**
*
* - 订阅操作成功后需要设备主动更新特征的 value，才会触发 [wx.onBLECharacteristicValueChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLECharacteristicValueChange.html) 回调。
* - 安卓平台上，在本接口调用成功后立即调用 [wx.writeBLECharacteristicValue](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.writeBLECharacteristicValue.html) 接口，在部分机型上会发生 10008 系统错误
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.notifyBLECharacteristicValueChange({
  state: true, // 启用 notify 功能
  // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
  deviceId,
  // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
  serviceId,
  // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
  characteristicId,
  success (res) {
    console.log('notifyBLECharacteristicValueChange success', res.errMsg)
  }
})
``` */
    notifyBLECharacteristicValueChange<
      T extends NotifyBLECharacteristicValueChangeOption = NotifyBLECharacteristicValueChangeOption
    >(
      option: T
    ): PromisifySuccessResult<T, NotifyBLECharacteristicValueChangeOption>;
    /** [wx.offAccelerometerChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.offAccelerometerChange.html)
*
* 需要基础库： `2.9.3`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除加速度数据事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onAccelerometerChange(listener)
wx.offAccelerometerChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offAccelerometerChange(
      /** onAccelerometerChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffAccelerometerChangeCallback
    ): void;
    /** [wx.offAppHide(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAppHide.html)
*
* 需要基础库： `2.1.2`
*
* 在插件中使用：不支持
*
* 移除小程序切后台事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onAppHide(listener)
wx.offAppHide(listener) // 需传入与监听时同一个的函数对象
``` */
    offAppHide(
      /** onAppHide 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffAppHideCallback
    ): void;
    /** [wx.offAppShow(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAppShow.html)
*
* 需要基础库： `2.1.2`
*
* 在插件中使用：不支持
*
* 移除小程序切前台事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onAppShow(listener)
wx.offAppShow(listener) // 需传入与监听时同一个的函数对象
``` */
    offAppShow(
      /** onAppShow 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffAppShowCallback
    ): void;
    /** [wx.offAudioInterruptionBegin(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAudioInterruptionBegin.html)
*
* 需要基础库： `2.6.2`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除音频因为受到系统占用而被中断开始事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onAudioInterruptionBegin(listener)
wx.offAudioInterruptionBegin(listener) // 需传入与监听时同一个的函数对象
``` */
    offAudioInterruptionBegin(
      /** onAudioInterruptionBegin 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffAudioInterruptionBeginCallback
    ): void;
    /** [wx.offAudioInterruptionEnd(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offAudioInterruptionEnd.html)
*
* 需要基础库： `2.6.2`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除音频中断结束事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onAudioInterruptionEnd(listener)
wx.offAudioInterruptionEnd(listener) // 需传入与监听时同一个的函数对象
``` */
    offAudioInterruptionEnd(
      /** onAudioInterruptionEnd 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffAudioInterruptionEndCallback
    ): void;
    /** [wx.offBLECharacteristicValueChange()](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLECharacteristicValueChange.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除蓝牙低功耗设备的特征值变化事件的全部监听函数
*
* **示例代码**
*
* ```js
wx.offBLECharacteristicValueChange()
``` */
    offBLECharacteristicValueChange(): void;
    /** [wx.offBLEConnectionStateChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLEConnectionStateChange.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除蓝牙低功耗连接状态改变事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onBLEConnectionStateChange(listener)
wx.offBLEConnectionStateChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offBLEConnectionStateChange(
      /** onBLEConnectionStateChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffBLEConnectionStateChangeCallback
    ): void;
    /** [wx.offBLEMTUChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.offBLEMTUChange.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.20.1`
*
* 移除蓝牙低功耗的最大传输单元变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onBLEMTUChange(listener)
wx.offBLEMTUChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offBLEMTUChange(
      /** onBLEMTUChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffBLEMTUChangeCallback
    ): void;
    /** [wx.offBLEPeripheralConnectionStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.offBLEPeripheralConnectionStateChanged.html)
*
* 需要基础库： `2.10.3`
*
* 在插件中使用：需要基础库 `2.22.1`
*
* 移除当前外围设备被连接或断开连接事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onBLEPeripheralConnectionStateChanged(listener)
wx.offBLEPeripheralConnectionStateChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offBLEPeripheralConnectionStateChanged(
      /** onBLEPeripheralConnectionStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffBLEPeripheralConnectionStateChangedCallback
    ): void;
    /** [wx.offBeaconServiceChange()](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.offBeaconServiceChange.html)
*
* 需要基础库： `2.8.1`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除 Beacon 服务状态变化事件的全部监听函数
*
* **示例代码**
*
* ```js
wx.offBeaconServiceChange()
``` */
    offBeaconServiceChange(): void;
    /** [wx.offBeaconUpdate()](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.offBeaconUpdate.html)
*
* 需要基础库： `2.8.1`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除 Beacon 设备更新事件的全部监听函数
*
* **示例代码**
*
* ```js
wx.offBeaconUpdate()
``` */
    offBeaconUpdate(): void;
    /** [wx.offBluetoothAdapterStateChange()](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.offBluetoothAdapterStateChange.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除蓝牙适配器状态变化事件的全部监听函数
*
* **示例代码**
*
* ```js
wx.offBluetoothAdapterStateChange()
``` */
    offBluetoothAdapterStateChange(): void;
    /** [wx.offBluetoothDeviceFound()](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.offBluetoothDeviceFound.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除搜索到新设备的事件的全部监听函数
*
* **示例代码**
*
* ```js
wx.offBluetoothDeviceFound()
``` */
    offBluetoothDeviceFound(): void;
    /** [wx.offCompassChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.offCompassChange.html)
*
* 需要基础库： `2.9.3`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除罗盘数据变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onCompassChange(listener)
wx.offCompassChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offCompassChange(
      /** onCompassChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffCompassChangeCallback
    ): void;
    /** [wx.offCopyUrl()](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.offCopyUrl.html)
     *
     * 需要基础库： `2.14.3`
     *
     * 在插件中使用：不支持
     *
     * 移除用户点击右上角菜单的「复制链接」按钮时触发的事件的全部监听函数 */
    offCopyUrl(): void;
    /** [wx.offDeviceMotionChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.offDeviceMotionChange.html)
*
* 需要基础库： `2.9.3`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除设备方向变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onDeviceMotionChange(listener)
wx.offDeviceMotionChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offDeviceMotionChange(
      /** onDeviceMotionChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffDeviceMotionChangeCallback
    ): void;
    /** [wx.offError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offError.html)
*
* 需要基础库： `2.1.2`
*
* 在插件中使用：不支持
*
* 移除小程序错误事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onError(listener)
wx.offError(listener) // 需传入与监听时同一个的函数对象
``` */
    offError(
      /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: WxOffErrorCallback
    ): void;
    /** [wx.offGetWifiList(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offGetWifiList.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除获取到 Wi-Fi 列表数据事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onGetWifiList(listener)
wx.offGetWifiList(listener) // 需传入与监听时同一个的函数对象
``` */
    offGetWifiList(
      /** onGetWifiList 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffGetWifiListCallback
    ): void;
    /** [wx.offGyroscopeChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.offGyroscopeChange.html)
*
* 需要基础库： `2.9.3`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除陀螺仪数据变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onGyroscopeChange(listener)
wx.offGyroscopeChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offGyroscopeChange(
      /** onGyroscopeChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffGyroscopeChangeCallback
    ): void;
    /** [wx.offHCEMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.offHCEMessage.html)
*
* 需要基础库： `2.8.1`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除接收 NFC 设备消息事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onHCEMessage(listener)
wx.offHCEMessage(listener) // 需传入与监听时同一个的函数对象
``` */
    offHCEMessage(
      /** onHCEMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffHCEMessageCallback
    ): void;
    /** [wx.offKeyboardHeightChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.offKeyboardHeightChange.html)
*
* 需要基础库： `2.9.2`
*
* 在插件中使用：不支持
*
* 移除键盘高度变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onKeyboardHeightChange(listener)
wx.offKeyboardHeightChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offKeyboardHeightChange(
      /** onKeyboardHeightChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffKeyboardHeightChangeCallback
    ): void;
    /** [wx.offLazyLoadError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offLazyLoadError.html)
*
* 需要基础库： `2.24.3`
*
* 在插件中使用：不支持
*
* 移除小程序异步组件加载失败事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLazyLoadError(listener)
wx.offLazyLoadError(listener) // 需传入与监听时同一个的函数对象
``` */
    offLazyLoadError(
      /** onLazyLoadError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLazyLoadErrorCallback
    ): void;
    /** [wx.offLocalServiceDiscoveryStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceDiscoveryStop.html)
*
* 需要基础库： `2.4.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除 mDNS 服务停止搜索的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocalServiceDiscoveryStop(listener)
wx.offLocalServiceDiscoveryStop(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocalServiceDiscoveryStop(
      /** onLocalServiceDiscoveryStop 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocalServiceDiscoveryStopCallback
    ): void;
    /** [wx.offLocalServiceFound(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceFound.html)
*
* 需要基础库： `2.4.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除 mDNS 服务发现的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocalServiceFound(listener)
wx.offLocalServiceFound(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocalServiceFound(
      /** onLocalServiceFound 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocalServiceFoundCallback
    ): void;
    /** [wx.offLocalServiceLost(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceLost.html)
*
* 需要基础库： `2.4.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除 mDNS 服务离开的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocalServiceLost(listener)
wx.offLocalServiceLost(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocalServiceLost(
      /** onLocalServiceLost 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocalServiceLostCallback
    ): void;
    /** [wx.offLocalServiceResolveFail(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.offLocalServiceResolveFail.html)
*
* 需要基础库： `2.4.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 移除 mDNS 服务解析失败的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocalServiceResolveFail(listener)
wx.offLocalServiceResolveFail(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocalServiceResolveFail(
      /** onLocalServiceResolveFail 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocalServiceResolveFailCallback
    ): void;
    /** [wx.offLocationChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.offLocationChange.html)
*
* 需要基础库： `2.8.1`
*
* 在插件中使用：不支持
*
* 移除实时地理位置变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocationChange(listener)
wx.offLocationChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocationChange(
      /** onLocationChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocationChangeCallback
    ): void;
    /** [wx.offLocationChangeError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.offLocationChangeError.html)
*
* 需要基础库： `2.19.5`
*
* 在插件中使用：不支持
*
* 移除持续定位接口返回失败时触发。的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onLocationChangeError(listener)
wx.offLocationChangeError(listener) // 需传入与监听时同一个的函数对象
``` */
    offLocationChangeError(
      /** onLocationChangeError 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffLocationChangeErrorCallback
    ): void;
    /** [wx.offMemoryWarning(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/memory/wx.offMemoryWarning.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：不支持
*
* 移除内存不足告警事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onMemoryWarning(listener)
wx.offMemoryWarning(listener) // 需传入与监听时同一个的函数对象
``` */
    offMemoryWarning(
      /** onMemoryWarning 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffMemoryWarningCallback
    ): void;
    /** [wx.offNetworkStatusChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.offNetworkStatusChange.html)
*
* 需要基础库： `2.9.3`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除网络状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onNetworkStatusChange(listener)
wx.offNetworkStatusChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offNetworkStatusChange(
      /** onNetworkStatusChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffNetworkStatusChangeCallback
    ): void;
    /** [wx.offNetworkWeakChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.offNetworkWeakChange.html)
*
* 需要基础库： `2.21.0`
*
* 在插件中使用：不支持
*
* 移除弱网状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onNetworkWeakChange(listener)
wx.offNetworkWeakChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offNetworkWeakChange(
      /** onNetworkWeakChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffNetworkWeakChangeCallback
    ): void;
    /** [wx.offPageNotFound(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offPageNotFound.html)
*
* 需要基础库： `2.1.2`
*
* 在插件中使用：不支持
*
* 移除小程序要打开的页面不存在事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onPageNotFound(listener)
wx.offPageNotFound(listener) // 需传入与监听时同一个的函数对象
``` */
    offPageNotFound(
      /** onPageNotFound 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffPageNotFoundCallback
    ): void;
    /** [wx.offScreenRecordingStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.offScreenRecordingStateChanged.html)
*
* 需要基础库： `2.24.0`
*
* 在插件中使用：不支持
*
* 移除用户录屏事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onScreenRecordingStateChanged(listener)
wx.offScreenRecordingStateChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offScreenRecordingStateChanged(
      /** onScreenRecordingStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffScreenRecordingStateChangedCallback
    ): void;
    /** [wx.offThemeChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offThemeChange.html)
*
* 需要基础库： `2.11.0`
*
* 在插件中使用：不支持
*
* 移除系统主题改变事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onThemeChange(listener)
wx.offThemeChange(listener) // 需传入与监听时同一个的函数对象
``` */
    offThemeChange(
      /** onThemeChange 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffThemeChangeCallback
    ): void;
    /** [wx.offUnhandledRejection(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.offUnhandledRejection.html)
*
* 需要基础库： `2.10.0`
*
* 在插件中使用：不支持
*
* 移除未处理的 Promise 拒绝事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onUnhandledRejection(listener)
wx.offUnhandledRejection(listener) // 需传入与监听时同一个的函数对象
``` */
    offUnhandledRejection(
      /** onUnhandledRejection 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffUnhandledRejectionCallback
    ): void;
    /** [wx.offUserCaptureScreen(function callback)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.offUserCaptureScreen.html)
     *
     * 需要基础库： `2.9.3`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 在插件中使用时，只能在当前插件的页面中调用
     *
     * 用户主动截屏事件。取消事件监听。 */
    offUserCaptureScreen(
      /** 用户主动截屏事件的回调函数 */
      callback?: (...args: any[]) => any
    ): void;
    /** [wx.offVoIPChatInterrupted(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatInterrupted.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除被动断开实时语音通话事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onVoIPChatInterrupted(listener)
wx.offVoIPChatInterrupted(listener) // 需传入与监听时同一个的函数对象
``` */
    offVoIPChatInterrupted(
      /** onVoIPChatInterrupted 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffVoIPChatInterruptedCallback
    ): void;
    /** [wx.offVoIPChatMembersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatMembersChanged.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除实时语音通话成员在线状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onVoIPChatMembersChanged(listener)
wx.offVoIPChatMembersChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offVoIPChatMembersChanged(
      /** onVoIPChatMembersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffVoIPChatMembersChangedCallback
    ): void;
    /** [wx.offVoIPChatSpeakersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatSpeakersChanged.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除实时语音通话成员通话状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onVoIPChatSpeakersChanged(listener)
wx.offVoIPChatSpeakersChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offVoIPChatSpeakersChanged(
      /** onVoIPChatSpeakersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffVoIPChatSpeakersChangedCallback
    ): void;
    /** [wx.offVoIPChatStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPChatStateChanged.html)
*
* 需要基础库： `2.16.0`
*
* 在插件中使用：不支持
*
* 移除房间状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onVoIPChatStateChanged(listener)
wx.offVoIPChatStateChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offVoIPChatStateChanged(
      /** onVoIPChatStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffVoIPChatStateChangedCallback
    ): void;
    /** [wx.offVoIPVideoMembersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.offVoIPVideoMembersChanged.html)
*
* 需要基础库： `2.11.0`
*
* 在插件中使用：不支持
*
* 移除实时语音通话成员视频状态变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onVoIPVideoMembersChanged(listener)
wx.offVoIPVideoMembersChanged(listener) // 需传入与监听时同一个的函数对象
``` */
    offVoIPVideoMembersChanged(
      /** onVoIPVideoMembersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffVoIPVideoMembersChangedCallback
    ): void;
    /** [wx.offWifiConnected(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offWifiConnected.html)
*
* 需要基础库： `2.9.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 移除连接上 Wi-Fi 的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onWifiConnected(listener)
wx.offWifiConnected(listener) // 需传入与监听时同一个的函数对象
``` */
    offWifiConnected(
      /** onWifiConnected 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffWifiConnectedCallback
    ): void;
    /** [wx.offWifiConnectedWithPartialInfo(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.offWifiConnectedWithPartialInfo.html)
*
* 需要基础库： `2.22.0`
*
* 在插件中使用：需要基础库 `2.22.1`
*
* 移除连接上 Wi-Fi 的事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onWifiConnectedWithPartialInfo(listener)
wx.offWifiConnectedWithPartialInfo(listener) // 需传入与监听时同一个的函数对象
``` */
    offWifiConnectedWithPartialInfo(
      /** onWifiConnectedWithPartialInfo 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffWifiConnectedWithPartialInfoCallback
    ): void;
    /** [wx.offWindowResize(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.offWindowResize.html)
*
* 需要基础库： `2.3.0`
*
* 在插件中使用：不支持
*
* 移除窗口尺寸变化事件的监听函数
*
* **示例代码**
*
* ```js
const listener = function (res) { console.log(res) }

wx.onWindowResize(listener)
wx.offWindowResize(listener) // 需传入与监听时同一个的函数对象
``` */
    offWindowResize(
      /** onWindowResize 传入的监听函数。不传此参数则移除所有监听函数。 */
      listener?: OffWindowResizeCallback
    ): void;
    /** [wx.onAccelerometerChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.onAccelerometerChange.html)
*
* 在插件中使用：不支持
*
* 监听加速度数据事件。频率根据 [wx.startAccelerometer()](https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.startAccelerometer.html) 的 interval 参数, 接口调用后会自动开始监听。
*
* **示例代码**
*
* ```js
wx.onAccelerometerChange(callback)
``` */
    onAccelerometerChange(
      /** 加速度数据事件的监听函数 */
      listener: OnAccelerometerChangeCallback
    ): void;
    /** [wx.onAppHide(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppHide.html)
     *
     * 需要基础库： `2.1.2`
     *
     * 在插件中使用：不支持
     *
     * 监听小程序切后台事件。该事件与 [`App.onHide`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onhide) 的回调时机一致。 */
    onAppHide(
      /** 小程序切后台事件的监听函数 */
      listener: OnAppHideCallback
    ): void;
    /** [wx.onAppShow(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppShow.html)
     *
     * 需要基础库： `2.1.2`
     *
     * 在插件中使用：不支持
     *
     * 监听小程序切前台事件。该事件与 [`App.onShow`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onshowobject-object) 的回调参数一致。
     *
     * **返回有效 referrerInfo 的场景**
     *
     * | 场景值 | 场景                            | appId含义  |
     * | ------ | ------------------------------- | ---------- |
     * | 1020   | 公众号 profile 页相关小程序列表 | 来源公众号 |
     * | 1035   | 公众号自定义菜单                | 来源公众号 |
     * | 1036   | App 分享消息卡片                | 来源App    |
     * | 1037   | 小程序打开小程序                | 来源小程序 |
     * | 1038   | 从另一个小程序返回              | 来源小程序 |
     * | 1043   | 公众号模板消息                  | 来源公众号 |
     *
     * **不同 apiCategory 场景下的 API 限制**
     *
     * `X` 表示 API 被限制无法使用；不在表格中的 API 不限制。
     *
     * |                                       | default | nativeFunctionalized | browseOnly | embedded |
     * |-|-|-|-|-|
     * |navigateToMiniProgram                  |         | `X`                  | `X`        |          |
     * |openSetting                            |         |                      | `X`        |          |
     * |&lt;button open-type="share"&gt;       |         | `X`                  | `X`        | `X`      |
     * |&lt;button open-type="feedback"&gt;    |         |                      | `X`        |          |
     * |&lt;button open-type="open-setting"&gt;|         |                      | `X`        |          |
     * |openEmbeddedMiniProgram                |         | `X`                  | `X`        | `X`      |
     *
     * **注意**
     *
     * 部分版本在无`referrerInfo`的时候会返回 `undefined`，建议使用 `options.referrerInfo && options.referrerInfo.appId` 进行判断。 */
    onAppShow(
      /** 小程序切前台事件的监听函数 */
      listener: OnAppShowCallback
    ): void;
    /** [wx.onAudioInterruptionBegin(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionBegin.html)
     *
     * 需要基础库： `2.6.2`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听音频因为受到系统占用而被中断开始事件。以下场景会触发此事件：闹钟、电话、FaceTime 通话、微信语音聊天、微信视频聊天、有声广告开始播放、实名认证页面弹出等。此事件触发后，小程序内所有音频会暂停。 */
    onAudioInterruptionBegin(
      /** 音频因为受到系统占用而被中断开始事件的监听函数 */
      listener: OnAudioInterruptionBeginCallback
    ): void;
    /** [wx.onAudioInterruptionEnd(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAudioInterruptionEnd.html)
     *
     * 需要基础库： `2.6.2`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听音频中断结束事件。在收到 onAudioInterruptionBegin 事件之后，小程序内所有音频会暂停，收到此事件之后才可再次播放成功 */
    onAudioInterruptionEnd(
      /** 音频中断结束事件的监听函数 */
      listener: OnAudioInterruptionEndCallback
    ): void;
    /** [wx.onBLECharacteristicValueChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLECharacteristicValueChange.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 监听蓝牙低功耗设备的特征值变化事件。必须先调用 [wx.notifyBLECharacteristicValueChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html) 接口才能接收到设备推送的 notification。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
*
* ```js
// ArrayBuffer转16进制字符串示例
function ab2hex(buffer) {
  let hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function(bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}
wx.onBLECharacteristicValueChange(function(res) {
  console.log(`characteristic ${res.characteristicId} has changed, now is ${res.value}`)
  console.log(ab2hex(res.value))
})
``` */
    onBLECharacteristicValueChange(
      /** 蓝牙低功耗设备的特征值变化事件的监听函数 */
      listener: OnBLECharacteristicValueChangeCallback
    ): void;
    /** [wx.onBLEConnectionStateChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEConnectionStateChange.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 监听蓝牙低功耗连接状态改变事件。包括开发者主动连接或断开连接，设备丢失，连接异常断开等等
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.onBLEConnectionStateChange(function(res) {
  // 该方法回调中可以用于处理连接意外断开等异常情况
  console.log(`device ${res.deviceId} state has changed, connected: ${res.connected}`)
})
``` */
    onBLEConnectionStateChange(
      /** 蓝牙低功耗连接状态改变事件的监听函数 */
      listener: OnBLEConnectionStateChangeCallback
    ): void;
    /** [wx.onBLEMTUChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLEMTUChange.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.20.1`
*
* 监听蓝牙低功耗的最大传输单元变化事件（仅安卓触发）。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.onBLEMTUChange(function (res) {
  console.log('bluetooth mtu is', res.mtu)
})
``` */
    onBLEMTUChange(
      /** 蓝牙低功耗的最大传输单元变化事件的监听函数 */
      listener: OnBLEMTUChangeCallback
    ): void;
    /** [wx.onBLEPeripheralConnectionStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-peripheral/wx.onBLEPeripheralConnectionStateChanged.html)
     *
     * 需要基础库： `2.10.3`
     *
     * 在插件中使用：需要基础库 `2.22.1`
     *
     * 监听当前外围设备被连接或断开连接事件 */
    onBLEPeripheralConnectionStateChanged(
      /** 当前外围设备被连接或断开连接事件的监听函数 */
      listener: OnBLEPeripheralConnectionStateChangedCallback
    ): void;
    /** [wx.onBackgroundAudioPause(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioPause.html)
     *
     * 在插件中使用：不支持
     * @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
     *
     * 监听音乐暂停事件。 */
    onBackgroundAudioPause(
      /** 音乐暂停事件的监听函数 */
      listener: OnBackgroundAudioPauseCallback
    ): void;
    /** [wx.onBackgroundAudioPlay(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioPlay.html)
     *
     * 在插件中使用：不支持
     * @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
     *
     * 监听音乐播放事件。 */
    onBackgroundAudioPlay(
      /** 音乐播放事件的监听函数 */
      listener: OnBackgroundAudioPlayCallback
    ): void;
    /** [wx.onBackgroundAudioStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.onBackgroundAudioStop.html)
     *
     * 在插件中使用：不支持
     * @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
     *
     * 监听音乐停止事件。 */
    onBackgroundAudioStop(
      /** 音乐停止事件的监听函数 */
      listener: OnBackgroundAudioStopCallback
    ): void;
    /** [wx.onBackgroundFetchData(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.onBackgroundFetchData.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 监听收到 backgroundFetch 数据事件。如果监听时请求已经完成，则事件不会触发。建议和 [wx.getBackgroundFetchData](https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.getBackgroundFetchData.html) 配合使用 */
    onBackgroundFetchData(
      /** 收到 backgroundFetch 数据事件的监听函数 */
      listener: OnBackgroundFetchDataCallback
    ): void;
    /** [wx.onBeaconServiceChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.onBeaconServiceChange.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 监听 Beacon 服务状态变化事件，仅能注册一个监听
*
* **示例代码**
*
* ```js
wx.onBeaconServiceChange(res => {
   console.log(res.available, res.discovering)
})
``` */
    onBeaconServiceChange(
      /** Beacon 服务状态变化事件的监听函数 */
      listener: OnBeaconServiceChangeCallback
    ): void;
    /** [wx.onBeaconUpdate(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.onBeaconUpdate.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 监听 Beacon 设备更新事件，仅能注册一个监听
*
* **示例代码**
*
* ```js
wx.onBeaconUpdate(res => {
   console.log(res.beacons)
})
``` */
    onBeaconUpdate(
      /** Beacon 设备更新事件的监听函数 */
      listener: OnBeaconUpdateCallback
    ): void;
    /** [wx.onBluetoothAdapterStateChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothAdapterStateChange.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 监听蓝牙适配器状态变化事件
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.onBluetoothAdapterStateChange(function (res) {
  console.log('adapterState changed, now is', res)
})
``` */
    onBluetoothAdapterStateChange(
      /** 蓝牙适配器状态变化事件的监听函数 */
      listener: OnBluetoothAdapterStateChangeCallback
    ): void;
    /** [wx.onBluetoothDeviceFound(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothDeviceFound.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 监听搜索到新设备的事件
*
* **注意**
*
* - 若在 [wx.onBluetoothDeviceFound](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothDeviceFound.html) 回调了某个设备，则此设备会添加到 [wx.getBluetoothDevices](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.getBluetoothDevices.html) 接口获取到的数组中。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
*
* ```js
// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function(bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}
wx.onBluetoothDeviceFound(function(res) {
  var devices = res.devices;
  console.log('new device list has founded')
  console.dir(devices)
  console.log(ab2hex(devices[0].advertisData))
})
```
*
* **注意**
*
* - 蓝牙设备在被搜索到时，系统返回的 `name` 字段一般为广播包中的 `LocalName` 字段中的设备名称，而如果与蓝牙设备建立连接，系统返回的 `name` 字段会改为从蓝牙设备上获取到的 `GattName`。若需要动态改变设备名称并展示，建议使用 `localName` 字段。
* - 安卓下部分机型需要有位置权限才能搜索到设备，需留意是否开启了位置权限 */
    onBluetoothDeviceFound(
      /** 搜索到新设备的事件的监听函数 */
      listener: OnBluetoothDeviceFoundCallback
    ): void;
    /** [wx.onCompassChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.onCompassChange.html)
     *
     * 在插件中使用：不支持
     *
     * 监听罗盘数据变化事件。频率：5 次/秒，接口调用后会自动开始监听，可使用 wx.stopCompass 停止监听。
     *
     * **accuracy 在 iOS/Android 的差异**
     *
     * 由于平台差异，accuracy 在 iOS/Android 的值不同。
     *
     * - iOS：accuracy 是一个 number 类型的值，表示相对于磁北极的偏差。0 表示设备指向磁北，90 表示指向东，180 表示指向南，依此类推。
     * - Android：accuracy 是一个 string 类型的枚举值。
     *
     * | 值              | 说明                                                                                   |
     * | --------------- | -------------------------------------------------------------------------------------- |
     * | high            | 高精度                                                                                 |
     * | medium          | 中等精度                                                                               |
     * | low             | 低精度                                                                                 |
     * | no-contact      | 不可信，传感器失去连接                                                                 |
     * | unreliable      | 不可信，原因未知                                                                       |
     * | unknow ${value} | 未知的精度枚举值，即该 Android 系统此时返回的表示精度的 value 不是一个标准的精度枚举值 | */
    onCompassChange(
      /** 罗盘数据变化事件的监听函数 */
      listener: OnCompassChangeCallback
    ): void;
    /** [wx.onCopyUrl(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.onCopyUrl.html)
     *
     * 需要基础库： `2.14.3`
     *
     * 在插件中使用：不支持
     *
     * 监听用户点击右上角菜单的「复制链接」按钮时触发的事件。本接口为 Beta 版本，暂只在 Android 平台支持。 */
    onCopyUrl(
      /** 用户点击右上角菜单的「复制链接」按钮时触发的事件的监听函数 */
      listener: OnCopyUrlCallback
    ): void;
    /** [wx.onDeviceMotionChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.onDeviceMotionChange.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：不支持
     *
     * 监听设备方向变化事件。频率根据 [wx.startDeviceMotionListening()](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.startDeviceMotionListening.html) 的 interval 参数。可以使用 [wx.stopDeviceMotionListening()](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.stopDeviceMotionListening.html) 停止监听。 */
    onDeviceMotionChange(
      /** 设备方向变化事件的监听函数 */
      listener: OnDeviceMotionChangeCallback
    ): void;
    /** [wx.onError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onError.html)
     *
     * 需要基础库： `2.1.2`
     *
     * 在插件中使用：不支持
     *
     * 监听小程序错误事件。如脚本错误或 API 调用报错等。该事件与 [`App.onError`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onerrorstring-error) 的回调时机与参数一致。 */
    onError(
      /** 小程序错误事件的监听函数 */
      listener: WxOnErrorCallback
    ): void;
    /** [wx.onGetWifiList(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onGetWifiList.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听获取到 Wi-Fi 列表数据事件 */
    onGetWifiList(
      /** 获取到 Wi-Fi 列表数据事件的监听函数 */
      listener: OnGetWifiListCallback
    ): void;
    /** [wx.onGyroscopeChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.onGyroscopeChange.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听陀螺仪数据变化事件。频率根据 [wx.startGyroscope()](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.startGyroscope.html) 的 interval 参数。可以使用 [wx.stopGyroscope()](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.stopGyroscope.html) 停止监听。 */
    onGyroscopeChange(
      /** 陀螺仪数据变化事件的监听函数 */
      listener: OnGyroscopeChangeCallback
    ): void;
    /** [wx.onHCEMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.onHCEMessage.html)
     *
     * 需要基础库： `1.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听接收 NFC 设备消息事件。仅能注册一个监听 */
    onHCEMessage(
      /** 接收 NFC 设备消息事件的监听函数 */
      listener: OnHCEMessageCallback
    ): void;
    /** [wx.onKeyboardHeightChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/keyboard/wx.onKeyboardHeightChange.html)
*
* 需要基础库： `2.7.0`
*
* 在插件中使用：不支持
*
* 监听键盘高度变化事件
*
* **示例代码**
*
* ```js
wx.onKeyboardHeightChange(res => {
  console.log(res.height)
})
``` */
    onKeyboardHeightChange(
      /** 键盘高度变化事件的监听函数 */
      listener: OnKeyboardHeightChangeCallback
    ): void;
    /** [wx.onLazyLoadError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onLazyLoadError.html)
     *
     * 需要基础库： `2.24.3`
     *
     * 在插件中使用：不支持
     *
     * 监听小程序异步组件加载失败事件。
     *
     * **注意**
     *
     * - 加载异步组件通常需要下载分包，若分包下载超时，则会触发 errMsg 为 "loadSubpackage: timeout" 的回调，默认超时等待时间为 5 秒。
     * - 可以通过第二个参数指定超时时间（单位：ms），该设置全局有效，多次指定超时时间则覆盖前面。
     * - 分包确认下载失败时，会再次触发 errMsg 为 "loadSubpackage: fail" 的回调。
     * - 若在页面中使用该接口进行监听，请确保在必要时手动调用 offLazyLoadError 取消监听，以避免非预期的内存泄漏。 */
    onLazyLoadError(
      /** 小程序异步组件加载失败事件的监听函数 */
      listener: OnLazyLoadErrorCallback
    ): void;
    /** [wx.onLocalServiceDiscoveryStop(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceDiscoveryStop.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听 mDNS 服务停止搜索的事件 */
    onLocalServiceDiscoveryStop(
      /** mDNS 服务停止搜索的事件的监听函数 */
      listener: OnLocalServiceDiscoveryStopCallback
    ): void;
    /** [wx.onLocalServiceFound(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceFound.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听 mDNS 服务发现的事件 */
    onLocalServiceFound(
      /** mDNS 服务发现的事件的监听函数 */
      listener: OnLocalServiceFoundCallback
    ): void;
    /** [wx.onLocalServiceLost(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceLost.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听 mDNS 服务离开的事件 */
    onLocalServiceLost(
      /** mDNS 服务离开的事件的监听函数 */
      listener: OnLocalServiceLostCallback
    ): void;
    /** [wx.onLocalServiceResolveFail(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.onLocalServiceResolveFail.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 监听 mDNS 服务解析失败的事件 */
    onLocalServiceResolveFail(
      /** mDNS 服务解析失败的事件的监听函数 */
      listener: OnLocalServiceResolveFailCallback
    ): void;
    /** [wx.onLocationChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.onLocationChange.html)
*
* 需要基础库： `2.8.1`
*
* 在插件中使用：不支持
*
* 监听实时地理位置变化事件，需结合 [wx.startLocationUpdateBackground](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.startLocationUpdateBackground.html)、[wx.startLocationUpdate](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.startLocationUpdate.html)使用。
*
*  ## 使用方法
*  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
*
*   ## 申请开通
*   暂只针对如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。
*   接口权限申请入口将于2022年3月11日开始内测，于3月31日全量上线。并从4月18日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
*
*   ### 国内主体开放类目
*
*   | 一级类目/主体类型	| 二级类目	| 应用场景 |
*   | -------------- | -------| -------- |
*   | 电商平台 |	/	| 售卖商品线下发货、收货、送货服务 |
*   | 商家自营 |	/	| 提供售卖商品线下发货、收货、送货服务、线下商超导览、导航服务 |
*   | 医疗服务 | 公立医疗机构、三级私立医疗机构、其他私立医疗机构、就医服务、其他医学健康服务、药品（非处方药）销售、非处方药销售平台、医疗器械生产企业、医疗器械自营、医疗器械经营销售平台、互联网医院血液、干细胞服务、临床试验		| 1、实际物品/药品接收服务 2、基于地理位置取号并现场报到、附近医院导航等服务 |
*   | 交通服务 |	/	| 代驾服务、租车网点导航等相关服务 |
*   | 生活服务 |	/	| 上门服务作业等线下场景  |
*   | 物流服务 |	收件/派件、查件、邮政、装卸搬运、快递柜、货物运输	 |	快递/货物收发服务 |
*   | 餐饮服务 | 	点餐平台、外卖平台	| 线下送餐服务 |
*   | 工具	| 天气、信息查询 |	与地理位置相关的服务，比如潮汐查询、海拔查询、天气查询等 |
*   | 金融 | 保险 | 提供线下网点预约、基于地理位置取号并现场报到、附近网点导航等服务 |
*   | 旅游 | 景区服务 | 提供景区导航、导览服务 |
*   | 政务民生 |	/	 | 提供政务单位相关业务 |
*   | 政府主体帐号 |	/	| 提供政务单位相关业务 |
*
*   ### 海外主体开放类目
*   | 一级类目/主体类型	| 二级类目	| 应用场景 |
*   | -------------- | -------| -------- |
*   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
*   | 快递业与邮政	 | /	 | 快递/货物收发服务 |
*   | 餐饮	 | /	 | 线下送餐服务 |
*   | 电商平台	 | /	 | 售卖商品线下发货、线下收货服务 |
*   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
*   | 跨境电商	 | /	 | 提供售卖商品线下发货、收货服务、线下商超导览、导航服务 |
*   | 本地服务	 | 服装/鞋/箱包、玩具、家电/数码/手机、美妆/洗护、珠宝/饰品/眼镜/钟表、运动/户外/乐器、鲜花/园艺/工艺品、家居/家饰/家纺、办公/文具、机械/电子器件、酒、食品、百货/超市/便利店、宠物食品/用品	 | 提供售卖商品线下发货、线下收货服务、线下商超导览、导航服务 |
*   | 生活服务	 | 家政、外送	 | 上门服务作业等线下场景 |
*
* **示例代码**
*
* ```js
 const _locationChangeFn = function(res) {
  console.log('location change', res)
 }
 wx.onLocationChange(_locationChangeFn)
 wx.offLocationChange(_locationChangeFn)
``` */
    onLocationChange(
      /** 实时地理位置变化事件的监听函数 */
      listener: OnLocationChangeCallback
    ): void;
    /** [wx.onLocationChangeError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.onLocationChangeError.html)
     *
     * 需要基础库： `2.19.5`
     *
     * 在插件中使用：不支持
     *
     * 监听持续定位接口返回失败时触发。 */
    onLocationChangeError(
      /** 的监听函数 */
      listener: OnLocationChangeErrorCallback
    ): void;
    /** [wx.onMemoryWarning(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/memory/wx.onMemoryWarning.html)
     *
     * 需要基础库： `2.0.2`
     *
     * 在插件中使用：不支持
     *
     * 监听内存不足告警事件。
     *
     * 当 iOS/Android 向小程序进程发出内存警告时，触发该事件。触发该事件不意味小程序被杀，大部分情况下仅仅是告警，开发者可在收到通知后回收一些不必要资源避免进一步加剧内存紧张。
     *
     * **示例代码**
     *
     * ```js
     * wx.onMemoryWarning(function () {
     *   console.log('onMemoryWarningReceive')
     * })
     * `` */
    onMemoryWarning(
      /** 内存不足告警事件的监听函数 */
      listener: OnMemoryWarningCallback
    ): void;
    /** [wx.onNetworkStatusChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.onNetworkStatusChange.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：支持
*
* 监听网络状态变化事件
*
* **示例代码**
*
* ```js
wx.onNetworkStatusChange(function (res) {
  console.log(res.isConnected)
  console.log(res.networkType)
})
``` */
    onNetworkStatusChange(
      /** 网络状态变化事件的监听函数 */
      listener: OnNetworkStatusChangeCallback
    ): void;
    /** [wx.onNetworkWeakChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/network/wx.onNetworkWeakChange.html)
*
* 需要基础库： `2.21.0`
*
* 在插件中使用：不支持
*
* 监听弱网状态变化事件
*
* **示例代码**
*
* ```js
wx.onNetworkWeakChange(function (res) {
  console.log(res.weakNet)
  console.log(res.networkType)
})
// 取消监听
wx.offNetworkWeakChange()
``` */
    onNetworkWeakChange(
      /** 弱网状态变化事件的监听函数 */
      listener: OnNetworkWeakChangeCallback
    ): void;
    /** [wx.onPageNotFound(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onPageNotFound.html)
     *
     * 需要基础库： `2.1.2`
     *
     * 在插件中使用：不支持
     *
     * 监听小程序要打开的页面不存在事件。该事件与 [`App.onPageNotFound`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onpagenotfoundobject-object) 的回调时机一致。
     *
     * **注意**
     *
     * - 开发者可以在回调中进行页面重定向，但必须在回调中**同步**处理，异步处理（例如 `setTimeout` 异步执行）无效。
     * - 若开发者没有调用 [wx.onPageNotFound](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onPageNotFound.html) 绑定监听，也没有声明 `App.onPageNotFound`，当跳转页面不存在时，将推入微信客户端原生的页面不存在提示页面。
     * - 如果回调中又重定向到另一个不存在的页面，将推入微信客户端原生的页面不存在提示页面，并且不再第二次回调。 */
    onPageNotFound(
      /** 小程序要打开的页面不存在事件的监听函数 */
      listener: OnPageNotFoundCallback
    ): void;
    /** [wx.onScreenRecordingStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.onScreenRecordingStateChanged.html)
     *
     * 需要基础库： `2.24.0`
     *
     * 在插件中使用：不支持
     *
     * 监听用户录屏事件。 */
    onScreenRecordingStateChanged(
      /** 用户录屏事件的监听函数 */
      listener: OnScreenRecordingStateChangedCallback
    ): void;
    /** [wx.onSocketClose(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketClose.html)
     *
     * 在插件中使用：不支持
     *
     * @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
     *
     * 监听 WebSocket 连接关闭事件。 */
    onSocketClose(
      /** WebSocket 连接关闭事件的监听函数 */
      listener: OnSocketCloseCallback
    ): void;
    /** [wx.onSocketError(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketError.html)
     *
     * 在插件中使用：不支持
     *
     * @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
     *
     * 监听 WebSocket 错误事件。 */
    onSocketError(
      /** WebSocket 错误事件的监听函数 */
      listener: OnSocketErrorCallback
    ): void;
    /** [wx.onSocketMessage(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketMessage.html)
     *
     * 在插件中使用：不支持
     *
     * @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
     *
     * 监听 WebSocket 接收到服务器的消息事件。 */
    onSocketMessage(
      /** WebSocket 接收到服务器的消息事件的监听函数 */
      listener: OnSocketMessageCallback
    ): void;
    /** [wx.onSocketOpen(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.onSocketOpen.html)
     *
     * 在插件中使用：不支持
     *
     * @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
     *
     * 监听 WebSocket 连接打开事件。 */
    onSocketOpen(
      /** WebSocket 连接打开事件的监听函数 */
      listener: OnSocketOpenCallback
    ): void;
    /** [wx.onThemeChange(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onThemeChange.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 监听系统主题改变事件。该事件与 [`App.onThemeChange`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onThemeChange-Object-object) 的回调时机一致。
     *
     * **注意**
     *
     * - 只有在全局配置"darkmode": true时才会触发此事件。 */
    onThemeChange(
      /** 系统主题改变事件的监听函数 */
      listener: OnThemeChangeCallback
    ): void;
    /** [wx.onUnhandledRejection(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onUnhandledRejection.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：不支持
     *
     * 监听未处理的 Promise 拒绝事件。该事件与 [`App.onUnhandledRejection`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onUnhandledRejection-Object-object) 的回调时机与参数一致。
     *
     * **注意**
     *
     * - 所有的 unhandledRejection 都可以被这一监听捕获，但只有 Error 类型的才会在小程序后台触发报警。 */
    onUnhandledRejection(
      /** 未处理的 Promise 拒绝事件的监听函数 */
      listener: OnUnhandledRejectionCallback
    ): void;
    /** [wx.onUserCaptureScreen(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.onUserCaptureScreen.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：不支持
*
* 监听用户主动截屏事件。用户使用系统截屏按键截屏时触发，只能注册一个监听
*
* **示例代码**
*
* ```js
wx.onUserCaptureScreen(function (res) {
  console.log('用户截屏了')
})
``` */
    onUserCaptureScreen(
      /** 用户主动截屏事件的监听函数 */
      listener: OnUserCaptureScreenCallback
    ): void;
    /** [wx.onVoIPChatInterrupted(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatInterrupted.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听被动断开实时语音通话事件。包括小游戏切入后端时断开 */
    onVoIPChatInterrupted(
      /** 被动断开实时语音通话事件的监听函数 */
      listener: OnVoIPChatInterruptedCallback
    ): void;
    /** [wx.onVoIPChatMembersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatMembersChanged.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听实时语音通话成员在线状态变化事件。有成员加入/退出通话时触发回调 */
    onVoIPChatMembersChanged(
      /** 实时语音通话成员在线状态变化事件的监听函数 */
      listener: OnVoIPChatMembersChangedCallback
    ): void;
    /** [wx.onVoIPChatSpeakersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatSpeakersChanged.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听实时语音通话成员通话状态变化事件。有成员开始/停止说话时触发回调 */
    onVoIPChatSpeakersChanged(
      /** 实时语音通话成员通话状态变化事件的监听函数 */
      listener: OnVoIPChatSpeakersChangedCallback
    ): void;
    /** [wx.onVoIPChatStateChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatStateChanged.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：不支持
     *
     * 监听房间状态变化事件。 */
    onVoIPChatStateChanged(
      /** 房间状态变化事件的监听函数 */
      listener: OnVoIPChatStateChangedCallback
    ): void;
    /** [wx.onVoIPVideoMembersChanged(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPVideoMembersChanged.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：不支持
     *
     * 监听实时语音通话成员视频状态变化事件。 */
    onVoIPVideoMembersChanged(
      /** 实时语音通话成员视频状态变化事件的监听函数 */
      listener: OnVoIPVideoMembersChangedCallback
    ): void;
    /** [wx.onWifiConnected(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onWifiConnected.html)
     *
     * 需要基础库： `1.6.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 监听连接上 Wi-Fi 的事件 */
    onWifiConnected(
      /** 连接上 Wi-Fi 的事件的监听函数 */
      listener: OnWifiConnectedCallback
    ): void;
    /** [wx.onWifiConnectedWithPartialInfo(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.onWifiConnectedWithPartialInfo.html)
     *
     * 需要基础库： `2.22.0`
     *
     * 在插件中使用：需要基础库 `2.22.1`
     *
     * 监听连接上 Wi-Fi 的事件 */
    onWifiConnectedWithPartialInfo(
      /** 连接上 Wi-Fi 的事件的监听函数 */
      listener: OnWifiConnectedWithPartialInfoCallback
    ): void;
    /** [wx.onWindowResize(function listener)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.onWindowResize.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：不支持
     *
     * 监听窗口尺寸变化事件 */
    onWindowResize(
      /** 窗口尺寸变化事件的监听函数 */
      listener: OnWindowResizeCallback
    ): void;
    /** [wx.openAppAuthorizeSetting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openAppAuthorizeSetting.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 跳转系统微信授权管理页
*
* **示例代码**
*
* ```js
wx.openAppAuthorizeSetting({
  success (res) {
    console.log(res)
  }
})
``` */
    openAppAuthorizeSetting<T extends OpenAppAuthorizeSettingOption = OpenAppAuthorizeSettingOption>(
      option?: T
    ): PromisifySuccessResult<T, OpenAppAuthorizeSettingOption>;
    /** [wx.openBluetoothAdapter(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 初始化蓝牙模块。iOS 上开启主机/从机（外围设备）模式时需分别调用一次，并指定对应的 `mode`。
*
* **object.fail 回调函数返回的 state 参数（仅 iOS）**
*
* | 状态码 | 说明   |
* | ------ | ------ |
* | 0      | 未知   |
* | 1      | 重置中 |
* | 2      | 不支持 |
* | 3      | 未授权 |
* | 4      | 未开启 |
*
* **注意**
*
* - 其他蓝牙相关 API 必须在 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 调用之后使用。否则 API 会返回错误（errCode=10000）。
* - 在用户蓝牙开关未开启或者手机不支持蓝牙功能的情况下，调用 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 会返回错误（errCode=10001），表示手机蓝牙功能不可用。此时小程序蓝牙模块已经初始化完成，可通过 [wx.onBluetoothAdapterStateChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.onBluetoothAdapterStateChange.html) 监听手机蓝牙状态的改变，也可以调用蓝牙模块的所有API。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.openBluetoothAdapter({
  success (res) {
    console.log(res)
  }
})
``` */
    openBluetoothAdapter<T extends OpenBluetoothAdapterOption = OpenBluetoothAdapterOption>(
      option?: T
    ): PromisifySuccessResult<T, OpenBluetoothAdapterOption>;
    /** [wx.openCard(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/card/wx.openCard.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：不支持
*
* 查看微信卡包中的卡券。只有通过 [认证](https://developers.weixin.qq.com/miniprogram/product/renzheng.html) 的小程序或文化互动类目的小游戏才能使用。更多文档请参考 [微信卡券接口文档](https://mp.weixin.qq.com/cgi-bin/announce?action=getannouncement&key=1490190158&version=1&lang=zh_CN&platform=2)。
*
* **示例代码**
*
* ```js
wx.openCard({
  cardList: [{
    cardId: '',
    code: ''
  }, {
    cardId: '',
    code: ''
  }],
  success (res) { }
})
``` */
    openCard<T extends OpenCardOption = OpenCardOption>(option: T): PromisifySuccessResult<T, OpenCardOption>;
    /** [wx.openChannelsActivity(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.openChannelsActivity.html)
     *
     * 需要基础库： `2.19.2`
     *
     * 在插件中使用：不支持
     *
     * 打开视频号视频 */
    openChannelsActivity(option: OpenChannelsActivityOption): void;
    /** [wx.openChannelsEvent(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.openChannelsEvent.html)
     *
     * 需要基础库： `2.21.0`
     *
     * 在插件中使用：不支持
     *
     * 打开视频号活动页 */
    openChannelsEvent(option: OpenChannelsEventOption): void;
    /** [wx.openChannelsLive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.openChannelsLive.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：不支持
     *
     * 打开视频号直播 */
    openChannelsLive(option: OpenChannelsLiveOption): void;
    /** [wx.openChannelsUserProfile(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.openChannelsUserProfile.html)
     *
     * 需要基础库： `2.21.2`
     *
     * 在插件中使用：不支持
     *
     * 打开视频号主页 */
    openChannelsUserProfile(option: OpenChannelsUserProfileOption): void;
    /** [wx.openCustomerServiceChat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/service-chat/wx.openCustomerServiceChat.html)
*
* 需要基础库： `2.19.0`
*
* 在插件中使用：不支持
*
* 打开微信客服，页面产生点击事件（例如 button 上 bindtap 的回调中）后才可调用。了解更多信息，可以参考[微信客服介绍](https://work.weixin.qq.com/kf/)。
*
* **示例代码**
*
* ```js
wx.openCustomerServiceChat({
  extInfo: {url: ''},
  corpId: '',
  success(res) {}
})
``` */
    openCustomerServiceChat(option: OpenCustomerServiceChatOption): void;
    /** [wx.openDocument(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.openDocument.html)
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 新开页面打开文档。微信客户端 `7.0.12` 版本前默认显示右上角菜单按钮，之后的版本默认不显示，需主动传入 `showMenu`。 */
    openDocument<T extends OpenDocumentOption = OpenDocumentOption>(
      option: T
    ): PromisifySuccessResult<T, OpenDocumentOption>;
    /** [wx.openEmbeddedMiniProgram(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.openEmbeddedMiniProgram.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：需要基础库 `2.26.2`
     *
     * 打开半屏小程序。接入指引请参考 [半屏小程序能力](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/openEmbeddedMiniProgram.html)。 */
    openEmbeddedMiniProgram<T extends OpenEmbeddedMiniProgramOption = OpenEmbeddedMiniProgramOption>(
      option: T
    ): PromisifySuccessResult<T, OpenEmbeddedMiniProgramOption>;
    /** [wx.openLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.openLocation.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 使用微信内置地图查看位置
*
* **示例代码**
*
*  ```js
 wx.getLocation({
  type: 'gcj02', //返回可以用于wx.openLocation的经纬度
  success (res) {
    const latitude = res.latitude
    const longitude = res.longitude
    wx.openLocation({
      latitude,
      longitude,
      scale: 18
    })
  }
})
 ``` */
    openLocation<T extends OpenLocationOption = OpenLocationOption>(
      option: T
    ): PromisifySuccessResult<T, OpenLocationOption>;
    /** [wx.openSetting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.openSetting.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.10.3`
*
* 调起客户端小程序设置界面，返回用户设置的操作结果。**设置界面只会出现小程序已经向用户请求过的[权限](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html)**。
*
* ****
*
* - 注意：[2.3.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 版本开始，用户发生点击行为后，才可以跳转打开设置页，管理授权信息。[详情](https://developers.weixin.qq.com/community/develop/doc/000cea2305cc5047af5733de751008)
*
* **示例代码**
*
* ```js
wx.openSetting({
  success (res) {
    console.log(res.authSetting)
    // res.authSetting = {
    //   "scope.userInfo": true,
    //   "scope.userLocation": true
    // }
  }
})
``` */
    openSetting<T extends OpenSettingOption = OpenSettingOption>(
      option?: T
    ): PromisifySuccessResult<T, OpenSettingOption>;
    /** [wx.openSystemBluetoothSetting(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openSystemBluetoothSetting.html)
*
* 需要基础库： `2.20.1`
*
* 在插件中使用：需要基础库 `2.21.3`
*
* 跳转系统蓝牙设置页。仅支持安卓。
*
* **示例代码**
*
* ```js
wx.openSystemBluetoothSetting({
  success (res) {
    console.log(res)
  }
})
``` */
    openSystemBluetoothSetting<T extends OpenSystemBluetoothSettingOption = OpenSystemBluetoothSettingOption>(
      option?: T
    ): PromisifySuccessResult<T, OpenSystemBluetoothSettingOption>;
    /** [wx.openVideoEditor(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.openVideoEditor.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 打开视频编辑器 */
    openVideoEditor(option: OpenVideoEditorOption): void;
    /** [wx.pageScrollTo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/wx.pageScrollTo.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 将页面滚动到目标位置，支持选择器和滚动距离两种方式定位
*
* **selector 语法**
*
* selector类似于 CSS 的选择器，但仅支持下列语法。
*
* + ID选择器：#the-id
* + class选择器（可以连续指定多个）：.a-class.another-class
* + 子元素选择器：.the-parent > .the-child
* + 后代选择器：.the-ancestor .the-descendant
* + 跨自定义组件的后代选择器：.the-ancestor >>> .the-descendant
* + 多选择器的并集：#a-node, .some-other-nodes
*
* **示例代码**
*
* ```js
wx.pageScrollTo({
  scrollTop: 0,
  duration: 300
})
``` */
    pageScrollTo<T extends PageScrollToOption = PageScrollToOption>(
      option: T
    ): PromisifySuccessResult<T, PageScrollToOption>;
    /** [wx.pauseBackgroundAudio(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.pauseBackgroundAudio.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
*
* 暂停播放音乐。
*
* **示例代码**
*
* ```js
wx.pauseBackgroundAudio()
``` */
    pauseBackgroundAudio<T extends PauseBackgroundAudioOption = PauseBackgroundAudioOption>(
      option?: T
    ): PromisifySuccessResult<T, PauseBackgroundAudioOption>;
    /** [wx.pauseVoice(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.pauseVoice.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
*
* 暂停正在播放的语音。再次调用 [wx.playVoice](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.playVoice.html) 播放同一个文件时，会从暂停处开始播放。如果想从头开始播放，需要先调用 [wx.stopVoice](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.stopVoice.html)。
*
* **示例代码**
*
* ```js
wx.startRecord({
  success (res) {
    const tempFilePath = res.tempFilePath
    wx.playVoice({
      filePath: tempFilePath
    })

    setTimeout(() => { wx.pauseVoice() }, 5000)
  }
})
``` */
    pauseVoice<T extends PauseVoiceOption = PauseVoiceOption>(option?: T): PromisifySuccessResult<T, PauseVoiceOption>;
    /** [wx.playBackgroundAudio(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.playBackgroundAudio.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
*
* 使用后台播放器播放音乐。对于微信客户端来说，只能同时有一个后台音乐在播放。当用户离开小程序后，音乐将暂停播放；当用户在其他小程序占用了音乐播放器，原有小程序内的音乐将停止播放。
*
* **示例代码**
*
* ```js
wx.playBackgroundAudio({
  dataUrl: '',
  title: '',
  coverImgUrl: ''
})
``` */
    playBackgroundAudio<T extends PlayBackgroundAudioOption = PlayBackgroundAudioOption>(
      option: T
    ): PromisifySuccessResult<T, PlayBackgroundAudioOption>;
    /** [wx.playVoice(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.playVoice.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
*
* 开始播放语音。同时只允许一个语音文件正在播放，如果前一个语音文件还没播放完，将中断前一个语音播放。
*
* **示例代码**
*
* ```js
wx.startRecord({
  success (res) {
    const tempFilePath = res.tempFilePath
    wx.playVoice({
      filePath: tempFilePath,
      complete () { }
    })
  }
})
``` */
    playVoice<T extends PlayVoiceOption = PlayVoiceOption>(option: T): PromisifySuccessResult<T, PlayVoiceOption>;
    /** [wx.pluginLogin(Object args)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.pluginLogin.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：需要基础库 `2.20.1`
     *
     * __该接口仅在小程序插件中可调用__，调用接口获得插件用户标志凭证（code）。插件可以此凭证换取用于识别用户的标识 openpid。用户不同、宿主小程序不同或插件不同的情况下，该标识均不相同，即当且仅当同一个用户在同一个宿主小程序中使用同一个插件时，openpid 才会相同。 */
    pluginLogin(args?: PluginLoginOption): void;
    /** [wx.preloadAssets(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.preloadAssets.html)
*
* 需要基础库： `2.22.1`
*
* 在插件中使用：不支持
*
* 为视图层预加载媒体资源文件, 目前支持：font，image
*
* **示例代码**
*
* ```js
wx.preloadAssets({
  data: [
    {
      type: 'image',
      src: imgUrl,
    },
  ],
  success(resp) {
    console.log('preloadAssets success', resp)
  },
  fail(err) {
    console.log('preloadAssets fail', err)
  },
})
```
*
* ****
*
* - 开发过程中，可在开发者工具network面板查看预加载情况。 */
    preloadAssets(option: PreloadAssetsOption): void;
    /** [wx.preloadSkylineView(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.preloadSkylineView.html)
     *
     * 需要基础库： `2.24.7`
     *
     * 在插件中使用：需要基础库 `2.24.7`
     *
     * 预加载下个页面所需要的 [Skyline](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 运行环境。 */
    preloadSkylineView(option?: PreloadSkylineViewOption): void;
    /** [wx.preloadWebview(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.preloadWebview.html)
     *
     * 需要基础库： `2.15.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 预加载下个页面的 WebView。参见[预加载下个页面的时机](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_nav.html#_2-4-控制预加载下个页面的时机) */
    preloadWebview(option?: PreloadWebviewOption): void;
    /** [wx.previewImage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewImage.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 在新页面中全屏预览图片。预览的过程中用户可以进行保存图片、发送给朋友等操作。
*
* **支持长按识别的码**
*
* | 类型 | 说明 | 最低版本 |
* |------|------| -------|
* | 小程序码 |    |
* | 微信个人码 | 不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
* | 企业微信个人码 | 不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
* | 普通群码 | 指仅包含微信用户的群，不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
* | 互通群码 |  指既有微信用户也有企业微信用户的群，不支持小游戏  | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
* | 公众号二维码 | 不支持小游戏  | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
*
* **示例代码**
*
* ```js
wx.previewImage({
  current: '', // 当前显示图片的http链接
  urls: [] // 需要预览的图片http链接列表
})
``` */
    previewImage<T extends PreviewImageOption = PreviewImageOption>(
      option: T
    ): PromisifySuccessResult<T, PreviewImageOption>;
    /** [wx.previewMedia(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.previewMedia.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 预览图片和视频。
     *
     * **支持长按识别的码**
     *
     * | 类型 | 说明 | 最低版本 |
     * |------|------| -------|
     * | 小程序码 |    |
     * | 微信个人码 | 不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
     * | 企业微信个人码 | 不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
     * | 普通群码 | 指仅包含微信用户的群，不支持小游戏   | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
     * | 互通群码 |  指既有微信用户也有企业微信用户的群，不支持小游戏  | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) |
     * | 公众号二维码 | 不支持小游戏  | [2.18.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) | */
    previewMedia<T extends PreviewMediaOption = PreviewMediaOption>(
      option: T
    ): PromisifySuccessResult<T, PreviewMediaOption>;
    /** [wx.reLaunch(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.reLaunch.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.3.1`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 关闭所有页面，打开到应用内的某个页面
*
* **示例代码**
*
* ```js
wx.reLaunch({
  url: 'test?id=1'
})
```
*
* ```html
* // test
* Page({
*   onLoad (option) {
*     console.log(option.query)
*   }
* })
* ``` */
    reLaunch<T extends ReLaunchOption = ReLaunchOption>(option: T): PromisifySuccessResult<T, ReLaunchOption>;
    /** [wx.readBLECharacteristicValue(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.readBLECharacteristicValue.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 读取蓝牙低功耗设备特征值的二进制数据。注意：必须设备的特征支持 read 才可以成功调用。
*
* **注意**
*
* - 并行调用多次会存在读失败的可能性。
* - 接口读取到的信息需要在 [wx.onBLECharacteristicValueChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.onBLECharacteristicValueChange.html) 方法注册的回调中获取。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
// 必须在这里的回调才能获取
wx.onBLECharacteristicValueChange(function(characteristic) {
  console.log('characteristic value comed:', characteristic)
})

wx.readBLECharacteristicValue({
  // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
  deviceId,
  // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
  serviceId,
  // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
  characteristicId,
  success (res) {
    console.log('readBLECharacteristicValue:', res.errCode)
  }
})
``` */
    readBLECharacteristicValue<T extends ReadBLECharacteristicValueOption = ReadBLECharacteristicValueOption>(
      option: T
    ): PromisifySuccessResult<T, ReadBLECharacteristicValueOption>;
    /** [wx.redirectTo(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.redirectTo.html)
*
* 在插件中使用：需要基础库 `2.2.2`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 关闭当前页面，跳转到应用内的某个页面。但是不允许跳转到 tabbar 页面。
*
* **示例代码**
*
* ```js
wx.redirectTo({
  url: 'test?id=1'
})
``` */
    redirectTo<T extends RedirectToOption = RedirectToOption>(option: T): PromisifySuccessResult<T, RedirectToOption>;
    /** [wx.removeStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorage.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 从本地缓存中移除指定 key。
*
* **示例代码**
*
* ```js
wx.removeStorage({
  key: 'key',
  success (res) {
    console.log(res)
  }
})
```
*
* ```js
try {
  wx.removeStorageSync('key')
} catch (e) {
  // Do something when catch error
}
``` */
    removeStorage<T extends RemoveStorageOption = RemoveStorageOption>(
      option: T
    ): PromisifySuccessResult<T, RemoveStorageOption>;
    /** [wx.removeStorageSync(string key)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorageSync.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* [wx.removeStorage](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorage.html) 的同步版本
*
* **示例代码**
*
* ```js
wx.removeStorage({
  key: 'key',
  success (res) {
    console.log(res)
  }
})
```
*
* ```js
try {
  wx.removeStorageSync('key')
} catch (e) {
  // Do something when catch error
}
``` */
    removeStorageSync(
      /** 本地缓存中指定的 key */
      key: string
    ): void;
    /** [wx.removeTabBarBadge(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.removeTabBarBadge.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：不支持
     *
     * 移除 tabBar 某一项右上角的文本 */
    removeTabBarBadge<T extends RemoveTabBarBadgeOption = RemoveTabBarBadgeOption>(
      option: T
    ): PromisifySuccessResult<T, RemoveTabBarBadgeOption>;
    /** [wx.reportAnalytics(string eventName, Object data)](https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportAnalytics.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 在插件中使用时，可以被正常调用，但目前不会进行统计展示
* @deprecated 基础库版本 [2.31.1](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃
*
* 自定义分析数据上报接口。使用前，需要在小程序管理后台自定义分析中新建事件，配置好事件名与字段。
*
* **示例代码**
*
* ```js
wx.reportAnalytics('purchase', {
  price: 120,
  color: 'red'
})
``` */
    reportAnalytics(
      /** 事件名 */
      eventName: string,
      /** 上报的自定义数据，key 为配置中的字段名，value 为上报的数据。 */
      data: IAnyObject
    ): void;
    /** [wx.reportEvent(string eventId, object data)](https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportEvent.html)
     *
     * 需要基础库： `2.14.4`
     *
     * 在插件中使用：不支持
     *
     * 事件上报 */
    reportEvent(
      /** 在 mp 实验系统中设置的事件英文名 */
      eventId: string,
      /** 可被 JSON.stringify 的对象，将一起上报至系统 */
      data?: IAnyObject
    ): void;
    /** [wx.reportMonitor(string name, number value)](https://developers.weixin.qq.com/miniprogram/dev/api/data-analysis/wx.reportMonitor.html)
*
* 需要基础库： `2.0.1`
*
* 在插件中使用：不支持
*
* 自定义业务数据监控上报接口。
*
* **使用说明**
*
* 使用前，需要在「小程序管理后台-运维中心-性能监控-业务数据监控」中新建监控事件，配置监控描述与告警类型。每一个监控事件对应唯一的监控ID，开发者最多可以创建128个监控事件。
*
* **示例代码**
*
* ```js
wx.reportMonitor('1', 1)
``` */
    reportMonitor(
      /** 监控ID，在「小程序管理后台」新建数据指标后获得 */
      name: string,
      /** 上报数值，经处理后会在「小程序管理后台」上展示每分钟的上报总量 */
      value: number
    ): void;
    /** [wx.reportPerformance(Number id, Number value, String|Array dimensions)](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.reportPerformance.html)
*
* 需要基础库： `2.9.2`
*
* 在插件中使用：需要基础库 `2.9.3`
*
* 小程序测速上报。使用前，需要在小程序管理后台配置。
*
* **示例代码**
*
* ```js
wx.reportPerformance(1101, 680)
wx.reportPerformance(1101, 680, 'custom')
``` */
    reportPerformance(
      /** 指标 id */
      id: number,
      /** 需要上报的数值 */
      value: number,
      /** 自定义维度 (选填) */
      dimensions?: string | any[]
    ): void;
    /** [wx.requestDeviceVoIP(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.requestDeviceVoIP.html)
*
* 需要基础库： `2.27.3`
*
* 在插件中使用：不支持
*
* 请求用户授权与设备（组）间进行音视频通话。
*
* **示例代码**
*
* ```js
// 授权单台设备
wx.requestDeviceVoIP({
  sn: 'xxxx',
  snTicket: 'xxxxx',
  modelId: 'xxx',
  deviceName: 'xxx',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.log(res)
  }
})

// 批量授权（授权设备组）
wx.requestDeviceVoIP({
  isGroup: true,
  groupId: '设备组 ID',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.log(res)
  }
})
``` */
    requestDeviceVoIP(option: RequestDeviceVoIPOption): void;
    /** [wx.requestOrderPayment(Object args)](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestOrderPayment.html)
     *
     * 需要基础库： `2.16.0`
     *
     * 在插件中使用：不支持
     *
     * 仅接入了[自定义版交易组件](https://developers.weixin.qq.com/miniprogram/dev/framework/ministore/minishopopencomponent2/Introduction2)的小程序需要使用，普通小程序可直接使用 [`wx.requestPayment`](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html)。
     *
     * **前置检查**
     *
     * 接入自定义版交易组件之后，若要发起微信支付，请先查询[需要校验的场景](https://developers.weixin.qq.com/miniprogram/dev/framework/ministore/minishopopencomponent2/API/order/check_scene)。
     * 在需要校验的场景中，发起微信支付时，必须使用该接口，需要按照要求传入相关的[订单信息](https://developers.weixin.qq.com/miniprogram/dev/framework/ministore/minishopopencomponent2/API/order/add_order)进行校验，校验通过后用户才可以完成当前订单的支付，非需要校验的场景则可以按照商家要求自行选择传入订单信息或不传入。 */
    requestOrderPayment<T extends RequestOrderPaymentOption = RequestOrderPaymentOption>(
      args: T
    ): PromisifySuccessResult<T, RequestOrderPaymentOption>;
    /** [wx.requestPayment(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html)
*
* 在插件中使用：不支持
*
* 发起微信支付。调用前需在[小程序微信公众平台](https://mp.weixin.qq.com/) -功能-微信支付入口申请接入微信支付。了解更多信息，可以参考 [微信支付开发文档](https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/api.shtml)：
* - [开发指引](https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter2_3.shtml)
* - [下单接口](https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter3_2.shtml)
* - [支付接口](https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/transactions/chapter3_12.shtml)
* - 旧版本 (v2)
*   - [开发指引](https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_api.php?chapter=7_3&index=1)
*   - [支付接口](https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_api.php?chapter=7_7&index=3)
*
* 如果使用[云开发](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)，则 `wx.requestPayment` 所需参数可以通过云开发微信支付统一下单接口免鉴权获取、并可免证书、免签名的安全调用微信支付服务端接口、及接收异步支付结果回调，详见[云开发微信支付](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/wechatpay/wechatpay.html)。
*
* **示例代码**
*
* ```js
wx.requestPayment({
  timeStamp: '',
  nonceStr: '',
  package: '',
  signType: 'MD5',
  paySign: '',
  success (res) { },
  fail (res) { }
})
```
*
* 注：如果服务端有使用云开发，可以通过云开发微信支付[统一下单](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/open/pay/CloudPay.unifiedOrder.html)接口免鉴权获取以上所需所有参数，示例：
*
* ```js
// 云函数代码
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const res = await cloud.cloudPay.unifiedOrder({
    "body" : "小秋TIT店-超市",
    "outTradeNo" : "1217752501201407033233368018",
    "spbillCreateIp" : "127.0.0.1",
    "subMchId" : "1900009231",
    "totalFee" : 1,
    "envId": "test-f0b102",
    "functionName": "pay_cb"
  })
  return res
}

// 小程序代码
wx.cloud.callFunction({
  name: '函数名',
  data: {
    // ...
  },
  success: res => {
    const payment = res.result.payment
    wx.requestPayment({
      ...payment,
      success (res) {
        console.log('pay success', res)
      },
      fail (err) {
        console.error('pay fail', err)
      }
    })
  },
  fail: console.error,
})
``` */
    requestPayment<T extends RequestPaymentOption = RequestPaymentOption>(
      option: T
    ): PromisifySuccessResult<T, RequestPaymentOption>;
    /** [wx.requestPluginPayment(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPluginPayment.html)
*
* 需要基础库： `2.22.1`
*
* 在插件中使用：需要基础库 `2.22.1`
*
* 插件中发起支付。
*
* **Tip**
*
* 1. `tip`: 小程序与插件绑定在同一个open平台账号上且小程序与插件均为open账号的同主体/关联主体时，调用此接口将直接拉起支付收银台。
* 1. `tip`: 这个接口本身可以在开发者工具中使用，但功能页的跳转目前不支持在开发者工具中调试，请在真机上测试。
* 1. `tip`: 跳转支付功能页需要在 `app.json` 中配置 `"functionalPages": true`
*
* **示例代码**
*
* 具体用法及参数说明可参考 [插件支付文档](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/request-payment.html)
* ```js
wx.requestPluginPayment({
  version: 'release',
  fee: 1,
  paymentArgs: {},
  currencyType: 'CNY',
  success (res) { },
  fail (res) { }
})
``` */
    requestPluginPayment(option: RequestPluginPaymentOption): void;
    /** [wx.requestSubscribeDeviceMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeDeviceMessage.html)
*
* 需要基础库： `2.20.0`
*
* 在插件中使用：不支持
*
* 订阅设备消息接口，调用后弹出授权框，用户同意后会允许开发者给用户发送订阅模版消息。当用户点击“允许”按钮时，模板消息会被添加到用户的小程序设置页，通过 wx.getSetting 接口可获取用户对相关模板消息的订阅状态。
*
* **错误码**
*
* | errCode | errMsg                                                 | 说明                                                           |
* | ------- | ------------------------------------------------------ | -------------------------------------------------------------- |
* | 10001   | TmplIds can't be empty                                 | tmplIds 为空                                                  |
* | 10004   | Invalid template id                                    | tmplId 参数类型错误                                            |
* | 20001   | No template data return, verify the template id exist  | tmplId 为空                                                  |
* | 20003   | Templates count out of max bounds                      | tmplId 数量超过上限                                           |
* | 19720726   | check sn_ticket fail                                | snTicket 不合法                                              |
* | 19720727   | sn_ticket expire                                    | snTicket 过期                                               |
* | 19720728   | err_not_found_tid                                    | tmplId 不存在                                              |
* | 19720736   | template_id do not match model_id                   | modelId 类型与 tmplId 类型不符                               |
*
* **示例代码**
*
* ```js
wx.requestSubscribeDeviceMessage({
  tmplIds: ['xxxxx'],
  sn: 'xxxx',
  snTicket: 'xxxxx',
  modelId: 'xxx',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.log(res)
  }
})
``` */
    requestSubscribeDeviceMessage<T extends RequestSubscribeDeviceMessageOption = RequestSubscribeDeviceMessageOption>(
      option: T
    ): PromisifySuccessResult<T, RequestSubscribeDeviceMessageOption>;
    /** [wx.requestSubscribeMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)
*
* 需要基础库： `2.4.4`
*
* 在插件中使用：不支持
*
* 调起客户端小程序订阅消息界面，返回用户订阅消息的操作结果。当用户勾选了订阅面板中的“总是保持以上选择，不再询问”时，模板消息会被添加到用户的小程序设置页，通过 [wx.getSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.getSetting.html) 接口可获取用户对相关模板消息的订阅状态。
*
* ## 注意事项
*  - 一次性模板 id 和永久模板 id 不可同时使用。
*  - 低版本基础库2.4.4~2.8.3 已支持订阅消息接口调用，仅支持传入一个一次性 tmplId / 永久 tmplId。
*  - [2.8.2](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 版本开始，用户发生点击行为或者发起支付回调后，才可以调起订阅消息界面。
*  - [2.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 版本开始，开发版和体验版小程序将禁止使用模板消息 formId。
*  - 一次授权调用里，每个tmplId对应的模板标题不能存在相同的，若出现相同的，只保留一个。
*  - [2.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 版本开始，支持订阅语音消息提醒，[详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
*
* **错误码**
*
* | errCode | errMsg                                                 | 说明                                                           |
* | ------- | ------------------------------------------------------ | -------------------------------------------------------------- |
* | 10001   | TmplIds can't be empty                                 | 参数传空了                                                     |
* | 10002   | Request list fail                                       | 网络问题，请求消息列表失败                                     |
* | 10003   | Request subscribe fail                                 | 网络问题，订阅请求发送失败                                     |
* | 10004   | Invalid template id                                    | 参数类型错误                                                   |
* | 10005   | Cannot show subscribe message UI                       | 无法展示 UI，一般是小程序这个时候退后台了导致的                |
* | 20001   | No template data return, verify the template id exist  | 没有模板数据，一般是模板 ID 不存在 或者和模板类型不对应 导致的 |
* | 20002   | Templates type must be same                            | 模板消息类型 既有一次性的又有永久的                            |
* | 20003   | Templates count out of max bounds                      | 模板消息数量超过上限                                           |
* | 20004   | The main switch is switched off                        | 用户关闭了主开关，无法进行订阅                                 |
* | 20005   | This mini program was banned from subscribing messages | 小程序被禁封                                                   |
* | 20013   | Reject DeviceMsg Template                              | 不允许通过该接口订阅设备消息                                      |
*
* **示例代码**
*
* ```js
wx.requestSubscribeMessage({
  tmplIds: [''],
  success (res) { }
})
``` */
    requestSubscribeMessage<T extends RequestSubscribeMessageOption = RequestSubscribeMessageOption>(
      option: T
    ): PromisifySuccessResult<T, RequestSubscribeMessageOption>;
    /** [wx.reserveChannelsLive(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/channels/wx.reserveChannelsLive.html)
     *
     * 需要基础库： `2.19.0`
     *
     * 在插件中使用：不支持
     *
     * 预约视频号直播 */
    reserveChannelsLive(option: ReserveChannelsLiveOption): void;
    /** [wx.revokeBufferURL(string url)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.revokeBufferURL.html)
     *
     * 需要基础库： `2.14.0`
     *
     * 在插件中使用：不支持
     *
     * 根据 URL 销毁存在内存中的数据 */
    revokeBufferURL(
      /** 需要销毁的二进制数据 URL */
      url: string
    ): void;
    /** [wx.saveFileToDisk(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.saveFileToDisk.html)
*
* 需要基础库： `2.11.0`
*
* 在插件中使用：需要基础库 `2.15.0`
*
* 保存文件系统的文件到用户磁盘，仅在 PC 端支持
*
* **示例代码**
*
* ```js
wx.saveFileToDisk({
  filePath: `${wx.env.USER_DATA_PATH}/hello.txt`,
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.error(res)
  }
})
``` */
    saveFileToDisk(option: SaveFileToDiskOption): void;
    /** [wx.saveImageToPhotosAlbum(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.saveImageToPhotosAlbum.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 保存图片到系统相册。
*
* **示例代码**
*
* ```js
wx.saveImageToPhotosAlbum({
  success(res) { }
})
``` */
    saveImageToPhotosAlbum<T extends SaveImageToPhotosAlbumOption = SaveImageToPhotosAlbumOption>(
      option: T
    ): PromisifySuccessResult<T, SaveImageToPhotosAlbumOption>;
    /** [wx.saveVideoToPhotosAlbum(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.saveVideoToPhotosAlbum.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 保存视频到系统相册。支持mp4视频格式。
*
* **示例代码**
*
* ```js
wx.saveVideoToPhotosAlbum({
  filePath: 'wxfile://xxx',
  success (res) {
    console.log(res.errMsg)
  }
})
``` */
    saveVideoToPhotosAlbum<T extends SaveVideoToPhotosAlbumOption = SaveVideoToPhotosAlbumOption>(
      option: T
    ): PromisifySuccessResult<T, SaveVideoToPhotosAlbumOption>;
    /** [wx.scanCode(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/scan/wx.scanCode.html)
*
* 需要基础库： `1.0.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 调起客户端扫码界面进行扫码
*
* **示例代码**
*
* ```js
// 允许从相机和相册扫码
wx.scanCode({
  success (res) {
    console.log(res)
  }
})

// 只允许从相机扫码
wx.scanCode({
  onlyFromCamera: true,
  success (res) {
    console.log(res)
  }
})
``` */
    scanCode<T extends ScanCodeOption = ScanCodeOption>(option: T): PromisifySuccessResult<T, ScanCodeOption>;
    /** [wx.seekBackgroundAudio(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.seekBackgroundAudio.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
*
* 控制音乐播放进度。
*
* **示例代码**
*
* ```js
wx.seekBackgroundAudio({
  position: 30
})
``` */
    seekBackgroundAudio<T extends SeekBackgroundAudioOption = SeekBackgroundAudioOption>(
      option: T
    ): PromisifySuccessResult<T, SeekBackgroundAudioOption>;
    /** [wx.sendHCEMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.sendHCEMessage.html)
*
* 需要基础库： `1.7.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 发送 NFC 消息。仅在安卓系统下有效。
*
* **示例代码**
*
* ```js
const buffer = new ArrayBuffer(1)
const dataView = new DataView(buffer)
dataView.setUint8(0, 0)

wx.startHCE({
  success (res) {
    wx.onHCEMessage(function(res) {
      if (res.messageType === 1) {
        wx.sendHCEMessage({data: buffer})
      }
    })
  }
})
``` */
    sendHCEMessage<T extends SendHCEMessageOption = SendHCEMessageOption>(
      option: T
    ): PromisifySuccessResult<T, SendHCEMessageOption>;
    /** [wx.sendSms(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/sms/wx.sendSms.html)
     *
     * 需要基础库： `2.25.0`
     *
     * 在插件中使用：不支持
     *
     * 拉起手机发送短信界面。 */
    sendSms(option: SendSmsOption): void;
    /** [wx.sendSocketMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/wx.sendSocketMessage.html)
*
* 在插件中使用：不支持
*
* @warning **推荐使用 [SocketTask](https://developers.weixin.qq.com/miniprogram/dev/api/network/websocket/SocketTask.html) 的方式去管理 webSocket 链接，每一条链路的生命周期都更加可控，同时存在多个 webSocket 的链接的情况下使用 wx 前缀的方法可能会带来一些和预期不一致的情况。**
*
* 通过 WebSocket 连接发送数据。需要先 wx.connectSocket，并在 wx.onSocketOpen 回调之后才能发送。
*
* **示例代码**
*
* ```js
let socketOpen = false
let socketMsgQueue = []
wx.connectSocket({
  url: 'test.php'
})

wx.onSocketOpen(function(res) {
  socketOpen = true
  for (let i = 0; i < socketMsgQueue.length; i++){
    sendSocketMessage(socketMsgQueue[i])
  }
  socketMsgQueue = []
})

function sendSocketMessage(msg) {
  if (socketOpen) {
    wx.sendSocketMessage({
      data:msg
    })
  } else {
    socketMsgQueue.push(msg)
  }
}
``` */
    sendSocketMessage<T extends SendSocketMessageOption = SendSocketMessageOption>(
      option: T
    ): PromisifySuccessResult<T, SendSocketMessageOption>;
    /** [wx.setBLEMTU(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.setBLEMTU.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：需要基础库 `2.11.0`
     *
     * 协商设置蓝牙低功耗的最大传输单元 (Maximum Transmission Unit, MTU)。需在 [wx.createBLEConnection](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.createBLEConnection.html) 调用成功后调用。仅安卓系统 5.1 以上版本有效，iOS 因系统限制不支持。 */
    setBLEMTU<T extends SetBLEMTUOption = SetBLEMTUOption>(option: T): PromisifySuccessResult<T, SetBLEMTUOption>;
    /** [wx.setBackgroundColor(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundColor.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.4.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 动态设置窗口的背景色
*
* **示例代码**
*
* ```js
wx.setBackgroundColor({
  backgroundColor: '#ffffff', // 窗口的背景色为白色
})

wx.setBackgroundColor({
  backgroundColorTop: '#ffffff', // 顶部窗口的背景色为白色
  backgroundColorBottom: '#ffffff', // 底部窗口的背景色为白色
})
``` */
    setBackgroundColor<T extends SetBackgroundColorOption = SetBackgroundColorOption>(
      option: T
    ): PromisifySuccessResult<T, SetBackgroundColorOption>;
    /** [wx.setBackgroundFetchToken(object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/background-fetch/wx.setBackgroundFetchToken.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 设置自定义登录态，在周期性拉取数据时带上，便于第三方服务器验证请求合法性 */
    setBackgroundFetchToken<T extends SetBackgroundFetchTokenOption = SetBackgroundFetchTokenOption>(
      option: T
    ): PromisifySuccessResult<T, SetBackgroundFetchTokenOption>;
    /** [wx.setBackgroundTextStyle(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundTextStyle.html)
*
* 需要基础库： `2.1.0`
*
* 在插件中使用：需要基础库 `2.4.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 动态设置下拉背景字体、loading 图的样式
*
* **示例代码**
*
* ```js
wx.setBackgroundTextStyle({
  textStyle: 'dark' // 下拉背景字体、loading 图的样式为dark
})
``` */
    setBackgroundTextStyle<T extends SetBackgroundTextStyleOption = SetBackgroundTextStyleOption>(
      option: T
    ): PromisifySuccessResult<T, SetBackgroundTextStyleOption>;
    /** [wx.setClipboardData(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/clipboard/wx.setClipboardData.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 设置系统剪贴板的内容。调用成功后，会弹出 toast 提示"内容已复制"，持续 1.5s
*
* **示例代码**
*
* ```js
wx.setClipboardData({
  data: 'data',
  success (res) {
    wx.getClipboardData({
      success (res) {
        console.log(res.data) // data
      }
    })
  }
})
``` */
    setClipboardData<T extends SetClipboardDataOption = SetClipboardDataOption>(
      option: T
    ): PromisifySuccessResult<T, SetClipboardDataOption>;
    /** [wx.setEnable1v1Chat(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.setEnable1v1Chat.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：不支持
     *
     * 开启双人通话。设置 `enable` 为 `false` 时，无法接听呼叫。 */
    setEnable1v1Chat(option: SetEnable1v1ChatOption): void;
    /** [wx.setEnableDebug(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.setEnableDebug.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：不支持
*
* 设置是否打开调试开关。此开关对正式版也能生效。
*
* **示例代码**
*
* ```javascript
// 打开调试
wx.setEnableDebug({
  enableDebug: true
})

// 关闭调试
wx.setEnableDebug({
  enableDebug: false
})
```
*
* **Tips**
*
* - 在正式版打开调试还有一种方法，就是先在开发版或体验版打开调试，再切到正式版就能看到vConsole。 */
    setEnableDebug<T extends SetEnableDebugOption = SetEnableDebugOption>(
      option: T
    ): PromisifySuccessResult<T, SetEnableDebugOption>;
    /** [wx.setInnerAudioOption(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.setInnerAudioOption.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.10.0`
     *
     * 设置 [InnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/InnerAudioContext.html) 的播放选项。设置之后对当前小程序全局生效。
     *
     * ****
     *
     * ## 注意事项
     * - 为保证微信整体体验，speakerOn 为 true 时，客户端会忽略 mixWithOthers 参数的内容，强制与其它音频互斥
     * - 不支持在播放音频的过程中切换为扬声器播放，开发者如需切换可以先暂停当前播放的音频并记录下当前暂停的时间点，然后切换后重新从原来暂停的时间点开始播放音频
     * - 目前 wx.setInnerAudioOption 接口不兼容 wx.createWebAudioContext 接口，也不兼容 wx.createInnerAudioContext 开启 useWebAudioImplement 的情况，将在后续版本中支持 */
    setInnerAudioOption<T extends SetInnerAudioOption = SetInnerAudioOption>(
      option: T
    ): PromisifySuccessResult<T, SetInnerAudioOption>;
    /** [wx.setKeepScreenOn(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setKeepScreenOn.html)
*
* 需要基础库： `1.4.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 设置是否保持常亮状态。仅在当前小程序生效，离开小程序后设置失效。
*
* **示例代码**
*
* ```js
wx.setKeepScreenOn({
  keepScreenOn: true
})
``` */
    setKeepScreenOn<T extends SetKeepScreenOnOption = SetKeepScreenOnOption>(
      option: T
    ): PromisifySuccessResult<T, SetKeepScreenOnOption>;
    /** [wx.setNavigationBarColor(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarColor.html)
     *
     * 需要基础库： `1.4.0`
     *
     * 在插件中使用：需要基础库 `2.1.0`
     *
     * 在插件中使用时，只能在当前插件的页面中调用
     *
     * 设置页面导航条颜色 */
    setNavigationBarColor<T extends SetNavigationBarColorOption = SetNavigationBarColorOption>(
      option: T
    ): PromisifySuccessResult<T, SetNavigationBarColorOption>;
    /** [wx.setNavigationBarTitle(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarTitle.html)
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 动态设置当前页面的标题
*
* **示例代码**
*
* ```js
wx.setNavigationBarTitle({
  title: '当前页面'
})
``` */
    setNavigationBarTitle<T extends SetNavigationBarTitleOption = SetNavigationBarTitleOption>(
      option: T
    ): PromisifySuccessResult<T, SetNavigationBarTitleOption>;
    /** [wx.setScreenBrightness(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setScreenBrightness.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 设置屏幕亮度 */
    setScreenBrightness<T extends SetScreenBrightnessOption = SetScreenBrightnessOption>(
      option: T
    ): PromisifySuccessResult<T, SetScreenBrightnessOption>;
    /** [wx.setStorage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorage.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 将数据存储在本地缓存中指定的 key 中。会覆盖掉原来该 key 对应的内容。除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用。单个 key 允许存储的最大数据长度为 1MB，所有数据存储上限为 10MB。
*
* **示例代码**
*
* ```js
wx.setStorage({
  key:"key",
  data:"value"
})
```
*
* ```js
// 开启加密存储
wx.setStorage({
  key: "key",
  data: "value",
  encrypt: true, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
  success() {
    wx.getStorage({
      key: "key",
      encrypt: true, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
      success(res) {
        console.log(res.data)
      }
    })
  }
})
``` */
    setStorage<T = any, U extends SetStorageOption<T> = SetStorageOption<T>>(
      option: U
    ): PromisifySuccessResult<U, SetStorageOption<T>>;
    /** [wx.setStorageSync(string key, any data)](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 将数据存储在本地缓存中指定的 key 中。会覆盖掉原来该 key 对应的内容。除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用。单个 key 允许存储的最大数据长度为 1MB，所有数据存储上限为 10MB。
*
* **注意**
*
* storage 应只用来进行数据的持久化存储，不应用于运行时的数据传递或全局状态管理。启动过程中过多的同步读写存储，会显著影响启动耗时。
*
* **示例代码**
*
* ```js
try {
  wx.setStorageSync('key', 'value')
} catch (e) { }
``` */
    setStorageSync<T = any>(
      /** 本地缓存中指定的 key */
      key: string,
      /** 需要存储的内容。只支持原生类型、Date、及能够通过`JSON.stringify`序列化的对象。 */
      data: T
    ): void;
    /** [wx.setTabBarBadge(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarBadge.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：不支持
*
* 为 tabBar 某一项的右上角添加文本
*
* **示例代码**
*
* ```js
wx.setTabBarBadge({
  index: 0,
  text: '1'
})
``` */
    setTabBarBadge<T extends SetTabBarBadgeOption = SetTabBarBadgeOption>(
      option: T
    ): PromisifySuccessResult<T, SetTabBarBadgeOption>;
    /** [wx.setTabBarItem(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarItem.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：不支持
*
* 动态设置 tabBar 某一项的内容，`2.7.0` 起图片支持临时文件和网络文件。
*
* **示例代码**
*
* ```js
wx.setTabBarItem({
  index: 0,
  text: 'text',
  iconPath: '/path/to/iconPath',
  selectedIconPath: '/path/to/selectedIconPath'
})
``` */
    setTabBarItem<T extends SetTabBarItemOption = SetTabBarItemOption>(
      option: T
    ): PromisifySuccessResult<T, SetTabBarItemOption>;
    /** [wx.setTabBarStyle(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarStyle.html)
*
* 需要基础库： `1.9.0`
*
* 在插件中使用：不支持
*
* 动态设置 tabBar 的整体样式
*
* **示例代码**
*
* ```js
wx.setTabBarStyle({
  color: '#FF0000',
  selectedColor: '#00FF00',
  backgroundColor: '#0000FF',
  borderStyle: 'white'
})
``` */
    setTabBarStyle<T extends SetTabBarStyleOption = SetTabBarStyleOption>(
      option?: T
    ): PromisifySuccessResult<T, SetTabBarStyleOption>;
    /** [wx.setTopBarText(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/sticky/wx.setTopBarText.html)
*
* 需要基础库： `1.4.3`
*
* 在插件中使用：不支持
* @deprecated 基础库版本 [1.9.9](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃
*
* 动态设置置顶栏文字内容。只有当前小程序被置顶时能生效，如果当前小程序没有被置顶，也能调用成功，但是不会立即生效，只有在用户将这个小程序置顶后才换上设置的文字内容.
*
* **示例代码**
*
* ```js
wx.setTopBarText({
  text: 'hello, world!'
})
```
*
* **注意**
*
* - 调用成功后，需间隔 5s 才能再次调用此接口，如果在 5s 内再次调用此接口，会回调 fail，errMsg："setTopBarText: fail invoke too frequently" */
    setTopBarText<T extends SetTopBarTextOption = SetTopBarTextOption>(
      option: T
    ): PromisifySuccessResult<T, SetTopBarTextOption>;
    /** [wx.setVisualEffectOnCapture(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/screen/wx.setVisualEffectOnCapture.html)
     *
     * 需要基础库： `2.20.1`
     *
     * 在插件中使用：需要基础库 `2.21.3`
     *
     * 设置截屏/录屏时屏幕表现，仅支持在 Android 端调用 */
    setVisualEffectOnCapture(option: SetVisualEffectOnCaptureOption): void;
    /** [wx.setWifiList(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.setWifiList.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 设置 `wifiList` 中 AP 的相关信息。在 `onGetWifiList` 回调后调用，**iOS特有接口**。
*
* **注意**
*
* - 该接口只能在 `onGetWifiList` 回调之后才能调用。
* - 此时客户端会挂起，等待小程序设置 Wi-Fi 信息，请务必尽快调用该接口，若无数据请传入一个空数组。
* - 有可能随着周边 Wi-Fi 列表的刷新，单个流程内收到多次带有存在重复的 Wi-Fi 列表的回调。
*
* **示例代码**
*
* ```js
wx.onGetWifiList(function(res) {
  if (res.wifiList.length) {
    wx.setWifiList({
      wifiList: [{
        SSID: res.wifiList[0].SSID,
        BSSID: res.wifiList[0].BSSID,
        password: '123456'
      }]
    })
  } else {
    wx.setWifiList({
      wifiList: []
    })
  }
})
wx.getWifiList()
``` */
    setWifiList<T extends SetWifiListOption = SetWifiListOption>(
      option: T
    ): PromisifySuccessResult<T, SetWifiListOption>;
    /** [wx.setWindowSize(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/window/wx.setWindowSize.html)
     *
     * 需要基础库： `2.10.1`
     *
     * 在插件中使用：不支持
     * @deprecated 基础库版本 [2.11.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃
     *
     * 设置窗口大小，该接口仅适用于 PC 平台，使用细则请参见指南 */
    setWindowSize(option: SetWindowSizeOption): void;
    /** [wx.shareFileMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareFileMessage.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：不支持
     *
     * 转发文件到聊天 */
    shareFileMessage<T extends ShareFileMessageOption = ShareFileMessageOption>(
      option: T
    ): PromisifySuccessResult<T, ShareFileMessageOption>;
    /** [wx.shareToWeRun(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/werun/wx.shareToWeRun.html)
     *
     * 在插件中使用：不支持
     *
     * 分享数据到微信运动。 */
    shareToWeRun<T extends ShareToWeRunOption = ShareToWeRunOption>(
      option: T
    ): PromisifySuccessResult<T, ShareToWeRunOption>;
    /** [wx.shareVideoMessage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareVideoMessage.html)
     *
     * 需要基础库： `2.16.1`
     *
     * 在插件中使用：不支持
     *
     * 转发视频到聊天 */
    shareVideoMessage<T extends ShareVideoMessageOption = ShareVideoMessageOption>(
      option: T
    ): PromisifySuccessResult<T, ShareVideoMessageOption>;
    /** [wx.showActionSheet(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showActionSheet.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 显示操作菜单
*
* **示例代码**
*
* ```js
wx.showActionSheet({
  itemList: ['A', 'B', 'C'],
  success (res) {
    console.log(res.tapIndex)
  },
  fail (res) {
    console.log(res.errMsg)
  }
})
```
*
* **注意**
*
* - Android 6.7.2 以下版本，点击取消或蒙层时，回调 fail, errMsg 为 "fail cancel"；
* - Android 6.7.2 及以上版本 和 iOS 点击蒙层不会关闭模态弹窗，所以尽量避免使用「取消」分支中实现业务逻辑 */
    showActionSheet<T extends ShowActionSheetOption = ShowActionSheetOption>(
      option: T
    ): PromisifySuccessResult<T, ShowActionSheetOption>;
    /** [wx.showLoading(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showLoading.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 显示 loading 提示框。需主动调用 wx.hideLoading 才能关闭提示框
*
* **示例代码**
*
* ```js
wx.showLoading({
  title: '加载中',
})

setTimeout(function () {
  wx.hideLoading()
}, 2000)
```
*
* **注意**
*
* - [wx.showLoading](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showLoading.html) 和 [wx.showToast](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html) 同时只能显示一个
* - [wx.showLoading](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showLoading.html) 应与 [wx.hideLoading](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideLoading.html) 配对使用 */
    showLoading<T extends ShowLoadingOption = ShowLoadingOption>(
      option: T
    ): PromisifySuccessResult<T, ShowLoadingOption>;
    /** [wx.showModal(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showModal.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 显示模态对话框
*
* **示例代码**
*
* ```js
wx.showModal({
  title: '提示',
  content: '这是一个模态弹窗',
  success (res) {
    if (res.confirm) {
      console.log('用户点击确定')
    } else if (res.cancel) {
      console.log('用户点击取消')
    }
  }
})
```
*
* **注意**
*
* - Android 6.7.2 以下版本，点击取消或蒙层时，回调 fail, errMsg 为 "fail cancel"；
* - Android 6.7.2 及以上版本 和 iOS 点击蒙层不会关闭模态弹窗，所以尽量避免使用「取消」分支中实现业务逻辑
* - 自基础库 2.17.1 版本起，支持传入 editable 参数，显示带输入框的弹窗 */
    showModal<T extends ShowModalOption = ShowModalOption>(option: T): PromisifySuccessResult<T, ShowModalOption>;
    /** [wx.showNavigationBarLoading(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.showNavigationBarLoading.html)
     *
     * 在插件中使用：需要基础库 `2.1.0`
     *
     * 在插件中使用时，只能在当前插件的页面中调用
     *
     * 在当前页面显示导航条加载动画 */
    showNavigationBarLoading<T extends ShowNavigationBarLoadingOption = ShowNavigationBarLoadingOption>(
      option?: T
    ): PromisifySuccessResult<T, ShowNavigationBarLoadingOption>;
    /** [wx.showRedPackage(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/redpackage/wx.showRedPackage.html)
     *
     * 需要基础库： `2.10.0`
     *
     * 在插件中使用：不支持
     *
     * 拉取h5领取红包封面页。获取参考红包封面地址参考 [微信红包封面开发平台](https://cover.weixin.qq.com/cgi-bin/mmcover-bin/readtemplate?t=page/index#/doc?page=introduce)。 */
    showRedPackage<T extends ShowRedPackageOption = ShowRedPackageOption>(
      option: T
    ): PromisifySuccessResult<T, ShowRedPackageOption>;
    /** [wx.showShareImageMenu(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.showShareImageMenu.html)
     *
     * 需要基础库： `2.14.3`
     *
     * 在插件中使用：需要基础库 `2.16.0`
     *
     * 打开分享图片弹窗，可以将图片发送给朋友、收藏或下载 */
    showShareImageMenu<T extends ShowShareImageMenuOption = ShowShareImageMenuOption>(
      option: T
    ): PromisifySuccessResult<T, ShowShareImageMenuOption>;
    /** [wx.showShareMenu(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.showShareMenu.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 显示当前页面的转发按钮
*
* ****
*
* ## 注意事项
*  - "shareAppMessage"表示“发送给朋友”按钮，"shareTimeline"表示“分享到朋友圈”按钮
*  - 显示“分享到朋友圈”按钮时必须同时显示“发送给朋友”按钮，显示“发送给朋友”按钮时则允许不显示“分享到朋友圈”按钮
*
* **示例代码**
*
* ```js
wx.showShareMenu({
  withShareTicket: true,
  menus: ['shareAppMessage', 'shareTimeline']
})
``` */
    showShareMenu<T extends ShowShareMenuOption = ShowShareMenuOption>(
      option: T
    ): PromisifySuccessResult<T, ShowShareMenuOption>;
    /** [wx.showTabBar(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.showTabBar.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：不支持
     *
     * 显示 tabBar */
    showTabBar<T extends ShowTabBarOption = ShowTabBarOption>(option: T): PromisifySuccessResult<T, ShowTabBarOption>;
    /** [wx.showTabBarRedDot(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.showTabBarRedDot.html)
     *
     * 需要基础库： `1.9.0`
     *
     * 在插件中使用：不支持
     *
     * 显示 tabBar 某一项的右上角的红点 */
    showTabBarRedDot<T extends ShowTabBarRedDotOption = ShowTabBarRedDotOption>(
      option: T
    ): PromisifySuccessResult<T, ShowTabBarRedDotOption>;
    /** [wx.showToast(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html)
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 显示消息提示框
*
* **示例代码**
*
* ```js
wx.showToast({
  title: '成功',
  icon: 'success',
  duration: 2000
})
```
*
* **注意**
*
* - [wx.showLoading](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showLoading.html) 和 [wx.showToast](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html) 同时只能显示一个
* - [wx.showToast](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html) 应与 [wx.hideToast](https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.hideToast.html) 配对使用 */
    showToast<T extends ShowToastOption = ShowToastOption>(option: T): PromisifySuccessResult<T, ShowToastOption>;
    /** [wx.startAccelerometer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.startAccelerometer.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 开始监听加速度数据。
*
* **示例代码**
*
* ```js
wx.startAccelerometer({
  interval: 'game'
})
```
*
* **注意**
*
* - 根据机型性能、当前 CPU 与内存的占用情况，`interval` 的设置与实际 `wx.onAccelerometerChange()` 回调函数的执行频率会有一些出入。 */
    startAccelerometer<T extends StartAccelerometerOption = StartAccelerometerOption>(
      option?: T
    ): PromisifySuccessResult<T, StartAccelerometerOption>;
    /** [wx.startBeaconDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.startBeaconDiscovery.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 开始搜索附近的 Beacon 设备
*
* **示例代码**
*
* ```js
wx.startBeaconDiscovery({
  success(res) { }
})
``` */
    startBeaconDiscovery<T extends StartBeaconDiscoveryOption = StartBeaconDiscoveryOption>(
      option: T
    ): PromisifySuccessResult<T, StartBeaconDiscoveryOption>;
    /** [wx.startBluetoothDevicesDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.startBluetoothDevicesDiscovery.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 开始搜寻附近的蓝牙外围设备。
*
* **此操作比较耗费系统资源，请在搜索到需要的设备后及时调用 [wx.stopBluetoothDevicesDiscovery](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.stopBluetoothDevicesDiscovery.html) 停止搜索。**
*
* **注意**
*
* - 考虑到蓝牙功能可以间接进行定位，安卓 6.0 及以上版本，无定位权限或定位开关未打开时，无法进行设备搜索。这种情况下，安卓 8.0.16 前，接口调用成功但无法扫描设备；8.0.16 及以上版本，会返回错误。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/m7klFDmZ72i1)
*
* ```js
// 以微信硬件平台的蓝牙智能灯为例，主服务的 UUID 是 FEE7。传入这个参数，只搜索主服务 UUID 为 FEE7 的设备
wx.startBluetoothDevicesDiscovery({
  services: ['FEE7'],
  success (res) {
    console.log(res)
  }
})
``` */
    startBluetoothDevicesDiscovery<
      T extends StartBluetoothDevicesDiscoveryOption = StartBluetoothDevicesDiscoveryOption
    >(
      option: T
    ): PromisifySuccessResult<T, StartBluetoothDevicesDiscoveryOption>;
    /** [wx.startCompass(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.startCompass.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 开始监听罗盘数据
*
* **示例代码**
*
* ```js
wx.startCompass()
``` */
    startCompass<T extends StartCompassOption = StartCompassOption>(
      option?: T
    ): PromisifySuccessResult<T, StartCompassOption>;
    /** [wx.startDeviceMotionListening(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.startDeviceMotionListening.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 开始监听设备方向的变化。 */
    startDeviceMotionListening<T extends StartDeviceMotionListeningOption = StartDeviceMotionListeningOption>(
      option?: T
    ): PromisifySuccessResult<T, StartDeviceMotionListeningOption>;
    /** [wx.startGyroscope(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.startGyroscope.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 开始监听陀螺仪数据。 */
    startGyroscope<T extends StartGyroscopeOption = StartGyroscopeOption>(
      option?: T
    ): PromisifySuccessResult<T, StartGyroscopeOption>;
    /** [wx.startHCE(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.startHCE.html)
*
* 需要基础库： `1.7.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 初始化 NFC 模块。（HCE 模式仅安卓支持）
*
* **示例代码**
*
* ```js
wx.startHCE({
  aid_list: ['F222222222'],
  success (res) {
    console.log(res.errMsg)
  }
})
``` */
    startHCE<T extends StartHCEOption = StartHCEOption>(option: T): PromisifySuccessResult<T, StartHCEOption>;
    /** [wx.startLocalServiceDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.startLocalServiceDiscovery.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 开始搜索局域网下的 mDNS 服务。搜索的结果会通过 wx.onLocalService* 事件返回。
     *
     * **注意**
     *
     * 1. 由于操作系统相关能力变更，iOS 微信客户端 7.0.18 及以上版本无法使用 mDNS 相关接口，安卓版本不受影响
     * 2. wx.startLocalServiceDiscovery 是一个消耗性能的行为，开始 30 秒后会自动 stop 并执行 wx.onLocalServiceDiscoveryStop 注册的回调函数。
     * 3. 在调用 wx.startLocalServiceDiscovery 后，在这次搜索行为停止后才能发起下次 wx.startLocalServiceDiscovery。停止本次搜索行为的操作包括调用 wx.stopLocalServiceDiscovery 和 30 秒后系统自动 stop 本次搜索。 */
    startLocalServiceDiscovery<T extends StartLocalServiceDiscoveryOption = StartLocalServiceDiscoveryOption>(
      option: T
    ): PromisifySuccessResult<T, StartLocalServiceDiscoveryOption>;
    /** [wx.startLocationUpdate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.startLocationUpdate.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：需要基础库 `2.8.0`
     *
     * 开启小程序进入前台时接收位置消息。
     *   ## 使用方法
     *  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
     *
     *   ## 申请开通
     *   暂只针对如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。从2022年7月14日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
     *
     *   ### 国内主体开放类目
     *
     *   | 一级类目/主体类型	| 二级类目	| 应用场景 |
     *   | -------------- | -------| -------- |
     *   | 电商平台 |	/	| 售卖商品线下发货、收货、送货服务 |
     *   | 商家自营 |	/	| 提供售卖商品线下发货、收货、送货服务、线下商超导览、导航服务 |
     *   | 医疗服务 | 公立医疗机构、三级私立医疗机构、其他私立医疗机构、就医服务、其他医学健康服务、药品（非处方药）销售、非处方药销售平台、医疗器械生产企业、医疗器械自营、医疗器械经营销售平台、互联网医院血液、干细胞服务、临床试验		| 1、实际物品/药品接收服务 2、基于地理位置取号并现场报到、附近医院导航等服务 |
     *   | 交通服务 |	/	| 代驾服务、租车网点导航等相关服务 |
     *   | 生活服务 |	/	| 上门服务作业等线下场景  |
     *   | 物流服务 |	收件/派件、查件、邮政、装卸搬运、快递柜、货物运输	 |	快递/货物收发服务 |
     *   | 餐饮服务 | 	点餐平台、外卖平台	| 线下送餐服务 |
     *   | 工具	| 天气、信息查询 |	与地理位置相关的服务，比如潮汐查询、海拔查询、天气查询等 |
     *   | 金融 | 保险 | 提供线下网点预约、基于地理位置取号并现场报到、附近网点导航等服务 |
     *   | 旅游 | 景区服务 | 提供景区导航、导览服务 |
     *   | 政务民生 |	/	 | 提供政务单位相关业务 |
     *   | 政府主体帐号 |	/	| 提供政务单位相关业务 |
     *
     *   ### 海外主体开放类目
     *   | 一级类目/主体类型	| 二级类目	| 应用场景 |
     *   | -------------- | -------| -------- |
     *   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
     *   | 快递业与邮政	 | /	 | 快递/货物收发服务 |
     *   | 餐饮	 | /	 | 线下送餐服务 |
     *   | 电商平台	 | /	 | 售卖商品线下发货、线下收货服务 |
     *   | 出行与交通	 | /	 | 代驾服务、租车网点导航等相关服务 |
     *   | 跨境电商	 | /	 | 提供售卖商品线下发货、收货服务、线下商超导览、导航服务 |
     *   | 本地服务	 | 服装/鞋/箱包、玩具、家电/数码/手机、美妆/洗护、珠宝/饰品/眼镜/钟表、运动/户外/乐器、鲜花/园艺/工艺品、家居/家饰/家纺、办公/文具、机械/电子器件、酒、食品、百货/超市/便利店、宠物食品/用品	 | 提供售卖商品线下发货、线下收货服务、线下商超导览、导航服务 |
     *   | 生活服务	 | 家政、外送	 | 上门服务作业等线下场景 |
     *
     * **注意**
     *
     * - 获取位置信息需配置[地理位置用途说明](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#permission)。 */
    startLocationUpdate<T extends StartLocationUpdateOption = StartLocationUpdateOption>(
      option: T
    ): PromisifySuccessResult<T, StartLocationUpdateOption>;
    /** [wx.startLocationUpdateBackground(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.startLocationUpdateBackground.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：不支持
     *
     * 开启小程序在前后台时均可接收位置消息，后台包括离开小程序后继续使用微信（微信仍在前台）、离开微信（微信在后台）两个场景，需引导用户开启[授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html#后台定位)。授权以后，小程序在运行中或进入后台均可接受位置消息变化。
     *   ## 使用方法
     *  自 2022 年 7 月 14 日后发布的小程序，若使用该接口，需要在 app.json 中进行声明，否则将无法正常使用该接口，2022年7月14日前发布的小程序不受影响。[具体规则见公告](https://developers.weixin.qq.com/community/develop/doc/000a02f2c5026891650e7f40351c01)
     *
     *   ## 申请开通
     *   暂只针对如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。从2022年7月14日开始，在代码审核环节将检测该接口是否已完成开通，如未开通，将在代码提审环节进行拦截。
     *
     *   ### 国内主体开放类目
     *
     *   | 一级类目/主体类型	| 二级类目	| 应用场景 |
     *   | -------------- | -------| -------- |
     *   | 电商平台 |	/	| 在小程序内提供线下商超导览、导航服务 |
     *   | 商家自营 |	/	| 在小程序内提供线下商超导览、导航服务 |
     *   | 交通服务 |	/	| 代驾服务、打车出行、城市共享交通、实时导航服务等 |
     *   | 生活服务 |	跑腿、共享服务	| 含有B端小程序配送服务，基于地理位置共享工具类服务  |
     *   | 物流服务 |	收件/派件、查件、邮政、装卸搬运、快递柜、货物运输	 |	提供B端小程序快递/货物收发服务 |
     *   | 餐饮服务 | 	点餐平台、外卖平台	| 提供B端小程序餐饮配送服务、线下门店实时导航 |
     *   | 工具	| 健康管理 |	基于实时地理位置提供身体管理记录等服务 |
     *   | 旅游 | 景区服务、住宿服务 | 在小程序内提供景区导航、导览服务、酒店导航服务 |
     *   | 政务民生 |	/	 | 提供政务单位相关业务 |
     *   | 政府主体帐号 |	/	| 提供政务单位相关业务 |
     *
     *   ### 海外主体开放类目
     *   | 一级类目/主体类型	| 二级类目	| 应用场景 |
     *   | -------------- | -------| -------- |
     *   | 交通服务	 | /	 | 代驾服务、打车出行、城市共享交通、实时导航服务等 |
     *   | 生活服务	 | 家政、外送	 | 含有B端小程序配送服务，基于地理位置导航上门服务 |
     *   | 快递业与邮政	 | /	 | 提供B端小程序快递/货物收发服务 |
     *   | 餐饮服务	 | 外卖点餐	 | 提供B端小程序餐饮配送服务、线下门店实时导航 |
     *   | 电商平台	 | /	 | 在小程序内提供线下商超导览、导航服务 |
     *   | 跨境电商	 | /	 | 在小程序内提供线下商超导览、导航服务 |
     *   | 本地服务	 | 服装/鞋/箱包、玩具、家电/数码/手机、美妆/洗护、珠宝/饰品/眼镜/钟表、运动/户外/乐器、鲜花/园艺/工艺品、家居/家饰/家纺、办公/文具、机械/电子器件、酒、食品、百货/超市/便利店、宠物食品/用品	 | 在小程序内提供线下商超导览、导航服务 |
     *
     * **注意**
     *
     * - 安卓微信7.0.6版本，iOS 7.0.5版本起支持该接口
     * - 需在app.json中配置requiredBackgroundModes: ['location']后使用
     * - 获取位置信息需配置[地理位置用途说明](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#permission)。 */
    startLocationUpdateBackground<T extends StartLocationUpdateBackgroundOption = StartLocationUpdateBackgroundOption>(
      option: T
    ): PromisifySuccessResult<T, StartLocationUpdateBackgroundOption>;
    /** [wx.startPullDownRefresh(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/pull-down-refresh/wx.startPullDownRefresh.html)
*
* 需要基础库： `1.5.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 开始下拉刷新。调用后触发下拉刷新动画，效果与用户手动下拉刷新一致。
*
* **示例代码**
*
* ```js
wx.startPullDownRefresh()
``` */
    startPullDownRefresh<T extends StartPullDownRefreshOption = StartPullDownRefreshOption>(
      option?: T
    ): PromisifySuccessResult<T, StartPullDownRefreshOption>;
    /** [wx.startRecord(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.startRecord.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getRecorderManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.getRecorderManager.html) 替换
*
* 开始录音。当主动调用 [wx.stopRecord](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.stopRecord.html)，或者录音超过1分钟时自动结束录音。当用户离开小程序时，此接口无法调用。
*
* **示例代码**
*
* ```js
wx.startRecord({
  success (res) {
    const tempFilePath = res.tempFilePath
  }
})
setTimeout(function () {
  wx.stopRecord() // 结束录音
}, 10000)
``` */
    startRecord<T extends WxStartRecordOption = WxStartRecordOption>(
      option?: T
    ): PromisifySuccessResult<T, WxStartRecordOption>;
    /** [wx.startSoterAuthentication(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/soter/wx.startSoterAuthentication.html)
*
* 需要基础库： `1.5.0`
*
* 在插件中使用：不支持
*
* 开始 SOTER 生物认证。验证流程请参考[说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/bio-auth.html)。
*
* **resultJSON 说明**
*
* 此数据为设备TEE中，将传入的challenge和TEE内其他安全信息组成的数据进行组装而来的JSON，对下述字段的解释如下表。例子如下：
* | 字段名  | 说明                                                                                      |
* |---------|-------------------------------------------------------------------------------------------|
* | raw     | 调用者传入的challenge                                                                     |
* | fid     | （仅Android支持）本次生物识别认证的生物信息编号（如指纹识别则是指纹信息在本设备内部编号） |
* | counter | 防重放特征参数                                                                            |
* | tee_n   | TEE名称（如高通或者trustonic等）                                                          |
* | tee_v   | TEE版本号                                                                                 |
* | fp_n    | 指纹以及相关逻辑模块提供商（如FPC等）                                                     |
* | fp_v    | 指纹以及相关模块版本号                                                                    |
* | cpu_id  | 机器唯一识别ID                                                                            |
* | uid     | 概念同Android系统定义uid，即应用程序编号                                                  |
*
* ```json
{
  "raw":"msg",
  "fid":"2",
  "counter":123,
  "tee_n":"TEE Name",
  "tee_v":"TEE Version",
  "fp_n":"Fingerprint Sensor Name",
  "fp_v":"Fingerprint Sensor Version",
  "cpu_id":"CPU Id",
  "uid":"21"
}
```
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/q3tCKkmJ7g2e)
* ```js
wx.startSoterAuthentication({
   requestAuthModes: ['fingerPrint'],
   challenge: '123456',
   authContent: '请用指纹解锁',
   success(res) {
   }
})
``` */
    startSoterAuthentication<T extends StartSoterAuthenticationOption = StartSoterAuthenticationOption>(
      option: T
    ): PromisifySuccessResult<T, StartSoterAuthenticationOption>;
    /** [wx.startWifi(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.startWifi.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 初始化 Wi-Fi 模块。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/8P7zrkmd7r2n)
* ```js
wx.startWifi({
  success (res) {
    console.log(res.errMsg)
  }
})
``` */
    startWifi<T extends StartWifiOption = StartWifiOption>(option?: T): PromisifySuccessResult<T, StartWifiOption>;
    /** [wx.stopAccelerometer(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/accelerometer/wx.stopAccelerometer.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 停止监听加速度数据。
*
* **示例代码**
*
* ```js
wx.stopAccelerometer()
``` */
    stopAccelerometer<T extends StopAccelerometerOption = StopAccelerometerOption>(
      option?: T
    ): PromisifySuccessResult<T, StopAccelerometerOption>;
    /** [wx.stopBackgroundAudio(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.stopBackgroundAudio.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.2.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getBackgroundAudioManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html) 替换
*
* 停止播放音乐。
*
* **示例代码**
*
* ```js
wx.stopBackgroundAudio()
``` */
    stopBackgroundAudio<T extends StopBackgroundAudioOption = StopBackgroundAudioOption>(
      option?: T
    ): PromisifySuccessResult<T, StopBackgroundAudioOption>;
    /** [wx.stopBeaconDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.stopBeaconDiscovery.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 停止搜索附近的 Beacon 设备 */
    stopBeaconDiscovery<T extends StopBeaconDiscoveryOption = StopBeaconDiscoveryOption>(
      option?: T
    ): PromisifySuccessResult<T, StopBeaconDiscoveryOption>;
    /** [wx.stopBluetoothDevicesDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.stopBluetoothDevicesDiscovery.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 停止搜寻附近的蓝牙外围设备。若已经找到需要的蓝牙设备并不需要继续搜索时，建议调用该接口停止蓝牙搜索。
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
wx.stopBluetoothDevicesDiscovery({
  success (res) {
    console.log(res)
  }
})
``` */
    stopBluetoothDevicesDiscovery<T extends StopBluetoothDevicesDiscoveryOption = StopBluetoothDevicesDiscoveryOption>(
      option?: T
    ): PromisifySuccessResult<T, StopBluetoothDevicesDiscoveryOption>;
    /** [wx.stopCompass(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/compass/wx.stopCompass.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 停止监听罗盘数据
*
* **示例代码**
*
* ```js
wx.stopCompass()
``` */
    stopCompass<T extends StopCompassOption = StopCompassOption>(
      option?: T
    ): PromisifySuccessResult<T, StopCompassOption>;
    /** [wx.stopDeviceMotionListening(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/motion/wx.stopDeviceMotionListening.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 停止监听设备方向的变化。 */
    stopDeviceMotionListening<T extends StopDeviceMotionListeningOption = StopDeviceMotionListeningOption>(
      option?: T
    ): PromisifySuccessResult<T, StopDeviceMotionListeningOption>;
    /** [wx.stopFaceDetect(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ai/face/wx.stopFaceDetect.html)
     *
     * 需要基础库： `2.18.0`
     *
     * 在插件中使用：需要基础库 `2.21.3`
     *
     * @warning **该接口已停止维护，推荐使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 代替**
     *
     * 停止人脸检测。本接口不再维护，请使用 [wx.createVKSession](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html) 接口代替。详情参考[人脸检测指南文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/face.html) */
    stopFaceDetect(option?: StopFaceDetectOption): void;
    /** [wx.stopGyroscope(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/gyroscope/wx.stopGyroscope.html)
     *
     * 需要基础库： `2.3.0`
     *
     * 在插件中使用：需要基础库 `2.9.1`
     *
     * 停止监听陀螺仪数据。 */
    stopGyroscope<T extends StopGyroscopeOption = StopGyroscopeOption>(
      option?: T
    ): PromisifySuccessResult<T, StopGyroscopeOption>;
    /** [wx.stopHCE(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/nfc-hce/wx.stopHCE.html)
*
* 需要基础库： `1.7.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 关闭 NFC 模块。仅在安卓系统下有效。
*
* **示例代码**
*
* ```js
wx.stopHCE({
  success (res) {
    console.log(res.errMsg)
  }
})
``` */
    stopHCE<T extends StopHCEOption = StopHCEOption>(option?: T): PromisifySuccessResult<T, StopHCEOption>;
    /** [wx.stopLocalServiceDiscovery(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/network/mdns/wx.stopLocalServiceDiscovery.html)
     *
     * 需要基础库： `2.4.0`
     *
     * 在插件中使用：需要基础库 `2.15.0`
     *
     * 停止搜索 mDNS 服务 */
    stopLocalServiceDiscovery<T extends StopLocalServiceDiscoveryOption = StopLocalServiceDiscoveryOption>(
      option?: T
    ): PromisifySuccessResult<T, StopLocalServiceDiscoveryOption>;
    /** [wx.stopLocationUpdate(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.stopLocationUpdate.html)
     *
     * 需要基础库： `2.8.0`
     *
     * 在插件中使用：需要基础库 `2.8.0`
     *
     * 关闭监听实时位置变化，前后台都停止消息接收 */
    stopLocationUpdate<T extends StopLocationUpdateOption = StopLocationUpdateOption>(
      option?: T
    ): PromisifySuccessResult<T, StopLocationUpdateOption>;
    /** [wx.stopPullDownRefresh(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/ui/pull-down-refresh/wx.stopPullDownRefresh.html)
*
* 需要基础库： `1.5.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 停止当前页面下拉刷新。
*
* **示例代码**
*
* ```js
Page({
  onPullDownRefresh () {
    wx.stopPullDownRefresh()
  }
})
``` */
    stopPullDownRefresh<T extends StopPullDownRefreshOption = StopPullDownRefreshOption>(
      option?: T
    ): PromisifySuccessResult<T, StopPullDownRefreshOption>;
    /** [wx.stopRecord(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.stopRecord.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.getRecorderManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/wx.getRecorderManager.html) 替换
*
* 停止录音。
*
* **示例代码**
*
* ```js
wx.startRecord({
  success (res) {
    const tempFilePath = res.tempFilePath
  }
})
setTimeout(function () {
  wx.stopRecord() // 结束录音
}, 10000)
``` */
    stopRecord<T extends WxStopRecordOption = WxStopRecordOption>(
      option?: T
    ): PromisifySuccessResult<T, WxStopRecordOption>;
    /** [wx.stopVoice(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.stopVoice.html)
*
* 在插件中使用：需要基础库 `1.9.6`
* @deprecated 基础库版本 [1.6.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起已废弃，请使用 [wx.createInnerAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createInnerAudioContext.html) 替换
*
* 结束播放语音。
*
* **示例代码**
*
* ```js
wx.startRecord({
  success (res) {
    const tempFilePath = res.tempFilePath
    wx.playVoice({
      filePath: tempFilePath,
    })

    setTimeout(() => { wx.stopVoice() }, 5000)
  }
})
``` */
    stopVoice<T extends StopVoiceOption = StopVoiceOption>(option?: T): PromisifySuccessResult<T, StopVoiceOption>;
    /** [wx.stopWifi(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/wifi/wx.stopWifi.html)
*
* 需要基础库： `1.6.0`
*
* 在插件中使用：需要基础库 `2.9.1`
*
* 关闭 Wi-Fi 模块。
*
* **示例代码**
*
* ```js
wx.stopWifi({
  success (res) {
    console.log(res.errMsg)
  }
})
``` */
    stopWifi<T extends StopWifiOption = StopWifiOption>(option?: T): PromisifySuccessResult<T, StopWifiOption>;
    /** [wx.subscribeVoIPVideoMembers(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.subscribeVoIPVideoMembers.html)
     *
     * 需要基础库： `2.11.0`
     *
     * 在插件中使用：需要基础库 `2.11.0`
     *
     * 订阅视频画面成员。对于视频房间，当成员超过两人时需进行订阅，否则只能看到最先加入房间的两人画面。 */
    subscribeVoIPVideoMembers<T extends SubscribeVoIPVideoMembersOption = SubscribeVoIPVideoMembersOption>(
      option: T
    ): PromisifySuccessResult<T, SubscribeVoIPVideoMembersOption>;
    /** [wx.switchTab(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.switchTab.html)
*
* 在插件中使用：需要基础库 `2.3.1`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面
*
* **示例代码**
*
* ```json
// app.json
{
  "tabBar": {
    "list": [{
      "pagePath": "index",
      "text": "首页"
    },{
      "pagePath": "other",
      "text": "其他"
    }]
  }
}
```
*
* ```js
wx.switchTab({
  url: '/index'
})
``` */
    switchTab<T extends SwitchTabOption = SwitchTabOption>(option: T): PromisifySuccessResult<T, SwitchTabOption>;
    /** [wx.updateShareMenu(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.updateShareMenu.html)
*
* 需要基础库： `1.2.0`
*
* 在插件中使用：需要基础库 `2.1.0`
*
* 在插件中使用时，只能在当前插件的页面中调用
*
* 更新转发属性
*
* **示例代码**
*
* ```js
wx.updateShareMenu({
  withShareTicket: true,
  success () { }
})
```
* ```js
// 转发私密消息
wx.updateShareMenu({
  isPrivateMessage: true,
  activityId: 'xxx',
  templateInfo: {},
  success () { },
  fail () {}
})
``` */
    updateShareMenu<T extends UpdateShareMenuOption = UpdateShareMenuOption>(
      option: T
    ): PromisifySuccessResult<T, UpdateShareMenuOption>;
    /** [wx.updateVoIPChatMuteConfig(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.updateVoIPChatMuteConfig.html)
     *
     * 需要基础库： `2.7.0`
     *
     * 在插件中使用：需要基础库 `2.9.0`
     *
     * 更新实时语音静音设置 */
    updateVoIPChatMuteConfig<T extends UpdateVoIPChatMuteConfigOption = UpdateVoIPChatMuteConfigOption>(
      option: T
    ): PromisifySuccessResult<T, UpdateVoIPChatMuteConfigOption>;
    /** [wx.updateWeChatApp(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/wx.updateWeChatApp.html)
     *
     * 需要基础库： `2.12.0`
     *
     * 在插件中使用：需要基础库 `2.12.0`
     *
     * 更新客户端版本。当判断用户小程序所在客户端版本过低时，可使用该接口跳转到更新微信页面。 */
    updateWeChatApp<T extends UpdateWeChatAppOption = UpdateWeChatAppOption>(
      option?: T
    ): PromisifySuccessResult<T, UpdateWeChatAppOption>;
    /** [wx.vibrateLong(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/vibrate/wx.vibrateLong.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 使手机发生较长时间的振动（400 ms) */
    vibrateLong<T extends VibrateLongOption = VibrateLongOption>(
      option?: T
    ): PromisifySuccessResult<T, VibrateLongOption>;
    /** [wx.vibrateShort(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/vibrate/wx.vibrateShort.html)
     *
     * 需要基础库： `1.2.0`
     *
     * 在插件中使用：需要基础库 `1.9.6`
     *
     * 使手机发生较短时间的振动（15 ms）。仅在 iPhone `7 / 7 Plus` 以上及 Android 机型生效 */
    vibrateShort<T extends VibrateShortOption = VibrateShortOption>(
      option: T
    ): PromisifySuccessResult<T, VibrateShortOption>;
    /** [wx.writeBLECharacteristicValue(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.writeBLECharacteristicValue.html)
*
* 需要基础库： `1.1.0`
*
* 在插件中使用：需要基础库 `1.9.6`
*
* 向蓝牙低功耗设备特征值中写入二进制数据。注意：必须设备的特征支持 write 才可以成功调用。
*
* **注意**
*
* - 并行调用多次会存在写失败的可能性。
* - 小程序不会对写入数据包大小做限制，但系统与蓝牙设备会限制蓝牙 4.0 单次传输的数据大小，超过最大字节数后会发生写入错误，建议每次写入不超过 20 字节。
* - 若单次写入数据过长，iOS 上存在系统不会有任何回调的情况（包括错误回调）。
* - 安卓平台上，在调用 [wx.notifyBLECharacteristicValueChange](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth-ble/wx.notifyBLECharacteristicValueChange.html) 成功后立即调用本接口，在部分机型上会发生 10008 系统错误
*
* **示例代码**
*
* [在微信开发者工具中查看示例](https://developers.weixin.qq.com/s/pQU51zmz7a3K)
* ```js
// 向蓝牙设备发送一个0x00的16进制数据
let buffer = new ArrayBuffer(1)
let dataView = new DataView(buffer)
dataView.setUint8(0, 0)

wx.writeBLECharacteristicValue({
  // 这里的 deviceId 需要在 getBluetoothDevices 或 onBluetoothDeviceFound 接口中获取
  deviceId,
  // 这里的 serviceId 需要在 getBLEDeviceServices 接口中获取
  serviceId,
  // 这里的 characteristicId 需要在 getBLEDeviceCharacteristics 接口中获取
  characteristicId,
  // 这里的value是ArrayBuffer类型
  value: buffer,
  success (res) {
    console.log('writeBLECharacteristicValue success', res.errMsg)
  }
})
``` */
    writeBLECharacteristicValue<T extends WriteBLECharacteristicValueOption = WriteBLECharacteristicValueOption>(
      option: T
    ): PromisifySuccessResult<T, WriteBLECharacteristicValueOption>;
    /** 小程序云开发 */
    cloud: WxCloud;
    /** 文件系统中的用户目录路径 */
    env: { USER_DATA_PATH: string };
    /** 获得 xr-frame 接口系统 */
    getXrFrameSystem(): import('XrFrame').IXrFrameSystem;
    /** 需要基础库： `2.29.2`
     *
     * router 对象，可以通过 `wx.router` 获取。 */
    router: Router;
    /** 需要基础库： `2.29.2`
     *
     * worklet 对象，可以通过 `wx.worklet` 获取。 */
    worklet: Worklet;
  }

  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AccessCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type AccessFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type AccessSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddArcCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddArcFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddArcSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddCardCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddCardFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddCardSuccessCallback = (result: AddCardSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddCustomLayerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddCustomLayerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddCustomLayerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddFileToFavoritesCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddFileToFavoritesFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddFileToFavoritesSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddGroundOverlayCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddGroundOverlayFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddGroundOverlaySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddMarkersCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddMarkersFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddMarkersSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddPhoneCalendarCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddPhoneCalendarFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddPhoneCalendarSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddPhoneContactCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddPhoneContactFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddPhoneContactSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddPhoneRepeatCalendarCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddPhoneRepeatCalendarFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddPhoneRepeatCalendarSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddServiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddServiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddServiceSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddVideoToFavoritesCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddVideoToFavoritesFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddVideoToFavoritesSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AddVisualLayerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AddVisualLayerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AddVisualLayerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AppendFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type AppendFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type AppendFileSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyBlusherStickMakeupCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyBlusherStickMakeupFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyBlusherStickMakeupSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyEyeBrowMakeupCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyEyeBrowMakeupFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyEyeBrowMakeupSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyEyeShadowMakeupCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyEyeShadowMakeupFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyEyeShadowMakeupSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyFaceContourMakeupCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyFaceContourMakeupFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyFaceContourMakeupSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyFilterCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyFilterFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyFilterSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyLipStickMakeupCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyLipStickMakeupFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyLipStickMakeupSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ApplyStickerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ApplyStickerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ApplyStickerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AuthPrivateMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AuthPrivateMessageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AuthPrivateMessageSuccessCallback = (result: AuthPrivateMessageSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AuthorizeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AuthorizeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type AuthorizeForMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type AuthorizeForMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AuthorizeForMiniProgramSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type AuthorizeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 背景音频播放错误事件的监听函数 */
  type BackgroundAudioManagerOnErrorCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type BatchGetStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type BatchGetStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type BatchGetStorageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type BatchSetStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type BatchSetStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type BatchSetStorageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type BlurCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type BlurFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type BlurSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 回调函数，在执行 `SelectorQuery.exec` 方法后，节点信息会在 `callback` 中返回。 */
  type BoundingClientRectCallback = (result: BoundingClientRectCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CameraContextSetZoomSuccessCallback = (result: SetZoomSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CameraContextStartRecordSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CameraContextStopRecordSuccessCallback = (result: StopRecordSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CanvasGetImageDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CanvasGetImageDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CanvasGetImageDataSuccessCallback = (result: CanvasGetImageDataSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CanvasPutImageDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CanvasPutImageDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CanvasPutImageDataSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CanvasToTempFilePathCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CanvasToTempFilePathFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CanvasToTempFilePathSuccessCallback = (result: CanvasToTempFilePathSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CheckIsAddedToMyMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CheckIsAddedToMyMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CheckIsAddedToMyMiniProgramSuccessCallback = (result: CheckIsAddedToMyMiniProgramSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CheckIsOpenAccessibilityCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CheckIsOpenAccessibilityFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CheckIsOpenAccessibilitySuccessCallback = (option: CheckIsOpenAccessibilitySuccessCallbackOption) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CheckIsSoterEnrolledInDeviceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CheckIsSoterEnrolledInDeviceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CheckIsSoterEnrolledInDeviceSuccessCallback = (
    result: CheckIsSoterEnrolledInDeviceSuccessCallbackResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CheckIsSupportSoterAuthenticationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CheckIsSupportSoterAuthenticationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CheckIsSupportSoterAuthenticationSuccessCallback = (
    result: CheckIsSupportSoterAuthenticationSuccessCallbackResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CheckSessionCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CheckSessionFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CheckSessionSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseAddressCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseAddressFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseAddressSuccessCallback = (result: ChooseAddressSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseContactCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseContactFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseContactSuccessCallback = (option: ChooseContactSuccessCallbackOption) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseImageSuccessCallback = (result: ChooseImageSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseInvoiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseInvoiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseInvoiceSuccessCallback = (result: ChooseInvoiceSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseInvoiceTitleCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseInvoiceTitleFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseInvoiceTitleSuccessCallback = (result: ChooseInvoiceTitleSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseLicensePlateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseLicensePlateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseLicensePlateSuccessCallback = (result: ChooseLicensePlateSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseLocationSuccessCallback = (result: ChooseLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseMediaCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseMediaFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseMediaSuccessCallback = (result: ChooseMediaSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseMessageFileCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseMessageFileFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseMessageFileSuccessCallback = (result: ChooseMessageFileSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChoosePoiCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChoosePoiFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChoosePoiSuccessCallback = (result: ChoosePoiSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ChooseVideoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ChooseVideoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ChooseVideoSuccessCallback = (result: ChooseVideoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ClearCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ClearFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ClearFiltersCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ClearFiltersFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ClearFiltersSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ClearMakeupsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ClearMakeupsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ClearMakeupsSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ClearStickersCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ClearStickersFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ClearStickersSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ClearStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ClearStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ClearStorageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ClearSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CloseBLEConnectionCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type CloseBLEConnectionFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type CloseBLEConnectionSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CloseBluetoothAdapterCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type CloseBluetoothAdapterFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type CloseBluetoothAdapterSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CloseSocketCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CloseSocketFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CloseSocketSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CompressImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CompressImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CompressImageSuccessCallback = (result: CompressImageSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CompressVideoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CompressVideoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CompressVideoSuccessCallback = (result: CompressVideoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ConnectCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type ConnectFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ConnectSocketCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ConnectSocketFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ConnectSocketSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ConnectSuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ConnectWifiCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type ConnectWifiFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type ConnectWifiSuccessCallback = (res: WifiError) => void;
  /** 回调函数，在执行 `SelectorQuery.exec` 方法后，返回节点信息。 */
  type ContextCallback = (result: ContextCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CopyFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type CopyFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type CopyFileSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CreateBLEConnectionCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type CreateBLEConnectionFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type CreateBLEConnectionSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CreateBLEPeripheralServerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CreateBLEPeripheralServerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CreateBLEPeripheralServerSuccessCallback = (result: CreateBLEPeripheralServerSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type CropImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type CropImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type CropImageSuccessCallback = (result: EditImageSuccessCallbackResult) => void;
  /** 自定义渲染事件处理回调函数 */
  type CustomRendererFrameEventCallback = (result: OnCustomRendererEventCallbackResult) => void;
  /** [路由动画定义函数](#) */
  type CustomRouteBuilder = (
    /** 自定义路由上下文对象 */
    customRouteContext: CustomRouteContext
  ) => CustomRouteConfig;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type DisableAlertBeforeUnloadCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type DisableAlertBeforeUnloadFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type DisableAlertBeforeUnloadSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type DownloadFileCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type DownloadFileFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type DownloadFileSuccessCallback = (result: DownloadFileSuccessCallbackResult) => void;
  /** onProgressUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
  type DownloadTaskOffProgressUpdateCallback = (result: DownloadTaskOnProgressUpdateListenerResult) => void;
  /** 下载进度变化事件的监听函数 */
  type DownloadTaskOnProgressUpdateCallback = (result: DownloadTaskOnProgressUpdateListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type EditImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type EditImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type EditImageSuccessCallback = (result: EditImageSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type EnableAlertBeforeUnloadCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type EnableAlertBeforeUnloadFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type EnableAlertBeforeUnloadSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type EraseLinesCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type EraseLinesFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type EraseLinesSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 事件监听函数 */
  type EventCallback = (
    /** 触发事件参数 */
    ...args: any
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExecuteVisualLayerCommandCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExecuteVisualLayerCommandFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExecuteVisualLayerCommandSuccessCallback = (result: ExecuteVisualLayerCommandSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExitCastingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExitCastingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExitCastingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExitFullScreenCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExitFullScreenFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExitFullScreenSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExitMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExitMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExitMiniProgramSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExitPictureInPictureCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExitPictureInPictureFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExitPictureInPictureSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ExitVoIPChatCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ExitVoIPChatFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ExitVoIPChatSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type FaceDetectCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type FaceDetectFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type FaceDetectSuccessCallback = (result: FaceDetectSuccessCallbackResult) => void;
  /** 回调函数 */
  type FieldsCallback = (
    /** 节点的相关信息 */
    res: IAnyObject
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type FileSystemManagerCloseCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type FileSystemManagerCloseFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type FileSystemManagerCloseSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type FromScreenLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type FromScreenLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type FromScreenLocationSuccessCallback = (result: GetCenterLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type FstatCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type FstatFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type FstatSuccessCallback = (result: FstatSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type FtruncateCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type FtruncateFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type FtruncateSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetAtqaCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type GetAtqaFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type GetAtqaSuccessCallback = (result: GetAtqaSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetAvailableAudioSourcesCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetAvailableAudioSourcesFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetAvailableAudioSourcesSuccessCallback = (result: GetAvailableAudioSourcesSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBLEDeviceCharacteristicsCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetBLEDeviceCharacteristicsFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetBLEDeviceCharacteristicsSuccessCallback = (result: GetBLEDeviceCharacteristicsSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBLEDeviceRSSICompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetBLEDeviceRSSIFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetBLEDeviceRSSISuccessCallback = (result: GetBLEDeviceRSSISuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBLEDeviceServicesCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetBLEDeviceServicesFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetBLEDeviceServicesSuccessCallback = (result: GetBLEDeviceServicesSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBLEMTUCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetBLEMTUFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetBLEMTUSuccessCallback = (result: GetBLEMTUSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBackgroundAudioPlayerStateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetBackgroundAudioPlayerStateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetBackgroundAudioPlayerStateSuccessCallback = (
    result: GetBackgroundAudioPlayerStateSuccessCallbackResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBackgroundFetchDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetBackgroundFetchDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetBackgroundFetchDataSuccessCallback = (result: GetBackgroundFetchDataSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBackgroundFetchTokenCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetBackgroundFetchTokenFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetBackgroundFetchTokenSuccessCallback = (result: GetBackgroundFetchTokenSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBatteryInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetBatteryInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetBatteryInfoSuccessCallback = (result: GetBatteryInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBeaconsCompleteCallback = (res: BeaconError) => void;
  /** 接口调用失败的回调函数 */
  type GetBeaconsFailCallback = (res: BeaconError) => void;
  /** 接口调用成功的回调函数 */
  type GetBeaconsSuccessCallback = (result: GetBeaconsSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBluetoothAdapterStateCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetBluetoothAdapterStateFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetBluetoothAdapterStateSuccessCallback = (result: GetBluetoothAdapterStateSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetBluetoothDevicesCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetBluetoothDevicesFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetBluetoothDevicesSuccessCallback = (result: GetBluetoothDevicesSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetCenterLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetCenterLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetCenterLocationSuccessCallback = (result: GetCenterLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetChannelsLiveInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetChannelsLiveInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetChannelsLiveInfoSuccessCallback = (result: GetChannelsLiveInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetChannelsLiveNoticeInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetChannelsLiveNoticeInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetChannelsLiveNoticeInfoSuccessCallback = (result: GetChannelsLiveNoticeInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetChannelsShareKeyCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetChannelsShareKeyFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetChannelsShareKeySuccessCallback = (result: GetChannelsShareKeySuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetClipboardDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetClipboardDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetClipboardDataSuccessCallback = (option: GetClipboardDataSuccessCallbackOption) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetConnectedBluetoothDevicesCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type GetConnectedBluetoothDevicesFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type GetConnectedBluetoothDevicesSuccessCallback = (
    result: GetConnectedBluetoothDevicesSuccessCallbackResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetConnectedWifiCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type GetConnectedWifiFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type GetConnectedWifiSuccessCallback = (result: GetConnectedWifiSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetContentsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetContentsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetContentsSuccessCallback = (result: GetContentsSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetDeviceVoIPListCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetDeviceVoIPListFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetDeviceVoIPListSuccessCallback = (result: GetDeviceVoIPListSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetExtConfigCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetExtConfigFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetExtConfigSuccessCallback = (result: GetExtConfigSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetFileInfoCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type GetFileInfoFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type GetFileInfoSuccessCallback = (result: GetFileInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetFuzzyLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetFuzzyLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetFuzzyLocationSuccessCallback = (result: GetFuzzyLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetGroupEnterInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetGroupEnterInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetGroupEnterInfoSuccessCallback = (result: GetGroupEnterInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetHCEStateCompleteCallback = (res: NFCError) => void;
  /** 接口调用失败的回调函数 */
  type GetHCEStateFailCallback = (res: NFCError) => void;
  /** 接口调用成功的回调函数 */
  type GetHCEStateSuccessCallback = (res: NFCError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetHistoricalBytesCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type GetHistoricalBytesFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type GetHistoricalBytesSuccessCallback = (result: GetHistoricalBytesSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetImageInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetImageInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetImageInfoSuccessCallback = (result: GetImageInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetInferenceEnvInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetInferenceEnvInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetInferenceEnvInfoSuccessCallback = (result: GetInferenceEnvInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetLatestUserKeyCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetLatestUserKeyFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetLatestUserKeySuccessCallback = (result: GetLatestUserKeySuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetLocalIPAddressCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetLocalIPAddressFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetLocalIPAddressSuccessCallback = (result: GetLocalIPAddressSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetLocationSuccessCallback = (result: GetLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetMaxTransceiveLengthCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type GetMaxTransceiveLengthFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type GetMaxTransceiveLengthSuccessCallback = (result: GetMaxTransceiveLengthSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetMaxZoomCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetMaxZoomFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetMaxZoomSuccessCallback = (result: GetMaxZoomSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetNetworkTypeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetNetworkTypeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetNetworkTypeSuccessCallback = (result: GetNetworkTypeSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetRandomValuesCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetRandomValuesFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetRandomValuesSuccessCallback = (result: GetRandomValuesSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetRegionCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetRegionFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetRegionSuccessCallback = (result: GetRegionSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetRendererUserAgentCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetRendererUserAgentFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetRendererUserAgentSuccessCallback = (
    /** UserAgent */
    userAgent: string
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetRotateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetRotateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetRotateSuccessCallback = (result: GetRotateSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSakCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type GetSakFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type GetSakSuccessCallback = (result: GetSakSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSavedFileListCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSavedFileListFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSavedFileListSuccessCallback = (result: GetSavedFileListSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetScaleCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetScaleFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetScaleSuccessCallback = (result: GetScaleSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetScreenBrightnessCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetScreenBrightnessFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetScreenBrightnessSuccessCallback = (option: GetScreenBrightnessSuccessCallbackOption) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetScreenRecordingStateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetScreenRecordingStateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetScreenRecordingStateSuccessCallback = (result: GetScreenRecordingStateSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSelectedTextRangeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSelectedTextRangeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSelectedTextRangeSuccessCallback = (result: GetSelectedTextRangeSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSelectionTextCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSelectionTextFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSelectionTextSuccessCallback = (result: GetSelectionTextSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSettingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSettingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSettingSuccessCallback = (result: GetSettingSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetShareInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetShareInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetShareInfoSuccessCallback = (result: GetGroupEnterInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSkewCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSkewFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSkewSuccessCallback = (result: GetSkewSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSkylineInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSkylineInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSkylineInfoSuccessCallback = (
    /** 当前运行环境对于 [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html) 的支持情况 */
    result: SkylineInfo
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetStorageInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetStorageInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetStorageInfoSuccessCallback = (option: GetStorageInfoSuccessCallbackOption) => void;
  /** 接口调用成功的回调函数 */
  type GetStorageSuccessCallback<T = any> = (result: GetStorageSuccessCallbackResult<T>) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSystemInfoAsyncCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSystemInfoAsyncFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSystemInfoAsyncSuccessCallback = (result: SystemInfo) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetSystemInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetSystemInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetSystemInfoSuccessCallback = (result: SystemInfo) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetUserInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetUserInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetUserInfoSuccessCallback = (result: GetUserInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetUserProfileCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetUserProfileFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetUserProfileSuccessCallback = (result: GetUserProfileSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetVideoInfoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetVideoInfoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetVideoInfoSuccessCallback = (result: GetVideoInfoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetWeRunDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type GetWeRunDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type GetWeRunDataSuccessCallback = (result: GetWeRunDataSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type GetWifiListCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type GetWifiListFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type GetWifiListSuccessCallback = (res: WifiError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideHomeButtonCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideHomeButtonFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideHomeButtonSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideKeyboardCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideKeyboardFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideKeyboardSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideLoadingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideLoadingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideLoadingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideNavigationBarLoadingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideNavigationBarLoadingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideNavigationBarLoadingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideShareMenuCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideShareMenuFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideShareMenuSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideTabBarCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideTabBarFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideTabBarRedDotCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideTabBarRedDotFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideTabBarRedDotSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideTabBarSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type HideToastCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type HideToastFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type HideToastSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type IncludePointsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type IncludePointsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type IncludePointsSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type InitFaceDetectCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type InitFaceDetectFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type InitFaceDetectSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type InitMarkerClusterCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type InitMarkerClusterFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type InitMarkerClusterSuccessCallback = (res: GeneralCallbackResult) => void;
  /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type InnerAudioContextOffErrorCallback = (result: InnerAudioContextOnErrorListenerResult) => void;
  /** 音频播放错误事件的监听函数 */
  type InnerAudioContextOnErrorCallback = (result: InnerAudioContextOnErrorListenerResult) => void;
  type InnerAudioContextOnStopCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type InsertDividerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type InsertDividerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type InsertDividerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type InsertImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type InsertImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type InsertImageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type InsertTextCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type InsertTextFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type InsertTextSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 监听相交状态变化的回调函数 */
  type IntersectionObserverObserveCallback = (result: IntersectionObserverObserveCallbackResult) => void;
  /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type InterstitialAdOffErrorCallback = (result: InterstitialAdOnErrorListenerResult) => void;
  /** 插屏错误事件的监听函数 */
  type InterstitialAdOnErrorCallback = (result: InterstitialAdOnErrorListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type IsBluetoothDevicePairedCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type IsBluetoothDevicePairedFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type IsBluetoothDevicePairedSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type IsConnectedCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type IsConnectedFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type IsConnectedSuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type Join1v1ChatCompleteCallback = (res: Join1v1ChatError) => void;
  /** 接口调用失败的回调函数 */
  type Join1v1ChatFailCallback = (res: Join1v1ChatError) => void;
  /** 接口调用成功的回调函数 */
  type Join1v1ChatSuccessCallback = (res: Join1v1ChatError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type JoinVoIPChatCompleteCallback = (res: JoinVoIPChatError) => void;
  /** 接口调用失败的回调函数 */
  type JoinVoIPChatFailCallback = (res: JoinVoIPChatError) => void;
  /** 接口调用成功的回调函数 */
  type JoinVoIPChatSuccessCallback = (result: JoinVoIPChatSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type LivePlayerContextSnapshotSuccessCallback = (result: LivePlayerContextSnapshotSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type LivePusherContextSetZoomSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type LivePusherContextSnapshotSuccessCallback = (result: LivePusherContextSnapshotSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type LoadFontFaceCompleteCallback = (result: LoadFontFaceCompleteCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type LoadFontFaceFailCallback = (result: LoadFontFaceCompleteCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type LoadFontFaceSuccessCallback = (result: LoadFontFaceCompleteCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type LoginCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type LoginFailCallback = (err: Err) => void;
  /** 接口调用成功的回调函数 */
  type LoginSuccessCallback = (result: LoginSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MakeBluetoothPairCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type MakeBluetoothPairFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type MakeBluetoothPairSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MakePhoneCallCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type MakePhoneCallFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type MakePhoneCallSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 监听 media query 状态变化的回调函数 */
  type MediaQueryObserverObserveCallback = (result: MediaQueryObserverObserveCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MkdirCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type MkdirFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type MkdirSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MoveAlongCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type MoveAlongFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type MoveAlongSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MoveToLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type MoveToLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type MoveToLocationSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type MuteCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type MuteFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type MuteSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NavigateBackCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type NavigateBackFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NavigateBackMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type NavigateBackMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type NavigateBackMiniProgramSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type NavigateBackSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NavigateToCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type NavigateToFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NavigateToMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type NavigateToMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type NavigateToMiniProgramSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type NavigateToSuccessCallback = (result: NavigateToSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NdefCloseCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type NdefCloseFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type NdefCloseSuccessCallback = (res: Nfcrwerror) => void;
  /** 回调函数，在执行 `SelectorQuery.exec` 方法后，返回节点信息。 */
  type NodeCallback = (result: NodeCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type NotifyBLECharacteristicValueChangeCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type NotifyBLECharacteristicValueChangeFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type NotifyBLECharacteristicValueChangeSuccessCallback = (res: BluetoothError) => void;
  /** onAccelerometerChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffAccelerometerChangeCallback = (res: GeneralCallbackResult) => void;
  /** onAppHide 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffAppHideCallback = (res: GeneralCallbackResult) => void;
  /** onAppShow 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffAppShowCallback = (res: GeneralCallbackResult) => void;
  /** onAudioInterruptionBegin 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffAudioInterruptionBeginCallback = (res: GeneralCallbackResult) => void;
  /** onAudioInterruptionEnd 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffAudioInterruptionEndCallback = (res: GeneralCallbackResult) => void;
  /** onBLEConnectionStateChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffBLEConnectionStateChangeCallback = (result: OnBLEConnectionStateChangeListenerResult) => void;
  /** onBLEMTUChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffBLEMTUChangeCallback = (result: OnBLEMTUChangeListenerResult) => void;
  /** onBLEPeripheralConnectionStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffBLEPeripheralConnectionStateChangedCallback = (
    result: OnBLEPeripheralConnectionStateChangedListenerResult
  ) => void;
  /** onBindWifi 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffBindWifiCallback = (res: GeneralCallbackResult) => void;
  /** onCanplay 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCanplayCallback = (res: GeneralCallbackResult) => void;
  /** onCharacteristicReadRequest 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCharacteristicReadRequestCallback = (result: OnCharacteristicReadRequestListenerResult) => void;
  /** onCharacteristicSubscribed 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCharacteristicSubscribedCallback = (result: OnCharacteristicSubscribedListenerResult) => void;
  /** onCharacteristicUnsubscribed 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCharacteristicUnsubscribedCallback = (result: OnCharacteristicSubscribedListenerResult) => void;
  /** onCharacteristicWriteRequest 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCharacteristicWriteRequestCallback = (result: OnCharacteristicWriteRequestListenerResult) => void;
  /** onChunkReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffChunkReceivedCallback = (result: OnChunkReceivedListenerResult) => void;
  /** onCompassChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffCompassChangeCallback = (res: GeneralCallbackResult) => void;
  /** onConnect 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffConnectCallback = (res: GeneralCallbackResult) => void;
  /** onDeviceMotionChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffDeviceMotionChangeCallback = (res: GeneralCallbackResult) => void;
  /** onDiscovered 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffDiscoveredCallback = (result: OnDiscoveredListenerResult) => void;
  /** onEnded 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffEndedCallback = (res: GeneralCallbackResult) => void;
  /** onGetWifiList 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffGetWifiListCallback = (result: OnGetWifiListListenerResult) => void;
  /** onGyroscopeChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffGyroscopeChangeCallback = (res: GeneralCallbackResult) => void;
  /** onHCEMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffHCEMessageCallback = (result: OnHCEMessageListenerResult) => void;
  /** onHeadersReceived 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffHeadersReceivedCallback = (result: OnHeadersReceivedListenerResult) => void;
  /** onKeyboardHeightChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffKeyboardHeightChangeCallback = (result: OnKeyboardHeightChangeListenerResult) => void;
  /** onLazyLoadError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLazyLoadErrorCallback = (result: OnLazyLoadErrorListenerResult) => void;
  /** onListening 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffListeningCallback = (res: GeneralCallbackResult) => void;
  /** onLoad 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLoadCallback = (res: GeneralCallbackResult) => void;
  /** onLocalServiceDiscoveryStop 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocalServiceDiscoveryStopCallback = (res: GeneralCallbackResult) => void;
  /** onLocalServiceFound 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocalServiceFoundCallback = (result: OnLocalServiceFoundListenerResult) => void;
  /** onLocalServiceLost 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocalServiceLostCallback = (result: OnLocalServiceLostListenerResult) => void;
  /** onLocalServiceResolveFail 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocalServiceResolveFailCallback = (result: OnLocalServiceLostListenerResult) => void;
  /** onLocationChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocationChangeCallback = (result: OnLocationChangeListenerResult) => void;
  /** onLocationChangeError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffLocationChangeErrorCallback = (result: OnLocationChangeErrorListenerResult) => void;
  /** onMemoryWarning 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffMemoryWarningCallback = (result: OnMemoryWarningListenerResult) => void;
  /** onNetworkStatusChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffNetworkStatusChangeCallback = (res: GeneralCallbackResult) => void;
  /** onNetworkWeakChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffNetworkWeakChangeCallback = (result: OnNetworkWeakChangeListenerResult) => void;
  /** onPageNotFound 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffPageNotFoundCallback = (result: OnPageNotFoundListenerResult) => void;
  /** onPause 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffPauseCallback = (res: GeneralCallbackResult) => void;
  /** onPlay 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffPlayCallback = (res: GeneralCallbackResult) => void;
  /** onScreenRecordingStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffScreenRecordingStateChangedCallback = (result: OnScreenRecordingStateChangedListenerResult) => void;
  /** onSeeked 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffSeekedCallback = (res: GeneralCallbackResult) => void;
  /** onSeeking 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffSeekingCallback = (res: GeneralCallbackResult) => void;
  /** onStop 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffStopCallback = (res: GeneralCallbackResult) => void;
  /** onThemeChange 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffThemeChangeCallback = (result: OnThemeChangeListenerResult) => void;
  /** onTimeUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffTimeUpdateCallback = (res: GeneralCallbackResult) => void;
  /** onUnhandledRejection 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffUnhandledRejectionCallback = (result: OnUnhandledRejectionListenerResult) => void;
  /** onVoIPChatInterrupted 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffVoIPChatInterruptedCallback = (result: OnVoIPChatInterruptedListenerResult) => void;
  /** onVoIPChatMembersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffVoIPChatMembersChangedCallback = (result: OnVoIPChatMembersChangedListenerResult) => void;
  /** onVoIPChatSpeakersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffVoIPChatSpeakersChangedCallback = (result: OnVoIPChatSpeakersChangedListenerResult) => void;
  /** onVoIPChatStateChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffVoIPChatStateChangedCallback = (result: OnVoIPChatStateChangedListenerResult) => void;
  /** onVoIPVideoMembersChanged 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffVoIPVideoMembersChangedCallback = (result: OnVoIPVideoMembersChangedListenerResult) => void;
  /** onWaiting 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffWaitingCallback = (res: GeneralCallbackResult) => void;
  /** onWifiConnected 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffWifiConnectedCallback = (result: OnWifiConnectedListenerResult) => void;
  /** onWifiConnectedWithPartialInfo 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffWifiConnectedWithPartialInfoCallback = (result: OnWifiConnectedWithPartialInfoListenerResult) => void;
  /** onWindowResize 传入的监听函数。不传此参数则移除所有监听函数。 */
  type OffWindowResizeCallback = (result: OnWindowResizeListenerResult) => void;
  /** 加速度数据事件的监听函数 */
  type OnAccelerometerChangeCallback = (result: OnAccelerometerChangeListenerResult) => void;
  /** 小程序切后台事件的监听函数 */
  type OnAppHideCallback = (res: GeneralCallbackResult) => void;
  /** 小程序切前台事件的监听函数 */
  type OnAppShowCallback = (
    /** 启动参数 */
    options: LaunchOptionsApp
  ) => void;
  /** 音频因为受到系统占用而被中断开始事件的监听函数 */
  type OnAudioInterruptionBeginCallback = (res: GeneralCallbackResult) => void;
  /** 音频中断结束事件的监听函数 */
  type OnAudioInterruptionEndCallback = (res: GeneralCallbackResult) => void;
  /** 蓝牙低功耗设备的特征值变化事件的监听函数 */
  type OnBLECharacteristicValueChangeCallback = (result: OnBLECharacteristicValueChangeListenerResult) => void;
  /** 蓝牙低功耗连接状态改变事件的监听函数 */
  type OnBLEConnectionStateChangeCallback = (result: OnBLEConnectionStateChangeListenerResult) => void;
  /** 蓝牙低功耗的最大传输单元变化事件的监听函数 */
  type OnBLEMTUChangeCallback = (result: OnBLEMTUChangeListenerResult) => void;
  /** 当前外围设备被连接或断开连接事件的监听函数 */
  type OnBLEPeripheralConnectionStateChangedCallback = (
    result: OnBLEPeripheralConnectionStateChangedListenerResult
  ) => void;
  /** 音乐暂停事件的监听函数 */
  type OnBackgroundAudioPauseCallback = (res: GeneralCallbackResult) => void;
  /** 音乐播放事件的监听函数 */
  type OnBackgroundAudioPlayCallback = (res: GeneralCallbackResult) => void;
  /** 音乐停止事件的监听函数 */
  type OnBackgroundAudioStopCallback = (res: GeneralCallbackResult) => void;
  /** 收到 backgroundFetch 数据事件的监听函数 */
  type OnBackgroundFetchDataCallback = (result: OnBackgroundFetchDataListenerResult) => void;
  /** Beacon 服务状态变化事件的监听函数 */
  type OnBeaconServiceChangeCallback = (result: OnBeaconServiceChangeListenerResult) => void;
  /** Beacon 设备更新事件的监听函数 */
  type OnBeaconUpdateCallback = (result: OnBeaconUpdateListenerResult) => void;
  /** 当一个 socket 绑定当前 wifi 网络成功时触发该事件的监听函数 */
  type OnBindWifiCallback = (res: GeneralCallbackResult) => void;
  /** 蓝牙适配器状态变化事件的监听函数 */
  type OnBluetoothAdapterStateChangeCallback = (result: OnBluetoothAdapterStateChangeListenerResult) => void;
  /** 搜索到新设备的事件的监听函数 */
  type OnBluetoothDeviceFoundCallback = (result: OnBluetoothDeviceFoundListenerResult) => void;
  /** 回调函数 */
  type OnCameraFrameCallback = (result: OnCameraFrameCallbackResult) => void;
  type OnCanplayCallback = (res: GeneralCallbackResult) => void;
  /** 已连接的设备请求读当前外围设备的特征值事件的监听函数 */
  type OnCharacteristicReadRequestCallback = (result: OnCharacteristicReadRequestListenerResult) => void;
  /** 特征订阅事件的监听函数 */
  type OnCharacteristicSubscribedCallback = (result: OnCharacteristicSubscribedListenerResult) => void;
  /** 取消特征订阅事件的监听函数 */
  type OnCharacteristicUnsubscribedCallback = (result: OnCharacteristicSubscribedListenerResult) => void;
  /** 已连接的设备请求写当前外围设备的特征值事件的监听函数 */
  type OnCharacteristicWriteRequestCallback = (result: OnCharacteristicWriteRequestListenerResult) => void;
  /** 向微信后台请求检查更新结果事件的监听函数 */
  type OnCheckForUpdateCallback = (result: OnCheckForUpdateListenerResult) => void;
  /** Transfer-Encoding Chunk Received 事件的监听函数 */
  type OnChunkReceivedCallback = (result: OnChunkReceivedListenerResult) => void;
  /** 罗盘数据变化事件的监听函数 */
  type OnCompassChangeCallback = (result: OnCompassChangeListenerResult) => void;
  /** 当一个 socket 连接成功建立的时候触发该事件的监听函数 */
  type OnConnectCallback = (res: GeneralCallbackResult) => void;
  /** 用户点击右上角菜单的「复制链接」按钮时触发的事件的监听函数 */
  type OnCopyUrlCallback = (result: OnCopyUrlListenerResult) => void;
  /** 设备方向变化事件的监听函数 */
  type OnDeviceMotionChangeCallback = (result: OnDeviceMotionChangeListenerResult) => void;
  /** 的监听函数 */
  type OnDiscoveredCallback = (result: OnDiscoveredListenerResult) => void;
  type OnEndedCallback = (res: GeneralCallbackResult) => void;
  /** 已录制完指定帧大小的文件事件的监听函数 */
  type OnFrameRecordedCallback = (result: OnFrameRecordedListenerResult) => void;
  /** 获取到 Wi-Fi 列表数据事件的监听函数 */
  type OnGetWifiListCallback = (result: OnGetWifiListListenerResult) => void;
  /** 陀螺仪数据变化事件的监听函数 */
  type OnGyroscopeChangeCallback = (result: OnGyroscopeChangeListenerResult) => void;
  /** 接收 NFC 设备消息事件的监听函数 */
  type OnHCEMessageCallback = (result: OnHCEMessageListenerResult) => void;
  /** HTTP Response Header 事件的监听函数 */
  type OnHeadersReceivedCallback = (result: OnHeadersReceivedListenerResult) => void;
  /** 录音因为受到系统占用而被中断开始事件的监听函数 */
  type OnInterruptionBeginCallback = (res: GeneralCallbackResult) => void;
  /** 录音中断结束事件的监听函数 */
  type OnInterruptionEndCallback = (res: GeneralCallbackResult) => void;
  /** 键盘高度变化事件的监听函数 */
  type OnKeyboardHeightChangeCallback = (result: OnKeyboardHeightChangeListenerResult) => void;
  /** 小程序异步组件加载失败事件的监听函数 */
  type OnLazyLoadErrorCallback = (result: OnLazyLoadErrorListenerResult) => void;
  /** 开始监听数据包消息的事件的监听函数 */
  type OnListeningCallback = (res: GeneralCallbackResult) => void;
  type OnLoadCallback = (res: GeneralCallbackResult) => void;
  /** mDNS 服务停止搜索的事件的监听函数 */
  type OnLocalServiceDiscoveryStopCallback = (res: GeneralCallbackResult) => void;
  /** mDNS 服务发现的事件的监听函数 */
  type OnLocalServiceFoundCallback = (result: OnLocalServiceFoundListenerResult) => void;
  /** mDNS 服务离开的事件的监听函数 */
  type OnLocalServiceLostCallback = (result: OnLocalServiceLostListenerResult) => void;
  /** mDNS 服务解析失败的事件的监听函数 */
  type OnLocalServiceResolveFailCallback = (result: OnLocalServiceLostListenerResult) => void;
  /** 实时地理位置变化事件的监听函数 */
  type OnLocationChangeCallback = (result: OnLocationChangeListenerResult) => void;
  /** 的监听函数 */
  type OnLocationChangeErrorCallback = (result: OnLocationChangeErrorListenerResult) => void;
  /** 内存不足告警事件的监听函数 */
  type OnMemoryWarningCallback = (result: OnMemoryWarningListenerResult) => void;
  /** 网络状态变化事件的监听函数 */
  type OnNetworkStatusChangeCallback = (result: OnNetworkStatusChangeListenerResult) => void;
  /** 弱网状态变化事件的监听函数 */
  type OnNetworkWeakChangeCallback = (result: OnNetworkWeakChangeListenerResult) => void;
  /** 用户在系统音乐播放面板点击下一曲事件的监听函数 */
  type OnNextCallback = (res: GeneralCallbackResult) => void;
  /** WebSocket 连接打开事件的监听函数 */
  type OnOpenCallback = (result: OnOpenListenerResult) => void;
  /** 小程序要打开的页面不存在事件的监听函数 */
  type OnPageNotFoundCallback = (result: OnPageNotFoundListenerResult) => void;
  type OnPauseCallback = (res: GeneralCallbackResult) => void;
  type OnPlayCallback = (res: GeneralCallbackResult) => void;
  /** 用户在系统音乐播放面板点击上一曲事件的监听函数 */
  type OnPrevCallback = (res: GeneralCallbackResult) => void;
  /** worker线程被系统回收事件的监听函数 */
  type OnProcessKilledCallback = (res: GeneralCallbackResult) => void;
  /** 录音继续事件的监听函数 */
  type OnResumeCallback = (res: GeneralCallbackResult) => void;
  /** 用户录屏事件的监听函数 */
  type OnScreenRecordingStateChangedCallback = (result: OnScreenRecordingStateChangedListenerResult) => void;
  type OnSeekedCallback = (res: GeneralCallbackResult) => void;
  type OnSeekingCallback = (res: GeneralCallbackResult) => void;
  /** WebSocket 连接关闭事件的监听函数 */
  type OnSocketCloseCallback = (result: SocketTaskOnCloseListenerResult) => void;
  /** WebSocket 错误事件的监听函数 */
  type OnSocketErrorCallback = (result: GeneralCallbackResult) => void;
  /** WebSocket 接收到服务器的消息事件的监听函数 */
  type OnSocketMessageCallback = (result: SocketTaskOnMessageListenerResult) => void;
  /** WebSocket 连接打开事件的监听函数 */
  type OnSocketOpenCallback = (result: OnSocketOpenListenerResult) => void;
  /** 录音开始事件的监听函数 */
  type OnStartCallback = (res: GeneralCallbackResult) => void;
  /** 系统主题改变事件的监听函数 */
  type OnThemeChangeCallback = (result: OnThemeChangeListenerResult) => void;
  type OnTimeUpdateCallback = (res: GeneralCallbackResult) => void;
  /** 未处理的 Promise 拒绝事件的监听函数 */
  type OnUnhandledRejectionCallback = (result: OnUnhandledRejectionListenerResult) => void;
  /** 小程序更新失败事件的监听函数 */
  type OnUpdateFailedCallback = (res: GeneralCallbackResult) => void;
  /** 小程序有版本更新事件的监听函数 */
  type OnUpdateReadyCallback = (res: GeneralCallbackResult) => void;
  /** 用户主动截屏事件的监听函数 */
  type OnUserCaptureScreenCallback = (res: GeneralCallbackResult) => void;
  /** 被动断开实时语音通话事件的监听函数 */
  type OnVoIPChatInterruptedCallback = (result: OnVoIPChatInterruptedListenerResult) => void;
  /** 实时语音通话成员在线状态变化事件的监听函数 */
  type OnVoIPChatMembersChangedCallback = (result: OnVoIPChatMembersChangedListenerResult) => void;
  /** 实时语音通话成员通话状态变化事件的监听函数 */
  type OnVoIPChatSpeakersChangedCallback = (result: OnVoIPChatSpeakersChangedListenerResult) => void;
  /** 房间状态变化事件的监听函数 */
  type OnVoIPChatStateChangedCallback = (result: OnVoIPChatStateChangedListenerResult) => void;
  /** 实时语音通话成员视频状态变化事件的监听函数 */
  type OnVoIPVideoMembersChangedCallback = (result: OnVoIPVideoMembersChangedListenerResult) => void;
  /** 音频加载中事件的监听函数 */
  type OnWaitingCallback = (res: GeneralCallbackResult) => void;
  /** 连接上 Wi-Fi 的事件的监听函数 */
  type OnWifiConnectedCallback = (result: OnWifiConnectedListenerResult) => void;
  /** 连接上 Wi-Fi 的事件的监听函数 */
  type OnWifiConnectedWithPartialInfoCallback = (result: OnWifiConnectedWithPartialInfoListenerResult) => void;
  /** 窗口尺寸变化事件的监听函数 */
  type OnWindowResizeCallback = (result: OnWindowResizeListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenAppAuthorizeSettingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenAppAuthorizeSettingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenAppAuthorizeSettingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenBluetoothAdapterCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type OpenBluetoothAdapterFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type OpenBluetoothAdapterSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenCardCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenCardFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenCardSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenChannelsActivityCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenChannelsActivityFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenChannelsActivitySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenChannelsEventCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenChannelsEventFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenChannelsEventSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenChannelsLiveCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenChannelsLiveFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenChannelsLiveSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenChannelsUserProfileCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenChannelsUserProfileFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenChannelsUserProfileSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenCompleteCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenCustomerServiceChatCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenCustomerServiceChatFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenCustomerServiceChatSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenDocumentCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenDocumentFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenDocumentSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenEmbeddedMiniProgramCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenEmbeddedMiniProgramFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenEmbeddedMiniProgramSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenFailCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenLocationSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenMapAppCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenMapAppFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenMapAppSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenSettingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenSettingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenSettingSuccessCallback = (result: OpenSettingSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenSuccessCallback = (result: OpenSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenSystemBluetoothSettingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenSystemBluetoothSettingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenSystemBluetoothSettingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type OpenVideoEditorCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type OpenVideoEditorFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type OpenVideoEditorSuccessCallback = (result: OpenVideoEditorSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PageScrollToCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PageScrollToFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PageScrollToSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PauseBGMCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PauseBGMFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PauseBGMSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PauseBackgroundAudioCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PauseBackgroundAudioFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PauseBackgroundAudioSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PauseCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PauseFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PauseSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PauseVoiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PauseVoiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PauseVoiceSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PlayBGMCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PlayBGMFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PlayBGMSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PlayBackgroundAudioCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PlayBackgroundAudioFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PlayBackgroundAudioSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PlayCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PlayFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PlaySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PlayVoiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PlayVoiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PlayVoiceSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PluginLoginCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PluginLoginFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PluginLoginSuccessCallback = (result: PluginLoginSuccessCallbackResult) => void;
  /** 分包加载进度变化事件的监听函数 */
  type PreDownloadSubpackageTaskOnProgressUpdateCallback = (
    result: PreDownloadSubpackageTaskOnProgressUpdateListenerResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PreloadAssetsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PreloadAssetsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PreloadAssetsSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PreloadSkylineViewCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PreloadSkylineViewFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PreloadSkylineViewSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PreloadWebviewCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PreloadWebviewFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PreloadWebviewSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PreviewImageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PreviewImageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PreviewImageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type PreviewMediaCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type PreviewMediaFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type PreviewMediaSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReLaunchCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ReLaunchFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ReLaunchSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReadBLECharacteristicValueCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type ReadBLECharacteristicValueFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type ReadBLECharacteristicValueSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReadCompleteCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReadCompressedFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type ReadCompressedFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type ReadCompressedFileSuccessCallback = (result: ReadCompressedFileSuccessCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ReadFailCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReadFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type ReadFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type ReadFileSuccessCallback = (result: ReadFileSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ReadSuccessCallback = (result: ReadSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReadZipEntryCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type ReadZipEntryFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type ReadZipEntrySuccessCallback = (result: ReadZipEntrySuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReaddirCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type ReaddirFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type ReaddirSuccessCallback = (result: ReaddirSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ReconnectCastingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ReconnectCastingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ReconnectCastingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 录音结束事件的监听函数 */
  type RecorderManagerOnStopCallback = (result: OnStopListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RedirectToCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RedirectToFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RedirectToSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RedoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RedoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RedoSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveArcCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveArcFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveArcSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveCustomLayerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveCustomLayerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveCustomLayerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveFormatCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveFormatFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveFormatSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveGroundOverlayCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveGroundOverlayFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveGroundOverlaySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveMarkersCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveMarkersFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveMarkersSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveSavedFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type RemoveSavedFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type RemoveSavedFileSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveServiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveServiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveServiceSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveStorageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveTabBarBadgeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveTabBarBadgeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveTabBarBadgeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RemoveVisualLayerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RemoveVisualLayerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RemoveVisualLayerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RenameCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type RenameFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type RenameSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestDeviceVoIPCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestDeviceVoIPFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestDeviceVoIPSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestFailCallback = (err: Err) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestFullScreenCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestFullScreenFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestFullScreenSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestOrderPaymentCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestOrderPaymentFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestOrderPaymentSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestPaymentCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestPaymentFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestPaymentSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestPictureInPictureCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestPictureInPictureFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestPictureInPictureSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestPluginPaymentCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestPluginPaymentFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestPluginPaymentSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestSubscribeDeviceMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestSubscribeDeviceMessageFailCallback = (result: RequestSubscribeDeviceMessageFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestSubscribeDeviceMessageSuccessCallback = (
    result: RequestSubscribeDeviceMessageSuccessCallbackResult
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RequestSubscribeMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type RequestSubscribeMessageFailCallback = (result: RequestSubscribeMessageFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestSubscribeMessageSuccessCallback = (result: RequestSubscribeMessageSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type RequestSuccessCallback<T extends string | IAnyObject | ArrayBuffer = string | IAnyObject | ArrayBuffer> = (
    result: RequestSuccessCallbackResult<T>
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ResumeBGMCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ResumeBGMFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ResumeBGMSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ResumeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ResumeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ResumeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
  type RewardedVideoAdOffCloseCallback = (result: RewardedVideoAdOnCloseListenerResult) => void;
  /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type RewardedVideoAdOffErrorCallback = (result: RewardedVideoAdOnErrorListenerResult) => void;
  /** 用户点击 `关闭广告` 按钮的事件的监听函数 */
  type RewardedVideoAdOnCloseCallback = (result: RewardedVideoAdOnCloseListenerResult) => void;
  /** 激励视频错误事件的监听函数 */
  type RewardedVideoAdOnErrorCallback = (result: RewardedVideoAdOnErrorListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type RmdirCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type RmdirFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type RmdirSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SaveFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type SaveFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type SaveFileSuccessCallback = (result: SaveFileSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SaveFileToDiskCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SaveFileToDiskFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SaveFileToDiskSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SaveImageToPhotosAlbumCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SaveImageToPhotosAlbumFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SaveImageToPhotosAlbumSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SaveVideoToPhotosAlbumCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SaveVideoToPhotosAlbumFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SaveVideoToPhotosAlbumSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ScanCodeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ScanCodeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ScanCodeSuccessCallback = (result: ScanCodeSuccessCallbackResult) => void;
  /** 回调函数，在执行 `SelectorQuery.exec` 方法后，节点信息会在 `callback` 中返回。 */
  type ScrollOffsetCallback = (result: ScrollOffsetCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SeekBackgroundAudioCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SeekBackgroundAudioFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SeekBackgroundAudioSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SendCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SendFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SendHCEMessageCompleteCallback = (res: NFCError) => void;
  /** 接口调用失败的回调函数 */
  type SendHCEMessageFailCallback = (res: NFCError) => void;
  /** 接口调用成功的回调函数 */
  type SendHCEMessageSuccessCallback = (res: NFCError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SendMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SendMessageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SendMessageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SendSmsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SendSmsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SendSmsSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SendSocketMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SendSocketMessageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SendSocketMessageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SendSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBGMVolumeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBGMVolumeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBGMVolumeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBLEMTUCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBLEMTUFailCallback = (result: SetBLEMTUFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBLEMTUSuccessCallback = (result: SetBLEMTUSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBackgroundColorCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBackgroundColorFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBackgroundColorSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBackgroundFetchTokenCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBackgroundFetchTokenFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBackgroundFetchTokenSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBackgroundTextStyleCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBackgroundTextStyleFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBackgroundTextStyleSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetBoundaryCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetBoundaryFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetBoundarySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetCenterOffsetCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetCenterOffsetFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetCenterOffsetSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetClipboardDataCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetClipboardDataFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetClipboardDataSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetContentsCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetContentsFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetContentsSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetEnable1v1ChatCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetEnable1v1ChatFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetEnable1v1ChatSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetEnableDebugCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetEnableDebugFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetEnableDebugSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetInnerAudioOptionCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetInnerAudioOptionFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetInnerAudioOptionSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetKeepScreenOnCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetKeepScreenOnFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetKeepScreenOnSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetLocMarkerIconCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetLocMarkerIconFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetLocMarkerIconSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetMICVolumeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetMICVolumeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetMICVolumeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetNavigationBarColorCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetNavigationBarColorFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetNavigationBarColorSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetNavigationBarTitleCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetNavigationBarTitleFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetNavigationBarTitleSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetScreenBrightnessCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetScreenBrightnessFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetScreenBrightnessSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetStorageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetStorageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetStorageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetTabBarBadgeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetTabBarBadgeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetTabBarBadgeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetTabBarItemCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetTabBarItemFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetTabBarItemSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetTabBarStyleCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetTabBarStyleFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetTabBarStyleSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetTimeoutCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type SetTimeoutFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type SetTimeoutSuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetTopBarTextCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetTopBarTextFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetTopBarTextSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetVisualEffectOnCaptureCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetVisualEffectOnCaptureFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetVisualEffectOnCaptureSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetWifiListCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type SetWifiListFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type SetWifiListSuccessCallback = (res: WifiError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetWindowSizeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetWindowSizeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SetWindowSizeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SetZoomCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SetZoomFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShareFileMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShareFileMessageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShareFileMessageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShareToWeRunCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShareToWeRunFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShareToWeRunSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShareVideoMessageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShareVideoMessageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShareVideoMessageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowActionSheetCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowActionSheetFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowActionSheetSuccessCallback = (result: ShowActionSheetSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowLoadingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowLoadingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowLoadingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowModalCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowModalFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowModalSuccessCallback = (result: ShowModalSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowNavigationBarLoadingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowNavigationBarLoadingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowNavigationBarLoadingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowRedPackageCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowRedPackageFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowRedPackageSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowShareImageMenuCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowShareImageMenuFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowShareImageMenuSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowShareMenuCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowShareMenuFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowShareMenuSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowTabBarCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowTabBarFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowTabBarRedDotCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowTabBarRedDotFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowTabBarRedDotSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowTabBarSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ShowToastCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ShowToastFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ShowToastSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SnapshotCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SnapshotFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SocketTaskCloseCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SocketTaskCloseFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SocketTaskCloseSuccessCallback = (res: GeneralCallbackResult) => void;
  /** WebSocket 连接关闭事件的监听函数 */
  type SocketTaskOnCloseCallback = (result: SocketTaskOnCloseListenerResult) => void;
  /** WebSocket 接收到服务器的消息事件的监听函数 */
  type SocketTaskOnMessageCallback = (result: SocketTaskOnMessageListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartAccelerometerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartAccelerometerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartAccelerometerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartAdvertisingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartAdvertisingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartAdvertisingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartBeaconDiscoveryCompleteCallback = (res: BeaconError) => void;
  /** 接口调用失败的回调函数 */
  type StartBeaconDiscoveryFailCallback = (res: BeaconError) => void;
  /** 接口调用成功的回调函数 */
  type StartBeaconDiscoverySuccessCallback = (res: BeaconError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartBluetoothDevicesDiscoveryCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type StartBluetoothDevicesDiscoveryFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type StartBluetoothDevicesDiscoverySuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartCastingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartCastingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartCastingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartCompassCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartCompassFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartCompassSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartDeviceMotionListeningCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartDeviceMotionListeningFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartDeviceMotionListeningSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartDiscoveryCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type StartDiscoveryFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type StartDiscoverySuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type StartFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartGyroscopeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartGyroscopeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartGyroscopeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartHCECompleteCallback = (res: NFCError) => void;
  /** 接口调用失败的回调函数 */
  type StartHCEFailCallback = (res: NFCError) => void;
  /** 接口调用成功的回调函数 */
  type StartHCESuccessCallback = (res: NFCError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartLocalServiceDiscoveryCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartLocalServiceDiscoveryFailCallback = (result: StartLocalServiceDiscoveryFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartLocalServiceDiscoverySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartLocationUpdateBackgroundCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartLocationUpdateBackgroundFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartLocationUpdateBackgroundSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartLocationUpdateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartLocationUpdateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartLocationUpdateSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartPreviewCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartPreviewFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartPreviewSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartPullDownRefreshCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartPullDownRefreshFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartPullDownRefreshSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartRecordCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartRecordFailCallback = (res: GeneralCallbackResult) => void;
  /** 超过录制时长上限时会结束录像并触发此回调，录像异常退出时也会触发此回调 */
  type StartRecordTimeoutCallback = (result: StartRecordTimeoutCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartSoterAuthenticationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StartSoterAuthenticationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartSoterAuthenticationSuccessCallback = (result: StartSoterAuthenticationSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StartSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StartWifiCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type StartWifiFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type StartWifiSuccessCallback = (res: WifiError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StatCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type StatFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type StatSuccessCallback = (result: StatSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopAccelerometerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopAccelerometerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopAccelerometerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopAdvertisingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopAdvertisingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopAdvertisingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopBGMCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopBGMFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopBGMSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopBackgroundAudioCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopBackgroundAudioFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopBackgroundAudioSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopBeaconDiscoveryCompleteCallback = (res: BeaconError) => void;
  /** 接口调用失败的回调函数 */
  type StopBeaconDiscoveryFailCallback = (res: BeaconError) => void;
  /** 接口调用成功的回调函数 */
  type StopBeaconDiscoverySuccessCallback = (res: BeaconError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopBluetoothDevicesDiscoveryCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type StopBluetoothDevicesDiscoveryFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type StopBluetoothDevicesDiscoverySuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopCompassCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopCompassFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopCompassSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopDeviceMotionListeningCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopDeviceMotionListeningFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopDeviceMotionListeningSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopDiscoveryCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type StopDiscoveryFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type StopDiscoverySuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopFaceDetectCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopFaceDetectFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopFaceDetectSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopGyroscopeCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopGyroscopeFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopGyroscopeSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopHCECompleteCallback = (res: NFCError) => void;
  /** 接口调用失败的回调函数 */
  type StopHCEFailCallback = (res: NFCError) => void;
  /** 接口调用成功的回调函数 */
  type StopHCESuccessCallback = (res: NFCError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopLocalServiceDiscoveryCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopLocalServiceDiscoveryFailCallback = (result: StopLocalServiceDiscoveryFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopLocalServiceDiscoverySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopLocationUpdateCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopLocationUpdateFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopLocationUpdateSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopPreviewCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopPreviewFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopPreviewSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopPullDownRefreshCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopPullDownRefreshFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopPullDownRefreshSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopRecordCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopRecordFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopVoiceCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type StopVoiceFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type StopVoiceSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type StopWifiCompleteCallback = (res: WifiError) => void;
  /** 接口调用失败的回调函数 */
  type StopWifiFailCallback = (res: WifiError) => void;
  /** 接口调用成功的回调函数 */
  type StopWifiSuccessCallback = (res: WifiError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SubscribeVoIPVideoMembersCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SubscribeVoIPVideoMembersFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SubscribeVoIPVideoMembersSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SwitchCameraCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SwitchCameraFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SwitchCameraSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SwitchCastingCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SwitchCastingFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SwitchCastingSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type SwitchTabCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type SwitchTabFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type SwitchTabSuccessCallback = (res: GeneralCallbackResult) => void;
  /** onMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
  type TCPSocketOffMessageCallback = (result: TCPSocketOnMessageListenerResult) => void;
  /** 当接收到数据的时触发该事件的监听函数 */
  type TCPSocketOnMessageCallback = (result: TCPSocketOnMessageListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type TakePhotoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type TakePhotoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type TakePhotoSuccessCallback = (result: TakePhotoSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ToScreenLocationCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ToScreenLocationFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ToScreenLocationSuccessCallback = (result: ToScreenLocationSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type ToggleTorchCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type ToggleTorchFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type ToggleTorchSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type TransceiveCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type TransceiveFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type TransceiveSuccessCallback = (result: TransceiveSuccessCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type TranslateMarkerCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type TranslateMarkerFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type TranslateMarkerSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type TruncateCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type TruncateFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type TruncateSuccessCallback = (res: FileError) => void;
  /** onClose 传入的监听函数。不传此参数则移除所有监听函数。 */
  type UDPSocketOffCloseCallback = (res: GeneralCallbackResult) => void;
  /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type UDPSocketOffErrorCallback = (result: GeneralCallbackResult) => void;
  /** onMessage 传入的监听函数。不传此参数则移除所有监听函数。 */
  type UDPSocketOffMessageCallback = (result: UDPSocketOnMessageListenerResult) => void;
  type UDPSocketOnCloseCallback = (res: GeneralCallbackResult) => void;
  type UDPSocketOnErrorCallback = (result: GeneralCallbackResult) => void;
  /** 收到消息的事件的监听函数 */
  type UDPSocketOnMessageCallback = (result: UDPSocketOnMessageListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UndoCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UndoFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UndoSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UnlinkCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type UnlinkFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type UnlinkSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UnzipCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type UnzipFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type UnzipSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UpdateGroundOverlayCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UpdateGroundOverlayFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UpdateGroundOverlaySuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UpdateShareMenuCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UpdateShareMenuFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UpdateShareMenuSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UpdateVoIPChatMuteConfigCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UpdateVoIPChatMuteConfigFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UpdateVoIPChatMuteConfigSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UpdateWeChatAppCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UpdateWeChatAppFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UpdateWeChatAppSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type UploadFileCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type UploadFileFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type UploadFileSuccessCallback = (result: UploadFileSuccessCallbackResult) => void;
  /** onProgressUpdate 传入的监听函数。不传此参数则移除所有监听函数。 */
  type UploadTaskOffProgressUpdateCallback = (result: UploadTaskOnProgressUpdateListenerResult) => void;
  /** 上传进度变化事件的监听函数 */
  type UploadTaskOnProgressUpdateCallback = (result: UploadTaskOnProgressUpdateListenerResult) => void;
  /** 开启会话回调 */
  type VKSessionStartCallback = (
    /** 参数 status 可选值：
     * - 0: 成功;
     * - 2000001: 参数错误;
     * - 2003000: 会话不可用;
     * - 2000000: 系统错误;
     * - 2000002: 设备不支持;
     * - 2000003: 系统不支持;
     * - 2000004: 设备不支持;
     * - 2003001: 未开启系统相机权限;
     * - 2003002: 未开启小程序相机权限; */
    status: 0 | 2000001 | 2003000 | 2000000 | 2000002 | 2000003 | 2000004 | 2003001 | 2003002
  ) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type VibrateLongCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type VibrateLongFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type VibrateLongSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type VibrateShortCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type VibrateShortFailCallback = (result: VibrateShortFailCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type VibrateShortSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 主线程/Worker 线程向当前线程发送的消息的事件的监听函数 */
  type WorkerOnMessageCallback = (result: WorkerOnMessageListenerResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type WriteBLECharacteristicValueCompleteCallback = (res: BluetoothError) => void;
  /** 接口调用失败的回调函数 */
  type WriteBLECharacteristicValueFailCallback = (res: BluetoothError) => void;
  /** 接口调用成功的回调函数 */
  type WriteBLECharacteristicValueSuccessCallback = (res: BluetoothError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type WriteCharacteristicValueCompleteCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用失败的回调函数 */
  type WriteCharacteristicValueFailCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type WriteCharacteristicValueSuccessCallback = (res: GeneralCallbackResult) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type WriteCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type WriteFailCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type WriteFileCompleteCallback = (res: FileError) => void;
  /** 接口调用失败的回调函数 */
  type WriteFileFailCallback = (res: FileError) => void;
  /** 接口调用成功的回调函数 */
  type WriteFileSuccessCallback = (res: FileError) => void;
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  type WriteNdefMessageCompleteCallback = (res: Nfcrwerror) => void;
  /** 接口调用失败的回调函数 */
  type WriteNdefMessageFailCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type WriteNdefMessageSuccessCallback = (res: Nfcrwerror) => void;
  /** 接口调用成功的回调函数 */
  type WriteSuccessCallback = (result: WriteSuccessCallbackResult) => void;
  /** onError 传入的监听函数。不传此参数则移除所有监听函数。 */
  type WxOffErrorCallback = (res: GeneralCallbackResult) => void;
  /** 小程序错误事件的监听函数 */
  type WxOnErrorCallback = (
    /** 错误 */
    message: string,
    /** 错误调用堆栈 */
    stack: string
  ) => void;
  /** 接口调用成功的回调函数 */
  type WxStartRecordSuccessCallback = (result: StartRecordSuccessCallbackResult) => void;
  /** 接口调用成功的回调函数 */
  type WxStopRecordSuccessCallback = (res: GeneralCallbackResult) => void;
}
