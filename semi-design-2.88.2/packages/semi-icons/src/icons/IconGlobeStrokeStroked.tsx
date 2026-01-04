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
                d="M12 1a11 11 0 1 1 0 22 11 11 0 0 1 0-22ZM9.5 17c.54 2.41 1.46 4 2.5 4s1.96-1.59 2.5-4h-5Zm-4.98 0a9.03 9.03 0 0 0 3.98 3.3c-.2-.42-.37-.86-.52-1.3-.2-.61-.38-1.28-.52-2H4.52Zm12.02 0c-.14.72-.32 1.39-.52 2-.15.44-.32.88-.53 1.3a9.03 9.03 0 0 0 4-3.3h-2.95Zm.39-7a28.65 28.65 0 0 1-.09 5h3.65a8.98 8.98 0 0 0 .28-5h-3.84Zm-7.85 0a26.56 26.56 0 0 0 .1 5h5.65a25.75 25.75 0 0 0 .1-5H9.07Zm-5.85 0a9.02 9.02 0 0 0 .28 5h3.65a27.95 27.95 0 0 1-.09-5H3.23Zm12.26-6.3c.2.42.38.86.53 1.3.3.89.53 1.9.7 3h3.34a9.03 9.03 0 0 0-4.57-4.3ZM12 3c-1.18 0-2.2 2.04-2.69 5h5.38c-.5-2.96-1.51-5-2.69-5Zm-3.5.7A9.03 9.03 0 0 0 3.94 8h3.35c.16-1.1.4-2.11.7-3 .14-.44.31-.88.51-1.3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'globe_stroke_stroked');
export default IconComponent;
