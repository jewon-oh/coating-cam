import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
    undo as shapeUndo,
    redo as shapeRedo,
    resetHistory as shapeResetHistory,
    clearHistory as shapeClearHistory,
} from '@/store/slices/shape-history-slice';
import { setAllShapes } from '@/store/slices/shape-slice';
import type { RootState } from '@/store/store';

export const historySyncListener = createListenerMiddleware();

// Shape 히스토리 동기화
historySyncListener.startListening({
    matcher: isAnyOf(shapeUndo, shapeRedo, shapeResetHistory, shapeClearHistory),
    effect: async (_action, api) => {
        const state = api.getState() as RootState;
        const present = state.history?.present;

        if (Array.isArray(present)) {
            const clonedShapes = present.map(s => ({ ...s }));
            api.dispatch(setAllShapes(clonedShapes));
        } else {
            api.dispatch(setAllShapes([]));
        }
    },
});
