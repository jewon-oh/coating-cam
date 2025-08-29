
import React, {useCallback, useMemo, useRef, useState} from 'react';
import type Konva from 'konva';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {batchUpdateShapes} from '@/store/slices/shape-slice';
import {setPresent} from '@/store/slices/shape-history-slice';
import type {CustomShapeConfig} from '@/types/custom-konva-config';
import { createCoatingSnap } from '@/lib/coating-line-utils';
import { useSettings } from '@/contexts/settings-context';

/**
 * Transformer(크기 조절/회전)과 관련된 상태와 핸들러를 캡슐화한 훅
 */
export function useTransformerHandlers(
    transformerRef: React.RefObject<Konva.Transformer | null>
) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const toolState = useAppSelector((s) => s.tool);
    const { isSnappingEnabled } = useSettings();


    // 외부에서도 재사용할 수 있도록 이미지 캐시 노출
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // 변형 중 여부 (Transformer 가시성/캐시 제어 등에 사용)
    const [isTransforming, setIsTransforming] = useState(false);

    // 이미지 변형 시작 시의 캐시 (크롭 기능에 사용)
    const transformStartCache = useRef<{
        nodeX: number;
        nodeY: number;
        nodeWidth: number;
        nodeHeight: number;
        crop: { x: number; y: number; width: number; height: number };
        originalImageWidth: number;
        originalImageHeight: number;
    } | null>(null);

    // 코팅 기반 스냅 유틸리티
    const coatingSnap = useMemo(() =>
            createCoatingSnap(
                toolState.lineSpacing,
                toolState.coatingWidth,
                isSnappingEnabled
            ),
        [toolState.lineSpacing, toolState.coatingWidth, isSnappingEnabled]
    );

    const handleTransformStart = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        setIsTransforming(true);
        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        if (shape && shape.type === 'image') {
            const imageNode = node as Konva.Image;

            // 이미지 객체 가져오기 (노드 -> 캐시 순)
            let originalImage: HTMLImageElement | undefined = imageNode.image() as HTMLImageElement;
            if (!originalImage && shape.imageDataUrl) {
                originalImage = imageCache.current.get(shape.imageDataUrl);
            }
            if (!originalImage || !originalImage.complete) {
                console.warn('❌ Transform 시작 시 이미지를 찾을 수 없음:', shape.id);
                return; // transform 취소
            }

            // 현재 crop 확인 (Konva 노드 > shape 데이터 > 전체 이미지)
            let currentCrop = imageNode.crop();
            if (!currentCrop && shape.crop) {
                currentCrop = shape.crop;
                imageNode.crop(currentCrop);
            }
            if (!currentCrop) {
                currentCrop = { x: 0, y: 0, width: originalImage.width, height: originalImage.height };
                imageNode.crop(currentCrop);
            }

            transformStartCache.current = {
                nodeX: node.x(),
                nodeY: node.y(),
                nodeWidth: node.width() * node.scaleX(),
                nodeHeight: node.height() * node.scaleY(),
                crop: { ...currentCrop },
                originalImageWidth: originalImage.width,
                originalImageHeight: originalImage.height,
            };

            node.getLayer()?.batchDraw();
        }
    }, [shapes, transformerRef]);


    const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        // Line 도형 특별 처리
        if (shape && shape.type === 'line') {
            const transformer = transformerRef.current;
            if (!transformer) return;

            const anchor = transformer.getActiveAnchor();

            if (anchor === 'top-left' || anchor === 'bottom-right') {
                // 현재 transformer의 위치와 크기 정보 가져오기
                const box = transformer._getNodeRect();
                const scaleX = transformer.scaleX();
                const scaleY = transformer.scaleY();

                let newPoints: number[];

                if (anchor === 'top-left') {
                    // 시작점 조정 - 끝점은 고정
                    const endX = (shape.points?.[2] || 0);
                    const endY = (shape.points?.[3] || 0);
                    newPoints = [
                        box.x - (shape.x || 0),
                        box.y - (shape.y || 0),
                        endX,
                        endY
                    ];
                } else {
                    // 끝점 조정 - 시작점은 고정
                    const startX = (shape.points?.[0] || 0);
                    const startY = (shape.points?.[1] || 0);
                    newPoints = [
                        startX,
                        startY,
                        box.x + box.width - (shape.x || 0),
                        box.y + box.height - (shape.y || 0)
                    ];
                }

                // Line 노드의 points 업데이트
                if (node instanceof Konva.Line) {
                    node.points(newPoints);
                }

                // Transform 리셋
                transformer.scaleX(1);
                transformer.scaleY(1);

                node.getLayer()?.batchDraw();
            }
            return;
        }


        // 채우기 도형의 실시간 스냅 적용
        if (shape && shape.coatingType === 'fill' && isSnappingEnabled && shape.fillPattern) {
            let currentX = node.x();
            let currentY = node.y();
            let currentWidth = node.width() * Math.abs(node.scaleX());
            let currentHeight = node.height() * Math.abs(node.scaleY());

            if (shape.type === 'circle') {
                const radius = (shape.radius || 0) * Math.abs(node.scaleX());
                currentWidth = currentHeight = radius * 2;
            }

            // 채우기 방향에 따른 선택적 스냅 적용
            const { point: snappedPos, size: snappedSize } = coatingSnap.snapShapeForFill(
                { x: currentX, y: currentY },
                { width: currentWidth, height: currentHeight },
                shape.fillPattern
            );

            // 실제 노드에 스냅된 값 적용 (기준점 고정을 위해 조건부 적용)
            // X 스냅이 적용된 경우에만 X 위치 업데이트
            if (Math.abs(snappedPos.x - currentX) > 0.1) {
                node.x(snappedPos.x);
            }
            // Y 스냅이 적용된 경우에만 Y 위치 업데이트
            if (Math.abs(snappedPos.y - currentY) > 0.1) {
                node.y(snappedPos.y);
            }

            if (shape.type === 'rectangle') {
                // 사각형: 스냅된 크기만 적용
                const originalWidth = node.width();
                const originalHeight = node.height();

                if (Math.abs(snappedSize.width - currentWidth) > 0.1 && originalWidth > 0) {
                    node.scaleX(snappedSize.width / originalWidth);
                }
                if (Math.abs(snappedSize.height - currentHeight) > 0.1 && originalHeight > 0) {
                    node.scaleY(snappedSize.height / originalHeight);
                }
            } else if (shape.type === 'circle') {
                // 원형: 더 작은 크기를 기준으로 균등 스케일
                const snappedRadius = Math.min(snappedSize.width, snappedSize.height) / 2;
                const originalRadius = shape.radius || 1;
                const newScale = snappedRadius / originalRadius;

                if (Math.abs(newScale - Math.abs(node.scaleX())) > 0.01) {
                    node.scaleX(newScale);
                    node.scaleY(newScale);
                }
            }

            // 실시간 스냅 가이드 업데이트
            // updateSnapGuide(node, node.x(), node.y(), snappedSize.width, snappedSize.height);
        }

        // 기존 이미지 Transform 로직
        if (shape && shape.type === 'image' && transformStartCache.current) {
            const anchor = transformerRef.current?.getActiveAnchor();
            const isCropping = anchor && ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchor);

            if (isCropping) {
                const cache = transformStartCache.current;
                if (!cache.crop || cache.originalImageWidth <= 0 || cache.originalImageHeight <= 0) {
                    console.warn('❌ Transform cache가 잘못됨:', cache);
                    return;
                }

                const newCrop = { ...cache.crop };
                const currentDisplayedWidth = node.width() * node.scaleX();
                const currentDisplayedHeight = node.height() * node.scaleY();

                const widthChange = currentDisplayedWidth - cache.nodeWidth;
                const heightChange = currentDisplayedHeight - cache.nodeHeight;

                const originalDisplayRatioX = cache.nodeWidth / cache.crop.width;
                const originalDisplayRatioY = cache.nodeHeight / cache.crop.height;
                if (originalDisplayRatioX <= 0 || originalDisplayRatioY <= 0) {
                    console.warn('❌ Display ratio가 잘못됨');
                    return;
                }

                const cropWidthChange = widthChange / originalDisplayRatioX;
                const cropHeightChange = heightChange / originalDisplayRatioY;

                switch (anchor) {
                    case 'middle-right':
                        newCrop.width = Math.max(1, cache.crop.width + cropWidthChange);
                        break;
                    case 'middle-left':
                        newCrop.x = Math.max(0, cache.crop.x - cropWidthChange);
                        newCrop.width = Math.max(1, cache.crop.width + cropWidthChange);
                        break;
                    case 'top-center':
                        newCrop.height = Math.max(1, cache.crop.height + cropHeightChange);
                        break;
                    case 'bottom-center':
                        newCrop.y = Math.max(0, cache.crop.y - cropHeightChange);
                        newCrop.height = Math.max(1, cache.crop.height + cropHeightChange);
                        break;
                }

                // 이미지 영역 내로 제한
                newCrop.x = Math.max(0, Math.min(newCrop.x, cache.originalImageWidth - 1));
                newCrop.y = Math.max(0, Math.min(newCrop.y, cache.originalImageHeight - 1));
                newCrop.width = Math.max(1, Math.min(newCrop.width, cache.originalImageWidth - newCrop.x));
                newCrop.height = Math.max(1, Math.min(newCrop.height, cache.originalImageHeight - newCrop.y));

                try {
                    (node as Konva.Image).crop(newCrop);
                    node.getLayer()?.batchDraw();
                } catch (error) {
                    console.error('❌ Crop 적용 실패:', error);
                }
            } else {
                // ✅ 비율 유지 로직: 코너 핸들을 사용한 크기 조절 시
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // 더 작은 스케일 값을 기준으로 균등 스케일 적용
                const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

                // 원래 방향 유지 (음수/양수)
                const finalScaleX = scaleX >= 0 ? uniformScale : -uniformScale;
                const finalScaleY = scaleY >= 0 ? uniformScale : -uniformScale;

                // 노드에 균등 스케일 적용
                node.scaleX(finalScaleX);
                node.scaleY(finalScaleY);
            }
        }
        // 모든 변경사항을 레이어에 적용
        node.getLayer()?.batchDraw();
    }, [shapes, transformerRef, coatingSnap, isSnappingEnabled ]);

    const handleTransformEnd = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];

        // 스냅 가이드 제거
        // clearSnapGuide();

        const updates = nodes.map(node => {
            const shape = shapes.find(s => s.id === node.id());
            if (!shape) return null;

            // Line 도형 특별 처리
            if (shape.type === 'line') {
                const lineNode = node as Konva.Line;
                const currentPoints = lineNode.points();

                return {
                    id: shape.id!,
                    props: {
                        ...shape,
                        points: currentPoints,
                        startPoint: { x: currentPoints[0], y: currentPoints[1] },
                        endPoint: { x: currentPoints[2], y: currentPoints[3] },
                    } as Partial<CustomShapeConfig>
                };
            }

            
            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();
            const newRotation = node.rotation();
            let newWidth = node.width() * Math.abs(oldScaleX);
            let newHeight = node.height() * Math.abs(oldScaleY);
            let newX = node.x();
            let newY = node.y();

            // 채우기 도형은 이미 Transform 중에 스냅되었으므로 현재 값 사용
            if (shape.coatingType === 'fill' && isSnappingEnabled && shape.fillPattern) {
                // Transform 중에 이미 스냅된 값들이므로 그대로 사용
                const { point: finalPos, size: finalSize } = coatingSnap.snapShapeForFill(
                    { x: newX, y: newY },
                    { width: newWidth, height: newHeight },
                    shape.fillPattern
                );

                newX = finalPos.x;
                newY = finalPos.y;
                newWidth = finalSize.width;
                newHeight = finalSize.height;
            } else {
                // 채우기가 아닌 도형은 Transform 끝에서 일반 스냅 적용
                if (isSnappingEnabled) {
                    const snappedSize = coatingSnap.snapSize({ width: newWidth, height: newHeight });
                    const snappedPos = coatingSnap.snapPoint({ x: newX, y: newY });

                    newWidth = snappedSize.width;
                    newHeight = snappedSize.height;
                    newX = snappedPos.x;
                    newY = snappedPos.y;
                }
            }

            const newAttrs: CustomShapeConfig = {
                ...shape,
                x: newX,
                y: newY,
                rotation: newRotation,
                width: newWidth,
                height: newHeight,
                scaleX: 1,
                scaleY: 1,
            };

            if (shape.type === 'image') {
                const currentCrop = (node as Konva.Image).crop();
                if (currentCrop) {
                    newAttrs.crop = {
                        x: currentCrop.x,
                        y: currentCrop.y,
                        width: currentCrop.width,
                        height: currentCrop.height,
                    };
                }
            }

            if (shape.type === 'circle') {
                let newRadius = newWidth / 2;

                // 원형 도형의 코팅 기반 스냅 (채우기가 아닌 경우)
                if (shape.coatingType !== 'fill' && isSnappingEnabled) {
                    newRadius = coatingSnap.snapToLineSpacing(newRadius);
                }

                newAttrs.radius = newRadius;
            }

            // Konva 노드의 스케일을 리셋하고 실제 크기로 적용
            node.scaleX(1);
            node.scaleY(1);
            node.width(newWidth);
            node.height(newHeight);
            node.x(newX);
            node.y(newY);

            // 원형 도형 특별 처리
            if (shape.type === 'circle' && newAttrs.radius) {
                // 원형은 width/height 대신 radius 사용
                node.width(newAttrs.radius * 2);
                node.height(newAttrs.radius * 2);
            }

            return { id: shape.id!, props: newAttrs };
        }).filter((u): u is { id: string; props: CustomShapeConfig } => u !== null);

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates as { id: string; props: Partial<CustomShapeConfig> }[]));
            const updatedShapesForHistory = shapes.map(s => {
                const update = updates.find(u => u.id === s.id);
                return update ? { ...s, ...update.props } : s;
            });
            dispatch(setPresent(updatedShapesForHistory));
        }

        transformStartCache.current = null;
        setIsTransforming(false);
    }, [dispatch, shapes, transformerRef, coatingSnap, isSnappingEnabled,]);
    return useMemo(() => ({
        isTransforming,
        imageCache,
        handleTransformStart,
        handleTransform,
        handleTransformEnd,
    }), [handleTransform, handleTransformEnd, handleTransformStart, isTransforming]);
}