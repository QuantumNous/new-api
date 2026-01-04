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
                d="M19.7 14.75c0 .64-.44 1.12-1.03 1.12-.59 0-1.02-.48-1.02-1.13 0-.64.43-1.1 1.02-1.1.6 0 1.04.47 1.04 1.1Zm-4.42 4.65c0 .52.34.97.91 1.3.57.31 1.35.5 2.22.5 2.69 0 4.28-1.78 4.28-4.87 0-2.99-1.54-4.82-4.03-4.82-2.19 0-3.66 1.35-3.66 3.34 0 1.77 1.17 3 2.85 3 .95 0 1.8-.5 2.13-1.28h.06c0 1.57-.58 2.49-1.63 2.49-.56 0-.88-.19-1.27-.43-.31-.2-.54-.26-.83-.26a1 1 0 0 0-1.03 1.03Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h9');
export default IconComponent;
