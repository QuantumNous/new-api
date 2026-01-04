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
                d="M14.49 4.19a1.5 1.5 0 0 0-2.98-.38l-2 16a1.5 1.5 0 1 0 2.98.38l2-16ZM8.06 5.94a1.5 1.5 0 0 1 0 2.12L4.12 12l3.94 3.94a1.5 1.5 0 1 1-2.12 2.12l-5-5a1.5 1.5 0 0 1 0-2.12l5-5a1.5 1.5 0 0 1 2.12 0Zm7.88 0a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12l-5 5a1.5 1.5 0 0 1-2.12-2.12L19.88 12l-3.94-3.94a1.5 1.5 0 0 1 0-2.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'code');
export default IconComponent;
