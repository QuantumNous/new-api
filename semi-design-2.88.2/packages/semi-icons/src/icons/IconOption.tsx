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
                d="M3.5 3.5a1.5 1.5 0 1 0 0 3h3.63l7.57 13.24c.26.47.76.76 1.3.76h4.5a1.5 1.5 0 0 0 0-3h-3.63L9.3 4.26A1.5 1.5 0 0 0 8 3.5H3.5Zm11 0a1.5 1.5 0 0 0 0 3h6a1.5 1.5 0 0 0 0-3h-6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'option');
export default IconComponent;
