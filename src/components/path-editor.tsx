'use client';

import React, {useCallback, useRef, useState} from 'react';
import {Stage, Layer, Line, Circle, Group} from 'react-konva';
import Konva from 'konva';
import {PathGroup} from '@/types/gcode-path';
import {usePathEditor} from '@/hooks/use-path-editor';
import {Button} from '@/components/ui/button';
import {Trash2, Plus, Move, RotateCcw} from 'lucide-react';


interface PathEditorProps {
    initialPaths: PathGroup[];
    onPathsChange: (paths: PathGroup[]) => void;
    workArea: { width: number; height: number };
}

export default function PathEditor({initialPaths, onPathsChange, workArea}: PathEditorProps) {
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);

    const {
        pathGroups,
        selectedSegmentId,
        selectedEndpoint, // 'start' | 'end' | null
        tool, // 'select' | 'add' | 'delete'
        handleSegmentSelect,
        handleEndpointDrag,
        handleSegmentDelete,
        handleAddSegment,
        handleUndo,
        handleRedo,
        setTool,
    } = usePathEditor(initialPaths, onPathsChange);

    const [draggedPoint, setDraggedPoint] = useState<{
        segmentId: string;
        endpoint: 'start' | 'end';
    } | null>(null);

    // 세그먼트 렌더링
    const renderSegments = useCallback(() => {
        return pathGroups.flatMap(group =>
            group.visible ? group.segments.map(segment => (
                <Group key={segment.id}>
                    {/* 경로 라인 */}
                    <Line
                        points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                        stroke={segment.type === 'G1' ? '#00ff88' : '#ff6600'}
                        strokeWidth={selectedSegmentId === segment.id ? 4 : 2}
                        listening={true}
                        onClick={() => handleSegmentSelect(segment.id)}
                        onTap={() => handleSegmentSelect(segment.id)}
                    />

                    {/* 시작점 핸들 */}
                    <Circle
                        x={segment.start.x}
                        y={segment.start.y}
                        radius={selectedSegmentId === segment.id ? 8 : 6}
                        fill={selectedEndpoint === 'start' && selectedSegmentId === segment.id ? '#ff4444' : '#4444ff'}
                        stroke="#fff"
                        strokeWidth={2}
                        draggable={selectedSegmentId === segment.id && tool === 'select'}
                        onDragStart={() => setDraggedPoint({segmentId: segment.id, endpoint: 'start'})}
                        onDragMove={(e) => {
                            if (draggedPoint?.segmentId === segment.id && draggedPoint?.endpoint === 'start') {
                                handleEndpointDrag(segment.id, 'start', {x: e.target.x(), y: e.target.y()});
                            }
                        }}
                        onDragEnd={() => setDraggedPoint(null)}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            handleSegmentSelect(segment.id);
                        }}
                    />

                    {/* 종료점 핸들 */}
                    <Circle
                        x={segment.end.x}
                        y={segment.end.y}
                        radius={selectedSegmentId === segment.id ? 8 : 6}
                        fill={selectedEndpoint === 'end' && selectedSegmentId === segment.id ? '#ff4444' : '#44ff44'}
                        stroke="#fff"
                        strokeWidth={2}
                        draggable={selectedSegmentId === segment.id && tool === 'select'}
                        onDragStart={() => setDraggedPoint({segmentId: segment.id, endpoint: 'end'})}
                        onDragMove={(e) => {
                            if (draggedPoint?.segmentId === segment.id && draggedPoint?.endpoint === 'end') {
                                handleEndpointDrag(segment.id, 'end', {x: e.target.x(), y: e.target.y()});
                            }
                        }}
                        onDragEnd={() => setDraggedPoint(null)}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            handleSegmentSelect(segment.id);
                        }}
                    />
                </Group>
            )) : []
        );
    }, [pathGroups, selectedSegmentId, selectedEndpoint, tool, draggedPoint, handleSegmentSelect, handleEndpointDrag]);

    // 새 세그먼트 추가 (더블클릭)
    const handleStageDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (tool !== 'add') return;

        const stage = e.target.getStage();
        if (!stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        // 이전 세그먼트의 끝점에서 새 세그먼트 시작
        const lastSegment = pathGroups[0]?.segments[pathGroups[0].segments.length - 1];
        const startPoint = lastSegment ? lastSegment.end : pos;

        handleAddSegment({
            start: startPoint,
            end: pos,
            type: 'G1'
        });
    }, [tool, pathGroups, handleAddSegment]);

    return (
        <div className="flex flex-col h-full">
            {/* 툴바 */}
            <div className="flex gap-2 p-4 bg-background border-b">
                <Button
                    variant={tool === 'select' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool('select')}
                >
                    <Move className="w-4 h-4 mr-2"/>
                    선택/이동
                </Button>

                <Button
                    variant={tool === 'add' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool('add')}
                >
                    <Plus className="w-4 h-4 mr-2"/>
                    세그먼트 추가
                </Button>

                <Button
                    variant={tool === 'delete' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTool('delete')}
                    disabled={!selectedSegmentId}
                >
                    <Trash2 className="w-4 h-4 mr-2"/>
                    삭제
                </Button>

                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleUndo}>
                        <RotateCcw className="w-4 h-4 mr-2"/>
                        실행 취소
                    </Button>

                    <Button variant="outline" size="sm" onClick={handleRedo}>
                        <RotateCcw className="w-4 h-4 mr-2 scale-x-[-1]"/>
                        다시 실행
                    </Button>
                </div>
            </div>

            {/* 캔버스 */}
            <div className="flex-1 bg-gray-100">
                <Stage
                    ref={stageRef}
                    width={workArea.width}
                    height={workArea.height}
                    draggable={tool === 'select'}
                    onDblClick={handleStageDoubleClick}
                >
                    <Layer ref={layerRef}>
                        {/* 격자 (선택적) */}
                        {/* <Grid /> */}

                        {/* 경로 세그먼트들 */}
                        {renderSegments()}
                    </Layer>
                </Stage>
            </div>
        </div>
    );
}