import { ArrayElement } from '../_base/base';
import { strings } from '@douyinfe/semi-foundation/floatButton/constants';
import { BadgeProps } from '../badge';


export interface FloatButtonProps {
    shape?: ArrayElement<typeof strings.SHAPE>;
    colorful?: boolean;
    style?: React.CSSProperties;
    className?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    href?: string;
    target?: string;
    disabled?: boolean;
    size?: ArrayElement<typeof strings.SIZE>;
    badge?: BadgeProps
}