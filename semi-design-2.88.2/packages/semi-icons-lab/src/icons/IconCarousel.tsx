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
            <rect x={10.5} y={7.5} width={11} height={11} rx={2} fill="#DDE3E8" />
            <rect x={2.5} y={7.5} width={12} height={11} rx={2} fill="#AAB2BF" />
            <rect x={5} y={5.5} width={14} height={13} rx={2} fill="#6A6F7F" />
            <path
                d="M12.18 10.7a1.58 1.58 0 0 1 2.64 0l1.97 3.18c.59.94-.14 2.12-1.31 2.12h-3.96c-1.17 0-1.9-1.18-1.31-2.12l1.97-3.17Z"
                fill="#DDE3E8"
            />
            <circle cx={8.5} cy={9.5} r={1.5} fill="white" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'carousel');
export default IconComponent;
