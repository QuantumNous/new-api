import React, { useState, useEffect, useRef } from 'react';
import JsonViewer from '../index';
import Popover from '../../popover';
import Image from '../../image';
import Modal from '../../modal';
export default {
    title: 'JsonViewer',
};
import Rating from '../../rating';
import Button from '../../button';
import Tag from '../../tag';

const baseStr = `{
	"min_position": 1,
	"has_more_items": true,
	"items_html": "Bike",
	"new_latent_count": 0,
	"data": {
		"length": 22,
		"text": "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
	},
	"numericalArray": [23, 29, 28, 26, 23],
	"StringArray": ["Oxygen", "Oxygen", "Oxygen", "Carbon"],
	"multipleTypesArray": 3,
	"objArray": [
		{},
		{
			"class": "upper",
			"name": "Mark",
			"age": 7
		},
		{
			"class": "upper",
			"name": "Tom",
			"age": 1
		},
		{
			"class": "lower",
			"name": "Jerry",
			"age": 5
		},
		{
			"class": "lower",
			"name": "Alice",
			"age": 3
		}
	]
}`;

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


export const CustomRender = () => {

	const customRender = [
		{
			match: (val, pathChain) => {
				if(pathChain !== 'root.url') {
					return false;
				}
				return typeof val === 'string' && val.startsWith('http');
			},
			render: (val) => {
				return <Popover showArrow content={'我是用户自定义的渲染'} trigger='hover'><span href={val.replace(/^"|"$/g, '')} target='_blank'>{val}</span></Popover>;
			},
		},
		{
			match: (val, pathChain) => pathChain === 'root.image' && typeof val === 'string' && val.startsWith('http'),
			render: (val) => {
				return <Popover showArrow content={<Image width={100} height={100} src={val.replace(/^"|"$/g, '')} />} trigger='hover'><span>{val}</span></Popover>;
			}
		},
		{
			match: 'Semi Design1',
			render: (val) => {
				return <Tag size='small' shape='circle'>{val}</Tag>
			}
		},
		{
			match: 'false',
			render: (val) => {
				return <Rating defaultValue={3} size={10} disabled/>
			}
		},
		{
			match: new RegExp('^\\d+$'),
			render: (val) => {
				return <span style={{color:'black',backgroundColor:'transparent',border:'1px solid #031126',borderRadius:'4px',padding:'2px 4px'}}>{val}</span>
			}
		},
		{
			match: 'showDialog',
			render: (val) => {
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
                options={{ lineHeight: lineHeight, autoWrap: autoWrap,readOnly:true, customRenderRule: customRender, formatOptions: { tabSize: 4 } }}
                ref={jsonviewerRef}
            />
			            <Modal
                title="基本对话框"
                visible={visible}
                onOk={handleOk}
                afterClose={handleAfterClose} //>=1.16.0
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