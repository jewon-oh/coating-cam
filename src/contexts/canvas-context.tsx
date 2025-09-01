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
    stage: StageState;
    setStage: (updater: React.SetStateAction<StageState>) => void;

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

// 기본 줌 레벨 상수 추가
const DEFAULT_ZOOM_LEVEL = 2; // 원하는 기본 배율로 설정 (1.5배, 2배, 3배 등)

const DEFAULT_STAGE_STATE: StageState = {
    scaleX: -DEFAULT_ZOOM_LEVEL, // X축 반전과 함께 확대
    scaleY: DEFAULT_ZOOM_LEVEL,  // Y축 확대
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

// === Context ===
const CanvasContext = createContext<CanvasContextValue | null>(null);

// === 커스텀 훅: 스테이지 상태 관리 ===
function useStageState() {
    const [stage, setStageState] = useState<StageState>(DEFAULT_STAGE_STATE);

    const setStage = useCallback<React.Dispatch<React.SetStateAction<StageState>>>((updater) => {
        setStageState((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;

            // scale 필드 동기화 (실제 확대/축소 배율)
            const syncedNext = {
                ...next,
                scale: Math.abs(next.scaleX) // scaleX의 절댓값을 scale로 사용
            };

            // 불필요한 상태 업데이트 방지
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

            // 높은 배율에서 더 좋은 초기 위치 설정
            const zoomLevel = Math.abs(prev.scaleX);

            // 원점(0,0)이 보이도록 초기 위치 설정
            // scaleX가 -1일 때: 우상단이 원점이므로 살짝 좌하단으로 이동
            const offsetX = width * (0.8 / zoomLevel);  // 배율에 따라 오프셋 조정
            const offsetY = height * (0.2 / zoomLevel); // 배율에 따라 오프셋 조정

            return {
                ...prev,
                width,
                height,
                x: offsetX,
                y: offsetY
            };
        });
    }, [setStage]);

    return { stage, setStage, resetStage, updateStageSize };
}

// === 커스텀 훅: 로딩 상태 관리 ===
function useLoadingState() {
    const [loading, setLoadingState] = useState<LoadingState>(DEFAULT_LOADING_STATE);

    // 상태 업데이트를 렌더링과 분리하기 위해 비동기 호출로 처리
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

    return {
        isCanvasFocused,
        handleCanvasFocus,
        handleCanvasBlur
    };
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

            // 크기가 0보다 클 때만 상태 업데이트를 진행하여 사라지는 현상 방지
            if (width > 0 && height > 0) {
                // 스테이지 상태 업데이트
                updateStageSize(width, height);

                // Konva 스테이지 크기 업데이트
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
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                animationFrameId = requestAnimationFrame(updateSize);
            });

            resizeObserver.observe(canvasContainerRef.current);
        };

        initializeObserver();

        // 윈도우 리사이즈 폴백
        const handleWindowResize = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(updateSize);
        };

        window.addEventListener('resize', handleWindowResize);

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [canvasContainerRef, stageRef, updateStageSize]);
}

// === Provider 컴포넌트 ===
export function CanvasProvider({ children }: { children: React.ReactNode }) {
    // 참조 생성
    const stageRef = useRef<Konva.Stage>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    // 상태 관리 훅들
    const { stage, setStage, resetStage, updateStageSize } = useStageState();
    const { loading, setLoading } = useLoadingState();
    const { isCanvasFocused, handleCanvasFocus, handleCanvasBlur } = useCanvasFocusState();

    // 리사이즈 관리
    useCanvasResize(canvasContainerRef, stageRef, updateStageSize);

    // Context 값 메모이제이션
    const contextValue = useMemo<CanvasContextValue>(() => ({
        stageRef,
        canvasContainerRef,
        stage,
        setStage,
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
        setLoading({
            isLoading: true,
            message: message || '로딩 중...'
        });
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