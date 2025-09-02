// 💡 경로 타입을 정의합니다.
import {Point} from "@/lib/gcode/point";

export type LineSegment = { type: 'line'; start: Point; end: Point };
export type ArcSegment = { type: 'arc'; start: Point; center: Point;end?: Point; radius: number; direction: 'ccw' };
export type PathSegment = LineSegment | ArcSegment;
