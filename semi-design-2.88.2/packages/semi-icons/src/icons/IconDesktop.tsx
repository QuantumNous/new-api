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
                d="M2.5 14.5v-9c0-1.1.9-2 2-2h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z"
                stroke="currentColor"
                strokeWidth={3}
            />
            <path d="M7.5 21.5h9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            <path d="M12 15.5v5" stroke="currentColor" strokeWidth={4} />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'desktop');
export default IconComponent;
