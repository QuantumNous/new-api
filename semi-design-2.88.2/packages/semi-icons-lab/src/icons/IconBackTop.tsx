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
            <path d="M2.97 14.13 12 6l9.03 8.13a.5.5 0 0 1-.33.87H16v7H8v-7H3.3a.5.5 0 0 1-.33-.87Z" fill="#4CC3FA" />
            <rect x={3} y={2} width={18} height={4} rx={1} fill="#AAB2BF" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'back-top');
export default IconComponent;
