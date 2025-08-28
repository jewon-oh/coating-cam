import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
    undo as shapeUndo,
    redo as shapeRedo,
    resetHistory as shapeResetHistory,
    clearHistory as shapeClearHistory,
} from '@/store/slices/shape-history-slice';
import {
    undo as pathUndo,
    redo as pathRedo,
    resetHistory as pathResetHistory,
    clearHistory as pathClearHistory,
} from '@/store/slices/path-history-slice';
import { setAllShapes } from '@/store/slices/shape-slice';
import { setPathGroups } from '@/store/slices/path-slice';
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

// Path 히스토리 동기화
historySyncListener.startListening({
    matcher: isAnyOf(pathUndo, pathRedo, pathResetHistory, pathClearHistory),
    effect: async (_action, api) => {
        const state = api.getState() as RootState;
        const present = state.pathHistory?.present;

        if (Array.isArray(present)) {
            const clonedPaths = present.map(g => ({
                ...g,
                segments: Array.isArray(g.segments) ? g.segments.map(seg => ({ ...seg })) : [],
            }));
            api.dispatch(setPathGroups(clonedPaths));
        } else {
            api.dispatch(setPathGroups([]));
        }
    },
});