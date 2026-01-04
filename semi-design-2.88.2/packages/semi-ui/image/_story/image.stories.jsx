import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
    Image,
    Button,
    ImagePreview,
    Row,
    Col,
    Icon,
    Switch,
    Input,
    Divider,
    Tooltip
} from "../../index";
import { 
    IconChevronLeft, 
    IconChevronRight, 
    IconMinus,
    IconPlus,
    IconRotate,
    IconDownload,
    IconWindowAdaptionStroked,
    IconRealSizeStroked,
    IconUploadError,
    IconInfoCircle,
    IconEyeClosed,
    IconLeftCircleStroked,
    IconCenterRightStroked
} from "@douyinfe/semi-icons";

export default {
    title: "Image",
    parameters: {
      chromatic: { disableSnapshot: true },
    }
}

const srcList1 = [
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/seaside.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beach.jpeg",
];

const srcList2 = [
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag1.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag2.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag3.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag4.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag5.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag6.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag7.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag8.png",
];

const srcList3 = [
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag1.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/9130eh7pltbfnuhog/small-size.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag3.png",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beach.jpeg",
    "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/imag5.png",
    'https://lf3-static.bytednsdoc.com/obj/eden-cn/9130eh7pltbfnuhog/200100.jpeg',
];

export const basicImage = () => {
    const [escOut, setEscOut] = useState(true);
    const [disableDownload, setDisableDownload] = useState(false);
    const [maskClosable, setMaskClosable] = useState(true);
    const [preview, setPreview] = useState(true);
    const [closable, setClosable] = useState(true);

    const itemStyle = { display: 'flex', alignItems: 'center', flexShrink: 0, width: 'fit-content', margin: '10px 20px 0 0' };
    const menuStyle = { marginBottom: 20, display: 'flex', flexWrap: 'wrap' };

    return (
    <>
        <div style={menuStyle}>
            <div style={itemStyle} id='preview'>
                <span >是否可预览：</span>
                <Switch checked={preview} checkedText="是" uncheckedText="否" onChange={setPreview}/>
            </div>
            <div style={itemStyle} id='escOut'>
                <span>点击 esc 是否关闭预览：</span>
                <Switch checked={escOut} checkedText="是" uncheckedText="否" onChange={setEscOut}/>
            </div>
            <div style={itemStyle} id='disableDownload'>
                <span >是否禁用下载：</span>
                <Switch checked={disableDownload} checkedText="是" uncheckedText="否" onChange={setDisableDownload}/>
            </div>
            <div style={itemStyle} id='closable'>
                <span>是否显示预览关闭按钮：</span>
                <Switch checked={closable} checkedText="是" uncheckedText="否" onChange={setClosable} />
            </div>
            <div style={itemStyle} id='maskClosable'>
                <span >点击遮罩层是否关闭预览：</span>
                <Switch checked={maskClosable} checkedText="是" uncheckedText="否" onChange={setMaskClosable}/>
            </div>
        </div>
        <Image
            width={360}
            height={200}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-lite.jpeg"
            preview={preview ? {
                closeOnEsc: escOut,
                disableDownload,
                maskClosable,
                closable
            } : false}
        />
    </>
)}

export const ImgClsAndStyle = () => {
    return <Image 
        imgCls="custom-img-cls"
        imgStyle={{ maxWidth: 300}}
        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
    />
}

export const LoadErrorImage = () => (
    <>
        <p>加载失败默认样式</p>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
        />
        <br />
        <p>自定义加载失败占位图</p>
        <Image 
            width={200}
            height={200}
            src="https://load-error.jpeg"
            fallback={<IconUploadError style={{ fontSize: 50 }} />}
        />
    </>
)

export const ProgressiveLoading = () => {
    const [timestamp, setTimestamp] = React.useState('');
    return (  
        <>
            <Image 
                width={300}
                height={200}
                src={`https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-big.png?${timestamp}`}
                placeholder={<Image 
                    src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-small.jpeg'
                    width={300}
                    height={200}
                    preview={false}
                />}
            />
            <br />
            <Button 
                theme={'solid'}
                onClick={() => {
                    setTimestamp(Date.now());
                }}
                style={{ marginTop: 10 }}
            >Reload</Button>
        </>
    );
}

export const CustomPreviewImage = () => (
    <Image
        width={300}
        height={200}
        src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-small.jpeg'}
        preview={{
            src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-big.png'
        }}
    />
)

