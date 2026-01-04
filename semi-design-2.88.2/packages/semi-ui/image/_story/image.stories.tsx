import React, { useState, useCallback, useMemo } from "react";
import {
    Image,
    ImagePreview,
    Switch,
} from "../../index";
import { storiesOf } from '@storybook/react';


const stories = storiesOf('Image', module);

const srcList1 = [
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/seaside.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beach.jpeg",
];

export const BasicPreview = () => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [customTooltip, setCustomTooltip] = useState(false);
    const [infinite, setInfinite] = useState(false);

    const customTooltipProps = {
        prevTip: "Prev",
        nextTip: "Next",
        zoomInTip: "ZoomIn",
        zoomOutTip: "ZoomOut",
        rotateTip: "Rotate",
        downloadTip: "Download",
        adaptiveTip: "Adaption",
        originTip: "Original size"
    };

    const props = useMemo(() => {
        let props = {};
        if (showTooltip) {
            props = { showTooltip: true };
            if (customTooltip) {
                props = {...props, ...customTooltipProps}
            }
        }
        if (infinite) {
            props['infinite'] = true;
        }
        return props;
    }, [showTooltip, customTooltip, infinite])

    const itemStyle = { display: 'flex', alignItems: 'center', flexShrink: 0, width: 'fit-content', margin: '10px 20px 0 0' };
    const menuStyle = { marginBottom: 20, display: 'flex', flexWrap: 'wrap' };

    return (
        <>
            <div style={menuStyle as any}>
                <div style={itemStyle} id='showTooltip'>
                    <span>是否show tooltip：</span>
                    <Switch checked={showTooltip} checkedText="是" uncheckedText="否" onChange={setShowTooltip}/>
                </div>
                <div style={itemStyle} id='customTooltip'>
                    <span>是否custom tooltip：</span>
                    <Switch checked={customTooltip} checkedText="是" uncheckedText="否" onChange={setCustomTooltip}/>
                </div>
                <div style={itemStyle} id='infinite'>
                    <span >是否无限循环：</span>
                    <Switch checked={infinite} checkedText="是" uncheckedText="否" onChange={setInfinite}/>
                </div>
            </div>
            <ImagePreview {...props}>
                {srcList1.map((src, index) => {
                    return (
                        <Image 
                            key={`${index}`}
                            src={src}
                            width={200}
                            loading='lazy'
                            alt={`lamp${index + 1}`}
                            data-test={'data-test'}
                            onClick={()=>{}}
                        />
                )})}
            </ImagePreview>
    </>
)};


stories.add('basic image', () => (<BasicPreview />));