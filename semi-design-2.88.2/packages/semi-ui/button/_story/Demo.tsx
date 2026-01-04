import React, { useEffect, useRef } from 'react';
import Button from '../index';
import ButtonGroup from '../buttonGroup';
import IconButton from '../../iconButton';

const Demo = () => {
    const ref = useRef(null);
    const refIB = useRef(null);

    useEffect(() => {
        console.log(`ref: `, ref.current);
    }, [ref.current]);

    useEffect(() => {
        console.log(`refIB: `, refIB.current);
    }, [refIB.current]);

    return (
        <div>
            <Button
                type={'primary'}
                ref={ref}
                theme={'light'}
                onClick={(e: any) => {
                    console.log(e);
                }}
            >
                I am a Button
            </Button>
            <Button icon={'tick'} theme={'solid'} />
            <Button icon={'tick'} theme={'solid'}>
                circle
            </Button>
            <ButtonGroup type={'danger'}>
                <Button icon={'edit'} theme={'solid'}>
                    编辑
                </Button>
                <Button icon={'delete'} theme={'solid'}>
                    删除
                </Button>
                <Button icon={'close'} theme={'solid'}>
                    关闭
                </Button>
            </ButtonGroup>

            <IconButton type={'warning'} icon={'edit'} ref={refIB} />
        </div>
    );
};

export default Demo;
