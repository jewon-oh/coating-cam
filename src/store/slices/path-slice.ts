import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PathGroup, PathSegment } from '@/types/path';

interface PathState {
    pathGroups: PathGroup[];
    selectedPathId: string | null;     // 선택된 Path ID
    selectedSegmentId: string | null;  // 선택된 Segment ID
    tool: 'select' | 'add' | 'delete' | 'split' | 'merge';
    shapeToPathMap: Record<string, string>; // shapeId -> pathGroupId 매핑 추가
}

const initialState: PathState = {
    pathGroups: [],
    selectedPathId: null,
    selectedSegmentId: null,
    tool: 'select',
    shapeToPathMap: {},
};

const pathSlice = createSlice({
    name: 'paths',
    initialState,
    reducers: {
        // PathGroups 설정
        setPathGroups(state, action: PayloadAction<PathGroup[]>) {
            state.pathGroups = action.payload;
        },
        // PathGroups 업데이트
        updatePathGroups(state, action: PayloadAction<Partial<PathGroup>[]>) {
            action.payload.forEach((update) => {
                const index = state.pathGroups.findIndex((p) => p.id === update.id);
                if (index !== -1) {
                    // Partial 적용
                    state.pathGroups[index] = { ...state.pathGroups[index], ...update };
                }
            });
        },
        // Path 추가
        addPathGroup(state, action: PayloadAction<PathGroup>) {
            state.pathGroups.push(action.payload);
        },
        // Path 삭제
        removePathGroup(state, action: PayloadAction<string>) {
            state.pathGroups = state.pathGroups.filter((p) => p.id !== action.payload);
        },
        // Segment 추가
        addSegment(state, action: PayloadAction<{ groupId: string; segment: PathSegment }>) {
            const group = state.pathGroups.find((g) => g.id === action.payload.groupId);
            if (group) {
                group.segments.push(action.payload.segment);
            }
        },
        updateSegment(state, action: PayloadAction<{ segmentId: string; updates: Partial<PathSegment> }>) {
            const { segmentId, updates } = action.payload;

            // 해당 세그먼트가 속한 그룹을 찾아서 업데이트
            for (const group of state.pathGroups) {
                const segmentIndex = group.segments.findIndex(seg => seg.id === segmentId);
                if (segmentIndex !== -1) {
                    group.segments[segmentIndex] = {
                        ...group.segments[segmentIndex],
                        ...updates
                    };
                    break;
                }
            }
        },

        batchUpdateSegments(state, action: PayloadAction<Array<{ segmentId: string; updates: Partial<PathSegment> }>>) {
            const updates = action.payload;

            // 성능 최적화를 위해 그룹별로 업데이트를 그룹핑
            for (const update of updates) {
                const { segmentId, updates: segmentUpdates } = update;

                // 해당 세그먼트가 속한 그룹을 찾아서 업데이트
                for (const group of state.pathGroups) {
                    const segmentIndex = group.segments.findIndex(seg => seg.id === segmentId);
                    if (segmentIndex !== -1) {
                        group.segments[segmentIndex] = {
                            ...group.segments[segmentIndex],
                            ...segmentUpdates
                        };
                        break;
                    }
                }
            }
        },

        // Segment 삭제
        removeSegment(state, action: PayloadAction<string>) {
            state.pathGroups.forEach((group) => {
                group.segments = group.segments.filter((s) => s.id !== action.payload);
            });
        },
        // 선택된 Path/Segment 설정
        setSelectedPath(state, action: PayloadAction<string | null>) {
            state.selectedPathId = action.payload;
        },
        setSelectedSegment(state, action: PayloadAction<string | null>) {
            state.selectedSegmentId = action.payload;
        },
        // 툴 설정
        setTool(state, action: PayloadAction<'select' | 'add' | 'delete' | 'split' | 'merge'>) {
            state.tool = action.payload;
        },
        setShapePathMap(state, action: PayloadAction<{ shapeId: string; groupId: string }>) {
            state.shapeToPathMap[action.payload.shapeId] = action.payload.groupId;
        },
        removeShapePathMap(state, action: PayloadAction<string>) {
            delete state.shapeToPathMap[action.payload];
        },
        // PathGroup을 ID로 교체(업서트용)
        upsertPathGroup(state, action: PayloadAction<PathGroup>) {
            const idx = state.pathGroups.findIndex(g => g.id === action.payload.id);
            if (idx >= 0) state.pathGroups[idx] = action.payload;
            else state.pathGroups.push(action.payload);
        },

    },
});

export const {
    setPathGroups,
    updatePathGroups,
    addPathGroup,
    removePathGroup,
    addSegment,
    updateSegment,
    batchUpdateSegments,
    removeSegment,
    setSelectedPath,
    setSelectedSegment,
    setTool,
    setShapePathMap,
    removeShapePathMap,
    upsertPathGroup,
} = pathSlice.actions;

export default pathSlice.reducer;