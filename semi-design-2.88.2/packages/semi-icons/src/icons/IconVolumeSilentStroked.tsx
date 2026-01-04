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
                d="M10.38 2.22A1 1 0 0 1 12 3v18a1 1 0 0 1-1.63.78L4.66 17H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.65l5.72-4.78ZM5.92 8.54A2 2 0 0 1 4.65 9H3v6h1.65a2 2 0 0 1 1.28.46l4.07 3.4V5.14l-4.07 3.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'volume_silent_stroked');
export default IconComponent;
