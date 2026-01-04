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
                d="M12 3.5c0-.83.67-1.5 1.5-1.5h6A2.5 2.5 0 0 1 22 4.5v6a1.5 1.5 0 0 1-3 0V7l-7.94 7.94a1.5 1.5 0 0 1-2.12-2.12L16.76 5H13.5A1.5 1.5 0 0 1 12 3.5Z"
                fill="currentColor"
            />
            <path
                d="M5 8.5v10c0 .28.22.5.5.5h10a.5.5 0 0 0 .5-.5v-3a1.5 1.5 0 0 1 3 0v3a3.5 3.5 0 0 1-3.5 3.5h-10A3.5 3.5 0 0 1 2 18.5v-10A3.5 3.5 0 0 1 5.5 5h3a1.5 1.5 0 1 1 0 3h-3a.5.5 0 0 0-.5.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'external_open');
export default IconComponent;
