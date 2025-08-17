// TypeScript
export type BBox = { x: number; y: number; width: number; height: number };

export function getGroupBBox(nodes: Array<{ x: number; y: number; width: number; height: number }>): BBox {
    if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function roundToGrid(value: number, grid: number) {
    return Math.round(value / grid) * grid;
}

function nearestGridPoint(x: number, y: number, grid: number) {
    return { gx: roundToGrid(x, grid), gy: roundToGrid(y, grid) };
}

/**
 * 그룹 바운딩 박스의 네 모서리 중 하나가 그리드 교차점에 스냅되도록
 * 최적의 dx, dy(보정 오프셋)를 계산합니다.
 *
 * @param bbox 현재 그룹 바운딩 박스
 * @param dx 사용자 드래그로 계산된 원래 이동량 X
 * @param dy 사용자 드래그로 계산된 원래 이동량 Y
 * @param gridSize 그리드 크기(px)
 * @param threshold 스냅 허용 거리(px). 코너-그리드 거리가 threshold 이내일 때만 스냅
 */
export function computeGroupSnapDelta(
    bbox: BBox,
    dx: number,
    dy: number,
    gridSize: number,
    threshold = gridSize / 2
): { dx: number; dy: number } {
    if (gridSize <= 0) return { dx, dy };

    // 이동 후 코너 좌표
    const corners = [
        { name: 'tl', x: bbox.x + dx, y: bbox.y + dy },
        { name: 'tr', x: bbox.x + bbox.width + dx, y: bbox.y + dy },
        { name: 'bl', x: bbox.x + dx, y: bbox.y + bbox.height + dy },
        { name: 'br', x: bbox.x + bbox.width + dx, y: bbox.y + bbox.height + dy },
    ];

    // 각 코너를 가장 가까운 그리드 교차점으로 보정했을 때의 후보 dx, dy
    const candidates: Array<{ dx: number; dy: number; cost: number }> = [];

    for (const c of corners) {
        const { gx, gy } = nearestGridPoint(c.x, c.y, gridSize);
        const candDx = dx + (gx - c.x);
        const candDy = dy + (gy - c.y);
        const dist = Math.hypot(gx - c.x, gy - c.y);

        // threshold 이내일 때만 후보로
        if (dist <= threshold) {
            // 이동량 변화(보정량)가 작은 것을 우선
            const cost = Math.abs(candDx - dx) + Math.abs(candDy - dy);
            candidates.push({ dx: candDx, dy: candDy, cost });
        }
    }

    // 후보가 없으면 스냅하지 않음
    if (candidates.length === 0) return { dx, dy };

    // 보정량이 가장 작은 후보 선택
    candidates.sort((a, b) => a.cost - b.cost);
    return { dx: candidates[0].dx, dy: candidates[0].dy };
}