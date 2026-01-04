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
            <path
                d="M5.44 9.08A2 2 0 0 1 7.22 8h9.56a2 2 0 0 1 1.78 1.08l3.37 6.56-19.8-.13 3.31-6.43Z"
                fill="#AAB2BF"
            />
            <path d="M6.73 11.32a1 1 0 0 1 .9-.58h8.73a1 1 0 0 1 .91.58L19 15H5l1.73-3.68Z" fill="#6A6F7F" />
            <path d="M2 16a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5Z" fill="#DDE3E8" />
            <rect x={11} y={1} width={2} height={5} rx={1} fill="#AAB2BF" />
            <rect
                x={3.879}
                y={4.293}
                width={2}
                height={4.3448}
                rx={1}
                transform="rotate(-45 3.87866 4.29285)"
                fill="#AAB2BF"
            />
            <rect
                x={18.573}
                y={2.879}
                width={2}
                height={4.2175}
                rx={1}
                transform="rotate(45 18.5731 2.87866)"
                fill="#AAB2BF"
            />
            <circle cx={12} cy={18.5} r={1.5} fill="#AAB2BF" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'empty');
export default IconComponent;
