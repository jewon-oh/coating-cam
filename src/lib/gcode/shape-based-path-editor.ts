import { CustomShapeConfig } from '@/types/custom-konva-config';
import { GcodeSettings } from '@/types/gcode';
import { PathGroup } from '@/types/gcode-path';
import { ShapeToPathConverter } from '../shape-to-path-converter';
import { PathToGcodeConverter } from './path-to-gcode-converter';

/**
 * Shape 기반 경로 편집 통합 클래스
 */
export class ShapeBasedPathEditor {
    private settings: GcodeSettings;
    private workArea: { width: number; height: number };
    private shapeConverter: ShapeToPathConverter;
    private gcodeConverter: PathToGcodeConverter;

    constructor(settings: GcodeSettings, workArea: { width: number; height: number }) {
        this.settings = settings;
        this.workArea = workArea;
        this.shapeConverter = new ShapeToPathConverter(settings, workArea);
        this.gcodeConverter = new PathToGcodeConverter(settings);
    }

    /**
     * Shape들로부터 편집 가능한 경로들을 생성
     */
    async generateEditablePaths(shapes: CustomShapeConfig[]): Promise<PathGroup[]> {
        return await this.shapeConverter.convertShapesToPaths(shapes);
    }

    /**
     * 편집된 경로들을 G-Code로 변환
     */
    generateGCodeFromPaths(pathGroups: PathGroup[], optimize: boolean = true): string {
        const processedGroups = optimize ?
            this.gcodeConverter.optimizePaths(pathGroups) :
            pathGroups;

        return this.gcodeConverter.convertToGCode(processedGroups);
    }

    /**
     * 전체 워크플로우: Shape -> Path -> 편집 -> G-Code
     */
    async createEditableWorkflow(shapes: CustomShapeConfig[]): Promise<{
        pathGroups: PathGroup[];
        generateGCode: (editedGroups: PathGroup[]) => string;
    }> {
        const pathGroups = await this.generateEditablePaths(shapes);

        return {
            pathGroups,
            generateGCode: (editedGroups: PathGroup[]) =>
                this.generateGCodeFromPaths(editedGroups, true)
        };
    }
}