import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {AnyNodeConfig} from '@/types/custom-konva-config';
import {castDraft} from "immer";

type HistoryState = {
    past: AnyNodeConfig[][];
    present: AnyNodeConfig[];
    future: AnyNodeConfig[][];
    maxHistorySize: number;
};

const initialState: HistoryState = {
    past: [],
    present: [],
    future: [],
    maxHistorySize: 50,
};

const historySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        undo: (state) => {
            if (state.past.length > 0) {
                const previous = state.past[state.past.length - 1];
                state.past = state.past.slice(0, -1);
                state.future.unshift(state.present);
                state.present = previous;
                if (state.future.length > state.maxHistorySize) {
                    state.future = state.future.slice(0, state.maxHistorySize);
                }
            }
        },
        redo: (state) => {
            if (state.future.length > 0) {
                const next = state.future[0];
                state.future = state.future.slice(1);
                state.past.push(state.present);
                state.present = next;
                if (state.past.length > state.maxHistorySize) {
                    state.past = state.past.slice(1);
                }
            }
        },
        setPresent: (state, action: PayloadAction<AnyNodeConfig[]>) => {
            // 동일 비교: 레퍼런스가 같거나(이미 같은 배열) JSON 비교로 구조가 같은 경우 추가하지 않음
            const currentStateString = JSON.stringify(state.present);
            const newStateString = JSON.stringify(action.payload);
            if (currentStateString !== newStateString) {
                state.past.push([...state.present]); // 안전하게 복사해 저장
                // state.present = [...action.payload]; // 반드시 새 배열로 교체
                state.present = castDraft(action.payload);
                state.future = [];
                if (state.past.length > state.maxHistorySize) {
                    state.past = state.past.slice(1);
                }
            }
        },
        resetHistory: (state, action: PayloadAction<AnyNodeConfig[]>) => {
            state.past = [];
            // state.present = [...action.payload];
            state.present = castDraft(action.payload);
            state.future = [];
        },
        setMaxHistorySize: (state, action: PayloadAction<number>) => {
            state.maxHistorySize = action.payload;
            if (state.past.length > action.payload) {
                state.past = state.past.slice(-action.payload);
            }
            if (state.future.length > action.payload) {
                state.future = state.future.slice(0, action.payload);
            }
        },
    },
});

export const { undo, redo, setPresent, resetHistory, setMaxHistorySize } = historySlice.actions;
export default historySlice.reducer;