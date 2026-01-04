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
                d="M19 1a2 2 0 0 1 2 2v19a1 1 0 0 1-1 1H6a3 3 0 0 1-3-3V5a4 4 0 0 1 4-4h12ZM6 19a1 1 0 1 0 0 2h13v-2H6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'book');
export default IconComponent;
