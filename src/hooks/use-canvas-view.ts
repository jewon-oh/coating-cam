// src/hooks/use-canvas-view.ts

import { useState, useEffect, useCallback } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';

export const useCanvasView = () => {
    // useState의 초기값 함수를 사용하여, 초기 렌더링 시에만 window 객체에 접근합니다.
    const [canvasSize, setCanvasSize] = useState(() => {
        if (typeof window !== 'undefined') {
            return { width: window.innerWidth - 80, height: window.innerHeight };
        }
        return { width: 0, height: 0 };
    });

    // 초기 렌더링 시 원점이 화면 중앙에 오도록 stage.x, stage.y를 설정합니다.
    const [stage, setStage] = useState(() => {
        if (typeof window !== 'undefined') {
            return {
                scale: 1,
                x: (window.innerWidth - 80) / 2, // 캔버스 너비의 절반
                y: window.innerHeight / 2,      // 캔버스 높이의 절반
            };
        }
        return { scale: 1, x: 0, y: 0 };
    });

    // 창 크기 변경 시 캔버스 크기와 스테이지 위치를 업데이트하는 Effect
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth - 80;
            const newHeight = window.innerHeight;
            setCanvasSize({ width: newWidth, height: newHeight });

            // 창 크기가 변해도 원점이 중앙을 유지하도록 x, y 위치를 업데이트합니다.
            setStage(prev => ({
                ...prev,
                x: newWidth / 2,
                y: newHeight / 2
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Zoom Handler
    const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const scaleBy = 1.05;
        const stageNode = e.target.getStage();
        if (!stageNode) return;

        const oldScale = stageNode.scaleX();
        const pointer = stageNode.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stageNode.x()) / oldScale,
            y: (pointer.y - stageNode.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        setStage({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    }, []);

    return { stage, setStage, canvasSize, handleWheel };
};