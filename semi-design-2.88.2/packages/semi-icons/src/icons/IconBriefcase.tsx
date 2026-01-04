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
                d="M7 3c0-1.1.9-2 2-2h6a2 2 0 0 1 2 2v3h4a2 2 0 0 1 2 2v3H1V8c0-1.1.9-2 2-2h4V3Zm2 3h6V3.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V6Zm6 7.5c0-.28.22-.5.5-.5H23v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7h7.5c.28 0 .5.22.5.5V15a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'briefcase');
export default IconComponent;
