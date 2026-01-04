const DESCRIPTIONS_CONTENT = `@import "./variables.scss";

$module: #{$prefix}-descriptions;

.#{$module} {
    line-height: $font-descriptions-lineHeight;
    table,
    tr,
    th,
    td {
        margin: 0;
        padding: 0;
        border: 0;
    }

    th {
        padding-right: $spacing-descriptions_th-paddingRight;
    }

    & &-item {
        margin: 0;
        padding-bottom: $spacing-descriptions_item-paddingBottom;
        text-align: left;
        vertical-align: top;
    }

    &-key {
        font-weight: normal;
        @include font-size-regular;
        min-height: $font-size-regular;
        white-space: nowrap;
        color: $color-descriptions_key-text-default;
    }

    &-value {
        font-weight: normal;
        @include font-size-regular;
        color: $color-descriptions_value-text-default;
    }

    &-center {
        .#{$module}-item-th {
            text-align: right;
        }

        .#{$module}-item-td {
            text-align: left;
        }
    }

    &-left {
        .#{$module}-item-th,
        .#{$module}-item-td {
            text-align: left;
        }
    }

    &-justify {
        .#{$module}-item-th {
            text-align: left;
        }

        .#{$module}-item-td {
            text-align: right;
        }
    }

    &-plain {
        // tag 垂直居中
        .#{$module}-key,
        .#{$module}-value {
            display: inline-block;
        }

        .#{$module}-value {
            padding-left: $spacing-descriptions_value_plain-paddingLeft;

            & .#{$prefix}-tag {
                vertical-align: middle;
            }
        }
    }

    &-double {

        tbody {
            display: flex;
            flex-wrap: wrap;
        }

        tr {
            display: inline-flex;
            flex-direction: column;
        }

        & .#{$module}-item {
            padding: $spacing-descriptions_item_double-padding;
            flex: 1;
        }

        .#{$module}-value {
            font-weight: $font-descriptions_value-fontWeight;
        }

        &-small {
            .#{$module}-item {
                padding-right: $spacing-descriptions_item_small-paddingRight;
            }

            .#{$module}-key {
                @include font-size-small;
                padding-bottom: 0;
            }

            .#{$module}-value {
                @include font-size-header-6;
            }
        }

        &-medium {
            .#{$module}-item {
                padding-right: $spacing-descriptions_item_medium-paddingRight;
            }

            & .#{$module}-key {
                padding-bottom: $spacing-descriptions_key_medium-paddingBottom;
            }

            & .#{$module}-value {
                @include font-size-header-4;
            }
        }

        &-large {
            .#{$module}-item {
                padding-right: $spacing-descriptions_item_large-paddingRight;
            }

            & .#{$module}-key {
                padding-bottom: $spacing-descriptions_key_large-paddingBottom;
            }

            & .#{$module}-value {
                @include font-size-header-2;
            }
        }
    }
}
`;

const DESCRIPTIONS_VARIABLES = `$font-descriptions-lineHeight: 20px; // 文字行高
$font-descriptions_value-fontWeight: $font-weight-bold; // 双行显示 value 文字字重
$spacing-descriptions_th-paddingRight: $spacing-loose; // 普通显示 key 右侧内边距
$spacing-descriptions_item-paddingBottom: $spacing-base-tight; // 普通显示 item 底部内边距
$spacing-descriptions_item_small-paddingRight: 48px; // 双行显示 item 右侧内边距 - 小尺寸
$spacing-descriptions_item_medium-paddingRight: 60px; // 双行显示 item 右侧内边距 - 中尺寸
$spacing-descriptions_item_large-paddingRight: 80px; // 双行显示 item 右侧内边距 - 大尺寸
$spacing-descriptions_key_medium-paddingBottom: $spacing-extra-tight; // 双行显示 key 底部内边距 - 中尺寸
$spacing-descriptions_key_large-paddingBottom: $spacing-extra-tight; // 双行显示 key 底部内边距 - 大尺寸

$color-descriptions_key-text-default: var(--semi-color-text-2); // key 文字颜色
$color-descriptions_value-text-default: var(--semi-color-text-0); // value 文字颜色

$spacing-descriptions_value_plain-paddingLeft: 8px; // 普通显示 plain 模式下 value 左侧内边距
$spacing-descriptions_item_double-padding: 0; // 双行显示右侧 item 内边距
`;

export const TYPOGRAPHY_CONTENT = `@import "./variables.scss";

$module: #{$prefix}-typography;

.#{$module} {
    color: $color-typography_default-text-default;
    @include font-size-regular;

    &.#{$module}-secondary {
        color: $color-typography_secondary-text-default;
    }

    &.#{$module}-tertiary {
        color: $color-typography_tertiary-text-default;
    }

    &.#{$module}-quaternary {
        color: $color-typography_quaternary-text-default;
    }

    &.#{$module}-warning {
        color: $color-typography_warning-text-default;
    }

    &.#{$module}-success {
        color: $color-typography_success-text-default;
    }

    &.#{$module}-danger {
        color: $color-typography_danger-text-default;
    }

    &.#{$module}-link {
        color: $color-typography_link-text-default;
        font-weight: $font-typography_link-fontWeight;
    }

    &.#{$module}-disabled {
        color: $color-typography_disabled-text-default;
        cursor: not-allowed;
        user-select: none;
        &.#{$module}-link {
            color: $color-typography_link-text-disabled;
        }
    }

    &-icon {
        // display: inline-flex;
        margin-right: $spacing-typography_iconPrefix-marginRight;
        vertical-align: middle;
        color: inherit;
    }

    &-small {
        @include font-size-small;
    }

    code {
        border: $width-typography_code-border solid $color-typography_code-border-default;
        border-radius: $radius-typography_code;
        color: $color-typography_code-text-default;
        background-color: $color-typography_code-bg-default;
        padding: $spacing-super-tight $spacing-extra-tight;
    }

    mark {
        background-color: $color-typography_mark-bg-default;
    }

    u {
        text-decoration: underline;
        text-decoration-skip-ink: auto;
    }

    del {
        text-decoration: line-through;
    }

    strong {
        font-weight: $font-typography_strong-fontWeight;
    }

    a {
        display: inline;
        color: $color-typography_link-text-default;
        cursor: pointer;
        text-decoration: none;

        &:visited {
            color: $color-typography_link-text-visited;
        }

        &:hover {
            color: $color-typography_link-text-hover;
        }

        &:active {
            color: $color-typography_link-text-active;
        }

        .#{$module}-link-underline:hover {
            border-bottom: $width-typography_link-border solid $color-typography_link-text-hover;
            margin-bottom: -$width-typography_link-border;
        }

        .#{$module}-link-underline:active {
            border-bottom: $width-typography_link-border solid $color-typography_link-text-active;
            margin-bottom: -$width-typography_link-border;
        }
    }

    // ============ Ellipsis ============
    // &-ellipsis {
    //   display: block;
    // }

    &-ellipsis-single-line {
        // display: block;
        overflow: hidden;
    }

    &-ellipsis-multiple-line {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &-ellipsis-overflow-ellipsis {
        display: block;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    &-ellipsis-expand {
        display: inline;
        margin-left: $spacing-typography_expandText-marginLeft;
    }

    // ============ Copyable ============

    &-action-copy {
        display: inline-flex;
        vertical-align: text-bottom;
        padding: $spacing-typography_copyIcon-padding;
        margin-left: $spacing-typography_copyIcon-marginLeft;
    }

    a.#{$module}-action-copy-icon {
        display: inline-flex;
    }

    &-action-copied {
        display: inline-flex;
        padding: $spacing-typography_copyIcon-padding;
        margin-left: $spacing-typography_copyIcon-marginLeft;
        color: $color-typography_copied-text-success;

        .#{$prefix}-icon {
            vertical-align: text-bottom;
            color: $color-typography_copied-icon-success;
        }
    }

    &-paragraph {
        margin: $spacing-typography_title_paragraph-margin;
    }
}

// ============ Title ============
h1.#{$module},
.#{$module}-h1.#{$module} {
    @include font-size-header-1;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h1-margin;
}

h2.#{$module},
.#{$module}-h2.#{$module} {
    @include font-size-header-2;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h2-margin;
}

h3.#{$module},
.#{$module}-h3.#{$module} {
    @include font-size-header-3;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h3-margin;
}

h4.#{$module},
.#{$module}-h4.#{$module} {
    @include font-size-header-4;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h4-margin;
}

h5.#{$module},
.#{$module}-h5.#{$module} {
    @include font-size-header-5;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h5-margin;
}

h6.#{$module},
.#{$module}-h6.#{$module} {
    @include font-size-header-6;
    font-weight: $font-typography_title-fontWeight;
    margin: $spacing-typography_title_h6-margin;
}

// ============ Paragraph ============
p.#{$module}-extended,
.#{$module}-paragraph.#{$module}-extended {
    line-height: $font-typography_paragraph_extended-lineHeight;
}
`;

