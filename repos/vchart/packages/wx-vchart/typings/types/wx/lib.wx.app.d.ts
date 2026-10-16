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

declare namespace WechatMiniprogram.App {
  interface ReferrerInfo {
    /** 来源小程序或公众号或App的 appId
     *
     * 以下场景支持返回 referrerInfo.appId：
     * - 1020（公众号 profile 页相关小程序列表）： appId
     * - 1035（公众号自定义菜单）：来源公众号 appId
     * - 1036（App 分享消息卡片）：来源应用 appId
     * - 1037（小程序打开小程序）：来源小程序 appId
     * - 1038（从另一个小程序返回）：来源小程序 appId
     * - 1043（公众号模板消息）：来源公众号 appId
     */
    appId: string;
    /** 来源小程序传过来的数据，scene=1037或1038时支持 */
    extraData?: any;
  }

  type SceneValues =
    | 1000
    | 1001
    | 1005
    | 1006
    | 1007
    | 1008
    | 1010
    | 1011
    | 1012
    | 1013
    | 1014
    | 1017
    | 1019
    | 1020
    | 1022
    | 1023
    | 1024
    | 1025
    | 1026
    | 1027
    | 1028
    | 1029
    | 1030
    | 1031
    | 1032
    | 1034
    | 1035
    | 1036
    | 1037
    | 1038
    | 1039
    | 1042
    | 1043
    | 1044
    | 1045
    | 1046
    | 1047
    | 1048
    | 1049
    | 1052
    | 1053
    | 1054
    | 1056
    | 1057
    | 1058
    | 1059
    | 1060
    | 1064
    | 1065
    | 1067
    | 1068
    | 1069
    | 1071
    | 1072
    | 1073
    | 1074
    | 1077
    | 1078
    | 1079
    | 1081
    | 1082
    | 1084
    | 1088
    | 1089
    | 1090
    | 1091
    | 1092
    | 1095
    | 1096
    | 1097
    | 1099
    | 1100
    | 1101
    | 1102
    | 1103
    | 1104
    | 1106
    | 1107
    | 1113
    | 1114
    | 1119
    | 1120
    | 1121
    | 1124
    | 1125
    | 1126
    | 1129
    | 1131
    | 1133
    | 1135
    | 1144
    | 1145
    | 1146
    | 1148
    | 1150
    | 1151
    | 1152
    | 1153
    | 1154
    | 1155
    | 1157
    | 1158
    | 1160
    | 1167
    | 1168
    | 1169
    | 1171
    | 1173
    | 1175
    | 1176
    | 1177
    | 1178
    | 1179
    | 1181
    | 1183
    | 1184
    | 1185
    | 1186
    | 1187
    | 1189
    | 1191
    | 1192
    | 1193
    | 1194
    | 1195
    | 1196
    | 1197
    | 1198
    | 1200
    | 1201
    | 1202
    | 1203
    | 1206
    | 1207
    | 1208
    | 1212
    | 1215
    | 1216
    | 1223
    | 1228
    | 1231;

