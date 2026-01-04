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
                d="M5 1a2 2 0 0 0-2 2v18c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5Zm0 2h14v18H5V3Zm3 14a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm-1-3a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm3.25-9.5c.28 0 .54.16.67.41l2.5 5a.75.75 0 1 1-1.34.68l-.42-.84H8.84l-.42.84a.75.75 0 1 1-1.34-.68l2.5-5a.75.75 0 0 1 .67-.41Zm0 2.43.66 1.32H9.6l.66-1.32Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'test_score_stroked');
export default IconComponent;
