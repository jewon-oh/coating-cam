import React, {useCallback, useMemo, useRef, useState} from 'react';
import type Konva from 'konva';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {batchUpdateShapes} from '@/store/slices/shape-slice';
import {setPresent} from '@/store/slices/shape-history-slice';
import type {CustomShapeConfig} from '@/types/custom-konva-config';
import {useSettings} from '@/contexts/settings-context';
import {useShapeSnapping} from './use-shape-snapping';
import {createCoatingPatternCanvas} from "@/lib/shape-create-utils";

/**
 * Transformer(크기 조절/회전)과 관련된 상태와 핸들러를 캡슐화한 훅
 */
export function useTransformerHandlers(
    transformerRef: React.RefObject<Konva.Transformer | null>
) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const {isSnappingEnabled, pixelsPerMm} = useSettings();
    const {snapCircleRadius, snapShapeSize} = useShapeSnapping();

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
                currentCrop = {x: 0, y: 0, width: originalImage.width, height: originalImage.height};
                imageNode.crop(currentCrop);
            }

            transformStartCache.current = {
                nodeX: node.x(),
                nodeY: node.y(),
                nodeWidth: node.width() * node.scaleX(),
                nodeHeight: node.height() * node.scaleY(),
                crop: {...currentCrop},
                originalImageWidth: originalImage.width,
                originalImageHeight: originalImage.height,
            };

            node.getLayer()?.batchDraw();
        }
    }, [shapes, transformerRef]);


    const handleTransform = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        const node = nodes[0] as Konva.Shape & {};
        const shape = shapes.find(s => s.id === node.id());
        if (!shape || shape.type === 'line') {
            return;
        }

        if (shape.coatingType === 'fill' && shape.lineSpacing && shape.lineSpacing > 0) {
            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();

            if (shape.type === 'rectangle') {
                const currentWidth = node.width() * Math.abs(oldScaleX);
                const currentHeight = node.height() * Math.abs(oldScaleY);

                const {width: snappedWidth, height: snappedHeight} = snapShapeSize(
                    {width: currentWidth, height: currentHeight},
                    {coatingType: shape.coatingType, lineSpacing: shape.lineSpacing, fillPattern: shape.fillPattern}
                );

                const newScaleX = node.width() > 0 ? snappedWidth / node.width() : 0;
                const newScaleY = node.height() > 0 ? snappedHeight / node.height() : 0;

                node.scaleX(Math.sign(oldScaleX) * newScaleX);
                node.scaleY(Math.sign(oldScaleY) * newScaleY);

            } else if (shape.type === 'circle' && shape.radius && shape.radius > 0) {
                const scale = Math.max(Math.abs(oldScaleX), Math.abs(oldScaleY));
                const currentRadius = (shape.radius || 0) * scale;
                const snappedRadius = snapCircleRadius(currentRadius, {
                    coatingType: shape.coatingType,
                    lineSpacing: shape.lineSpacing
                });

                // NOTE: `shape.radius` is guaranteed to be > 0 here by the `if` condition.
                const newScale = shape.radius > 0 ? snappedRadius / shape.radius : 0;

                node.scaleX(Math.sign(oldScaleX) * newScale);
                node.scaleY(Math.sign(oldScaleY) * newScale);
            }
        }

        if (shape.coatingType === 'fill' && shape.fillPattern) {
            let pattern: HTMLCanvasElement | undefined;
            const scaleX = Math.abs(node.scaleX());
            const scaleY = Math.abs(node.scaleY());

            if (shape.type === 'rectangle') {
                // =================================================================
                // ✨ BUGFIX: 부동 소수점 오차를 막기 위해 스냅된 크기를 직접 사용
                // =================================================================
                const currentWidth = node.width() * scaleX;
                const currentHeight = node.height() * scaleY;
                const {width: snappedWidth, height: snappedHeight} = snapShapeSize(
                    {width: currentWidth, height: currentHeight},
                    {coatingType: shape.coatingType, lineSpacing: shape.lineSpacing, fillPattern: shape.fillPattern}
                );

                if (snappedWidth > 0 && snappedHeight > 0) {
                    pattern = createCoatingPatternCanvas(
                        'rectangle',
                        snappedWidth,   // 스냅된 너비 사용
                        snappedHeight,  // 스냅된 높이 사용
                        (shape.lineSpacing || 0) * pixelsPerMm,
                        (shape.coatingWidth || 0) * pixelsPerMm,
                        shape.fillPattern || 'vertical'
                    );
                    if (pattern) {
                        node.fillPatternImage(pattern);
                        node.fillPatternScale({x: 1 / scaleX, y: 1 / scaleY});
                    }
                }
            } else if (shape.type === 'circle' && shape.radius && shape.radius > 0) {
                // =================================================================
                // ✨ BUGFIX: 부동 소수점 오차를 막기 위해 스냅된 반지름을 직접 사용
                // =================================================================
                const scale = Math.max(scaleX, scaleY);
                const currentRadius = (shape.radius || 0) * scale;
                const snappedRadius = snapCircleRadius(currentRadius, {
                    coatingType: shape.coatingType,
                    lineSpacing: shape.lineSpacing
                });
                const size = snappedRadius * 2;

                if (size > 0) {
                    pattern = createCoatingPatternCanvas(
                        'circle',
                        size, // 스냅된 크기 사용
                        size, // 스냅된 크기 사용
                        (shape.lineSpacing || 0) * pixelsPerMm,
                        (shape.coatingWidth || 0) * pixelsPerMm,
                        shape.fillPattern || 'vertical'
                    );
                    if (pattern) {
                        node.fillPatternImage(pattern);
                        node.fillPatternOffset({x: snappedRadius, y: snappedRadius}); // 스냅된 반지름으로 offset 설정
                        node.fillPatternScale({x: 1 / scale, y: 1 / scale});
                    }
                }
            }
        }

        if (shape.type === 'image' && transformStartCache.current) {
            const anchor = transformerRef.current?.getActiveAnchor();
            const isCropping = anchor && ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchor);

            if (isCropping) {
                const cache = transformStartCache.current;
                if (!cache.crop || cache.originalImageWidth <= 0 || cache.originalImageHeight <= 0) {
                    console.warn('❌ Transform cache가 잘못됨:', cache);
                    return;
                }

                const newCrop = {...cache.crop};
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
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));

                const finalScaleX = scaleX >= 0 ? uniformScale : -uniformScale;
                const finalScaleY = scaleY >= 0 ? uniformScale : -uniformScale;

                node.scaleX(finalScaleX);
                node.scaleY(finalScaleY);
            }
        }

        node.getLayer()?.batchDraw();
    }, [transformerRef, shapes, snapShapeSize, snapCircleRadius, pixelsPerMm]);

    const handleTransformEnd = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];

        const updates = nodes.map(node => {
            const shape = shapes.find(s => s.id === node.id());
            if (!shape || shape.type === 'line') {
                return null;
            }

            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();
            const newRotation = node.rotation();
            const newX = node.x();
            const newY = node.y();

            // ================================================================
            // ✨ FIX: 최종 크기를 저장하기 전에 스냅핑을 적용합니다.
            // ================================================================
            let newWidth = node.width() * Math.abs(oldScaleX);
            let newHeight = node.height() * Math.abs(oldScaleY);
            let newRadius: number | undefined;

            if (isSnappingEnabled) {
                if (shape.type === 'rectangle' && shape.coatingType === 'fill' && shape.lineSpacing) {
                    const snapped = snapShapeSize({width: newWidth, height: newHeight}, {
                        coatingType: shape.coatingType,
                        lineSpacing: shape.lineSpacing,
                        fillPattern: shape.fillPattern
                    });
                    newWidth = snapped.width;
                    newHeight = snapped.height;
                } else if (shape.type === 'circle' && shape.coatingType === 'fill' && shape.lineSpacing) {
                    const rawRadius = (shape.radius || 0) * Math.max(Math.abs(oldScaleX), Math.abs(oldScaleY));
                    newRadius = snapCircleRadius(rawRadius, {
                        coatingType: shape.coatingType,
                        lineSpacing: shape.lineSpacing
                    });
                    newWidth = newHeight = newRadius * 2;
                }
            } else if (shape.type === 'circle') {
                newRadius = (shape.radius || 0) * Math.max(Math.abs(oldScaleX), Math.abs(oldScaleY));
                newWidth = newHeight = newRadius * 2;
            }
            // ================================================================

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
                    newAttrs.crop = {...currentCrop};
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

            return {id: shape.id!, props: {...shape, ...newAttrs}};
        }).filter((u): u is { id: string; props: CustomShapeConfig } => u !== null);

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates as { id: string; props: Partial<CustomShapeConfig> }[]));
            const updatedShapesForHistory = shapes.map(s => {
                const update = updates.find(u => u.id === s.id);
                return update ? {...s, ...update.props} : s;
            });
            dispatch(setPresent(updatedShapesForHistory));
        }

        transformStartCache.current = null;
        setIsTransforming(false);
    }, [dispatch, shapes, transformerRef, isSnappingEnabled, snapCircleRadius, snapShapeSize]); // snapShapeSize 의존성 추가

    return useMemo(() => ({
        isTransforming,
        imageCache,
        handleTransformStart,
        handleTransform,
        handleTransformEnd,
    }), [handleTransform, handleTransformEnd, handleTransformStart, isTransforming]);
}