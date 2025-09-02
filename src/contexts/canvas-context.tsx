import React, { createContext, useContext, useRef, RefObject, useState, useEffect, useMemo, useCallback } from 'react';
import type Konva from 'konva';

// === 타입 정의 ===
export interface StageState {
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number; // 편의성을 위한 추가 필드
}

interface LoadingState {
    isLoading: boolean;
    message: string;
}

interface CanvasContextValue {
    // 캔버스 참조
    stageRef: RefObject<Konva.Stage|null>;
    canvasContainerRef: RefObject<HTMLDivElement|null>;

    // 스테이지 상태
    stageState: StageState;
    setStageState: (updater: React.SetStateAction<StageState>) => void;

    // 로딩 상태
    loading: LoadingState;
    setLoading: (loading: Partial<LoadingState>) => void;

    // 포커스 상태
    isCanvasFocused: boolean;
    handleCanvasFocus: () => void;
    handleCanvasBlur: () => void;

    // 유틸리티 메서드
    resetStage: () => void;
    updateStageSize: (width: number, height: number) => void;
}

// === 상수 ===
const EPSILON = {
    SCALE: 1e-4,
    POSITION: 0.25, // quarter pixel to reduce thrash
} as const;

const DEFAULT_ZOOM_LEVEL = 2;

const DEFAULT_STAGE_STATE: StageState = {
    scaleX: -DEFAULT_ZOOM_LEVEL,
    scaleY: DEFAULT_ZOOM_LEVEL,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scale: DEFAULT_ZOOM_LEVEL,
} as const;

const DEFAULT_LOADING_STATE: LoadingState = {
    isLoading: false,
    message: '로딩 중...',
} as const;

const STAGE_STATE_STORAGE_KEY = 'canvasStageState';

// === Context ===
const CanvasContext = createContext<CanvasContextValue | null>(null);

// === 커스텀 훅: 스테이지 상태 관리 ===
function useStageState() {
    const [stage, setStageState] = useState<StageState>(() => {
        try {
            const savedStateJSON = localStorage.getItem(STAGE_STATE_STORAGE_KEY);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                return {
                    ...DEFAULT_STAGE_STATE,
                    ...savedState,
                    width: 0, // width/height는 항상 컨테이너에 맞춰 재계산
                    height: 0,
                };
            }
        } catch (e) {
            console.error("localStorage에서 캔버스 상태를 불러오지 못했습니다.", e);
        }
        return DEFAULT_STAGE_STATE;
    });

    useEffect(() => {
        try {
            const { width, height, ...stateToSave } = stage;
            localStorage.setItem(STAGE_STATE_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("localStorage에 캔버스 상태를 저장하지 못했습니다.", e);
        }
    }, [stage]);

    const setStage = useCallback<React.Dispatch<React.SetStateAction<StageState>>>((updater) => {
        setStageState((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            const syncedNext = { ...next, scale: Math.abs(next.scaleX) };

            const hasSignificantChange = (
                Math.abs(syncedNext.scaleX - prev.scaleX) >= EPSILON.SCALE ||
                Math.abs(syncedNext.scaleY - prev.scaleY) >= EPSILON.SCALE ||
                Math.abs(syncedNext.x - prev.x) >= EPSILON.POSITION ||
                Math.abs(syncedNext.y - prev.y) >= EPSILON.POSITION ||
                syncedNext.width !== prev.width ||
                syncedNext.height !== prev.height
            );

            return hasSignificantChange ? syncedNext : prev;
        });
    }, []);

    const resetStage = useCallback(() => {
        setStageState(DEFAULT_STAGE_STATE);
    }, []);

    const updateStageSize = useCallback((width: number, height: number) => {
        setStage(prev => {
            if (prev.width === width && prev.height === height) {
                return prev;
            }

            let newX = prev.x;
            let newY = prev.y;

            const isInitialSizing = prev.width === 0 && prev.height === 0;
            const isDefaultPosition = prev.x === DEFAULT_STAGE_STATE.x && prev.y === DEFAULT_STAGE_STATE.y;

            if (isInitialSizing && isDefaultPosition) {
                const zoomLevel = Math.abs(prev.scaleX);
                newX = width * (0.8 / zoomLevel);
                newY = height * (0.2 / zoomLevel);
            }

            return { ...prev, width, height, x: newX, y: newY };
        });
    }, [setStage]);

    return { stage, setStage, resetStage, updateStageSize };
}

