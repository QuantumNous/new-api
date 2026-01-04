const ENTRY_CONTENT = `@import './mixin.scss';
@import './variables.scss';
@import './_font.scss';`;

const MIXIN_CONTENT = `/* shadow */
@mixin shadow-elevated {
    box-shadow: var(--semi-shadow-elevated);
}
@mixin shadow-2 {
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.14), 0px 0px 1px rgba(0, 0, 0, 0.16);
}
@mixin shadow-0 {
    box-shadow: none;
}
@mixin shadow-1 {
    box-shadow: none;
}
@mixin shadow-knob {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.3);
}
// box-sizing
@mixin box-sizing() {
    box-sizing: border-box;
}

@mixin all-center {
    display: flex;
    justify-content: center;
    align-items: center;
}

@mixin ver-center {
    display: flex;
    align-items: center;
}

@mixin hor-center {
    display: flex;
    justify-content: center;
}

@mixin text-overflow-hidden {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

@mixin no-scrollbar {
    &::-webkit-scrollbar {
        // width: 8px;
        display: none;
    }
    &::-webkit-scrollbar-thumb {
        background-color: transparent;
        // background-color: $grey-2;
    }
    &::-webkit-scrollbar-track {
        opacity: 0;
        background-color: rgba(0, 0, 0, 0.05);
        background-color: transparent;
        // background-color: $grey-0;
    }
    &:hover {
        &::-webkit-scrollbar {
            display: block;
            width: 8px;
            // width: 12px;
        }
        &::-webkit-scrollbar-thumb {
            border-radius: 10px;
            background-color: var(--semi-gray-3);
        }
        &::-webkit-scrollbar-track {
            // background-color: rgba(0, 0, 0, 0.05);
        }
    }
}
`;

const VARIABLES_CONTENT = `$prefix: 'semi';

/* sizing */
$height-control-small: 24px; // 表单项高度 - 小尺寸
$height-control-default: 32px; // 表单项高度 - 默认尺寸
$height-control-large: 40px; // 表单项高度 - 大尺寸
$border-thickness: 0; // 描边宽度 - 零
$border-thickness-control: 1px; // 描边宽度 - 默认状态（checkbox 等）
$border-thickness-control-focus: 1px; // 描边宽度 - focus 状态（checkbox 等）

$width-icon-extra-small: 8px; // 图标尺寸 - 超小
$width-icon-small: 12px; // 图标尺寸 - 小
$width-icon-medium: 16px; // 图标尺寸 - 中
$width-icon-large: 20px; // 图标尺寸 - 大
$width-icon-extra-large: 24px; // 图标尺寸 - 超大

/* spacing */
$spacing-none: 0; // 间距 - 零
$spacing-super-tight: 2px; // 间距 - 极紧凑尺寸内/外边距
$spacing-extra-tight: 4px; // 间距 - 超紧凑尺寸内/外边距
$spacing-tight: 8px; // 间距 - 紧凑尺寸内/外边距
$spacing-base-tight: 12px; // 间距 - 默认（偏紧凑）尺寸内/外边距
$spacing-base: 16px; // 间距 - 默认尺寸内/外边距
$spacing-base-loose: 20px; // 间距 - 默认（偏宽松）尺寸内/外边距
$spacing-loose: 24px; // 间距 - 宽松尺寸内/外边距
$spacing-extra-loose: 32px; // 间距 - 超宽松尺寸内/外边距
$spacing-super-loose: 40px; // 间距 - 极宽松尺寸内/外边距

// z-index
$z-portal: 1; // 抽象插槽，适用于未经特殊定制的所有组件
$z-affix: 10; // 固定位置的页面元素 z-index
$z-backtop: 10; // 返回顶部 z-index
$z-badge: 10; // badge z-index
$z-modal: 1000; // modal z-index
$z-modal-mask: 1000; // modal 遮罩 z-index

$z-toast: 1010; // toast 组件 z-index
$z-notification: 1010; // notification 组件 z-index
$z-popover: 1030; // popover 组件 z-index
$z-dropdown: 1050; // dropdown 组件 z-index
$z-tooltip: 1060; // tooltip 组件 z-index
// $z-avatar-default: 100;

// font
$font-family-regular: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue',
    Helvetica, Arial, sans-serif; // semi 预置字体回退
$font-size-small: 12px; // 小文本字号
$font-size-regular: 14px; // 常规文本字号

$font-size-header-6: 16px; // 六级标题字号
$font-size-header-5: 18px; // 五级标题字号
$font-size-header-4: 20px; // 四级标题字号
$font-size-header-3: 24px; // 三级标题字号
$font-size-header-2: 28px; // 二级标题字号
$font-size-header-1: 32px; // 一级标题字号

$font-weight-light: 200; // 字重 - 轻
$font-weight-regular: 400; // 字重 - 常规
$font-weight-bold: 600; // 字重 - 加粗
`;

const FONT_CONTENT = `// font-size line-height绑定
@mixin font-size-small {
    font-size: $font-size-small;
    line-height: 16px;
    font-family: $font-family-regular;
}

@mixin font-size-regular {
    font-size: $font-size-regular;
    line-height: 20px;
    font-family: $font-family-regular;
}

@mixin font-size-header-6 {
    font-size: $font-size-header-6;
    line-height: 22px;
    font-family: $font-family-regular;
}

@mixin font-size-header-5 {
    font-size: $font-size-header-5;
    line-height: 24px;
    font-family: $font-family-regular;
}

@mixin font-size-header-4 {
    font-size: $font-size-header-4;
    line-height: 28px;
    font-family: $font-family-regular;
}

@mixin font-size-header-3 {
    font-size: $font-size-header-3;
    line-height: 32px;
    font-family: $font-family-regular;
}

@mixin font-size-header-2 {
    font-size: $font-size-header-2;
    line-height: 40px;
    font-family: $font-family-regular;
}

@mixin font-size-header-1 {
    font-size: $font-size-header-1;
    line-height: 44px;
    font-family: $font-family-regular;
}
`;

export const themeScssContent = {
    'theme/index.scss': ENTRY_CONTENT,
    'theme/variables.scss': VARIABLES_CONTENT,
    'theme/_font.scss': FONT_CONTENT,
    'theme/mixin.scss': MIXIN_CONTENT
};