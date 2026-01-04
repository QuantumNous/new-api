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
                d="M2 4a1 1 0 0 0-1 1v4.8c0 .46.3.84.73.96.72.23 1.09.77 1.09 1.24 0 .48-.37 1.02-1.1 1.24a1 1 0 0 0-.72.96V19a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1v-4.8a1 1 0 0 0-.71-.96c-.74-.22-1.1-.76-1.1-1.24s.36-1.02 1.1-1.24A1 1 0 0 0 23 9.8V5a1 1 0 0 0-1-1H2Zm1 5.14V6h18v3.14A3.27 3.27 0 0 0 19.18 12c0 1.28.78 2.3 1.82 2.86V18H3v-3.14A3.27 3.27 0 0 0 4.82 12c0-1.28-.78-2.3-1.82-2.86ZM8 9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Zm3 1a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0v-4Zm5-1a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ticket_code_stroked');
export default IconComponent;
