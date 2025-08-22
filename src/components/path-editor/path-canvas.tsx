
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Group, Text, Rect } from 'react-konva';
import { PathGroup, PathSegment } from '@/types/gcode-path';
import Konva from 'konva';

interface PathCanvasProps {
    pathGroups: PathGroup[];
    selectedSegmentId: string | null;
    selectedGroupId: string | null;
    selectedEndpoint: 'start' | 'end' | null;
    tool: 'select' | 'add' | 'delete' | 'split' | 'merge';
    workArea: { width: number; height: number };
    onSegmentSelect: (segmentId: string) => void;
    onGroupSelect: (groupId: string) => void;
    onEndpointDrag: (segmentId: string, endpoint: 'start' | 'end', newPos: { x: number; y: number }) => void;
    onSegmentSplit: (segmentId: string, splitPoint: { x: number; y: number }) => void;
    onAddSegment: (groupId: string, segmentData: { start: { x: number; y: number }; end: { x: number; y: number }; type: 'G0' | 'G1' }) => void;
}

export function PathCanvas({
                               pathGroups,
                               selectedSegmentId,
                               selectedGroupId,
                               selectedEndpoint,
                               tool,
                               workArea,
                               onSegmentSelect,
                               onGroupSelect,
                               onEndpointDrag,
                               onSegmentSplit,
                               onAddSegment
                           }: PathCanvasProps) {
    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
    const [scale, setScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const [addingSegment, setAddingSegment] = useState<{
        start: { x: number; y: number };
        current: { x: number; y: number };
        groupId: string;
    } | null>(null);

    const stageRef = useRef<Konva.Stage>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 컨테이너 크기 조정
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setStageSize({ width: rect.width, height: rect.height });
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 좌표계 변환 (워크 영역을 캔버스에 맞추기)
    const workToCanvas = useCallback((point: { x: number; y: number }) => {
        const padding = 50;
        const availableWidth = stageSize.width - padding * 2;
        const availableHeight = stageSize.height - padding * 2;

        return {
            x: padding + (point.x / workArea.width) * availableWidth,
            y: padding + (point.y / workArea.height) * availableHeight
        };
    }, [stageSize, workArea]);

    const canvasToWork = useCallback((point: { x: number; y: number }) => {
        const padding = 50;
        const availableWidth = stageSize.width - padding * 2;
        const availableHeight = stageSize.height - padding * 2;

        return {
            x: ((point.x - padding) / availableWidth) * workArea.width,
            y: ((point.y - padding) / availableHeight) * workArea.height
        };
    }, [stageSize, workArea]);

    // 세그먼트 렌더링
    const renderSegment = (segment: PathSegment, groupId: string, isSelected: boolean) => {
        const startCanvas = workToCanvas(segment.start);
        const endCanvas = workToCanvas(segment.end);
        const isG0 = segment.type === 'G0';

        const strokeColor = isSelected ? '#3b82f6' : (isG0 ? '#ef4444' : '#10b981');
        const strokeWidth = isSelected ? 3 : 2;
        const dashEnabled = isG0;

        return (
            <Group key={segment.id}>
                {/* 세그먼트 라인 */}
                <Line
                    points={[startCanvas.x, startCanvas.y, endCanvas.x, endCanvas.y]}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    dash={dashEnabled ? [5, 5] : undefined}
                    onClick={() => onSegmentSelect(segment.id)}
                    onTap={() => onSegmentSelect(segment.id)}
                    onDblClick={() => {
                        if (tool === 'split') {
                            const midPoint = {
                                x: (segment.start.x + segment.end.x) / 2,
                                y: (segment.start.y + segment.end.y) / 2
                            };
                            onSegmentSplit(segment.id, midPoint);
                        }
                    }}
                />

                {/* 시작점 */}
                {isSelected && (
                    <Circle
                        x={startCanvas.x}
                        y={startCanvas.y}
                        radius={6}
                        fill={selectedEndpoint === 'start' ? '#f59e0b' : '#6b7280'}
                        stroke="#ffffff"
                        strokeWidth={2}
                        draggable
                        onDragMove={(e) => {
                            const newPos = canvasToWork({ x: e.target.x(), y: e.target.y() });
                            onEndpointDrag(segment.id, 'start', newPos);
                        }}
                        onClick={() => onSegmentSelect(segment.id)}
                    />
                )}

                {/* 끝점 */}
                {isSelected && (
                    <Circle
                        x={endCanvas.x}
                        y={endCanvas.y}
                        radius={6}
                        fill={selectedEndpoint === 'end' ? '#f59e0b' : '#6b7280'}
                        stroke="#ffffff"
                        strokeWidth={2}
                        draggable
                        onDragMove={(e) => {
                            const newPos = canvasToWork({ x: e.target.x(), y: e.target.y() });
                            onEndpointDrag(segment.id, 'end', newPos);
                        }}
                        onClick={() => onSegmentSelect(segment.id)}
                    />
                )}

                {/* 방향 화살표 */}
                {isSelected && (
                    <Line
                        points={[
                            endCanvas.x - 10,
                            endCanvas.y - 5,
                            endCanvas.x,
                            endCanvas.y,
                            endCanvas.x - 10,
                            endCanvas.y + 5
                        ]}
                        stroke={strokeColor}
                        strokeWidth={2}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}
            </Group>
        );
    };

    // 캔버스 클릭 핸들러
    const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) {
            // 빈 영역 클릭
            onSegmentSelect('');
            onGroupSelect('');

            // 세그먼트 추가 모드
            if (tool === 'add' && selectedGroupId) {
                const pos = e.target.getStage()!.getPointerPosition();
                if (pos) {
                    const workPos = canvasToWork(pos);

                    if (!addingSegment) {
                        setAddingSegment({
                            start: workPos,
                            current: workPos,
                            groupId: selectedGroupId
                        });
                    } else {
                        // 세그먼트 완료
                        onAddSegment(addingSegment.groupId, {
                            start: addingSegment.start,
                            end: workPos,
                            type: 'G1'
                        });
                        setAddingSegment(null);
                    }
                }
            }
        }
    }, [tool, selectedGroupId, addingSegment, canvasToWork, onSegmentSelect, onGroupSelect, onAddSegment]);

    // 마우스 이동 핸들러 (세그먼트 추가 시 미리보기)
    const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (addingSegment && tool === 'add') {
            const pos = e.target.getStage()!.getPointerPosition();
            if (pos) {
                const workPos = canvasToWork(pos);
                setAddingSegment(prev => prev ? { ...prev, current: workPos } : null);
            }
        }
    }, [addingSegment, tool, canvasToWork]);

    return (
        <div ref={containerRef} className="w-full h-full bg-gray-50">
            <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={scale}
                scaleY={scale}
                x={stagePos.x}
                y={stagePos.y}
                onClick={handleStageClick}
                onMouseMove={handleStageMouseMove}
                draggable
                onDragEnd={(e) => {
                    setStagePos({ x: e.target.x(), y: e.target.y() });
                }}
                onWheel={(e) => {
                    e.evt.preventDefault();
                    const scaleBy = 1.1;
                    const stage = e.target.getStage()!;
                    const oldScale = stage.scaleX();
                    const pointer = stage.getPointerPosition()!;

                    const mousePointTo = {
                        x: (pointer.x - stage.x()) / oldScale,
                        y: (pointer.y - stage.y()) / oldScale,
                    };

                    const newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
                    setScale(newScale);

                    const newPos = {
                        x: pointer.x - mousePointTo.x * newScale,
                        y: pointer.y - mousePointTo.y * newScale,
                    };
                    setStagePos(newPos);
                }}
            >
                <Layer>
                    {/* 작업 영역 경계 */}
                    <Rect
                        x={50}
                        y={50}
                        width={stageSize.width - 100}
                        height={stageSize.height - 100}
                        stroke="#d1d5db"
                        strokeWidth={2}
                        fill="transparent"
                        dash={[10, 5]}
                    />

                    {/* 작업 영역 라벨 */}
                    <Text
                        x={60}
                        y={30}
                        text={`작업 영역: ${workArea.width} × ${workArea.height}mm`}
                        fontSize={14}
                        fill="#6b7280"
                    />

                    {/* 경로 그룹들 */}
                    {pathGroups.filter(group => group.visible).map(group => (
                        <Group key={group.id}>
                            {group.segments.map(segment =>
                                renderSegment(
                                    segment,
                                    group.id,
                                    segment.id === selectedSegmentId
                                )
                            )}
                        </Group>
                    ))}

                    {/* 세그먼트 추가 미리보기 */}
                    {addingSegment && tool === 'add' && (
                        <Line
                            points={[
                                ...workToCanvas(addingSegment.start),
                                ...workToCanvas(addingSegment.current)
                            ].map(p => typeof p === 'number' ? p : p.x || p.y)}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dash={[3, 3]}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
}