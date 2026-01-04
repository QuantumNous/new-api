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
                d="M6.9 2a3 3 0 0 1 1.66.5l2 1.33a1 1 0 0 0 .55.17h5.75a3 3 0 0 1 3 3v.83h.74a2 2 0 0 1 1.94 2.6l-3.16 9.98a2 2 0 0 1-1.91 1.4H2a1 1 0 0 1-1-1V5a3 3 0 0 1 3-3h2.9ZM13 9.92h-.82l-3.52.05-1.45.02-1.07 2.95-2.47 6.86h13.8l3.16-9.98-7.62.1ZM4 4a1 1 0 0 0-1 1v10.76l1.26-3.5 1.06-2.95A2 2 0 0 1 7.18 8l4.98-.06 5.7-.07V7a1 1 0 0 0-1-1H11.1a3 3 0 0 1-1.67-.5l-2-1.33A1 1 0 0 0 6.9 4H4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'folder_open_stroked');
export default IconComponent;
