handleJumping() {
    // Update camera position based on the jump velocity
    this.camera.position.y += this.jumpVelocity;
    this.jumpVelocity -= 0.03 * 0.8; // Simulate gravity by decreasing velocity

    // Cast a ray from the camera downwards to detect the ground
    const downRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
    const downIntersection = this.findClosestIntersection(downRaycaster);

    // Cast a ray upwards to detect ceilings
    const upRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, 1, 0));
    const upIntersection = this.findClosestIntersection(upRaycaster);

    // Ground collision detection
    if (downIntersection && downIntersection.distance < 1) {
        console.log("Camera is above the ground, landing");

        // Adjust the camera position to the surface plus a small offset to simulate landing
        this.camera.position.y = downIntersection.point.y + 1;
        this.camera.velocity.y = 0;
        this.isJumping = false;

        this.updateTerrain(downIntersection);
    }

    // Ceiling collision detection
    if (upIntersection && upIntersection.distance < .5) {
        console.log("Camera hit the ceiling");

        // Prevent the camera from going through the ceiling
        this.camera.position.y = upIntersection.point.y - .5; // Adjust based on how close you want to stop
        this.camera.velocity.y = 0;
        this.isJumping = false;

        // Optional: handle additional ceiling collision logic here
    }

    // If neither intersection is detected, continue falling
    if (!downIntersection && !upIntersection) {
        console.log("No intersection detected, camera still in the air");
    }
}