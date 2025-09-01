import {CustomShapeConfig} from "@/types/custom-konva-config";
import {CoatingSettings} from "@/types/coating";

export type ProjectFileType ={
    version:number,
    shapes: CustomShapeConfig[],
    coatingSettings: CoatingSettings
}