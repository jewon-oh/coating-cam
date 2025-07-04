
import { useShapeContext, ImageShape } from '@/contexts/shape-context';
import { useTool } from '@/contexts/tool-context';
import { useHistory } from '@/contexts/history-context';

/**
 * 툴바의 액션 관련 로직을 관리하는 커스텀 훅
 */
export const useToolActions = () => {
    const { addShapeToBack } = useShapeContext();
    const { setTool } = useTool();
    const { saveHistory } = useHistory();

    /**
     * 사용자가 선택한 이미지를 캔버스에 추가하는 함수
     * 파일 선택, FileReader를 이용한 데이터 변환, 리사이징 로직을 포함합니다.
     */
    const handleInsertImage = () => {
        // 1. 파일 입력을 위한 input 엘리먼트 동적 생성
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        // 2. 사용자가 파일을 선택했을 때의 로직
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];

            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const imageDataUrl = e.target?.result as string;
                const image = new window.Image();
                image.src = imageDataUrl;

                image.onload = () => {
                    // 캔버스에 맞게 이미지 크기 조절
                    const MAX_WIDTH = 400;
                    const MAX_HEIGHT = 400;
                    let { width, height } = image;

                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width *= ratio;
                        height *= ratio;
                    }

                    // 컨텍스트에 추가할 이미지 Shape 데이터 생성
                    const newImageShape: Omit<ImageShape, 'id'> = {
                        type: "image",
                        x: 50,
                        y: 50,
                        width,
                        height,
                        image: image, // Use image property
                        draggable: true,
                        crop: { x: 0, y: 0, width: image.width, height: image.height },
                    };

                    // 컨텍스트 함수를 호출하여 상태 업데이트
                    addShapeToBack(newImageShape, (updatedShapes) => {
                        // 이미지 추가 후 히스토리 저장
                        saveHistory(updatedShapes);
                    });

                    // 이미지 추가 후 바로 선택/이동할 수 있도록 도구 변경
                    setTool('select');
                };
            };
            reader.readAsDataURL(file);
        };

        // 3. 파일 선택창 띄우기
        input.click();
    };

    // 다른 액션들도 필요하다면 여기에 추가할 수 있습니다.
    // const handleDeleteSelected = () => { ... };

    return {
        handleInsertImage,
    };
};