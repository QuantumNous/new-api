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
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13.5 5.92V3a1.5 1.5 0 0 0-3 0v2.92L9.24 5.2a1.5 1.5 0 0 0-1.48 2.6l3.5 2a1.5 1.5 0 0 0 1.48 0l3.5-2a1.5 1.5 0 1 0-1.48-2.6l-1.26.72Zm-9 7.58a1.5 1.5 0 0 1 0-3h15a1.5 1.5 0 0 1 0 3h-15Zm9 4.58 1.26.72a1.5 1.5 0 1 0 1.48-2.6l-3.5-2a1.5 1.5 0 0 0-1.48 0l-3.5 2a1.5 1.5 0 0 0 1.48 2.6l1.26-.72V21a1.5 1.5 0 0 0 3 0v-2.92Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_center_vertical');
export default IconComponent;
