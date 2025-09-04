import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {CustomShapeConfig, SerializableShapePayload} from '@/types/custom-konva-config';

interface ShapesState {
    shapes: CustomShapeConfig[];      // 모든 도형들
    selectedShapeIds: string[];       // 선택된 도형 ID들
    isGroupSelected: boolean;         // 그룹 선택 여부
    isDragging: boolean;              // 드래그 상태 여부
    draggingShapeIds: string[];       // 드래그 중인 도형 ID들
    lastUpdateTimestamp: number;      // 성능 최적화용 캐시
}

const initialState: ShapesState = {
    shapes: [],
    selectedShapeIds: [],
    isGroupSelected: false,
    isDragging: false,
    draggingShapeIds: [],
    lastUpdateTimestamp: Date.now(),
};

// Selectors for better performance
export const selectShapes = (state: { shapes: ShapesState }) => state.shapes.shapes;
export const selectSelectedShapeIds = (state: { shapes: ShapesState }) => state.shapes.selectedShapeIds;
export const selectIsDragging = (state: { shapes: ShapesState }) => state.shapes.isDragging;
export const selectDraggingShapeIds = (state: { shapes: ShapesState }) => state.shapes.draggingShapeIds;


// 그룹 관련 최적화된 셀렉터 추가
export const selectGroupsWithMembers = createSelector(
    [selectShapes],
    (shapes) => {
        const groups = shapes.filter(s => s.type === 'group');
        const membersByGroup = new Map<string, CustomShapeConfig[]>();

        groups.forEach(group => {
            const members = shapes.filter(s => s.parentId === group.id && s.type !== 'group');
            membersByGroup.set(group.id!, members);
        });

        return { groups, membersByGroup };
    }
);

export const selectShapeHierarchy = createSelector(
    [selectShapes],
    (shapes) => {
        const childrenMap = new Map<string | null, CustomShapeConfig[]>();
        const parentMap = new Map<string, string | null>();

        shapes.forEach(shape => {
            const parentId = shape.parentId || null;
            parentMap.set(shape.id!, parentId);

            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId)!.push(shape);
        });

        return { childrenMap, parentMap };
    }
);
// Helper 함수: 고유 이름 생성
const generateUniqueName = (shapes: SerializableShapePayload[], baseName: string): string => {
    let count = 1;
    let newName = baseName;
    const existingNames = shapes.map(shape => shape.name);
    while (existingNames.includes(newName)) {
        newName = `${baseName} #${count}`;
        count++;
    }
    return newName;
};



