import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {PathGroup} from "@/types/gcode-path";

interface CombinedState {
    shapes: CustomShapeConfig[];  // Shape의 상태 (CustomShapeConfig[])
    paths: PathGroup[];   // Path의 상태 (PathGroup[])
}

// 히스토리 상태 타입 정의
interface HistoryState {
    past: CombinedState[];
    present: CombinedState;
    future: CombinedState[];
    maxHistorySize: number;
    lastActionTimestamp: number;
}

const initialState: HistoryState = {
    past: [],
    present: {
        shapes: [],
        paths: [],
    },
    future: [],
    maxHistorySize: 50,
    lastActionTimestamp: 0,
};

const historySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        undo: (state) => {
            if (state.past.length === 0) {
                console.warn('히스토리: 되돌릴 수 있는 작업이 없습니다.');
                return;
            }

            const previous = state.past.pop();
            state.future.unshift(state.present);
            if (previous) {
                state.present = previous;
            }
            state.lastActionTimestamp = Date.now();
        },

        redo: (state) => {
            if (state.future.length === 0) {
                console.warn('히스토리: 다시 실행할 수 있는 작업이 없습니다.');
                return;
            }

            const next = state.future.shift();
            state.past.push(state.present);
            if (next) {
                state.present = next;
            }
            state.lastActionTimestamp = Date.now();
        },

        // 현재 상태 저장
        setPresent: (state, action: PayloadAction<CombinedState>) => {
            const newPresent = action.payload;

            // 현재 상태를 히스토리에 추가
            state.past.push({ ...state.present });
            state.present = newPresent;
            state.future = []; // 새로운 작업 시 future 초기화

            // past 배열 크기 제한
            if (state.past.length > state.maxHistorySize) {
                state.past = state.past.slice(-state.maxHistorySize);
            }

            state.lastActionTimestamp = Date.now();
        },

        resetHistory: (state, action: PayloadAction<CombinedState>) => {
            state.past = [];
            state.present = action.payload;
            state.future = [];
            state.lastActionTimestamp = Date.now();
        },

        clearHistory: (state) => {
            state.past = [];
            state.future = [];
            state.present = { shapes: [], paths: [] };
            state.lastActionTimestamp = Date.now();
        },
    },
});

export const { undo, redo, setPresent, resetHistory, clearHistory } = historySlice.actions;
export default historySlice.reducer;