const TYPOGRAPHY_VARIABLES = `$color-typography_default-text-default: var(--semi-color-text-0); // 默认文本颜色
$color-typography_secondary-text-default: var(--semi-color-text-1); // 稍次要文本颜色
$color-typography_tertiary-text-default: var(--semi-color-text-2); // 次要文本颜色
$color-typography_quaternary-text-default: var(--semi-color-text-3); // 最次要文本颜色
$color-typography_warning-text-default: var(--semi-color-warning); // 警告文本颜色
$color-typography_danger-text-default: var(--semi-color-danger); // 错误文本颜色
$color-typography_success-text-default: var(--semi-color-success); // 成功文本颜色

$color-typography_disabled-text-default: var(--semi-color-disabled-text); // 禁用文本颜色
$color-typography_mark-bg-default: var(--semi-color-primary-light-default); // 标记文本颜色
$color-typography_code-bg-default: var(--semi-color-fill-1); // 代码文本背景颜色
$color-typography_code-text-default: var(--semi-color-text-2); // 代码文本颜色

$color-typography_link-text-default: var(--semi-color-link); // 链接文本颜色 - 默认
$color-typography_link-text-visited: var(--semi-color-link-visited); // 链接文本颜色 - 已访问
$color-typography_link-text-hover: var(--semi-color-link-hover); // 链接文本颜色 - 悬浮
$color-typography_link-text-active: var(--semi-color-link-active); // 链接文本颜色 - 激活
$color-typography_link-text-disabled: var(--semi-color-link); // 链接文本颜色 - 禁用

$color-typography_copied-text-success: var(--semi-color-text-2); // 可复制文本颜色
$color-typography_copied-icon-success: var(--semi-color-success); // 可复制文本复制成功图标颜色
$color-typography_code-border-default: var(--semi-color-border); // 代码文本描边颜色


$font-typography_title-fontWeight: $font-weight-bold; // 标题文本字重
$font-typography_link-fontWeight: $font-weight-bold; // 链接文本字重
$font-typography_strong-fontWeight: $font-weight-bold; // 强调文本字重
$font-typography_paragraph_extended-lineHeight: 24px; // 宽松行距段落文本行高

$spacing-typography_iconPrefix-marginRight: 4px; // 带前缀文本图标右侧外边距
$spacing-typography_expandText-marginLeft: 8px; // 支持展开文本展开按钮左侧外边距
$spacing-typography_copyIcon-marginLeft: 4px; // 可复制文本复制图标左侧外边距
$spacing-typography_copyIcon-padding: 0; // 可复制文本复制图标内边距
$spacing-typography_title_h1-margin: 0; // 一级标题外边距
$spacing-typography_title_h2-margin: 0; // 二级标题外边距
$spacing-typography_title_h3-margin: 0; // 三级标题外边距
$spacing-typography_title_h4-margin: 0; // 四级标题外边距
$spacing-typography_title_h5-margin: 0; // 五级标题外边距
$spacing-typography_title_h6-margin: 0; // 六级标题外边距
$spacing-typography_title_paragraph-margin: 0; // 段落外边距

$width-typography_code-border: 1px; // 代码文本描边宽度
$width-typography_link-border: 1px; // 链接文本下划线宽度

$radius-typography_code: 2px; // 代码文本圆角
`;

const INPUT_CONTENT = `@import "./variables.scss";

$module: #{$prefix}-input;


.#{$module}-textarea-wrapper {
    box-sizing: border-box;
    display: inline-block;
    position: relative;
    width: 100%;
    border: $width-input_wrapper-border $color-input_default-border-default solid;
    border-radius: $radius-input_wrapper;
    vertical-align: bottom;
    background-color: $color-input_default-bg-default;

    &:hover {
        background-color: $color-input_default-bg-hover;
    }

    &-focus {
        background-color: $color-input_default-bg-focus;
        border: $width-input_wrapper_focus-border $color-input_default-border-focus solid;
        &:hover,
        &:active {
            background-color: $color-input_default-bg-focus;
        }
    }

    &:active {
        background-color: $color-input_default-bg-active;
    }

    .#{$module}-clearbtn {
        position: absolute;
        top: 0;
        min-width: $width-textarea-icon;
        color: $color-textarea-icon-default;
        right: $spacing-textarea-icon-right;
        height: $height-textarea-default;

        & > svg {
            pointer-events: none;
        }

        &:hover {
            cursor: pointer;

            .#{$prefix}-icon {
                color: $color-textarea-icon-hover;
            }
        }

        &-hidden {
            visibility: hidden;
        }
    }

    &-readonly {
        cursor: default;
    }

    &-disabled {
        cursor: not-allowed;
        // border: $border-thickness-control $color-input_disabled-border-default solid;
        color: $color-input_disabled-text-default;
        background-color: $color-input_disabled-bg-default;

        &:hover {
            background-color: $color-input_disabled-bg-default;
        }

        &::placeholder {
            color: $color-input_disabled-text-default;
        }
    }

    &-error {
        background-color: $color-input_danger-bg-default;
        border-color: $color-input_danger-border-default;

        &:hover {
            background-color: $color-input_danger-bg-hover;
            border-color: $color-input_danger-border-hover;
        }

        &.#{$module}-textarea-wrapper-focus {
            background-color: $color-input_danger-bg-focus;
            border-color: $color-input_danger-border-focus;
        }

        &:active {
            background-color: $color-input_danger-bg-active;
            border-color: $color-input_danger-border-active;
        }
    }

    &-warning {
        background-color: $color-input_warning-bg-default;
        border-color: $color-input_warning-border-default;

        &:hover {
            background-color: $color-input_warning-bg-hover;
            border-color: $color-input_warning-border-hover;
        }

        &.#{$module}-textarea-wrapper-focus {
            background-color: $color-input_warning-bg-focus;
            border-color: $color-input_warning-border-focus;
        }

        &:active {
            background-color: $color-input_warning-bg-active;
            border-color: $color-input_warning-border-active;
        }
    }

    // &-resize {
    //     resize: vertical;
    //     overflow: auto;

    //     .#{$module}-textarea {
    //         min-height: 52px;
    //         height: calc(100% - 24px);
    //     }
    // }
}

.#{$module}-textarea {
    position: relative;
    resize: none;
    // min-height: $height-input_default;
    padding: $spacing-textarea-paddingY $spacing-textarea-paddingX;

    @include shadow-0;
    @include font-size-regular;
    background-color: transparent;
    border: $width-textarea-border solid $color-textarea-border-default;
    vertical-align: bottom;

    width: 100%;
    outline: none;
    cursor: text;
    box-sizing: border-box;
    color: $color-input_default-text-default;

    &::placeholder {
        color: $color-input_placeholder-text-default;
    }

    &-showClear {
        padding-right: $spacing-textarea_withShowClear-paddingRight;
    }

    &-disabled {
        cursor: not-allowed;
        color: $color-input_disabled-text-default;
        background-color: transparent;

        &:hover {
            background-color: transparent;
        }

        &::placeholder {
            color: $color-input_disabled-text-default;
        }
    }

    &-autosize {
        overflow: hidden;
    }
    
    &-counter {
        @include font-size-small;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: $spacing-textarea_counter-paddingTop $spacing-textarea_counter-paddingRight $spacing-textarea_counter-paddingBottom $spacing-textarea_counter-paddingLeft;
        min-height: $height-textarea_counter;
        text-align: right;
        color: $color-input_counter-text-default;

        &-exceed {
            color: $color-input_counter_danger-text-default;
        }
    }
}
`;

