// TypeScript React
"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import {nanoid} from "nanoid";
import type {GCodeHook, GcodeSettings, GCodeSnippet} from "@/types/gcode";
import {DEFAULT_SETTINGS, SettingsType} from "@/types/settings";

function useSettingsBridge() {
    const bridge =
        (typeof window !== "undefined" && window.settingsApi) || null;
    return bridge as null | {
        load: () => Promise<SettingsType>;
        save: (data: SettingsType) => Promise<{ ok: boolean }>;
    };
}

// ---- G-Code 스니펫 useReducer ----
type SnippetAction =
    | { type: "setAll"; payload: GCodeSnippet[] }
    | {
    type: "add";
    payload: {
        name: string;
        hook: GCodeHook;
        template: string;
        enabled?: boolean;
        order?: number;
        description?: string;
    };
}
    | { type: "update"; payload: { id: string; patch: Partial<GCodeSnippet> } }
    | { type: "remove"; payload: { id: string } }
    | { type: "toggle"; payload: { id: string } }
    | {
    type: "reorderInHook";
    payload: { hook: GCodeHook; orderedIds: string[] };
};

function sortSnippets(list: GCodeSnippet[]) {
    return [...list].sort(
        (a, b) => a.hook.localeCompare(b.hook) || a.order - b.order
    );
}

function snippetsReducer(
    state: GCodeSnippet[],
    action: SnippetAction
): GCodeSnippet[] {
    switch (action.type) {
        case "setAll": {
            return sortSnippets(action.payload);
        }
        case "add": {
            const count = state.filter((s) => s.hook === action.payload.hook).length;
            const next: GCodeSnippet = {
                id: nanoid(),
                name: action.payload.name,
                hook: action.payload.hook,
                enabled: action.payload.enabled ?? true,
                order: action.payload.order ?? count,
                template: action.payload.template,
                description: action.payload.description,
            };
            return sortSnippets([...state, next]);
        }
        case "update": {
            const out = state.map((s) =>
                s.id === action.payload.id ? {...s, ...action.payload.patch} : s
            );
            return sortSnippets(out);
        }
        case "remove":
            return state.filter((s) => s.id !== action.payload.id);
        case "toggle":
            return state.map((s) =>
                s.id === action.payload.id ? {...s, enabled: !s.enabled} : s
            );
        case "reorderInHook": {
            const inHook = state.filter((s) => s.hook === action.payload.hook);
            const others = state.filter((s) => s.hook !== action.payload.hook);
            const byId = new Map(inHook.map((s) => [s.id, s]));
            const reordered = action.payload.orderedIds
                .map((id, idx) => {
                    const s = byId.get(id);
                    return s ? {...s, order: idx} : null;
                })
                .filter(Boolean) as GCodeSnippet[];
            const leftovers = inHook
                .filter((s) => !action.payload.orderedIds.includes(s.id))
                .map((s, i) => ({...s, order: reordered.length + i}));
            return sortSnippets([...others, ...reordered, ...leftovers]);
        }
        default:
            return state;
    }
}

// ---- Settings Context ----
type SettingsContextType = {
    // 기존 설정
    isGridVisible: boolean;
    setGridVisible: (v: boolean) => void;
    gridSize: number;
    setGridSize: (n: number) => void;
    isSnappingEnabled: boolean;
    setSnappingEnabled: (v: boolean) => void;
    theme: ThemeMode;
    setTheme: (t: ThemeMode) => void;
    workArea: { width: number; height: number };
    setWorkArea: (wa: { width: number; height: number }) => void;

    // G-Code 설정 추가
    gcodeSettings: GcodeSettings;
    updateGcodeSettings: (patch: Partial<GcodeSettings>) => void;
    setGcodeSettings: (settings: GcodeSettings) => void;

    // G-Code 스니펫 API
    gcodeSnippets: GCodeSnippet[];
    setAllGcodeSnippets: (list: GCodeSnippet[]) => void;
    addGcodeSnippet: (p: {
        name: string;
        hook: GCodeHook;
        template: string;
        enabled?: boolean;
        order?: number;
        description?: string;
    }) => void;
    updateGcodeSnippet: (id: string, patch: Partial<GCodeSnippet>) => void;
    removeGcodeSnippet: (id: string) => void;
    toggleGcodeSnippetEnabled: (id: string) => void;
    reorderGcodeSnippetsInHook: (hook: GCodeHook, orderedIds: string[]) => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);


