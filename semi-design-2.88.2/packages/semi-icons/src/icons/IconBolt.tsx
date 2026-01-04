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
                d="M3.6 14.2 15.1.65c.3-.4.95-.15.9.35l-2 8h6a.5.5 0 0 1 .4.8L8.9 23.35c-.3.4-.95.15-.9-.35l2-8H4a.5.5 0 0 1-.4-.8Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bolt');
export default IconComponent;
