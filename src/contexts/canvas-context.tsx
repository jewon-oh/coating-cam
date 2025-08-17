// TypeScript React
import React, { createContext, useContext, useRef, RefObject, useState, useEffect, useCallback } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface CanvasContextType {
    stageRef: RefObject<Konva.Stage|null>
    canvasContainerRef: RefObject<HTMLDivElement|null>;

    canvasSize: { width: number; height: number };
    stage: { scale: number; x: number; y: number };
    setStage: React.Dispatch<React.SetStateAction<{ scale: number; x: number; y: number }>>;
    handleWheel: (e: KonvaEventObject<WheelEvent>) => void;

    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    loadingMessage: string;
    setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
    const stageRef = useRef<Konva.Stage>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [stage, setStage] = useState({ scale: 1, x: 0, y: 0 });

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('로딩 중...');

    // 리사이즈: ResizeObserver + window.resize 폴백(중복 이펙트 제거)
    useEffect(() => {
        let ro: ResizeObserver | null = null;

        const update = () => {
            const el = canvasContainerRef.current;
            if (!el) return;

            const rect = el.getBoundingClientRect();
            const width = Math.max(0, Math.floor(rect.width));
            const height = Math.max(0, Math.floor(rect.height));

            setCanvasSize(prev => (prev.width === width && prev.height === height) ? prev : { width, height });

            const s = stageRef.current;
            if (s) {
                if (s.width() !== width) s.width(width);
                if (s.height() !== height) s.height(height);
                requestAnimationFrame(() => {
                    s.getLayers().forEach(l => l.batchDraw());
                });
            }
        };

        const tryAttach = () => {
            if (!canvasContainerRef.current) {
                requestAnimationFrame(tryAttach);
                return;
            }
            update();
            ro = new ResizeObserver(() => requestAnimationFrame(update));
            ro.observe(canvasContainerRef.current!);
        };

        tryAttach();

        const onWinResize = () => requestAnimationFrame(update);
        window.addEventListener('resize', onWinResize);

        return () => {
            window.removeEventListener('resize', onWinResize);
            if (ro) ro.disconnect();
        };
    }, []);

    // 휠 줌: rAF 스로틀 + 스케일 클램프
    const rafIdRef = useRef<number | null>(null);
    const schedule = (fn: () => void) => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
            fn();
            rafIdRef.current = null;
        });
    };
    useEffect(() => () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    }, []);

    const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const s = e.target.getStage();
        if (!s) return;

        const pointer = s.getPointerPosition();
        if (!pointer) return;

        const scaleBy = 1.05;
        const oldScale = s.scaleX();
        const direction = e.evt.deltaY > 0 ? 1 : -1;
        const unclamped = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        const MIN_SCALE = 0.1;
        const MAX_SCALE = 8;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, unclamped));
        if (Math.abs(newScale - oldScale) < 1e-4) return;

        const mousePointTo = {
            x: (pointer.x - s.x()) / oldScale,
            y: (pointer.y - s.y()) / oldScale,
        };

        schedule(() => {
            setStage({
                scale: newScale,
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            });
        });
    }, []);

    return (
        <CanvasContext.Provider value={{
            stageRef,
            canvasContainerRef,
            canvasSize,
            stage,
            setStage,
            handleWheel,
            isLoading,
            setIsLoading,
            loadingMessage,
            setLoadingMessage
        }}>
            {children}
        </CanvasContext.Provider>
    );
}

export function useCanvas() {
    const context = useContext(CanvasContext);
    if (!context) {
        throw new Error('useCanvas must be used within CanvasProvider');
    }
    return context;
}