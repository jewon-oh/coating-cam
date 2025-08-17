import {AnyNodeConfig} from "@/types/custom-konva-config";
import {GcodeSettings} from "@/types/gcode";

export type ProjectFileType ={
    version:number,
    shapes: AnyNodeConfig[],
    gcodeSettings: GcodeSettings
}