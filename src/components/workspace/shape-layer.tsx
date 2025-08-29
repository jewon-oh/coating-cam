
"use client";

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { Layer, Group, Rect, Circle, Image, Text, Transformer, Line } from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateShape } from '@/store/slices/shape-slice';

// 타입 및 유틸리티
import { CustomShapeConfig } from '@/types/custom-konva-config';
import { useCanvas } from '@/contexts/canvas-context';
import { useTransformerHandlers } from '@/hooks/use-transformer-handlers';
import { useShapeEvents } from '@/hooks/use-shape-events';
import { TransformerConfig } from "konva/lib/shapes/Transformer";
import { flipImageData } from "@/lib/flip-image-data";

interface ShapeLayerProps {
    isPanning?: boolean;
}

export function ShapeLayer({ isPanning = false }: ShapeLayerProps) {
    // Redux 상태
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);
    const { pathGroups, shapeToPathMap } = useAppSelector((state) => state.paths);
    const { tool } = useAppSelector((state) => state.tool);

    // Context 및 훅
    const { setLoading } = useCanvas();
    const shapeEvents = useShapeEvents();

    // 로컬 상태
    const [isHoveringShape, setIsHoveringShape] = React.useState<string | null>(null);

    // 참조들
    const layerRef = useRef<Konva.Layer>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
    const transformerRef = useRef<Konva.Transformer>(null);

    // Transformer 핸들러
    const {
        isTransforming,
        handleTransformStart,
        handleTransform,
        handleTransformEnd
    } = useTransformerHandlers(transformerRef);

    const { imageShapes, otherShapes } = useMemo(() => {
        const visibleShapes = shapes.filter(s => s.visible !== false);

        // 코팅 타입에 따른 정렬 (fill이 masking보다 앞에 오도록)
        visibleShapes.sort((a, b) => {
            const aIsFill = a.coatingType === 'fill' || a.coatingType === 'outline';
            const bIsMasking = b.coatingType === 'masking';
            if (aIsFill && bIsMasking) return -1;
            const aIsMasking = a.coatingType === 'masking';
            const bIsFill = b.coatingType === 'fill' || b.coatingType === 'outline';
            if (aIsMasking && bIsFill) return 1;
            return 0;
        });

        return {
            imageShapes: visibleShapes.filter(s => s.type === 'image'),
            otherShapes: visibleShapes.filter(s => s.type !== 'image')
        };
    }, [shapes]);

    // Line이 아닌 도형들만 transformer 적용
    const transformableShapes = useMemo(() =>
            shapes.filter(shape =>
                selectedShapeIds.includes(shape.id!) &&
                shape.type !== 'line' // Line 도형 제외
            )
        , [shapes, selectedShapeIds]);

    const hasImages = useMemo(() =>
            transformableShapes.some(shape => shape.type === 'image')
        , [transformableShapes]);

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
        centeredScaling: false,
        flipEnabled: false,
        ignoreStroke: true,
        boundBoxFunc: (oldBox, newBox) => {
            const minWidth = 5;
            const minHeight = 5;
            if (Math.abs(newBox.width) < minWidth || Math.abs(newBox.height) < minHeight) {
                return oldBox;
            }
            return newBox;
        },
    }), []);

    // ===== 이미지 로딩 =====
    const loadImage = useCallback((imageDataUrl: string, shapeId?: string): HTMLImageElement | null => {
        if (imageCache.current.has(imageDataUrl)) {
            const cachedImg = imageCache.current.get(imageDataUrl)!;
            if (cachedImg.complete) return cachedImg;
        }

        const img = new window.Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
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

        if (shapeId) {
            setLoading({ isLoading: true, message: `이미지 로딩 중... (${shapeId})` });
        }

        img.src = imageDataUrl;
        imageCache.current.set(imageDataUrl, img);
        return img.complete ? img : null;
    }, [shapes, dispatch, setLoading]);

    // ===== 스타일 유틸리티들 =====
    const getCoatingVisualStyle = useCallback((shape: CustomShapeConfig) => {
        const isLocked = shape.isLocked;

        if (isLocked) {
            return {
                fill: shape.fill,
                stroke: shape.stroke,
                strokeWidth: shape.strokeWidth,
                dash: [4, 4],
                opacity: 0.6
            };
        }

        if (shape.skipCoating) {
            return {
                fill: shape.fill || '#f8f9fa',
                stroke: '#6c757d',
                strokeWidth: 1,
                dash: [8, 4],
                opacity: 0.5
            };
        }

        switch (shape.coatingType) {
            case 'fill':
                return {
                    fill: '#2196f3',
                    stroke: '#2196f3',
                    strokeWidth: 2,
                    opacity: shape.type === 'image' ? 1 : 0.5,
                    shadowColor: '#2196f3',
                    shadowBlur: 5,
                    shadowOpacity: 0.3
                };
            case 'outline':
                return {
                    fill: 'transparent',
                    stroke: '#ff9800',
                    strokeWidth: 3,
                    opacity: 1,
                    shadowColor: '#ff9800',
                    shadowBlur: 8,
                    shadowOpacity: 0.4
                };
            case 'masking':
                return {
                    fill: '#f44336',
                    stroke: '#f44336',
                    strokeWidth: 2,
                    dash: [6, 3],
                    opacity: shape.type === 'image' ? 1 : 0.6,
                    shadowColor: '#f44336',
                    shadowBlur: 4,
                    shadowOpacity: 0.2
                };
            default:
                return {
                    fill: shape.fill || '#e9ecef',
                    stroke: '#6c757d',
                    strokeWidth: 1,
                    opacity: 1
                };
        }
    }, []);

    // PathGroup을 shape ID로 찾는 헬퍼 함수
    const getPathGroupByShapeId = useCallback((shapeId: string) => {
        const pathGroupId = shapeToPathMap[shapeId];
        return pathGroupId ? pathGroups.find(pg => pg.id === pathGroupId) : undefined;
    }, [pathGroups, shapeToPathMap]);

    const makeCommonProps = useCallback((shape: Partial<CustomShapeConfig>) => {
        const isLocked = shape.isLocked;
        const isInteractionBlocked = isPanning || isLocked;

        const baseProps = {
            draggable: tool === 'select' && !isPanning && !isLocked,
            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
                e.evt.preventDefault();
                if (!isPanning && !isLocked) {
                    shapeEvents.handleSelect(e);
                }
            },
            onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
                if (!isPanning && !isLocked) {
                    shapeEvents.handleContextMenu(e);
                }
            },
            onMouseEnter: () => {
                if (!isInteractionBlocked) {
                    setIsHoveringShape(shape.id!);
                }
            },
            onMouseLeave: () => {
                if (!isInteractionBlocked) {
                    setIsHoveringShape(null);
                }
            },
            ...((!isPanning && !isLocked) && {
                onDragStart: shapeEvents.handleDragStart,
                onDragMove: shapeEvents.handleDragMove,
                onDragEnd: shapeEvents.handleDragEnd,
            }),
            perfectDrawEnabled: false,
            listening: tool === 'select' && !isPanning && !isLocked
        };

        const hoverEffect = (isHoveringShape === shape.id && !isInteractionBlocked) ? {
            shadowColor: 'rgba(59, 130, 246, 0.6)',
            shadowBlur: 12,
            shadowOpacity: 1
        } : {};

        const coatingStyle = getCoatingVisualStyle(shape as CustomShapeConfig);

        return { ...baseProps, ...coatingStyle, ...hoverEffect };
    }, [isPanning, tool, isHoveringShape, getCoatingVisualStyle, shapeEvents]);

    const makeImageProps = useCallback((shape: CustomShapeConfig) => {
        const isLocked = shape.isLocked;
        const baseProps = makeCommonProps(shape);

        // Image 컴포넌트에서 사용할 수 없는 속성들 제거
        const { shadowColor, shadowBlur, shadowOpacity, ...validImageProps } = baseProps;

        const imageSpecificStyle = {
            opacity: isLocked ? 0.4 : (baseProps.opacity || 1),
            filters: (isLocked || shape.skipCoating) ? ['Grayscale'] : undefined,
            ...(isLocked && {
                shadowColor: '#6c757d',
                shadowBlur: 2,
                shadowOpacity: 0.3
            })
        };

        return {
            ...validImageProps,
            ...imageSpecificStyle,
            ...(!isLocked && !isPanning && shadowColor && {
                shadowColor,
                shadowBlur,
                shadowOpacity
            })
        };
    }, [makeCommonProps, isPanning]);

    // ===== 이미지 자동 뒤집기 Effect =====
    useEffect(() => {
        const imagesToFlip = shapes.filter(s =>
            s.type === 'image' && s.imageDataUrl && !s.isFlipped
        );

        if (imagesToFlip.length === 0) return;

        const processImages = async () => {
            setLoading({ isLoading: true, message: '이미지 최적화 중...' });

            for (const shape of imagesToFlip) {
                try {
                    const flippedDataUrl = await flipImageData(shape.imageDataUrl!, 'horizontal');
                    imageCache.current.delete(shape.imageDataUrl!);

                    dispatch(updateShape({
                        id: shape.id!,
                        updatedProps: {
                            imageDataUrl: flippedDataUrl,
                            isFlipped: true,
                        }
                    }));
                } catch (error) {
                    console.error(`${shape.id} 이미지 뒤집기 실패:`, error);
                    dispatch(updateShape({ id: shape.id!, updatedProps: { isFlipped: true } }));
                }
            }

            setLoading({ isLoading: false });
        };

        processImages();
    }, [shapes, dispatch, setLoading, imageCache]);

    // Transformer 노드 업데이트 (Line 제외)
    useEffect(() => {
        if (transformerRef.current && layerRef.current) {
            // Line이 아닌 도형들만 transformer에 연결
            const nodesToSet = transformableShapes
                .map(shape => layerRef.current!.findOne(`#${shape.id}`))
                .filter(Boolean);

            transformerRef.current.nodes(nodesToSet as Konva.Shape[]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [transformableShapes]);

    // 메모리 정리
    useEffect(() => {
        return () => {
            imageCache.current.clear();
        };
    }, []);

    return (
        <Layer ref={layerRef}>
            {/* 이미지 도형들 */}
            <Group listening={tool === 'select'}>
                {imageShapes.map((shape) => {
                    const imageElement = shape.imageDataUrl ? loadImage(shape.imageDataUrl, shape.id) : null;

                    if (!imageElement) {
                        const style = getCoatingVisualStyle(shape);
                        return (
                            <Rect
                                key={`${shape.id}-loading`}
                                id={shape.id}
                                name="shape"
                                x={shape.x}
                                y={shape.y}
                                width={shape.width}
                                height={shape.height}
                                fill={style.fill || "#f8f9fa"}
                                stroke={style.stroke || "#dee2e6"}
                                strokeWidth={style.strokeWidth || 1}
                                dash={style.dash || [4, 4]}
                                opacity={style.opacity || 0.5}
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
                            {...makeImageProps(shape)}
                        />
                    );
                })}
            </Group>

            {/* 다른 도형들 */}
            <Group listening={true}>
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
                                    rotation={shape.rotation}
                                    scaleX={shape.scaleX}
                                    scaleY={shape.scaleY}
                                    strokeScaleEnabled={false}
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
                                    rotation={shape.rotation}
                                    scaleX={shape.scaleX}
                                    scaleY={shape.scaleY}
                                    strokeScaleEnabled={false}
                                    {...commonProps}
                                />
                            );
                        case 'line':
                            return (
                                <Line
                                    key={shape.id}
                                    id={shape.id}
                                    name="shape"
                                    x={shape.x}
                                    y={shape.y}
                                    points={shape.points}
                                    rotation={shape.rotation}
                                    scaleX={shape.scaleX}
                                    scaleY={shape.scaleY}
                                    stroke={commonProps.stroke || shape.stroke || '#000000'}
                                    strokeWidth={commonProps.strokeWidth || shape.strokeWidth || 2}
                                    strokeScaleEnabled={false}
                                    dash={commonProps.dash}
                                    opacity={commonProps.opacity}
                                    listening={commonProps.listening}
                                    draggable={commonProps.draggable}
                                    onClick={commonProps.onClick}
                                    onContextMenu={commonProps.onContextMenu}
                                    onMouseEnter={commonProps.onMouseEnter}
                                    onMouseLeave={commonProps.onMouseLeave}
                                    onDragStart={commonProps.onDragStart}
                                    onDragMove={commonProps.onDragMove}
                                    onDragEnd={commonProps.onDragEnd}
                                    perfectDrawEnabled={false}
                                />
                            );
                        default:
                            return null;
                    }
                })}
            </Group>


            {/* Transformer (Line 제외) */}
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
                visible={transformableShapes.length > 0 && !isTransforming}
                {...transformerConfig}
            />
        </Layer>
    );
}