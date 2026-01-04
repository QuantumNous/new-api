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
            <g opacity={0.99}>
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="m19.13 3.18-3.38 3.75a.5.5 0 0 0 .37.83H18v8.65h-1.88a.5.5 0 0 0-.37.84L19.13 21c.2.22.54.22.74 0l3.38-3.75a.5.5 0 0 0-.37-.84H21V7.76h1.88a.5.5 0 0 0 .37-.83l-3.38-3.75a.5.5 0 0 0-.74 0ZM2.29 4C1.58 4 1 4.67 1 5.5S1.58 7 2.29 7H13.7C14.42 7 15 6.33 15 5.5S14.42 4 13.71 4H2.3ZM1 12c0-.83.58-1.5 1.29-1.5H13.7c.71 0 1.29.67 1.29 1.5s-.58 1.5-1.29 1.5H2.3C1.58 13.5 1 12.83 1 12Zm0 6.5c0-.83.58-1.5 1.29-1.5H13.7c.71 0 1.29.67 1.29 1.5s-.58 1.5-1.29 1.5H2.3C1.58 20 1 19.33 1 18.5Z"
                    fill="currentColor"
                />
            </g>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'line_height');
export default IconComponent;
