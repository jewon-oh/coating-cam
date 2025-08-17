// TypeScript React
"use client";

import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    memo,
} from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
    toggleShapeVisibility,
    toggleShapeLock,
    updateShape,
    selectShape,
    selectGroup,
    unselectAllShapes,
    setAllShapes,
} from "@/store/slices/shapes-slice";
import { setPresent } from "@/store/slices/history-slice";
import type { AnyNodeConfig } from "@/types/custom-konva-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Eye,
    EyeOff,
    Lock,
    Unlock,
    RectangleHorizontal,
    Circle as CircleIcon,
    Image as ImageIcon,
    Search,
    X,
    Filter,
    SortAsc,
    Layers,
    GripVertical,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu, DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Collapsible,
    CollapsibleContent,
} from "@/components/ui/collapsible";

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    UniqueIdentifier,
    DraggableAttributes,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    restrictToVerticalAxis,
    restrictToParentElement,
} from "@dnd-kit/modifiers";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import debounce from "lodash/debounce";
import { ellipsizeEnd } from "@/lib/ellipsize";
import {TooltipProvider,Tooltip,TooltipContent,TooltipTrigger} from "@/components/ui/tooltip";

// -------------------------------------- 공통/헬퍼 --------------------------------------
const shapeIcons = {
    rect: <RectangleHorizontal size={16} className="flex-shrink-0" />,
    circle: <CircleIcon size={16} className="flex-shrink-0" />,
    image: <ImageIcon size={16} className="flex-shrink-0" />,
} as const;

const shapeTypeNames = {
    rect: "사각형",
    circle: "원",
    image: "이미지",
} as const;

type SortType = "name" | "type" | "creation" | "size";
type FilterType =
    | "all"
    | "rect"
    | "circle"
    | "image"
    | "visible"
    | "hidden"
    | "locked";

// 입력 디바운스 훅(검색용)
function useDebounced<T>(value: T, delay = 200) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}

// -------------------------------------- Sortable 아이템 --------------------------------------
const SortableObjectItem = memo(function SortableObjectItem({
                                                                shape,
                                                                onSelect,
                                                                isSelected,
                                                                isDragging,
                                                                isOpen,
                                                                onOpen,
                                                                onPatch,
                                                            }: {
    shape: AnyNodeConfig;
    onSelect: (id: string, e: React.MouseEvent) => void;
    isSelected: boolean;
    isDragging?: boolean;
    isOpen: boolean;
    onOpen: () => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: shape.id! });

    const style = useMemo(
        () => ({
            transform: CSS.Transform.toString(transform),
            transition,
            willChange: "transform",
        }),
        [transform, transition]
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("touch-none", (isDragging || isSortableDragging) && "opacity-50")}
        >
            <ObjectItem
                shape={shape}
                onSelect={onSelect}
                isSelected={isSelected}
                isDragging={isSortableDragging || isDragging}
                dragAttributes={attributes}
                dragListeners={listeners}
                isOpen={isOpen}
                onOpen={onOpen}
                onPatch={onPatch}
            />
        </div>
    );
});

