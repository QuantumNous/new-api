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
            <rect x={2} y={1} width={20} height={10} rx={5} fill="#DDE3E8" />
            <circle cx={7.5} cy={5.99997} r={3.5} fill="white" />
            <rect x={2} y={13} width={20} height={10} rx={5} fill="#3BCE4A" />
            <circle cx={16.5} cy={18} r={3.5} fill="white" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'switch');
export default IconComponent;
