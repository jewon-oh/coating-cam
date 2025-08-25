export const snapPoint = (p: { x: number; y: number }, gridSize: number, enabled: boolean) => {
    if (!enabled) return p;
    return {
        x: Math.round(p.x / gridSize) * gridSize,
        y: Math.round(p.y / gridSize) * gridSize,
    };
};