import React, { useRef, useState } from "react"
import JsonViewer from "../index"
import Popover from '../../popover'
import Image from '../../image'
import Modal from '../../modal'
import Rating from '../../rating'
import Button from '../../button'
import Tag from '../../tag'



export default {
    title: 'JsonViewer',
}

const baseStr = `{
    "min_position": 9,
    "has_more_items": true,
    "items_html": "Bike",
    "new_latent_count": 0,
    "data": {
       "length": 22,
       "text": "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    },
    "numericalArray": [
       23,
       29,
       28,
       26,
       23
    ],
    "StringArray": [
       "Oxygen",
       "Oxygen",
       "Oxygen",
       "Carbon"
    ],
    "multipleTypesArray": 3,
    "objArray": [
       {
          
       },
       {
          "class": "upper",
          "age": 7
       },
       {
          "class": "upper",
          "age": 1
       },
       {
          "class": "lower",
          "age": 5
       },
       {
          "class": "lower",
          "age": 3
       }
    ]
 }`;

 export const DefaultJsonViewer = () => {
   const onChangeHandler = value => {
       console.log(value, 'value');
   };

   const [autoWrap, setAutoWrap] = useState(true);
   const [lineHeight, setLineHeight] = useState(20);
   const jsonviewerRef = useRef(null);

   return (
       <>
           <JsonViewer
               value={baseStr}
               width={700}
               height={400}
               options={{ lineHeight: lineHeight, autoWrap: autoWrap, formatOptions: { tabSize: 4 } }}
               onChange={onChangeHandler}
               ref={jsonviewerRef}
           />
       </>
   );
};

const customStr = `{
    "url": "https://semi.design/zh-CN/plus/jsonviewer",
    "name": "Semi Design",
    "boolean": false,
    "dialog": "showDialog",
    "image": "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
    "number": 100,
    "array": [
        "https://semi.design/zh-CN/plus/jsonviewer",
        "https://semi.design/zh-CN/plus/jsonviewer",
        "https://semi.design/zh-CN/plus/jsonviewer"
    ],
    "objArray": [
        {
            "name": "Semi Design1",
            "age": 50
        },
        {
            "name": "Semi Design2",
            "age": 100
        },
        {
            "name": "Semi Design3",
            "age": 150
        }
    ]
}`;

export const CustomRender = () => {
    const customRender = [
        {
            match: (val: any, key?: string) => {
                if(key && key !== 'url') {
                    return false;
                }
                return typeof val === 'string' && val.startsWith('http');
            },
            render: (val: string) => {
                return <Popover showArrow content={'我是用户自定义的渲染'} trigger='hover'><span href={val.replace(/^"|"$/g, '')} target='_blank'>{val}</span></Popover>;
            },
        },
        {
            match: (val: any, key?: string) => key === 'image' && typeof val === 'string' && val.startsWith('http'),
            render: (val: string) => {
                return <Popover showArrow content={<Image width={100} height={100} src={val.replace(/^"|"$/g, '')} />} trigger='hover'><span>{val}</span></Popover>;
            }
        },
        {
            match: 'Semi Design1',
            render: (val: string) => {
                return <Tag size='small' shape='circle'>{val}</Tag>
            }
        },
        {
            match: 'false',
            render: (val: string) => {
                return <Rating defaultValue={3} size={10} disabled/>
            }
        },
        {
            match: new RegExp('^\\d+$'),
            render: (val: string) => {
                return <span style={{color:'black',backgroundColor:'transparent',border:'1px solid #031126',borderRadius:'4px',padding:'2px 4px'}}>{val}</span>
            }
        },
        {
            match: 'showDialog',
            render: (val: string) => {
                return <Button onClick={showDialog} type='danger' style={{height:'18px',lineHeight:'18px'}}>{val}</Button>
            }
        }
    ];

    const [visible, setVisible] = useState(false);
    const showDialog = () => {
        setVisible(true);
    };
    const handleOk = () => {
        setVisible(false);
        console.log('Ok button clicked');
    };
    const handleCancel = () => {
        setVisible(false);
        console.log('Cancel button clicked');
    };
    const handleAfterClose = () => {
        console.log('After Close callback executed');
    };

    const [autoWrap, setAutoWrap] = useState(true);
    const [lineHeight, setLineHeight] = useState(20);
    const jsonviewerRef = useRef(null);

    return (
        <>
            <JsonViewer
                value={customStr}
                width={700}
                height={400}
                options={{ lineHeight: lineHeight, autoWrap: autoWrap, readOnly: true, customRenderRule: customRender, formatOptions: { tabSize: 4 } }}
                ref={jsonviewerRef}
            />
            <Modal
                title="基本对话框"
                visible={visible}
                onOk={handleOk}
                afterClose={handleAfterClose}
                onCancel={handleCancel}
                closeOnEsc={true}
            >
                This is the content of a basic modal.
                <br />
                More content...
            </Modal>
        </>
    );
};