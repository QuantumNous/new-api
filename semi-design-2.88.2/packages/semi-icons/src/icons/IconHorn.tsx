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
                d="M18.2 16.88c.45-.05.64-.8.64-.8s.52-1.65-.04-7.13c-.56-5.47-1.57-6.94-1.57-6.94s-.36-.7-.8-.64c-.6.06-1.12.46-1.76 1.28-.65.82-2.45 3.13-6.23 3.56-.46.03-.92.1-1.37.15l-.68.08A2.93 2.93 0 0 0 3.86 8.7l-.16.01a1.95 1.95 0 1 0 .6 3.85 2.93 2.93 0 0 0 2.97 1.64l.68-.09c.46-.06.91-.11 1.37-.15a8.89 8.89 0 0 1 6.83 2.01c.82.73 1.22 1 2.04.91Z"
                fill="currentColor"
            />
            <path
                d="M22.88 8.49a2.93 2.93 0 0 1-1.64 2.97c-.48.23-.98-.17-1.04-.7 0 0-.04-.98-.16-1.96-.12-.97-.29-1.92-.29-1.92s.34-1.04.86-.92a2.93 2.93 0 0 1 2.27 2.53Z"
                fill="currentColor"
            />
            <path
                d="M12.03 19.57c-.19-.6-1.08-3.15-1.42-3.47-.32-.3-.71-.25-1.1-.2a8.7 8.7 0 0 1-.5.07c-.48.06-.9.12-1.52.17-.58.04-1.11.03-1.63-.1a52.44 52.44 0 0 0 3.26 5.12c.44.62 1.25.84 1.95.56.85-.34 1.3-1.04.96-2.15Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'horn');
export default IconComponent;
