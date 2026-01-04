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
                d="M8 1c2.5 0 3.19.3 4.15.68L13 2c1.5.5 3 1 5 1 .89 0 1.78-.2 2.5-.42.7-.22 1.5.3 1.5 1.04v10.76c0 .38-.21.73-.56.87l-.3.12c-.78.28-1.96.63-3.14.63-2 0-3.5-.5-5-1-.31-.1-.58-.2-.84-.3-.98-.39-1.79-.7-4.16-.7-1.27 0-3.27.3-4 .5V21a1 1 0 0 1-.84.99h-.04a1 1 0 0 1-.24 0h-.04A1 1 0 0 1 2 21V3.58c0-.36.2-.69.51-.85C3.57 2.18 6.08 1 8 1Zm0 2c-.61 0-1.46.2-2.38.54-.6.22-1.17.47-1.62.68v8.37l.46-.13C5.36 12.21 6.54 12 8 12c1.27 0 2.2.08 3 .24.8.17 1.39.4 1.88.59l.75.27c1.5.5 2.73.9 4.37.9.68 0 1.4-.17 2-.36V4.78c-.61.13-1.3.22-2 .22-2.36 0-4.13-.6-5.63-1.1l-.95-.35c-.5-.2-.76-.3-1.17-.39a8.82 8.82 0 0 0-1.46-.15L8 3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'flag_stroked');
export default IconComponent;
