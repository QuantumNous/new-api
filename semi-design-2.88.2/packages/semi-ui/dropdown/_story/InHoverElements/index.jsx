import React, { useRef } from 'react';
import { Dropdown } from '@douyinfe/semi-ui';
import { IconEdit } from '@douyinfe/semi-icons';

import '@douyinfe/semi-foundation/dropdown/dropdown.scss';

export default function Demo() {
    const ref = useRef();

    return (
        <div className={'demo-in-hover-elements'} ref={ref}>
            <span className={'content'}>ABCDEFG</span>
            <span className={'action'}>
                <Dropdown
                    position={'bottomLeft'}
                    getPopupContainer={() => ref.current}
                    render={<article>I&apos;m Dropdown content.</article>}
                >
                    {/* <Button>Hover Me</Button> */}
                    <IconEdit size={'extra-large'} />
                </Dropdown>
            </span>
        </div>
    );
}
