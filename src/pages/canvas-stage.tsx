'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Transformer, Circle, Image } from 'react-konva';
import type Konva from 'konva';

import {ImageShape, KonvaShape, useShapeContext} from '@/contexts/shape-context';
import { useHistory } from '@/contexts/history-context';
import { useTool } from '@/contexts/tool-context';
import { useCanvasView } from '@/hooks/use-canvas-view';
import { useCanvasInteractions } from '@/hooks/use-canvas-interactions';
import { useSettings } from '@/contexts/settings-context';
import { useGrid } from '@/hooks/use-grid';

import { GCodeSettingsDialog } from "@/components/gcode/gcode-settings-dialog";
import { Toolbar } from "@/components/tool/toolbar";


export default function CanvasStage() {
    const {
        shapes,
        selectedShapeIds,
        updateShape,
        unselectAllShapes,
        setSelectedShapeIds,
        updateMultipleShapes
    } = useShapeContext();
    const {saveHistory, undo, redo} = useHistory();
    const {tool} = useTool();
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const selectionRectRef = useRef<Konva.Rect>(null);
    const shapeNodesRef = useRef<Map<string, Konva.Shape>>(new Map());

    const {isGridVisible, gridSize} = useSettings();
    const {stage, setStage, canvasSize, handleWheel} = useCanvasView();
    const gridLayer = useGrid(stage, gridSize, canvasSize);
    const [isGCodeDialogOpen, setGCodeDialogOpen] = useState(false);

    useEffect(() => {
        if (transformerRef.current) {
            const selectedNodes = selectedShapeIds.map(id => shapeNodesRef.current?.get(id)).filter(Boolean);
            transformerRef.current?.nodes(selectedNodes as Konva.Node[]);
            transformerRef.current?.getLayer()?.batchDraw();
        }
    }, [selectedShapeIds]);

    const {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleDragStart,
        handleDragEnd,
        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleContextMenu,
    } = useCanvasInteractions(stageRef, setStage, selectionRectRef, shapeNodesRef);

    const handleSelect = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (tool !== 'select') return;

        const clickedId = e.target.id();
        const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
        const isSelected = selectedShapeIds.includes(clickedId);

        if (!metaPressed && !isSelected) {
            setSelectedShapeIds([clickedId]);
        } else if (metaPressed && isSelected) {
            setSelectedShapeIds(selectedShapeIds.filter(id => id !== clickedId));
        } else if (metaPressed && !isSelected) {
            setSelectedShapeIds([...selectedShapeIds, clickedId]);
        }
    }, [tool, selectedShapeIds, setSelectedShapeIds]);

    const handleTransformEnd = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        const updates = nodes.map(node => {
            const shape = shapes.find(s => s.id === node.id());
            if (!shape) return null;

            // Get the client rect of the node after transformation
            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            const newAttrs = {
                ...shape,
                x: node.x(),
                y: node.y(),
                width: node.width() * oldScaleX, // Apply scale to width
                height: node.height() * oldScaleY, // Apply scale to height
                rotation: node.rotation(),
            };

            return newAttrs;
        }).filter(Boolean);


        updateMultipleShapes(updates.map(u => ({ id: u.id, props: u })), (updated) => saveHistory(updated));
    }, [shapes, updateMultipleShapes, saveHistory]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') handleCopy();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') handlePaste();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'x') handleCut();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') undo();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') redo();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDelete, handleCopy, handlePaste, handleCut, undo, redo]);

    return (
        <div className="flex h-screen">
            <Toolbar onGenerateGCode={() => setGCodeDialogOpen(true)}/>
            <div className="flex-1">
                <Stage
                    ref={stageRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                    onContextMenu={handleContextMenu}
                    x={stage.x}
                    y={stage.y}
                    scaleX={stage.scale}
                    scaleY={stage.scale}
                    onClick={(e) => {
                        // if click on empty area - remove all selections
                        if (e.target === e.target.getStage()) {
                            unselectAllShapes();
                        }
                    }}
                >
                    <Layer>
                        <Rect x={-stage.x / stage.scale} y={-stage.y / stage.scale}
                              width={canvasSize.width / stage.scale} height={canvasSize.height / stage.scale}
                              fill="#f0f0f0" listening={false}/>
                    </Layer>
                    {isGridVisible && gridLayer}
                    <Layer>
                        {shapes.map((shape) => {
                            const isSelected = selectedShapeIds.includes(shape.id);
                            const commonProps = {
                                key: shape.id,
                                shapeProps: shape,
                                isSelected: isSelected,
                                onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => handleSelect(e, shape.id),
                                onNodeRef: (node: Konva.Shape) => {
                                    if (node) shapeNodesRef.current.set(shape.id, node);
                                    else shapeNodesRef.current.delete(shape.id);
                                },
                                onDragStart: handleDragStart,
                                onDragEnd: handleDragEnd,
                                draggable: tool === 'select',
                            };

                            switch (shape.type) {
                                case 'rect':
                                    return <Rect
                                                 key={shape.id}
                                                 id={shape.id}
                                                 x={shape.x}
                                                 y={shape.y}
                                                 width={shape.width}
                                                 height={shape.height}
                                                 fill={shape.fill}
                                                 rotation={shape.rotation}
                                                 scaleX={shape.scaleX}
                                                 scaleY={shape.scaleY}
                                                 draggable={commonProps.draggable}
                                                 onClick={(e) => {
                                                     e.evt.preventDefault();
                                                     commonProps.onSelect(e);
                                                 }}
                                                 ref={(node) => commonProps.onNodeRef(node)}
                                                 onDragStart={commonProps.onDragStart}
                                                 onDragEnd={commonProps.onDragEnd}
                                    />
                                {/* Rect */
                                }
                                case 'circle':
                                    return <Circle
                                                   key={shape.id}
                                                   id={shape.id}
                                                   x={shape.x}
                                                   y={shape.y}
                                                   radius={shape.radius}
                                                   fill={shape.fill}
                                                   rotation={shape.rotation}
                                                   scaleX={shape.scaleX}
                                                   scaleY={shape.scaleY}
                                                   draggable={commonProps.draggable}
                                                   onClick={(e) => {
                                                       e.evt.preventDefault();
                                                       commonProps.onSelect(e);
                                                   }}
                                                   ref={(node) => commonProps.onNodeRef(node)}
                                                   onDragStart={commonProps.onDragStart}
                                                   onDragEnd={commonProps.onDragEnd}
                                    />
                                {/* Circle */}
                                case 'image':
                                {
                                return <Image
                                        key={shape.id}
                                        id={shape.id}
                                        x={shape.x}
                                        y={shape.y}
                                        width={shape.width}
                                        height={shape.height}
                                        image={shape.image}
                                        rotation={shape.rotation}
                                        scaleX={shape.scaleX}
                                        scaleY={shape.scaleY}
                                        draggable={commonProps.draggable}
                                        onClick={(e) => {
                                            e.evt.preventDefault();
                                            commonProps.onSelect(e);
                                        }}
                                        ref={(node) => commonProps.onNodeRef(node)}
                                        onDragStart={commonProps.onDragStart}
                                        onDragEnd={commonProps.onDragEnd}
                                    />
                                }
                                default:
                                    return null;
                            }
                        })}
                        <Transformer
                            ref={transformerRef}
                            onTransformEnd={handleTransformEnd}
                        />
                        <Rect ref={selectionRectRef} fill="rgba(0,0,255,0.2)" stroke="blue" strokeWidth={1}
                              dash={[4, 2]} visible={false}/>
                    </Layer>
                </Stage>
            </div>
            <GCodeSettingsDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setGCodeDialogOpen(false)}
            />
        </div>
    );
}