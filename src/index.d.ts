declare type Color = number[];
interface Position {
    y: number;
    x: number;
    isBucket: boolean;
    newColor?: Color;
    tolerance?: number;
    strokeColor?: Color;
    moving?: boolean;
    lineWidth: number;
}
interface Parameters {
    elementId: string;
    width: number;
    height: number;
    backgroundColor: Color;
    lineWidth: number;
    strokeColor: Color;
    disabled: string;
    showWarnings: boolean;
    maxSnapshots: number;
}
export default class CanvasFreeDrawing {
    elementId: string | void;
    canvasNode: HTMLElement | null;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
    maxSnapshots: number;
    snapshots: ImageData[];
    undos: ImageData[];
    positions: [Position[]?];
    leftCanvasDrawing: boolean;
    isDrawing: boolean;
    isDrawingModeEnabled: boolean;
    imageRestored: boolean;
    lineWidth: number;
    backgroundColor?: Color;
    strokeColor: Color;
    bucketToolColor: Color;
    bucketToolTolerance: number;
    isBucketToolEnabled: boolean;
    listenersList: string[];
    allowedEvents: string[];
    redrawCounter: number;
    dispatchEventsOnceEvery: number;
    redrawEvent: Event;
    mouseUpEvent: Event;
    mouseDownEvent: Event;
    mouseEnterEvent: Event;
    mouseLeaveEvent: Event;
    touchStartEvent: Event;
    touchEndEvent: Event;
    touchIdentifier?: number;
    previousX?: number;
    previousY?: number;
    showWarnings: boolean;
    isNodeColorEqualCache: never[];
    constructor(params: Parameters);
    requiredParam(object: object, param: string): void;
    logWarning(...args: string[]): void;
    addListeners(): void;
    removeListeners(): void;
    enableDrawingMode(): boolean;
    disableDrawingMode(): boolean;
    mouseDown(event: MouseEvent): Promise<{}> | undefined;
    mouseMove(event: MouseEvent): void;
    touchStart(event: TouchEvent): Promise<{}> | undefined;
    touchMove(event: TouchEvent): void;
    touchEnd(): void;
    mouseUp(): void;
    mouseUpDocument(): void;
    mouseLeave(): void;
    mouseEnter(): void;
    handleEndDrawing(): void;
    drawPoint(x: number, y: number): Promise<{}> | undefined;
    drawLine(x: number, y: number, event: MouseEvent | TouchEvent): void;
    handleDrawing(dispatchEventsOnceEvery: number): void;
    draw(position: Position[]): void;
    fill(x: number, y: number, newColor: Color, { tolerance }: {
        tolerance: number;
    }): Promise<{}>;
    toValidColor(color: Color): Color;
    isNodeColorEqual(i: Color, j: Color, t: number): any;
    getNodeColor(x: number, y: number, data: Uint8ClampedArray): number[];
    setNodeColor(x: number, y: number, color: Color, data: Uint8ClampedArray): void;
    rgbaFromArray(a: Color): string;
    setDimensions(): void;
    toggleCursor(): void;
    storeDrawing(x: number, y: number, moving: boolean): void;
    storeSnapshot(): void;
    getCanvasSnapshot(): ImageData;
    restoreCanvasSnapshot(imageData: ImageData): void;
    on(params: {
        event: string;
        counter?: number;
    }, callback: Function): void;
    setLineWidth(px: number): void;
    setBackground(color: Color, save?: boolean): void;
    setDrawingColor(color: Color): void;
    setStrokeColor(color: Color): void;
    configBucketTool(params: {
        color?: Color;
        tolerance?: number;
    }): void;
    toggleBucketTool(): boolean;
    toggleDrawingMode(): boolean;
    clear(): void;
    save(): string;
    restore(backup: string, callback: Function): void;
    undo(): void;
    redo(): void;
}
export {};
