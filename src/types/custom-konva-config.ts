import type {CircleConfig} from "konva/lib/shapes/Circle";
import type {GroupConfig} from "konva/lib/Group";
import type {ImageConfig} from "konva/lib/shapes/Image";
import type {LineConfig} from "konva/lib/shapes/Line";
import type {RectConfig} from "konva/lib/shapes/Rect";
import {CoatingType, FillPattern, OutlineType, TravelAvoidanceStrategy} from "../../common/types/coating";

/**
 * 모든 커스텀 도형에 공통적으로 적용되는 기본 속성입니다.
 * 앱 고유의 메타데이터와 코팅 관련 설정을 포함합니다.
 */
export interface BaseProperties {
// 앱 고유 메타데이터
    id?: string; // 모든 도형에 id를 필수로 지정합니다.
    parentId?: string | null; // 부모 shape id, null 이면 최상위 객체
    isLocked?: boolean;

// 코팅 유형 설정
    coatingType?: CoatingType;

// 코팅 공통 설정
    coatingWidth?: number; // 코팅 폭
    coatingOrder?: number; // 코팅 순서 제어
    skipCoating?: boolean; // 특정 도형 제외

// Z축 설정
    coatingHeight?: number; // 코팅 높이
    coatingSpeed?: number; // 코팅 속도

// 채우기 코팅 설정
    fillPattern?: FillPattern;
    lineSpacing?: number; // 코팅 라인 간격

// 윤곽 코팅 설정
    outlineType?: OutlineType;
    outlinePasses?: number; // 테두리 코팅 회수
    outlineInterval?: number; // 테두리 코팅 오프셋

// 마스킹 설정
    travelAvoidanceStrategy?: TravelAvoidanceStrategy;
    maskClearance?: number; // 마스킹 여유 거리


}

/**
 * Konva의 기본 Config 타입에 앱의 공통 속성과 `type` 식별자를 결합하는 제네릭 타입입니다.
 * @template T Konva의 Config 타입 (예: RectConfig, CircleConfig)
 * @template K 도형을 식별하는 리터럴 타입 (예: 'rectangle', 'circle')
 */
type ShapeWithAppConfig<T, K extends string> = T &
    BaseProperties & {
    type?: K;
};

// 제네릭을 사용하여 각 도형의 타입을 정의합니다.
export type RectangleShapeConfig = ShapeWithAppConfig<RectConfig, "rectangle">;
export type CircleShapeConfig = ShapeWithAppConfig<CircleConfig, "circle">;
export type LineShapeConfig = ShapeWithAppConfig<LineConfig, "line">;
export type GroupShapeConfig = ShapeWithAppConfig<GroupConfig, "group">;

// Image와 같이 추가적인 커스텀 속성이 필요한 경우, 별도로 확장합니다.
export type ImageShapeConfig = ShapeWithAppConfig<ImageConfig, "image"> & {
    imageDataUrl?: string; // 이미지 데이터 URL 추가
};

/**
 * 모든 커스텀 도형 설정을 포함하는 Discriminated Union 타입입니다.
 * 'type' 속성을 통해 각 도형의 구체적인 타입을 식별할 수 있습니다.
 */
export type CustomShapeConfig =
    | RectangleShapeConfig
    | CircleShapeConfig
    | ImageShapeConfig
    | GroupShapeConfig
    | LineShapeConfig;

// 기존 SerializableShapePayload 유지...
export interface SerializableShapePayload extends Omit<CustomShapeConfig, 'image'> {
    imageDataUrl?: string;
    fillPatternImageSrc?: string;
}