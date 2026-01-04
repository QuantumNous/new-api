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
                d="M3.5 2.5C4.33 2.5 5 3.17 5 4v6.5h6V4a1.5 1.5 0 0 1 3 0v16a1.5 1.5 0 0 1-3 0v-6.5H5V20a1.5 1.5 0 0 1-3 0V4c0-.83.67-1.5 1.5-1.5Z"
                fill="currentColor"
            />
            <path
                d="M19.08 19.68c0 .87.52 1.42 1.32 1.42.82 0 1.34-.56 1.34-1.42v-.08h.06c.67 0 1.1-.42 1.1-1.08 0-.67-.44-1.14-1.1-1.14h-.06v-4.07c0-1.1-.89-1.8-2.27-1.8-1.07 0-1.72.41-2.56 1.62-.68.98-1.6 2.62-2.07 3.7-.28.64-.36.94-.36 1.33 0 .93.54 1.44 1.5 1.44h3.1v.08Zm-2.07-2.3v-.02c.15-.35 1.64-3.1 1.94-3.6h.13v3.62h-2.07Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h4');
export default IconComponent;
