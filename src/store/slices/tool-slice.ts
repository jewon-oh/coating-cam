import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Tool } from '@/types/tool';

interface ToolState {
    tool: Tool;
}

const initialState: ToolState = {
    tool: 'select',
};

const toolSlice = createSlice({
    name: 'tool',
    initialState,
    reducers: {
        setTool: (state, action: PayloadAction<Tool>) => {
            state.tool = action.payload;
        },
    },
});

export const { setTool } = toolSlice.actions;
export default toolSlice.reducer;
