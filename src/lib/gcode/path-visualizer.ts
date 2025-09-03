import { CustomShapeConfig } from "@/types/custom-konva-config";
import { CoatingSettings } from "../../../common/types/coating";
import { Point } from "@/types/point";
import { PathCalculator } from "@/lib/gcode/path-calculator";
import { MaskingManager } from "@/lib/gcode/mask-manager";

function shouldSkipCoating(shape: Partial<CustomShapeConfig>): boolean {
    return shape.skipCoating === true;
}

function findPath(
    zone: { start: Point; end: Point }[],
    startPoint: Point
): { start: Point; end: Point }[] {
    if (zone.length === 0) return [];

    const remaining = new Set(zone);
    const orderedPath: { start: Point; end: Point }[] = [];
    let currentLocation = startPoint;

    while (remaining.size > 0) {
        let closestSegment: { start: Point; end: Point } | null = null;
        let closestDistance = Infinity;
        let reversed = false;

        for (const segment of remaining) {
            const distToStart = Math.hypot(currentLocation.x - segment.start.x, currentLocation.y - segment.start.y);
            if (distToStart < closestDistance) {
                closestDistance = distToStart;
                closestSegment = segment;
                reversed = false;
            }
            const distToEnd = Math.hypot(currentLocation.x - segment.end.x, currentLocation.y - segment.end.y);
            if (distToEnd < closestDistance) {
                closestDistance = distToEnd;
                closestSegment = segment;
                reversed = true;
            }
        }

        if (closestSegment) {
            if (reversed) {
                orderedPath.push({ start: closestSegment.end, end: closestSegment.start });
                currentLocation = closestSegment.start;
            } else {
                orderedPath.push(closestSegment);
                currentLocation = closestSegment.end;
            }
            remaining.delete(closestSegment);
        } else {
            break; 
        }
    }

    return orderedPath;
}

export async function getCoatingSequenceEndpoints(
    shapes: CustomShapeConfig[],
    settings: CoatingSettings
): Promise<{ start: Point; end: Point; order: number }[]> {
    
    const activeShapes = shapes.filter(s => !shouldSkipCoating(s));
    const coatingShapes = activeShapes.filter(s => s.coatingType === 'fill' || s.coatingType === 'outline');
    
    let maskShapes: CustomShapeConfig[] = [];
    if (settings.enableMasking) {
        maskShapes = activeShapes.filter(s => s.coatingType === 'masking');
    }

    const masker = new MaskingManager(settings, maskShapes);
    const calculator = new PathCalculator(settings, masker);

    const orderedShapes = [...coatingShapes]
        .filter(s => s.coatingOrder && s.coatingOrder > 0)
        .sort((a, b) => (a.coatingOrder!) - (b.coatingOrder!));

    const allEndpoints: { start: Point; end: Point; order: number }[] = [];
    let currentLocation: Point = { x: 0, y: 0 };

    for (const shape of orderedShapes) {
        const rawSegments = await calculator.calculateForShapeAbsolute(shape);
        const maskedSegments = masker.applyMaskingToSegments(rawSegments, shape);

        if (maskedSegments.length === 0) continue;

        let shapeStartPoint: Point | null = null;
        let closestEntryPointDistance = Infinity;

        for (const segment of maskedSegments) {
            const distToStart = Math.hypot(currentLocation.x - segment.start.x, currentLocation.y - segment.start.y);
            if (distToStart < closestEntryPointDistance) {
                closestEntryPointDistance = distToStart;
                shapeStartPoint = segment.start;
            }
            const distToEnd = Math.hypot(currentLocation.x - segment.end.x, currentLocation.y - segment.end.y);
            if (distToEnd < closestEntryPointDistance) {
                closestEntryPointDistance = distToEnd;
                shapeStartPoint = segment.end;
            }
        }

        if (shapeStartPoint) {
            const orderedPath = findPath(maskedSegments, shapeStartPoint);
            if (orderedPath.length > 0) {
                const shapeEndPoint = orderedPath[orderedPath.length - 1].end;

                allEndpoints.push({ start: shapeStartPoint, end: shapeEndPoint, order: shape.coatingOrder! });
                
                currentLocation = shapeEndPoint;
            }
        }
    }

    return allEndpoints;
}