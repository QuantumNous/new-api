import React from 'react';
import { Tooltip, Tag, Button } from '@douyinfe/semi-ui';
import { IconUser } from '@douyinfe/semi-icons';
import { renderToString } from 'react-dom/server';

function Demo() {
    const renderContent = (content = '') => {
        const Elem = () =>
            content.split('|').map(text => (
                <div key={text}>
                    <Tooltip content={content} visible>
                        <span>{text}</span>
                    </Tooltip>
                    <Tag>{text}</Tag>
                    <Button onClick={(...args) => console.log(...args)} icon={<IconUser />} />
                </div>
            ));

        // return renderToString(<Elem />);
        return <Elem />;
    };

    return (
        <div style={{ margin: 50 }}>
            <div>{renderContent('AA|BB|CC')}</div>
        </div>
    );
}

export default Demo;
