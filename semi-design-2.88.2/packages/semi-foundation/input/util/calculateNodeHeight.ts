// Reference to https://github.com/andreypopp/react-textarea-autosize/
let hiddenTextarea: any = null;

const HIDDEN_TEXTAREA_STYLE = {
    'min-height': '0',
    'max-height': 'none',
    height: '0',
    visibility: 'hidden',
    overflow: 'hidden',
    position: 'absolute',
    'z-index': '-1000',
    top: '0',
    right: '0',
};

const forceHiddenStyles = (node: any) => {
    Object.keys(HIDDEN_TEXTAREA_STYLE).forEach(key => {
        node.style.setProperty(
            key,
            HIDDEN_TEXTAREA_STYLE[key],
            'important'
        );
    });
};

const getContentHeight = (
    node: any,
    sizingData: any
) => {
    const height = node.scrollHeight;

    if (sizingData.sizingStyle.boxSizing === 'border-box') {
        // border-box: add border, since height = content + padding + border
        return height + sizingData.borderSize;
    }

    // remove padding, since height = content
    return height - sizingData.paddingSize;
};

export default function calculateNodeHeight(
    sizingData: any,
    value: string,
    minRows = 1,
    maxRows = Infinity
) {
    if (!hiddenTextarea) {
        hiddenTextarea = document.createElement('textarea');
        hiddenTextarea.setAttribute('tab-index', '-1');
        hiddenTextarea.setAttribute('aria-hidden', 'true');
        forceHiddenStyles(hiddenTextarea);
    }

    if (hiddenTextarea.parentNode === null) {
        document.body.appendChild(hiddenTextarea);
    }

    const { paddingSize, borderSize, sizingStyle } = sizingData;
    const { boxSizing } = sizingStyle;

    Object.keys(sizingStyle).forEach(key => {
        hiddenTextarea.style[key] = sizingStyle[key];
    });

    forceHiddenStyles(hiddenTextarea);

    hiddenTextarea.value = value;
    let height = getContentHeight(hiddenTextarea, sizingData);

    // measure height of a textarea with a single row
    hiddenTextarea.value = 'x';
    // calc single row need to remove padding and border to avoid duplicated calc
    const rowHeight = getContentHeight(hiddenTextarea, sizingData) - paddingSize - borderSize;

    let minHeight = rowHeight * minRows;
    if (boxSizing === 'border-box') {
        minHeight = minHeight + paddingSize + borderSize;
    }
    height = Math.max(minHeight, height);

    let maxHeight = rowHeight * maxRows;
    if (boxSizing === 'border-box') {
        maxHeight = maxHeight + paddingSize + borderSize;
    }
    height = Math.min(maxHeight, height);

    return height;
}
