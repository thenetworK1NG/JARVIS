/// <reference types="react" />
import { FlexboxProps } from 'react-layout-kit';
import { type GridBackgroundProps } from './index';
export interface GridShowcaseProps extends FlexboxProps {
    backgroundColor?: GridBackgroundProps['backgroundColor'];
    innerProps?: FlexboxProps;
}
declare const GridShowcase: import("react").NamedExoticComponent<GridShowcaseProps>;
export default GridShowcase;