// === 커스텀 훅: 로딩 상태 관리 ===
function useLoadingState() {
    const [loading, setLoadingState] = useState<LoadingState>(DEFAULT_LOADING_STATE);

    const setLoading = useCallback((partialLoading: Partial<LoadingState>) => {
        setTimeout(() => {
            setLoadingState(prev => ({ ...prev, ...partialLoading }));
        }, 0);
    }, []);

    return { loading, setLoading };
}

// === 커스텀 훅: 포커스 상태 관리 ===
function useCanvasFocusState() {
    const [isCanvasFocused, setIsCanvasFocused] = useState(false);

    const handleCanvasFocus = useCallback(() => {
        setIsCanvasFocused(true);
    }, []);

    const handleCanvasBlur = useCallback(() => {
        setIsCanvasFocused(false);
    }, []);

    return { isCanvasFocused, handleCanvasFocus, handleCanvasBlur };
}

// === 커스텀 훅: 리사이즈 관리 ===
function useCanvasResize(
    canvasContainerRef: RefObject<HTMLDivElement|null>,
    stageRef: RefObject<Konva.Stage|null>,
    updateStageSize: (width: number, height: number) => void
) {
    useEffect(() => {
        let resizeObserver: ResizeObserver | null = null;
        let animationFrameId: number | null = null;

        const updateSize = () => {
            const container = canvasContainerRef.current;
            const stage = stageRef.current;

            if (!container) return;

            const rect = container.getBoundingClientRect();
            const width = Math.max(0, Math.floor(rect.width));
            const height = Math.max(0, Math.floor(rect.height));

            if (width > 0 && height > 0) {
                updateStageSize(width, height);
                if (stage) {
                    if (stage.width() !== width) stage.width(width);
                    if (stage.height() !== height) stage.height(height);
                }
            }
        };

        const initializeObserver = () => {
            if (!canvasContainerRef.current) {
                animationFrameId = requestAnimationFrame(initializeObserver);
                return;
            }

            updateSize();

            resizeObserver = new ResizeObserver(() => {
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                animationFrameId = requestAnimationFrame(updateSize);
            });

            resizeObserver.observe(canvasContainerRef.current);
        };

        initializeObserver();

        const handleWindowResize = () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(updateSize);
        };

        window.addEventListener('resize', handleWindowResize);

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [canvasContainerRef, stageRef, updateStageSize]);
}

// === Provider 컴포넌트 ===
export function CanvasProvider({ children }: { children: React.ReactNode }) {
    const stageRef = useRef<Konva.Stage>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const { stage, setStage, resetStage, updateStageSize } = useStageState();
    const { loading, setLoading } = useLoadingState();
    const { isCanvasFocused, handleCanvasFocus, handleCanvasBlur } = useCanvasFocusState();

    useCanvasResize(canvasContainerRef, stageRef, updateStageSize);

    const contextValue = useMemo<CanvasContextValue>(() => ({
        stageRef,
        canvasContainerRef,
        stageState: stage,
        setStageState: setStage,
        loading,
        setLoading,
        isCanvasFocused,
        handleCanvasFocus,
        handleCanvasBlur,
        resetStage,
        updateStageSize,
    }), [stage, setStage, loading, setLoading, isCanvasFocused, handleCanvasFocus, handleCanvasBlur, resetStage, updateStageSize]);

    return (
        <CanvasContext.Provider value={contextValue}>
            {children}
        </CanvasContext.Provider>
    );
}

// === 훅 ===
export function useCanvas() {
    const context = useContext(CanvasContext);
    if (!context) {
        throw new Error('useCanvas must be used within CanvasProvider');
    }
    return context;
}

// === 편의 훅들 ===
export function useCanvasLoading() {
    const { loading, setLoading } = useCanvas();

    const startLoading = useCallback((message?: string) => {
        setLoading({ isLoading: true, message: message || '로딩 중...' });
    }, [setLoading]);

    const stopLoading = useCallback(() => {
        setLoading({ isLoading: false });
    }, [setLoading]);

    return {
        isLoading: loading.isLoading,
        loadingMessage: loading.message,
        startLoading,
        stopLoading,
        setLoading,
    };
}