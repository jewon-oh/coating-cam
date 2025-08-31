import React, { useCallback, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { batchUpdateShapes } from '@/store/slices/shape-slice';
import { setPresent } from '@/store/slices/shape-history-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';
import { useShapeSnapping } from './use-shape-snapping';

/**
 * Transformer(크기 조절/회전)과 관련된 상태와 핸들러를 캡슐화한 훅
 */
export function useTransformerHandlers(
    transformerRef: React.RefObject<Konva.Transformer | null>
) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const { isSnappingEnabled } = useSettings();
    const { snapToGrid, snapPointToGrid, snapShapeSize, snapCircleRadius } = useShapeSnapping();

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
        if (!shape) return;

        // Line 도형 특별 처리
        if (shape.type === 'line') {
            // ... (기존 라인 로직 유지)
            return;
        }

        // 채우기 도형의 실시간 스냅 적용
        if (shape.coatingType === 'fill' && isSnappingEnabled && shape.fillPattern) {
            const anchor = transformerRef.current?.getActiveAnchor();
            if (!anchor?.includes('rotator')) {
                const currentX = node.x();
                const currentY = node.y();

                // 스냅된 위치 적용
                const snappedPos = snapPointToGrid({ x: currentX, y: currentY });
                if (Math.abs(snappedPos.x - currentX) > 0.1) node.x(snappedPos.x);
                if (Math.abs(snappedPos.y - currentY) > 0.1) node.y(snappedPos.y);

                if (shape.type === 'rectangle') {
                    const currentWidth = node.width() * Math.abs(node.scaleX());
                    const currentHeight = node.height() * Math.abs(node.scaleY());
                    const { width: snappedWidth, height: snappedHeight } = snapShapeSize(
                        { width: currentWidth, height: currentHeight },
                        shape
                    );

                    const originalWidth = node.width();
                    const originalHeight = node.height();

                    if (Math.abs(snappedWidth - currentWidth) > 0.1 && originalWidth > 0) {
                        node.scaleX(Math.sign(node.scaleX()) * snappedWidth / originalWidth);
                    }
                    if (Math.abs(snappedHeight - currentHeight) > 0.1 && originalHeight > 0) {
                        node.scaleY(Math.sign(node.scaleY()) * snappedHeight / originalHeight);
                    }
                } else if (shape.type === 'circle') {
                    const currentRadius = (shape.radius || 0) * Math.abs(node.scaleX());
                    const snappedRadius = snapCircleRadius(currentRadius, shape);
                    const originalRadius = shape.radius || 1;
                    const newScale = snappedRadius / originalRadius;

                    if (Math.abs(newScale - Math.abs(node.scaleX())) > 0.01) {
                        const sign = Math.sign(node.scaleX());
                        node.scaleX(newScale * sign);
                        node.scaleY(newScale * sign);
                    }
                }
            }
        }

        // 이미지 Transform 로직 (기존 유지)
        if (shape.type === 'image' && transformStartCache.current) {
            // ...
        }

        node.getLayer()?.batchDraw();
    }, [shapes, transformerRef, isSnappingEnabled, snapPointToGrid, snapShapeSize, snapCircleRadius]);

    const handleTransformEnd = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];

        const updates = nodes.map(node => {
            const shape = shapes.find(s => s.id === node.id());
            if (!shape) return null;

            // Line 도형 특별 처리 (기존 유지)
            if (shape.type === 'line') {
                // ...
            }

            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();
            const newRotation = node.rotation();
            let newWidth = node.width() * Math.abs(oldScaleX);
            let newHeight = node.height() * Math.abs(oldScaleY);
            let newX = node.x();
            let newY = node.y();
            let newRadius: number | undefined;

            if (shape.type === 'circle') {
                const rawRadius = (shape.radius || 0) * Math.abs(oldScaleX);
                if (shape.coatingType === 'fill' && isSnappingEnabled) {
                    newRadius = snapCircleRadius(rawRadius, shape);
                } else if (isSnappingEnabled) {
                    newRadius = snapToGrid(rawRadius);
                } else {
                    newRadius = rawRadius;
                }
                newWidth = newHeight = newRadius * 2;
            } else if (shape.coatingType === 'fill' && isSnappingEnabled && shape.fillPattern) {
                const { width: finalWidth, height: finalHeight } = snapShapeSize({ width: newWidth, height: newHeight }, shape);
                newWidth = finalWidth;
                newHeight = finalHeight;
            } else if (isSnappingEnabled) {
                newWidth = snapToGrid(newWidth);
                newHeight = snapToGrid(newHeight);
            }

            if (isSnappingEnabled) {
                const snappedPos = snapPointToGrid({ x: newX, y: newY });
                newX = snappedPos.x;
                newY = snappedPos.y;
            }

            const newAttrs: Partial<CustomShapeConfig> = {
                x: newX,
                y: newY,
                rotation: newRotation,
                width: newWidth,
                height: newHeight,
                scaleX: 1,
                scaleY: 1,
            };

            if (newRadius !== undefined) {
                newAttrs.radius = newRadius;
            }

            if (shape.type === 'image') {
                const currentCrop = (node as Konva.Image).crop();
                if (currentCrop) {
                    newAttrs.crop = { ...currentCrop };
                }
            }

            node.scaleX(1);
            node.scaleY(1);
            node.width(newWidth);
            node.height(newHeight);
            node.x(newX);
            node.y(newY);

            if (shape.type === 'circle' && newAttrs.radius) {
                node.width(newAttrs.radius * 2);
                node.height(newAttrs.radius * 2);
            }

            return { id: shape.id!, props: { ...shape, ...newAttrs } };
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
    }, [dispatch, shapes, transformerRef, isSnappingEnabled, snapCircleRadius, snapShapeSize, snapToGrid, snapPointToGrid]);

    return useMemo(() => ({
        isTransforming,
        imageCache,
        handleTransformStart,
        handleTransform,
        handleTransformEnd,
    }), [handleTransform, handleTransformEnd, handleTransformStart, isTransforming]);
}
