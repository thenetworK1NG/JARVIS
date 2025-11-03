import { Application } from '@splinetool/runtime';
import type { SplineEvent } from '@splinetool/runtime';
import { type HTMLAttributes } from 'react';
export interface SplineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onLoad' | 'onMouseDown' | 'onMouseUp' | 'onMouseHover' | 'onKeyDown' | 'onKeyUp' | 'onWheel'> {
    onFollow?: (e: SplineEvent) => void;
    onKeyDown?: (e: SplineEvent) => void;
    onKeyUp?: (e: SplineEvent) => void;
    onLoad?: (e: Application) => void;
    onLookAt?: (e: SplineEvent) => void;
    onMouseDown?: (e: SplineEvent) => void;
    onMouseHover?: (e: SplineEvent) => void;
    onMouseUp?: (e: SplineEvent) => void;
    onStart?: (e: SplineEvent) => void;
    onWheel?: (e: SplineEvent) => void;
    renderOnDemand?: boolean;
    scene: string;
}
declare const Spline: import("react").ForwardRefExoticComponent<SplineProps & import("react").RefAttributes<HTMLDivElement>>;
export default Spline;
export { type SPEObject, type SplineEvent, type SplineEventName } from '@splinetool/runtime';
