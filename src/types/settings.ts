import type { GCodeSnippet} from "@/types/gcode";
import {nanoid} from "nanoid";

// ---- Settings 파일 스키마(메인과 대응) + 브리지 ----
export type ThemeMode = "light" | "dark" | "system";

export type SettingsType = {
    version: number;
    workArea: { width: number; height: number };
    grid: { visible: boolean; size: number; snapping: boolean };
    theme: ThemeMode;
    gcodeSnippets: GCodeSnippet[];
};

export const DEFAULT_SETTINGS: SettingsType = {
    version: 1,
    workArea: {width: 1000, height: 1000},
    grid: {visible: true, size: 10, snapping: true},
    theme: "light",
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
