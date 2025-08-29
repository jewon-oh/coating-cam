import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PathGroup, PathSegment } from '@/types/path';

interface PathState {
    pathGroups: PathGroup[];
    selectedPathId: string | null;
    shapeToPathMap: Record<string, string>; // shapeId -> pathGroupId 매핑
}

const initialState: PathState = {
    pathGroups: [],
    selectedPathId: null,
    shapeToPathMap: {},
};

const pathSlice = createSlice({
    name: 'paths',
    initialState,
    reducers: {
        // PathGroup 추가/업데이트
        addPathGroup(state, action: PayloadAction<PathGroup>) {
            state.pathGroups.push(action.payload);

            // shape와 path 매핑 업데이트
            if (action.payload.sourceShapeId) {
                state.shapeToPathMap[action.payload.sourceShapeId] = action.payload.id;
            }
        },

        // PathGroup 업데이트
        updatePathGroup(state, action: PayloadAction<{ id: string; updates: Partial<PathGroup> }>) {
            const { id, updates } = action.payload;
            const index = state.pathGroups.findIndex((p) => p.id === id);
            if (index !== -1) {
                state.pathGroups[index] = { ...state.pathGroups[index], ...updates };
            }
        },

        // PathGroup 삭제
        removePathGroup(state, action: PayloadAction<string>) {
            const pathGroup = state.pathGroups.find(p => p.id === action.payload);
            if (pathGroup?.sourceShapeId) {
                delete state.shapeToPathMap[pathGroup.sourceShapeId];
            }
            state.pathGroups = state.pathGroups.filter((p) => p.id !== action.payload);
        },

        // Shape 삭제 시 관련 PathGroup도 삭제
        removePathGroupByShapeId(state, action: PayloadAction<string>) {
            const shapeId = action.payload;
            const pathGroupId = state.shapeToPathMap[shapeId];

            if (pathGroupId) {
                state.pathGroups = state.pathGroups.filter(p => p.id !== pathGroupId);
                delete state.shapeToPathMap[shapeId];
            }
        },

        // 선택된 Path 설정
        setSelectedPath(state, action: PayloadAction<string | null>) {
            state.selectedPathId = action.payload;
        },

        // PathGroup 표시/숨기기 토글
        togglePathGroupVisibility(state, action: PayloadAction<string>) {
            const pathGroup = state.pathGroups.find(p => p.id === action.payload);
            if (pathGroup) {
                pathGroup.visible = !pathGroup.visible;
            }
        },

        // 모든 PathGroup 클리어
        clearAllPaths(state) {
            state.pathGroups = [];
            state.shapeToPathMap = {};
            state.selectedPathId = null;
        }
    },
});

export const {
    addPathGroup,
    updatePathGroup,
    removePathGroup,
    removePathGroupByShapeId,
    setSelectedPath,
    togglePathGroupVisibility,
    clearAllPaths
} = pathSlice.actions;

export default pathSlice.reducer;