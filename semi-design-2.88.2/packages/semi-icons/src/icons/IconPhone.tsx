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
                d="M8 .5a3 3 0 0 0-3 3v17a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-17a3 3 0 0 0-3-3H8ZM12 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'phone');
export default IconComponent;
