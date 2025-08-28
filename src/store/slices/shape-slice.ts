import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {CustomShapeConfig, PathConfig} from '@/types/custom-konva-config';

interface ShapesState {
    shapes: CustomShapeConfig[];      // 모든 도형들
    paths: PathConfig[];
    selectedShapeIds: string[];       // 선택된 도형 ID들
    selectedPathIds: string[];        //  선택된 경로들
    isGroupSelected: boolean;         // 그룹 선택 여부
    lastUpdateTimestamp: number;      // 성능 최적화용 캐시
}

const initialState: ShapesState = {
    shapes: [],
    paths: [],
    selectedShapeIds: [],
    selectedPathIds: [],
    isGroupSelected: false,
    lastUpdateTimestamp: Date.now(),
};

// Selectors for better performance
export const selectShapes = (state: { shapes: ShapesState }) => state.shapes.shapes;
export const selectSelectedShapeIds = (state: { shapes: ShapesState }) => state.shapes.selectedShapeIds;

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
const generateUniqueName = (shapes: CustomShapeConfig[], baseName: string): string => {
    let count = 1;
    let newName = baseName;
    const existingNames = shapes.map(shape => shape.name);
    while (existingNames.includes(newName)) {
        newName = `${baseName} #${count}`;
        count++;
    }
    return newName;
};

// 기존 SerializableShapePayload 유지...
interface SerializableShapePayload extends Omit<CustomShapeConfig, 'image'> {
    imageDataUrl?: string;
}

