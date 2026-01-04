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
                d="M6.5 2A3.5 3.5 0 0 0 3 5.5v13A3.5 3.5 0 0 0 6.5 22H12a1.5 1.5 0 0 0 0-3H6.5a.5.5 0 0 1-.5-.5v-13c0-.28.22-.5.5-.5H12a1.5 1.5 0 0 0 0-3H6.5Zm9.44 3.94a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12l-5 5a1.5 1.5 0 0 1-2.12-2.12l2.44-2.44H11a1.5 1.5 0 0 1 0-3h7.38l-2.44-2.44a1.5 1.5 0 0 1 0-2.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'exit');
export default IconComponent;
