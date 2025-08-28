'use client';

import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { Layer, Group, Line, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useCanvas } from '@/contexts/canvas-context';
import { usePathEvents } from '@/hooks/use-path-events';
import { usePathMovement } from '@/hooks/path/use-path-movement';
import { addPathGroup, updatePathGroups, removePathGroup } from '@/store/slices/path-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import type { PathGroup, PathSegment } from '@/types/path';
import { PathCalculator } from '@/lib/gcode/path-calculator';
import { useSettings } from '@/contexts/settings-context';

interface PathLayerProps {
    isPanning?: boolean;
}

export function PathLayer({ isPanning = false }: PathLayerProps) {
    const layerRef = useRef<Konva.Layer>(null);

    // Redux 상태
    const dispatch = useAppDispatch();
    const { pathGroups, selectedPathId, selectedSegmentId } = useAppSelector((s) => s.paths);
    const shapes = useAppSelector((s) => s.shapes.shapes) as CustomShapeConfig[];

    // 캔버스 컨텍스트
    const { stage } = useCanvas();
    const { gcodeSettings } = useSettings();

    // 이벤트 훅
    const pathEvents = usePathEvents();
    const { handleEndpointDrag, handleDragStart, handleDragMove, handleDragEnd } = usePathMovement();

    const canvasScale = useMemo(() => Math.abs(stage.scaleX || 1) || 1, [stage.scaleX]);

    useEffect(() => {
        layerRef.current?.batchDraw();
    }, [selectedPathId, selectedSegmentId, pathGroups]);

    const strokeWidthFor = useCallback((base: number) => base / canvasScale, [canvasScale]);

    // =================== Path 생성/동기화(useEffect) ===================
    const timersRef = useRef<Map<string, number>>(new Map());
    const prevSnapRef = useRef<Map<string, string>>(new Map());

    const groupIdOf = useCallback((shapeId: string) => `${shapeId}-path`, []);

    const toSegments = useCallback((pairs: { start: { x: number; y: number }, end: { x: number; y: number } }[], groupId: string): PathSegment[] => {
        return pairs.map((p, i) => ({
            id: `${groupId}-seg-${i}`,
            type: 'line',
            start: { x: p.start.x, y: p.start.y },
            end: { x: p.end.x, y: p.end.y },
        }));
    }, []);

    const shapeSnapshot = useCallback((shape: CustomShapeConfig) => {
        // Path에 영향 주는 핵심 속성만 포함
        return JSON.stringify({
            id: shape.id,
            type: shape.type,
            x: shape.x, y: shape.y,
            width: shape.width, height: shape.height, radius: shape.radius,
            rotation: shape.rotation, scaleX: shape.scaleX, scaleY: shape.scaleY,
            visible: shape.visible,
            coatingType: shape.coatingType,
            lineSpacing: shape.lineSpacing,
            coatingWidth: shape.coatingWidth,
            outlinePasses: shape.outlinePasses,
            outlineInterval: shape.outlineInterval,
            fillPattern: shape.fillPattern,
        });
    }, []);

    useEffect(() => {
        // Path 편집 페이지처럼, 레이어가 마운트되어 있을 때만 동기화
        // 1) 삭제된 Shape의 PathGroup 제거
        const currentIds = new Set(shapes.map(s => s.id!).filter(Boolean));
        const removable = pathGroups
            .filter(g => g.id.endsWith('-path'))
            .filter(g => {
                const shapeId = g.id.replace(/-path$/, '');
                return !currentIds.has(shapeId);
            });
        for (const g of removable) {
            dispatch(removePathGroup(g.id));
        }

        // 2) 변경된 Shape만 선별
        const prevSnap = prevSnapRef.current;
        const currSnap = new Map<string, string>();
        const changed: CustomShapeConfig[] = [];

        for (const s of shapes) {
            if (!s.id) continue;
            // 필요 시 제외 규칙(이미지/그룹 등)
            if (s.type === 'image' || s.type === 'group') continue;

            const snap = shapeSnapshot(s);
            currSnap.set(s.id, snap);
            if (prevSnap.get(s.id) !== snap) {
                changed.push(s);
            }
        }

        // 3) 디바운스 스케줄
        const schedule = (shape: CustomShapeConfig, delay: number) => {
            const id = shape.id!;
            const tOld = timersRef.current.get(id);
            if (tOld) window.clearTimeout(tOld);

            const timer = window.setTimeout(async () => {
                try {
                    if (!gcodeSettings) {
                        // 설정 없으면 생성을 스킵
                        return;
                    }

                    const calc = new PathCalculator({ settings: gcodeSettings });
                    const pairs = await calc.calculateForShape(shape);
                    const groupId = groupIdOf(id);
                    const segments = toSegments(pairs ?? [], groupId);

                    const exists = pathGroups.some(g => g.id === groupId);
                    const base = {
                        id: groupId,
                        name: `${shape.name || shape.type || 'Shape'} Path`,
                        color: '#1976d2',
                        visible: shape.visible !== false,
                        tool: 'pen',
                        speed: 1000,
                        power: 100,
                        passes: 1,
                    };

                    if (exists) {
                        dispatch(updatePathGroups([{
                            id: groupId,
                            name: base.name,
                            visible: base.visible,
                            segments,
                        }]));
                    } else {
                        dispatch(addPathGroup({ ...base, segments } as PathGroup));
                    }
                } catch (e) {
                    // 개별 실패는 무시
                } finally {
                    timersRef.current.delete(id);
                }
            }, delay);

            timersRef.current.set(id, timer as unknown as number);
        };

        for (const s of changed) {
            const immediate = !prevSnap.has(s.id!); // 신규는 즉시 처리
            schedule(s, immediate ? 0 : 120);
        }

        // 스냅샷 저장
        prevSnapRef.current = currSnap;

        // 언마운트 시 타이머 정리
        return () => {
            // 레이어 언마운트 시 모든 타이머 제거
            timersRef.current.forEach((t) => window.clearTimeout(t));
            timersRef.current.clear();
        };
    }, [dispatch, shapes, pathGroups, shapeSnapshot, groupIdOf, toSegments, gcodeSettings]);

    // =================== 렌더링 ===================

    const renderSegment = useCallback(
        (segment: any, groupId: string, isSelected: boolean) => {
            const isLine = segment && (('start' in segment && 'end' in segment) || (segment.start && segment.end));
            const isPoint = !isLine && ('x' in segment) && ('y' in segment);

            const baseColor = '#10b981';
            const moveColor = '#ef4444';
            const selectedColor = '#3b82f6';

            const strokeColor = isSelected ? selectedColor : (segment.type === 'G0' ? moveColor : baseColor);

            if (isLine) {
                const sx = segment.start?.x ?? 0;
                const sy = segment.start?.y ?? 0;
                const ex = segment.end?.x ?? 0;
                const ey = segment.end?.y ?? 0;

                return (
                    <Group key={segment.id}>
                        <Line
                            points={[sx, sy, ex, ey]}
                            stroke={strokeColor}
                            strokeWidth={strokeWidthFor(isSelected ? 3 : 2)}
                            dash={segment.type === 'G0' ? [5 / canvasScale, 5 / canvasScale] : undefined}
                            draggable={isSelected && !isPanning}
                            onDragStart={() => handleDragStart(segment.id)}
                            onDragMove={handleDragMove}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                                e.cancelBubble = true;
                                pathEvents.handleSelect({
                                    ...e,
                                    target: e.target,
                                } as any);
                            }}
                            listening={!isPanning}
                        />

                        {isSelected && (
                            <>
                                <Circle
                                    x={sx}
                                    y={sy}
                                    radius={6 / canvasScale}
                                    fill="#6b7280"
                                    stroke="#ffffff"
                                    strokeWidth={strokeWidthFor(2)}
                                    draggable={!isPanning}
                                    onDragMove={(e) => {
                                        const pos = { x: e.target.x(), y: e.target.y() };
                                        handleEndpointDrag(segment.id, 'start', pos);
                                    }}
                                    listening={!isPanning}
                                />
                                <Circle
                                    x={ex}
                                    y={ey}
                                    radius={6 / canvasScale}
                                    fill="#f59e0b"
                                    stroke="#ffffff"
                                    strokeWidth={strokeWidthFor(2)}
                                    draggable={!isPanning}
                                    onDragMove={(e) => {
                                        const pos = { x: e.target.x(), y: e.target.y() };
                                        handleEndpointDrag(segment.id, 'end', pos);
                                    }}
                                    listening={!isPanning}
                                />
                                <Line
                                    points={[
                                        ex - 10 / canvasScale,
                                        ey - 5 / canvasScale,
                                        ex,
                                        ey,
                                        ex - 10 / canvasScale,
                                        ey + 5 / canvasScale
                                    ]}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidthFor(2)}
                                    lineCap="round"
                                    lineJoin="round"
                                    listening={false}
                                />
                            </>
                        )}
                    </Group>
                );
            }

            if (isPoint) {
                const x = segment.x ?? 0;
                const y = segment.y ?? 0;
                return (
                    <Circle
                        key={segment.id}
                        x={x}
                        y={y}
                        radius={isSelected ? 5 / canvasScale : 4 / canvasScale}
                        fill={isSelected ? selectedColor : baseColor}
                        stroke="#ffffff"
                        strokeWidth={strokeWidthFor(1)}
                        draggable={!isPanning}
                        onDragStart={() => handleDragStart(segment.id)}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            pathEvents.handleSelect({
                                ...e,
                                target: e.target,
                            } as any);
                        }}
                        listening={!isPanning}
                    />
                );
            }

            return null;
        },
        [canvasScale, handleDragEnd, handleDragMove, handleDragStart, isPanning, pathEvents, strokeWidthFor]
    );

    const renderGroup = useCallback(
        (group: any) => {
            if (group.visible === false) return null;

            const isGroupSelected = selectedPathId === group.id;

            return (
                <Group key={`path-group-${group.id}`} listening={!isPanning}>
                    {!group.segments?.length && (
                        <Rect
                            x={-10000}
                            y={-10000}
                            width={20000}
                            height={20000}
                            opacity={0}
                            onClick={(e) => {
                                e.cancelBubble = true;
                                pathEvents.handleSelect({
                                    ...e,
                                    target: { id: () => group.id } as any
                                } as any);
                            }}
                            listening={!isPanning}
                        />
                    )}

                    {(group.segments || []).map((seg: any) =>
                        renderSegment(seg, group.id, seg.id === selectedSegmentId)
                    )}

                    {isGroupSelected && !selectedSegmentId && group.segments?.length > 0 && (
                        <Group listening={false} />
                    )}
                </Group>
            );
        },
        [isPanning, pathEvents, renderSegment, selectedPathId, selectedSegmentId]
    );

    return (
        <Layer ref={layerRef}>
            {pathGroups.map(renderGroup)}
        </Layer>
    );
}