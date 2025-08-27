import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ToolType, CoatingType, SHAPE_TOOLS, PATH_TOOLS, DEFAULT_TOOLS} from '@/types/tool-type';
import {FillPattern} from "@/types/gcode";

interface ToolState {
    tool: ToolType;
    workspaceMode: 'shape' | 'path';
    coatingType: CoatingType;
    fillPattern: FillPattern;
}

const initialState: ToolState = {
    tool: 'select',
    workspaceMode: 'shape',
    coatingType: 'fill',
    fillPattern: 'vertical'
};

const toolSlice = createSlice({
    name: 'tool',
    initialState,
    reducers: {
        setTool: (state, action: PayloadAction<ToolType>) => {
            console.log('Setting tool:', action.payload, 'Current mode:', state.workspaceMode);
            // 현재 워크스페이스 모드에 맞는 도구인지 확인
            const validTools = state.workspaceMode === 'shape' ? SHAPE_TOOLS : PATH_TOOLS;
            if (validTools.includes(action.payload)) {
                state.tool = action.payload;
                console.log('Tool set successfully:', state.tool);
            } else {
                console.warn('Invalid tool for current mode:', action.payload, 'Valid tools:', validTools);
            }
        },
        setCoatingType: (state, action: PayloadAction<CoatingType>) => {
            state.coatingType = action.payload;
        },
        setFillPattern: (state, action: PayloadAction<FillPattern>) => {
            state.fillPattern = action.payload;
        },
        setCoatingTypeAndFillPattern: (state, action: PayloadAction<{
            coatingType: CoatingType,
            fillPattern: FillPattern
        }>) => {
            state.coatingType = action.payload.coatingType;
            state.fillPattern = action.payload.fillPattern;
        },
        setWorkspaceMode: (state, action: PayloadAction<'shape' | 'path'>) => {
            const newMode = action.payload;
            console.log('Changing workspace mode from', state.workspaceMode, 'to', newMode);
            state.workspaceMode = newMode;

            // 모드가 변경되면 해당 모드의 기본 도구로 전환
            const defaultTool = DEFAULT_TOOLS[newMode];
            console.log('Setting default tool for', newMode, 'mode:', defaultTool);
            state.tool = defaultTool;
        },
        // 강제로 도구 변경 (모드 검증 없이)
        forceSetTool: (state, action: PayloadAction<ToolType>) => {
            console.log('Force setting tool:', action.payload);
            state.tool = action.payload;
        }
    },
});

export const {
    setTool,
    setCoatingType,
    setFillPattern,
    setCoatingTypeAndFillPattern,
    setWorkspaceMode,
    forceSetTool
} = toolSlice.actions;
export default toolSlice.reducer;