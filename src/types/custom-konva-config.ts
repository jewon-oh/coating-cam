import {ShapeConfig} from "konva/lib/Shape";
import {ImageConfig} from "konva/lib/shapes/Image";
import {GroupConfig} from "konva/lib/Group";

export interface AdditionalShapeConfig {
    parentId: string | null; // 부모 shape id, null 이면 최상위 객체

    isLocked: boolean;

    // 코팅 유형 설정
    coatingType?: 'fill' | 'outline' | 'masking';
    
    // 코팅 공통 설정
    coatingOrder?: number;  // 코팅 순서 제어
    skipCoating?: boolean;  // 특정 도형 제외
    coatingHeight?: number; // 코팅 높이
    coatingSpeed?: number;  // 코팅 속도

    // fill 코팅 설정
    fillPattern: 'horizontal' | 'vertical' | 'auto';  // 채우기 패턴
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

export interface CustomShapeConfig extends ShapeConfig,AdditionalShapeConfig {
    type: 'rectangle' | 'circle' | 'polygon';
}

export interface CustomImageConfig extends ImageConfig,AdditionalShapeConfig {
    type: 'image';
    imageDataUrl?: string; // 이미지 데이터 URL 추가
}

export interface CustomGroupConfig extends GroupConfig,AdditionalShapeConfig {
    type: 'group';

}

// 모든 커스텀 설정 타입을 하나로 묶는 Union 타입
export type AnyNodeConfig = CustomShapeConfig | CustomImageConfig | CustomGroupConfig;


