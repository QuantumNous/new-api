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
                d="M3 4a1 1 0 1 1 0-2h18a1 1 0 1 1 0 2H3Zm3 12a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6Zm1-2h2V8H7v6Zm6 6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v13Zm4-1h-2V8h2v11Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_v_top_stroked');
export default IconComponent;
