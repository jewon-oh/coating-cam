"use client";

import React, {useRef, useCallback, useEffect, useState} from 'react';
import {Stage, Layer, Rect, Transformer, Circle, Image, Group} from 'react-konva';
import type Konva from 'konva';

import {
    unselectAllShapes,
    updateShape,
} from '@/store/slices/shapes-slice';
import {redoWithSync, undoWithSync} from "@/store/thunks/history-thunk";

// 컨텍스트 및 훅 임포트
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {useCanvasInteractions} from '@/hooks/use-canvas-interactions';
import {useTransformerHandlers} from '@/hooks/use-transformer-handlers';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';

// 컴포넌트 임포트
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


export default function CanvasStage() {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const tool = useAppSelector((state) => state.tool.tool);

    // === Stage 드래그 기반 패닝 ===
    const [isPanning, setIsPanning] = useState(false);

    // 호버링
    const [isHoveringShape, setIsHoveringShape] = useState<string | null>(null);

    // 캐시 관련 상태
    const [isCacheEnabled, setIsCacheEnabled] = useState(false);

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
        stage: stageState,
        setStage,
        setIsLoading,
        setLoadingMessage
    } = useCanvas();

    const stage = stageRef.current!;

    // Context menu target state
    const [isContextOnShape, setIsContextOnShape] = useState(false);

    // Apply stage transform (scale and position) from CanvasContext state to Konva Stage
    useEffect(() => {
        const s = stageRef.current;
        if (!s) return;
        try {
            s.scale({ x: stageState.scale, y: stageState.scale });
            s.position({ x: stageState.x, y: stageState.y });
            s.batchDraw();
        } catch (err) {
            console.error('Failed to apply stage transform:', err);
        }
    }, [stageRef, stageState.scale, stageState.x, stageState.y]);

    const layerRef = useRef<Konva.Layer>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const selectionRectRef = useRef<Konva.Rect>(null);

    // 변형 관련 훅으로 캡슐화 (transformerRef 준비 후 호출)
    const { isTransforming, imageCache, handleTransformStart, handleTransform, handleTransformEnd } = useTransformerHandlers(transformerRef);

    // 캐시용 그룹 ref들 - 이미지와 다른 도형을 분리
    const imageGroupRef = useRef<Konva.Group>(null);
    const shapeGroupRef = useRef<Konva.Group>(null);


    // SettingsContext에서 그리드 및 작업 영역 설정 가져오기
    const {isGridVisible, gridSize, workArea,} = useSettings();


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
    }, [imageCache, setLoadingMessage, setIsLoading, shapes, dispatch]);


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
    } = useCanvasInteractions(stageRef, setStage, selectionRectRef, isPanning, setIsPanning);


    // Wrap context menu to detect target (stage vs shape)
    const onStageContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
        const s = stageRef.current;
        if (!s) return;
        // If the target is the Stage itself, it's a stage contextmenu; otherwise it's on a shape
        setIsContextOnShape(e.target !== s);
        // Delegate to hook to maintain selection behavior
        handleContextMenu(e);
    }, [handleContextMenu, stageRef]);

    
    // 향상된 키보드 이벤트 핸들러
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // 화면맞춤
            if (isCtrlOrCmd && e.key === "0") {
                e.preventDefault();
                // fitToWorkArea();
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
    }, [handleDelete, handleCopy, handlePaste, handleCut, dispatch, handleSelectAll, isCanvasFocused]);


    // 렌더 순서: 이미지 먼저(항상 뒤), 그 다음 다른 도형(항상 위)
    const visibleShapes = Array.isArray(shapes) ? shapes.filter(s => s.visible !== false) : [];
    const imageShapes = visibleShapes.filter(s => s.type === 'image');
    const otherShapes = visibleShapes.filter(s => s.type !== 'image');

    // 공통 프로퍼티
    const makeCommonProps = (shape: Partial<AnyNodeConfig>) => ({
        draggable: tool === 'select' && !shape.listening ,
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.evt.preventDefault();
            handleSelect(e);
        },
        onMouseEnter: () => setIsHoveringShape(shape.id!),
        onMouseLeave: () => setIsHoveringShape(null),
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        shadowColor: isHoveringShape === shape.id  ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
        shadowBlur: isHoveringShape === shape.id  ? 10 : 0,
        shadowOffset: isHoveringShape === shape.id ? {x: 0, y: 0} : {x: 0, y: 0},
        perfectDrawEnabled: false,
        listening: tool === 'select'
    });


    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
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
                {/* 배경 */}
                <Layer
                    listening={false}
                >
                    {/* 캔버스 배경*/}
                    <Rect
                        x={- (stage?.x() ?? 0) / (stage?.scaleX() || 1)}
                        y={- (stage?.y() ?? 0) / (stage?.scaleY() || 1)}
                        width={(stage?.width() ?? 0) / (stage?.scaleX() || 1)}
                        height={(stage?.height() ?? 0) / (stage?.scaleY() || 1)}
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
                        strokeWidth={1 / Math.hypot(stage?.scaleX(), stage?.scaleY())}
                        dash={[4 / Math.hypot(stage?.scaleX(), stage?.scaleY()), 2 / Math.hypot(stage?.scaleX(), stage?.scaleY())]}
                        listening={false}
                    />
                    {/* 그리드 표시 */}
                    <CanvasGrid
                        stageRef={stageRef}
                        gridSize={gridSize}
                        workArea={workArea}
                        visible={isGridVisible}
                        isPanning={isPanning}
                        stageScale={stageState.scale}
                        stageX={stageState.x}
                        stageY={stageState.y}
                        viewportWidth={stage?.width()}
                        viewportHeight={stage?.height()}
                    />
                </Layer>

                <Layer ref={layerRef}>
                    {/* 이미지 그룹 (캐시 가능) */}
                    <Group
                        ref={imageGroupRef}
                        listening={tool === 'select'} // 선택 도구일 때만 이벤트 수신
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
                        listening={true} // 항상 이벤트 수신
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
                        visible={selectedShapeIds.length > 0}
                        {...transformerConfig}
                    />

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
            <ContextMenuContent className="w-56">
                <ContextMenuLabel>Canvas</ContextMenuLabel>
                <ContextMenuItem onSelect={(e) => { e.preventDefault(); handleSelectAll(); }}>
                    Select All
                    <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={selectedShapeIds.length < 2} onSelect={(e) => { e.preventDefault(); handleGroup(); }}>
                    Group
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={!isContextOnShape} onSelect={(e) => { e.preventDefault(); handleCopy(); }}>
                    Copy
                    <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={(e) => { e.preventDefault(); handlePaste(); }}>
                    Paste
                    <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!isContextOnShape} onSelect={(e) => { e.preventDefault(); handleCut(); }}>
                    Cut
                    <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!isContextOnShape} variant="destructive" onSelect={(e) => { e.preventDefault(); handleDelete(); }}>
                    Delete
                    <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}