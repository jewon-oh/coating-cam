import React, {useCallback, useMemo, useRef, useState} from 'react';
import type Konva from 'konva';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {batchUpdateShapes} from '@/store/slices/shapes-slice';
import {setPresent} from '@/store/slices/history-slice';
import type {AnyNodeConfig} from '@/types/custom-konva-config';

/**
 * Transformer(크기 조절/회전)과 관련된 상태와 핸들러를 캡슐화한 훅
 * - 이미지 도형의 크롭 유지/변환 로직 포함
 * - isTransforming 상태 노출 (다른 최적화/캐시 로직에서 사용)
 * - 이미지 캐시(imageCache) 노출 (외부 이미지 로딩 로직 재사용을 위해)
 */
export function useTransformerHandlers(
    transformerRef: React.RefObject<Konva.Transformer | null>,
) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((s) => s.shapes.shapes);

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
        if (nodes.length === 0 || !transformStartCache.current) return;

        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        if (shape && shape.type === 'image') {
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
                    case 'top-center' :
                        newCrop.height = Math.max(1, cache.crop.height + cropHeightChange);
                        console.log('newCrop', newCrop);
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
            }else {
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

                // 레이어 다시 그리기
                node.getLayer()?.batchDraw();
            }
        }
    }, [shapes, transformerRef]);

    const handleTransformEnd = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        const updates = nodes.map(node => {
            const shape = shapes.find(s => s.id === node.id());
            if (!shape) return null;

            const oldScaleX = node.scaleX();
            const oldScaleY = node.scaleY();
            const newRotation = node.rotation();
            const newWidth = node.width() * oldScaleX;
            const newHeight = node.height() * oldScaleY;

            const newAttrs: AnyNodeConfig = {
                ...shape,
                y: node.y(),
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

            if (shape.type === 'rectangle' || shape.type === 'image') {
                newAttrs.x = node.x();
            } else if (shape.type === 'circle') {
                newAttrs.x = node.x();
                newAttrs.radius = newWidth / 2;
            }

            // Konva 노드의 스케일을 리셋
            node.scaleX(1);
            node.scaleY(1);

            return { id: shape.id!, props: newAttrs };
        }).filter((u): u is { id: string; props: AnyNodeConfig } => u !== null);

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates as { id: string; props: Partial<AnyNodeConfig> }[]));
            const updatedShapesForHistory = shapes.map(s => {
                const update = updates.find(u => u.id === s.id);
                return update ? { ...s, ...update.props } : s;
            });
            dispatch(setPresent(updatedShapesForHistory));
        }

        transformStartCache.current = null;
        setIsTransforming(false);
    }, [dispatch, shapes, transformerRef]);

    return useMemo(() => ({
        isTransforming,
        imageCache,
        handleTransformStart,
        handleTransform,
        handleTransformEnd,
    }), [handleTransform, handleTransformEnd, handleTransformStart, isTransforming]);
}