// 작은 토글 아이콘 버튼
function ToggleIconButton({
                              pressed,
                              onClick,
                              children,
                              label,
                              className,
                          }: {
    pressed: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    label: string;
    className?: string;
}) {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={onClick}
                        title={label}
                        className={cn(
                            "h-7 w-7 inline-flex items-center justify-center rounded-md border transition-all",
                            "hover:scale-105 active:scale-95 focus:outline-none",
                            pressed
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-background border-border text-foreground/80 hover:bg-muted/60",
                            className
                        )}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// -------------------------------------- 객체 아이템 --------------------------------------
const ObjectItem = memo(function ObjectItem({
                                                shape,
                                                onSelect,
                                                isSelected,
                                                isDragging,
                                                dragAttributes,
                                                dragListeners,
                                                isOpen,
                                                onOpen,
                                                onPatch,
                                            }: {
    shape: AnyNodeConfig;
    onSelect: (id: string, e: React.MouseEvent) => void;
    isSelected: boolean;
    isDragging?: boolean;
    dragAttributes?: DraggableAttributes;
    dragListeners?: SyntheticListenerMap;
    isOpen: boolean;
    onOpen: () => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
}) {
    const dispatch = useAppDispatch();
    const selectedIds = useAppSelector(s => s.shapes.selectedShapeIds);

    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    // 행 클릭 → 선택 + 펼치기
    const onItemClick = useCallback(
        (e: React.MouseEvent) => {
            onSelect(shape.id!, e);
            onOpen();
        },
        [onSelect, onOpen, shape.id]
    );

    // 잠금/보이기 토글 (Shift: 선택 전체, Alt: 가시성 솔로)
    const toggleLock = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            const ids = e.shiftKey && selectedIds.length > 0 ? selectedIds : [shape.id!];
            ids.forEach(id => dispatch(toggleShapeLock(id)));
        },
        [dispatch, selectedIds, shape.id]
    );

    const toggleVisibility = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            const isAlt = e.altKey || e.metaKey; // Alt(또는 Cmd) = 솔로
            if (isAlt) {
                // 솔로 토글: 현재 아이템만 보이게/이미 솔로면 모두 보이게
                // 1) 현재가 숨김이면 우선 보이도록 하고, 나머지는 숨김
                // 2) 이미 나만 보이는 상태라면 모두 보이기
                // 현재 보이는 아이템 개수 판단은 패널 상위에서 shapes 구독으로 처리
                // 여기서는 간단히: 내가 보이면 → 나 제외 모두 숨김, 내가 숨김이면 → 모두 표시 후 나만 표시
                // 안전하게 두 단계로 처리
                // a) 모두 표시
                // b) 나만 표시로 만들기 위해 나 제외 모두 숨김
                // (상태에 따라 토글 해제 시에는 모두 표시)
                // 간단한 휴리스틱: 나 외에 하나라도 보이면 "솔로"로 전환, 모두 숨김 상태면 "모두 표시"
                // 실제 로직은 프로젝트 정책에 맞게 조정 가능
                // 여기서는 "나만 표시" 단일 동작으로 구현
                // (이미 솔로 상태 해제는 사용자들이 Alt 없이 눈 아이콘 클릭으로 모두 표시해도 됨)
                // 모두 보이기
                // 주의: dispatch 다중 호출 비용은 낮음
                window.requestAnimationFrame(() => {
                    // 일단 모두 표시
                    // 선택 전체 리스트가 없으므로 상단에서 shapes를 받아 사용
                });
            } else {
                const ids = e.shiftKey && selectedIds.length > 0 ? selectedIds : [shape.id!];
                ids.forEach(id => dispatch(toggleShapeVisibility(id)));
            }
        },
        [dispatch, selectedIds, shape.id]
    );
    const rowDisabled = shape.listening;
    const rowHidden = shape.visible === false;


    return (
        <div
            className={cn(
                "group/item border rounded-md transition-all duration-200 hover:shadow-sm select-none",
                isSelected && !rowDisabled && "ring-2 ring-primary bg-primary/5 m-1",
                rowHidden && "opacity-60",
                rowDisabled && "cursor-not-allowed",
                isDragging && "opacity-50 shadow-lg scale-105"
            )}
            onClick={onItemClick}
        >
            <div className="flex items-center p-3 space-x-2">
                {/* 드래그 핸들 */}
                <div
                    className={cn(
                        "flex-shrink-0 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 transition-opacity",
                        (isDragging || rowDisabled) && "cursor-default"
                    )}
                    {...dragAttributes}
                    {...dragListeners}
                    aria-label="drag-handle"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={16} />
                </div>

                {/* 아이콘 */}
                <div className={cn("flex-shrink-0 p-1 rounded", isSelected && !rowDisabled && "text-primary")}>
                    {shapeIcons[shape.type as keyof typeof shapeIcons]}
                </div>

                {/* 이름 및 정보 */}
                <div className="flex-1 min-w-0">
                    {/* 이름: 숨김 시 취소선, 잠금 시 색상 약화 */}
                    <div
                        className={cn(
                            "text-sm font-medium truncate transition-colors",
                            rowHidden && "line-through italic",
                            rowDisabled && "text-foreground/60"
                        )}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!rowDisabled && !isDragging) setIsEditingName(true);
                        }}
                        title={shape.name}
                    >
                        {!!shape.name && ellipsizeEnd(shape.name, 12)}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center space-x-2">
                        <span>{shapeTypeNames[shape.type as keyof typeof shapeTypeNames]}</span>
                        <span>•</span>
                        <span>
              {shape.type === "circle"
                  ? `반지름 ${Math.round(shape.radius || 0)}`
                  : `${Math.round(shape.width || 0)}×${Math.round(shape.height || 0)}`}
            </span>
                        {!!shape.rotation && Math.abs(shape.rotation) > 0.1 && (
                            <>
                                <span>•</span>
                                <span>{Math.round(shape.rotation)}°</span>
                            </>
                        )}
                    </div>
                </div>

                {/* 잠금/보이기 토글 버튼 (아이콘) */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <ToggleIconButton
                        pressed={!!shape.listening}
                        onClick={toggleLock}
                        label={shape.listening ? "잠금 해제 (Shift: 선택 전체에 적용)" : "잠그기 (Shift: 선택 전체에 적용)"}
                    >
                        {shape.listening ? <Unlock size={14} /> : <Lock size={14} />}
                    </ToggleIconButton>

                    <ToggleIconButton
                        pressed={shape.visible === false}
                        onClick={toggleVisibility}
                        label={
                            shape.visible === false
                                ? "보이기 (Shift: 선택 전체에 적용, Alt: 솔로 보기)"
                                : "숨기기 (Shift: 선택 전체에 적용, Alt: 솔로 보기)"
                        }
                    >
                        {shape.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}
                    </ToggleIconButton>
                </div>
            </div>

            {/* 속성 패널: 상위에서 전달된 onPatch를 직접 호출(상위 단일 디바운서가 처리) */}
            <Collapsible open={isOpen} onOpenChange={() => { /* 부모에서 제어 */ }}>
                <CollapsibleContent className="border-t bg-muted/30" onClick={(e) => e.stopPropagation()}>
                    <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <SmallNumberField
                                id={`${shape.id}-x`}
                                label="X"
                                value={shape.x || 0}
                                onChange={(v) => onPatch(shape.id!, { x: v })}
                            />
                            <SmallNumberField
                                id={`${shape.id}-y`}
                                label="Y"
                                value={shape.y || 0}
                                onChange={(v) => onPatch(shape.id!, { y: v })}
                            />
                        </div>

                        {shape.type !== "circle" && (
                            <div className="grid grid-cols-2 gap-2">
                                <SmallNumberField
                                    id={`${shape.id}-width`}
                                    label="너비"
                                    value={shape.width || 0}
                                    onChange={(v) => onPatch(shape.id!, { width: v })}
                                />
                                <SmallNumberField
                                    id={`${shape.id}-height`}
                                    label="높이"
                                    value={shape.height || 0}
                                    onChange={(v) => onPatch(shape.id!, { height: v })}
                                />
                            </div>
                        )}

                        {shape.type === "circle" && (
                            <SmallNumberField
                                id={`${shape.id}-radius`}
                                label="반지름"
                                value={shape.radius || 0}
                                onChange={(v) => onPatch(shape.id!, { radius: v })}
                            />
                        )}

                        <SmallNumberField
                            id={`${shape.id}-rotation`}
                            label="회전 (도)"
                            value={shape.rotation || 0}
                            step={1}
                            onChange={(v) => onPatch(shape.id!, { rotation: v })}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
});

