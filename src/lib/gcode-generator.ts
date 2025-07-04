export interface GCodeSettings {
    nozzleDiameter: number;
    fillType: 'outline' | 'fill';
    fillSpacing: number; // Percentage
    feedRate: number;
    workSpeed: number;
    safeZHeight: number;
    workZHeight: number;
    maskingBehavior: 'lift' | 'avoid';
}

export interface GCodeShape {
    id: string;
    type: 'rect' | 'circle' | 'image';
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    rotation?: number;
}

function getIntersectionInterval(y: number, shape: GCodeShape): [number, number] | null {
    if (shape.type === 'rect' && shape.width && shape.height) {
        if (y >= shape.y && y <= shape.y + shape.height) {
            return [shape.x, shape.x + shape.width];
        }
    }
    if (shape.type === 'circle' && shape.radius) {
        const centerX = shape.x + shape.radius;
        const centerY = shape.y + shape.radius;
        const dy = Math.abs(y - centerY);
        if (dy <= shape.radius) {
            const dx = Math.sqrt(shape.radius * shape.radius - dy * dy);
            return [centerX - dx, centerX + dx];
        }
    }
    return null;
}

function mergeIntervals(intervals: [number, number][]): [number, number][] {
    if (intervals.length <= 1) return intervals;
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        const current = intervals[i];
        if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current);
        }
    }
    return merged;
}

function calculateAllowedIntervals(y: number, imgX: number, imgWidth: number, maskingShapes: GCodeShape[]): [number, number][] {
    let allowed: [number, number][] = [[imgX, imgX + imgWidth]];
    const forbiddenIntervals: [number, number][] = [];
    for (const shape of maskingShapes) {
        const interval = getIntersectionInterval(y, shape);
        if (interval) forbiddenIntervals.push(interval);
    }
    const mergedForbidden = mergeIntervals(forbiddenIntervals);
    for (const forbidden of mergedForbidden) {
        const newAllowed: [number, number][] = [];
        for (const current of allowed) {
            if (current[1] < forbidden[0] || current[0] > forbidden[1]) {
                newAllowed.push(current);
                continue;
            }
            if (current[0] < forbidden[0]) newAllowed.push([current[0], forbidden[0]]);
            if (current[1] > forbidden[1]) newAllowed.push([forbidden[1], current[1]]);
        }
        allowed = newAllowed;
    }
    return allowed.sort((a, b) => a[0] - b[0]);
}

function isPointInsideShapes(point: { x: number, y: number }, shapes: GCodeShape[]): boolean {
    for (const shape of shapes) {
        if (getIntersectionInterval(point.y, shape)) {
             const interval = getIntersectionInterval(point.y, shape);
             if(interval && point.x >= interval[0] && point.x <= interval[1]) return true;
        }
    }
    return false;
}


export function generateGCode(
    targetImage: GCodeShape,
    maskingShapes: GCodeShape[],
    settings: GCodeSettings
): string {
    if (!targetImage || targetImage.type !== 'image' || !targetImage.width || !targetImage.height) {
        return '; No valid image selected for G-code generation.\n';
    }

    let gcode = '';
    gcode += 'G90 ; Use absolute coordinates\n';
    gcode += 'G21 ; Set units to millimeters\n';
    gcode += `G1 F${settings.feedRate} ; Set feed rate\n\n`;
    gcode += `G0 Z${settings.safeZHeight}\n`;

    const spacing = settings.nozzleDiameter * (settings.fillSpacing / 100);
    const imgX = targetImage.x;
    const imgY = targetImage.y;
    const imgWidth = targetImage.width;
    const imgHeight = targetImage.height;

    if (settings.maskingBehavior === 'avoid') {
        let lastX = imgX;
        for (let y = imgY; y <= imgY + imgHeight; y += spacing) {
            const allowedIntervals = calculateAllowedIntervals(y, imgX, imgWidth, maskingShapes);
            if (allowedIntervals.length === 0) continue;

            const leftMostStart = allowedIntervals[0][0];
            const rightMostEnd = allowedIntervals[allowedIntervals.length - 1][1];
            const distToLeft = Math.abs(lastX - leftMostStart);
            const distToRight = Math.abs(lastX - rightMostEnd);
            const isReverse = distToRight < distToLeft;

            const sortedIntervals = isReverse ? [...allowedIntervals].reverse() : allowedIntervals;

            for (const interval of sortedIntervals) {
                const startX = isReverse ? interval[1] : interval[0];
                const endX = isReverse ? interval[0] : interval[1];
                gcode += `G0 X${startX.toFixed(3)} Y${y.toFixed(3)}\n`;
                gcode += `G1 Z${settings.workZHeight.toFixed(3)} F${settings.workSpeed}\n`;
                gcode += `G1 X${endX.toFixed(3)} Y${y.toFixed(3)}\n`;
                gcode += `G0 Z${settings.safeZHeight}\n`;
                lastX = endX;
            }
        }
    } else { // 'lift' behavior
        const step = settings.nozzleDiameter;
        for (let y = imgY; y <= imgY + imgHeight; y += spacing) {
            const isReverse = Math.round((y - imgY) / spacing) % 2 === 1;
            const startX = isReverse ? imgX + imgWidth : imgX;
            const endX = isReverse ? imgX : imgX + imgWidth;
            let isToolDown = false;

            for (let x = startX; isReverse ? x >= endX : x <= endX; x += isReverse ? -step : step) {
                if (!isPointInsideShapes({ x, y }, maskingShapes)) {
                    if (!isToolDown) {
                        gcode += `G0 X${x.toFixed(3)} Y${y.toFixed(3)}\n`;
                        gcode += `G1 Z${settings.workZHeight.toFixed(3)} F${settings.workSpeed}\n`;
                        isToolDown = true;
                    }
                    gcode += `G1 X${x.toFixed(3)} Y${y.toFixed(3)}\n`;
                } else {
                    if (isToolDown) {
                        gcode += `G0 Z${settings.safeZHeight}\n`;
                        isToolDown = false;
                    }
                }
            }
            if (isToolDown) {
                gcode += `G0 Z${settings.safeZHeight}\n`;
            }
        }
    }

    gcode += '\nM30 ; End of program\n';
    return gcode;
}