import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GCodeState {
    gcode: string;
    gcodePath: number[][];
    lastGenerated: number | null;
}

const initialState: GCodeState = {
    gcode: '',
    gcodePath: [],
    lastGenerated: null,
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
        clearGCode: (state) => {
            state.gcode = '';
            state.gcodePath = [];
            state.lastGenerated = null;
        }
    },
});

export const { setGCode, clearGCode } = gcodeSlice.actions;
export default gcodeSlice.reducer;