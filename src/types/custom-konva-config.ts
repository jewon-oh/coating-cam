import {ShapeConfig} from "konva/lib/Shape";
import {ImageConfig} from "konva/lib/shapes/Image";
import {GroupConfig} from "konva/lib/Group";



export interface AdditionalShapeConfig {
    parentId: string | null; // 부모 shape id, null 이면 최상위 객체

    //
    isLocked: boolean;

    // 🆕 개별 도형 코팅 제어 플래그
    useCustomCoating?: boolean;  // 개별 코팅 설정 활성화 여부

    // 코팅 유형 설정
    coatingType?: 'fill' | 'outline' | 'masking';
    
    // 코팅 설정
    coatingSpeed?: number;  //  코팅 속도
    coatingHeight?: number; // 코팅 높이
    coatingOrder?: number;  // 코팅 순서 제어
    skipCoating?: boolean;  // 특정 도형 제외
    
    // outline 코팅 설정
    outlinePasses?: number; // 테두리 코팅 회수
    outlineInterval?: number;   // 테두리 코팅 간격
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


