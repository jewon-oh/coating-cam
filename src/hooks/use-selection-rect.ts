import { useCallback, useRef, useState } from 'react';
import Konva from 'konva';

export interface SelectionRectState {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function useSelectionRect() {
    const rectRef = useRef<Konva.Rect | null>(null);

    // 임시 도형 생성
    const createTempRect = useCallback((layer: Konva.Layer, x: number, y: number) => {
        if (rectRef.current) {
            rectRef.current.destroy();
            rectRef.current = null;
        }

        const tempRect = new Konva.Rect({
            id: '__selection-rect__',
            x,
            y,
            width: 0,
            height: 0,
            stroke: '#3b82f6',
            strokeWidth: 1,
            fill: 'rgba(59, 130, 246, 0.1)',
            dash: [4, 2],
            listening: false,
        });

        layer.add(tempRect);
        rectRef.current = tempRect;
        layer.batchDraw();
    }, []);

    // 임시 도형 업데이트
    const updateTempRect = useCallback((x: number, y: number, width: number, height: number) => {
        const tempRect = rectRef.current;
        if (!tempRect) return;

        tempRect.setAttrs({ x, y, width, height });
        tempRect.getLayer()?.batchDraw();
    }, []);

    // 임시 도형 제거
    const destroyTempRect = useCallback(() => {
        if (rectRef.current) {
            rectRef.current.destroy();
            rectRef.current = null;
        }
    }, []);

    return {
        rectRef,
        createTempRect,
        updateTempRect,
        destroyTempRect
    };
}