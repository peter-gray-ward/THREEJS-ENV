applyGravity() {
    if (!this.isJumping) {
        this.camera.velocity.y += -0.05; 
        if (this.camera.velocity.y < TERMINAL_VELOCITY) {
            this.camera.velocity.y = TERMINAL_VELOCITY;
        }
        this.camera.position.y += this.camera.velocity.y;

        const raycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        const intersection = this.findClosestIntersection(raycaster);

        if (intersection && intersection.distance < 1) {
            this.camera.position.y = intersection.point.y + 1;
            this.camera.velocity.y = 0;
            this.isJumping = false;

            this.updateTerrain(intersection);
        }
    }
}

// Helper function to find the closest intersection with terrain
findClosestIntersection(raycaster) {
    let closestIntersection = null;
    let minDistance = Infinity;

    // Check intersections with terrain meshes
    for (let mesh of this.terrain.meshes) {
        const intersects = raycaster.intersectObject(mesh, true);
        if (intersects.length > 0 && intersects[0].distance < minDistance) {
            closestIntersection = intersects[0];
            minDistance = intersects[0].distance;
        }
    }

    // Check intersections with castle parts
    for (let part of window.castle.parts) {
        const intersects = raycaster.intersectObject(part, true);
        if (intersects.length > 0 && intersects[0].distance < minDistance) {
            closestIntersection = intersects[0];
            minDistance = intersects[0].distance;
        }
    }

    return closestIntersection;
}
