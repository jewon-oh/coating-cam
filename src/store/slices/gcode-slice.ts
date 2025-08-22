import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GCodeState} from "@/types/gcode";

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