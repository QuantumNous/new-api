import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <rect x={9} y={9} width={13} height={13} rx={2} fill="#6A6F7F" />
            <rect x={2} y={7} width={12} height={12} rx={2} fill="#AAB2BF" />
            <rect x={8} y={2} width={11} height={11} rx={2} fill="#DDE3E8" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'popover');
export default IconComponent;
