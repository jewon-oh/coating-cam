import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { setPresent } from '@/store/slices/history-slice';
import { addPathGroup } from '@/store/slices/path-slice';
import { updateShape } from '@/store/slices/shapes-slice';

function useUnifiedHistory() {
    const dispatch = useDispatch<AppDispatch>();
    const history = useSelector((state: RootState) => state.history);

    const saveToHistory = () => {
        const currentShapes = history.present.shapes; // 현재 Shape 상태
        const currentPaths = history.present.paths;   // 현재 Path 상태

        dispatch(
            setPresent({
                shapes: currentShapes,
                paths: currentPaths,
            })
        );
    };

    const updateShapeAndHistory = (shapeUpdates: any) => {
        dispatch(updateShape(shapeUpdates));
        saveToHistory();
    };

    const addPathGroupAndHistory = (newPathGroup: any) => {
        dispatch(addPathGroup(newPathGroup));
        saveToHistory();
    };

    return {
        saveToHistory,
        updateShapeAndHistory,
        addPathGroupAndHistory,
    };
}