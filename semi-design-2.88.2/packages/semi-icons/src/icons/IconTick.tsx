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
                d="M21.35 4.27c.68.47.86 1.4.38 2.08l-10 14.5a1.5 1.5 0 0 1-2.33.17l-6.5-7a1.5 1.5 0 0 1 2.2-2.04l5.23 5.63 8.94-12.96a1.5 1.5 0 0 1 2.08-.38Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tick');
export default IconComponent;
