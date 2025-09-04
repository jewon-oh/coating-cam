'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { StageState } from '@/contexts/canvas-context';
import Konva from "konva";

export function usePanZoom(setStage: (updater: React.SetStateAction<StageState>) => void) {
    const [isPanning, setIsPanning] = useState(false);
    const rafIdRef = useRef<number | null>(null);

    const stopPan = useCallback((stage: Konva.Stage | null) => {
        if (!stage) return;
        setIsPanning(false);
        stage.draggable(false);
    }, []);

    const startPan = useCallback((stage: Konva.Stage) => {
        setIsPanning(true);
        stage.draggable(true);
        stage.startDrag();
    }, []);

    const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true;

        const stage = e.target.getStage();
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const oldScaleX = stage.scaleX();
        const oldScaleY = stage.scaleY();

        const scaleBy = 1.05;
        const direction = e.evt.deltaY > 0 ? -1 : 1;

        const newScale = direction > 0 ? Math.abs(oldScaleX) * scaleBy : Math.abs(oldScaleX) / scaleBy;
        const clampedScale = Math.max(0.01, Math.min(10, newScale));

        const isXInverted = oldScaleX < 0;
        const newScaleX = isXInverted ? -clampedScale : clampedScale;
        const newScaleY = clampedScale;

        const newX = pointer.x - ((pointer.x - stage.x()) / oldScaleX) * newScaleX;
        const newY = pointer.y - ((pointer.y - stage.y()) / oldScaleY) * newScaleY;

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
            setStage(prev => ({
                ...prev,
                scaleX: newScaleX,
                scaleY: newScaleY,
                x: newX,
                y: newY,
            }));
            rafIdRef.current = null;
        });
    }, [setStage]);

    const updateStagePosition = useCallback((stage: Konva.Stage) => {
        if (isPanning) {
            setStage(prev => ({ ...prev, x: stage.x(), y: stage.y() }));
        }
    }, [isPanning, setStage]);

    useEffect(() => () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    }, []);

    return {
        isPanning,
        startPan,
        stopPan,
        updateStagePosition,
        handleWheel
    };
}