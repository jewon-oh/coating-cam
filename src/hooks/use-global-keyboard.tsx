// src/hooks/use-global-keyboard.tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setTool } from '@/store/slices/tool-slice';
import { unselectAllShapes } from '@/store/slices/shape-slice';
import { useCanvas } from '@/contexts/canvas-context';
import {undo,redo} from "@/store/slices/shape-history-slice";

interface GlobalKeyboardHandlers {
    onDelete?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onCut?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    onSelectAll?: () => void;
    onNudge?: (direction: 'up' | 'down' | 'left' | 'right', distance: number) => void;
}

export function useGlobalKeyboard(handlers: GlobalKeyboardHandlers = {}) {
    const dispatch = useAppDispatch();
    const { workspaceMode } = useAppSelector((state) => state.tool);
    const { isCanvasFocused } = useCanvas();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 입력 필드에서는 키보드 이벤트 무시
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // 전역 단축키 (모든 모드 공통)
            if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                dispatch(undo());
                return;
            }

            if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                dispatch(redo());
                return;
            }

            // ESC - 선택 해제 및 모드 리셋
            if (e.key === 'Escape') {
                e.preventDefault();
                dispatch(unselectAllShapes());
                return;
            }

            // 모드별 도구 단축키
            if (workspaceMode === 'shape') {
                handleShapeToolShortcuts(e, dispatch);
            } else if (workspaceMode === 'path') {
                handlePathToolShortcuts(e, dispatch);
            }

            // 캔버스가 포커스된 상태에서만 작동하는 편집 단축키
            if (!isCanvasFocused) return;

            // 편집 단축키
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handlers.onDelete?.();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                handlers.onSelectAll?.();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                handlers.onCopy?.();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                handlers.onPaste?.();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                handlers.onCut?.();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                handlers.onGroup?.();
            } else if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                handlers.onUngroup?.();
            }
            // 화살표 키로 도형 이동
            else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const distance = e.shiftKey ? 10 : 1;
                const direction = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
                handlers.onNudge?.(direction, distance);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, workspaceMode, isCanvasFocused, handlers]);
}

// Shape 모드 도구 단축키
function handleShapeToolShortcuts(e: KeyboardEvent, dispatch: any) {
    switch (e.key.toLowerCase()) {
        case 'v':
            e.preventDefault();
            dispatch(setTool('select'));
            break;
        case 'r':
            e.preventDefault();
            dispatch(setTool('rectangle'));
            break;
        case 'c':
            e.preventDefault();
            dispatch(setTool('circle'));
            break;
    }
}

// Path 모드 도구 단축키
function handlePathToolShortcuts(e: KeyboardEvent, dispatch: any) {
    switch (e.key.toLowerCase()) {
        case 'v':
            e.preventDefault();
            dispatch(setTool('path-select'));
            break;
        case 'p':
            e.preventDefault();
            dispatch(setTool('path-pen'));
            break;
        case 'l':
            e.preventDefault();
            dispatch(setTool('path-line'));
            break;
        case 'n':
            e.preventDefault();
            dispatch(setTool('path-node'));
            break;
    }
}