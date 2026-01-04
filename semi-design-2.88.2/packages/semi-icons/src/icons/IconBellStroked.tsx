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
                d="M10.01 2.78a2 2 0 0 1 3.98 0A7 7 0 0 1 19 9.5c0 3.35.72 5.57 1.4 6.93a7.74 7.74 0 0 0 1.24 1.8A1 1 0 0 1 21 20h-5.13a4 4 0 0 1-7.74 0H3a1 1 0 0 1-.64-1.77c1.05-.87 1.71-2.24 2.11-3.87.4-1.6.5-3.36.53-4.87 0-2.72 1.16-4.52 2.67-5.6.75-.54 1.57-.9 2.34-1.1ZM12 21a2 2 0 0 1-1.73-1h3.46A2 2 0 0 1 12 21Zm6.97-3H5.15c.6-.98 1-2.07 1.26-3.16.45-1.83.57-3.76.59-5.32V9.5c0-2.07.84-3.27 1.83-3.99A5.7 5.7 0 0 1 12 4.5a5 5 0 0 1 5 5c0 3.65.78 6.18 1.6 7.82l.37.68Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bell_stroked');
export default IconComponent;
