import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PathGroup } from '@/types/path';
import { current, isDraft } from 'immer';

// 히스토리 상태 타입 정의
interface PathHistoryState {
    past: PathGroup[][];
    present: PathGroup[];
    future: PathGroup[][];
    maxHistorySize: number;
    lastActionTimestamp: number;
}

// 초기 상태
const initialState: PathHistoryState = {
    past: [],
    present: [],
    future: [],
    maxHistorySize: 50,
    lastActionTimestamp: 0,
};

// 유틸리티 함수들
const createDeepCopy = (pathGroups: PathGroup[]): PathGroup[] => {
    return pathGroups.map(group => ({
        ...group,
        segments: group.segments.map(segment => ({ ...segment }))
    }));
};

const trimHistoryArray = (array: PathGroup[][], maxSize: number): PathGroup[][] => {
    return array.length > maxSize ? array.slice(-maxSize) : array;
};

const arePathGroupsEqual = (groups1: PathGroup[], groups2: PathGroup[]): boolean => {
    if (groups1.length !== groups2.length) return false;

    return groups1.every((group1, index) => {
        const group2 = groups2[index];
        if (!group2 || group1.id !== group2.id) return false;

        // PathGroup의 주요 속성들 비교
        const keysToCompare: (keyof PathGroup)[] = [
            'id', 'name', 'color', 'visible', 'tool', 'speed', 'power', 'passes'
        ];

        const groupPropsEqual = keysToCompare.every(key => group1[key] === group2[key]);

        if (!groupPropsEqual) return false;

        // Segments 비교
        if (group1.segments.length !== group2.segments.length) return false;

        return group1.segments.every((seg1, segIndex) => {
            const seg2 = group2.segments[segIndex];
            if (!seg2 || seg1.id !== seg2.id) return false;

            // 주요 segment 속성들만 비교
            return seg1.type === seg2.type &&
                seg1.x === seg2.x &&
                seg1.y === seg2.y;
        });
    });
};

const pathHistorySlice = createSlice({
    name: 'pathHistory',
    initialState,
    reducers: {
        undo: (state) => {
            if (state.past.length === 0) {
                console.warn('Path 히스토리: 되돌릴 수 있는 작업이 없습니다.');
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
                console.warn('Path 히스토리: 다시 실행할 수 있는 작업이 없습니다.');
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

        setPresent: (state, action: PayloadAction<PathGroup[]>) => {
            const newPathGroups = action.payload;
            const currentPathGroups = isDraft(state.present) ? current(state.present) : state.present;

            // 빠른 레퍼런스 비교
            if (newPathGroups === currentPathGroups) {
                return;
            }

            // 구조적 동일성 검사 (성능 최적화됨)
            if (arePathGroupsEqual(currentPathGroups, newPathGroups)) {
                return;
            }

            // 히스토리에 현재 상태 추가
            state.past = [...state.past, createDeepCopy(currentPathGroups)];
            state.present = createDeepCopy(newPathGroups);
            state.future = []; // 새로운 작업 시 future 초기화
            state.lastActionTimestamp = Date.now();

            // past 배열 크기 제한
            if (state.past.length > state.maxHistorySize) {
                state.past = state.past.slice(-state.maxHistorySize);
            }
        },

        resetHistory: (state, action: PayloadAction<PathGroup[]>) => {
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
            console.log('Path 히스토리가 일시 정지되었습니다.');
        },

        resumeHistory: (state) => {
            console.log('Path 히스토리가 재개되었습니다.');
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
} = pathHistorySlice.actions;

export default pathHistorySlice.reducer;

// 타입 내보내기
export type { PathHistoryState };

// 셀렉터 함수들
export const pathHistorySelectors = {
    canUndo: (state: { pathHistory: PathHistoryState }) => state.pathHistory.past.length > 0,
    canRedo: (state: { pathHistory: PathHistoryState }) => state.pathHistory.future.length > 0,
    getHistoryStats: (state: { pathHistory: PathHistoryState }) => ({
        pastCount: state.pathHistory.past.length,
        futureCount: state.pathHistory.future.length,
        maxSize: state.pathHistory.maxHistorySize,
        lastAction: state.pathHistory.lastActionTimestamp,
    }),
};