// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import shapesReducer from './slices/shapes-slice';
import historyReducer from './slices/history-slice';
import toolReducer from './slices/tool-slice';
import gcodeReducer from './slices/gcode-slice';

export const store = configureStore({
    reducer: {
        shapes: shapesReducer,
        history: historyReducer,
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
        }),
    devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;