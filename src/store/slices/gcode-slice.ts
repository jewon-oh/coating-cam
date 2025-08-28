import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GCodeState {
    gcode: string;
    gcodePath: number[][];
    lastGenerated: number | null;
    isGenerating: boolean;
}

const initialState: GCodeState = {
    gcode: '',
    gcodePath: [],
    lastGenerated: null,
    isGenerating: false,
};

const gcodeSlice = createSlice({
    name: 'gcode',
    initialState,
    reducers: {
        setGCode: (state, action: PayloadAction<{ gcode: string; path: number[][] }>) => {
            state.gcode = action.payload.gcode;
            state.gcodePath = action.payload.path;
            state.lastGenerated = Date.now();
        },
        setGenerating: (state, action: PayloadAction<boolean>) => {
            state.isGenerating = action.payload;
        },
        clearGCode: (state) => {
            state.gcode = '';
            state.gcodePath = [];
            state.lastGenerated = null;
        }
    },
});

export const { setGCode, setGenerating, clearGCode } = gcodeSlice.actions;
export default gcodeSlice.reducer;