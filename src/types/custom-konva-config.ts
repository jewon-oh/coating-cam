import {ShapeConfig} from "konva/lib/Shape";
import {ImageConfig} from "konva/lib/shapes/Image";
import {GroupConfig} from "konva/lib/Group";


export interface AdditionalShapeConfig {
    parentId: string | null; // 부모 shape id, null 이면 최상위 객체
}

export interface CustomShapeConfig extends ShapeConfig,AdditionalShapeConfig {
    type: 'rectangle' | 'circle' | 'ellipse';
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