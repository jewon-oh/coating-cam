import { useCallback } from 'react';
import { useSettings } from '@/contexts/settings-context';
import {CoatingType, FillPattern} from "@common/types/coating";

export function useShapeSnapping() {
    const { isSnappingEnabled, pixelsPerMm } = useSettings();

    const snapToGrid = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / pixelsPerMm) * pixelsPerMm : v),
        [isSnappingEnabled, pixelsPerMm]
    );

    const snapPointToGrid = useCallback(
        (p: { x: number; y: number }) => ({ x: snapToGrid(p.x), y: snapToGrid(p.y) }),
        [snapToGrid]
    );

    const snapShapeSize = useCallback(
        (
            size: { width: number; height: number },
            tool: { coatingType: CoatingType; fillPattern?: FillPattern; lineSpacing?: number }
        ) => {
            if (tool.coatingType !== 'fill' || !tool.lineSpacing) {
                return size;
            }

            const lineSpacingPx = tool.lineSpacing * pixelsPerMm;
            if (lineSpacingPx <= 0) return size;

            let { width, height } = size;

            switch (tool.fillPattern) {
                case 'horizontal':
                    height = Math.round(height / lineSpacingPx) * lineSpacingPx;
                    width = snapToGrid(width);
                    break;
                case 'vertical':
                    width = Math.round(width / lineSpacingPx) * lineSpacingPx;
                    height = snapToGrid(height);
                    break;
                case 'concentric':
                default:
                    width = Math.round(width / lineSpacingPx) * lineSpacingPx;
                    height = Math.round(height / lineSpacingPx) * lineSpacingPx;
                    break;
            }
            return { width, height };
        },
        [pixelsPerMm, snapToGrid]
    );
    
    const snapCircleRadius = useCallback((radius: number, tool: { coatingType: CoatingType; lineSpacing?: number }) => {
        if (tool.coatingType !== 'fill' || !tool.lineSpacing) {
            return radius;
        }
        const lineSpacingPx = tool.lineSpacing * pixelsPerMm;
        if (lineSpacingPx <= 0) return radius;

        return Math.round(radius / lineSpacingPx) * lineSpacingPx;
    }, [pixelsPerMm]);


    return {
        snapToGrid,
        snapPointToGrid,
        snapShapeSize,
        snapCircleRadius,
    };
}
