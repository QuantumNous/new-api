import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path d="m6 4 5-4 5 4-5 5.5L6 4Z" fill="currentColor" />
            <path d="m18 6 4 5-4 5-5.5-5L18 6Z" fill="currentColor" />
            <path d="m4 16-4-5 4-5 5.5 5L4 16Z" fill="currentColor" />
            <path d="m16 18-5 4-5-4 5-5.5 5 5.5Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'component');
export default IconComponent;
