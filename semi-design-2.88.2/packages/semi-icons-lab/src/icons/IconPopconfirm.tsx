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
            <rect x={5} y={8} width={17} height={14} rx={2} fill="#AAB2BF" />
            <path
                d="M8.47 2.3a.6.6 0 0 0-1.04 0L5.83 5H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-6.92L8.47 2.3Z"
                fill="#DDE3E8"
            />
            <rect x={7} y={13} width={4} height={3} rx={1} fill="#4CC3FA" />
            <rect x={13} y={13} width={4} height={3} rx={1} fill="#324350" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'popconfirm');
export default IconComponent;