const INPUT_VARIABLES = `$color-input_default-border-default: transparent; // 输入框描边颜色 - 默认

$color-input_default-bg-default: var(--semi-color-fill-0); // 输入框背景颜色 - 默认
$color-input_default-text-default: var(--semi-color-text-0); // 输入框文本颜色 - 默认

$color-input_default-bg-hover: var(--semi-color-fill-1); // 输入框背景颜色 - 悬浮
$color-input_default-border-hover: $color-input_default-bg-hover; // 输入框描边颜色 - 悬浮

$color-input_default-bg-active: var(--semi-color-fill-2); // 输入框背景颜色 - 按下
$color-input_default-border-active: $color-input_default-bg-active; // 输入框描边颜色 - 按下

$color-input_default-bg-focus: var(--semi-color-fill-0); // 输入框背景颜色 - 选中
$color-input_default-border-focus: var(--semi-color-focus-border); // 输入框描边颜色 - 选中

// error
$color-input_danger-bg-default: var(--semi-color-danger-light-default); // 错误输入框背景颜色 - 默认
$color-input_danger-border-default: var(--semi-color-danger-light-default); // 错误输入框描边颜色 - 默认

$color-input_danger-bg-hover: var(--semi-color-danger-light-hover); // 错误输入框背景颜色 - 悬浮
$color-input_danger-border-hover: var(--semi-color-danger-light-hover); // 错误输入框描边颜色 - 悬浮

$color-input_danger-bg-focus: var(--semi-color-danger-light-default); // 错误输入框背景颜色 - 选中
$color-input_danger-border-focus: var(--semi-color-danger); // 错误输入框描边颜色 - 选中

$color-input_danger-bg-active: var(--semi-color-danger-light-active); // 错误输入框背景颜色 - 按下
$color-input_danger-border-active: var(--semi-color-danger-light-active); // 错误输入框描边颜色 - 按下

// warning
$color-input_warning-bg-default: var(--semi-color-warning-light-default); // 警告输入框背景颜色 - 默认
$color-input_warning-border-default: var(--semi-color-warning-light-default); // 警告输入框文本颜色 - 默认

$color-input_warning-bg-hover: var(--semi-color-warning-light-hover); // 警告输入框背景颜色 - 悬浮
$color-input_warning-border-hover: var(--semi-color-warning-light-hover); // 警告输入框描边颜色 - 悬浮

$color-input_warning-bg-focus: var(--semi-color-warning-light-default); // 警告输入框背景颜色 - 选中
$color-input_warning-border-focus: var(--semi-color-warning); // 警告输入框描边颜色 - 选中

$color-input_warning-bg-active: var(--semi-color-warning-light-active); // 警告输入框背景颜色 - 按下
$color-input_warning-border-active: var(--semi-color-warning-light-active); // 警告输入框描边颜色 - 按下

// disabled
$color-input_disabled-border-default: var(--semi-color-disabled-border); // 禁用输入框描边颜色
$color-input_disabled-bg-default: var(--semi-color-disabled-fill); // 禁用输入框背景颜色
$color-input_disabled-text-default: var(--semi-color-disabled-text); // 禁用输入框文字颜色

$color-input_placeholder-text-default: var(--semi-color-text-2); // 输入框占位文字颜色
$color-input_prefix-text-default: var(--semi-color-text-2); // 输入框 prefix 文字颜色
$color-input-icon-default: var(--semi-color-text-2); // 输入框图标颜色
$color-input-icon-hover: var(--semi-color-primary-hover); // 输入框图标颜色 - 悬浮
$color-input-icon-active: var(--semi-color-primary-active); // 输入框图标颜色 - 按下

// prefix and suffix text

$color-input_counter-text-default: var(--semi-color-text-2); // 多行文本字数统计文字颜色 - 未超限
$color-input_counter_danger-text-default: var(--semi-color-danger); // 多行文本字数统计文字颜色 - 未超限

$color-input_group-border-default: var(--semi-color-border); // 输入框组合分割线颜色

$height-input_large: $height-control-large - 2; // 输入框高度 & 行高 - 大尺寸
$height-input_small: $height-control-small - 2; // 输入框高度 & 行高 - 小尺寸
$height-input_default: $height-control-default - 2; // 输入框高度 & 行高 - 默认尺寸
$height-input_wrapper_large: $height-control-large;
$height-input_wrapper_small: $height-control-small;
$height-input_wrapper_default: $height-control-default;

$width-input-icon: $width-icon-medium + $spacing-tight * 2; // 密码图标最小宽度
$width-input-icon_clear_before_suffix: $width-icon-medium + $spacing-tight; // suffix 之前的清除按钮宽度
$width-input-icon_clear_before_modebtn: $width-icon-medium; // 密码之前的清除按钮宽度

$motion-scale_size-active: .97;
$motion-scale_size-inactive: 1;

$width-input_append-border: $border-thickness-control; // 后置标签描边宽度
$width-input_prepend-border: $border-thickness-control; // 前置标签描边宽度
$width-input_group_pseudo-border: $border-thickness-control; 
$width-input_wrapper-border: $border-thickness-control-focus; // 输入框描边宽度
$width-input_wrapper_focus-border: $border-thickness-control-focus; // 输入框描边宽度 - 选中态

$radius-input_wrapper: var(--semi-border-radius-small); // 输入框圆角大小
$spacing-input_icon-marginLeft: -$spacing-base-tight; // 输入框图标左侧内边距
$spacing-input-paddingLeft: $spacing-base-tight; // 输入光标距离容器的左侧内边距
$spacing-input-paddingRight: $spacing-base-tight; // 输入文字距离容器的右侧内边距
$spacing-input_insetLabel-marginRight: $spacing-base-tight;
$spacing-input_prefix_icon-marginY: 0; // prefix 图标垂直内边距
$spacing-input_prefix_icon-marginX: $spacing-tight; // prefix 图标水平内边距
$spacing-input_clearBtn_withSuffix-marginLeft: -$spacing-base-tight; // 清空按钮左侧内边距
$spacing-input_prepend-paddingY: 0; // 前置标签垂直内边距
$spacing-input_prepend-paddingX: $spacing-base-tight; // 前置标签水平内边距
$spacing-input_group_withTopLabel-marginTop: $spacing-base;
$spacing-input_group_withTopLabel-marginBottom: $spacing-base;
$font-input_insetLabel-fontWeight: 600; // prefix 文字字重

$spacing-textarea-paddingY: 5px; // 多行文本垂直内边距
$spacing-textarea-paddingX: $spacing-base-tight; // 多行文本水平内边距
$spacing-textarea_counter-paddingTop: 3px; // 多行文本字数统计顶部内边距
$spacing-textarea_counter-paddingRight: 12px; // 多行文本字数统计右侧内边距
$spacing-textarea_counter-paddingBottom: 5px; // 多行文本字数统计底部内边距
$spacing-textarea_counter-paddingLeft: 12px; // 多行文本字数统计左侧内边距

$width-textarea-border: $border-thickness; // 多行文本描边宽度
$height-textarea_counter: 24px; // 多行文本字数统计最小高度
$color-textarea-border-default: transparent; // 多行文本描边颜色

$color-textarea-icon-default: var(--semi-color-text-2); // 多行文本 clear 图标颜色
$color-textarea-icon-hover: var(--semi-color-primary-hover); // 多行文本 clear 图标颜色 - 悬浮
$width-textarea-icon: $width-icon-medium + $spacing-tight; // clear 图标最小宽度
$height-textarea-default: 32px; // 多行文本 clear 图标的高度
$spacing-textarea_withShowClear-paddingRight: 36px; // 多行文本设置 showClear 后的右内边距
$spacing-textarea-icon-right: $spacing-extra-tight;// 多行文本 clear 图标的右边距
`;

