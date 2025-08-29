import {ShapeConfig} from "konva/lib/Shape";

export interface CommonCoatingConfig {
    // 코팅 공통 설정
    coatingOrder?: number;  // 코팅 순서 제어
    skipCoating?: boolean;  // 코팅 제외
    coatingHeight?: number; // 코팅 높이
    coatingSpeed?: number;  // 코팅 속도
}

export interface CustomShapeConfig extends ShapeConfig {
    type: 'rectangle' | 'circle' | 'polygon' | 'image' | 'group' | 'line';  // line 추가
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
    fillPattern?: 'horizontal' | 'vertical' | 'auto' | 'concentric';  // concentric 추가
    coatingWidth?: number;  // 코팅 폭
    lineSpacing?: number; // 코팅 라인 간격

    // outline 코팅 설정
    outlineType?:'outside' | 'center' | 'inside'; // outline 시작점 설정
    outlinePasses?: number; // 테두리 코팅 회수
    outlineInterval?: number;   // 테두리 코팅 오프셋
    
    // masking 설정
    travelAvoidanceStrategy?: 'global'| 'lift' | 'contour', // 이동 회피 전략
    maskClearance?: number; // 마스킹 여유 거리

    // line 전용 속성
    points?: number[];  // 라인의 점들 [x1, y1, x2, y2, ...]
    startPoint?: { x: number; y: number };  // 시작점
    endPoint?: { x: number; y: number };    // 끝점
}