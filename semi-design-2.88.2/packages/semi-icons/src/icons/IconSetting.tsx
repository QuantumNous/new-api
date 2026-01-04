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
                d="M8 5.07c-.8.47-1.8.46-2.6 0l-.24-.15a1.4 1.4 0 0 0-1.82.29c-.64.82-1.16 1.73-1.55 2.7a1.4 1.4 0 0 0 .66 1.71l.24.14a2.57 2.57 0 0 1 0 4.48l-.24.14a1.4 1.4 0 0 0-.66 1.72 11.1 11.1 0 0 0 1.55 2.69 1.4 1.4 0 0 0 1.82.3l.25-.15a2.57 2.57 0 0 1 3.88 2.24v.28c-.01.7.46 1.33 1.16 1.43a11 11 0 0 0 3.1 0 1.4 1.4 0 0 0 1.17-1.43v-.28a2.57 2.57 0 0 1 3.87-2.24l.25.14c.6.36 1.38.26 1.82-.29.64-.82 1.16-1.73 1.55-2.7a1.4 1.4 0 0 0-.66-1.71l-.24-.14a2.57 2.57 0 0 1 0-4.48l.24-.14a1.4 1.4 0 0 0 .66-1.72 11.08 11.08 0 0 0-1.55-2.69 1.4 1.4 0 0 0-1.82-.3l-.25.15a2.57 2.57 0 0 1-3.88-2.24v-.28c.01-.7-.46-1.33-1.16-1.43a10.99 10.99 0 0 0-3.1 0c-.7.1-1.17.72-1.17 1.43v.28C9.3 3.75 8.8 4.61 8 5.07Zm6 10.4a4 4 0 1 0-4-6.93 4 4 0 0 0 4 6.92Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'setting');
export default IconComponent;
