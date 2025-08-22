import type {GcodeSettings, GCodeSnippet} from "@/types/gcode";
import {nanoid} from "nanoid";

export type SettingsType = {
    version: number;
    workArea: { width: number; height: number };
    grid: { visible: boolean; size: number; snapping: boolean };
    theme: "light" | "dark" | "system";
    gcodeSettings: GcodeSettings;
    gcodeSnippets: GCodeSnippet[];
};

export const DEFAULT_SETTINGS: SettingsType = {
    version: 1,
    workArea: {width: 1000, height: 1000},
    grid: {visible: true, size: 10, snapping: true},
    theme: "light",
    gcodeSettings:{
        // 코팅 기본 설정
        coatingWidth: 10,           // 10mm 코팅 폭
        lineSpacing: 10,            // 10mm 라인 간격
        coatingSpeed: 1000,          // 1000mm/min 코팅 속도
        moveSpeed: 2000,             // 2000mm/min 이동 속도

        // Z축 기본 설정
        safeHeight: 80,               // 80mm 안전 높이
        coatingHeight: 20,          // 20mm 코팅 높이

        // 패턴 기본 설정
        fillPattern: 'auto',

        // 마스킹 기본 설정
        enableMasking: true,
        maskingClearance: 0,       // 기본 0mm 여유 거리
        travelAvoidanceStrategy: 'contour', // 마스킹 테두리 따라 우회

        unit: 'mm',
    },
    gcodeSnippets: [
        {
            id: nanoid(),
            name: "시작(헤더)",
            hook: "beforeAll",
            enabled: true,
            order: 0,
            template: "G21 ; mm\nG90 ; absolute\nG0 Z{{safeHeight}}\n",
            description: "단위/절대좌표/안전높이",
        },
        {
            id: nanoid(),
            name: "종료(푸터)",
            hook: "afterAll",
            enabled: true,
            order: 0,
            template: "M5 ; spindle/laser off\nG0 Z{{safeHeight}}\nG0 X0 Y0\n",
        },
    ],
};
