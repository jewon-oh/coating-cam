export type FillPattern = 'horizontal' | 'vertical' | 'concentric' |'auto';
export type CoatingType = 'fill' | 'outline' | 'masking';
export type TravelAvoidanceStrategy = 'lift' | 'contour';

export interface CoatingSettings {
    // 코팅 관련 설정
    coatingWidth: number;        // 코팅 폭 (mm)
    lineSpacing: number;         // 라인 간격 (mm)
    coatingSpeed: number;        // 코팅 속도 (mm/min)
    moveSpeed: number;           // 이동 속도 (mm/min)

    // Z축 설정
    safeHeight: number;          // 안전 높이 (mm)
    coatingHeight: number;       // 코팅 높이 (mm)

    // 패턴 설정
    fillPattern: FillPattern;  // 채우기 패턴

    // 마스킹 설정
    enableMasking: boolean;      // 마스킹 사용 여부
    maskingClearance: number;    // 마스킹 여유 거리 (mm)

    travelAvoidanceStrategy: TravelAvoidanceStrategy; // 이동 회피 전략 추가
    unit?: 'mm';
    pixelsPerMm: number; // 픽셀-밀리미터 변환 비율
}

export const DEFAULT_COATING_SETTINGS: CoatingSettings = {
    // 코팅 기본 설정
    coatingWidth: 10,           // 10mm 코팅 폭
    lineSpacing: 10,            // 10mm 라인 간격
    coatingSpeed: 1000,          // 1000mm/min 코팅 속도
    moveSpeed: 2000,             // 2000mm/min 이동 속도

    // Z축 기본 설정
    safeHeight: 80,               // 80mm 안전 높이
    coatingHeight: 20,          // 20mm 코팅 높이

    // 패턴 기본 설정
    fillPattern: 'auto',

    // 마스킹 기본 설정
    enableMasking: true,
    maskingClearance: 0,       // 기본 0mm 여유 거리
    travelAvoidanceStrategy: 'contour', // 마스킹 테두리 따라 우회

    unit: 'mm',
    pixelsPerMm: 10, // 1mm 당 10픽셀
}