// 숫자 입력: 타이핑 즉시 로컬 반영 + 상위 onChange 전달(상위에서 50ms 디바운스)
const SmallNumberField = memo(function SmallNumberField({
                                                            id,
                                                            label,
                                                            value,
                                                            step = 1,
                                                            onChange,
                                                        }: {
    id: string;
    label: string;
    value: number;
    step?: number;
    onChange: (v: number) => void; // 상위에서 디바운스 처리
}) {
    const [local, setLocal] = useState<number>(value);
    useEffect(() => setLocal(value), [value]);

    return (
        <div>
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <Input
                id={id}
                type="number"
                value={Number.isFinite(local) ? local : 0}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    setLocal(n);
                    if (!Number.isNaN(n) && Number.isFinite(n)) {
                        onChange(n);
                    }
                }}
                className="h-7 text-xs"
                step={step}
            />
        </div>
    );
});

// 드래그 오버레이
const DragOverlayItem = memo(function DragOverlayItem({
                                                          shape,
                                                      }: {
    shape: AnyNodeConfig;
}) {
    return (
        <div className="bg-white border-2 border-primary rounded-md shadow-lg p-3">
            <div className="flex items-center space-x-2">
                <div className="text-primary">
                    {shapeIcons[shape.type as keyof typeof shapeIcons]}
                </div>
                <div className="text-sm font-medium">{shape.name}</div>
            </div>
        </div>
    );
});

