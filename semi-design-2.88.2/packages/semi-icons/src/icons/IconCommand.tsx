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
                d="M6.23 5C5.55 5 5 5.55 5 6.23 5 7.2 5.8 8 6.77 8H8V6.5C8 5.67 7.33 5 6.5 5h-.27ZM11 8V6.5A4.5 4.5 0 0 0 6.5 2h-.27A4.23 4.23 0 0 0 2 6.23 4.77 4.77 0 0 0 6.77 11H8v2H6.23A4.23 4.23 0 0 0 2 17.23v.27a4.5 4.5 0 1 0 9 0V16h2v1.5a4.5 4.5 0 1 0 9 0v-.27c0-2.34-1.9-4.23-4.23-4.23H16v-2h1.23A4.77 4.77 0 0 0 22 6.23C22 3.89 20.1 2 17.77 2h-.27A4.5 4.5 0 0 0 13 6.5V8h-2Zm0 3v2h2v-2h-2Zm5-3h1.23C18.2 8 19 7.2 19 6.23 19 5.55 18.45 5 17.77 5h-.27c-.83 0-1.5.67-1.5 1.5V8Zm0 8v1.5a1.5 1.5 0 0 0 3 0v-.27c0-.68-.55-1.23-1.23-1.23H16Zm-8 0H6.23C5.55 16 5 16.55 5 17.23v.27a1.5 1.5 0 0 0 3 0V16Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'command');
export default IconComponent;
