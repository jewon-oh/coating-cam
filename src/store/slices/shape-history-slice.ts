
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomShapeConfig } from '@/types/custom-konva-config';
import { current, isDraft } from 'immer';

// 히스토리 상태 타입 정의
interface HistoryState {
    past: CustomShapeConfig[][];
    present: CustomShapeConfig[];
    future: CustomShapeConfig[][];
    maxHistorySize: number;
    lastActionTimestamp: number;
}

// 초기 상태
const initialState: HistoryState = {
    past: [],
    present: [],
    future: [],
    maxHistorySize: 50,
    lastActionTimestamp: 0,
};

// 유틸리티 함수들
const createDeepCopy = (shapes: CustomShapeConfig[]): CustomShapeConfig[] => {
    return shapes.map(shape => ({ ...shape }));
};

const trimHistoryArray = (array: CustomShapeConfig[][], maxSize: number): CustomShapeConfig[][] => {
    return array.length > maxSize ? array.slice(-maxSize) : array;
};

const areShapesEqual = (shapes1: CustomShapeConfig[], shapes2: CustomShapeConfig[]): boolean => {
    if (shapes1.length !== shapes2.length) return false;

    return shapes1.every((shape1, index) => {
        const shape2 = shapes2[index];
        if (!shape2 || shape1.id !== shape2.id) return false;

        // 주요 속성들만 비교하여 성능 최적화
        const keysToCompare: (keyof CustomShapeConfig)[] = [
            'id', 'type', 'name', 'x', 'y', 'width', 'height', 'radius',
            'rotation', 'scaleX', 'scaleY', 'visible', 'listening', 'parentId'
        ];

        return keysToCompare.every(key => shape1[key] === shape2[key]);
    });
};

const shapeHistorySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        undo: (state) => {
            if (state.past.length === 0) {
                console.warn('히스토리: 되돌릴 수 있는 작업이 없습니다.');
                return;
            }

            const previous = state.past[state.past.length - 1];

            // 상태 업데이트
            state.past = state.past.slice(0, -1);
            state.future = [createDeepCopy(current(state.present)), ...state.future];
            state.present = previous;
            state.lastActionTimestamp = Date.now();

            // future 배열 크기 제한
            if (state.future.length > state.maxHistorySize) {
                state.future = state.future.slice(0, state.maxHistorySize);
            }
        },

        redo: (state) => {
            if (state.future.length === 0) {
                console.warn('히스토리: 다시 실행할 수 있는 작업이 없습니다.');
                return;
            }

            const next = state.future[0];

            // 상태 업데이트
            state.future = state.future.slice(1);
            state.past = [...state.past, createDeepCopy(current(state.present))];
            state.present = next;
            state.lastActionTimestamp = Date.now();

            // past 배열 크기 제한
            if (state.past.length > state.maxHistorySize) {
                state.past = state.past.slice(-state.maxHistorySize);
            }
        },

        setPresent: (state, action: PayloadAction<CustomShapeConfig[]>) => {
            const newShapes = action.payload;
            const currentShapes = isDraft(state.present) ? current(state.present) : state.present;

            // 빠른 레퍼런스 비교
            if (newShapes === currentShapes) {
                return;
            }

            // 구조적 동일성 검사 (성능 최적화됨)
            if (areShapesEqual(currentShapes, newShapes)) {
                return;
            }

            // 히스토리에 현재 상태 추가
            state.past = [...state.past, createDeepCopy(currentShapes)];
            state.present = createDeepCopy(newShapes);
            state.future = []; // 새로운 작업 시 future 초기화
            state.lastActionTimestamp = Date.now();

            // past 배열 크기 제한
            if (state.past.length > state.maxHistorySize) {
                state.past = state.past.slice(-state.maxHistorySize);
            }
        },

        resetHistory: (state, action: PayloadAction<CustomShapeConfig[]>) => {
            state.past = [];
            state.present = createDeepCopy(action.payload);
            state.future = [];
            state.lastActionTimestamp = Date.now();
        },

        setMaxHistorySize: (state, action: PayloadAction<number>) => {
            const newSize = Math.max(1, Math.min(action.payload, 200)); // 1-200 사이로 제한
            state.maxHistorySize = newSize;

            // 기존 히스토리 배열들을 새로운 크기에 맞게 조정
            state.past = trimHistoryArray(state.past, newSize);
            state.future = state.future.length > newSize
                ? state.future.slice(0, newSize)
                : state.future;
        },

        clearHistory: (state) => {
            state.past = [];
            state.future = [];
            state.lastActionTimestamp = Date.now();
        },

        // 배치 작업을 위한 히스토리 일시 정지/재개
        pauseHistory: (state) => {
            // 상태에 플래그를 추가하려면 HistoryState 인터페이스 수정 필요
            console.log('히스토리가 일시 정지되었습니다.');
        },

        resumeHistory: (state) => {
            console.log('히스토리가 재개되었습니다.');
        }
    },
});

// 액션 및 리듀서 내보내기
export const {
    undo,
    redo,
    setPresent,
    resetHistory,
    setMaxHistorySize,
    clearHistory,
    pauseHistory,
    resumeHistory
} = shapeHistorySlice.actions;

export default shapeHistorySlice.reducer;

// 타입 내보내기
export type { HistoryState };

// 셀렉터 함수들
export const historySelectors = {
    canUndo: (state: { history: HistoryState }) => state.history.past.length > 0,
    canRedo: (state: { history: HistoryState }) => state.history.future.length > 0,
    getHistoryStats: (state: { history: HistoryState }) => ({
        pastCount: state.history.past.length,
        futureCount: state.history.future.length,
        maxSize: state.history.maxHistorySize,
        lastAction: state.history.lastActionTimestamp,
    }),
};