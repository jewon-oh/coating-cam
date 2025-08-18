// TypeScript React
"use client";

import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
    updateShape,
    selectShape,
    selectGroup,
    unselectAllShapes,
    setAllShapes,
    ungroupShapes,
    removeShapes,
    toggleGroupVisibility,
    toggleGroupLock,
} from "@/store/slices/shapes-slice";
import { setPresent } from "@/store/slices/history-slice";
import type { AnyNodeConfig } from "@/types/custom-konva-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    X,
    Filter,
    SortAsc,
    Layers,
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
import debounce from "lodash/debounce";
import {GroupItem} from "@/components/object-panel/group-item";
import {ObjectItem} from "@/components/object-panel/object-item";
// -------------------------------------- 헬퍼 및 유틸리티 --------------------------------------


type SortType = "name" | "type" | "creation" | "size";
type FilterType =
    | "all"
    | "rect"
    | "circle"
    | "image"
    | "visible"
    | "hidden"
    | "locked";

function useDebounced<T>(value: T, delay = 200) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}


// -------------------------------------- 패널 본체 컴포넌트 --------------------------------------

export function ObjectPanel() {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);

    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [openItemId, setOpenItemId] = useState<string | null>(null);
    const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        // 새로 생성된 그룹들만 자동으로 열기
        const existingGroupIds = new Set([...openGroupIds]);
        const currentGroupIds = new Set(shapes.filter(s => s.type === 'group' && s.id).map(s => s.id!));

        // 새로 생성된 그룹 ID 찾기
        const newGroupIds = [...currentGroupIds].filter(id => !existingGroupIds.has(id) && !openGroupIds.has(id));

        if (newGroupIds.length > 0) {
            setOpenGroupIds(prev => new Set([...prev, ...newGroupIds]));
        }

        // 삭제된 그룹 ID 제거
        const validGroupIds = [...openGroupIds].filter(id => currentGroupIds.has(id));
        if (validGroupIds.length !== openGroupIds.size) {
            setOpenGroupIds(new Set(validGroupIds));
        }
    }, [shapes]); // openGroupIds 의존성 제거


    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (!panelRef.current?.contains(e.target as Node)) {
                setOpenItemId(null);
            }
        };
        document.addEventListener("mousedown", onDocMouseDown, { passive: true });
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounced(searchTerm, 200);
    const [sortBy, setSortBy] = useState<SortType>("creation");
    const [filterBy, setFilterBy] = useState<FilterType>("all");
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);

    const listRef = useRef<HTMLDivElement | null>(null);

    const processedShapes = useMemo(() => {
        let filtered = shapes;
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            filtered = filtered.filter(s => s.name?.toLowerCase().includes(q) || s.type?.toLowerCase().includes(q));
        }
        if (showSelectedOnly) {
            const selectedSet = new Set(selectedShapeIds);
            filtered = filtered.filter(s => selectedSet.has(s.id!));
        }
        switch (filterBy) {
            case "rect": case "circle": case "image":
                filtered = filtered.filter((s) => s.type === filterBy); break;
            case "visible": filtered = filtered.filter((s) => s.visible !== false); break;
            case "hidden": filtered = filtered.filter((s) => s.visible === false); break;
            case "locked": filtered = filtered.filter((s) => s.listening === true); break;
        }
        if (sortBy === "name") {
            filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } else if (sortBy === "type") {
            filtered = [...filtered].sort((a, b) => (a.type || "").localeCompare(b.type || ""));
        } else if (sortBy === "size") {
            filtered = [...filtered].sort((a, b) => {
                const aSize = (a.width || 0) * (a.height || 0) + Math.pow(a.radius || 0, 2);
                const bSize = (b.width || 0) * (b.height || 0) + Math.pow(b.radius || 0, 2);
                return bSize - aSize;
            });
        }
        return filtered;
    }, [shapes, debouncedSearch, sortBy, filterBy, showSelectedOnly, selectedShapeIds]);

    const statsText = useMemo(() => {
        const total = shapes.length;
        if (debouncedSearch || filterBy !== "all" || showSelectedOnly) {
            return `${processedShapes.length}개 표시 (전체 ${total}개)`;
        }
        const selected = selectedShapeIds.length;
        return `${total}개 객체${selected > 0 ? `, ${selected}개 선택` : ''}`;
    }, [shapes.length, selectedShapeIds.length, debouncedSearch, filterBy, showSelectedOnly, processedShapes.length]);

    const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return;

        if (shape.type === 'group') {
            const childrenByParentAll = new Map<string | null, AnyNodeConfig[]>();
            shapes.forEach(s => {
                const p = s.parentId || null;
                const arr = childrenByParentAll.get(p) || [];
                arr.push(s);
                childrenByParentAll.set(p, arr);
            });
            const collectDescendantShapeIds = (parentId: string): string[] => {
                const out: string[] = [];
                const stack: string[] = [parentId];
                while (stack.length) {
                    const pid = stack.pop()!;
                    const kids = childrenByParentAll.get(pid) || [];
                    for (const child of kids) {
                        if (child.id) {
                            if (child.type === 'group') stack.push(child.id);
                            else if (child.visible !== false && !child.listening) out.push(child.id);
                        }
                    }
                }
                return out;
            };
            const memberIds = collectDescendantShapeIds(id);
            if (e.metaKey || e.ctrlKey) {
                dispatch(selectGroup(Array.from(new Set([...selectedShapeIds, ...memberIds]))));
            } else {
                dispatch(selectGroup(memberIds));
            }
            return;
        }

        if (shape.listening) return;

        if (e.shiftKey && selectedShapeIds.length > 0) {
            const lastSelectedId = selectedShapeIds[selectedShapeIds.length - 1];
            const lastIndex = processedShapes.findIndex((s) => s.id === lastSelectedId);
            const currentIndex = processedShapes.findIndex((s) => s.id === id);
            if (lastIndex !== -1 && currentIndex !== -1) {
                const range = processedShapes.slice(Math.min(lastIndex, currentIndex), Math.max(lastIndex, currentIndex) + 1);
                dispatch(selectGroup(range.map((s) => s.id!)));
            }
        } else if (e.metaKey || e.ctrlKey) {
            const newSelection = selectedShapeIds.includes(id)
                ? selectedShapeIds.filter((sid) => sid !== id)
                : [...selectedShapeIds, id];
            if (newSelection.length > 0) dispatch(selectGroup(newSelection));
            else dispatch(unselectAllShapes());
        } else {
            dispatch(selectShape(id));
        }
        setOpenItemId(id);
    }, [dispatch, shapes, processedShapes, selectedShapeIds]);

    const handleGroupAction = useCallback(() => {
        if (selectedShapeIds.length < 2) return;
        const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id!));
        const memberIds = selectedShapes.filter(s => s.type !== 'group').map(s => s.id!);

        const groupId = crypto.randomUUID();
        const groupNode: AnyNodeConfig = {
            id: groupId, parentId: null, type: 'group', name: 'Group',
            listening: true, visible: true, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
        } as AnyNodeConfig;

        const nextShapes = shapes.map(s => memberIds.includes(s.id!) ? { ...s, parentId: groupId } : s);
        const allNext = [...nextShapes, groupNode];
        dispatch(setAllShapes(allNext));
        dispatch(setPresent(allNext));
        dispatch(selectGroup(memberIds));
    }, [dispatch, shapes, selectedShapeIds]);

    const debouncedUpdate = useMemo(() => debounce((payload: { id: string; patch: Partial<AnyNodeConfig> }) => {
        dispatch(updateShape({ id: payload.id, updatedProps: payload.patch }));
    }, 50), [dispatch]);
    useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
    const onPatch = useCallback((id: string, patch: Partial<AnyNodeConfig>) => {
        debouncedUpdate({ id, patch });
    }, [debouncedUpdate]);

    // Group item callbacks
    const onUngroup = useCallback((groupId: string) => {
        dispatch(ungroupShapes(groupId));
        dispatch(setPresent(shapes.filter(s => s.id !== groupId).map(s => s.parentId === groupId ? { ...s, parentId: null } : s)));
    }, [dispatch, shapes]);

    const onDuplicate = useCallback((groupId: string) => {
        const group = shapes.find(s => s.id === groupId && s.type === 'group');
        const members = shapes.filter(s => s.parentId === groupId);
        if (!group || !members.length) return;

        const newGroupId = crypto.randomUUID();
        const memberIdMap = new Map<string, string>();
        
        // Create new IDs for all members
        members.forEach(member => {
            memberIdMap.set(member.id!, crypto.randomUUID());
        });

        // Create duplicated group
        const newGroup: AnyNodeConfig = {
            ...group,
            id: newGroupId,
            name: `${group.name} 복사`,
            x: (group.x || 0) + 20,
            y: (group.y || 0) + 20,
        };

        // Create duplicated members
        const newMembers = members.map(member => ({
            ...member,
            id: memberIdMap.get(member.id!)!,
            parentId: newGroupId,
            x: (member.x || 0) + 20,
            y: (member.y || 0) + 20,
        }));

        const allNewShapes = [newGroup, ...newMembers];
        dispatch(setAllShapes([...shapes, ...allNewShapes]));
        dispatch(setPresent([...shapes, ...allNewShapes]));
    }, [dispatch, shapes]);

    const onDelete = useCallback((groupId: string) => {
        const membersToDelete = shapes.filter(s => s.parentId === groupId).map(s => s.id!);
        const allIdsToDelete = [groupId, ...membersToDelete];
        dispatch(removeShapes(allIdsToDelete));
        dispatch(setPresent(shapes.filter(s => !allIdsToDelete.includes(s.id!))));
    }, [dispatch, shapes]);

    // Group visibility and lock callbacks
    const onToggleGroupVisibility = useCallback((groupId: string) => {
        dispatch(toggleGroupVisibility(groupId));
    }, [dispatch]);

    const onToggleGroupLock = useCallback((groupId: string) => {
        dispatch(toggleGroupLock(groupId));
    }, [dispatch]);

    const processedIdsSet = useMemo(() => new Set(processedShapes.map(s => s.id!)), [processedShapes]);
    const childrenByParent = useMemo(() => {
        const m = new Map<string | null, AnyNodeConfig[]>();
        processedShapes.forEach(s => {
            const p = (s.parentId && processedIdsSet.has(s.parentId)) ? s.parentId : null;
            const arr = m.get(p) || [];
            arr.push(s);
            m.set(p, arr);
        });
        return m;
    }, [processedShapes, processedIdsSet]);
    const rootNodes = useMemo(() => childrenByParent.get(null) || [], [childrenByParent]);

    const renderTreeNodes = useCallback((nodes: AnyNodeConfig[], depth: number): React.ReactNode => {
        return nodes.map(node => {
            if (node.type === 'group') {
                const children = childrenByParent.get(node.id!) || [];
                const isOpen = openGroupIds.has(node.id!);
                return (
                    <div key={node.id} style={{ marginLeft: depth * 16 }}>
                        <GroupItem
                            shape={node}
                            isSelected={selectedShapeIds.includes(node.id!)}
                            isOpen={isOpen}
                            memberCount={children.length}
                            onToggleOpen={() => setOpenGroupIds(prev => {
                                const next = new Set(prev);
                                if (isOpen) next.delete(node.id!); else next.add(node.id!);
                                return next;
                            })}
                            onSelect={handleSelect}
                            onPatch={onPatch}
                            onUngroup={onUngroup}
                            onDuplicate={onDuplicate}
                            onDelete={onDelete}
                            onToggleVisibility={onToggleGroupVisibility}
                            onToggleLock={onToggleGroupLock}
                        />
                        {isOpen && children.length > 0 && (
                            <div className="mt-1">
                                {renderTreeNodes(children, depth + 1)}
                            </div>
                        )}
                    </div>
                );
            }
            return (
                <div key={node.id} style={{ marginLeft: depth * 16 }}>
                    <ObjectItem
                        shape={node} isSelected={selectedShapeIds.includes(node.id!)}
                        isOpen={openItemId === node.id} onOpen={() => setOpenItemId(node.id!)}
                        onSelect={handleSelect} onPatch={onPatch} isDragging={false}
                    />
                </div>
            );
        });
    }, [childrenByParent, handleSelect, onPatch, openItemId, selectedShapeIds, openGroupIds, onUngroup, onDuplicate, onDelete, onToggleGroupVisibility, onToggleGroupLock]);
    const panelWidthClass = panelCollapsed ? "w-16" : "w-80";
    const showContent = !panelCollapsed;

    return (
        <Card ref={panelRef} className={cn(panelWidthClass, "max-w-full flex flex-col h-full transition-[width] duration-200")}>
            <CardHeader className={cn("pb-3", panelCollapsed && "pb-2")}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <CardTitle className="text-lg flex items-center min-w-0">
                        <Layers className="w-5 h-5 mr-2 shrink-0" />
                        {!panelCollapsed && (
                            <>
                                <span className="truncate">객체</span>
                                <Badge variant="secondary" className="ml-2 text-xs shrink-0">{shapes.length}</Badge>
                            </>
                        )}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={() => setPanelCollapsed(v => !v)}>
                        {panelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    </Button>
                </div>
                {showContent && (
                    <div className="space-y-2 mt-2">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
                            {searchTerm && <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setSearchTerm("")}><X size={12} /></Button>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8"><Filter size={12} className="mr-1" />필터</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuCheckboxItem checked={filterBy === "all"} onCheckedChange={() => setFilterBy("all")}>모두</DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={filterBy === "rect"} onCheckedChange={() => setFilterBy("rect")}>사각형</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={filterBy === "circle"} onCheckedChange={() => setFilterBy("circle")}>원</DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={showSelectedOnly} onCheckedChange={setShowSelectedOnly}>선택만 보기</DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8"><SortAsc size={12} className="mr-1" />정렬</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => setSortBy("creation")}>생성 순서</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy("name")}>이름순</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <Button variant="default" size="sm" className="h-8" onClick={handleGroupAction} disabled={selectedShapeIds.length < 2}>그룹</Button>
                        </div>
                        <div className="text-xs text-muted-foreground px-1 truncate">{statsText}</div>
                    </div>
                )}
            </CardHeader>
            {showContent && (
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full px-4">
                        <div ref={listRef} className="space-y-2 pb-4">
                            {processedShapes.length > 0 ? renderTreeNodes(rootNodes, 0) : (
                                <div className="text-center text-muted-foreground py-8">
                                    <Layers className="w-8 h-8 mx-auto opacity-50" />
                                    <p>객체가 없습니다</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            )}
        </Card>
    );
}

export default ObjectPanel;