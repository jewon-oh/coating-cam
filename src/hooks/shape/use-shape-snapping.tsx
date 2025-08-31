import { useCallback } from 'react';
import { useSettings } from '@/contexts/settings-context';
import type { ToolState } from '@/store/slices/tool-slice';

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
            tool: { coatingType: ToolState['coatingType']; fillPattern?: ToolState['fillPattern']; lineSpacing?: ToolState['lineSpacing'] }
        ) => {
            if (tool.coatingType !== 'fill' || !tool.lineSpacing) {
                return size;
            }

            const { lineSpacing } = tool;
            let { width, height } = size;

            switch (tool.fillPattern) {
                case 'horizontal':
                    height = Math.round(height / lineSpacing) * lineSpacing;
                    break;
                case 'vertical':
                    width = Math.round(width / lineSpacing) * lineSpacing;
                    break;
                case 'grid': // Assuming 'grid' or other patterns that snap both
                default:
                    width = Math.round(width / lineSpacing) * lineSpacing;
                    height = Math.round(height / lineSpacing) * lineSpacing;
                    break;
            }
            return { width, height };
        },
        []
    );
    
    const snapCircleRadius = useCallback((radius: number, tool: { coatingType: ToolState['coatingType']; lineSpacing?: ToolState['lineSpacing'] }) => {
        if (tool.coatingType !== 'fill' || !tool.lineSpacing) {
            return radius;
        }
        return Math.round(radius / tool.lineSpacing) * tool.lineSpacing;
    }, []);


    return {
        snapToGrid,
        snapPointToGrid,
        snapShapeSize,
        snapCircleRadius,
    };
}
