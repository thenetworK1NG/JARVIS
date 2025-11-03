/// <reference types="react" />
interface PreviewProps {
    precent?: string;
    svg: string;
    title: string;
}
declare const Preview: import("react").ForwardRefExoticComponent<PreviewProps & import("react").RefAttributes<HTMLDivElement>>;
export default Preview;
