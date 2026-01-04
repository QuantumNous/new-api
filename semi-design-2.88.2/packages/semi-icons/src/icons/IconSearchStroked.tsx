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
                d="M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.1 6.32a8 8 0 1 1 1.41-1.41l5.4 5.38a1 1 0 0 1-1.42 1.42l-5.38-5.39Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'search_stroked');
export default IconComponent;
