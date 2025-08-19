import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {GcodeSettings, GCodeState} from "@/types/gcode";

const initialState: GCodeState = {
    gcode: '',
    gcodePath: [],
    lastGenerated: null,
    isGenerating: false,
    gcodeSettings: {
        // 코팅 기본 설정
        coatingWidth: 10,           // 10mm 코팅 폭
        lineSpacing: 10,            // 10mm 라인 간격
        coatingSpeed: 1000,          // 1000mm/min 코팅 속도
        moveSpeed: 2000,             // 2000mm/min 이동 속도

        // Z축 기본 설정
        safeHeight: 80,               // 80mm 안전 높이
        coatingHeight: 20,          // 20mm 코팅 높이

        // 패턴 기본 설정
        fillPattern: 'horizontal',

        // 마스킹 기본 설정
        enableMasking: true,
        maskingClearance: 0.5,       // 0.5mm 여유 거리
        travelAvoidanceStrategy: 'contour', // 마스킹 테두리 따라 우회

        workArea: { width: 1000, height: 1000 },
        unit: 'mm',
    },

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
        updateGcodeSettings: (state, action: PayloadAction<Partial<GcodeSettings>>) => {
            state.gcodeSettings = { ...state.gcodeSettings, ...action.payload };
        },
        clearGCode: (state) => {
            state.gcode = '';
            state.gcodePath = [];
            state.lastGenerated = null;
        }
    },
});

export const { setGCode, setGenerating, updateGcodeSettings, clearGCode } = gcodeSlice.actions;
export default gcodeSlice.reducer;