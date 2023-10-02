import type * as Storage from "../../storage/storage";

export function findPane(root: Storage.Dockable, id: string): Storage.Dockable | null {
    if (root.tag === "pane") {
        return root.id === id ? root : null;
    }

    for (const child of root.children) {
        if (child.id === id) {
            return child;
        }
    }

    for (const child of root.children) {
        const inChild = findPane(child, id);
        if (inChild !== null) {
            return inChild;
        }
    }

    return null;
}

export function findAnyPane(root: Storage.Dockable): Storage.DockablePane | null {
    if (root.tag === "pane") {
        return root;
    }

    for (const child of root.children) {
        if (child.tag === "pane") {
            return child;
        }

        const paneInChild = findAnyPane(child);
        if (paneInChild) {
            return paneInChild;
        }
    }

    return null
}

export function findParent(root: Storage.Dockable, id: string): Storage.Dockable | null {
    if (root.tag === "pane") {
        return null;
    }

    for (const child of root.children) {
        if (child.id === id) {
            return root;
        }
    }

    for (const child of root.children) {
        const inChild = findParent(child, id);
        if (inChild !== null) {
            return inChild;
        }
    }

    return null;
}

export function optimizeTree(root: Storage.Dockable, parent: Storage.Dockable | null): Storage.Dockable | null {
    if (root.tag === "pane") {
        if (root.children.length === 0) {
            // Case 1: Reducing Pane without tabs to null
            return null;
        } else {
            return root;
        }
    } else {
        const newRoot = { ...root };
        newRoot.children = root.children.map((child) => optimizeTree(child, newRoot)).filter((v) => v !== null);

        if (newRoot.children.length === 0) {
            // Case 2: Reducing Split without any children to null
            if (parent) {
                return null;
            } else {
                // Case 4: Case 2 unless there is no parent (this is root)
                return newRoot;
            }
        } else if (newRoot.children.length === 1) {
            // Case 3: Reducing Split with single Pane to just Pane

            if (parent) {
                return newRoot.children[0];
            } else {
                // Case 4: Case 3 unless there is no parent (this is root)
                if (newRoot.children[0].tag !== 'pane') {
                    newRoot.tag = newRoot.children[0].tag;
                    newRoot.children = newRoot.children[0].children;
                }

                return newRoot;
            }
        } else {
            return newRoot;
        }
    }
}