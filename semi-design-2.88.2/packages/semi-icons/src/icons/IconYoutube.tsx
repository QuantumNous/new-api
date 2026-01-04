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
                d="M22.55 6.52c-.25-.98-1-1.76-1.93-2.02C18.89 4 12 4 12 4s-6.89 0-8.61.46A2.87 2.87 0 0 0 1.46 6.5C1 8.28 1 12 1 12s0 3.73.45 5.5c.25.97 1 1.75 1.93 2.01C5.12 20 12 20 12 20s6.89 0 8.6-.46a2.82 2.82 0 0 0 1.95-2.01c.46-1.79.46-5.5.46-5.5s.02-3.73-.45-5.51ZM9.8 15.42l.01-6.85L15.53 12 9.8 15.42Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'youtube');
export default IconComponent;
