import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 25 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path d="M7.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" fill="currentColor" />
            <path d="M15 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" fill="currentColor" />
            <path d="M20 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'more_stroked');
export default IconComponent;
