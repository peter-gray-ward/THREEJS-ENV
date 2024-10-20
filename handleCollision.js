handleCollision() {
    const directions = [
        new THREE.Vector3(1, 0, 0),    // Right
        new THREE.Vector3(-1, 0, 0),   // Left
        new THREE.Vector3(0, 0, 1),    // Forward
        new THREE.Vector3(0, 0, -1),   // Backward
        new THREE.Vector3(0, 1, 0),    // Up
        new THREE.Vector3(0, -1, 0)    // Down
    ];

    const collisionDistance = 0.5; 
    let collisionResponseForce = 0.3; 

    for (let i = 0; i < directions.length; i++) {
        let dir = directions[i];
        if (i === 2) {
            collisionResponseForce = 0.5;
        }

        const raycaster = new THREE.Raycaster(this.camera.position, dir.normalize());

        const intersectsTrees = raycaster.intersectObjects(this.terrain.trees.flatMap(tree => [tree.trunk, tree.foliage]), true);
        if (intersectsTrees.length > 0 && intersectsTrees[0].distance < collisionDistance) {
            const responseDirection = this.camera.position.clone().sub(intersectsTrees[0].point).normalize();
            this.camera.position.add(responseDirection.multiplyScalar(collisionResponseForce));

            if (direction.equals(new THREE.Vector3(0, -1, 0))) {
                this.camera.velocity.y = 0;
                this.camera.position.y = intersectsTrees[0].point.y + 1;
            } else if (direction.equals(new THREE.Vector3(0, 1, 0))) {
                this.camera.velocity.y = Math.min(this.camera.velocity.y, 0);
            }
        }

        const intersectsCastle = raycaster.intersectObjects(window.castle.parts, true);
        if (intersectsCastle.length > 0 && intersectsCastle.some(i => i.distance < 0.2)) {
            const responseDirection = this.camera.position.clone().sub(intersectsCastle[0].point).normalize();

            if (isVerticalIntersection(intersectsCastle[0].face.normal)) {
                this.camera.velocity.y = 0;
                this.camera.position.y = intersectsCastle[0].point.y + 1;
            } else {
                this.camera.position.add(responseDirection.multiplyScalar(collisionResponseForce));
            }
        }
    }
}