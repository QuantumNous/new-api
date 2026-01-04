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
            <path d="M1 8a3 3 0 0 1 3-3h8v14H4a3 3 0 0 1-3-3V8Z" fill="#6A6F7F" />
            <path d="m8 9-3 3 3 3" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8V5Z" fill="#DDE3E8" />
            <path d="m16 9 3 3-3 3" stroke="#AAB2BF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'pagination');
export default IconComponent;
