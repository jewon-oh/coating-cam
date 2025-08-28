import type { GCodeSnippet} from "@/types/gcode";
import {CoatingSettings,DEFAULT_COATING_SETTINGS} from "@/types/coating";
import {nanoid} from "nanoid";

export type SettingsType = {
    version: number;
    workArea: { width: number; height: number };
    grid: { visible: boolean; size: number; snapping: boolean };
    theme: "light" | "dark" | "system";
    coatingSettings: CoatingSettings;
    gcodeSnippets: GCodeSnippet[];
};

export const DEFAULT_SETTINGS: SettingsType = {
    version: 1,
    workArea: {width: 1000, height: 1000},
    grid: {visible: true, size: 10, snapping: true},
    theme: "light",
    coatingSettings: DEFAULT_COATING_SETTINGS,
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
