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
            <path d="M7 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" fill="currentColor" />
            <path d="M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" fill="currentColor" />
            <path d="M19.5 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'more');
export default IconComponent;