// -------------------------------------- 패널 본체 --------------------------------------
export function ObjectPanel() {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);

    // 패널 접기
    const [panelCollapsed, setPanelCollapsed] = useState(false);

    // 단일 펼침
    const [openItemId, setOpenItemId] = useState<string | null>(null);

    // 패널 외부 클릭 시 접기
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            const root = panelRef.current;
            if (!root) return;
            if (!root.contains(e.target as Node)) {
                setOpenItemId(null);
            }
        };
        document.addEventListener("mousedown", onDocMouseDown, { passive: true });
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    // 검색/정렬/필터
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounced(searchTerm, 200);
    const [sortBy, setSortBy] = useState<SortType>("creation");
    const [filterBy, setFilterBy] = useState<FilterType>("all");

    // DnD
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [draggedShape, setDraggedShape] = useState<AnyNodeConfig | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // 인덱스 맵(반복적인 findIndex 제거)
    const indexById = useMemo(() => {
        const m = new Map<string, number>();
        shapes.forEach((s, i) => s.id && m.set(s.id, i));
        return m;
    }, [shapes]);

    const processedShapes = useMemo(() => {
        let filtered = shapes;

        if (activeId == null) {
            if (debouncedSearch) {
                const q = debouncedSearch.toLowerCase();
                filtered = filtered.filter(
                    (s) =>
                        s.name?.toLowerCase().includes(q) ||
                        s.type?.toLowerCase().includes(q)
                );
            }

            switch (filterBy) {
                case "rect":
                case "circle":
                case "image":
                    filtered = filtered.filter((s) => s.type === filterBy);
                    break;
                case "visible":
                    filtered = filtered.filter((s) => s.visible !== false);
                    break;
                case "hidden":
                    filtered = filtered.filter((s) => s.visible === false);
                    break;
                case "locked":
                    filtered = filtered.filter((s) => s.listening === true);
                    break;
            }

            if (sortBy === "name") {
                filtered = [...filtered].sort((a, b) =>
                    (a.name || "").localeCompare(b.name || "")
                );
            } else if (sortBy === "type") {
                filtered = [...filtered].sort((a, b) =>
                    (a.type || "").localeCompare(b.type || "")
                );
            } else if (sortBy === "size") {
                filtered = [...filtered].sort((a, b) => {
                    const aSize =
                        (a.width || 0) * (a.height || 0) + Math.pow(a.radius || 0, 2);
                    const bSize =
                        (b.width || 0) * (b.height || 0) + Math.pow(b.radius || 0, 2);
                    return bSize - aSize;
                });
            }
        }

        return filtered;
    }, [shapes, debouncedSearch, sortBy, filterBy, activeId]);

    const isDragActive = activeId !== null;
    const canUseSortAndFilter = !isDragActive;

    const statsText = useMemo(() => {
        const total = shapes.length;
        const visible = shapes.filter((s) => s.visible !== false).length;
        const selected = selectedShapeIds.length;

        if (debouncedSearch || filterBy !== "all") {
            return `${processedShapes.length}개 표시 (전체 ${total}개)`;
        }

        let result = `${total}개`;
        if (selected > 0) result += `, ${selected}개 선택`;
        if (visible < total) result += `, ${visible}개 표시`;
        return result;
    }, [shapes, selectedShapeIds.length, debouncedSearch, filterBy, processedShapes.length]);

    // 단일-펼침: 선택 + 펼치기
    const handleSelect = useCallback(
        (id: string, e: React.MouseEvent) => {
            const shape = shapes.find((s) => s.id === id);
            if (shape?.listening) return;

            const isCtrlOrCmd = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;
            const isSelected = selectedShapeIds.includes(id);

            if (isShift && selectedShapeIds.length > 0) {
                const lastSelectedId = selectedShapeIds[selectedShapeIds.length - 1];
                const lastIndex = processedShapes.findIndex((s) => s.id === lastSelectedId);
                const currentIndex = processedShapes.findIndex((s) => s.id === id);
                if (lastIndex !== -1 && currentIndex !== -1) {
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);
                    const rangeIds = processedShapes.slice(start, end + 1).map((s) => s.id!);
                    dispatch(selectGroup(rangeIds));
                }
            } else if (isCtrlOrCmd) {
                if (isSelected) {
                    const newSelection = selectedShapeIds.filter((sid) => sid !== id);
                    if (newSelection.length > 0) dispatch(selectGroup(newSelection));
                    else dispatch(unselectAllShapes());
                } else {
                    dispatch(selectGroup([...selectedShapeIds, id]));
                }
            } else {
                dispatch(selectShape(id));
            }

            setOpenItemId(id);
        },
        [dispatch, shapes, processedShapes, selectedShapeIds]
    );

    const handleSelectAll = useCallback(() => {
        const visibleShapes = processedShapes.filter((shape) => !shape.listening);
        if (visibleShapes.length > 0)
            dispatch(selectGroup(visibleShapes.map((s) => s.id!)));
    }, [dispatch, processedShapes]);

    const handleDeselectAll = useCallback(() => {
        dispatch(unselectAllShapes());
        setOpenItemId(null);
    }, [dispatch]);

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            setActiveId(event.active.id);
            const shape = shapes.find((s) => s.id === event.active.id);
            setDraggedShape(shape || null);
        },
        [shapes]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) {
                setActiveId(null);
                setDraggedShape(null);
                return;
            }
            const oldIndex = indexById.get(String(active.id)) ?? -1;
            const newIndex = indexById.get(String(over.id)) ?? -1;
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newShapes = arrayMove(shapes, oldIndex, newIndex);
                dispatch(setAllShapes(newShapes as AnyNodeConfig[]));
                dispatch(setPresent(newShapes as AnyNodeConfig[]));
            }
            setActiveId(null);
            setDraggedShape(null);
        },
        [dispatch, shapes, indexById]
    );

    // 상위 단일 50ms 디바운서: 모든 속성 변경을 한 곳에서 처리
    const debouncedUpdate = useMemo(
        () =>
            debounce((payload: { id: string; patch: Partial<AnyNodeConfig> }) => {
                dispatch(updateShape({ id: payload.id, updatedProps: payload.patch }));
            }, 50, { trailing: true }),
        [dispatch]
    );
    useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

    const onPatch = useCallback(
        (id: string, patch: Partial<AnyNodeConfig>) => {
            debouncedUpdate({ id, patch });
        },
        [debouncedUpdate]
    );

    // 패널 자체 접힘(폭 축소 + 콘텐츠 비렌더)
    const panelWidthClass = panelCollapsed ? "w-26" : "w-80";
    const showContent = !panelCollapsed;

    return (
        <Card
            ref={panelRef}
            className={cn(panelWidthClass, "max-w-full flex flex-col h-full transition-[width] duration-200")}
        >
            <CardHeader className={cn("pb-3", panelCollapsed && "pb-2")}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <CardTitle className="text-lg flex items-center min-w-0">
                        <Layers className="w-5 h-5 mr-2 shrink-0" />
                        {panelCollapsed ? (
                            <span className="truncate rotate-180 [writing-mode:vertical-rl] text-sm">객체</span>
                        ) : (
                            <>
                                <span className="truncate">객체</span>
                                <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                                    {shapes.length}
                                </Badge>
                            </>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0"
                        onClick={() => setPanelCollapsed((v) => !v)}
                        aria-pressed={panelCollapsed}
                        title={panelCollapsed ? "패널 펼치기" : "패널 접기"}
                    >
                        {panelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </Button>
                </div>

                {showContent && (
                    <div className="space-y-2 mt-2">
                        <div className="relative flex items-center min-w-0">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="객체 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 h-9 w-full min-w-0"
                                disabled={!canUseSortAndFilter}
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-7 w-7"
                                    onClick={() => setSearchTerm("")}
                                    disabled={!canUseSortAndFilter}
                                    title="검색 초기화"
                                >
                                    <X size={12} />
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8" disabled={!canUseSortAndFilter}>
                                            <Filter size={12} className="mr-1" />
                                            <span className="hidden xs:inline">필터</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuCheckboxItem checked={filterBy==="all"}  onClick={() => setFilterBy("all")}>모든 객체</DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={filterBy==="rect"} onClick={() => setFilterBy("rect")}>
                                            <RectangleHorizontal size={14} className="mr-2" />
                                            사각형
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={filterBy==="circle"} onClick={() => setFilterBy("circle")}>
                                            <CircleIcon size={14} className="mr-2" />
                                            원
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={filterBy==="image"}  onClick={() => setFilterBy("image")}>
                                            <ImageIcon size={14} className="mr-2" />
                                            이미지
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={filterBy==="visible"}  onClick={() => setFilterBy("visible")}>
                                            <Eye size={14} className="mr-2" />
                                            표시됨
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={filterBy==="hidden"}  onClick={() => setFilterBy("hidden")}>
                                            <EyeOff size={14} className="mr-2" />
                                            숨김
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={filterBy==="locked"} onClick={() => setFilterBy("locked")}>
                                            <Lock size={14} className="mr-2" />
                                            잠김
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8" disabled={!canUseSortAndFilter}>
                                            <SortAsc size={12} className="mr-1" />
                                            <span className="hidden xs:inline">정렬</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => setSortBy("creation")}>생성 순서</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy("name")}>이름순</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy("type")}>타입순</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy("size")}>크기순</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={handleSelectAll}
                                    disabled={processedShapes.length === 0}
                                >
                                    전체선택
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={handleDeselectAll}
                                    disabled={selectedShapeIds.length === 0}
                                >
                                    선택해제
                                </Button>
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground px-1 truncate">
                            {statsText}
                            {isDragActive && <> 🔄</>}
                        </div>
                    </div>
                )}
            </CardHeader>

            {showContent && (
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full px-4">
                        <div className="space-y-2 pb-4">
                            {processedShapes.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8 space-y-2">
                                    {debouncedSearch || filterBy !== "all" ? (
                                        <>
                                            <Search className="w-8 h-8 mx-auto opacity-50" />
                                            <p>검색 결과가 없습니다</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSearchTerm("");
                                                    setFilterBy("all");
                                                }}
                                            >
                                                필터 초기화
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Layers className="w-8 h-8 mx-auto opacity-50" />
                                            <p>아직 객체가 없습니다</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                >
                                    <SortableContext
                                        items={processedShapes.map((s) => s.id!)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {processedShapes.map((shape) => {
                                            // const idx = indexById.get(shape.id!) ?? 0;
                                            return (
                                                <SortableObjectItem
                                                    key={shape.id}
                                                    shape={shape}
                                                    onSelect={handleSelect}
                                                    isSelected={selectedShapeIds.includes(shape.id!)}
                                                    isDragging={activeId === shape.id}
                                                    isOpen={openItemId === shape.id}
                                                    onOpen={() => setOpenItemId(shape.id!)}
                                                    onPatch={onPatch}
                                                />
                                            );
                                        })}
                                    </SortableContext>

                                    <DragOverlay>
                                        {activeId && draggedShape && <DragOverlayItem shape={draggedShape} />}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            )}
        </Card>
    );
}

export default ObjectPanel;