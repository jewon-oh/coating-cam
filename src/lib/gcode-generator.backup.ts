export interface GCodeSettings {
    nozzleDiameter: number;
    fillType: 'outline' | 'fill';
    fillSpacing: number; // Percentage
    feedRate: number;
    workSpeed: number;
    safeZHeight: number;
    workZHeight: number; // New setting for work height
    maskingBehavior: 'lift' | 'avoid'; // New setting for masking behavior
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

function isPointInsideShape(point: { x: number, y: number }, shape: GCodeShape): boolean {
    if (shape.type === 'rect' && shape.width && shape.height) {
        return (
            point.x >= shape.x &&
            point.x <= shape.x + shape.width &&
            point.y >= shape.y &&
            point.y <= shape.y + shape.height
        );
    }
    if (shape.type === 'circle' && shape.radius) {
        const centerX = shape.x + shape.radius;
        const centerY = shape.y + shape.radius;
        const distanceSquared = Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2);
        return distanceSquared <= Math.pow(shape.radius, 2);
    }
    return false;
}

function isPointInsideShapes(point: { x: number, y: number }, shapes: GCodeShape[]): boolean {
    for (const shape of shapes) {
        if (isPointInsideShape(point, shape)) {
            return true;
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
    gcode += `G0 Z${settings.safeZHeight}\n`; // Start at safe height

    const step = settings.nozzleDiameter;
    const spacing = settings.nozzleDiameter * (settings.fillSpacing / 100);
    const imgX = targetImage.x;
    const imgY = targetImage.y;
    const imgWidth = targetImage.width;
    const imgHeight = targetImage.height;

    let isToolDown = false;

    for (let y = imgY; y <= imgY + imgHeight; y += spacing) {
        const isReverse = Math.round((y - imgY) / spacing) % 2 === 1;
        const startX = isReverse ? imgX + imgWidth : imgX;
        const endX = isReverse ? imgX : imgX + imgWidth;

        for (let x = startX; isReverse ? x >= endX : x <= endX; x += isReverse ? -step : step) {
            const point = { x, y };
            const isMasked = isPointInsideShapes(point, maskingShapes);

            if (!isMasked) {
                if (!isToolDown) {
                    // Move to the point at safe height first, then lower to work height
                    gcode += `G0 X${x.toFixed(3)} Y${y.toFixed(3)}\n`;
                    gcode += `G1 Z${settings.workZHeight.toFixed(3)} F${settings.workSpeed}\n`;
                    isToolDown = true;
                }
                gcode += `G1 X${x.toFixed(3)} Y${y.toFixed(3)}\n`;
            } else {
                if (isToolDown) {
                    if (settings.maskingBehavior === 'lift') {
                        gcode += `G0 Z${settings.safeZHeight}\n`;
                    }
                    isToolDown = false;
                }
            }
        }

        if (isToolDown) {
            gcode += `G0 Z${settings.safeZHeight}\n`;
            isToolDown = false;
        }
    }

    gcode += '\nM30 ; End of program\n';
    return gcode;
}
