"use client";

import React, {useRef, useCallback, useEffect, useState, useMemo} from 'react';
import {Stage, Layer, Rect, Transformer, Circle, Image, Group, Text} from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {unselectAllShapes, updateShape} from '@/store/slices/shapes-slice';
import {redoWithSync, undoWithSync} from '@/store/thunks/history-thunk';

// 커스텀 훅들
import {useCanvasInteractions} from '@/hooks/use-canvas-interactions';
import {useTransformerHandlers} from '@/hooks/use-transformer-handlers';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';

// 컴포넌트 및 타입
import {TransformerConfig} from "konva/lib/shapes/Transformer";
import {AnyNodeConfig} from '@/types/custom-konva-config';
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
    const {stageRef, canvasContainerRef, stage, setStage, setLoading} = useCanvas();

    // 설정 가져오기
    const {isGridVisible, gridSize, workArea} = useSettings();

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
            case 'select':
                return isHoveringShape ? 'move' : 'default';
            case 'rectangle':
            case 'circle':
                return 'crosshair';
            default:
                return 'default';
        }
    }, [tool, isPanning, isTransforming, isHoveringShape]);

    // 도형 분류
    const {imageShapes, otherShapes} = useMemo(() => {
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
                    const defaultCrop = {x: 0, y: 0, width: img.width, height: img.height};
                    if (shapeId) {
                        dispatch(updateShape({id: shapeId, updatedProps: {crop: defaultCrop}}));
                    }
                }
                setLoading({isLoading: false});
                layerRef.current?.batchDraw();
            }, 0);
        };

        img.onerror = (error) => {
            console.error(`❌ 이미지 로드 실패 (${shapeId}):`, error);
            imageCache.current.delete(imageDataUrl);
            setTimeout(() => {
                setLoading({isLoading: false});
            }, 0);
        };

        // 로딩 시작은 동기적으로 실행 (렌더링 전)
        if (shapeId) {
            setLoading({isLoading: true, message: `이미지 로딩 중... (${shapeId})`});
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
            setLoading({isLoading: true, message: '이미지 최적화 중...'});

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
                    dispatch(updateShape({id: shape.id!, updatedProps: {isFlipped: true}}));
                }
            }

            setLoading({isLoading: false});
        };

        processImages();

    }, [shapes, dispatch, setLoading, imageCache]); // shapes 배열이 변경될 때마다 실행


    // ===== 도형 공통 속성 생성기 (isLocked 속성 사용) =====
    const makeCommonProps = useCallback((shape: Partial<AnyNodeConfig>) => {
        // 새로운 isLocked 속성 사용 (기본값은 false)
        const isLocked = shape.isLocked;
        const isInteractionBlocked = isPanning || isLocked;

        const baseProps = {
            // 패닝 중이거나 잠긴 상태가 아닐 때만 드래그 가능
            draggable: tool === 'select' && !isPanning && !isLocked,

            // 클릭 이벤트는 항상 정의하되, 내부에서 조건 체크
            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
                e.evt.preventDefault();
                // 패닝 중이거나 잠긴 상태가 아닐 때만 선택 처리
                if (!isPanning && !isLocked) {
                    handleSelect(e);
                }
            },

            // 호버 이벤트도 항상 정의하되, 내부에서 조건 체크
            onMouseEnter: () => {
                // 패닝 중이거나 잠긴 상태가 아닐 때만 호버 효과 적용
                if (!isInteractionBlocked) {
                    setIsHoveringShape(shape.id!);
                }
            },

            onMouseLeave: () => {
                // 패닝 중이거나 잠긴 상태가 아닐 때만 호버 효과 제거
                if (!isInteractionBlocked) {
                    setIsHoveringShape(null);
                }
            },

            // 드래그 이벤트는 조건부로 정의
            ...((!isPanning && !isLocked) && {
                onDragStart: handleDragStart,
                onDragMove: handleDragMove,
                onDragEnd: handleDragEnd,
            }),

            perfectDrawEnabled: false,
            // Konva의 listening은 isLocked와 반대로 설정
            listening: tool === 'select' && !isPanning && !isLocked
        };

        // 패닝 중이거나 잠긴 상태가 아닐 때만 호버 효과 적용
        const hoverEffect = (isHoveringShape === shape.id && !isInteractionBlocked) ? {
            shadowColor: 'rgba(59, 130, 246, 0.6)',
            shadowBlur: 12,
            shadowOpacity: 1
        } : {};

        // 잠긴 객체 시각적 표시 (isLocked === true일 때)
        const lockEffect = isLocked ? {
            opacity: 0.6,
            dashEnabled: true,
            dash: [4, 4],
            strokeWidth: 1 / Math.abs(stage.scaleX),
            stroke: '#6c757d'
        } : {};

        // 코팅 타입별 스타일 적용
        const coatingStyle = getCoatingVisualStyle(shape as AnyNodeConfig);

        return {
            ...baseProps,
            ...coatingStyle,
            ...lockEffect,
            ...hoverEffect
        };
    }, [tool, isHoveringShape, handleSelect, handleDragStart, handleDragMove, handleDragEnd, isPanning, stage.scaleX]);

    // ===== 이미지 스타일 적용 (isLocked 속성 사용) =====
    const makeImageProps = useCallback((shape: AnyNodeConfig) => {
        const isLocked = shape.isLocked;
        const baseProps = makeCommonProps(shape);
        const coatingStyle = getCoatingVisualStyle(shape);

        // 이미지는 fill 대신 opacity와 필터 효과 사용
        const imageSpecificStyle = {
            opacity: isLocked ? 0.4 : (coatingStyle.opacity || 1),
            // 잠긴 이미지 또는 코팅 제외된 이미지는 그레이스케일 효과
            filters: (isLocked || shape.skipCoating) ? ['Grayscale'] : undefined,
            // 잠긴 이미지에는 점선 테두리 효과
            ...(isLocked && {
                shadowColor: '#6c757d',
                shadowBlur: 2,
                shadowOpacity: 0.3
            })
        };

        // fill, stroke 등 이미지에 적용되지 않는 속성 제거
        const { fill, stroke, strokeWidth, dash, shadowColor, shadowBlur, shadowOpacity, dashEnabled, ...validImageProps } = baseProps;

        return {
            ...validImageProps,
            ...imageSpecificStyle,
            // 잠기지 않고 패닝 중이 아닌 이미지만 그림자 효과
            ...(!isLocked && !isPanning && shadowColor && {
                shadowColor,
                shadowBlur,
                shadowOpacity
            })
        };
    }, [makeCommonProps, isPanning]);

    // ===== 코팅 타입별 스타일 유틸리티 (isLocked 고려) =====
    const getCoatingVisualStyle = (shape: AnyNodeConfig) => {
        const isLocked = shape.isLocked;
        // 잠긴 객체는 항상 회색 계열로 표시
        if (isLocked) {
            return {
                fill: shape.fill ? `${shape.fill}40` : '#f8f9fa', // 원래 색상에 투명도 적용
                stroke: '#6c757d',
                strokeWidth: 1,
                dash: [4, 4],
                opacity: 0.6
            };
        }

        // ... 나머지 코팅 타입별 스타일 코드는 동일 ...

        // 코팅이 제외된 경우
        if (shape.skipCoating) {
            return {
                fill: shape.fill || '#f8f9fa',
                stroke: '#6c757d',
                strokeWidth: 1,
                dash: [8, 4],
                opacity: 0.5
            };
        }

        // 개별 코팅 설정이 없는 경우 기본 스타일
        if (shape.type === 'image') return { opacity: 1 }

        // 코팅 타입별 스타일
        switch (shape.coatingType) {
            case 'fill':
                return {
                    fill: '#2196f3',
                    stroke: '#2196f3',
                    strokeWidth: 2,
                    opacity: 0.5,
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
                    opacity: 0.6,
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
    };

    // ===== 코팅 순서 표시 유틸리티 (isLocked 고려) =====
    const renderCoatingOrderBadge = (shape: AnyNodeConfig, stageScale: number) => {
        // 잠긴 객체이거나 코팅 설정이 없으면 배지 표시 안 함
        if (shape.isLocked || !shape.useCustomCoating || shape.skipCoating || !shape.coatingOrder) {
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
    };
    // ===== 이펙트들 =====

    // 캐시 자동 활성화 (도형 수 기반)
    useEffect(() => {
        const shapeCount = shapes.length;
        if (shapeCount >= 250 && !isCacheEnabled && !isTransforming) {
            setIsCacheEnabled(true);
        } else if (shapeCount < 250 && isCacheEnabled) {
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
                dispatch({type: 'tool/setTool', payload: 'select'});
            } else if (e.key.toLowerCase() === 'c') {
                dispatch({type: 'tool/setTool', payload: 'circle'});
            } else if (e.key.toLowerCase() === 'r') {
                dispatch({type: 'tool/setTool', payload: 'rectangle'});
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

                            {/* 이미지 그룹 (스타일 적용) */}
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

                            {/* 도형 그룹 (스타일 적용) */}
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
                                                    {...commonProps}
                                                />
                                            );
                                        default:
                                            return null;
                                    }
                                })}
                            </Group>

                            {/* 코팅 순서 배지 */}
                            <Group listening={false}>
                                {shapes
                                    .filter(shape => shape.visible !== false)
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
                <ContextMenuSeparator/>
                <ContextMenuItem disabled={selectedShapeIds.length < 2} onSelect={handleGroup}>
                    Group
                </ContextMenuItem>
                <ContextMenuSeparator/>
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