const SELECT_CONTENT = `//@import '../theme/variables.scss';
@import './variables.scss';
@import './mixin.scss';

$module: #{$prefix}-select;
$single: #{$module}-single;
$filterable: #{$module}-filterable;
$multiple: #{$module}-multiple;

.#{$module} {
    box-sizing: border-box;
    border-radius: $radius-select;
    border: $width-select-border solid $color-select-border-default;
    height: $height-select_default;
    font-weight: $font-select-fontWeight;
    background-color: $color-select-bg-default;
    // display: inline-block;
    display: inline-flex;
    vertical-align: middle;
    position: relative;
    outline: none;
    cursor: pointer;

    &:hover {
        background-color: $color-select-bg-hover;
    }

    &:active {
        background-color: $color-select-bg-active;
    }

    &:focus {
        border: $border-thickness-control-focus solid $color-select_default-border-focus;
        outline: 0;
    }

    &-small {
        height: $height-select_small;
        line-height: $height-select_small;
    }

    &-large {
        min-height: $height-select_large;
        line-height: $height-select_large;
    }

    &-open,
    &-focus {
        border: $border-thickness-control-focus solid $color-select_default-border-focus;
        outline: 0;

        &:hover {
            background-color: $color-select-bg-default;
        }
    }
    
    &-warning {
        background-color: $color-select_warning-bg-default;
        border-color: $color-select_warning-border-default;

        &:hover {
            background-color: $color-select_warning-bg-hover;
            border-color: $color-select_warning-border-hover;
        }

        &:focus {
            background-color: $color-select_warning-bg-focus;
            border-color: $color-select_warning-border-focus;
        }

        &:active {
            background-color: $color-select_warning-bg-active;
            border-color: $color-select_warning-border-active;
        }
    }

    &-error {
        background-color: $color-select_danger-bg-default;
        border-color: $color-select_danger-border-default;

        &:hover {
            background-color: $color-select_danger-bg-hover;
            border-color: $color-select_danger-border-hover;
        }

        &:focus {
            background-color: $color-select_danger-bg-focus;
            border-color: $color-select_danger-border-focus;
        }

        &:active {
            background-color: $color-select_danger-bg-active;
            border-color: $color-select_danger-border-active;
        }
    }

    &-disabled {
        cursor: not-allowed;
        background-color: $color-select_input_disabled-bg;
        // border: 1px solid $color-select_input_disabled-border;

        &:hover {
            background-color: $color-select_input_disabled-bg-hover;
        }

        &:focus {
            border: $border-thickness-control-focus solid $color-select_default-border-focus;
        }

        .#{$module}-selection,
        .#{$module}-selection-placeholder {
            color: $color-select_input_disabled-text;
            cursor: not-allowed;
        }

        .#{$module}-arrow,
        .#{$module}-prefix,
        .#{$module}-suffix {
            color: $color-select_input_disabled-text;
        }

        .#{$prefix}-tag {
            color: $color-select_input_disabled-text;
            background-color: transparent;
        }
    }

    &-selection {
        @include font-size-regular;

        height: 100%;

        display: flex;
        align-items: center;
        flex-grow: 1;
        overflow: hidden;

        margin-left: $spacing-select_selection-marginLeft;
        // margin-right: $width-select_icon_right;

        cursor: pointer;
        color: $color-select_main-text-default;

        &-text {
            // display: inline-flex;
            // align-items: center;
            // height: 100%;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;

            &-inactive {
                display: flex;
                opacity: $opacity-select_selection_text_inactive;
            }

            &-hide {
                display: none;
            }
        }

        &-placeholder {
            color: $color-select_input_placeholder-text;
        }

        .#{$prefix}-tag {

            &:nth-of-type(1) {
                margin-left: 0;
            }

            @include select-tag-margin;
        }

        .#{$prefix}-tag-group {
            height: inherit;
            .#{$prefix}-tag {
                @include select-tag-margin;
            }
        }
    }

    &-content-wrapper {
        white-space: nowrap;
        overflow: hidden;
        display: flex;
        align-items: center;
        height: 100%;
    }

    &-multiple {
        // 这里要设置为 auto，可能存在换行
        height: auto;

        .#{$module}-selection {
            margin-left: $spacing-select_multiple_selection-marginLeft;
            // &-placeholder {
            //     padding-left: $spacing-base-tight - $spacing-extra-tight;
            // }
        }

        .#{$module}-content-wrapper {
            width: 100%;
            min-height: $height-select_multiple_content_wrapper-minHeight;
            flex-wrap: wrap;

            &-empty {
                margin-left: $spacing-select_multiple_content_wrapper_empty-marginLeft;
            }

            .#{$prefix}-tag-group {
                display: flex;
                align-items: center;
            }

            &-one-line {
                flex-wrap: nowrap;

                .#{$prefix}-tag-group {
                    flex-wrap: nowrap;
                    justify-content: flex-start;
                    overflow: hidden;
                    flex-shrink: 0;
                }
            }
        }

        .#{$module}-inline-label-wrapper {
            flex-shrink: 0;
        }
    }

    &-multiple.#{$module}-large {
        .#{$module}-content-wrapper {
            min-height: $height-select_large - 2;
        }
    }

    &-multiple.#{$module}-small {
        .#{$module}-content-wrapper {
            min-height: $height-select_small - 2;
        }
    }

    &-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        width: $width-select_arrow;
        color: $color-select-icon-default;
        flex-shrink: 0;

        &-empty {
            // 不显示arrow时，右侧留出12px空白
            display: flex;
            width: $width-select_arrow_empty;
        }
    }

    &-prefix,
    &-suffix {
        @include all-center;

        &-text {
            margin: $spacing-select_prefix_suffix_text-marginY $spacing-select_prefix_suffix_text-marginX;
        }

        &-icon {
            color: $color-select-icon-default;
            margin: $spacing-select_prefix_suffix_icon-marginY $spacing-select_prefix_suffix_icon-marginX;
        }
    }

    &-suffix {
        @include all-center;
    }

    &-clear {
        @include all-center;
        width: $width-select_clear-icon;
        color: $color-select_clearBtn-text-default;
        flex-shrink: 0;
        &:hover {
            color: $color-select_clearBtn-text-hover;
        }
    }

    &-inset-label-wrapper {
        display: inline;
    }

    &-inset-label {
        margin-right: $spacing-base-tight;
        font-weight: $font-select_inset_label-fontWeight;
        @include font-size-regular;
        color: $color-select_inset_label-text;
        flex-shrink: 0;
        white-space: nowrap;
    }

    &-create-tips {
        color: $color-select_create_tips-text;
        margin-right: $spacing-select_create_tips-marginRight;
    }
}

.#{$module}-with-prefix {
    .#{$module}-selection {
        margin-left: 0;
    }
}

// 单选且可输入
.#{$single}.#{$filterable} {
    .#{$module}-content-wrapper {
        flex-grow: 1;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    .#{$prefix}-input-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        border: none;
        background-color: transparent;
    }

    .#{$prefix}-input-wrapper-focus {
        border: none;
    }

    .#{$prefix}-input {
        padding-left: 0;
        padding-right: 0;
        height: 100%; // 自定义renderSelectedItem时，Select的整体高度可能不是默认的32px
    }
}

// 多选且可输入
.#{$multiple}.#{$filterable} {
    .#{$module}-content-wrapper {
        flex-grow: 1;
        height: 100%;
        overflow: hidden;
        position: relative;

        &-empty {
            .#{$prefix}-input-wrapper {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
            }
        }
    }

    .#{$prefix}-input-wrapper {
        // position: absolute;
        // top: 0;
        // left: 0;
        height: 100%;
        width: 100%;
        border: none;
        background-color: transparent;
    }

    .#{$prefix}-input-wrapper-focus {
        border: none;
    }

    .#{$prefix}-input {
        padding-left: 0;
        padding-right: 0;
    }
}

.#{$module}-option-list {
    overflow-x: hidden;
    overflow-y: auto;

    &-chosen {
        .#{$module}-option-icon {
            display: flex;
        }
    }
}

.#{$module}-group {
    color: $color-select_group-text;
    padding-top: $spacing-select_group-paddingTop;
    margin-top: $spacing-select_group-marginTop;
    padding-bottom: $spacing-select_group-paddingBottom;
    padding-left: $spacing-select_group-paddingLeft;
    padding-right: $spacing-select_group-paddingRight;
    @include font-size-small;
    cursor: default;

    // &:nth-of-type(1) {
    //     margin-top: $spacing-extra-tight;
    // }

    &:not(:nth-of-type(1)) {
        border-top: $width-select_group_top-border solid $color-select_option-border-default;
    }
}


.#{$module}-loading-wrapper {
    padding-left: $spacing-select_loading_wrapper-paddingLeft;
    padding-right: $spacing-select_loading_wrapper-paddingRight;
    padding-top: $spacing-select_loading_wrapper-paddingTop;
    padding-bottom: $spacing-select_loading_wrapper-paddingBottom;
    cursor: not-allowed;
}

`;

