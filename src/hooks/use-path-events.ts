import { useCallback, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setSelectedPath } from '@/store/slices/path-slice';

// Path 전용 기능별 훅들 (향후 구현 예정)
import { usePathDrawing } from './path/use-path-drawing';
import { usePathSelection } from './path/use-path-selection';
import { usePathEditing } from './path/use-path-editing';
import { usePathMovement } from './path/use-path-movement';

export function usePathEvents() {
    const dispatch = useAppDispatch();
    const { tool } = useAppSelector((state) => state.tool);
    const { pathGroups, selectedPathId } = useAppSelector((state) => state.paths);

    // 임시 로컬 상태들 (향후 개별 훅으로 분리)
    const [isDrawingPath, setIsDrawingPath] = useState(false);
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [hasClipboardData, setHasClipboardData] = useState(false);

    // 향후 구현될 기능별 훅들
    const drawing = usePathDrawing();
    const selection = usePathSelection();
    const editing = usePathEditing();
    const movement = usePathMovement();

    // 마우스 이벤트 핸들러들
    const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
        console.log('usePathEvents: handleMouseDown', tool);

        switch (tool) {
            case 'path-pen':
                console.log('Path pen tool - drawing start');
                setIsDrawingPath(true);
                // drawing.startDrawing(e);
                return;

            case 'path-line':
                console.log('Path line tool - drawing start');
                setIsDrawingPath(true);
                // drawing.startLineDrawing(e);
                return;

            case 'path-select':
                // selection.startDragSelection(e);
                return;

            case 'path-node':
                // 노드 편집 모드
                console.log('Path node editing');
                return;
        }
    }, [tool]);

    const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (isDrawingPath) {
            console.log('Path drawing - mouse move');
            // drawing.updateDrawing(e);
            return;
        }

        // if (selection.updateDragSelection(e)) return;
    }, [isDrawingPath]);

    const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (isDrawingPath) {
            console.log('Path drawing - finish');
            setIsDrawingPath(false);
            // drawing.finishDrawing(e);
            return;
        }

        // selection.finishDragSelection(e);
    }, [isDrawingPath]);

    const handleMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (isDrawingPath) {
            console.log('Path drawing - cancel');
            setIsDrawingPath(false);
            // drawing.cancelDrawing();
        }

        if (isDragSelecting) {
            setIsDragSelecting(false);
            // selection.cancelDragSelection();
        }
    }, [isDrawingPath, isDragSelecting]);

    // 개별 경로 클릭 선택
    const handleSelect = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const pathId = e.target.id();
        if (pathId) {
            console.log('Path selected:', pathId);
            dispatch(setSelectedPath(pathId));
        }
    }, [dispatch]);

    // 컨텍스트 메뉴 처리
    const handleContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
        console.log('Path context menu');
        e.evt.preventDefault();
        // selection.handleContextMenuSelection(e);
    }, []);

    // 캔버스 클릭 핸들러
    const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) {
            dispatch(setSelectedPath(null));
        }
    }, [dispatch]);

    // 드래그 핸들러들 (향후 구현)
    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('Path drag start');
        // movement.handleDragStart(e);
    }, []);

    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('Path drag move');
        // movement.handleDragMove(e);
    }, []);

    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('Path drag end');
        // movement.handleDragEnd(e);
    }, []);

    // 편집 기능들 (향후 구현)
    const handleDelete = useCallback(() => {
        if (selectedPathId) {
            console.log('Delete path:', selectedPathId);
            // editing.handleDelete();
        }
    }, [selectedPathId]);

    const handleCopy = useCallback(() => {
        if (selectedPathId) {
            console.log('Copy path:', selectedPathId);
            setHasClipboardData(true);
            // editing.handleCopy();
        }
    }, [selectedPathId]);

    const handlePaste = useCallback(() => {
        if (hasClipboardData) {
            console.log('Paste path');
            // editing.handlePaste();
        }
    }, [hasClipboardData]);

    const handleCut = useCallback(() => {
        if (selectedPathId) {
            console.log('Cut path:', selectedPathId);
            setHasClipboardData(true);
            // editing.handleCut();
        }
    }, [selectedPathId]);

    const handleSelectAll = useCallback(() => {
        console.log('Select all paths');
        // selection.handleSelectAll();
    }, []);

    const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        if (selectedPathId) {
            console.log('Nudge path:', direction);
            // movement.handleNudge(direction);
        }
    }, [selectedPathId]);

    // Path 전용 기능들
    const handleNodeEdit = useCallback(() => {
        console.log('Node edit mode');
        // 노드 편집 기능
    }, []);

    const handlePathClose = useCallback(() => {
        console.log('Close path');
        // 경로 닫기
    }, []);

    const handlePathOpen = useCallback(() => {
        console.log('Open path');
        // 경로 열기
    }, []);

    return {
        // 마우스 이벤트 핸들러들
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleSelect,
        handleContextMenu,
        handleCanvasClick,

        // 드래그 핸들러들
        handleDragStart,
        handleDragMove,
        handleDragEnd,

        // 편집 기능들
        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleSelectAll,
        handleNudge,

        // Path 전용 기능들
        handleNodeEdit,
        handlePathClose,
        handlePathOpen,

        // 상태들
        isDrawing: isDrawingPath,
        isDragSelecting,
        selectedPathIds: selectedPathId ? [selectedPathId] : [],
        hasClipboardData,
        isSnappingEnabled: false, // 향후 구현

        // Path 전용 상태들
        isNodeEditing: tool === 'path-node',
        currentTool: tool,
        pathGroups,
        selectedPathId,
    };
}