import { useShapeContext } from '@/contexts/shape-context';
import { useHistory } from '@/contexts/history-context';

export const useProjectActions = () => {
    const { shapes, setAllShapes } = useShapeContext();
    const { resetHistory } = useHistory();

    const handleSaveProject = () => {
        const jsonString = JSON.stringify(shapes, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'canvas-project.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadProject = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const loadedShapes = JSON.parse(content);
                    if (Array.isArray(loadedShapes)) {
                        setAllShapes(loadedShapes);
                        resetHistory(loadedShapes); // Reset history with the new state
                    } else {
                        alert('잘못된 파일 형식입니다. 도형 배열이 포함된 JSON 파일을 선택하세요.');
                    }
                } catch (error) {
                    console.error('Error loading or parsing file:', error);
                    alert('파일을 불러오는 중 오류가 발생했습니다.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return { handleSaveProject, handleLoadProject };
};
