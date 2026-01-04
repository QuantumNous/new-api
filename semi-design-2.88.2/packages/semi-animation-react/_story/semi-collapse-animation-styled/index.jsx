import { Collapse } from '@douyinfe/semi-ui';
import { StyledAnimation } from '@douyinfe/semi-animation-react';
import React from 'react';

export default class SemiCollapseAnimation extends React.PureComponent {
    state = {
        itemKey: '',
    };

    constructor(props = {}) {
        super(props);
    }

    render() {
        const { itemKey } = this.state;

        return (
            <Collapse
                accordion
                onChange={(itemKey, event) => {
                    this.setState({ itemKey });
                }}
            >
                {['1', '2', '3'].map(key => (
                    <StyledAnimation key={key} type={itemKey === key ? 'slideInDown' : 'slideOutDown'}>
                        <Collapse.Panel header={`This is panel header ${key}`} itemKey={key}>
                            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
                        </Collapse.Panel>
                    </StyledAnimation>
                ))}
            </Collapse>
        );
    }
}
