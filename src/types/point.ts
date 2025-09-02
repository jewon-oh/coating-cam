// Z축을 선택적으로 포함하도록 정의된 점(Point) 인터페이스입니다.
export interface Point {
    x: number;
    y: number;
    z?: number; // Z축은 선택 사항
}