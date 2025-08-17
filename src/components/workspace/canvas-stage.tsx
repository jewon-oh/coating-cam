"use client";

import React, {useRef, useCallback, useEffect, useState} from 'react';
import {Stage, Layer, Rect, Transformer, Circle, Image, Group} from 'react-konva';
import type Konva from 'konva';

import {
    unselectAllShapes,
    updateShape,
    batchUpdateShapes,
} from '@/store/slices/shapes-slice';
import {setPresent} from '@/store/slices/history-slice';
import {redoWithSync, undoWithSync} from "@/store/thunks/history-thunk";

// 컨텍스트 및 훅 임포트
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {useCanvasInteractions} from '@/hooks/use-canvas-interactions';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';

// 컴포넌트 임포트
import {ShapeConfig} from "konva/lib/Shape";
import {TransformerConfig} from "konva/lib/shapes/Transformer";
import {AnyNodeConfig} from '@/types/custom-konva-config';
import CanvasGrid from "@/components/workspace/canvas-grid";


export default function CanvasStage() {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const tool = useAppSelector((state) => state.tool.tool);

    // 패닝
    const isPanningRef = useRef(false);
    const [isPanning, setIsPanning] = useState(false);

    // 호버링
    const [isHoveringShape, setIsHoveringShape] = useState<string | null>(null);

    // 캐시 관련 상태
    const [isCacheEnabled, setIsCacheEnabled] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);

    const transformerConfig: TransformerConfig = {
        anchorStyleFunc: (anchor) => {
            anchor.cornerRadius(10);
            if (anchor.hasName("top-center") || anchor.hasName("bottom-center")) {
                anchor.height(6);
                anchor.offsetY(3);
                anchor.width(26);
                anchor.offsetX(13);
            } else if (anchor.hasName("middle-left") || anchor.hasName("middle-right")) {
                anchor.height(26);
                anchor.offsetY(13);
                anchor.width(6);
                anchor.offsetX(3);
            } else if (anchor.hasName("rotater")) {
                anchor.cornerRadius(15);
                anchor.width(26);
                anchor.height(26);
                anchor.offsetX(13);
                anchor.offsetY(13);
            } else {
                anchor.width(14);
                anchor.offsetX(8);
                anchor.height(14);
                anchor.offsetY(8);
            }
        },
    }

    // Context에서 모든 캔버스 상태 가져오기
    const {
        stageRef,
        canvasContainerRef,
        canvasSize,
        stage,
        setStage,
        handleWheel,
        setIsLoading,
        setLoadingMessage
    } = useCanvas();

    const layerRef = useRef<Konva.Layer>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const selectionRectRef = useRef<Konva.Rect>(null);

    // 캐시용 그룹 ref들 - 이미지와 다른 도형을 분리
    const imageGroupRef = useRef<Konva.Group>(null);
    const shapeGroupRef = useRef<Konva.Group>(null);

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

    // SettingsContext에서 그리드 및 작업 영역 설정 가져오기
    const {isGridVisible, gridSize, workArea,} = useSettings();

    // 이미지 캐시를 위한 ref 추가
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // 캐시 자동 활성화 로직 - 조건을 더 보수적으로 변경
    useEffect(() => {
        const currentShapeCount = shapes.length;

        // 도형 수가 50개 이상이면 자동으로 캐시 활성화 (더 보수적)
        if (currentShapeCount >= 50 && !isCacheEnabled && !isTransforming) {
            setIsCacheEnabled(true);
            console.log('🚀 캐시 자동 활성화: 도형 수', currentShapeCount);
        }

        // 도형 수가 50개 미만이면 캐시 비활성화
        else if (currentShapeCount < 50 && isCacheEnabled) {
            setIsCacheEnabled(false);
            console.log('📉 캐시 자동 비활성화: 도형 수', currentShapeCount);
        }
    }, [shapes.length, isCacheEnabled, isTransforming]);

    // 개선된 캐시 적용 로직
    useEffect(() => {
        // Transform 중이거나 선택된 도형이 있으면 캐시 비활성화
        if (isTransforming || selectedShapeIds.length > 0) {
            if (imageGroupRef.current) {
                imageGroupRef.current.clearCache();
            }
            if (shapeGroupRef.current) {
                shapeGroupRef.current.clearCache();
            }

            return;
        }

        if (isCacheEnabled) {
            // 캐시 활성화 - 약간의 지연을 두어 안정성 확보
            const timeoutId = setTimeout(() => {
                try {
                    // 이미지 그룹 캐시
                    if (imageGroupRef.current && imageGroupRef.current.children.length > 0) {
                        imageGroupRef.current.cache();
                        
                        console.log('✅ 이미지 그룹 캐시 활성화');
                    }

                    // 일반 도형 그룹 캐시
                    if (shapeGroupRef.current && shapeGroupRef.current.children.length > 0) {
                        shapeGroupRef.current.cache();
                        console.log('✅ 도형 그룹 캐시 활성화');
                    }

                    layerRef.current?.batchDraw();
                } catch (error) {
                    console.error('❌ 캐시 활성화 실패:', error);
                    setIsCacheEnabled(false);
                }
            }, 200);

            return () => clearTimeout(timeoutId);
        } else {
            // 캐시 비활성화
            if (imageGroupRef.current) {
                imageGroupRef.current.clearCache();
            }
            if (shapeGroupRef.current) {
                shapeGroupRef.current.clearCache();
            }
            console.log('❌ 모든 그룹 캐시 비활성화');
        }
    }, [isCacheEnabled, isTransforming, selectedShapeIds.length]);

    // 도형이 변경될 때 캐시 갱신 (더 안전하게)
    useEffect(() => {
        if (isCacheEnabled && !isTransforming && selectedShapeIds.length === 0) {
            const timeoutId = setTimeout(() => {
                try {
                    let cacheUpdated = false;

                    if (imageGroupRef.current && imageGroupRef.current.children.length > 0) {
                        imageGroupRef.current.cache();
                        cacheUpdated = true;
                    }

                    if (shapeGroupRef.current && shapeGroupRef.current.children.length > 0) {
                        shapeGroupRef.current.cache();
                        cacheUpdated = true;
                    }

                    if (cacheUpdated) {
                        layerRef.current?.batchDraw();
                        console.log('🔄 캐시 갱신됨');
                    }
                } catch (error) {
                    console.error('❌ 캐시 갱신 실패:', error);
                }
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [shapes, isCacheEnabled, isTransforming, selectedShapeIds.length]);

    // 이미지 로드 함수 개선
    const loadImage = useCallback((imageDataUrl: string, shapeId: string | undefined): HTMLImageElement | null => {
        if (imageCache.current.has(imageDataUrl)) {
            const cachedImg = imageCache.current.get(imageDataUrl)!;
            if (cachedImg.complete) {
                return cachedImg;
            }
        }

        const img = new window.Image();
        img.crossOrigin = "anonymous";

        // ✅ 이미지 로딩 시작 시 로딩 상태 업데이트
        setLoadingMessage(`이미지 로딩 중... (${shapeId})`);
        setIsLoading(true);

        img.onload = () => {
            const shape = shapes.find(s => s.id === shapeId);
            if (shape && !shape.crop) {
                const defaultCrop = {
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height
                };

                if (shapeId !== undefined) {
                    dispatch(updateShape({
                        id: shapeId,
                        updatedProps: {crop: defaultCrop}
                    }));
                }
            }

            // ✅ 이미지 로딩 완료
            setIsLoading(false);
            setLoadingMessage('로딩 중...');
            layerRef.current?.batchDraw();
        };

        img.onerror = (error) => {
            console.error(`❌ 이미지 로드 실패 (${shapeId}):`, error);
            imageCache.current.delete(imageDataUrl);

            // ✅ 에러 시에도 로딩 상태 해제
            setIsLoading(false);
            setLoadingMessage('로딩 중...');
        };

        img.src = imageDataUrl;
        imageCache.current.set(imageDataUrl, img);

        return img.complete ? img : null;
    }, [shapes, dispatch, setIsLoading, setLoadingMessage]);


    const [isCanvasFocused, setIsCanvasFocused] = useState(false);

    const handleCanvasFocus = useCallback(() => {
        setIsCanvasFocused(true);
        console.log('🎯 캔버스 포커스됨');
    }, []);

    const handleCanvasBlur = useCallback(() => {
        setIsCanvasFocused(false);
        console.log('🔸 캔버스 포커스 해제됨');
    }, []);

    const handleCanvasClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {

        if (canvasContainerRef.current) {
            canvasContainerRef.current.focus(); // 클릭 시 포커스 설정
        }

        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }
    }, [canvasContainerRef, dispatch]);


    const fitToWorkArea = useCallback(() => {
        // workArea가 캔버스에 들어오도록 대략 맞춤
        const margin = 40;
        const scaleX = (canvasSize.width - margin) / workArea.width;
        const scaleY = (canvasSize.height - margin) / workArea.height;
        const scale = Math.min(8, Math.max(0.1, Math.min(scaleX, scaleY)));
        const centeredX = (canvasSize.width - workArea.width * scale) / 2;
        const centeredY = (canvasSize.height - workArea.height * scale) / 2;
        setStage({ scale, x: centeredX, y: centeredY });
    }, [canvasSize.width, canvasSize.height, workArea.width, workArea.height, setStage]);

    /**
     * 선택된 도형이 변경될 때마다 Transformer를 업데이트합니다.
     * Transformer는 선택된 도형 주위에 크기 조절 및 회전 핸들을 표시합니다.
     */
    useEffect(() => {
        if (transformerRef.current) {
            const nodesToSet: Konva.Shape[] = [];
            selectedShapeIds.forEach(id => {
                const foundNode = layerRef.current?.findOne(`#${id}`);
                if (foundNode) {
                    nodesToSet.push(foundNode as Konva.Shape);
                }
            });
            transformerRef.current?.nodes(nodesToSet);
            transformerRef.current?.getLayer()?.batchDraw();
        }
    }, [selectedShapeIds, shapes, layerRef]);

    // Canvas 상호작용 핸들러
    const {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
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
    } = useCanvasInteractions(stageRef, setStage, selectionRectRef,isPanningRef,setIsPanning);


    /**
     * 도형 변형(크기 조절, 회전)이 끝났을 때 호출되는 콜백 함수.
     * 변형된 도형의 속성을 업데이트하고 히스토리에 저장합니다.
     */
    const handleTransformStart = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0) return;

        setIsTransforming(true);
        console.log('🔧 변형 시작');

        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        if (shape && shape.type === 'image') {
            const imageNode = node as Konva.Image;

            // 1. 이미지 객체 가져오기 (여러 방법 시도)
            let originalImage: HTMLImageElement | undefined = imageNode.image() as HTMLImageElement;

            // 이미지가 없으면 캐시에서 찾기
            if (!originalImage && shape.imageDataUrl) {
                originalImage = imageCache.current.get(shape.imageDataUrl);
            }

            if (!originalImage || !originalImage.complete) {
                console.warn('❌ Transform 시작 시 이미지를 찾을 수 없음:', shape.id);
                return; // transform 취소
            }

            // 2. 현재 crop 정보 확인 (우선순위: Konva노드 > shape데이터 > 기본값)
            let currentCrop = imageNode.crop();

            if (!currentCrop && shape.crop) {
                currentCrop = shape.crop;
                imageNode.crop(currentCrop); // 노드에 적용
            }

            if (!currentCrop) {
                // 기본 crop 설정 (전체 이미지)
                currentCrop = {
                    x: 0,
                    y: 0,
                    width: originalImage.width,
                    height: originalImage.height
                };
                imageNode.crop(currentCrop);
            }

            console.log('🎯 Transform 시작:', {
                shapeId: shape.id,
                imageSize: {width: originalImage.width, height: originalImage.height},
                currentCrop,
                nodeSize: {width: node.width(), height: node.height()}
            });

            transformStartCache.current = {
                nodeX: node.x(),
                nodeY: node.y(),
                nodeWidth: node.width() * node.scaleX(),
                nodeHeight: node.height() * node.scaleY(),
                crop: {...currentCrop}, // 깊은 복사
                originalImageWidth: originalImage.width,
                originalImageHeight: originalImage.height,
            };

            // 즉시 리렌더링
            node.getLayer()?.batchDraw();
        }
    }, [shapes, imageCache]);

    const handleTransform = useCallback(() => {
        const nodes = transformerRef.current?.nodes() || [];
        if (nodes.length === 0 || !transformStartCache.current) return;

        const node = nodes[0];
        const shape = shapes.find(s => s.id === node.id());

        if (shape && shape.type === 'image') {
            const anchor = transformerRef.current?.getActiveAnchor();

            const isCropping = anchor
                && ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchor);

            if (isCropping) {
                const cache = transformStartCache.current;

                // 안전성 검사
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

                // 0으로 나누기 방지
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
                    case 'bottom-center':
                        newCrop.height = Math.max(1, cache.crop.height + cropHeightChange);
                        break;
                    case 'top-center':
                        newCrop.y = Math.max(0, cache.crop.y - cropHeightChange);
                        newCrop.height = Math.max(1, cache.crop.height + cropHeightChange);
                        break;
                }

                // 범위 검증
                newCrop.x = Math.max(0, Math.min(newCrop.x, cache.originalImageWidth - 1));
                newCrop.y = Math.max(0, Math.min(newCrop.y, cache.originalImageHeight - 1));
                newCrop.width = Math.max(1, Math.min(newCrop.width, cache.originalImageWidth - newCrop.x));
                newCrop.height = Math.max(1, Math.min(newCrop.height, cache.originalImageHeight - newCrop.y));

                console.log('🔄 Crop 안전 업데이트:', {
                    anchor,
                    oldCrop: cache.crop,
                    newCrop,
                    imageSize: {width: cache.originalImageWidth, height: cache.originalImageHeight}
                });

                try {
                    (node as Konva.Image).crop(newCrop);
                    node.getLayer()?.batchDraw();
                } catch (error) {
                    console.error('❌ Crop 적용 실패:', error);
                }
            }
        }
    }, [shapes]);

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

            // 새로운 속성 객체
            const newAttrs: AnyNodeConfig = {
                ...shape,
                y: node.y(),
                rotation: newRotation,
                width: newWidth,
                height: newHeight,
                scaleX: 1,
                scaleY: 1,
            };

            // 이미지의 경우 현재 크롭 정보를 저장
            if (shape.type === 'image') {
                const currentCrop = (node as Konva.Image).crop();
                if (currentCrop) {
                    newAttrs.crop = {
                        x: currentCrop.x,
                        y: currentCrop.y,
                        width: currentCrop.width,
                        height: currentCrop.height
                    };
                }
            }

            // 도형 종류에 따라 x 좌표와 반지름(원)을 다르게 계산
            if (shape.type === 'rectangle' || shape.type === 'image') {
                // Konva의 x는 offsetX가 width로 설정되어 있으므로 이미 오른쪽 상단 기준
                newAttrs.x = node.x();
            } else if (shape.type === 'circle') {
                newAttrs.x = node.x();
                newAttrs.radius = (newWidth / 2);
            }

            // Konva 노드의 스케일을 리셋
            node.scaleX(1);
            node.scaleY(1);

            return {id: shape.id, props: newAttrs};
        }).filter((update): update is { id: string; props: AnyNodeConfig } => update !== null);

        if (updates.length > 0) {
            // updateMultipleShapes
            dispatch(batchUpdateShapes(updates as { id: string; props: Partial<ShapeConfig> }[]));
            const updatedShapesForHistory = shapes.map(s => {
                const update = updates.find(u => u.id === s.id);
                return update ? {...s, ...update.props} : s;
            });
            dispatch(setPresent(updatedShapesForHistory));
        }

        transformStartCache.current = null;
        setIsTransforming(false);
        console.log('✅ 변형 완료');
    }, [shapes, dispatch]);

    // 향상된 키보드 이벤트 핸들러
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // 화면맞춤
            if (isCtrlOrCmd && e.key === "0") {
                e.preventDefault();
                fitToWorkArea();
                return;
            }

            // 작업 단축키
            if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'a') {
                if (isCanvasFocused) {
                    e.preventDefault(); // 브라우저 기본 전체선택 방지
                    handleSelectAll();
                }
                return; // 다른 핸들러 실행 방지
            } else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') handleCopy();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') handlePaste();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'x') handleCut();
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') dispatch(undoWithSync());
            else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') dispatch(redoWithSync());

            // 도형 추가 단축키
            else if (e.key.toLowerCase() === 'v') dispatch({type: 'tool/setTool', payload: 'select'});
            else if (e.key.toLowerCase() === 'c') dispatch({type: 'tool/setTool', payload: 'circle'});
            else if (e.key.toLowerCase() === 'r') dispatch({type: 'tool/setTool', payload: 'rectangle'});
            else if (e.key === 'Escape') {
                dispatch(unselectAllShapes());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDelete, handleCopy, handlePaste, handleCut, dispatch, handleSelectAll, isCanvasFocused, fitToWorkArea]);


    // 렌더 순서: 이미지 먼저(항상 뒤), 그 다음 다른 도형(항상 위)
    const visibleShapes = Array.isArray(shapes) ? shapes.filter(s => s.visible !== false) : [];
    const imageShapes = visibleShapes.filter(s => s.type === 'image');
    const otherShapes = visibleShapes.filter(s => s.type !== 'image');

    // 공통 프로퍼티
    const makeCommonProps = (shape: Partial<AnyNodeConfig>) => ({
        draggable: tool === 'select' && !shape.listening && !isPanning,
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (isPanning) return;
            e.evt.preventDefault();
            handleSelect(e);
        },
        onMouseEnter: () => !isPanning && setIsHoveringShape(shape.id!),
        onMouseLeave: () => setIsHoveringShape(null),
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        shadowColor: isHoveringShape === shape.id && !isPanning ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
        shadowBlur: isHoveringShape === shape.id && !isPanning ? 10 : 0,
        shadowOffset: isHoveringShape === shape.id ? {x: 0, y: 0} : {x: 0, y: 0},
        perfectDrawEnabled: false,
        listening: !isPanning && tool === 'select'
    });

    return (
        <div
            ref={canvasContainerRef}
            className="absolute inset-0"
            tabIndex={0} // 포커스 가능하도록 설정
            onFocus={handleCanvasFocus}
            onBlur={handleCanvasBlur}
            style={{
                outline: 'none', // 포커스 시 아웃라인 제거
                width: '100%',
                height: '100%',
                // 포커스 상태에 따른 시각적 피드백 (선택사항)
                border: isCanvasFocused ? '2px solid rgba(59, 130, 246, 0.3)' : '2px solid transparent',
                borderRadius: '8px',
                transition: 'border-color 0.2s ease'
            }}
        >

            <Stage
                ref={stageRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onMouseDown={(e) => handleMouseDown(e, layerRef)}
                // onDragMove={handleDragMove}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={handleContextMenu}
                x={stage.x}
                y={stage.y}
                scaleX={stage.scale}
                scaleY={stage.scale}
                onClick={handleCanvasClick}
                listening={!isPanning}
            >

                {/* 배경 */}
                <Layer
                    listening={false}
                >
                    {/* 캔버스 배경*/}
                    <Rect
                        x={-stage.x / stage.scale}
                        y={-stage.y / stage.scale}
                        width={canvasSize.width / stage.scale}
                        height={canvasSize.height / stage.scale}
                        fill="#f0f0f0"
                        listening={false}
                    />
                    {/* workspace 경계 표시*/}
                    <Rect
                        x={0}
                        y={0}
                        width={workArea.width}
                        height={workArea.height}
                        stroke="black"
                        strokeWidth={1 / stage.scale}
                        dash={[4 / stage.scale, 2 / stage.scale]}
                        listening={false}
                    />
                    {/* 그리드 표시 */}
                    <CanvasGrid
                        stage={stage}
                        gridSize={gridSize}
                        workArea={workArea}
                        visible={isGridVisible}
                        isPanning={isPanning}
                        viewportWidth={canvasSize.width}
                        viewportHeight={canvasSize.height}
                    />

                </Layer>


                <Layer ref={layerRef}>
                    {/* 이미지 그룹 (캐시 가능) */}
                    <Group
                        ref={imageGroupRef}
                        listening={tool === 'select' && !isPanning} // 선택 도구일 때만 이벤트 수신

                    >
                        {imageShapes.map((shape) => {
                            const imageElement = shape.imageDataUrl ? loadImage(shape.imageDataUrl, shape.id) : null;

                            if (!imageElement) {
                                return (
                                    <Rect
                                        key={`${shape.id}-loading`}
                                        id={shape.id}
                                        name='shape'
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
                                    name='shape'
                                    alt='canvas image shape'
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

                    {/* 일반 도형 그룹 (캐시 가능) */}
                    <Group
                        ref={shapeGroupRef}
                        listening={!isPanning} // 항상 이벤트 수신
                    >
                        {otherShapes.map((shape) => {
                            const commonProps = makeCommonProps(shape);

                            switch (shape.type) {
                                case 'rectangle':
                                    return (
                                        <Rect
                                            key={shape.id}
                                            id={shape.id}
                                            name='shape'
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
                                            name='shape'
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

                    <Transformer
                        ref={transformerRef}
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
                        visible={!isPanning}
                        {...transformerConfig}
                    />

                    <Rect
                        ref={selectionRectRef}
                        fill="rgba(0,0,255,0.2)"
                        stroke="blue"
                        strokeWidth={1}
                        dash={[4, 2]}
                        visible={false}
                    />
                </Layer>
            </Stage>
        </div>
    );
}