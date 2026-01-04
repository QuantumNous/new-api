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
                d="M10.53 14.53A7 7 0 0 1 1.5 5.4c.12-.31.53-.37.76-.14L5.3 8.3a1 1 0 0 0 1.42 0l1.58-1.58a1 1 0 0 0 0-1.42L5.26 2.26c-.23-.23-.17-.64.14-.76a7 7 0 0 1 9.13 9.03l7.56 7.56a2 2 0 0 1 0 2.82L20.9 22.1a2 2 0 0 1-2.82 0l-7.56-7.56Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'wrench');
export default IconComponent;
