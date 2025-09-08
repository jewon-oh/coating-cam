import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import {
    undo as shapeUndo,
    redo as shapeRedo,
    setPresent,
    resetHistory as shapeResetHistory,
    clearHistory as shapeClearHistory,
} from '@/store/slices/shape-history-slice';
import { addShape, setAllShapes } from '@/store/slices/shape-slice';
import type { RootState } from '@/store/store';

export const historySyncListener = createListenerMiddleware();

// Shape 히스토리 동기화
historySyncListener.startListening({
    matcher: isAnyOf(shapeUndo, shapeRedo, shapeResetHistory, shapeClearHistory, addShape),
    effect: async (action, api) => {
        const state = api.getState() as RootState;

        if (addShape.match(action)) {
            // addShape 액션이 디스패치된 후의 현재 shapes 상태를 가져와 히스토리에 기록
            const currentShapes = state.shapes.shapes;
            api.dispatch(setPresent(currentShapes));
        } else {
            // undo, redo 등 히스토리 관련 액션 처리
            const present = state.history?.present;

            if (Array.isArray(present)) {
                const clonedShapes = present.map(s => ({ ...s }));
                api.dispatch(setAllShapes(clonedShapes));
            } else {
                api.dispatch(setAllShapes([]));
            }
        }
    },
});