export function SettingsProvider({children}: { children: React.ReactNode }) {
    const bridge = useSettingsBridge();

    // 기존 설정 상태
    const [isGridVisible, setGridVisible] = useState(
        DEFAULT_SETTINGS.grid.visible
    );
    const [gridSize, setGridSize] = useState(DEFAULT_SETTINGS.grid.size);
    const [isSnappingEnabled, setSnappingEnabled] = useState(
        DEFAULT_SETTINGS.grid.snapping
    );
    const [theme, setTheme] = useState<ThemeMode>(DEFAULT_SETTINGS.theme);
    const [workArea, setWorkArea] = useState(DEFAULT_SETTINGS.workArea);

    // G-Code 설정 상태 추가
    const [gcodeSettings, setGcodeSettings] = useState<GcodeSettings>(DEFAULT_SETTINGS.gcodeSettings);

    // G-Code 스니펫 (useReducer)
    const [gcodeSnippets, dispatchSnippets] = useReducer(
        snippetsReducer,
        DEFAULT_SETTINGS.gcodeSnippets
    );

    // G-Code 설정 업데이트 함수
    const updateGcodeSettings = useCallback((patch: Partial<GcodeSettings>) => {
        setGcodeSettings(prev => ({ ...prev, ...patch }));
    }, []);

    // 최초 로드
    const loadedRef = useRef(false);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                let s: SettingsType | null;
                if (bridge) s = await bridge.load();
                else {
                    const raw = localStorage.getItem("app.settings.v1");
                    s = raw ? (JSON.parse(raw) as SettingsType) : null;
                }
                const settings = s ?? DEFAULT_SETTINGS;
                if (!mounted) return;

                setGridVisible(!!settings.grid?.visible);
                setGridSize(Number.isFinite(settings.grid?.size) ? settings.grid!.size : DEFAULT_SETTINGS.grid.size);
                setSnappingEnabled(!!settings.grid?.snapping);
                setTheme((settings.theme as ThemeMode) ?? DEFAULT_SETTINGS.theme);
                setWorkArea(settings.workArea ?? DEFAULT_SETTINGS.workArea);

                // G-Code 설정 로드
                setGcodeSettings(settings.gcodeSettings ?? DEFAULT_SETTINGS.gcodeSettings);

                dispatchSnippets({
                    type: "setAll",
                    payload: Array.isArray(settings.gcodeSnippets)
                        ? settings.gcodeSnippets
                        : DEFAULT_SETTINGS.gcodeSnippets!,
                });

                loadedRef.current = true;
            } catch {
                loadedRef.current = true;
            }
        })();
        return () => {
            mounted = false;
        };
    }, [bridge]);

    // 저장(200ms 디바운스)
    const saveTimer = useRef<number | null>(null);
    const scheduleSave = useCallback(
        (next: SettingsType) => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            saveTimer.current = window.setTimeout(async () => {
                try {
                    if (bridge) await bridge.save(next);
                    else localStorage.setItem("app.settings.v1", JSON.stringify(next));
                } finally {
                    saveTimer.current = null;
                }
            }, 200);
        },
        [bridge]
    );

    useEffect(() => {
        if (!loadedRef.current) return;
        const snapshot: SettingsType = {
            version: 1,
            workArea,
            grid: {
                visible: isGridVisible,
                size: gridSize,
                snapping: isSnappingEnabled,
            },
            theme,
            gcodeSettings,
            gcodeSnippets,
        };
        scheduleSave(snapshot);
    }, [
        isGridVisible,
        gridSize,
        isSnappingEnabled,
        theme,
        workArea,
        gcodeSettings,
        gcodeSnippets,
        scheduleSave,
    ]);

    // 스니펫 액션 바운드
    const setAllGcodeSnippets = useCallback((list: GCodeSnippet[]) => {
        dispatchSnippets({type: "setAll", payload: list});
    }, []);

    const addGcodeSnippet = useCallback(
        (p: {
            name: string;
            hook: GCodeHook;
            template: string;
            enabled?: boolean;
            order?: number;
            description?: string;
        }) => {
            dispatchSnippets({type: "add", payload: p});
        },
        []
    );

    const updateGcodeSnippet = useCallback(
        (id: string, patch: Partial<GCodeSnippet>) => {
            dispatchSnippets({type: "update", payload: {id, patch}});
        },
        []
    );


    const removeGcodeSnippet = useCallback((id: string) => {
        dispatchSnippets({type: "remove", payload: {id}});
    }, []);

    const toggleGcodeSnippetEnabled = useCallback((id: string) => {
        dispatchSnippets({type: "toggle", payload: {id}});
    }, []);

    const reorderGcodeSnippetsInHook = useCallback(
        (hook: GCodeHook, orderedIds: string[]) => {
            dispatchSnippets({type: "reorderInHook", payload: {hook, orderedIds}});
        },
        []
    );

    const value = useMemo(
        () => ({
            // 기존 설정
            isGridVisible,
            setGridVisible,
            gridSize,
            setGridSize,
            isSnappingEnabled,
            setSnappingEnabled,
            theme,
            setTheme,
            workArea,
            setWorkArea,

            // G-Code 설정
            gcodeSettings,
            updateGcodeSettings,
            setGcodeSettings,

            // G-Code 스니펫
            gcodeSnippets,
            setAllGcodeSnippets,
            addGcodeSnippet,
            updateGcodeSnippet,
            removeGcodeSnippet,
            toggleGcodeSnippetEnabled,
            reorderGcodeSnippetsInHook,
        }),
        [
            isGridVisible,
            gridSize,
            isSnappingEnabled,
            theme,
            workArea,
            gcodeSettings,
            updateGcodeSettings,
            gcodeSnippets,
            setAllGcodeSnippets,
            addGcodeSnippet,
            updateGcodeSnippet,
            removeGcodeSnippet,
            toggleGcodeSnippetEnabled,
            reorderGcodeSnippetsInHook,
        ]
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
    return ctx;
}