export const ControlledPreviewSingle = () => {
    const [visible, setVisible] = useState(false);

    const handlePreviewVisibleChange = useCallback((v) => {
        setVisible(v);
    }, []);

    const handleClick = useCallback(() => {
        setVisible(!visible);
    }, [visible])

    return (
        <>
            <Button onClick={handleClick}>{visible ? "hide" : "show single"}</Button>
            <ImagePreview 
                src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-lite.jpeg"}
                visible={visible}
                onVisibleChange={handlePreviewVisibleChange}
            />
        </>
    )
}

export const ImageShowControlled = () => {
    const [visible, setVisible] = useState(false);

    const handlePreviewVisibleChange = useCallback((v) => {
        setVisible(v);
    }, []);

    return (
        <Image 
            width={360}
            height={200}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract-lite.jpeg"
            preview={{
                visible: visible,
                onVisibleChange: handlePreviewVisibleChange
            }}
        />
    );
}

export const ControlledPreviewMultiple = () => {
    const [visible, setVisible] = useState(false);

    const handlePreviewVisibleChange = useCallback((v) => {
        setVisible(v);
    }, []);

    const handleClick = useCallback(() => {
        setVisible(!visible);
    }, [visible])

    return (
        <>
            <Button onClick={handleClick}>{visible ? "hide" : "show multiple"}</Button>
            <ImagePreview 
                src={srcList1}
                visible={visible}
                onVisibleChange={handlePreviewVisibleChange}
            />
        </>
    )
}

export const DefaultCurrentIndex = () => {
    const [visible, setVisible] = useState(false);
    const [index, setIndex] = useState(1);

    const handlePreviewVisibleChange = useCallback((v) => {
        setVisible(v);
    }, []);

    const handleClick = useCallback(() => {
        setVisible(!visible);
    }, [visible])

    const onInputChange = useCallback((value) => {
        setIndex(Number(value) ?? 0);
    }
    ,[])

    const imageData = srcList1;

    return (
        <>
            <span>{`输入默认打开图片index(0-${imageData.length - 1})`}</span>
            <Input style={{ width: 100 }} defaultValue={index} onChange={onInputChange}/>
            <br /><br />
            <Button onClick={handleClick}>{visible ? "hide" : "show multiple"}</Button>
            <ImagePreview 
                key={index}
                src={imageData}
                visible={visible}
                defaultCurrentIndex={index}
                onVisibleChange={handlePreviewVisibleChange}
            />
        </>
    );
}

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
            props.infinite = true;
        }
        return props;
    }, [showTooltip, customTooltip, infinite])

    const itemStyle = { display: 'flex', alignItems: 'center', flexShrink: 0, width: 'fit-content', margin: '10px 20px 0 0' };
    const menuStyle = { marginBottom: 20, display: 'flex', flexWrap: 'wrap' };

    return (
        <>
            <div style={menuStyle}>
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
                            key={index}
                            src={src}
                            width={200}
                            alt={`lamp${index + 1}`}
                        />
                )})}
            </ImagePreview>
    </>
)};

// test all call back function
export const TestCallBackFunc = () => {
  
    const visibleChange =  useCallback((v) => {
        console.log("visible change", v);
    }, []);

    const change = useCallback((index) => {
        console.log("change", index);
    } , []);

    const zoomIn = useCallback((zoom) => {
        console.log("zoom in", zoom);
    }, []);

    const zoomOut = useCallback((zoom) => {
        console.log("zoom out", zoom);
    }, []);

    const prev = useCallback((index) => {
        console.log("prev", index);
    }, []);

    const next = useCallback((index) => {
        console.log("next", index);
    }, []);

    const ratioChange = useCallback((type) => {
        console.log("ratio change", type);
    }, []);

    const rotateChange = useCallback((angle) => {
        console.log("rotate change", angle);
    }, []);

    const download = useCallback((src, index) =>{
        console.log("download", src, index);
    }, []);

    return (
        <>  
            <ImagePreview
                onVisibleChange={visibleChange}
                // onChange={change}
                onClose={close}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onPrev={prev}
                onNext={next}
                onRotateLeft={rotateChange}
                onDownload={download}
            >
                <div >
                    {srcList1.map((src, index) => {
                        return (
                            <Image key={index} src={src} width={200} alt={`lamp${index + 1}`} />
                    )})}
                </div>
            </ImagePreview>
        </>
    )
};

