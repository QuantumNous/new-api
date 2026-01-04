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
            <path d="M10.5 1.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1Z" fill="currentColor" />
            <path d="M10.5 21.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1Z" fill="currentColor" />
            <path d="M24 12c0-.83-.67-1.5-1.5-1.5h-1a1.5 1.5 0 0 0 0 3h1c.83 0 1.5-.67 1.5-1.5Z" fill="currentColor" />
            <path d="M2.5 10.5a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Z" fill="currentColor" />
            <path
                d="M20.49 3.51a1.5 1.5 0 0 0-2.13 0l-.7.71a1.5 1.5 0 1 0 2.12 2.12l.7-.7a1.5 1.5 0 0 0 0-2.13Z"
                fill="currentColor"
            />
            <path d="M4.22 17.66a1.5 1.5 0 1 1 2.12 2.12l-.7.7a1.5 1.5 0 1 1-2.13-2.12l.71-.7Z" fill="currentColor" />
            <path
                d="M3.51 3.51a1.5 1.5 0 0 0 0 2.13l.71.7a1.5 1.5 0 0 0 2.12-2.12l-.7-.7a1.5 1.5 0 0 0-2.13 0Z"
                fill="currentColor"
            />
            <path d="M17.66 19.78a1.5 1.5 0 1 1 2.12-2.12l.7.7a1.5 1.5 0 1 1-2.12 2.13l-.7-.71Z" fill="currentColor" />
            <path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'sun');
export default IconComponent;
