import {ShapeConfig} from "konva/lib/Shape";
import {Point} from "@/lib/gcode/point";

export interface CommonCoatingConfig {

    // 코팅 공통 설정
    coatingOrder?: number;  // 코팅 순서 제어
    skipCoating?: boolean;  // 코팅 제외
    coatingHeight?: number; // 코팅 높이
    coatingSpeed?: number;  // 코팅 속도
}

export interface  CustomShapeConfig extends ShapeConfig  {
    type: 'rectangle' | 'circle' | 'polygon' | 'image' | 'group';
    imageDataUrl?: string; // 이미지 데이터 URL 추가
    parentId: string | null; // 부모 shape id, null 이면 최상위 객체
    isLocked: boolean;

    commonCoatingConfig?: CommonCoatingConfig;

    // 코팅 유형 설정
    coatingType?: 'fill' | 'outline' | 'masking';
    
    // 코팅 공통 설정
    coatingOrder?: number;  // 코팅 순서 제어
    skipCoating?: boolean;  // 특정 도형 제외
    coatingHeight?: number; // 코팅 높이
    coatingSpeed?: number;  // 코팅 속도

    // fill 코팅 설정
    fillPattern?: 'horizontal' | 'vertical' | 'auto';  // 채우기 패턴
    coatingWidth?: number;  // 코팅 폭
    lineSpacing?: number; // 코팅 라인 간격

    // outline 코팅 설정
    outlineType?:'outside' | 'center' | 'inside'; // outline 시작점 설정
    outlinePasses?: number; // 테두리 코팅 회수
    outlineInterval?: number;   // 테두리 코팅 오프셋
    
    // masking 설정
    travelAvoidanceStrategy?: 'global'| 'lift' | 'contour', // 이동 회피 전략
    maskClearance?: number; // 마스킹 여유 거리
}

// 새로운 Path 설정 타입
export interface PathConfig {
    id: string;
    shapeId: string;              // 부모 shape의 ID
    name: string;                 // 사용자 지정 이름
    order: number;                // 실행 순서 (shape 내에서)

    // 경로별 개별 설정
    commonCoatingConfig?: CommonCoatingConfig;

    // 계산된 데이터
    segments: { start: Point; end: Point };
    lastCalculated?: number;
    estimatedTime?: number;
}
