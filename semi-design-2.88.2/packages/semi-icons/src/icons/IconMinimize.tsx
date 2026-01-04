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
                d="M8.5 2c.83 0 1.5.67 1.5 1.5v3A3.5 3.5 0 0 1 6.5 10h-3a1.5 1.5 0 1 1 0-3h3a.5.5 0 0 0 .5-.5v-3C7 2.67 7.67 2 8.5 2ZM16 2c.83 0 1.5.67 1.5 1.5v3c0 .28.22.5.5.5h3a1.5 1.5 0 0 1 0 3h-3a3.5 3.5 0 0 1-3.5-3.5v-3c0-.83.67-1.5 1.5-1.5ZM2 15.5c0-.83.67-1.5 1.5-1.5h3a3.5 3.5 0 0 1 3.5 3.5v3a1.5 1.5 0 0 1-3 0v-3a.5.5 0 0 0-.5-.5h-3A1.5 1.5 0 0 1 2 15.5Zm12 2a3.5 3.5 0 0 1 3.5-3.5h3a1.5 1.5 0 0 1 0 3h-3a.5.5 0 0 0-.5.5v3a1.5 1.5 0 0 1-3 0v-3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'minimize');
export default IconComponent;
