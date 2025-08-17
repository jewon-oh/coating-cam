# `src/lib/coating-gcode-generator.ts` 테스트 계획

## 1. 목적
`src/lib/coating-gcode-generator.ts` 파일에 정의된 G-코드 생성 로직의 정확성과 견고성을 보장합니다. 특히 다양한 입력 설정과 마스킹 도형에 대해 올바른 G-코드가 생성되는지 확인합니다.

## 2. 테스트 대상 모듈 및 함수

*   **`generateGCode`**: 핵심 G-코드 생성 함수.
*   **`getIntersectionInterval`**: 도형과 Y축 교차점 계산.
*   **`mergeIntervals`**: 겹치는 구간 병합.
*   **`calculateAllowedIntervals`**: 마스킹 도형을 고려한 허용 구간 계산.
*   **`isPointInsideShapes`**: 특정 점이 마스킹 도형 내부에 있는지 확인.

## 3. 테스트 유형

*   **단위 테스트 (Unit Tests)**: 각 헬퍼 함수(`getIntersectionInterval`, `mergeIntervals`, `calculateAllowedIntervals`, `isPointInsideShapes`)의 개별적인 로직을 테스트합니다.
*   **통합 테스트 (Integration Tests)**: `generateGCode` 함수가 다양한 `GCodeShape` 및 `GCodeSettings` 입력에 대해 올바른 G-코드를 생성합니다.

## 4. 테스트 시나리오 (주요 고려 사항)

### `getIntersectionInterval`
*   사각형 도형에 대한 올바른 교차점 반환.
*   원형 도형에 대한 올바른 교차점 반환.
*   교차하지 않는 경우 `null` 반환.
*   유효하지 않은 도형 타입 처리.

### `mergeIntervals`
*   겹치지 않는 구간 병합.
*   부분적으로 겹치는 구간 병합.
*   완전히 포함되는 구간 병합.
*   정렬되지 않은 구간 입력 처리.
*   빈 배열 또는 단일 요소 배열 처리.

### `calculateAllowedIntervals`
*   마스킹 도형이 없는 경우 전체 이미지 너비 반환.
*   단일 마스킹 도형이 이미지 영역을 가리는 경우.
*   여러 마스킹 도형이 이미지 영역을 가리는 경우.
*   마스킹 도형이 이미지 영역 밖에 있는 경우.
*   마스킹 도형이 겹치는 경우.

### `isPointInsideShapes`
*   점이 단일 도형 내부에 있는 경우.
*   점이 여러 도형 중 하나 내부에 있는 경우.
*   점이 어떤 도형에도 포함되지 않는 경우.

### `generateGCode`
*   **기본 G-코드 구조**: G90, G21, G1 F, G0 Z 등의 초기 G-코드 명령이 올바르게 포함되는지 확인.
*   **유효하지 않은 `targetImage`**: 유효하지 않은 이미지 입력에 대한 처리 (예: `type`이 'image'가 아니거나 `width`, `height`가 없는 경우).
*   **`maskingBehavior: 'avoid'`**:
    *   마스킹 도형이 없는 경우 전체 이미지 영역을 스캔하는지 확인.
    *   마스킹 도형이 있는 경우 해당 영역을 피해서 G-코드를 생성하는지 확인.
    *   `lastX` 기반의 스캔 방향 전환 로직 테스트.
*   **`maskingBehavior: 'skip'`**:
    *   마스킹 도형이 없는 경우 전체 이미지 영역을 스캔하는지 확인.
    *   마스킹 도형이 있는 경우 해당 영역에서 Z축을 들어 올리는지 확인.
    *   지그재그 스캔 패턴 (홀수/짝수 라인) 테스트.
    *   `isToolDown` 상태 관리의 정확성.
*   **설정 값 적용**: `nozzleDiameter`, `fillSpacing`, `feedRate`, `workSpeed`, `safeZHeight`, `workZHeight` 등의 설정 값이 G-코드에 올바르게 반영되는지 확인.
*   **부동 소수점 정밀도**: `toFixed(3)`와 같은 부동 소수점 처리의 정확성.
*   **빈 마스킹 도형 배열**: `maskingShapes`가 빈 배열일 때의 동작.

## 5. 모킹 전략
*   `Math.random` 또는 `Date`와 같이 비결정적인 함수는 이 모듈에서 사용되지 않으므로 특별한 모킹은 필요하지 않습니다.
*   `generateGCode` 함수는 내부 헬퍼 함수를 사용하므로, 헬퍼 함수는 단위 테스트에서 개별적으로 테스트하고, `generateGCode` 통합 테스트에서는 실제 구현을 사용합니다.

## 6. 테스트 환경
*   **프레임워크**: Vitest
*   **테스트 파일 위치**: `src/lib/gcode-generator.test.ts` (테스트 대상 파일과 동일한 디렉토리에 co-locate)