  interface LaunchShowOption {
    /** 打开小程序的路径 */
    path: string;
    /** 打开小程序的query */
    query: IAnyObject;
    /** 打开小程序的场景值
     * - 1000：其他
     * - 1001：发现栏小程序主入口，「最近使用」列表（基础库 2.2.4 版本起包含「我的小程序」列表）
     * - 1005：微信首页顶部搜索框的搜索结果页
     * - 1006：发现栏小程序主入口搜索框的搜索结果页
     * - 1007：单人聊天会话中的小程序消息卡片
     * - 1008：群聊会话中的小程序消息卡片
     * - 1010：收藏夹
     * - 1011：扫描二维码
     * - 1012：长按图片识别二维码
     * - 1013：扫描手机相册中选取的二维码
     * - 1014：小程序订阅消息（与 1107 相同）
     * - 1017：前往小程序体验版的入口页
     * - 1019：微信钱包（微信客户端 7.0.0 版本改为支付入口）
     * - 1020：公众号 profile 页相关小程序列表（已废弃）
     * - 1022：聊天顶部置顶小程序入口（微信客户端 6.6.1 版本起废弃）
     * - 1023：安卓系统桌面图标
     * - 1024：小程序 profile 页
     * - 1025：扫描一维码
     * - 1026：发现栏小程序主入口，「附近的小程序」列表
     * - 1027：微信首页顶部搜索框搜索结果页「使用过的小程序」列表
     * - 1028：我的卡包
     * - 1029：小程序中的卡券详情页
     * - 1030：自动化测试下打开小程序
     * - 1031：长按图片识别一维码
     * - 1032：扫描手机相册中选取的一维码
     * - 1034：微信支付完成页
     * - 1035：公众号自定义菜单
     * - 1036：App 分享消息卡片
     * - 1037：小程序打开小程序
     * - 1038：从另一个小程序返回
     * - 1039：摇电视
     * - 1042：添加好友搜索框的搜索结果页
     * - 1043：公众号模板消息
     * - 1044：带 shareTicket 的小程序消息卡片 [详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html)
     * - 1045：朋友圈广告
     * - 1046：朋友圈广告详情页
     * - 1047：扫描小程序码
     * - 1048：长按图片识别小程序码
     * - 1049：扫描手机相册中选取的小程序码
     * - 1052：卡券的适用门店列表
     * - 1053：搜一搜的结果页
     * - 1054：顶部搜索框小程序快捷入口（微信客户端版本 6.7.4 起废弃）
     * - 1056：聊天顶部音乐播放器右上角菜单
     * - 1057：钱包中的银行卡详情页
     * - 1058：公众号文章
     * - 1059：体验版小程序绑定邀请页
     * - 1060：微信支付完成页（与 1034 相同）
     * - 1064：微信首页连 Wi-Fi 状态栏
     * - 1065：URL scheme [详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/url-scheme.html)
     * - 1067：公众号文章广告
     * - 1068：附近小程序列表广告（已废弃）
     * - 1069：移动应用通过 openSDK 进入微信，打开小程序
     * - 1071：钱包中的银行卡列表页
     * - 1072：二维码收款页面
     * - 1073：客服消息列表下发的小程序消息卡片
     * - 1074：公众号会话下发的小程序消息卡片
     * - 1077：摇周边
     * - 1078：微信连 Wi-Fi 成功提示页
     * - 1079：微信游戏中心
     * - 1081：客服消息下发的文字链
     * - 1082：公众号会话下发的文字链
     * - 1084：朋友圈广告原生页
     * - 1088：会话中查看系统消息，打开小程序
     * - 1089：微信聊天主界面下拉，「最近使用」栏（基础库 2.2.4 版本起包含「我的小程序」栏）
     * - 1090：长按小程序右上角菜单唤出最近使用历史
     * - 1091：公众号文章商品卡片
     * - 1092：城市服务入口
     * - 1095：小程序广告组件
     * - 1096：聊天记录，打开小程序
     * - 1097：微信支付签约原生页，打开小程序
     * - 1099：页面内嵌插件
     * - 1100：红包封面详情页打开小程序
     * - 1101：远程调试热更新（开发者工具中，预览 -> 自动预览 -> 编译并预览）
     * - 1102：公众号 profile 页服务预览
     * - 1103：发现栏小程序主入口，「我的小程序」列表（基础库 2.2.4 版本起废弃）
     * - 1104：微信聊天主界面下拉，「我的小程序」栏（基础库 2.2.4 版本起废弃）
     * - 1106：聊天主界面下拉，从顶部搜索结果页，打开小程序
     * - 1107：订阅消息，打开小程序
     * - 1113：安卓手机负一屏，打开小程序（三星）
     * - 1114：安卓手机侧边栏，打开小程序（三星）
     * - 1119：【企业微信】工作台内打开小程序
     * - 1120：【企业微信】个人资料页内打开小程序
     * - 1121：【企业微信】聊天加号附件框内打开小程序
     * - 1124：扫“一物一码”打开小程序
     * - 1125：长按图片识别“一物一码”
     * - 1126：扫描手机相册中选取的“一物一码”
     * - 1129：微信爬虫访问 [详情](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/sitemap.html)
     * - 1131：浮窗（8.0 版本起仅包含被动浮窗）
     * - 1133：硬件设备打开小程序 [详情](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/)
     * - 1135：小程序 profile 页相关小程序列表，打开小程序
     * - 1144：公众号文章 - 视频贴片
     * - 1145：发现栏 - 发现小程序
     * - 1146：地理位置信息打开出行类小程序
     * - 1148：卡包-交通卡，打开小程序
     * - 1150：扫一扫商品条码结果页打开小程序
     * - 1151：发现栏 - 我的订单
     * - 1152：订阅号视频打开小程序
     * - 1153：“识物”结果页打开小程序
     * - 1154：朋友圈内打开“单页模式”
     * - 1155：“单页模式”打开小程序
     * - 1157：服务号会话页打开小程序
     * - 1158：群工具打开小程序
     * - 1160：群待办
     * - 1167：H5 通过开放标签打开小程序 [详情](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_Open_Tag.html)
     * - 1168：移动应用直接运行小程序
     * - 1169：发现栏小程序主入口，各个生活服务入口（例如快递服务、出行服务等）
     * - 1171：微信运动记录（仅安卓）
     * - 1173：聊天素材用小程序打开 [详情](https://developers.weixin.qq.com/miniprogram/dev/framework/material/support_material.html)
     * - 1175：视频号主页商店入口
     * - 1176：视频号直播间主播打开小程序
     * - 1177：视频号直播商品
     * - 1178：在电脑打开手机上打开的小程序
     * - 1179：#话题页打开小程序
     * - 1181：网站应用打开 PC 小程序
     * - 1183：PC 微信 - 小程序面板 - 发现小程序 - 搜索
     * - 1184：视频号链接打开小程序
     * - 1185：群公告
     * - 1186：收藏 - 笔记
     * - 1187：浮窗（8.0 版本起）
     * - 1189：表情雨广告
     * - 1191：视频号活动
     * - 1192：企业微信联系人 profile 页
     * - 1193：视频号主页服务菜单打开小程序
     * - 1194：URL Link [详情](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/url-link.html)
     * - 1195：视频号主页商品 tab
     * - 1196：个人状态打开小程序
     * - 1197：视频号主播从直播间返回小游戏
     * - 1198：视频号开播界面打开小游戏
     * - 1200：视频号广告打开小程序
     * - 1201：视频号广告详情页打开小程序
     * - 1202：企微客服号会话打开小程序卡片
     * - 1203：微信小程序压测工具的请求
     * - 1206：视频号小游戏直播间打开小游戏
     * - 1207：企微客服号会话打开小程序文字链
     * - 1208：聊天打开商品卡片
     * - 1212：青少年模式申请页打开小程序
     * - 1215：广告预约打开小程序
     * - 1216：视频号订单中心打开小程序
     * - 1223：安卓桌面 Widget 打开小程序
     * - 1228：视频号原生广告组件打开小程序
     * - 1231：动态消息提醒入口打开小程序
     */
    scene: SceneValues;
    /** shareTicket，详见 [获取更多转发信息]((转发#获取更多转发信息)) */
    shareTicket: string;
    /** 当场景为由从另一个小程序或公众号或App打开时，返回此字段 */
    referrerInfo?: ReferrerInfo;
  }

