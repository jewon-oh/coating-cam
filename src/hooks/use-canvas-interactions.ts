import React, { useRef, useCallback, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { KonvaShape, useShapeContext } from '@/contexts/shape-context';
import { useHistory } from '@/contexts/history-context';
import { useTool } from '@/contexts/tool-context';
import { useToolActions } from './use-tool-actions';
import { useSettings } from '@/contexts/settings-context';

export const useCanvasInteractions = (
    stageRef: React.RefObject<Konva.Stage>,
    setStage: React.Dispatch<React.SetStateAction<{ scale: number; x: number; y: number }>>,
    selectionRectRef: React.RefObject<Konva.Rect>,
    shapeNodesRef: React.RefObject<Map<string, Konva.Shape>>
) => {
    const { shapes, addShape, removeShapes, selectedShapeIds, setSelectedShapeIds, updateShape, setAllShapes, updateMultipleShapes } = useShapeContext();
    const { isSnappingEnabled, gridSize } = useSettings();
    const shapesRef = useRef<KonvaShape[]>();
    shapesRef.current = shapes;

    const { saveHistory } = useHistory();
    const { tool, setTool } = useTool();
    const { handleInsertImage } = useToolActions();

    const isDrawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isGroupDraggingRef = useRef(false);
    const dragInfoRef = useRef<{ startX: number, startY: number, initialPositions: Map<string, {x: number, y: number}> } | null>(null);
    const clipboardRef = useRef<KonvaShape[]>([]);
    const selectionStartPos = useRef({ x: 0, y: 0 });
    const lastPointerPosition = useRef({ x: 0, y: 0 });
    const mouseDownPos = useRef({ x: 0, y: 0 });

    const getRelativePointerPosition = (stage: Konva.Stage) => {
        const pointer = stage.getPointerPosition();
        if (!pointer) return null;
        return stage.getAbsoluteTransform().copy().invert().point(pointer);
    };

    const snapToGrid = useCallback((value: number) => {
        if (!isSnappingEnabled) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [isSnappingEnabled, gridSize]);

    useEffect(() => {
        const stageNode = stageRef.current;
        if (!stageNode) return;
        const container = stageNode.container();
        if (isPanningRef.current) {
            container.style.cursor = 'grabbing';
        } else {
            switch (tool) {
                case 'select': container.style.cursor = 'default'; break;
                case 'circle': case 'rectangle': container.style.cursor = 'crosshair'; break;
                case 'insert-image': container.style.cursor = 'copy'; break;
                default: container.style.cursor = 'default';
            }
        }
    }, [tool, stageRef]);

    const handleDelete = useCallback(() => {
        if (selectedShapeIds.length > 0) removeShapes(selectedShapeIds, (updated) => saveHistory(updated));
    }, [selectedShapeIds, removeShapes, saveHistory]);

    const handleCopy = useCallback(() => {
        if (selectedShapeIds.length > 0) clipboardRef.current = shapes.filter(s => selectedShapeIds.includes(s.id));
    }, [selectedShapeIds, shapes]);

    const handlePaste = useCallback(() => {
        if (clipboardRef.current.length === 0) return;
        const newShapes = clipboardRef.current.map(shape => ({ ...shape, id: crypto.randomUUID(), x: shape.x + 20, y: shape.y + 20 }));
        let currentShapes = shapesRef.current || [];
        newShapes.forEach(shape => addShape(shape, (updated) => { currentShapes = updated; }));
        setTimeout(() => {
            saveHistory(currentShapes);
            setSelectedShapeIds(newShapes.map(s => s.id));
        }, 100);
    }, [addShape, saveHistory, setSelectedShapeIds]);

    const handleCut = useCallback(() => {
        handleCopy();
        handleDelete();
    }, [handleCopy, handleDelete]);


    const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        const draggedId = e.target.id();
        // Check if the dragged shape is part of a multi-selection
        if (selectedShapeIds.length > 1 && selectedShapeIds.includes(draggedId)) {
            isGroupDraggingRef.current = true;
            const initialPositions = new Map<string, {x: number, y: number}>();
            selectedShapeIds.forEach(id => {
                const node = shapeNodesRef.current?.get(id);
                if (node) initialPositions.set(id, { x: node.x(), y: node.y() });
            });
            dragInfoRef.current = { startX: e.target.x(), startY: e.target.y(), initialPositions };
        } else {
            // For single selected shape or unselected shape, let Konva handle the drag visually.
            // The update will happen in handleDragEnd's else block.
            isGroupDraggingRef.current = false; // Ensure it's false for individual drags
        }
    }, [selectedShapeIds, shapeNodesRef]);

    const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        if (isGroupDraggingRef.current && dragInfoRef.current) {
            const { startX, startY, initialPositions } = dragInfoRef.current;
            const dx = e.target.x() - startX;
            const dy = e.target.y() - startY;
            selectedShapeIds.forEach(id => {
                const node = shapeNodesRef.current?.get(id);
                const initialPos = initialPositions.get(id);
                if (node && initialPos) {
                    node.x(snapToGrid(initialPos.x + dx));
                    node.y(snapToGrid(initialPos.y + dy));
                }
            });
        } else {
             e.target.x(snapToGrid(e.target.x()));
             e.target.y(snapToGrid(e.target.y()));
        }
    }, [selectedShapeIds, shapeNodesRef, snapToGrid]);

    const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        if (isGroupDraggingRef.current) {
            const updates = selectedShapeIds.map(id => {
                const node = shapeNodesRef.current?.get(id);
                if (node) {
                    return { id, props: { x: node.x(), y: node.y() } };
                }
                return null;
            }).filter(Boolean);
            updateMultipleShapes(updates as { id: string; props: Partial<KonvaShape> }[], (updated) => saveHistory(updated));
            isGroupDraggingRef.current = false; // Reset group dragging flag
        } else {
            // Single shape drag
            const newShapes = shapes.map(s => s.id === e.target.id() ? { ...s, x: e.target.x(), y: e.target.y() } : s);
            setAllShapes(newShapes);
            saveHistory(newShapes);
        }
    }, [saveHistory, setAllShapes, shapes, selectedShapeIds, shapeNodesRef, updateMultipleShapes]);

    const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stageNode = stageRef.current;
        if (!stageNode) return;

        // Panning with right-click
        if (e.evt.button === 2) {
            isPanningRef.current = true;
            lastPointerPosition.current = stageNode.getPointerPosition() || { x: 0, y: 0 };
            return;
        }

        const pos = getRelativePointerPosition(stageNode);
        if (!pos) return;

        

        // Logic based on current tool
        switch (tool) {
            case 'select':
                if (e.target === stageNode) {
                    isDrawingRef.current = true; // Reusing isDrawingRef for selection
                    selectionRectRef.current?.x(pos.x);
                    selectionRectRef.current?.y(pos.y);
                    selectionRectRef.current?.width(0);
                    selectionRectRef.current?.height(0);
                    selectionRectRef.current?.visible(true);
                    selectionStartPos.current = pos;
                }
                break;
            case 'insert-image':
                handleInsertImage();
                setTool('select');
                break;
            case 'circle':
            case 'rectangle':
                if (!stageNode) return;
                if (!pos) return;

                isDrawingRef.current = true;
                mouseDownPos.current = pos;

                const commonProps = {
                    x: pos.x,
                    y: pos.y,
                    fill: 'rgba(59,130,246,0.2)',
                    stroke: '#3b82f6',
                    strokeWidth: 2,
                    draggable: true,
                };

                if (tool === 'circle') {
                    addShape({ type: 'circle', radius: 0, ...commonProps });
                } else {
                    addShape({ type: 'rect', width: 0, height: 0, ...commonProps });
                }
                break;
        }
    }, [selectionRectRef, stageRef, tool, addShape, handleInsertImage, setTool]);

    const handleMouseMove = useCallback(() => {
        const stageNode = stageRef.current;
        if (!stageNode) return;

        // Panning logic
        if (isPanningRef.current) {
            const newPointerPos = stageNode.getPointerPosition();
            if (!newPointerPos) return;
            const dx = newPointerPos.x - lastPointerPosition.current.x;
            const dy = newPointerPos.y - lastPointerPosition.current.y;
            setStage(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastPointerPosition.current = newPointerPos;
            return;
        }

        // Do nothing if we didn't start drawing or selecting
        if (!isDrawingRef.current) {
            return;
        }

        const pos = getRelativePointerPosition(stageNode);
        if (!pos) return;

        switch (tool) {
            case 'select':
                selectionRectRef.current?.setAttrs({
                    x: Math.min(selectionStartPos.current.x, pos.x),
                    y: Math.min(selectionStartPos.current.y, pos.y),
                    width: Math.abs(pos.x - selectionStartPos.current.x),
                    height: Math.abs(pos.y - selectionStartPos.current.y),
                });
                break;
            case 'circle':
                const currentShapes = shapesRef.current;
                if (!currentShapes || currentShapes.length === 0) return;
                const lastShape = currentShapes[currentShapes.length - 1] ;
                if (!lastShape || lastShape.type !== 'circle') return;
                updateShape(lastShape.id, { radius: Math.hypot(pos.x - lastShape.x, pos.y - lastShape.y) });
                break;
            case 'rectangle':
                const currentRectShapes = shapesRef.current;
                if (!currentRectShapes || currentRectShapes.length === 0) return;
                const lastRectShape = currentRectShapes[currentRectShapes.length - 1];
                if (!lastRectShape || lastRectShape.type !== 'rect') return;
                const newWidth = pos.x - lastRectShape.x;
                const newHeight = pos.y - lastRectShape.y;
                updateShape(lastRectShape.id, { x: newWidth < 0 ? pos.x : lastRectShape.x, y: newHeight < 0 ? pos.y : lastRectShape.y, width: Math.abs(newWidth), height: Math.abs(newHeight) });
                break;
            default:
                break;
        }
    }, [selectionRectRef, stageRef, setStage, tool, shapesRef, updateShape]);

    const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // Stop panning
        if (isPanningRef.current && e.evt.button === 2) {
            isPanningRef.current = false;
            return;
        }

        // Do nothing if we didn't start drawing or selecting
        if (!isDrawingRef.current) {
            return;
        }
        isDrawingRef.current = false;

        switch (tool) {
            case 'select':
                // Update visibility in timeout, so we can check it in click event
                setTimeout(() => {
                    selectionRectRef.current?.visible(false);
                });

                const selBox = selectionRectRef.current?.getClientRect();
                if (!selBox) return;

                const selected = shapes.filter(shape => {
                    // Check if rectangle intersects with selection box
                    const node = shapeNodesRef.current?.get(shape.id);
                    if (!node) return false;
                    return Konva.Util.haveIntersection(selBox, node.getClientRect());
                });

                setSelectedShapeIds(selected.map(shape => shape.id));
                break;
            case 'circle':
            case 'rectangle':
                const currentShapes = shapesRef.current;
                if (!currentShapes) return;
                const lastShape = currentShapes[currentShapes.length - 1];
                if (lastShape) {
                    // Remove shape if it's too small (e.g., just a click)
                    if ((lastShape.type === 'circle' && lastShape.radius === 0) ||
                        (lastShape.type === 'rect' && (lastShape.width === 0 || lastShape.height === 0))) {
                        removeShapes([lastShape.id]);
                    } else {
                        saveHistory(currentShapes);
                        setSelectedShapeIds([lastShape.id]);
                        setTool('select'); // Switch to select tool after drawing
                    }
                }
                break;
            default:
                break;
        }
    }, [shapes, removeShapes, saveHistory, setSelectedShapeIds, selectionRectRef, shapeNodesRef, tool, setTool]);
    
    const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => e.evt.preventDefault(), []);

    return { handleMouseDown, handleMouseMove, handleMouseUp, handleDragStart, handleDragMove, handleDragEnd, handleDelete, handleCopy, handlePaste, handleCut, handleContextMenu };
};