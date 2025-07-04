import React, {
    createContext, ReactNode, useMemo, useState, useCallback, useEffect, useContext, useRef,
} from 'react';
import {KonvaShape, useShapeContext} from '@/contexts/shape-context'; // ShapesHistory 대신 KonvaShape 사용

// --- 타입 정의 ---
// ShapesHistory는 KonvaShape[]와 동일하다고 가정합니다.
type ShapesHistory = KonvaShape[];

interface IHistoryContext {
    history: ShapesHistory[];
    index: number;
    canRedo: boolean;
    canUndo: boolean;
    redo: () => void;
    undo: () => void;
    saveHistory: (state: ShapesHistory) => void;
    resetHistory: (initialState: ShapesHistory) => void; // Add reset function
}

// --- useHistory 커스텀 훅 ---
const useHistoryLogic = () => {
    const [history, setHistory] = useState<ShapesHistory[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    const saveHistory = useCallback((state: ShapesHistory) => {
        setHistory((prevHistory) => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            return [...newHistory, state];
        });
        setHistoryIndex((prevIndex) => prevIndex + 1);
    }, [historyIndex]);

    const resetHistory = useCallback((initialState: ShapesHistory) => {
        setHistory([initialState]);
        setHistoryIndex(0);
    }, []);

    const canUndo = useMemo(() => historyIndex > 0, [historyIndex]);
    const canRedo = useMemo(() => historyIndex < history.length - 1, [history, historyIndex]);
    const currentHistory = useMemo(() => history[historyIndex], [history, historyIndex]);

    const undo = useCallback(() => {
        if (canUndo) setHistoryIndex((prev) => prev - 1);
    }, [canUndo]);

    const redo = useCallback(() => {
        if (canRedo) setHistoryIndex((prev) => prev + 1);
    }, [canRedo]);

    return {
        history,
        index: historyIndex,
        currentHistory,
        saveHistory,
        resetHistory, // Expose reset function
        canUndo,
        canRedo,
        undo,
        redo,
    };
};

// --- Context 생성 ---
const HistoryContext = createContext<IHistoryContext | undefined>(undefined); // undefined 허용

// --- Provider 컴포넌트 ---
const HistoryProvider = ({ children }: {children: ReactNode}) => {
    // useKonvaShapes를 여기서 사용합니다.
    const { shapes: currentShapes, setAllShapes } = useShapeContext();
    const historyState = useHistoryLogic(); // useHistoryLogic 훅 사용

    // 초기화: HistoryProvider가 마운트될 때 (즉, KonvaShapeProvider 내에서)
    // 현재 (대부분 빈) shapes 상태를 히스토리의 첫 번째 엔트리로 기록합니다.
    // 이 이펙트는 단 한 번만 실행되도록 합니다.
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            historyState.saveHistory(JSON.parse(JSON.stringify(currentShapes)));
            console.log("HistoryProvider Initialized ONCE with initial shapes:", currentShapes);
            isFirstRender.current = false;
        }
    }, [currentShapes, historyState]); // 빈 의존성 배열로 마운트 시 한 번만 실행

    // currentHistory가 변경될 때마다 KonvaShapeContext의 shapes를 업데이트
    useEffect(() => {
        // historyIndex가 -1일 때는 currentHistory가 undefined일 수 있으므로 체크
        if (historyState.index !== -1 && historyState.currentHistory) {
            // 이 업데이트가 pushHistory를 유발하지 않도록 KonvaShapeContext는 단순히 상태를 설정해야 합니다.
            // 그리고 HistoryContext의 saveHistory는 isUndoingRedoing 플래그를 사용하지 않습니다.
            // 따라서, saveHistory가 자동으로 호출되는 것을 막으려면
            // KonvaShapeContext의 setAllShapes에 플래그를 넘겨주거나,
            // CanvasStage에서 setAllShapes 호출 시 saveHistory를 호출하지 않도록 주의해야 합니다.
            // 현재 구조에서는 CanvasStage에서 saveHistory를 명시적으로 호출하므로 괜찮습니다.
            setAllShapes(historyState.currentHistory);
            console.log("Shapes updated from history. Current index:", historyState.index);
        }
    }, [historyState.currentHistory, historyState.index, setAllShapes]);


    return (
        <HistoryContext.Provider value={historyState}>
            {children}
        </HistoryContext.Provider>
    );
};

// --- 커스텀 훅 (소비자용) ---
const useHistory = () => { // 외부에서 import하여 사용하는 훅
    const context = useContext(HistoryContext);
    if (context === undefined) {
        throw new Error('useHistory must be used within a HistoryProvider');
    }
    return context;
};

export { HistoryContext, HistoryProvider, useHistory };