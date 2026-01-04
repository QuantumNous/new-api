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
                d="M10.75 1.9c.4-1.2 2.1-1.2 2.5 0l1.99 6.12h6.45a1.3 1.3 0 0 1 .77 2.37l-5.22 3.78 2 6.11c.39 1.2-1 2.2-2.02 1.46L12 17.96l-5.22 3.78c-1.02.75-2.4-.25-2.01-1.46l1.99-6.11-5.22-3.78a1.3 1.3 0 0 1 .77-2.37h6.45l2-6.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'star');
export default IconComponent;
