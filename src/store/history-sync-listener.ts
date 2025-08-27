import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { undo, redo,  resetHistory, clearHistory } from '@/store/slices/history-slice';
import { setAllShapes } from '@/store/slices/shapes-slice';
import { setPathGroups } from '@/store/slices/path-slice';

export const historySyncListener = createListenerMiddleware();

historySyncListener.startListening({
    matcher: isAnyOf(undo, redo, resetHistory, clearHistory),
    effect: async (_action, api) => {
        const state: any = api.getState();
        const present = state.history?.present || { shapes: [], paths: [] };

        // 깊은 복사로 참조 공유 방지
        const clonedShapes = (present.shapes || []).map((s: any) => ({ ...s }));
        const clonedPaths = (present.paths || []).map((g: any) => ({
            ...g,
            segments: (g.segments || []).map((seg: any) => ({ ...seg })),
        }));

        api.dispatch(setAllShapes(clonedShapes));
        api.dispatch(setPathGroups(clonedPaths));
    },
});