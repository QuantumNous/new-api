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
                d="M7.42 2.17a1 1 0 0 1 1.41 0l9.43 9.44a1 1 0 0 1 0 1.41l-.02.02-6.7 6.7a2.5 2.5 0 0 1-3.53 0l-5.66-5.66a2.5 2.5 0 0 1 0-3.53l6.01-6.01-.94-.95a1 1 0 0 1 0-1.42Zm2.36 3.78 6.36 6.36-2.18 2.19H5.6l-1.83-1.83a.5.5 0 0 1 0-.71l6-6.01ZM21 19c0 1.1-.67 2-1.5 2s-1.5-.9-1.5-2c0-1.08.66-2.49 1.1-3.31a.44.44 0 0 1 .8 0c.44.82 1.1 2.23 1.1 3.31Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'fill_stroked');
export default IconComponent;
