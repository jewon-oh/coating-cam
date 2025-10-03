import React, {useCallback, useMemo, useRef, useState} from 'react';
import type Konva from 'konva';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {batchUpdateShapes} from '@/store/slices/shape-slice';
import {setPresent} from '@/store/slices/shape-history-slice';
import type {CustomShapeConfig} from '@/types/custom-konva-config';
import {useSettings} from '@/contexts/settings-context';
import {useShapeSnapping} from './use-shape-snapping';
import {Vector2d} from "konva/lib/types";
import {createCoatingPatternCanvas} from "@/lib/shape-create-utils";
import {Box} from "konva/lib/shapes/Transformer";

type TransformStartCache ={
    // 공통 속성
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    anchorStartPos: Vector2d; // 변형 시작 시점의 앵커 월드 좌표
    // 이미지 전용 속성
    crop?: { x: number; y: number; width: number; height: number };
    originalImageWidth?: number;
    originalImageHeight?: number;
}
/**
 * Transformer(크기 조절/회전)과 관련된 상태와 핸들러를 캡슐화한 훅
 */
export function useTransformerHandlers(
    transformerRef: React.RefObject<Konva.Transformer | null>,
    imageCache?: React.RefObject<Map<string, HTMLImageElement>| null>
) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const {isSnappingEnabled, pixelsPerMm} = useSettings();
    const {snapCircleRadius, snapShapeSize} = useShapeSnapping();
    // --- 크기 표시기(Indicator) 관련 상태 및 로직 ---
    const [indicatorPosition, setIndicatorPosition] = useState<{ x: number; y: number } | null>(null);
    const [indicatorText, setIndicatorText] = useState('');
    const [indicatorScale, setIndicatorScale] = useState({ x: 1, y: 1 });

    // 변형 중 여부 (Transformer 가시성/캐시 제어 등에 사용)
    const [isTransforming, setIsTransforming] = useState(false);

    // 이미지 변형 시작 시의 캐시 (크롭 기능에 사용)
    const transformStartCache = useRef< TransformStartCache| null>(null);

    const updateIndicator = useCallback(() => {
        const transformer = transformerRef.current;
        if (!transformer) {
            setIsTransforming(false);
            return;
        }
        const node = transformer.nodes()[0];
        const stage = transformer.getStage();

        if (!node || !stage) {
            return;
        }

        // 회전 중에는 표시하지 않음
        const isRotating = transformer.getActiveAnchor()?.includes('rotater');
        if (isRotating) {
            return;
        }

        // Konva 노드의 실제 크기 (scale 적용)
        const width = node.width() * node.scaleX();
        const height = node.height() * node.scaleY();

        // mm 단위로 변환
        const widthInMm = (Math.abs(width) / pixelsPerMm).toFixed(2);
        const heightInMm = (Math.abs(height) / pixelsPerMm).toFixed(2);

        // 회전을 포함한 경계 상자를 가져옴 (스테이지 컨테이너 기준)
        const rect = node.getClientRect();

        // 스테이지의 현재 스케일과 위치(패닝)를 가져옴
        const stageScale = stage.scale();
        const stagePos = stage.position();

        // 인디케이터 위치를 계산.
        // getClientRect로 얻은 좌표는 스테이지 컨테이너 기준이므로,
        // 스테이지 내부 좌표계로 변환해야 함.
        const position = {
            x: (rect.x - stagePos.x + rect.width / 2) / stageScale.x,
            y: (rect.y - stagePos.y + rect.height) / stageScale.y + 10 / stageScale.y,
        };
        setIndicatorPosition(position);

        // 인디케이터가 스테이지 확대/축소에 영향을 받지 않도록 스케일 설정
        setIndicatorScale({ x: stageScale.x, y: stageScale.y });
        setIndicatorText(`W: ${widthInMm} H: ${heightInMm}`);

        setIsTransforming(true);
    }, [transformerRef, pixelsPerMm]);

    const handleTransformStart = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        setIsTransforming(true);
        updateIndicator(); // 인디케이터 초기 위치 설정 및 표시

        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        // 현재 활성화된 앵커의 시작 위치를 가져옵니다.
        const activeAnchor = transformerRef.current?.findOne('.' + transformerRef.current.getActiveAnchor());
        if (!activeAnchor) return;

        // 변형 시작 시점의 상태를 캐시
        transformStartCache.current = {
            width: node.width(),
            height: node.height(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
            anchorStartPos: activeAnchor.getAbsolutePosition(),
        };

        if (shape && shape.type === 'image') {
            const imageNode = node as Konva.Image;

            // 이미지 객체 가져오기 (노드 -> 캐시 순)
            let originalImage: HTMLImageElement | undefined = imageNode.image() as HTMLImageElement;
            if (!originalImage && shape.imageDataUrl) {
                if(imageCache===null){
                    console.log("no imageCache!!");
                }else{
                    originalImage = imageCache?.current.get(shape.imageDataUrl);
                }
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
                ...transformStartCache.current,
                crop: {...currentCrop},
                originalImageWidth: originalImage.width,
                originalImageHeight: originalImage.height,
            };

            node.getLayer()?.batchDraw();
        }
    }, [imageCache, shapes, transformerRef, updateIndicator]);

    const handleTransform = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        const node = nodes[0] as Konva.Shape & {};
        const shape = shapes.find(s => s.id === node.id());
        if (!shape || shape.type === 'line') {
            return;
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

                const widthChange = currentDisplayedWidth - cache.width;
                const heightChange = currentDisplayedHeight - cache.height;

                const originalDisplayRatioX = cache.width / cache.crop.width;
                const originalDisplayRatioY = cache.height / cache.crop.height;
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
    
    const boundBoundFunc = useCallback((oldBox: Box, newBox: Box): Box => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return newBox;
    
        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());
        if (!shape || shape.type === 'line' || !isSnappingEnabled) {
            return newBox;
        }
    
        updateIndicator();
    
        // 이미지 크롭 시 종횡비 유지 로직
        const anchor = transformerRef.current?.getActiveAnchor();
        if (shape.type === 'image' && anchor) {
            const isCroppingX = ['middle-left', 'middle-right'].includes(anchor);
            const isCroppingY = ['top-center', 'bottom-center'].includes(anchor);
    
            if (isCroppingX) {
                // X축으로만 크롭할 때 Y축 크기는 고정
                newBox.height = oldBox.height;
                newBox.y = oldBox.y;
            } else if (isCroppingY) {
                // Y축으로만 크롭할 때 X축 크기는 고정
                newBox.width = oldBox.width;
                newBox.x = oldBox.x;
            }
        }
    
        // 스냅핑 로직
        if (shape.coatingType === 'fill' && shape.lineSpacing && shape.lineSpacing > 0) {
            // 회전이 적용된 상태에서 너비/높이를 직접 사용하면 부정확하므로,
            // 회전이 0일 때의 너비/높이를 기준으로 계산합니다.
            const rotation = node.rotation();
            node.rotation(0); // 임시로 회전 제거
            const rotatedBox = node.getClientRect({skipTransform: true}); // 회전 없는 상태의 box
            node.rotation(rotation); // 회전 복원
    
            const scaleX = newBox.width / rotatedBox.width;
            const scaleY = newBox.height / rotatedBox.height;
    
            if (shape.type === 'rectangle') {
                const {width: snappedWidth, height: snappedHeight} = snapShapeSize({width: newBox.width, height: newBox.height}, shape);
                newBox.width = snappedWidth;
                newBox.height = snappedHeight;
            } else if (shape.type === 'circle' && shape.radius && shape.radius > 0) {
                const scale = Math.max(scaleX, scaleY);
                const currentRadius = shape.radius * scale;
                const snappedRadius = snapCircleRadius(currentRadius, shape);
                const newSize = snappedRadius * 2;
                newBox.width = newSize;
                newBox.height = newSize;
            }
        }
    
        return newBox;
    }, [shapes, snapCircleRadius, snapShapeSize, transformerRef, updateIndicator, isSnappingEnabled]);

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
            // Konva는 변형 시 scale을 변경하므로, 원래 크기에 scale을 곱해 현재 크기를 얻습니다.
            const rawWidth = node.width() * oldScaleX;
            const rawHeight = node.height() * oldScaleY;

            let finalWidth = rawWidth;
            let finalHeight = rawHeight;
            let newRadius: number | undefined;

            if (isSnappingEnabled) {
                if (shape.type === 'rectangle' && shape.coatingType === 'fill' && shape.lineSpacing) {
                    const snapped = snapShapeSize({width: rawWidth, height: rawHeight}, {
                        coatingType: shape.coatingType,
                        lineSpacing: shape.lineSpacing,
                        fillPattern: shape.fillPattern
                    });
                    finalWidth = snapped.width;
                    finalHeight = snapped.height;
                } else if (shape.type === 'circle' && shape.coatingType === 'fill' && shape.lineSpacing && shape.radius) {
                    const rawRadius = (shape.radius || 0) * Math.max(oldScaleX, oldScaleY);
                    newRadius = snapCircleRadius(rawRadius, {
                        coatingType: shape.coatingType,
                        lineSpacing: shape.lineSpacing
                    });
                    finalWidth = finalHeight = newRadius * 2; // 원은 너비와 높이가 같음
                }
            } else if (shape.type === 'circle') {
                newRadius = (shape.radius || 0) * Math.max(oldScaleX, oldScaleY);
                finalWidth = finalHeight = newRadius * 2;
            }
            // ================================================================

            // 도형 생성 로직과 동일하게, 뒤집혔을 경우(rawWidth/Height < 0)를 고려하여 최종 x, y를 계산
            // 이렇게 하면 왼쪽/위쪽 핸들을 조작해도 도형이 올바른 위치에 고정됩니다.
            let finalX = newX;
            let finalY = newY;

            if (shape.type === 'rectangle') {
                if (rawWidth < 0) finalX = newX + rawWidth;
                if (rawHeight < 0) finalY = newY + rawHeight;
            } else if (shape.type === 'circle') {
                // 원은 중심점이 기준이므로 x, y를 그대로 사용합니다.
            }

            const newAttrs: Partial<CustomShapeConfig> = {
                x: finalX,
                y: finalY,
                rotation: newRotation, // 회전값 저장
                width: Math.abs(finalWidth),
                height: Math.abs(finalHeight),
                scaleX: 1,
                scaleY: 1,
            };

            if (newRadius !== undefined) {
                newAttrs.radius = newRadius;
            }

            node.scaleX(1);
            node.scaleY(1);
            node.width(Math.abs(finalWidth));
            node.height(Math.abs(finalHeight));
            node.x(finalX);
            node.y(finalY);
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
        handleTransformStart,
        handleTransform,
        handleTransformEnd,
        boundBoundFunc,
        indicatorPosition,
        indicatorText,
        indicatorScale,
    }), [isTransforming, handleTransformStart, handleTransform, handleTransformEnd, boundBoundFunc, indicatorPosition, indicatorText, indicatorScale]);
}
