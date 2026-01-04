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
                d="M10.38 2.22A1 1 0 0 1 12 3v18a1 1 0 0 1-1.63.78L4.66 17H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.65l5.72-4.78ZM5.92 8.54A2 2 0 0 1 4.65 9H3v6h1.65a2 2 0 0 1 1.28.46l4.07 3.4V5.14l-4.07 3.4Z"
                fill="currentColor"
            />
            <path
                d="M14.17 8.45a1 1 0 0 1 1.38-.28l.12.08.23.19A4.84 4.84 0 0 1 17.5 12a4.7 4.7 0 0 1-1.83 3.75l-.11.08a1 1 0 0 1-1.12-1.66l.13-.1c.1-.1.24-.23.38-.42.28-.37.55-.92.55-1.65a2.7 2.7 0 0 0-1.06-2.17 1 1 0 0 1-.27-1.38Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'volume_1_stroked');
export default IconComponent;