  interface PageNotFoundOption {
    /** 不存在页面的路径 */
    path: string;
    /** 打开不存在页面的 query */
    query: IAnyObject;
    /** 是否本次启动的首个页面（例如从分享等入口进来，首个页面是开发者配置的分享页面） */
    isEntryPage: boolean;
  }

  interface Option {
    /** 生命周期回调—监听小程序初始化
     *
     * 小程序初始化完成时触发，全局只触发一次。
     */
    onLaunch(options: LaunchShowOption): void;
    /** 生命周期回调—监听小程序显示
     *
     * 小程序启动，或从后台进入前台显示时
     */
    onShow(options: LaunchShowOption): void;
    /** 生命周期回调—监听小程序隐藏
     *
     * 小程序从前台进入后台时
     */
    onHide(): void;
    /** 错误监听函数
     *
     * 小程序发生脚本错误，或者 api
     */
    onError(/** 错误信息，包含堆栈 */ error: string): void;
    /** 页面不存在监听函数
     *
     * 小程序要打开的页面不存在时触发，会带上页面信息回调该函数
     *
     * **注意：**
     * 1. 如果开发者没有添加 `onPageNotFound` 监听，当跳转页面不存在时，将推入微信客户端原生的页面不存在提示页面。
     * 2. 如果 `onPageNotFound` 回调中又重定向到另一个不存在的页面，将推入微信客户端原生的页面不存在提示页面，并且不再回调 `onPageNotFound`。
     *
     * 最低基础库： 1.9.90
     */
    onPageNotFound(options: PageNotFoundOption): void;
    /**
     * 小程序有未处理的 Promise 拒绝时触发。也可以使用 [wx.onUnhandledRejection](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onUnhandledRejection.html) 绑定监听。注意事项请参考 [wx.onUnhandledRejection](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onUnhandledRejection.html)。
     * **参数**：与 [wx.onUnhandledRejection](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onUnhandledRejection.html) 一致
     */
    onUnhandledRejection: OnUnhandledRejectionCallback;
    /**
     * 系统切换主题时触发。也可以使用 wx.onThemeChange 绑定监听。
     *
     * 最低基础库： 2.11.0
     */
    onThemeChange: OnThemeChangeCallback;
  }

  type Instance<T extends IAnyObject> = Option & T;
  type Options<T extends IAnyObject> = Partial<Option> & T & ThisType<Instance<T>>;
  type TrivialInstance = Instance<IAnyObject>;

  interface Constructor {
    <T extends IAnyObject>(options: Options<T>): void;
  }

  interface GetAppOption {
    /** 在 `App` 未定义时返回默认实现。当App被调用时，默认实现中定义的属性会被覆盖合并到App中。一般用于独立分包
     *
     * 最低基础库： 2.2.4
     */
    allowDefault?: boolean;
  }

  interface GetApp {
    <T extends IAnyObject = IAnyObject>(opts?: GetAppOption): Instance<T>;
  }
}

declare let App: WechatMiniprogram.App.Constructor;
declare let getApp: WechatMiniprogram.App.GetApp;
