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
                d="m6.45 8.34 4.8-5.48a1 1 0 0 1 1.5 0l4.8 5.48A1 1 0 0 1 16.8 10H7.2a1 1 0 0 1-.75-1.66Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'caretup');
export default IconComponent;
