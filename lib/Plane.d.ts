import { Polygon } from '/lib/Polygon.js';
import { Vector } from '/lib/Vector.js';
/**
 * Represents a plane in 3D space.
 */
export declare class Plane {
    normal: Vector;
    w: number;
    static EPSILON: number;
    constructor(normal: Vector, w: number);
    clone(): Plane;
    flip(): void;
    splitPolygon(polygon: Polygon, coplanarFront: Polygon[], coplanarBack: Polygon[], front: Polygon[], back: Polygon[]): void;
    static fromPoints(a: Vector, b: Vector, c: Vector): Plane;
}
