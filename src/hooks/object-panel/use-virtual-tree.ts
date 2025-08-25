import { useMemo } from 'react';
import { CustomShapeConfig } from '@/types/custom-konva-config';

interface TreeNode {
    id: string;
    shape: CustomShapeConfig;
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
    children: TreeNode[];
}

export function useVirtualTree(
    shapes: CustomShapeConfig[],
    expandedIds: Set<string>,
    filteredShapeIds?: Set<string>
) {
    const tree = useMemo(() => {
        const childrenMap = new Map<string | null, CustomShapeConfig[]>();

        // 필터링된 shapes만 처리
        const validShapes = filteredShapeIds
            ? shapes.filter(s => filteredShapeIds.has(s.id!))
            : shapes;

        validShapes.forEach(shape => {
            const parentId = shape.parentId || null;
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId)!.push(shape);
        });

        const buildTree = (parentId: string | null, depth: number): TreeNode[] => {
            const children = childrenMap.get(parentId) || [];
            return children.map(shape => {
                const nodeChildren = buildTree(shape.id!, depth + 1);
                return {
                    id: shape.id!,
                    shape,
                    depth,
                    hasChildren: nodeChildren.length > 0,
                    isExpanded: expandedIds.has(shape.id!),
                    children: nodeChildren,
                };
            });
        };

        return buildTree(null, 0);
    }, [shapes, expandedIds, filteredShapeIds]);

    const flattenedTree = useMemo(() => {
        const flatten = (nodes: TreeNode[]): TreeNode[] => {
            const result: TreeNode[] = [];
            for (const node of nodes) {
                result.push(node);
                if (node.isExpanded && node.children.length > 0) {
                    result.push(...flatten(node.children));
                }
            }
            return result;
        };
        return flatten(tree);
    }, [tree]);

    return {
        tree,
        flattenedTree,
        totalCount: flattenedTree.length,
    };
}