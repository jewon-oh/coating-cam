import {Point} from "@/types/point";

export type LineSegment = { type: 'line'; start: Point; end: Point };
export type ArcSegment = {
    type: 'arc';
    start: Point;
    center: Point;
    end?: Point;
    radius: number;
    direction: 'ccw' | 'cw'
};
export type PathSegment = LineSegment | ArcSegment;