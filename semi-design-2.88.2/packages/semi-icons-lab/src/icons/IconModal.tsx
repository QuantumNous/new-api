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
            <rect x={2} y={2} width={20} height={20} rx={3} fill="#AAB2BF" />
            <rect x={4} y={6} width={16} height={12} rx={1} fill="white" />
            <rect x={6} y={13} width={5} height={3} rx={1} fill="#AAB2BF" />
            <rect x={13} y={13} width={5} height={3} rx={1} fill="#4CC3FA" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'modal');
export default IconComponent;
