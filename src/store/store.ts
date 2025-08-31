// src/store/store.ts
import {configureStore} from '@reduxjs/toolkit';
import shapesReducer from './slices/shape-slice';
import historyReducer from './slices/shape-history-slice';
import toolReducer from './slices/tool-slice';
import gcodeReducer from './slices/gcode-slice';
import {historySyncListener} from '@/store/middleware/history-sync-listener';

// reducer 키를 프로젝트 전반의 selector와 일치시키기
export const store = configureStore({
    reducer: {
        shapes: shapesReducer,          // state.shapes
        history: historyReducer,        // state.history (shape 히스토리)
        tool: toolReducer,
        gcode: gcodeReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // 이미지 데이터는 직렬화 검사에서 제외
                ignoredActions: ['shapes/addShape', 'shapes/updateShape'],
                ignoredPaths: ['shapes.shapes.image'],
            },
        })
        .prepend(historySyncListener.middleware),

    devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;