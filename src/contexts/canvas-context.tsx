// TypeScript React
import React, { createContext, useContext, useRef, RefObject, useState, useEffect, useMemo, useCallback } from 'react';
import type Konva from 'konva';

type CanvasSize = { width: number; height: number };
type StageState = { scale: number; x: number; y: number };

interface CanvasContextType {
    stageRef: RefObject<Konva.Stage|null>
    canvasContainerRef: RefObject<HTMLDivElement|null>;

    canvasSize: CanvasSize;
    stage: StageState;
    setStage: React.Dispatch<React.SetStateAction<StageState>>;

    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    loadingMessage: string;
    setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
    const stageRef = useRef<Konva.Stage>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
    const [stage, setStageState] = useState<StageState>({ scale: 1, x: 0, y: 0 });

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('로딩 중...');

    // setStage with epsilon guard to avoid unnecessary state updates
    const setStage = useCallback<React.Dispatch<React.SetStateAction<StageState>>>((updater) => {
        setStageState((prev) => {
            const next = typeof updater === 'function' ? (updater as (p: StageState) => StageState)(prev) : updater;
            const EPS_SCALE = 1e-4;
            const EPS_POS = 0.25; // quarter pixel to reduce thrash
            const noChange =
                Math.abs((next.scale ?? 1) - (prev.scale ?? 1)) < EPS_SCALE &&
                Math.abs((next.x ?? 0) - (prev.x ?? 0)) < EPS_POS &&
                Math.abs((next.y ?? 0) - (prev.y ?? 0)) < EPS_POS;
            return noChange ? prev : next;
        });
    }, []);

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

    const providerValue = useMemo<CanvasContextType>(() => ({
        stageRef,
        canvasContainerRef,
        canvasSize,
        stage,
        setStage,
        isLoading,
        setIsLoading,
        loadingMessage,
        setLoadingMessage,
    }), [canvasSize, isLoading, loadingMessage, setStage, stage]);

    return (
        <CanvasContext.Provider value={providerValue}>
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