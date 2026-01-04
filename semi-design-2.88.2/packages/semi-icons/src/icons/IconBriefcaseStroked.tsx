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
                d="M15 1a2 2 0 0 1 2 2v3h4a2 2 0 0 1 2 2v12a2 2 0 0 1-1.8 1.99L21 22H3l-.2-.01A2 2 0 0 1 1 20V8c0-1.1.9-2 2-2h4V3c0-1.1.9-2 2-2h6ZM3 20h18v-7h-6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2H3v7Zm0-9h18V8H3v3Zm6.5-8a.5.5 0 0 0-.5.5V6h6V3.5a.5.5 0 0 0-.5-.5h-5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'briefcase_stroked');
export default IconComponent;
