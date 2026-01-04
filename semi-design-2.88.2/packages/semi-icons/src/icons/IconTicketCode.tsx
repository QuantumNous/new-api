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
                d="M21 4a2 2 0 0 1 2 2v3.8a1 1 0 0 1-.71.96c-.74.22-1.1.76-1.1 1.24s.36 1.02 1.1 1.24a1 1 0 0 1 .71.96V18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3.8a1 1 0 0 1 .71-.96c.74-.22 1.1-.76 1.1-1.24 0-.47-.36-1.01-1.08-1.24A1 1 0 0 1 1 9.8V6c0-1.1.9-2 2-2h18ZM8 9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ticket_code');
export default IconComponent;