const SELECT_VARIABLES = `// Color
$color-select-bg-default: var(--semi-color-fill-0); // 选择器输入框背景色 - 默认态
$color-select-bg-hover: var(--semi-color-fill-1); // 选择器输入框背景色 - 悬停态
$color-select-bg-active: var(--semi-color-fill-2); // 选择器输入框背景色 - 按下态
$color-select-border-default: transparent; // 选择器输入框描边颜色
$color-select_warning-bg-default: var(--semi-color-warning-light-default); // 警示选择器输入框背景色 - 默认态
$color-select_warning-border-default: var(--semi-color-warning-light-default); // 警示选择器输入框描边颜色 - 默认态
$color-select_warning-bg-hover: var(--semi-color-warning-light-hover); // 警示选择器输入框背景色 - 悬停态
$color-select_warning-border-hover: var(--semi-color-warning-light-hover); // 警示选择器输入框描边颜色 - 悬停态
$color-select_warning-bg-focus: var(--semi-color-warning-light-default); // 警示选择器输入框背景色 - 选中态
$color-select_warning-border-focus: var(--semi-color-warning); // 警示选择器输入框描边颜色 - 选中态
$color-select_warning-bg-active: var(--semi-color-warning-light-active); // 警示选择器输入框背景色 - 按下态
$color-select_warning-border-active: var(--semi-color-warning-light-active); // 警示选择器输入框描边颜色 - 按下态
$color-select_danger-bg-default: var(--semi-color-danger-light-default); // 报错选择器输入框背景色 - 默认态
$color-select_danger-border-default: var(--semi-color-danger-light-default); // 报错选择器输入框描边颜色 - 默认态
$color-select_danger-bg-hover: var(--semi-color-danger-light-hover); // 报错选择器输入框背景色 - 悬停态
$color-select_danger-border-hover: var(--semi-color-danger-light-hover); // 报错选择器输入框描边颜色 - 悬停态
$color-select_danger-bg-focus: var(--semi-color-danger-light-default); // 报错选择器输入框背景色 - 选中态
$color-select_danger-border-focus: var(--semi-color-danger); // 报错选择器输入框描边颜色 - 选中态
$color-select_danger-bg-active: var(--semi-color-danger-light-active); // 报错选择器输入框背景色 - 按下态
$color-select_danger-border-active: var(--semi-color-danger-light-active); // 报错选择器输入框描边颜色 - 按下态
$color-select_default-border-focus: var(--semi-color-focus-border); // 选择器输入框描边颜色 - 选中态
$color-select_main-text-default: var(--semi-color-text-0); // 选择器输入框回填内容文本颜色
$color-select-icon-default: var(--semi-color-text-2); // 选择器输入框图标颜色
$color-select_clearBtn-text-default: var(--semi-color-text-2); // 选择器输入框清空按钮颜色 - 默认态
$color-select_clearBtn-text-hover: var(--semi-color-primary); // 选择器输入框清空按钮颜色 - 悬停态
$color-select_input-bg-default: transparent; // 选择器输入框清空按钮颜色 - 悬停态
$color-select_input_disabled-bg: var(--semi-color-disabled-fill); // 禁用选择器输入框背景色
$color-select_input_disabled-border: var(--semi-color-border); // 禁用选择器输入框描边颜色
$color-select_input_disabled-text: var(--semi-color-disabled-text); // 禁用选择器输入框回填内容文字颜色
$color-select_input_disabled-bg-hover: var(--semi-color-disabled-fill); // 选择器输入框回填内容文字颜色 - 悬停态
$color-select_input_placeholder-text: var(--semi-color-text-2); // 选择器输入框占位文本文字颜色
$color-select_option_main-text: var(--semi-color-text-0); // 选择器菜单选项文本颜色
$color-select_option_keyword-text: var(--semi-color-primary); // 选择器菜单选项匹配搜索结果文本颜色
$color-select_option-bg-default: transparent; // 选择器菜单选项背景颜色 - 默认态
$color-select_option-icon-default: transparent; // 选择器菜单选项图标颜色 - 默认态
$color-select_option-bg-hover: var(--semi-color-fill-0); // 选择器菜单选项背景颜色 - 悬停态
$color-select_option-bg-active: var(--semi-color-fill-1); // 选择器菜单选项背景颜色 - 按下态
$color-select_option_disabled-text: var(--semi-color-disabled-text); // 禁用选择器菜单选项文字颜色
$color-select_option_disabled-bg: transparent; // 禁用选择器菜单选项背景颜色
$color-select_option-icon-active: var(--semi-color-text-2); // 禁用选择器菜单选项图标颜色 - 选中态
$color-select_option-border-default: var(--semi-color-border); // 分组选择器菜单项描边颜色
$color-select_inset_label-text: var(--semi-color-text-2); // 分组选择器菜单项辅助文本颜色
$color-select_create_tips-text: var(--semi-color-text-2); // 分组选择器菜单项提示文本颜色
$color-select_group-text: var(--semi-color-text-2); // 分组选择器菜单项分组标题文本颜色

// Width/Height
$width-select_icon_right: ($width-icon-medium + $spacing-tight * 2); // 选择器右侧图标大小
$height-select_large: $height-control-large; // 选择器输入框高度 - 大尺寸
$height-select_small: $height-control-small; // 选择器输入框高度 - 小尺寸
$height-select_default: $height-control-default; // 选择器输入框高度 - 默认尺寸
$width-select_option_tick: $width-icon-small; // 选择器菜单项选中对勾图标大小
$width-select-border: 1px; // 选择器输入框描边宽度
$width-select_arrow: 32px; // 选择器输入框下拉箭头宽度
$width-select_arrow_empty: 12px; // 选择器输入框下拉箭头为空时（有suffix icon）宽度
$width-select_clear-icon: 32px; // 选择器输入框清空按钮宽度
$width-select_group_top-border: $border-thickness-control; // 选择器菜单分组标题描边宽度
$height-select_multiple_content_wrapper-minHeight: $height-select_default - 2; // 多项选择器标签组最小宽度

// Spacing
$spacing-select_option_tick-marginRight: $spacing-tight; // 选择器菜单选中对勾右侧外边距
$spacing-select_prefix_suffix_text-marginX: $spacing-base-tight; // 选择器输入框前后缀文本水平内边距
$spacing-select_prefix_suffix_text-marginY: 0; // 选择器输入框前后缀文本垂直内边距
$spacing-select_prefix_suffix_icon-marginX: $spacing-tight; // 选择器输入框前后缀图标水平内边距
$spacing-select_prefix_suffix_icon-marginY: 0; // 选择器输入框前后缀图标垂直内边距
$spacing-select_create_tips-marginRight: $spacing-extra-tight; // 创建新选项右侧外边距
$spacing-select_group-marginTop: $spacing-extra-tight; // 选择器菜单分组标题顶部外边距
$spacing-select_group-paddingTop: $spacing-base-tight; // 选择器菜单分组标题顶部内边距
$spacing-select_group-paddingBottom: $spacing-extra-tight; // 选择器菜单分组标题底部内边距
$spacing-select_group-paddingLeft: $spacing-base-tight + $width-select_option_tick + $spacing-select_option_tick-marginRight; // 选择器菜单分组标题左侧外边距
$spacing-select_group-paddingRight: $spacing-base; // 选择器菜单分组标题右侧内边距
$spacing-select_loading_wrapper-paddingLeft: $spacing-base; // 选择器加载左侧内边距
$spacing-select_loading_wrapper-paddingRight: $spacing-base; // 选择器加载右侧内边距
$spacing-select_loading_wrapper-paddingTop: $spacing-tight; // 选择器加载顶部内边距
$spacing-select_loading_wrapper-paddingBottom: $spacing-tight; // 选择器加载底部内边距
$spacing-select_multiple_content_wrapper_empty-marginLeft: $spacing-tight; // 多项选择器空回填内容为空时左侧内边距
$spacing-select_multiple_selection-marginLeft: $spacing-extra-tight; // 多项选择器回填内容左侧内边距
$spacing-select_option-paddingLeft: $spacing-base-tight; // 选择器菜单项左侧内边距
$spacing-select_option-paddingRight: $spacing-base-tight; // 选择器菜单项右侧内边距
$spacing-select_option-paddingTop: $spacing-tight; // 选择器菜单项顶部内边距
$spacing-select_option-paddingBottom: $spacing-tight; // 选择器菜单项底部内边距
$spacing-select_option_first-marginTop: $spacing-extra-tight; // 选择器第一个菜单项顶部外边距
$spacing-select_option_last-marginBottom: $spacing-extra-tight; // 选择器最后一个菜单项顶部外边距
$spacing-select_tag-marginTop: $spacing-super-tight - 1; // 多项选择器标签顶部外边距
$spacing-select_tag-marginRight: $spacing-extra-tight; // 多项选择器标签右侧外边距
$spacing-select_tag-marginBottom: $spacing-super-tight - 1; // 多项选择器标签底部外边距
$spacing-select_selection-marginLeft: $spacing-base-tight; // 选择器内容区左侧外边距
$spacing-select_insetLabel-marginRight: $spacing-base-tight; // 选择器内嵌标签右侧外边距

// Radius
$radius-select: var(--semi-border-radius-small); // 选择器输入框圆角

// Font
$font-select-fontWeight: $font-weight-regular; // 选择器文本字重
$font-select_inset_label-fontWeight: 600; // 选择器内嵌标签文本字重
$font-select_keyword-fontWeight: 600; // 选择器搜索结果命关键词中文本字重

// Other
$opacity-select_selection_text_inactive: .4;

`;

const SELECT_MIXIN = `// Mixin
@mixin select-tag-margin {
    margin-top: $spacing-select_tag-marginTop;
    margin-right: $spacing-select_tag-marginRight;
    margin-bottom: $spacing-select_tag-marginBottom;
}`;