const shapeSlice = createSlice({
    name: 'shape',
    initialState,
    reducers: {
        // addShape: Object.assign으로 배열 교체 금지 → push 사용
        addShape: (state, action: PayloadAction<SerializableShapePayload>) => {
            // shapes 안에 있는 같은 타입의 shape 개수를 세어 이름에 사용
            const baseName = action.payload.name || action.payload.type || 'Shape';
            const uniqueName = generateUniqueName(state.shapes, baseName);

            const newShape: CustomShapeConfig = {
                ...action.payload,
                type: action.payload.type,
                id: action.payload.id,
                parentId: action.payload.parentId,
                name: uniqueName,
                listening: action.payload.listening ?? false,
                isLocked: action.payload.isLocked ?? false,
                x: action.payload.x ?? 0,
                y: action.payload.y ?? 0,
                coatingType: action.payload.coatingType ?? 'masking'
            };
            Object.assign(state, {
                shapes: [...state.shapes, newShape]
            });

            // state.shapes.push(newShape);
        },

        // addShapeToBack: 배열 맨 앞에 추가 → unshift 사용
        addShapeToBack: (state, action: PayloadAction<SerializableShapePayload>) => {
            const baseName = action.payload.name || action.payload.type || 'Shape';
            const uniqueName = generateUniqueName(state.shapes, baseName);

            const newShape: CustomShapeConfig = {
                ...action.payload,
                type: action.payload.type,
                id: action.payload.id,
                parentId: action.payload.parentId,
                name: uniqueName,
                listening: action.payload.listening ?? false,
                isLocked: action.payload.isLocked ?? false,
                x: action.payload.x ?? 0,
                y: action.payload.y ?? 0,
            };
            Object.assign(state, {
                shapes: [newShape, ...state.shapes]
            });

            // state.shapes.unshift(newShape);
        },

        // Path 관련 액션들
        addPath: (state, action: PayloadAction<PathConfig>) => {
            const newPath = action.payload;
            state.paths.push(newPath);

            // 부모 shape의 pathIds에 추가
            const parentShape = state.shapes.find(s => s.id === newPath.shapeId);
            if (parentShape) {
                parentShape.pathIds = parentShape.pathIds || [];
                if (!parentShape.pathIds.includes(newPath.id)) {
                    parentShape.pathIds.push(newPath.id);
                }
            }
        },

        updatePath: (state, action: PayloadAction<{ id: string; props: Partial<PathConfig> }>) => {
            const index = state.paths.findIndex(p => p.id === action.payload.id);
            if (index !== -1) {
                state.paths[index] = { ...state.paths[index], ...action.payload.props };
            }
        },

        removePath: (state, action: PayloadAction<string>) => {
            const pathId = action.payload;
            const pathIndex = state.paths.findIndex(p => p.id === pathId);

            if (pathIndex !== -1) {
                const path = state.paths[pathIndex];

                // 부모 shape에서 pathId 제거
                const parentShape = state.shapes.find(s => s.id === path.shapeId);
                if (parentShape && parentShape.pathIds) {
                    parentShape.pathIds = parentShape.pathIds.filter(id => id !== pathId);
                }

                // path 제거
                state.paths.splice(pathIndex, 1);

                // 선택에서도 제거
                state.selectedPathIds = state.selectedPathIds.filter(id => id !== pathId);
            }
        },

        // Shape 삭제 시 연관된 path들도 함께 삭제
        removeShapes: (state, action: PayloadAction<string[]>) => {
            const shapeIds = action.payload;

            // 연관된 path들 찾아서 제거
            const pathsToRemove = state.paths.filter(p => shapeIds.includes(p.shapeId));
            const pathIdsToRemove = pathsToRemove.map(p => p.id);

            // path들 제거
            state.paths = state.paths.filter(p => !shapeIds.includes(p.shapeId));

            // shape들 제거
            state.shapes = state.shapes.filter(s => !shapeIds.includes(s.id || ''));

            // 선택 상태 정리
            state.selectedShapeIds = [];
            state.selectedPathIds = state.selectedPathIds.filter(id => !pathIdsToRemove.includes(id));
            state.isGroupSelected = false;
        },

        // 자동 Path 생성 (기존 shape에 대해)
        generateDefaultPaths: (state, action: PayloadAction<string>) => {
            const shapeId = action.payload;
            const shape = state.shapes.find(s => s.id === shapeId);

            if (!shape || shape.coatingType === 'masking') return;

            const baseName = shape.name || shape.type || 'Shape';

            // 기존 path가 있는지 확인
            const existingPaths = state.paths.filter(p => p.shapeId === shapeId);

            if (existingPaths.length === 0) {
                // coatingType에 따른 기본 path 생성
                if (shape.coatingType === 'fill' || !shape.coatingType) {
                    const fillPath: PathConfig = {
                        id: crypto.randomUUID(),
                        shapeId,
                        type: 'fill',
                        name: `${baseName} - 채우기`,
                        order: 0,
                        enabled: true,
                        fillPattern: shape.fillPattern || 'auto',
                        coatingWidth: shape.coatingWidth,
                        lineSpacing: shape.lineSpacing,
                        coatingHeight: shape.coatingHeight,
                        coatingSpeed: shape.coatingSpeed,
                    };
                    state.paths.push(fillPath);

                    // shape에 pathId 추가
                    shape.pathIds = shape.pathIds || [];
                    shape.pathIds.push(fillPath.id);
                }

                if (shape.coatingType === 'outline') {
                    const outlinePath: PathConfig = {
                        id: crypto.randomUUID(),
                        shapeId,
                        type: 'outline',
                        name: `${baseName} - 테두리`,
                        order: 0,
                        enabled: true,
                        outlineType: shape.outlineType || 'outside',
                        outlinePasses: shape.outlinePasses || 1,
                        outlineInterval: shape.outlineInterval,
                        coatingHeight: shape.coatingHeight,
                        coatingSpeed: shape.coatingSpeed,
                    };
                    state.paths.push(outlinePath);

                    // shape에 pathId 추가
                    shape.pathIds = shape.pathIds || [];
                    shape.pathIds.push(outlinePath.id);
                }
            }
        },

        // Path 선택 관련
        selectPath: (state, action: PayloadAction<string>) => {
            state.selectedPathIds = [action.payload];
        },

        selectMultiplePaths: (state, action: PayloadAction<string[]>) => {
            state.selectedPathIds = action.payload;
        },

        unselectAllPaths: (state) => {
            state.selectedPathIds = [];
        },

        // updateShape는 Immer가 있으니 현재 형태 유지 가능
        updateShape: (state, action: PayloadAction<{ id: string; updatedProps: Partial<CustomShapeConfig> }>) => {
            const index = state.shapes.findIndex(s => s.id === action.payload.id);
            if (index !== -1) {
                Object.assign(state.shapes[index], {...state.shapes[index], ...action.payload.updatedProps});
                // state.shapes[index] = { ...state.shapes[index], ...action.payload.updatedProps };
            }
        },


        // 배치 작업을 위한 새 리듀서
        batchUpdateShapes: (state, action: PayloadAction<Array<{ id: string; props: Partial<CustomShapeConfig> }>>) => {
            const updateMap = new Map(action.payload.map(update => [update.id, update.props]));

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    const update = updateMap.get(shape.id!);
                    return update ? {...shape, ...update} : shape;
                }),
                lastUpdateTimestamp: Date.now()
            });

            // state.shapes = state.shapes.map(shape => {
            //     const update = updateMap.get(shape.id!);
            //     return update ? { ...shape, ...update } : shape;
            // });
            // state.lastUpdateTimestamp = Date.now();
        },
        updateMultipleShapes: (state, action: PayloadAction<{ id: string; props: Partial<CustomShapeConfig> }[]>) => {
            // action.payload.forEach(update => {
            //     const index = state.shapes.findIndex(s => s.id === update.id);
            //     if (index !== -1) {
            //         state.shapes[index] = { ...state.shapes[index], ...update.props };
            //     }
            // });
            const updateMap = new Map(action.payload.map(update => [update.id, update.props]));

            Object.assign(state, {
                shapes: state.shapes.map(shape => {
                    const update = updateMap.get(shape.id!);
                    return update ? {...shape, ...update} : shape;
                })
            });

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

            // state.shapes = action.payload.map((s, i) => ({
            //     ...s,
            //     name: s.name || `${s.type || 'Shape'} #${i + 1}`,
            //     visible: s.visible ?? true,
            //     listening: s.listening ?? false,
            // }));
            // state.selectedShapeIds = [];
            // state.isGroupSelected = false;
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
            // 모든 가시적이고 잠기지 않은 도형들의 ID를 수집
            const selectableIds = state.shapes
                .filter(shape =>
                    shape.visible !== false && // 보이는 도형만
                    !shape.isLocked &&         // 잠기지 않은 도형만
                    shape.id                   // ID가 있는 도형만
                )
                .map(shape => shape.id!)
                .filter(Boolean);            // undefined 제거

            // 선택 가능한 도형이 있으면 모두 선택
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
        // 그룹 관련 최적화된 액션들
        createGroup: (state, action: PayloadAction<{ memberIds: string[]; name?: string; groupId?: string }>) => {
            const memberIds = action.payload.memberIds || [];
            if (!memberIds.length) return;

            const groupId = action.payload.groupId || crypto.randomUUID();
            const sameTypeCount = state.shapes.filter(s => s.type === 'group').length;
            const groupName = action.payload.name || `그룹 #${sameTypeCount + 1}`;

            // 배치 업데이트로 성능 향상
            const updates = memberIds.map(id => ({ id, props: { parentId: groupId } }));
            const updateMap = new Map(updates.map(update => [update.id, update.props]));

            // 그룹 노드 생성
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

            // 그룹 멤버들의 parentId를 null로 변경
            Object.assign(state, {
                shapes: state.shapes
                    .filter(s => s.id !== groupId) // 그룹 노드 제거
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

        // 그룹 가시성 일괄 토글
        toggleGroupVisibility: (state, action: PayloadAction<string>) => {
            const groupId = action.payload;
            const group = state.shapes.find(s => s.id === groupId && s.type === 'group');
            if (!group) return;

            const newVisibility = !(group.visible ?? true);
            const memberIds = state.shapes
                .filter(s => s.parentId === groupId)
                .map(s => s.id!)
                .filter(Boolean);

            // 그룹과 모든 멤버의 가시성 일괄 변경
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

        // 그룹 잠금 일괄 토글
        toggleGroupLock: (state, action: PayloadAction<string>) => {
            const groupId = action.payload;
            const group = state.shapes.find(s => s.id === groupId && s.type === 'group');
            if (!group) return;

            const newLockState = !(group.isLocked ?? false);
            const memberIds = state.shapes
                .filter(s => s.parentId === groupId)
                .map(s => s.id!)
                .filter(Boolean);

            // 그룹과 모든 멤버의 잠금 상태 일괄 변경
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

} = shapeSlice.actions;

export default shapeSlice.reducer;