import { vec2 } from "gl-matrix";
import { isBoxVisible, Visibility } from "./utils";

export type BoxRange = {
    xRange: [number, number]
    yRange: [number, number]
}

type QuadTreeNode = {
    box: [vec2, vec2, vec2, vec2]
    level: number
    xRange: [number, number]
    yRange: [number, number]
    children: QuadTreeNode[]
}

export class QuadTree {
    private root: QuadTreeNode;
    private maxZoom: number;

    private minZoom: number = 0;
    private triangular: boolean = false;

    constructor(box: [vec2, vec2, vec2, vec2], levels: number) {
        this.root = this.createNode(box, [0.0, 1.0], [0.0, 1.0], levels);
        this.maxZoom = levels;
    }

    public getVisibleNodesMemoryless(bounds: [vec2, vec2], minZoom: number, triangular: boolean): BoxRange[] {
        let visible: BoxRange[] = [];
        this.minZoom = minZoom;
        this.triangular = triangular;
        this.getVisibleTilesMemoryless(this.root.box, bounds, this.root.xRange, this.root.yRange, this.maxZoom, visible);
        return visible;
    }

    public getVisibleNodes(bounds: [vec2, vec2], minZoom: number): BoxRange[] {
        let visibleNodes: BoxRange[] = [];
        this.getVisibleNodesRecursive(this.root, bounds, minZoom, visibleNodes);
        return visibleNodes;
    }


    private getVisibleTilesMemoryless(box: [vec2, vec2, vec2, vec2], bounds: [vec2, vec2], xRange: [number, number], yRange: [number, number], zoom: number, visibleNodes: BoxRange[]): void {
        if (this.triangular && yRange[0] >= xRange[1]) return;
        
        const visibility = isBoxVisible(box, bounds);
        if (visibility == Visibility.None ) return;
        
        if (visibility == Visibility.Full || zoom == this.minZoom) {
            visibleNodes.push({
                xRange: xRange,
                yRange: yRange
            })
        } else {
            let children = this.getBoxSplit(box);
            this.getVisibleTilesMemoryless(children[0], bounds, [xRange[0], xRange[0] + (xRange[1] - xRange[0]) / 2.0], [yRange[0], yRange[0] + (yRange[1] - yRange[0]) / 2.0], zoom - 1, visibleNodes);
            this.getVisibleTilesMemoryless(children[1], bounds, [xRange[0] + (xRange[1] - xRange[0]) / 2.0, xRange[1]], [yRange[0], yRange[0] + (yRange[1] - yRange[0]) / 2.0], zoom - 1, visibleNodes);
            this.getVisibleTilesMemoryless(children[2], bounds, [xRange[0] + (xRange[1] - xRange[0]) / 2.0, xRange[1]], [yRange[0] + (yRange[1] - yRange[0]) / 2.0, yRange[1]], zoom - 1, visibleNodes);
            this.getVisibleTilesMemoryless(children[3], bounds, [xRange[0], xRange[0] + (xRange[1] - xRange[0]) / 2.0], [yRange[0] + (yRange[1] - yRange[0]) / 2.0, yRange[1]], zoom - 1, visibleNodes);
        }
    }

    private getVisibleNodesRecursive(node: QuadTreeNode, bounds: [vec2, vec2], minZoom: number, visibleNodes: BoxRange[]) {
        const visibility = isBoxVisible(node.box, bounds);
        if (visibility == Visibility.None) {
            return;
        }

        if (visibility == Visibility.Full || node.level == minZoom) {
            visibleNodes.push({ xRange: node.xRange, yRange: node.yRange });
        } else {
            // Dynamically add leaves to the tree as needed
            if (node.children.length == 0) {
                this.constructTreeNodeChildren(node);
            }
            node.children.forEach(child => {
                this.getVisibleNodesRecursive(child, bounds, minZoom, visibleNodes);
            });
        }
    }

    private constructTreeNodeChildren(node: QuadTreeNode) {
        if (node.level == 0) return;
         
        let children = this.getBoxSplit(node.box);
        node.children.push(this.createNode(children[0], [node.xRange[0], node.xRange[0] + (node.xRange[1] - node.xRange[0]) / 2.0], [node.yRange[0], node.yRange[0] + (node.yRange[1] - node.yRange[0]) / 2.0], node.level - 1));
        node.children.push(this.createNode(children[1], [node.xRange[0] + (node.xRange[1] - node.xRange[0]) / 2.0, node.xRange[1]], [node.yRange[0], node.yRange[0] + (node.yRange[1] - node.yRange[0]) / 2.0], node.level - 1));
        node.children.push(this.createNode(children[2], [node.xRange[0] + (node.xRange[1] - node.xRange[0]) / 2.0, node.xRange[1]], [node.yRange[0] + (node.yRange[1] - node.yRange[0]) / 2.0, node.yRange[1]], node.level - 1));
        node.children.push(this.createNode(children[3], [node.xRange[0], node.xRange[0] + (node.xRange[1] - node.xRange[0]) / 2.0], [node.yRange[0] + (node.yRange[1] - node.yRange[0]) / 2.0, node.yRange[1]], node.level - 1));
    }

    private createNode(box: [vec2, vec2, vec2, vec2], xRange: [number, number], yRange: [number, number], level: number): QuadTreeNode {
        return {
            box: box,
            xRange: xRange,
            yRange: yRange,
            level: level,
            children: []
        }
    }

    private getBoxSplit(box: [vec2, vec2, vec2, vec2]): [vec2, vec2, vec2, vec2][] {
        const ab: vec2 = vec2.lerp(vec2.create(), box[0], box[1], 0.5);
        const bc: vec2 = vec2.lerp(vec2.create(), box[1], box[2], 0.5);
        const cd: vec2 = vec2.lerp(vec2.create(), box[2], box[3], 0.5);
        const da: vec2 = vec2.lerp(vec2.create(), box[3], box[0], 0.5);
        const center: vec2 = vec2.lerp(vec2.create(), box[0], box[2], 0.5);
        return[
            [box[0], ab, center, da],
            [ab, box[1], bc, center],
            [center, bc, box[2], cd],
            [da, center, cd, box[3]]
        ]
    }
}