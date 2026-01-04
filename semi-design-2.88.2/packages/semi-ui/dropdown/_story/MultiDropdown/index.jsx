import { Dropdown, Tag } from '@douyinfe/semi-ui';
import React, { useMemo } from 'react';

function Demo() {
    const subDropdown = useMemo(() => (
        <Dropdown.Menu>
            <Dropdown.Item>Menu Item 1</Dropdown.Item>
            <Dropdown.Item>Menu Item 2</Dropdown.Item>
            <Dropdown.Item>Menu Item 3</Dropdown.Item>
        </Dropdown.Menu>
    ));

    return (
        <div style={{ margin: 100 }}>
            <Dropdown
                render={
                    <Dropdown.Menu>
                        <Dropdown position={'rightTop'} render={subDropdown} spacing={20}>
                            <Dropdown.Item>Menu Item 1</Dropdown.Item>
                        </Dropdown>
                        <Dropdown position={'leftTop'} render={subDropdown}>
                            <Dropdown.Item>Menu Item 2</Dropdown.Item>
                        </Dropdown>
                        <Dropdown.Item>Menu Item 3</Dropdown.Item>
                    </Dropdown.Menu>
                }
            >
                <Tag>Hover Me</Tag>
            </Dropdown>
        </div>
    );
}

export default Demo;