const shapeSlice = createSlice({
    name: 'shape',
    initialState,
    reducers: {
        setDragging: (state, action: PayloadAction<boolean>) => {
            state.isDragging = action.payload;
        },
        setDraggingShapeIds: (state, action: PayloadAction<string[]>) => {
            state.draggingShapeIds = action.payload;
        },
        clearShapes: (state) => {
            Object.assign(state, initialState);
            state.lastUpdateTimestamp = Date.now();
        },
        addShape: (state, action: PayloadAction<SerializableShapePayload>) => {
            const baseName = action.payload.name || action.payload.type || 'Shape';
            const uniqueName = generateUniqueName(state.shapes, baseName);

            // ✨ FIX: 자동으로 다음 코팅 순서를 할당합니다.
            const maxCoatingOrder = state.shapes.reduce((max, shape) => {
                return Math.max(max, shape.coatingOrder || 0);
            }, 0);

            const newShape: SerializableShapePayload  = {
                ...action.payload,
                type: action.payload.type,
                id: action.payload.id,
                parentId: action.payload.parentId,
                name: uniqueName,
                listening: action.payload.listening ?? false,
                isLocked: action.payload.isLocked ?? false,
                x: action.payload.x ?? 0,
                y: action.payload.y ?? 0,
                coatingType: action.payload.coatingType ?? 'fill', // 기본값 'fill'로 설정
                coatingOrder: maxCoatingOrder + 1, // 새 코팅 순서 할당
            };

            state.shapes.push(newShape);
        },
        addShapeToBack: (state, action: PayloadAction<SerializableShapePayload>) => {
            const baseName = action.payload.name || action.payload.type || 'Shape';
            const uniqueName = generateUniqueName(state.shapes, baseName);

            // ✨ FIX: 자동으로 다음 코팅 순서를 할당합니다.
            const maxCoatingOrder = state.shapes.reduce((max, shape) => {
                return Math.max(max, shape.coatingOrder || 0);
            }, 0);

            const newShape: SerializableShapePayload = {
                ...action.payload,
                type: action.payload.type,
                id: action.payload.id,
                parentId: action.payload.parentId,
                name: uniqueName,
                listening: action.payload.listening ?? false,
                isLocked: action.payload.isLocked ?? false,
                x: action.payload.x ?? 0,
                y: action.payload.y ?? 0,
                coatingType: action.payload.coatingType ?? 'fill',
                coatingOrder: maxCoatingOrder + 1,
            };

            state.shapes.unshift(newShape);
        },
        updateShape: (state, action: PayloadAction<{ id: string; updatedProps: Partial<CustomShapeConfig> }>) => {
            const index = state.shapes.findIndex(s => s.id === action.payload.id);
            if (index !== -1) {
                Object.assign(state.shapes[index], {...state.shapes[index], ...action.payload.updatedProps});
            }
        },
        batchUpdateShapes: (state, action: PayloadAction<Array<{ id: string; props: Partial<CustomShapeConfig> }>>) => {
            const updateMap = new Map(action.payload.map(update => [update.id, update.props]));

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    const update = updateMap.get(shape.id!);
                    return update ? {...shape, ...update} : shape;
                }),
                lastUpdateTimestamp: Date.now()
            });
        },
        updateMultipleShapes: (state, action: PayloadAction<{ id: string; props: Partial<CustomShapeConfig> }[]>) => {
            const updateMap = new Map(action.payload.map(update => [update.id, update.props]));

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    const update = updateMap.get(shape.id!);
                    return update ? {...shape, ...update} : shape;
                })
            });

        },
        removeShapes: (state, action: PayloadAction<string[]>) => {
            state.shapes = state.shapes.filter(s => !action.payload.includes(s.id || ''));
            state.selectedShapeIds = [];
            state.isGroupSelected = false;
        },
        setAllShapes: (state, action: PayloadAction<CustomShapeConfig[]>) => {
            Object.assign(state, {
                shapes: action.payload.map((s, i) => ({
                    ...s,
                    name: s.name || `${s.type || 'Shape'} #${i + 1}`,
                    visible: s.visible ?? true,
                    listening: s.listening ?? false,
                    isLocked: s.isLocked ?? false,
                })),
                selectedShapeIds: [],
                isGroupSelected: false
            });
        },
        selectShape: (state, action: PayloadAction<string>) => {
            state.selectedShapeIds = [action.payload];
            state.isGroupSelected = false;
        },
        selectMultipleShapes: (state, action: PayloadAction<string[]>) => {
            state.selectedShapeIds = action.payload;
            state.isGroupSelected = true;
        },
        selectAllShapes: (state) => {
            const selectableIds = state.shapes
                .filter(shape =>
                    shape.visible !== false &&
                    !shape.isLocked &&
                    shape.id
                )
                .map(shape => shape.id!)
                .filter(Boolean);

            if (selectableIds.length > 0) {
                state.selectedShapeIds = selectableIds;
            }
        },

        unselectShape: (state, action: PayloadAction<string>) => {
            state.selectedShapeIds = state.selectedShapeIds.filter(id => id !== action.payload);
        },
        unselectAllShapes: (state) => {
            state.selectedShapeIds = [];
            state.isGroupSelected = false;
        },
        toggleShapeVisibility: (state, action: PayloadAction<string>) => {
            const shape = state.shapes.find(s => s.id === action.payload);
            if (shape) {
                shape.visible = !(shape.visible ?? true);
            }
        },
        toggleShapeLock: (state, action: PayloadAction<string>) => {
            const shape = state.shapes.find(s => s.id === action.payload);
            if (shape) {
                shape.isLocked = !(shape.isLocked ?? false);
            }
        },
        createGroup: (state, action: PayloadAction<{ memberIds: string[]; name?: string; groupId?: string }>) => {
            const memberIds = action.payload.memberIds || [];
            if (!memberIds.length) return;

            const groupId = action.payload.groupId || crypto.randomUUID();
            const sameTypeCount = state.shapes.filter(s => s.type === 'group').length;
            const groupName = action.payload.name || `그룹 #${sameTypeCount + 1}`;

            const updates = memberIds.map(id => ({ id, props: { parentId: groupId } }));
            const updateMap = new Map(updates.map(update => [update.id, update.props]));

            const groupNode: CustomShapeConfig = {
                id: groupId,
                parentId: null,
                type: 'group',
                name: groupName,
                x: 0,
                y: 0,
                listening: false,
                visible: true,
                isLocked: false,
            } as CustomShapeConfig;

            Object.assign(state, {
                shapes: [
                    ...state.shapes.map(shape => {
                        const update = updateMap.get(shape.id!);
                        return update ? { ...shape, ...update } : shape;
                    }),
                    groupNode
                ],
                selectedShapeIds: memberIds,
                isGroupSelected: true,
                lastUpdateTimestamp: Date.now()
            });
        },

        ungroupShapes: (state, action: PayloadAction<string>) => {
            const groupId = action.payload;
            const groupIndex = state.shapes.findIndex(s => s.id === groupId && s.type === 'group');
            if (groupIndex === -1) return;

            Object.assign(state, {
                shapes: state.shapes
                    .filter(s => s.id !== groupId)
                    .map(s => s.parentId === groupId ? { ...s, parentId: null } : s),
                lastUpdateTimestamp: Date.now()
            });
        },

        renameGroup: (state, action: PayloadAction<{ groupId: string; name: string }>) => {
            const groupIndex = state.shapes.findIndex(s => s.id === action.payload.groupId && s.type === 'group');
            if (groupIndex !== -1) {
                state.shapes[groupIndex].name = action.payload.name;
                state.lastUpdateTimestamp = Date.now();
            }
        },
        toggleGroupVisibility: (state, action: PayloadAction<string>) => {
            const groupId = action.payload;
            const group = state.shapes.find(s => s.id === groupId && s.type === 'group');
            if (!group) return;

            const newVisibility = !(group.visible ?? true);
            const memberIds = state.shapes
                .filter(s => s.parentId === groupId)
                .map(s => s.id!)
                .filter(Boolean);

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    if (shape.id === groupId || memberIds.includes(shape.id!)) {
                        return { ...shape, visible: newVisibility };
                    }
                    return shape;
                }),
                lastUpdateTimestamp: Date.now()
            });
        },
        toggleGroupLock: (state, action: PayloadAction<string>) => {
            const groupId = action.payload;
            const group = state.shapes.find(s => s.id === groupId && s.type === 'group');
            if (!group) return;

            const newLockState = !(group.isLocked ?? false);
            const memberIds = state.shapes
                .filter(s => s.parentId === groupId)
                .map(s => s.id!)
                .filter(Boolean);

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    if (shape.id === groupId || memberIds.includes(shape.id!)) {
                        return { ...shape, isLocked: newLockState };
                    }
                    return shape;
                }),
                lastUpdateTimestamp: Date.now()
            });
        },

    },
});

export const {
    addShape,
    addShapeToBack,
    updateShape,
    batchUpdateShapes,
    updateMultipleShapes,
    removeShapes,
    setAllShapes,
    selectShape,
    selectMultipleShapes,
    selectAllShapes,
    unselectShape,
    unselectAllShapes,
    toggleShapeVisibility,
    toggleShapeLock,
    createGroup,
    ungroupShapes,
    renameGroup,
    toggleGroupVisibility,
    toggleGroupLock,
    clearShapes,
    setDragging,
    setDraggingShapeIds,
} = shapeSlice.actions;

export default shapeSlice.reducer;
