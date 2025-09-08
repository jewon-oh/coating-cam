import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Layer, Transformer } from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateShape } from '@/store/slices/shape-slice';

// 타입 및 유틸리티
import { CustomShapeConfig } from '@/types/custom-konva-config';
import { useCanvas } from '@/contexts/canvas-context';
import { TransformerConfig } from "konva/lib/shapes/Transformer";
import { imageUtils } from "@/lib/image-utils";
import { getCoatingVisualStyle } from "@/lib/shape-style-utils";
import { useTransformerHandlers } from "@/hooks/shape/use-transformer-handlers";
// import { ShapeComponent } from "@/components/workspace/shape-component";
import { ImageComponent } from "@/components/workspace/image-component";

// ===== 라인 핸들 추가 START =====
import { LineHandles } from '@/components/workspace/line-handles';
import { ShapeComponent } from './shape-component';
// ===== 라인 핸들 추가 END =====


interface ShapeLayerProps {
    isPanning?: boolean;
}

export function ShapeLayer({ isPanning = false }: ShapeLayerProps) {
    // Redux 상태
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);
    const { tool } = useAppSelector((state) => state.tool);

    // Context 및 훅
    const { setLoading } = useCanvas();

    // 로컬 상태
    const [isHoveringShape, setIsHoveringShape] = useState<string | null>(null);

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

    const transformableShapes = useMemo(() =>
        shapes.filter(shape =>
            selectedShapeIds.includes(shape.id!) &&
            shape.type !== 'line' &&
            !shape.isLocked
        )
        , [shapes, selectedShapeIds]);

    // ===== 라인 핸들 추가 START =====
    // 선택된 라인의 설정(config)을 찾습니다.
    const selectedLineConfig = useMemo(() => {
        if (selectedShapeIds.length !== 1) return null;
        const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
        return selectedShape?.type === 'line' ? selectedShape : null;
    }, [shapes, selectedShapeIds]);

    // 선택된 라인의 실제 Konva 노드를 state로 관리합니다.
    const [selectedLineNode, setSelectedLineNode] = useState<Konva.Line | null>(null);

    // 선택된 라인이 변경될 때마다 layer에서 해당 노드를 찾아 state를 업데이트합니다.
    useEffect(() => {
        if (selectedLineConfig && layerRef.current) {
            const node = layerRef.current.findOne<Konva.Line>(`#${selectedLineConfig.id}`);
            setSelectedLineNode(node || null);
        } else {
            setSelectedLineNode(null);
        }
    }, [selectedLineConfig]);
    // ===== 라인 핸들 추가 END =====


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
                anchor.cornerRadius(15).width(20).height(20).offsetX(13).offsetY(13);
            } else {
                anchor.width(14).offsetX(8).height(14).offsetY(8);
            }
        },
        keepRatio: false,
        centeredScaling: false,
        flipEnabled: false,
        ignoreStroke: true,
    }), []);

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
            setTimeout(() => setLoading({ isLoading: false }), 0);
        };
        if (shapeId) {
            setLoading({ isLoading: true, message: `이미지 로딩 중... (${shapeId})` });
        }
        img.src = imageDataUrl;
        imageCache.current.set(imageDataUrl, img);
        return img.complete ? img : null;
    }, [shapes, dispatch, setLoading]);

    const makeCommonProps = useCallback((shape: Partial<CustomShapeConfig>) => {
        const isLocked = shape.isLocked;
        const isInteractionBlocked = isPanning || isLocked;

        const baseProps = {
            draggable: tool === 'select' && !isPanning && !isLocked,
            onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
                const container = e.target.getStage()?.container();
                if (!container) return;

                if (isLocked) {
                    container.style.cursor = 'not-allowed';
                } else {
                    container.style.cursor = 'pointer';
                    if (!isInteractionBlocked) {
                        setIsHoveringShape(shape.id!); // 마우스 오버 시 하이라이트
                    }
                }
            },
            onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => {
                const container = e.target.getStage()?.container();
                if (container) {
                    container.style.cursor = 'default';
                }
                setIsHoveringShape(null);
            },
            perfectDrawEnabled: false,
            // isLocked일 때도 listening은 true여야 커서 변경을 위한 mouseenter/leave 이벤트가 발생합니다.
            // 실제 상호작용(드래그, 클릭 등)은 다른 로직에서 차단됩니다.
            listening: tool === 'select' && !isPanning,
        };

        const hoverEffect = (isHoveringShape === shape.id && !isInteractionBlocked) ? {
            shadowColor: 'rgba(59, 130, 246, 0.6)',
            shadowBlur: 12,
            shadowOpacity: 1
        } : {};

        const coatingStyle = getCoatingVisualStyle(shape);

        let finalProps = { ...baseProps, ...coatingStyle, ...hoverEffect };

        if (isLocked) {
            finalProps = {
                ...finalProps,
                stroke: '#9ca3af', // tailwind gray-400
                dash: [10, 5],
                shadowOpacity: 0, // 잠겼을 때는 호버 효과(그림자) 제거
            };
        }

        return finalProps;
    }, [isPanning, tool, isHoveringShape]);

    const makeImageProps = useCallback((shape: CustomShapeConfig): Partial<Konva.ImageConfig> => {
        const isLocked = shape.isLocked;
        const baseProps = makeCommonProps(shape);
        const { shadowColor, shadowBlur, shadowOpacity, ...validImageProps } = baseProps;
        return {
            ...validImageProps,
            ...(!isLocked && !isPanning && shadowColor && { shadowColor, shadowBlur, shadowOpacity })
        };
    }, [makeCommonProps, isPanning]);

    useEffect(() => {
        const imagesToFlip = shapes.filter(s => s.type === 'image' && s.imageDataUrl && !s.isFlipped);
        if (imagesToFlip.length === 0) return;
        const processImages = async () => {
            setLoading({ isLoading: true, message: '이미지 최적화 중...' });
            for (const shape of imagesToFlip) {
                try {
                    const flippedDataUrl = await imageUtils(shape.imageDataUrl!, 'horizontal');
                    imageCache.current.delete(shape.imageDataUrl!);
                    dispatch(updateShape({ id: shape.id!, updatedProps: { imageDataUrl: flippedDataUrl, isFlipped: true } }));
                } catch (error) {
                    console.error(`${shape.id} 이미지 뒤집기 실패:`, error);
                    dispatch(updateShape({ id: shape.id!, updatedProps: { isFlipped: true } }));
                }
            }
            setLoading({ isLoading: false });
        };
        processImages();
    }, [shapes, dispatch, setLoading, imageCache]);

    useEffect(() => {
        if (transformerRef.current && layerRef.current) {
            const nodesToSet = transformableShapes
                .map(shape => layerRef.current!.findOne(`#${shape.id}`))
                .filter(Boolean);
            transformerRef.current.nodes(nodesToSet as Konva.Shape[]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [transformableShapes]);

    useEffect(() => {
        const cache = imageCache.current;
        return () => cache.clear();
    }, []);

    return (
        <Layer
            ref={layerRef}
        >
            {imageShapes.map((shape) => (
                <ImageComponent
                    key={shape.id}
                    shape={shape}
                    imageElement={shape.imageDataUrl ? loadImage(shape.imageDataUrl, shape.id) : null}
                    commonProps={makeImageProps(shape)} // makeImageProps에서 onMouseEnter, onMouseLeave 제거
                />
            ))}
            {otherShapes.map((shape) => (
                <ShapeComponent
                    key={shape.id}
                    shape={shape}
                    commonProps={makeCommonProps(shape)}
                />
            ))}

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
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'middle-right', 'bottom-center', 'middle-left']}
                visible={transformableShapes.length > 0 && !isTransforming}
                {...transformerConfig}
            />

            {/* ===== 라인 핸들 추가 START ===== */}
            {/* 선택된 도형이 'line'일 경우에만 LineHandles 컴포넌트를 렌더링합니다. */}
            <LineHandles
                lineNode={selectedLineNode}
            />
            {/* ===== 라인 핸들 추가 END ===== */}
        </Layer>
    );
}