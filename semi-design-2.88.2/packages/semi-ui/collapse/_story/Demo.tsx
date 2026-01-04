import React from 'react';
import Collapse from '../index';

const Demo = () => {
    return (
        <div>
            <Collapse accordion defaultActiveKey="byte" onChange={ (val: any) => { console.log(val); } }>
                <Collapse.Panel itemKey="semi">
                    <p>
                        semi-ui
                    </p>
                </Collapse.Panel>
                <Collapse.Panel itemKey="byte">
                    <p>
                        byte
                    </p>
                </Collapse.Panel>
                <Collapse.Panel itemKey="dance">
                    <p>
                        dance
                    </p>
                </Collapse.Panel>
            </Collapse>
        </div>
    );
};

export default Demo;