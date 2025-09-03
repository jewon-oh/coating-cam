import {CustomShapeConfig} from "@/types/custom-konva-config";
import {CoatingSettings} from "../../common/types/coating";

export type ProjectFileType ={
    version:number,
    shapes: CustomShapeConfig[],
    coatingSettings: CoatingSettings
}