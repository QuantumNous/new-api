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
                d="M12.05 1a11.1 11.1 0 0 1 3.65.64A11 11 0 0 1 12.05 23h-.08a11.09 11.09 0 0 1-2.46-.29A11 11 0 0 1 12 1h.05Zm-.02 2A9.04 9.04 0 0 0 3 12h5.33a4.84 4.84 0 0 1 4.85 4.82v.08a.8.8 0 0 1-.8.73H9.69c-.52.07-.93.63-.93 1.68 0 .8.67 1.27 1.27 1.47.2.05.4.09.62.12l1.39.1a9 9 0 0 0 8.84-7.54c-.76.5-1.65.79-2.6.79a5.1 5.1 0 0 1-4.67-3.38H9.79c-.62 0-1.14-.5-1.03-1.11.58-3.17 2.72-4.5 5.39-4.46h.01c.17-.24.35-.47.54-.68l.2-.2c.28-.28.27-.74-.02-.95-.9-.3-1.86-.47-2.85-.47Zm-8.8 11a9 9 0 0 0 3.53 5.31c0-.8.16-1.66.64-2.37a2.86 2.86 0 0 1 2.39-1.32h1.12A2.85 2.85 0 0 0 8.33 14h-5.1Zm13.8-9.46c-.11.48-.35.93-.73 1.3a3.5 3.5 0 0 0-.47.57l-.6.92-1.1-.03c-1.01-.02-1.74.23-2.24.6a2.7 2.7 0 0 0-.77.97h3.85l.5 1.27c.53 1.34 1.66 2.11 2.8 2.11.57 0 1.11-.18 1.58-.51 0 0 .6-.39 1.05-1.07a9 9 0 0 0-3.87-6.13Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'globe_stroked');
export default IconComponent;