export const GridImage= () => {
    const [gap, setGap] = useState(3);
    const [infinite, setInfinite] = useState(true);

    const switchChange = useCallback((value) => {
        setInfinite(value);
    }, []);

    const onInputChange = useCallback((value) => {
        setGap(value)
    }, []);

    return (
    <>  
        <span>是否开启 infinite：</span>
        <Switch checked={infinite} checkedText="是" uncheckedText="否" onChange={switchChange}/>
        <span style={{ marginLeft: 50 }}>输入 preLoadGap： </span>
        <Input style={{ width: 150 }} value={gap} onChange={onInputChange} />
        <ImagePreview
            key={gap}
            preLoad={true}
            preLoadGap={Number(gap)}         
            infinite={infinite}
        >
            <Row style={{ width: 800 }}>
                {/* {srcList3.map((src, index) => { */}
                {srcList2.map((src, index) => {
                    return (
                        <Col span={6} style={{ height: 200 }} key={`col${index}`}>
                            <Image key={index} src={src} style={{ width: 200, height: 200 }} width={200} alt={`lamp${index + 1}`} />
                        </Col>
                )})}
            </Row>
        </ImagePreview>
    </>
)};

export const LazyLoadImage = () => {
    return (
    <>
        <ImagePreview
            style={{ width: 848, height: 200, overflow: 'auto' }}
            lazyLoadMargin={"0px"}
        >
            <Row style={{ width: 800 }}>
                {srcList2.map((src, index) => {
                    return (
                        <Col span={6} style={{ height: 200 }} key={`col${index}`}>
                            <Image key={index} src={src} style={{ width: 200, height: 200 }} width={200} alt={`lamp${index + 1}`} />
                        </Col>
                )})}
            </Row>
        </ImagePreview>
    </>
)};

export const CustomContainer = () => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/flower.jpeg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/duck.jpeg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/swan.jpeg",
    ]), []);

    return ( 
        <>
            <div 
                id="container" 
                style={{ 
                    height: 400, 
                    position: "relative",
                    margin: '100px 200px',
                }} 
            >
                <ImagePreview
                    getPopupContainer={() => {
                        const node = document.getElementById("container");
                        return node;
                    }}
                    style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexWrap: "wrap",
        
                    }}
                >
                    {srcList.map((src, index) => {
                        return (
                            <Image 
                                key={index} 
                                src={src} 
                                width={200} 
                                alt={`lamp${index + 1}`} 
                            />
                        );
                    })}
                </ImagePreview>
            </div>
        </>
    );
}

export const customRenderFooterMenu = () => {
    const download = useCallback((src, index) =>{
        console.log("download", src, index);
    }, []);

    const renderPreviewMenu = useCallback((props) => {
        const {
            ratio,
            disabledPrev,
            disabledNext,
            disableZoomIn,
            disableZoomOut,
            disableDownload,
            onDownload,
            onNext,
            onPrev,
            onRotateLeft,
            onRotateRight,
            onRatioClick,
            onZoomIn,
            onZoomOut,
        } = props;
        return (
            <div 
            style={{ 
                background: "grey", 
                height: 40, 
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                borderRadius: 3,
            }}
        >
            <Button
                icon={<IconChevronLeft size="large" />}
                type="tertiary"
                onClick={!disabledPrev ? onPrev : undefined}
                disabled={disabledPrev}
            />
            <Button
                icon={<IconChevronRight size="large" />}
                type="tertiary"                     
                onClick={!disabledNext ? onNext : undefined}
                disabled={disabledNext}
            />
            <Button
                icon={<IconMinus  size="large" />}
                type="tertiary"
                onClick={!disableZoomOut ? onZoomOut : undefined}
                disabled={disableZoomOut} 
            />
            <Button
                icon={<IconPlus size="large" />}
                type="tertiary"
                onClick={!disableZoomIn ? onZoomIn : undefined} 
                disabled={disableZoomIn}
            />
             <Button
                icon={ratio === "adaptation" ? <IconRealSizeStroked size="large" /> : <IconWindowAdaptionStroked  size="large" />}
                type="tertiary"
                onClick={onRatioClick} 
            />
            <Button
                icon={<IconRotate size="large" style={{ transform: 'scale(-1,1)'}}/>}
                type="tertiary"
                onClick={onRotateRight}
            />
            <Button
                icon={<IconRotate size="large" />}
                type="tertiary"
                onClick={onRotateLeft}
            />
            <Button
                icon={<IconDownload size="large" />}
                type="tertiary"
                onClick={!disableDownload ? onDownload : undefined}
                disabled={disableDownload}
            />
    </div>);
    }, []);

    return (
        <>  
            <ImagePreview
                renderPreviewMenu={renderPreviewMenu}
                onDownload={download}
            >
                {srcList1.map((src, index) => {
                    return <Image key={index} src={src} width={200} alt={`lamp${index + 1}`} />
                })}
            </ImagePreview>
        </>
    );
}

