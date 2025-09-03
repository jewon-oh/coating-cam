// electron 환경을 위해 @ 사용 안함
import type { GCodeSnippet} from "./gcode";
import {CoatingSettings,DEFAULT_COATING_SETTINGS} from "./coating";
import {nanoid} from "nanoid";

export type SettingsType = {
    version: number;
    workArea: { width: number; height: number };
    grid: { visible: boolean; pixelsPerMm: number; snapping: boolean };
    theme: "light" | "dark" | "system";
    coatingSettings: CoatingSettings;
    gcodeSnippets: GCodeSnippet[];
    showCoatingOrder?: boolean;
};

export const DEFAULT_SETTINGS: SettingsType = {
    version: 1,
    workArea: {width: 1000, height: 1000},
    grid: {visible: true, pixelsPerMm: 10, snapping: true},
    theme: "light",
    showCoatingOrder: false,
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
