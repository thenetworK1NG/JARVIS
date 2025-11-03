/// <reference types="react" />
import { ImageProps } from 'antd';
import { ImgProps } from "../../types";
declare const Logo3d: import("react").NamedExoticComponent<Omit<ImgProps & ImageProps, "height" | "width" | "src"> & {
    size?: string | number | undefined;
}>;
export default Logo3d;