const TABLE_CONTENT = `@import "./variables.scss";
@import "./mixin.scss";

$module: #{$prefix}-table;

.#{$module} {
    width: 100%;
    text-align: left;
    border-collapse: separate;
    border-spacing: 0;
    font-size: inherit;
    display: table;

    &-wrapper {
        zoom: 1;
        position: relative;
        clear: both;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        @include font-size-regular;
        color: $color-table-text-default;
        width: 100%;
    }

    &-middle {
        .#{$module}-thead > .#{$module}-row > .#{$module}-row-head,
        .#{$module}-tbody > .#{$module}-row > .#{$module}-row-cell {
            padding-top: $spacing-table_middle-paddingY;
            padding-bottom: $spacing-table_middle-paddingY;
        }
    }

    &-small {
        .#{$module}-thead > .#{$module}-row > .#{$module}-row-head,
        .#{$module}-tbody > .#{$module}-row > .#{$module}-row-cell {
            padding-top: $spacing-table_small-paddingY;
            padding-bottom: $spacing-table_small-paddingY;
        }
    }

    &-title {
        position: relative;
        padding-top: $spacing-table_title-paddingY;
        padding-bottom: $spacing-table_title-paddingY;
        padding-left: $spacing-table_title-paddingX;
        padding-right: $spacing-table_title-paddingX;
    }

    &-container {
        position: relative;
    }

    &-header {
        overflow: hidden;
    }

    &-body {
        overflow: auto;
        width: 100%;
        box-sizing: border-box;
    }

    &-colgroup {
        display: table-column-group;
        .#{$module}-col {
            display: table-column;
        }
        .#{$module}-column {

            &-expand,
            &-selection {
                width: $width-table_column_selection;
            }
        }
    }

    &-thead {
        & > .#{$module}-row {
            & > .#{$module}-row-head {
                background-color: $color-table_th-bg-default;
                color: $color-table_th-text-default;
                font-weight: $font-weight-bold;
                text-align: left;
                border-bottom: #{$width-table_header_border} #{$border-table_base-borderStyle} $color-table_th-border-default;
                padding-left: $spacing-table_row_head-paddingX;
                padding-right: $spacing-table_row_head-paddingX;
                padding-top: $spacing-table_row_head-paddingY;
                padding-bottom: $spacing-table_row_head-paddingY;
                vertical-align: middle;
                word-break: break-all;
                word-wrap: break-word;
                position: relative;
                user-select: none;

                &.#{$module}-cell-fixed {

                    &-left,
                    &-right {
                        z-index: 1;
                        position: sticky;
                        background-color: $color-table-bg-default;

                        &::before {
                            background-color: $color-table_th-bg-default;
                            content: "";
                            position: absolute;
                            left: 0;
                            top: 0;
                            right: 0;
                            bottom: 0;
                            display: block;
                            z-index: -1;
                        }
                    }

                    &-left-last {
                        border-right: $width-table_cell_fixed_left_last solid $color-table_shadow-border-default;
                        box-shadow: #{$shadow-table_right};

                        &.resizing {
                            @include genResizing();
                        }
                    }

                    &-right-first {
                        border-left: $width-table_cell_fixed_right_first solid $color-table_shadow-border-default;
                        box-shadow: #{$shadow-table_left};

                        &.resizing {
                            @include genResizing();
                        }

                        // scroll-bar 列无需有box-shadow

                        &[x-type="column-scrollbar"] {
                            box-shadow: none;
                            border-left: transparent;
                        }
                    }
                }

                &.#{$module}-column-selection {
                    text-align: center;
                }

                &[colspan]:not([colspan="1"]) {
                    text-align: center;
                }

                .#{$module}-header-column {
                    display: inline-flex;
                    align-items: center;
                }
            }

            .react-resizable {
                position: relative;
                background-clip: padding-box;
            }

            .resizing {
                @include genResizing();
            }

            .react-resizable-handle {
                position: absolute;
                width: $width-table_react_resizable_handle;
                height: calc(100% - #{$spacing-table_resizable-offset-y} * 2);
                background-color: $color-table-border-default;
                bottom: $spacing-table_resizable-bottom;
                right: $spacing-table_react_resizable_handle-right;
                cursor: col-resize;
                z-index: 0;

                &:hover {
                    background-color: $color-table_resizer-bg-default;
                }
            }
        }
    }

    &-tbody {
        display: table-row-group;
        & > .#{$module}-row {
            display: table-row;

            &:hover {
                & > .#{$module}-row-cell {
                    background-color: $color-table_body-bg-hover;

                    &.#{$module}-cell-fixed {
    
                        &-left,
                        &-right {
                            background-color: $color-table_body-bg-default;
    
                            &::before {
                                background-color: $color-table_body-bg-hover;
                                content: "";
                                position: absolute;
                                left: 0;
                                top: 0;
                                right: 0;
                                bottom: 0;
                                display: block;
                                z-index: -1;
                            }
                        }
                    }
                }
            }

            & > .#{$module}-row-cell {
                display: table-cell;
                word-wrap: break-word;
                word-break: break-all;
                border-left: none;
                border-right: none;
                border-bottom: $border-table;
                padding: $spacing-table_tbody_rowCell-padding;
                box-sizing: border-box;
                position: relative;
                vertical-align: middle;

                &.resizing {
                    border-right: $border-table_resizer;
                }
            }
            &.#{$module}-row {

                &-expand {
                    & > .#{$module}-row-cell {
                        background-color: $color-table_row_expanded-bg-default;
                    }
                }
            }

            & > .#{$module}-cell-fixed {

                &-left,
                &-right {
                    z-index: 1;
                    position: sticky;
                    background-color: $color-table-bg-default;
                }

                &-left-last {
                    border-right: $width-table_cell_fixed_left_last solid $color-table_shadow-border-default;
                    box-shadow: #{$shadow-table_right};
                }

                &-right-first {
                    border-left: $width-table_cell_fixed_right_first solid $color-table_shadow-border-default;
                    box-shadow: #{$shadow-table_left};
                }
            }
        }

        & > .#{$module}-row-section {
            display: table-row;

            & > .#{$module}-row-cell {
                background-color: $color-table_selection-bg-default;
                border-bottom: $border-table;
            }

            & > .#{$module}-row-cell:not(.#{$module}-column-selection) {
                padding: $spacing-table_tbody_rowSelection_rowCell_notSelection-paddingY $spacing-table_tbody_rowSelection_rowCell_notSelection-paddingX;
            }

            .#{$module}-section-inner {
                display: inline-flex;
                align-items: center;
            }
        }
    }

    &-virtualized .#{$module}-tbody {
        display: block;
        & > .#{$module}-row {
            display: flex;
            & > .#{$module}-row-cell {
                word-wrap: unset;
                word-break: unset;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                overflow: hidden;
            }

            &-section {
                & > .#{$module}-row-cell {
                    padding-top: $spacing-table-paddingY;
                    padding-bottom: $spacing-table-paddingY;
                    display: flex;
                }
            }

            &-expand {
                & > .#{$module}-row-cell {
                    padding: 0;
                    overflow: unset;
                }
            }
        }
    }

    &-footer {
        background-color: $color-table_footer-bg-default;
        padding: $spacing-table_footer-padding;
        margin: 0;
        position: relative;
    }

    .#{$module}-selection {

        &-wrap {
            // inline-flex vertical-align baseline 会导致父元素高度异常
            display: inline-flex;
            vertical-align: bottom; 
        }

        &-disabled {
            cursor: not-allowed;

            & > .#{$prefix}-checkbox {
                pointer-events: none;
            }
        }
    }

    .#{$module}-column {

        &-hidden {
            display: none;
        }

        &-selection {
            text-align: center;
            // width: $width-table_column_selection;

            .#{$prefix}-checkbox-inner-display {
                .#{$prefix}-icon {
                    left: 0;
                    top: 0;
                }
            }
        }

        &-expand {
            .#{$module}-expand-icon {
                transform: translateY(2px);

                &:last-child {
                    margin-right: 0;
                }
            }
        }

        &-sorter {
            margin-left: $spacing-table_column_sorter-marginLeft;
            display: inline-block;
            width: $width-table_column_sorter-icon;
            height: $height-table_column_sorter-icon;
            cursor: pointer;
            vertical-align: middle;
            text-align: center;

            &-up,
            &-down {
                height: 0;
                display: block;
                color: $color-table_sorter-text-default;

                &:hover .anticon {
                    color: $color-table_sorter-text-hover;
                }

                svg {
                    width: $width-table_column_sorter-icon;
                    height: $height-table_column_sorter-icon;
                }

                &.on {
                    .#{$prefix}-icon-caretup,
                    .#{$prefix}-icon-caretdown {
                        color: $color-table_sorter_on-text-default;
                    }
                }
            }
        }

        &-filter {
            margin-left: $spacing-table_column_filter-marginLeft;
            display: inline-flex;
            cursor: pointer;
            color: $color-table_filter-text-default;
            vertical-align: middle;

            svg {
                width: $width-table_column_filter-icon;
                height: $height-table_column_filter-icon;
            }

            &.on {
                color: $color-table_filter_on-text-default;
            }
        }
    }

    &-bordered {
        .#{$module}-title {
            padding-left: $spacing-table_bordered_titler-paddingLeft;
            padding-right: $spacing-table_bordered_titler-paddingRight;
            border-top: $border-table;
            border-right: $border-table;
            border-left: $border-table;
        }

        .#{$module}-container {
            border: #{$width-table_base_border} #{$border-table_base-borderStyle} $color-table-border-default;
            border-right: 0;
            border-bottom: 0;
        }

        .#{$module}-footer {
            border-left: $border-table;
            border-right: $border-table;
            border-bottom: $border-table;
        }

        .#{$module}-thead > .#{$module}-row > .#{$module}-row-head {

            .react-resizable-handle {
                background-color: transparent;
            }
        }

        .#{$module}-thead > .#{$module}-row > .#{$module}-row-head,
        .#{$module}-tbody > .#{$module}-row > .#{$module}-row-cell {
            border-right: $border-table;
        }

        .#{$module}-placeholder {
            border-right: $width-table_base_border $border-table_base-borderStyle $color-table-border-default;
        }
    }

    &-placeholder {
        position: relative;
        z-index: 1;
        padding: #{$spacing-table-paddingY} #{$spacing-table-paddingX};
        color: $color-table_disabled-bg-default;
        font-size: #{$font-table_base-fontSize};
        text-align: center;
        background: $color-table_pl-bg-default;
        border-bottom: $border-table;
        border-radius: 0 0 #{$radius-table_base} #{$radius-table_base};
    }

    &-fixed {
        table-layout: fixed;

        & > .#{$module}-tbody {
            & > .#{$module}-row-expand > .#{$module}-row-cell > .#{$module}-expand-inner,
            & > .#{$module}-row-section > .#{$module}-row-cell > .#{$module}-section-inner {
                position: sticky;
                overflow: auto;
                left: 0;
                margin-left: -$spacing-table_expand_row-paddingLeft;
                margin-right: -$spacing-table_expand_row-paddingRight;
                padding-left: $spacing-table_expand_row-paddingLeft;
                padding-right: $spacing-table_expand_row-paddingRight;
                height: 100%;
                display: flex;
                align-items: center;
            }
        }
    }

    &-scroll {

        &-position {

            &-left {
                .#{$module}-tbody,
                .#{$module}-thead {
                    & > .#{$module}-row > .#{$module}-cell-fixed-left-last {
                        box-shadow: none;
                    }
                }
            }

            &-right {
                .#{$module}-tbody,
                .#{$module}-thead {
                    & > .#{$module}-row > .#{$module}-cell-fixed-right-first {
                        box-shadow: none;
                    }
                }
            }
        }
    }

    &-pagination-outer {
        color: $color-table_page-text-default;
        min-height: $height-table_pagination_outer_min;
    }
}

.#{$module}-expand-icon {
    color: $color-table_expanded_icon-default;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    user-select: none;
    background: $color-table_expanded-bg-default;
    position: relative;
    margin-right: $spacing-table_expand_icon-marginRight;

    &-cell {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
}
`;

