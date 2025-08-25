import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ToolType, CoatingType } from '@/types/toolType';

interface ToolState {
    tool: ToolType;
    defaultCoatingType: CoatingType; // 코팅 타입 추가
}

const initialState: ToolState = {
    tool: 'select',
    defaultCoatingType: 'fill', // 기본값은 채우기
};

const toolSlice = createSlice({
    name: 'tool',
    initialState,
    reducers: {
        setTool: (state, action: PayloadAction<ToolType>) => {
            state.tool = action.payload;
        },
        setDefaultCoatingType: (state, action: PayloadAction<CoatingType>) => {
            state.defaultCoatingType = action.payload;
        },
        // 도구와 코팅 타입을 함께 설정하는 액션 (선택적)
        setToolAndCoating: (state, action: PayloadAction<{tool: ToolType, coatingType: CoatingType}>) => {
            state.tool = action.payload.tool;
            state.defaultCoatingType = action.payload.coatingType;
        },
    },
});

export const { setTool, setDefaultCoatingType, setToolAndCoating } = toolSlice.actions;
export default toolSlice.reducer;