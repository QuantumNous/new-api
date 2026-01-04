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
                d="M1 7a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7Zm9.5 0H5a1 1 0 0 0-1 1v2.5h6.5V7Zm3 0v3.5H20V8a1 1 0 0 0-1-1h-5.5Zm6.5 6.5h-6.5V17H19a1 1 0 0 0 1-1v-2.5ZM10.5 17v-3.5H4V16a1 1 0 0 0 1 1h5.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'grid-rectangle');
export default IconComponent;