const TABLE_VARIABLES = `// Spacing
$spacing-table-paddingY: $spacing-base; // 表格单元格垂直内边距
$spacing-table-paddingX: $spacing-base-tight; // 表格单元格水平内边距
$spacing-table_middle-paddingY: $spacing-base-tight; // 中尺寸表格单元格垂直内边距
$spacing-table_small-paddingY: $spacing-tight; // 小尺寸表格单元格垂直内边距
$spacing-table_th-paddingTop: $spacing-tight; // 表格顶部内边距
$spacing-table_th-paddingBottom: $spacing-tight; // 表格底部内边距
$spacing-table_title-paddingY: $spacing-base; // 表格标题垂直内边距
$spacing-table_title-paddingX: 0; // 表格标题水平内边距
$spacing-table_footer-padding: $spacing-base; // 表格 footer 内边距
$spacing-table_expand_row-paddingLeft: 16px; // 表格展开行左侧内边距
$spacing-table_expand_row-paddingRight: 16px; // 表格展开行右侧内边距
$spacing-table_expand_row-paddingTop: 16px; // 表格展开行顶部内边距
$spacing-table_expand_row-paddingBottom: 16px; // 表格展开行底部内边距
$spacing-table_resizable-offset-y: 4px; // 可拖动拉伸操作垂直偏移量
$spacing-table_resizable-bottom: 4px; // 可拖动拉伸操作底部距离
$spacing-table_row_head-paddingY: $spacing-tight; // 表头垂直内边距
$spacing-table_row_head-paddingX: $spacing-base; // 表头水平内边距
$spacing-table_react_resizable_handle-right: -1px; // 可拖动拉伸操作向右偏移量
$spacing-table_tbody_rowCell-padding: $spacing-base; // 表格单元格内边距
$spacing-table_tbody_rowSelection_rowCell_notSelection-paddingX: 16px; // 可选中的表格单元水平内边距
$spacing-table_tbody_rowSelection_rowCell_notSelection-paddingY: 10px; // 可选中的表格单元垂直内边距
$spacing-table_column_sorter-marginLeft: $spacing-extra-tight; // 列排序按钮左侧外边距
$spacing-table_column_filter-marginLeft: $spacing-extra-tight; // 列过滤器按钮左侧外边距
$spacing-table_bordered_titler-paddingLeft: $spacing-base; // 列过滤器按钮左侧外边距
$spacing-table_bordered_titler-paddingRight: $spacing-base; // 列过滤器按钮右侧外边距
$spacing-table_expand_icon-marginRight: 8px; // 行展开按钮右侧外边距
$spacing-table_panel_operation-paddingX: $spacing-base;
$spacing-table_panel_operation-paddingY: $spacing-tight;

// Size
$width-table_base_border: 1px; // 表格单元格分割线宽度
$width-table_header_border: 2px; // 表格表头分割线宽度
$width-table_resizer_border: 2px; // 表格拉伸列标示线宽度
$radius-table_base: 4px;
$width-table_column_selection: 48px; // 表格默认列宽
$width-table_column_sorter-icon: 16px; // 表格排序按钮宽度
$height-table_column_sorter-icon: 16px; // 表格排序按钮高度
$width-table_column_filter-icon: 12px; // 表格过滤按钮宽度
$height-table_column_filter-icon: 12px; // 表格过滤按钮高度
$width-table_cell_fixed_left_last: 1px; // 表格左上角单元格底部描边宽度
$width-table_cell_fixed_right_first: 1px; // 表格左上角单元格右侧描边宽度
$width-table_react_resizable_handle: 9px; // 表格伸缩列调节热区宽度
$height-table_pagination_outer_min: 60px; // 表格分页器高度


// Color no need to change
$color-table_panel-bg-default: var(--semi-color-primary); // 操作区域样式默认背景颜色
$color-table_panel-text-default: var(--semi-color-primary-light-active); // 操作区域样式默认文字颜色
$color-table-bg-default: var(--semi-color-bg-2); // 单元格默认背景颜色
$color-table-text-default: var(--semi-color-text-0); // 单元格默认文字颜色

$color-table-border-default: var(--semi-color-border); // 表格描边颜色
$color-table_shadow-bg-default: var(--semi-color-shadow); // 表格滚动后阴影颜色
$color-table_shadow-border-default: var(--semi-color-border); // 表格拟阴影 描边颜色
$color-table_th-bg-default: transparent; // 表头背景色
$color-table_th-border-default: var(--semi-color-border); // 表头底部分割线颜色
$color-table_th-text-default: var(--semi-color-text-2); // 表头文字颜色

$color-table_pl-bg-default: transparent;
$color-table_body-bg-default: var(--semi-color-bg-2); // 表格背景颜色 - 默认
$color-table_body-bg-hover: var(--semi-color-fill-0); // 表格背景颜色 - 悬浮
$color-table_footer-bg-default: var(--semi-color-fill-0); // 表格 footer 背景颜色 - 默认
$color-table_row_expanded-bg-default: var(--semi-color-fill-0); // 表格展开行背景颜色 - 默认
$color-table_expanded_icon-default: var(--semi-color-text-2); // 表格展开行图标颜色 - 默认
$color-table_expanded-bg-default: transparent; // 表格展开行图标容器背景颜色 - 默认
$color-table_disabled-bg-default: var(--semi-color-disabled-bg);
$color-table_filter_on-text-default: var(--semi-color-primary); // 表格过滤按钮颜色 - 激活态
$color-table_filter-text-default: var(--semi-color-text-2); // 表格过滤按钮颜色 - 默认态
$color-table_sorter_on-text-default: var(--semi-color-primary); // 表格排序按钮颜色 - 激活态
$color-table_sorter-text-default: var(--semi-color-text-2); // 表格排序按钮颜色 - 默认态
$color-table_sorter-text-hover: var(--semi-color-text-2); // 表格排序按钮颜色 - 悬浮态
$color-table_page-text-default: var(--semi-color-text-2); // 表格翻页器文本颜色
$color-table_resizer-bg-default: var(--semi-color-primary); // 表格拉伸标示线颜色
$color-table_selection-bg-default: rgba(var(--semi-grey-0), 1); // 表格分组背景色

// Other
$font-table_base-fontSize: 14px; // 表格默认文本字号
$border-table_base-borderStyle: solid; // 表格描边样式
$shadow-table_left: -3px 0 0 0 $color-table_shadow-bg-default; // 表格滚动阴影 - 左侧
$shadow-table_right: 3px 0 0 0 $color-table_shadow-bg-default; // 表格滚动阴影 - 右侧
$border-table: #{$width-table_base_border} #{$border-table_base-borderStyle} $color-table-border-default; // 表格默认描边
$border-table_resizer: $width-table_resizer_border solid $color-table_resizer-bg-default; // 表格拉伸标识描边
`;

const TABLE_MIXIN = `@mixin genResizing() {
    border-right: $border-table_resizer;

    .react-resizable-handle {

        &:hover {
            background-color: unset;
        }
    }
}`;

