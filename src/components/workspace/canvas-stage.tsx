"use client";

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Transformer, Circle, Image, Group } from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { unselectAllShapes, updateShape } from '@/store/slices/shapes-slice';
import { redoWithSync, undoWithSync } from '@/store/thunks/history-thunk';

// 커스텀 훅들
import { useCanvasInteractions } from '@/hooks/use-canvas-interactions';
import { useTransformerHandlers } from '@/hooks/use-transformer-handlers';
import { useSettings } from '@/contexts/settings-context';
import { useCanvas } from '@/contexts/canvas-context';

// 컴포넌트 및 타입
import { TransformerConfig } from "konva/lib/shapes/Transformer";
import { AnyNodeConfig } from '@/types/custom-konva-config';
import CanvasGrid from "@/components/workspace/canvas-grid";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    ContextMenuLabel,
    ContextMenuShortcut
} from "@/components/ui/context-menu";
import {flipImageData} from "@/lib/flip-image-data";

// ===== 메인 컴포넌트 =====
export default function CanvasStage() {
    // Redux 상태
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const tool = useAppSelector((state) => state.tool.tool);

    // 로컬 상태
    const [isPanning, setIsPanning] = useState(false);
    const [isHoveringShape, setIsHoveringShape] = useState<string | null>(null);
    const [isCacheEnabled, setIsCacheEnabled] = useState(false);
    const [isCanvasFocused, setIsCanvasFocused] = useState(false);
    const [isContextOnShape, setIsContextOnShape] = useState(false);

    // Context에서 캔버스 상태 가져오기
    const { stageRef, canvasContainerRef, stage, setStage, setLoading } = useCanvas();

    // 설정 가져오기
    const { isGridVisible, gridSize, workArea } = useSettings();

    // 참조들
    const layerRef = useRef<Konva.Layer>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const selectionRectRef = useRef<Konva.Rect>(null);
    const imageGroupRef = useRef<Konva.Group>(null);
    const shapeGroupRef = useRef<Konva.Group>(null);

    // 변형 핸들러
    const {
        isTransforming,
        imageCache,
        handleTransformStart,
        handleTransform,
        handleTransformEnd
    } = useTransformerHandlers(transformerRef);

    // 상호작용 핸들러
    const {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleSelect,
        handleSelectAll,
        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleContextMenu,
        handleGroup,
        handleStageDragStart,
        handleStageDragMove,
        handleStageDragEnd,
        handleWheel,
    } = useCanvasInteractions(setStage, selectionRectRef, isPanning, setIsPanning);

    // ===== 계산된 값들 =====
    const selectedShapes = useMemo(() =>
            shapes.filter(shape => selectedShapeIds.includes(shape.id ?? "")),
        [shapes, selectedShapeIds]
    );

    const hasImages = useMemo(() =>
            selectedShapes.some(shape => shape.type === 'image'),
        [selectedShapes]
    );

    // 커서 스타일 결정
    const cursorStyle = useMemo(() => {
        if (isPanning) return 'grabbing';
        if (isTransforming) return 'move';

        switch (tool) {
            case 'select': return isHoveringShape ? 'move' : 'default';
            case 'rectangle':
            case 'circle': return 'crosshair';
            default: return 'default';
        }
    }, [tool, isPanning, isTransforming, isHoveringShape]);

    // 도형 분류
    const { imageShapes, otherShapes } = useMemo(() => {
        const visibleShapes = shapes.filter(s => s.visible !== false);
        return {
            imageShapes: visibleShapes.filter(s => s.type === 'image'),
            otherShapes: visibleShapes.filter(s => s.type !== 'image')
        };
    }, [shapes]);

    // Transformer 설정
    const transformerConfig: TransformerConfig = useMemo(() => ({
        anchorStyleFunc: (anchor) => {
            anchor.cornerRadius(10);
            if (anchor.hasName("top-center") || anchor.hasName("bottom-center")) {
                anchor.height(6).offsetY(3).width(26).offsetX(13);
            } else if (anchor.hasName("middle-left") || anchor.hasName("middle-right")) {
                anchor.height(26).offsetY(13).width(6).offsetX(3);
            } else if (anchor.hasName("rotater")) {
                anchor.cornerRadius(15).width(26).height(26).offsetX(13).offsetY(13);
            } else {
                anchor.width(14).offsetX(8).height(14).offsetY(8);
            }
        },
        keepRatio: false,
    }), []);


    // ===== 이미지 로딩 =====
    const loadImage = useCallback((imageDataUrl: string, shapeId?: string): HTMLImageElement | null => {
        // 캐시된 이미지 확인
        if (imageCache.current.has(imageDataUrl)) {
            const cachedImg = imageCache.current.get(imageDataUrl)!;
            if (cachedImg.complete) return cachedImg;
        }

        // 새 이미지 생성
        const img = new window.Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            // React 렌더링 사이클 밖에서 상태 변경을 예약
            setTimeout(() => {
                const shape = shapes.find(s => s.id === shapeId);
                if (shape && !shape.crop) {
                    const defaultCrop = { x: 0, y: 0, width: img.width, height: img.height };
                    if (shapeId) {
                        dispatch(updateShape({ id: shapeId, updatedProps: { crop: defaultCrop } }));
                    }
                }
                setLoading({ isLoading: false });
                layerRef.current?.batchDraw();
            }, 0);
        };

        img.onerror = (error) => {
            console.error(`❌ 이미지 로드 실패 (${shapeId}):`, error);
            imageCache.current.delete(imageDataUrl);
            setTimeout(() => {
                setLoading({ isLoading: false });
            }, 0);
        };

        // 로딩 시작은 동기적으로 실행 (렌더링 전)
        if (shapeId) {
            setLoading({ isLoading: true, message: `이미지 로딩 중... (${shapeId})` });
        }

        img.src = imageDataUrl;
        imageCache.current.set(imageDataUrl, img);
        return img.complete ? img : null;
    }, [imageCache, setLoading, shapes, dispatch]);

    // ✅ ===== 이미지 자동 뒤집기 Effect 추가 =====
    useEffect(() => {
        // isFlipped 속성이 없거나 false인 이미지들을 찾습니다.
        const imagesToFlip = shapes.filter(s =>
            s.type === 'image' && s.imageDataUrl && !s.isFlipped
        );

        // 뒤집을 이미지가 없으면 아무것도 하지 않습니다.
        if (imagesToFlip.length === 0) return;

        // 비동기 함수로 이미지들을 하나씩 처리합니다.
        const processImages = async () => {
            setLoading({ isLoading: true, message: '이미지 최적화 중...' });

            for (const shape of imagesToFlip) {
                try {
                    // 1. 이미지 데이터를 좌우로 뒤집습니다.
                    const flippedDataUrl = await flipImageData(shape.imageDataUrl!, 'horizontal');

                    // 2. 캐시에서 이전 데이터를 삭제합니다.
                    imageCache.current.delete(shape.imageDataUrl!);

                    // 3. Redux 상태를 업데이트합니다: 뒤집힌 데이터와 함께 isFlipped: true 플래그를 저장합니다.
                    dispatch(updateShape({
                        id: shape.id!,
                        updatedProps: {
                            imageDataUrl: flippedDataUrl,
                            isFlipped: true, // "뒤집기 완료" 플래그 설정
                        }
                    }));
                } catch (error) {
                    console.error(`${shape.id} 이미지 뒤집기 실패:`, error);
                    // 실패 시에도 플래그를 업데이트하여 무한 재시도를 방지
                    dispatch(updateShape({ id: shape.id!, updatedProps: { isFlipped: true } }));
                }
            }

            setLoading({ isLoading: false });
        };

        processImages();

    }, [shapes, dispatch, setLoading, imageCache]); // shapes 배열이 변경될 때마다 실행


    // ===== 도형 공통 속성 생성기 =====
    const makeCommonProps = useCallback((shape: Partial<AnyNodeConfig>) => ({
        draggable: tool === 'select' && !shape.listening,
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.evt.preventDefault();
            handleSelect(e);
        },
        onMouseEnter: () => setIsHoveringShape(shape.id!),
        onMouseLeave: () => setIsHoveringShape(null),
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        shadowColor: isHoveringShape === shape.id ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
        shadowBlur: isHoveringShape === shape.id ? 10 : 0,
        perfectDrawEnabled: false,
        listening: tool === 'select'
    }), [tool, isHoveringShape, handleSelect, handleDragStart, handleDragMove, handleDragEnd]);

    // ===== 이펙트들 =====

    // 캐시 자동 활성화 (도형 수 기반)
    useEffect(() => {
        const shapeCount = shapes.length;
        if (shapeCount >= 50 && !isCacheEnabled && !isTransforming) {
            setIsCacheEnabled(true);
        } else if (shapeCount < 50 && isCacheEnabled) {
            setIsCacheEnabled(false);
        }
    }, [shapes.length, isCacheEnabled, isTransforming]);

    // 캐시 적용 로직
    useEffect(() => {
        if (isTransforming || selectedShapeIds.length > 0) {
            // 캐시 비활성화
            imageGroupRef.current?.clearCache();
            shapeGroupRef.current?.clearCache();
            return;
        }

        if (isCacheEnabled) {
            const timeoutId = setTimeout(() => {
                try {
                    if (imageGroupRef.current?.children.length) {
                        imageGroupRef.current.cache();
                    }
                    if (shapeGroupRef.current?.children.length) {
                        shapeGroupRef.current.cache();
                    }
                    layerRef.current?.batchDraw();
                } catch (error) {
                    console.error('❌ 캐시 활성화 실패:', error);
                    setIsCacheEnabled(false);
                }
            }, 200);
            return () => clearTimeout(timeoutId);
        }
    }, [isCacheEnabled, isTransforming, selectedShapeIds.length]);

    // Transformer 노드 업데이트
    useEffect(() => {
        if (transformerRef.current) {
            const nodesToSet: Konva.Shape[] = [];
            selectedShapeIds.forEach(id => {
                const foundNode = layerRef.current?.findOne(`#${id}`);
                if (foundNode) {
                    nodesToSet.push(foundNode as Konva.Shape);
                }
            });
            transformerRef.current.nodes(nodesToSet);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [selectedShapeIds, shapes]);

    // 키보드 이벤트
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // 작업 단축키
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleDelete();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'a' && isCanvasFocused) {
                e.preventDefault();
                handleSelectAll();
                return;
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
                handleCopy();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                handlePaste();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
                handleCut();
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
                dispatch(undoWithSync());
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
                dispatch(redoWithSync());
            }
            // 도구 단축키
            else if (e.key.toLowerCase() === 'v') {
                dispatch({ type: 'tool/setTool', payload: 'select' });
            } else if (e.key.toLowerCase() === 'c') {
                dispatch({ type: 'tool/setTool', payload: 'circle' });
            } else if (e.key.toLowerCase() === 'r') {
                dispatch({ type: 'tool/setTool', payload: 'rectangle' });
            } else if (e.key === 'Escape') {
                dispatch(unselectAllShapes());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        handleDelete, handleCopy, handlePaste, handleCut, handleSelectAll,
        isCanvasFocused, dispatch
    ]);

    // ===== 이벤트 핸들러들 =====

    // 포커스 관리
    const handleCanvasFocus = useCallback(() => setIsCanvasFocused(true), []);
    const handleCanvasBlur = useCallback(() => setIsCanvasFocused(false), []);

    // 캔버스 클릭
    const handleCanvasClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        canvasContainerRef.current?.focus();
        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }
    }, [canvasContainerRef, dispatch]);

    // 컨텍스트 메뉴
    const onStageContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;
        setIsContextOnShape(e.target !== stage);
        handleContextMenu(e);
    }, [handleContextMenu]);

    // ===== 렌더링 =====
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={canvasContainerRef}
                    className="absolute inset-0"
                    tabIndex={0}
                    onFocus={handleCanvasFocus}
                    onBlur={handleCanvasBlur}
                    style={{
                        outline: 'none',
                        width: '100%',
                        height: '100%',
                        border: isCanvasFocused ? '2px solid rgba(59, 130, 246, 0.3)' : '2px solid transparent',
                        borderRadius: '8px',
                        transition: 'border-color 0.2s ease',
                        cursor: cursorStyle
                    }}
                >
                    <Stage
                        ref={stageRef}
                        width={stage.width}
                        height={stage.height}
                        scaleX={stage.scaleX}
                        scaleY={stage.scaleY}
                        x={stage.x}
                        y={stage.y}
                        onMouseDown={(e) => handleMouseDown(e, layerRef)}
                        onDragStart={(e) => handleStageDragStart(e, layerRef)}
                        onDragMove={handleStageDragMove}
                        onDragEnd={handleStageDragEnd}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                        onContextMenu={onStageContextMenu}
                        listening={!isTransforming}
                        draggable={isPanning}
                    >
                        <Layer ref={layerRef}>
                            {/* 캔버스 배경: 뷰포트 크기에 맞춰 월드 좌표로 채우기 */}
                            {(() => {
                                const sx = stage.scaleX || 1;
                                const sy = stage.scaleY || 1;
                                const tx = stage.x || 0;
                                const ty = stage.y || 0;

                                // 화면(0,0)과 (viewportWidth, viewportHeight)를 월드 좌표로 변환
                                const vx1 = (0 - tx) / sx;
                                const vx2 = (stage.width - tx) / sx;
                                const vy1 = (0 - ty) / sy;
                                const vy2 = (stage.height - ty) / sy;

                                const bgX = Math.min(vx1, vx2);
                                const bgY = Math.min(vy1, vy2);
                                const bgW = Math.abs(vx2 - vx1);
                                const bgH = Math.abs(vy2 - vy1);

                                return (
                                    <Rect
                                        x={bgX}
                                        y={bgY}
                                        width={bgW}
                                        height={bgH}
                                        fill="#f0f0f0"
                                        listening={false}
                                        perfectDrawEnabled={false}
                                    />
                                );
                            })()}


                            {/* 작업 영역 경계 */}
                            <Rect
                                x={0}
                                y={0}
                                width={workArea.width}
                                height={workArea.height}
                                stroke="black"
                                strokeWidth={1 / Math.abs(stage.scaleX)}
                                dash={[4 / Math.abs(stage.scaleX), 2 / Math.abs(stage.scaleX)]}
                                listening={false}
                            />


                            {/* 그리드 */}
                            <CanvasGrid
                                gridSize={gridSize}
                                workArea={workArea}
                                visible={isGridVisible}
                                isPanning={isPanning}
                                stageScaleX={stage.scaleX}
                                stageScaleY={stage.scaleY}
                                stageX={stage.x}
                                stageY={stage.y}
                                viewportWidth={stage.width}
                                viewportHeight={stage.height}
                            />

                            {/* 이미지 그룹 */}
                            <Group ref={imageGroupRef} listening={tool === 'select'}>
                                {imageShapes.map((shape) => {
                                    const imageElement = shape.imageDataUrl ? loadImage(shape.imageDataUrl, shape.id) : null;

                                    if (!imageElement) {
                                        return (
                                            <Rect
                                                key={`${shape.id}-loading`}
                                                id={shape.id}
                                                name="shape"
                                                x={shape.x}
                                                y={shape.y}
                                                width={shape.width}
                                                height={shape.height}
                                                fill="#f8f9fa"
                                                stroke="#dee2e6"
                                                strokeWidth={1}
                                                dash={[4, 4]}
                                                draggable={false}
                                                listening={false}
                                            />
                                        );
                                    }

                                    const safeCrop = shape.crop ? {
                                        x: Math.max(0, shape.crop.x),
                                        y: Math.max(0, shape.crop.y),
                                        width: Math.max(1, Math.min(shape.crop.width, imageElement.width - shape.crop.x)),
                                        height: Math.max(1, Math.min(shape.crop.height, imageElement.height - shape.crop.y))
                                    } : {
                                        x: 0,
                                        y: 0,
                                        width: imageElement.width,
                                        height: imageElement.height
                                    };

                                    return (
                                        <Image
                                            key={shape.id}
                                            id={shape.id}
                                            alt={shape.name}
                                            name="shape"
                                            x={shape.x}
                                            y={shape.y}
                                            width={shape.width}
                                            height={shape.height}
                                            image={imageElement}
                                            rotation={shape.rotation || 0}
                                            scaleX={shape.scaleX || 1}
                                            scaleY={shape.scaleY || 1}
                                            crop={safeCrop}
                                            onTransformStart={handleTransformStart}
                                            {...makeCommonProps(shape)}
                                        />
                                    );
                                })}
                            </Group>

                            {/* 도형 그룹 */}
                            <Group ref={shapeGroupRef} listening={true}>
                                {otherShapes.map((shape) => {
                                    const commonProps = makeCommonProps(shape);

                                    switch (shape.type) {
                                        case 'rectangle':
                                            return (
                                                <Rect
                                                    key={shape.id}
                                                    id={shape.id}
                                                    name="shape"
                                                    x={shape.x}
                                                    y={shape.y}
                                                    width={shape.width}
                                                    height={shape.height}
                                                    fill={shape.fill}
                                                    rotation={shape.rotation}
                                                    scaleX={shape.scaleX}
                                                    scaleY={shape.scaleY}
                                                    {...commonProps}
                                                />
                                            );
                                        case 'circle':
                                            return (
                                                <Circle
                                                    key={shape.id}
                                                    id={shape.id}
                                                    name="shape"
                                                    x={shape.x}
                                                    y={shape.y}
                                                    radius={shape.radius}
                                                    fill={shape.fill}
                                                    rotation={shape.rotation}
                                                    scaleX={shape.scaleX}
                                                    scaleY={shape.scaleY}
                                                    {...commonProps}
                                                />
                                            );
                                        default:
                                            return null;
                                    }
                                })}
                            </Group>

                            {/* Transformer */}
                            <Transformer
                                ref={transformerRef}
                                rotationSnaps={hasImages ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
                                onTransformStart={handleTransformStart}
                                onTransform={handleTransform}
                                onTransformEnd={handleTransformEnd}
                                rotateEnabled={true}
                                anchorSize={10}
                                anchorStroke="#3b82f6"
                                anchorFill="#fff"
                                borderStroke="#3b82f6"
                                enabledAnchors={[
                                    'top-left', 'top-right', 'bottom-left', 'bottom-right',
                                    'top-center', 'middle-right', 'bottom-center', 'middle-left'
                                ]}
                                visible={selectedShapeIds.length > 0}
                                {...transformerConfig}
                            />

                            {/* 선택 사각형 */}
                            <Rect
                                ref={selectionRectRef}
                                fill="rgba(0,0,255,0.2)"
                                stroke="blue"
                                strokeWidth={1}
                                dash={[4, 2]}
                                visible={false}
                                listening={false}
                            />
                        </Layer>
                    </Stage>
                </div>
            </ContextMenuTrigger>

            {/* 컨텍스트 메뉴 */}
            <ContextMenuContent className="w-56">
                <ContextMenuLabel>Canvas</ContextMenuLabel>
                <ContextMenuItem onSelect={handleSelectAll}>
                    Select All
                    <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={selectedShapeIds.length < 2} onSelect={handleGroup}>
                    Group
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={!isContextOnShape} onSelect={handleCopy}>
                    Copy
                    <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={handlePaste}>
                    Paste
                    <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!isContextOnShape} onSelect={handleCut}>
                    Cut
                    <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!isContextOnShape} variant="destructive" onSelect={handleDelete}>
                    Delete
                    <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}