import { RadioGroup } from '../../index';
import getConfigureItem from './getConfigureItem';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';

export default getConfigureItem(RadioGroup, { 
    className: `${cssClasses.PREFIX}-footer-configure-radio-button`,
    valuePath: 'target.value',
    defaultProps: {
        type: 'button',
    } 
});
