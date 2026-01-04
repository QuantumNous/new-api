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
                d="M12 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6Zm0-10C9.8 4 8 5.8 8 8s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4Z"
                fill="currentColor"
            />
            <path
                d="M21.9 20.6c-.1-.2-2.3-5.6-9.9-5.6-7.6 0-9.8 5.4-9.9 5.6-.2.5 0 1.1.6 1.3.5.2 1.1 0 1.3-.5 0-.2 1.8-4.4 8-4.4s8 4.2 8.1 4.4c.2.5.8.8 1.3.5.5-.2.7-.8.5-1.3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_stroked');
export default IconComponent;