export const customRenderFooterMenuByNode = () => {
    const renderPreviewMenu = useCallback((props) => {
        const { menuItems } = props;
        const customNode = <Tooltip content='我是一个自定义操作'><IconInfoCircle size="large" /></Tooltip>;
        return (
            <div style={{ display: 'flex', backgroundColor: 'rgba(0, 0, 0, 0.75)', alignItems: 'center', padding: '5px 16px', borderRadius: 4 }}>
                {menuItems.slice(0, 3)}
                <Divider layout="vertical" />
                {menuItems.slice(3, 7)}
                <Divider layout="vertical" />
                {menuItems.slice(7)}
                <Divider layout="vertical" />
                {customNode}
            </div>
        );
    }, []);

    return (
        <>  
            <ImagePreview
                renderPreviewMenu={renderPreviewMenu}
            >
                {srcList1.map((src, index) => (<Image key={index} src={src} width={200} alt={`lamp${index + 1}`} />))}
            </ImagePreview>
        </>
    );
}

export const CustomRenderTitle = () => (
    <>  
        <ImagePreview
            renderHeader={(title) => (
                <div
                    style={{ 
                        background: "green", 
                        width: "100%", 
                        height: "100%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center" 
                    }}
                >
                    {title}
                </div>
            )}
        >
            <div >
                {srcList1.map((src, index) => {
                    return (
                        <Image 
                            key={index} 
                            src={src} 
                            width={200} 
                            alt={`lamp${index + 1}`} 
                            preview={{
                                previewTitle: `lamp${index + 1}`,
                            }} 
                        />
                )})}
            </div>
        </ImagePreview>
    </>
);

export const issue1526 = () => {
    // 测试懒加载状态下，image src 改变时候加载是否符合预期
    const [src, setSrc] = useState([]);
    const srcList1 = [
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/lion.jpeg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/seaside.jpeg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/beach.jpeg",
    ];

    // 模拟远程加载
    useEffect(() => {
       setTimeout(() => {
        setSrc(srcList1);
       }, 1000);
    }, []);

    return (
        <ImagePreview zIndex={1000} >
            {src.map((file, index) => (
                <div
                    style={{
                        position: 'relative',
                        cursor: 'pointer',
                        display: 'inline-block',
                    }}
                    key={file}
                >
                    <Image key={file} src={file} width={96} height={96} />
                </div>
            ))}
        </ImagePreview>
    )
}

export const SetDownloadName = () => {
    const srcList = useMemo(() => ([
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg?timestap=1",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg?timestap=1",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg?timestap=1",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg?timestap=1",
    ]), []);

    const setDownloadName = (src) => {
        let newSrc = src.slice(src.lastIndexOf("/") + 1);
        newSrc = newSrc.slice(0, newSrc.indexOf('?'));
        return newSrc;
    }
   return  (
    <>
        <Image 
            width={360}
            height={200}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg?test"
            setDownloadName={setDownloadName}
        />
        <br/>
        <br />
        <ImagePreview
            setDownloadName={setDownloadName}
        >
            {srcList.map((src, index) => {
                return (
                    <Image 
                        key={index} 
                        src={src} 
                        width={200} 
                        alt={`lamp${index + 1}`} 
                        style={{ marginRight: 5 }}
                    />
                );
            })}
        </ImagePreview>
    </>);
}

export const SmallHeightImage = () => {
    return <>
        <Image 
            width={360}
            height={10}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
        />
    </>
}

export const previewClsAndPreviewStyle = () => {
   return <>
        <span>1.previewCls为 test-preview， previewStyle 的 background 为 lightblue </span>
        <br />
        <Image 
            width={360}
            height={200}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
            preview={{
                previewCls: 'test-preview',
                previewStyle: { background: 'lightblue' }
            }}
        />
        <br />
        <span>2.previewCls为 test-imagePreview， previewStyle 的 background 为 lightgreen </span>
        <br />
        <ImagePreview
            previewCls='test-imagePreview'
            previewStyle={{ background: 'lightgreen' }}
        >
            {srcList1.map((src, index) => {
                return (
                    <Image 
                        key={index} 
                        src={src} 
                        width={200} 
                        alt={`lamp${index + 1}`} 
                        style={{ marginRight: 5 }}
                    />
                );
            })}
        </ImagePreview> 
    </>
}

export const RenderPreviewIcon = () => {
    // 自定义关闭，左右切换按钮
    return <ImagePreview
       renderCloseIcon={<IconEyeClosed size="large" />}
       renderLeftIcon={<IconLeftCircleStroked size="large" />}
       renderRightIcon={<IconCenterRightStroked size="large" />}
    >
        {srcList1.map((src, index) => {
            return (
                <Image 
                    key={index} 
                    src={src} 
                    width={200} 
                    alt={`lamp${index + 1}`} 
                    style={{ marginRight: 5 }}
                />
            );
        })}
    </ImagePreview> 
}