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
                d="m6.62 3.25.44.75H2.6C1.72 4 1 4.67 1 5.5S1.72 7 2.6 7h1.9c0 2.45 1.1 4.71 2.5 6.5-1.1.64-2.63 1-4 1a1.5 1.5 0 1 0 0 3c2.23 0 4.3-.7 6-1.88 1.4.98 3.06 1.62 4.85 1.82l-1.7 3.39a1.5 1.5 0 0 0 2.7 1.34l.58-1.17h4.14l.59 1.17a1.5 1.5 0 0 0 2.68-1.34l-4-8a1.5 1.5 0 0 0-2.68 0l-.85 1.7a1.5 1.5 0 0 0-.31-.03c-1.37 0-2.9-.36-4-1A10.7 10.7 0 0 0 13.5 7h1.9c.88 0 1.6-.67 1.6-1.5S16.28 4 15.4 4h-4.88l-1.3-2.25a1.5 1.5 0 0 0-2.6 1.5ZM7.5 7h3c0 1.69-.56 3.25-1.5 4.5A7.47 7.47 0 0 1 7.5 7Zm10 9.85L18.57 19h-2.14l1.07-2.15Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'language');
export default IconComponent;
