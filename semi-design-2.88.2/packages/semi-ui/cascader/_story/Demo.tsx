import React from 'react';
import Cascader from '../index';

const Demo = () => {
    const treeData = [
        {
            label: '浙江省',
            value: 'zhejiang',
            children: [
                {
                    label: '杭州市',
                    value: 'hangzhou',
                    children: [
                        {
                            label: '西湖区',
                            value: 'xihu',
                        },
                        {
                            label: '萧山区',
                            value: 'xiaoshan',
                        },
                        {
                            label: '临安区',
                            value: 'linan',
                        },
                    ],
                },
                {
                    label: '宁波市',
                    value: 'ningbo',
                    children: [
                        {
                            label: '海曙区',
                            value: 'haishu',
                        },
                        {
                            label: '江北区',
                            value: 'jiangbei',
                        }
                    ]
                },
            ],
        }
    ];
    return (
        <div>
            <Cascader
                style={{ width: 300 }}
                treeData={treeData}
                placeholder="默认格式"
            />
            <Cascader
                zIndex={99999}
                style={{ width: 300 }}
                treeData={treeData}
                changeOnSelect
                placeholder="可搜索的选择即改变"
            />
        </div>
    );
};

export default Demo;