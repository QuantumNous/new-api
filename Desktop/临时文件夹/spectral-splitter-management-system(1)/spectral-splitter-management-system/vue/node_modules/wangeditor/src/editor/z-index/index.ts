/**
 * @description z-index 管理器
 * @author fangzhicong
 */
import Editor from '../index'
import style from '../../config/style'

const tier = {
    menu: 2, // 显示状态下的菜单栏
    panel: 2,
    toolbar: 1, // 菜单栏父容器
    tooltip: 1, // tooltip
    textContainer: 1, // 编辑区域
}

type Tier = typeof tier

type TierKey = keyof Tier
export default class ZIndex {
    // 层级参数
    private tier: Tier = tier

    // 默认值
    private baseZIndex = style.zIndex

    // 获取 tierName 对应的 z-index 的值。如果 tierName 未定义则返回默认的 z-index 值
    get(tierName?: TierKey): number {
        if (tierName && this.tier[tierName]) {
            return this.baseZIndex + this.tier[tierName]
        }
        return this.baseZIndex
    }

    // 初始化
    init(editor: Editor) {
        if (this.baseZIndex == style.zIndex) {
            this.baseZIndex = editor.config.zIndex
        }
    }
}
