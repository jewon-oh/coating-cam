import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ToolType, SHAPE_TOOLS} from '@/types/tool-type';
import {FillPattern, CoatingType}  from "@/types/coating";

interface ToolState {
    tool: ToolType;

    // 코팅 타입
    coatingType: CoatingType;

    // 코팅 공통 설정
    coatingSpeed: number;        // 코팅 속도 (mm/min)
    coatingHeight: number;       // 코팅 높이 (mm)
    coatingWidth: number;        // 코팅 폭 (mm)

    // 채우기 설정
    fillPattern: FillPattern;
    lineSpacing: number;         // 라인 간격 (mm)

    // 마스킹 설정
    maskingClearance: number;    // 마스킹 여유 거리 (mm)
    travelAvoidanceStrategy: TravelAvoidanceStrategy; // 이동 회피 전략 추가
}

const initialState: ToolState = {
    tool: 'select',

    // 코팅 타입
    coatingType: 'fill',

    // 코팅 공통 설정
    coatingSpeed: 80,
    coatingHeight: 20,
    coatingWidth: 20,

    // 채우기 설정
    fillPattern: 'vertical',
    lineSpacing: 20,

    // 마스킹 설정
    maskingClearance: 0,
    travelAvoidanceStrategy: 'avoid'
};

const toolSlice = createSlice({
    name: 'tool',
    initialState,
    reducers: {
        setTool: (state, action: PayloadAction<ToolType>) => {
            console.log('Setting tool:', action.payload, 'Current mode:', state.workspaceMode);
            
            // 도구 유효성 확인
            if (SHAPE_TOOLS.includes(action.payload)) {
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
    },
});

export const {
    setTool,
    setCoatingType,
    setCoatingTypeAndFillPattern,
} = toolSlice.actions;
export default toolSlice.reducer;