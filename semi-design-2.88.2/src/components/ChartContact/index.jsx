import React from 'react';

const ChartContact = (props) => {
    return <div style={{ display: 'flex', flexDirection: 'row' }}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/contact_wechat.jpeg'} style={{ width: 250, height: 250 }}/>
            <span>{props.name1}</span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/vchart/contact_lark.jpeg'} style={{ width: 250, height: 250 }}/>
            <span>{props.name2}</span>
        </span>
    </div>;};

export default ChartContact;