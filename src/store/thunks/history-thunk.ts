// src/store/thunks/history-thunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { undo as undoAction, redo as redoAction } from '../slices/history-slice';
import { setAllShapes } from '../slices/shapes-slice';
import type { RootState } from '../store';

export const undoWithSync = createAsyncThunk(
    'history/undoWithSync',
    async (_, { dispatch, getState }) => {
        const state = getState() as RootState;

        if (state.history.past.length > 0) {
            // history 상태 업데이트
            dispatch(undoAction());

            // 업데이트된 상태 가져오기
            const updatedState = getState() as RootState;

            // shapes 상태와 동기화
            dispatch(setAllShapes(updatedState.history.present));

            console.log("Undo 완료:", updatedState.history.present);
        }
    }
);

export const redoWithSync = createAsyncThunk(
    'history/redoWithSync',
    async (_, { dispatch, getState }) => {
        const state = getState() as RootState;

        if (state.history.future.length > 0) {
            // history 상태 업데이트
            dispatch(redoAction());

            // 업데이트된 상태 가져오기
            const updatedState = getState() as RootState;

            // shapes 상태와 동기화
            dispatch(setAllShapes(updatedState.history.present));

            console.log("Redo 완료:", updatedState.history.present);
        }
    }
);