const PAGINATION_CONTENT = `//@import '../theme/variables.scss';
@import "./variables.scss";

$module: #{$prefix}-page;

.#{$module} {
    display: flex;
    list-style: none;
    padding: $spacing-pagination-padding;
    align-items: center;
    font-family: $font-family-regular;
    margin-block-start: 0;
    margin-block-end: 0;

    &-small {
        @include font-size-regular;
        font-weight: $font-pagination_small-fontWeight;
        color: $color-pagination-text-default;
        padding: $spacing-pagination_small-paddingY $spacing-pagination_small-paddingX;
    }

    &-item {
        @include font-size-regular;
        min-width: $width-pagination_item-minWidth;
        border: $width-pagination_item_border solid $color-pagination_item-border-default;
        cursor: pointer;
        user-select: none;
        height: $height-pagination_item;
        margin-left: $spacing-pagination_item-marginLeft;
        margin-right: $spacing-pagination_item-marginRight;
        font-weight: $font-pagination_item-fontWeight;
        color: $color-pagination_item-text-default;
        border-radius: $radius-pagination_item;
        text-align: center;
        line-height: $height-pagination_item;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            border-color: $color-pagination_item-border-hover;
            background-color: $color-pagination_item-bg-hover;
            color: $color-pagination_item-text-hover;
        }

        &-rest-opening {
            background-color: $color-pagination_item-bg-hover;
            color: $color-pagination_item-text-hover;
        }

        &:active {
            border-color: $color-pagination_item-border-active;
            background-color: $color-pagination_item-bg-active;
            color: $color-pagination_item-text-active;
        }

        &-active {
            border-color: $color-pagination_item-border-selected;
            color: $color-pagination_item-text-selected;
            font-weight: $font-pagination_item_active-fontWeight;
            background-color: $color-pagination_item-bg-selected;

            &:hover {
                border-color: $color-pagination_item-border-selected;
                color: $color-pagination_item-text-selected;
                background-color: $color-pagination_item-bg-selected;
            }
        }

        &-disabled {
            border-color: $color-pagination_item-border-disabled;
            color: $color-pagination_item-text-disabled;
            background-color: $color-pagination_item-bg-disabled;
            cursor: not-allowed;

            &:hover {
                background-color: transparent;
            }
        }

        &-small {
            min-width: $width-pagination_item_small-minWidth;
            margin: $spacing-pagination_item_small-margin;
        }
    }

    &-total {
        @include font-size-regular;
        color: $color-pagination-text-default;
    }

    &-prev,
    &-next {
        color: $color-pagination_item-icon-default;
        cursor: pointer;

        &.#{$module}-item-disabled {
            color: $color-pagination_item-icon-disabled;
            cursor: not-allowed;
        }
    }

    &-quickjump {
        margin-left: $spacing-pagination_quickjump_marginLeft;
        @include font-size-regular;
        @include all-center;
        flex-shrink: 0;
        color: $color-pagination_item-text-default;
        &-input-number {
            max-width: $width-pagination_quickjump_input_width;
            margin-left: $spacing-pagination_quickjump_input_marginLeft;
            margin-right: $spacing-pagination_quickjump_input_marginRight;
        }
        &-disabled {
            color: $color-pagination_quickjump_text-disabled;
        }
    }

    .#{$prefix}-select {
        user-select: none;
    }
}

.#{$prefix}-select-dropdown {
    user-select: none;
}

.#{$module}-rest {

    &-list {
        padding-top: $spacing-pagination_reset_list-paddingTop;
        padding-bottom: $spacing-pagination_reset_list-paddingBottom;

        & > div {
            position: relative;
        }
    }

    &-item {
        height: $height-pagination_item;
        line-height: $height-pagination_item;
        // padding-left: $spacing-base;
        display: flex;
        justify-content: center;
        box-sizing: border-box;
        cursor: pointer;

        &:hover {
            background-color: $color-pagination_item-bg-hover;
        }

        &:active {
            background-color: $color-pagination_item-bg-active;
        }
    }
}
`;

const PAGINATION_VARIABLES = `// Color
$color-pagination-text-default: var(--semi-color-text-2); // 翻页器总页数文本颜色
$color-pagination_item-text-default: var(--semi-color-text-0); // 翻页器 页码 文本颜色
$color-pagination_item-bg-default: transparent; // 翻页器 页码 背景颜色
$color-pagination_item-icon-default: var(--semi-color-tertiary); // 翻页器 页码 图标颜色
$color-pagination_item-text-hover: var(--semi-color-text-0); // 翻页器 页码 悬浮态文本颜色
$color-pagination_item-bg-hover: var(--semi-color-fill-0); // 翻页器 页码 悬浮态背景颜色
$color-pagination_item-text-active: var(--semi-color-text-0); // 翻页器 页码 按下态文字颜色
$color-pagination_item-bg-active: var(--semi-color-fill-1); // 翻页器 页码 按下态背景颜色
$color-pagination_item-text-disabled: var(--semi-color-disabled-text); // 翻页器 页码 禁用态文字颜色
$color-pagination_item-icon-disabled: var(--semi-color-disabled-text); // 翻页器 页码 禁用态图标颜色
$color-pagination_item-bg-disabled: transparent; // 翻页器 页码 禁用态背景颜色
$color-pagination_item-text-selected: var(--semi-color-primary); // 翻页器 页码 选中态文字颜色
$color-pagination_item-bg-selected: var(--semi-color-primary-light-default); // 翻页器 页码 选中态背景颜色
$color-pagination_quickjump_text-disabled: var(--semi-color-disabled-text); // 翻页器 快速跳转禁用态文字颜色
$color-pagination_item-border-default: transparent; // 翻页器 页码 默认边框颜色
$color-pagination_item-border-hover: transparent; // 翻页器 页码 悬浮边框颜色
$color-pagination_item-border-active: transparent; // 翻页器 页码 激活边框颜色
$color-pagination_item-border-selected: transparent; // 翻页器 页码 选中边框颜色
$color-pagination_item-border-disabled: transparent; // 翻页器 页码 禁用边框颜色



// Width/Height
$height-pagination_item: 32px; // 翻页器 页码高度
$width-pagination_item-minWidth: 32px; // 翻页器 页码最小宽度
$width-pagination_item_small-minWidth: 44px; // 迷你翻页器 页码最小宽度
$width-pagination_quickjump_input_width: 50px; // 快速跳转输入框宽度
$width-pagination_item_border: 0px; // 翻页器 页码 默认边框宽度

// Spacing
$spacing-pagination-padding: 0; // 翻页器内边距
$spacing-pagination_small-paddingY: 0; // 迷你翻页器垂直内边距
$spacing-pagination_small-paddingX: 0; // 迷你翻页器水平内边距
$spacing-pagination_item-marginLeft: $spacing-extra-tight; // 翻页器页码左侧外边距
$spacing-pagination_item-marginRight: $spacing-extra-tight; // 翻页器页码右侧外边距
$spacing-pagination_item_small-margin: 0; // 迷你翻页器页码外边距
$spacing-pagination_reset_list-paddingTop: $spacing-extra-tight;
$spacing-pagination_reset_list-paddingBottom: $spacing-extra-tight;
$spacing-pagination_quickjump_marginLeft: 24px; // 快速跳转左侧外边距
$spacing-pagination_quickjump_input_marginLeft: 4px; // 快速跳转输入框左侧外边距
$spacing-pagination_quickjump_input_marginRight: 4px; // 快速跳转输入框右侧外边距

// Radius
$radius-pagination_item: var(--semi-border-radius-small); // 翻页器页码圆角大小

// Font
$font-pagination_small-fontWeight: $font-weight-regular; // 迷你翻页器字重
$font-pagination_item-fontWeight: $font-weight-regular; // 翻页器页码字重
$font-pagination_item_active-fontWeight: $font-weight-bold; // 翻页器页码选中态字重
$font-pagination_quickjump_fontWeight: $font-weight-regular; // 快速跳转输入框字重
`;

export const componentsScssContent= {
    'descriptions/index.scss': DESCRIPTIONS_CONTENT,
    'descriptions/variables.scss': DESCRIPTIONS_VARIABLES,
    'typography/index.scss': TYPOGRAPHY_CONTENT,
    'typography/variables.scss': TYPOGRAPHY_VARIABLES,
    'input/index.scss': INPUT_CONTENT,
    'input/variables.scss': INPUT_VARIABLES,
    'select/index.scss': SELECT_CONTENT,
    'select/mixin.scss': SELECT_MIXIN,
    'select/variables.scss': SELECT_VARIABLES,
    'table/index.scss': TABLE_CONTENT,
    'table/variables.scss': TABLE_VARIABLES,
    'table/mixin.scss': TABLE_MIXIN,
    'pagination/index.scss': PAGINATION_CONTENT,
    'pagination/variables.scss': PAGINATION_VARIABLES
};