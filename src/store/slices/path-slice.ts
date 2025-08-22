import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PathGroup, PathSegment, PathEditOperation } from '@/types/gcode-path';

interface PathState {
    pathGroups: PathGroup[];
    selectedSegmentId: string | null;
    selectedGroupId: string | null;
    selectedEndpoint: 'start' | 'end' | null;
    tool: 'select' | 'add' | 'delete' | 'split' | 'merge';

    // 상태 정보
    lastGeneratedFromShapes: number | null; // Shape에서 마지막으로 생성된 시간
    lastModified: number | null; // Path가 마지막으로 수정된 시간
    isGenerating: boolean;

    // 히스토리 (실행 취소/다시 실행)
    history: PathGroup[][];
    historyIndex: number;
    maxHistorySize: number;
}

const initialState: PathState = {
    pathGroups: [],
    selectedSegmentId: null,
    selectedGroupId: null,
    selectedEndpoint: null,
    tool: 'select',

    lastGeneratedFromShapes: null,
    lastModified: null,
    isGenerating: false,

    history: [[]],
    historyIndex: 0,
    maxHistorySize: 50,
};

const pathSlice = createSlice({
    name: 'path',
    initialState,
    reducers: {
        // Path Groups 관리
        setPathGroups: (state, action: PayloadAction<PathGroup[]>) => {
            state.pathGroups = action.payload;
            state.lastGeneratedFromShapes = Date.now();
            state.lastModified = Date.now();
            pathSlice.caseReducers.pushToHistory(state, { payload: action.payload, type: 'pushToHistory' });
        },

        updatePathGroups: (state, action: PayloadAction<PathGroup[]>) => {
            state.pathGroups = action.payload;
            state.lastModified = Date.now();
            pathSlice.caseReducers.pushToHistory(state, { payload: action.payload, type: 'pushToHistory' });
        },

        addPathGroup: (state, action: PayloadAction<PathGroup>) => {
            state.pathGroups.push(action.payload);
            state.lastModified = Date.now();
            pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
        },

        removePathGroup: (state, action: PayloadAction<string>) => {
            state.pathGroups = state.pathGroups.filter(group => group.id !== action.payload);
            if (state.selectedGroupId === action.payload) {
                state.selectedGroupId = null;
                state.selectedSegmentId = null;
                state.selectedEndpoint = null;
            }
            state.lastModified = Date.now();
            pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
        },

        updatePathGroup: (state, action: PayloadAction<{ id: string; updates: Partial<PathGroup> }>) => {
            const index = state.pathGroups.findIndex(group => group.id === action.payload.id);
            if (index !== -1) {
                Object.assign(state.pathGroups[index], action.payload.updates);
                state.lastModified = Date.now();
                pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
            }
        },

        // Segment 관리
        addSegment: (state, action: PayloadAction<{ groupId: string; segment: PathSegment }>) => {
            const group = state.pathGroups.find(g => g.id === action.payload.groupId);
            if (group) {
                group.segments.push(action.payload.segment);
                state.selectedSegmentId = action.payload.segment.id;
                state.lastModified = Date.now();
                pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
            }
        },

        removeSegment: (state, action: PayloadAction<string>) => {
            for (const group of state.pathGroups) {
                const segmentIndex = group.segments.findIndex(s => s.id === action.payload);
                if (segmentIndex !== -1) {
                    group.segments.splice(segmentIndex, 1);
                    break;
                }
            }
            if (state.selectedSegmentId === action.payload) {
                state.selectedSegmentId = null;
                state.selectedEndpoint = null;
            }
            state.lastModified = Date.now();
            pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
        },

        updateSegment: (state, action: PayloadAction<{ id: string; updates: Partial<PathSegment> }>) => {
            for (const group of state.pathGroups) {
                const segment = group.segments.find(s => s.id === action.payload.id);
                if (segment) {
                    Object.assign(segment, action.payload.updates);
                    state.lastModified = Date.now();
                    pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
                    break;
                }
            }
        },

        splitSegment: (state, action: PayloadAction<{ segmentId: string; splitPoint: { x: number; y: number } }>) => {
            for (const group of state.pathGroups) {
                const segmentIndex = group.segments.findIndex(s => s.id === action.payload.segmentId);
                if (segmentIndex !== -1) {
                    const originalSegment = group.segments[segmentIndex];
                    const firstSegment: PathSegment = {
                        ...originalSegment,
                        id: `${action.payload.segmentId}-1`,
                        end: action.payload.splitPoint
                    };
                    const secondSegment: PathSegment = {
                        ...originalSegment,
                        id: `${action.payload.segmentId}-2`,
                        start: action.payload.splitPoint
                    };

                    group.segments.splice(segmentIndex, 1, firstSegment, secondSegment);
                    state.selectedSegmentId = firstSegment.id;
                    state.lastModified = Date.now();
                    pathSlice.caseReducers.pushToHistory(state, { payload: state.pathGroups, type: 'pushToHistory' });
                    break;
                }
            }
        },

        // 선택 관리
        setSelectedSegment: (state, action: PayloadAction<string | null>) => {
            state.selectedSegmentId = action.payload;
            state.selectedEndpoint = null;

            // 선택된 세그먼트가 속한 그룹도 선택
            if (action.payload) {
                const group = state.pathGroups.find(g =>
                    g.segments.some(s => s.id === action.payload)
                );
                if (group) {
                    state.selectedGroupId = group.id;
                }
            }
        },

        setSelectedGroup: (state, action: PayloadAction<string | null>) => {
            state.selectedGroupId = action.payload;
            if (!action.payload) {
                state.selectedSegmentId = null;
                state.selectedEndpoint = null;
            }
        },

        setSelectedEndpoint: (state, action: PayloadAction<'start' | 'end' | null>) => {
            state.selectedEndpoint = action.payload;
        },

        setTool: (state, action: PayloadAction<'select' | 'add' | 'delete' | 'split' | 'merge'>) => {
            state.tool = action.payload;
        },

        // 상태 관리
        setGenerating: (state, action: PayloadAction<boolean>) => {
            state.isGenerating = action.payload;
        },

        // 히스토리 관리
        pushToHistory: (state, action: PayloadAction<PathGroup[]>) => {
            // 현재 인덱스 이후의 히스토리 제거
            state.history = state.history.slice(0, state.historyIndex + 1);

            // 새로운 상태 추가
            state.history.push(JSON.parse(JSON.stringify(action.payload)));

            // 히스토리 크기 제한
            if (state.history.length > state.maxHistorySize) {
                state.history.shift();
            } else {
                state.historyIndex++;
            }
        },

        undo: (state) => {
            if (state.historyIndex > 0) {
                state.historyIndex--;
                state.pathGroups = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
                state.lastModified = Date.now();
            }
        },

        redo: (state) => {
            if (state.historyIndex < state.history.length - 1) {
                state.historyIndex++;
                state.pathGroups = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
                state.lastModified = Date.now();
            }
        },

        // 그룹 가시성/잠금
        toggleGroupVisibility: (state, action: PayloadAction<string>) => {
            const group = state.pathGroups.find(g => g.id === action.payload);
            if (group) {
                group.visible = !group.visible;
            }
        },

        toggleGroupLock: (state, action: PayloadAction<string>) => {
            const group = state.pathGroups.find(g => g.id === action.payload);
            if (group) {
                group.locked = !group.locked;
            }
        },

        // 초기화
        clearPaths: (state) => {
            Object.assign(state, initialState);
        },
    },
});

export const {
    setPathGroups,
    updatePathGroups,
    addPathGroup,
    removePathGroup,
    updatePathGroup,
    addSegment,
    removeSegment,
    updateSegment,
    splitSegment,
    setSelectedSegment,
    setSelectedGroup,
    setSelectedEndpoint,
    setTool,
    setGenerating,
    undo,
    redo,
    toggleGroupVisibility,
    toggleGroupLock,
    clearPaths,
} = pathSlice.actions;

export default pathSlice.reducer;