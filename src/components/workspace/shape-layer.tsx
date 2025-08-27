"use client";

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { Layer, Group, Rect, Circle, Image, Text, Transformer } from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateShape } from '@/store/slices/shapes-slice';

// 타입 및 유틸리티
import { CustomShapeConfig } from '@/types/custom-konva-config';
import { useCanvas } from '@/contexts/canvas-context';
import { useTransformerHandlers } from '@/hooks/use-transformer-handlers';
import { TransformerConfig } from "konva/lib/shapes/Transformer";

interface ShapeLayerProps {
    // 외부에서 전달받는 이벤트 핸들러들
    onShapeSelect?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
    onShapeContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
    onShapeDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
    onShapeDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
    onShapeDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
    // 상태들
    isPanning?: boolean;
    selectedShapeIds?: string[];
}

export const ShapeLayer = React.forwardRef<Konva.Layer, ShapeLayerProps>(({
                                                                              onShapeSelect,
                                                                              onShapeContextMenu,
                                                                              onShapeDragStart,
                                                                              onShapeDragMove,
                                                                              onShapeDragEnd,
                                                                              isPanning = false,
                                                                              selectedShapeIds = []
                                                                          }, ref) => {

    // Redux 상태에서 직접 데이터 가져오기
    const dispatch = useAppDispatch();
    const { shapes } = useAppSelector((state) => state.shapes);
    const { tool } = useAppSelector((state) => state.tool);

    // 설정 및 컨텍스트
    const { stage, setLoading } = useCanvas();

    // 로컬 상태
    const [isHoveringShape, setIsHoveringShape] = React.useState<string | null>(null);

    // 참조들
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
    const imageGroupRef = useRef<Konva.Group>(null);
    const shapeGroupRef = useRef<Konva.Group>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const shapesRef = useRef(shapes);

    // shapes 참조 업데이트
    useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    // Transformer 핸들러
    const {
        isTransforming,
        handleTransformStart,
        handleTransform,
        handleTransformEnd
    } = useTransformerHandlers(transformerRef);

    // ===== 계산된 값들 =====
    const { imageShapes, otherShapes } = useMemo(() => {
        const visibleShapes = shapes.filter(s => s.visible !== false);

        visibleShapes.sort((a, b) => {
            const aIsFill = a.coatingType === 'fill';
            const bIsMasking = b.coatingType === 'masking';
            if (aIsFill && bIsMasking) return -1;
            const aIsMasking = a.coatingType === 'masking';
            const bIsFill = b.coatingType === 'fill';
            if (aIsMasking && bIsFill) return 1;
            return 0;
        });

        return {
            imageShapes: visibleShapes.filter(s => s.type === 'image'),
            otherShapes: visibleShapes.filter(s => s.type !== 'image')
        };
    }, [shapes]);

    const hasImages = useMemo(() =>
        shapes.some(shape =>
            selectedShapeIds.includes(shape.id ?? "") && shape.type === 'image'
        ), [shapes, selectedShapeIds]
    );

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
                if (ref && 'current' in ref && ref.current) {
                    ref.current.batchDraw();
                }
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
    }, [imageCache, setLoading, shapes, dispatch, ref]);

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

    const makeCommonProps = useCallback((shape: Partial<CustomShapeConfig>) => {
        const isLocked = shape.isLocked;
        const isInteractionBlocked = isPanning || isLocked;

        const baseProps = {
            draggable: tool === 'select' && !isPanning && !isLocked,
            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
                e.evt.preventDefault();
                if (!isPanning && !isLocked && onShapeSelect) {
                    onShapeSelect(e);
                }
            },
            onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
                if (!isPanning && !isLocked && onShapeContextMenu) {
                    onShapeContextMenu(e);
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
            ...((!isPanning && !isLocked) && onShapeDragStart && onShapeDragMove && onShapeDragEnd && {
                onDragStart: onShapeDragStart,
                onDragMove: onShapeDragMove,
                onDragEnd: onShapeDragEnd,
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
    }, [tool, isHoveringShape, isPanning, getCoatingVisualStyle, onShapeSelect, onShapeContextMenu, onShapeDragStart, onShapeDragMove, onShapeDragEnd]);

    const makeImageProps = useCallback((shape: CustomShapeConfig) => {
        const isLocked = shape.isLocked;
        const baseProps = makeCommonProps(shape);

        const { fill, stroke, strokeWidth, dash, shadowColor, shadowBlur, shadowOpacity, ...validImageProps } = baseProps;

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

    const renderCoatingOrderBadge = useCallback((shape: CustomShapeConfig, stageScale: number) => {
        if (shape.isLocked || shape.skipCoating || !shape.coatingOrder) {
            return null;
        }

        const badgeSize = 20 / Math.abs(stageScale);
        const fontSize = 12 / Math.abs(stageScale);

        return (
            <Group key={`${shape.id}-badge`}>
                <Circle
                    x={(shape.x || 0) - badgeSize/2}
                    y={(shape.y || 0) - badgeSize/2}
                    radius={badgeSize/2}
                    fill="#4caf50"
                    stroke="#2e7d32"
                    strokeWidth={1 / Math.abs(stageScale)}
                    listening={false}
                />
                <Text
                    x={(shape.x || 0) - badgeSize/2}
                    y={(shape.y || 0) - badgeSize/2}
                    width={badgeSize}
                    height={badgeSize}
                    text={shape.coatingOrder.toString()}
                    fontSize={fontSize}
                    fontFamily="Arial, sans-serif"
                    fill="white"
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                />
            </Group>
        );
    }, []);

    // Transformer 노드 업데이트
    useEffect(() => {
        if (transformerRef.current && ref && 'current' in ref && ref.current) {
            const nodesToSet = selectedShapeIds
                .map(id => ref.current!.findOne(`#${id}`))
                .filter(Boolean);

            transformerRef.current.nodes(nodesToSet as Konva.Shape[]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [selectedShapeIds, shapes, ref]);

    return (
        <Layer ref={ref}>
            {/* 이미지 그룹 */}
            <Group ref={imageGroupRef} listening={tool === 'select'}>
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
                        default:
                            return null;
                    }
                })}
            </Group>

            {/* 코팅 순서 배지들 */}
            <Group listening={false}>
                {shapes
                    .filter(shape => shape.coatingOrder && !shape.isLocked && !shape.skipCoating)
                    .map(shape => renderCoatingOrderBadge(shape, stage.scaleX))
                }
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
                visible={selectedShapeIds.length > 0 && !isTransforming}
                {...transformerConfig}
            />
        </Layer>
    );
});

ShapeLayer.displayName = 'ShapeLayer';