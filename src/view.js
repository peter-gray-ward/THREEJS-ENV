import * as THREE from '/lib/three.module.min.js';
import { SUBTRACTION, Brush, Evaluator } from '/lib/three-bvh-csg.js';
import ViewModel from "/src/view-model.js";

const evaluator = new Evaluator();



window.THREE = THREE;

const LEVEL = [
    null,
    "Heart of the Woods"
];


window.sliding = false

window.OPTIMUM_VELOCITY = .5
window.TERMINAL_VELOCITY = -1.5,

window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
window.map = {}
var oceanBackground = null;


window.sceneRadius = 150

var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
// Global bounding box for the camera




function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}

function mapToRange(normalizedValue, minNew, maxNew) {
    return minNew + normalizedValue * (maxNew - minNew);
}


class GrassPatch {
    constructor(initobject) {
        this.mesh = initobject.mesh;
        this.bladePositions = initobject.bladePositions;
    }
}

function TriangleMesh(vertices, a, b, c, terrainWidth, terrainHeight) {

    const triangleGeometry = new THREE.BufferGeometry();

    // Extract vertex positions
    const vertexPositions = [
        vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],
        vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],
        vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]
    ];

    triangleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
    triangleGeometry.setIndex([0, 1, 2]);
    triangleGeometry.computeVertexNormals();
    triangleGeometry.computeBoundingBox();

    // Calculate UVs (using simple planar mapping based on X and Z coordinates)
    const uvs = [
        vertexPositions[0] / terrainWidth, vertexPositions[2] / terrainHeight,  // Vertex a
        vertexPositions[3] / terrainWidth, vertexPositions[5] / terrainHeight,  // Vertex b
        vertexPositions[6] / terrainWidth, vertexPositions[8] / terrainHeight   // Vertex c
    ];

    triangleGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));  // Add UVs

    const triangleMaterial = new THREE.MeshStandardMaterial({
        transparent: false,
        wireframe: true,
        color: 'red',
        side: THREE.DoubleSide
        // color: new THREE.Color(Math.random(), Math.random(), Math.random())
    });
    

    const triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;

    // Store the triangle geometry in a THREE.Triangle object
    triangleMesh.triangle = new THREE.Triangle(
        new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
        new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
        new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
    );

    // Calculate the triangle's normal and slope
    const normal = new THREE.Vector3();
    triangleMesh.triangle.getNormal(normal);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

    triangleMesh.slope = slope;
    triangleMesh.normal = normal;
    triangleMesh.triangle.uvs = uvs;  // Store UVs for later use (e.g., for texture painting)

    return triangleMesh;
}

function getInstancePosition(instancedMesh, index) {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(index, matrix);  // Get the transformation matrix for the instance

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);  // Extract the position from the matrix

    return position;
}

class BoundingVolumeHierarchy {

    constructor() {}

    static BVHNode = class {
        constructor(boundingBox, triangles, left = null, right = null) {
            this.boundingBox = boundingBox;
            this.grassTriangles = triangles;
            this.left = left;
            this.right = right;
        }
    }

    init(triangles) {
        console.log(triangles.length)
        if (triangles.length) {
            this.BVH = this.build(triangles);
        }
    }

    build(triangles, depth = 0) {
        if (triangles.length === 1) {
            return new BoundingVolumeHierarchy.BVHNode(triangles[0].geometry.boundingBox, [triangles[0]]);
        }

        const axis = depth % 3; // Cycle through x, y, z axes
        triangles.sort((a, b) => a.geometry.boundingBox.min[axis] - b.geometry.boundingBox.min[axis]);

        const mid = Math.floor(triangles.length / 2);
        const leftTriangles = triangles.slice(0, mid);
        const rightTriangles = triangles.slice(mid);

        const leftChild = this.build(leftTriangles, depth + 1);
        const rightChild = this.build(rightTriangles, depth + 1);

        const boundingBox = new THREE.Box3();
        boundingBox.union(leftChild.boundingBox);
        boundingBox.union(rightChild.boundingBox);

        return new BoundingVolumeHierarchy.BVHNode(boundingBox, [], leftChild, rightChild);
    }

    add(object, bvhNode) {
        if (!bvhNode) {
            // If the BVH node is null, create a new node
            return new BoundingVolumeHierarchy.BVHNode(object.geometry.boundingBox, [object]);
        }

        if (bvhNode.left === null && bvhNode.right === null) {
            // If the node is a leaf, add the object here
            bvhNode.triangles.push(object);
            bvhNode.boundingBox.union(object.geometry.boundingBox);
            return bvhNode;
        }

        // Determine which child to recurse into based on bounding box overlap
        const leftVolume = bvhNode.left.boundingBox.clone().union(object.geometry.boundingBox);
        const rightVolume = bvhNode.right.boundingBox.clone().union(object.geometry.boundingBox);

        if (leftVolume.getSize(new THREE.Vector3()).lengthSq() < rightVolume.getSize(new THREE.Vector3()).lengthSq()) {
            bvhNode.left = addObjectToBVH(object, bvhNode.left);
        } else {
            bvhNode.right = addObjectToBVH(object, bvhNode.right);
        }

        bvhNode.boundingBox.union(object.geometry.boundingBox);
        return bvhNode;
    }

    remove(object, bvhNode) {
        if (!bvhNode) return null;

        if (bvhNode.triangles.includes(object)) {
            // If this node contains the object, remove it
            bvhNode.triangles = bvhNode.triangles.filter(tri => tri !== object);

            if (bvhNode.triangles.length === 0 && !bvhNode.left && !bvhNode.right) {
                // If the node is empty and has no children, remove it
                return null;
            }

            // Recalculate the bounding box for the node
            bvhNode.boundingBox = new THREE.Box3();
            for (const tri of bvhNode.triangles) {
                bvhNode.boundingBox.union(tri.geometry.boundingBox);
            }
            if (bvhNode.left) bvhNode.boundingBox.union(bvhNode.left.boundingBox);
            if (bvhNode.right) bvhNode.boundingBox.union(bvhNode.right.boundingBox);
            return bvhNode;
        }

        // Recursively search the child nodes
        bvhNode.left = this.remove(object, bvhNode.left);
        bvhNode.right = this.remove(object, bvhNode.right);

        // If both children are removed, return null
        if (!bvhNode.left && !bvhNode.right && bvhNode.triangles.length === 0) {
            return null;
        }

        return bvhNode;
    }

    getAll(node = this.BVH, triangles = []) {
        // If the node is null, return the current list of triangles
        if (!node) {
            return triangles;
        }

        // If the node has triangles, add them to the array
        if (node.triangles && node.triangles.length > 0) {
            triangles.push(...node.triangles); // Use spread operator to add all triangles
        }

        // Recursively call on the left and right children
        if (node.left) {
            this.getAllTriangles(node.left, triangles);
        }
        if (node.right) {
            this.getAllTriangles(node.right, triangles);
        }

        // Return the accumulated list of triangles
        return triangles;
    }

    // Method to apply a function to all triangles in the BVH
    applyByFilter(node = this.BVH, filter) {
        // If the node is null, return
        if (!node) {
            return;
        }

        // If the node has triangles, apply the filter function to each triangle
        if (node.triangles && node.triangles.length > 0) {
            node.triangles.forEach(triangle => filter(triangle));
        }

        // Recursively call on the left and right children
        if (node.left) {
            this.applyByFilter(node.left, filter);
        }
        if (node.right) {
            this.applyByFilter(node.right, filter);
        }
    }


}

class Sky {

    constructor(user) {
        this.counter = 0;
        this.user = user;
        this.sceneRadius = 550;
        this.full_circle = 2 * Math.PI;
        this.time = 0;

        // this.hemisphereLight = new THREE.HemisphereLight(0xfefeff, 0x444444, .00015); // Sky and ground color
        // this.hemisphereLight.position.set(0, 0, 0);
        // scene.add(this.hemisphereLight);


        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sun.position.set(0, sceneRadius, 0);
        scene.add(this.sun)
        this.sun.lookAt(0, 0, 0)

        this.sun.castShadow = true; // Enable shadow casting for the light

        // Optionally configure shadow map size for better shadow quality
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        // Configure the shadow camera for the directional light (this affects shadow casting area)
        this.sun.shadow.camera.near = 0.005;
        this.sun.shadow.camera.far = 1200;
        this.sun.shadow.camera.left = -1200;
        this.sun.shadow.camera.right = 1200;
        this.sun.shadow.camera.top = 1200;
        this.sun.shadow.camera.bottom = -1200;
        this.sky = [];
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(20, 30, 30), 
            new THREE.MeshBasicMaterial({ 
                side: THREE.DoubleSide, 
                color: 'white' 
            })
        );
        this.sphere.position.set(0, this.sun.y - 150, 0);
        scene.add(this.sphere)

        this.createDome();

        for (var i = 0; i < 29; i++) {
            var cloud = this.MakeCloud()
            cloud.position.y += randomInRange(50, 250)
            cloud.position.x -= randomInRange(-50, 50)
            cloud.position.z -= randomInRange(-50, 50)

            scene.add(cloud)
        }

    }

     createDome() {
        var gridSize = 90; // Larger grid size for more detail at the horizon
        var radius = this.sceneRadius;
        var maxdist = 0;
        var highestY = 0
        for (var i = 0; i < gridSize; i++) {
            for (var j = 0; j < gridSize; j++) {
                // Calculate spherical coordinates
                var theta = (i / gridSize) * Math.PI;
                var phi = (j / gridSize) * Math.PI;

                // Convert spherical coordinates to Cartesian coordinates
                var x = radius * Math.sin(phi) * Math.cos(theta);
                var z = radius * Math.cos(phi);
                var y = radius * Math.sin(phi) * Math.sin(theta);

                if (y > highestY) highestY = y

                // For the horizon, create smaller tiles and blend colors
                var tileSize = 150; // Smaller tiles
                if (y <= 1) { // Near horizon
                    tileSize /= 3
                }
                var planeGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
                
                // Lerp colors from sky blue to white based on the height (closer to horizon = more white)
                var horizonFactor = Math.abs(y / radius); // 0 at horizon, 1 at top
                var skyColor = new THREE.Color(0x00f0ff); // Sky blue color
                var white = new THREE.Color(0xffffff); // White at horizon
                var color = new THREE.Color().lerpColors(white, skyColor, horizonFactor); // Interpolate

                var planeMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });

                // If near the horizon, add cloud texture
                // if (y < radius * 0.08) { // Near horizon
                //     planeMaterial.map = new THREE.TextureLoader().load('/images/cloud_texture.png'); // Cloud texture
                //     planeMaterial.transparent = true;
                // }

                var plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.position.set(x, y , z);
                plane.rotation.y = plane.rotation.y >= this.full_circle ? 0 : plane.rotation.y += 0.05;
                plane.lookAt(window.user.camera.position.x, user.camera.position.y, user.camera.position.z);
                
                // Store theta and phi for further use in lighting updates
                plane.theta = theta;
                plane.phi = phi;

                this.sky.push(plane);

                if (z > maxdist) z = maxdist;

                scene.add(plane);
            }
        }

        this.sun.position.y = highestY
        this.sphere.position.y = highestY
     }   


MakeCloud() {
    // Create a group to hold the cloud's spheres
    const cloud = new THREE.Group();

    // Generate a random number of clusters (elongated parts of the cloud)
    const numClusters = randomInRange(7, 11); // Fewer larger cloud parts for a wispy appearance

    for (let i = 0; i < numClusters; i++) {
        // Create a group for each elongated cluster
        const cluster = new THREE.Group();
        
        // Define a random radius for the cluster
        const clusterLength = randomInRange(15, 30); // Elongated in horizontal direction
        const clusterHeight = randomInRange(3, 7); // Thin in the vertical direction
        
        var sphereSmall = this.sceneRadius * .01;
        var sphereLarge = this.sceneRadius * .1
        // Randomize the number of small spheres per cluster
        const numSpheres = randomInRange(10, 19); // More spheres for each elongated cluster

        for (let j = 0; j < numSpheres; j++) {
            // Random radius for smaller spheres within the cluster
            const radius = randomInRange(sphereSmall, sphereLarge); // Much smaller spheres for a wispy look

            // Create a sphere geometry
            const geometry = new THREE.SphereGeometry(radius, 32, 32);

            // Create a material with white color and lower opacity for a lighter appearance
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: mapToRange(1 - ((radius - sphereSmall) / (sphereLarge - sphereSmall)), 0.7, 1) // Lower opacity between 0.3 and 0.5
            });

            // Create the mesh (small sphere)
            const sphere = new THREE.Mesh(geometry, material);

            // Position the small spheres more spread out horizontally, but thin vertically
            sphere.position.set(
                Math.random() * clusterLength - clusterLength / 2, // Wider in x direction
                randomInRange(clusterHeight - 10, clusterHeight), // Narrower in y direction
                Math.random() * 5 - 2.5  // Some variation in z direction
            );

            // Add the small sphere to the cluster
            cluster.add(sphere);
        }

        // Position the entire cluster randomly in the cloud space but focus on elongation
        cluster.position.set(
            randomInRange(-this.sceneRadius, this.sceneRadius),  // Spread out horizontally
            randomInRange(100, 1000),  // Some vertical spread
            randomInRange(-this.sceneRadius, this.sceneRadius)   // Spread out in depth for 3D look
        );

        // Add the cluster to the cloud group
        cloud.add(cluster);
    }

    // Return the cloud group, which now contains all the clusters and spheres
    return cloud;
}





    update() {
        // this.time += 0.005;
        var theta = this.full_circle * this.time;
        var sunTheta = theta;  // Sun's azimuthal angle (around the dome horizontally)
        var sunPhi = Math.PI / 2;  // Sun stays at the middle of the dome (hemisphere)

        // // Update the sun's position (optional if you want to visualize it)
        // var sunX = this.sceneRadius * Math.sin(sunPhi) * Math.cos(sunTheta);
        // var sunY = this.sceneRadius * Math.sin(sunPhi) * Math.sin(sunTheta);
        // var sunZ = this.sceneRadius * Math.cos(sunPhi);

        // this.sun.position.set(sunX, sunY, sunZ);
        // this.sphere.position.set(sunX, sunY, sunZ);

        for (var i = 0; i < this.sky.length; i++) {
            var skyTheta = this.sky[i].theta;  // Azimuthal angle of the plane
            var skyPhi = this.sky[i].phi;      // Polar angle of the plane

            // Calculate the angular difference between the sun and the plane
            var thetaDifference = Math.abs(sunTheta - skyTheta);
            var phiDifference = Math.abs(sunPhi - skyPhi);

            // Normalize the differences (wrap around at full circle)
            thetaDifference = Math.min(thetaDifference, this.full_circle - thetaDifference);
            phiDifference = Math.min(phiDifference, Math.PI - phiDifference);

            // Calculate intensity based on angular difference
            var angularDistance = thetaDifference + phiDifference;
            var maxAngularDistance = Math.PI;  // Max possible distance on the dome
            var intensity = 1 - (angularDistance / maxAngularDistance);

            // Clamp intensity between 0 and 1
            intensity = Math.max(0, Math.min(1, intensity));

            // Define the colors for the gradient (white near the sun, dark blue away)
            var colorFar = new THREE.Color(0x00f0ff);  // Far color (dark blue)
            var colorNear = new THREE.Color(0x00f0ff);

            // Interpolate between the colors based on intensity
            var color = new THREE.Color().lerpColors(colorFar, colorNear, intensity);



            // Update the material color based on angular proximity to the sun
            var horizonThreshold = this.sceneRadius * 0.15;  // Adjust based on where the horizon should be

            if (Math.abs(this.sky[i].position.y) <= horizonThreshold) {
                // Blend the color towards white near the horizon instead of hard-setting it
                var horizonBlendFactor = Math.abs(this.sky[i].position.y) / horizonThreshold;
                var blendedColor = new THREE.Color().lerpColors(color, new THREE.Color(0xffffff), 1 - horizonBlendFactor);
                this.sky[i].material.color.copy(blendedColor);  // Blend towards white near the horizon
            } else {
                this.sky[i].material.color.copy(color);  // Use the interpolated color
                this.sky[i].material.transparent = false;
            }

            if (this.sun.position.y < 0) {
                this.sky[i].material.transparent = true;
                this.sky[i].material.opacity = 0.1;
            }

            this.sky[i].material.needsUpdate = true;  // Ensure material is updated
        }
    }


}

class Structure {
    parts = {}
    constructor(struct) {
        for (var key in struct) {
            this[key] = struct[key]
        }
        console.log(this)
    }
    erect() {
        this.buildFoundation();
        this.buildFloors();
        this.buildWalls()
    }
    buildFoundation() {
        const foundation = new THREE.Mesh(
            new THREE.BoxGeometry(
                this.area.foundation.width, 
                this.area.foundation.height, 
                this.area.foundation.depth
            ),
            new THREE.MeshStandardMaterial({
                map: new THREE.TextureLoader().load(this.textures.foundation),
                transparent: true,
                opacity: 0.7
            })
        );
        foundation.geometry.computeVertexNormals()
        foundation.castShadow = true;
        foundation.receiveShadow = true;
        foundation.position.set(
            this.position.foundation.x,
            this.position.foundation.y + .1,
            this.position.foundation.z
        );
        foundation.name = "foundation"
        console.log('~built foundation', foundation.position)
        this.parts.foundation = foundation;
        scene.add(foundation);

        var ambientLight = new THREE.AmbientLight(new THREE.Color('aliceblue'), .1)

        ambientLight.position.y = this.wallHeight * 3 / 2

        scene.add(ambientLight)
 
    }
    buildFloors() {
        for (var i = 1, j = 0; i < this.floors; i++, j++) {
            var floor = new THREE.Mesh(
                new THREE.BoxGeometry(
                    this.area.foundation.width,
                    this.area.foundation.height,
                    this.area.foundation.depth
                ),
                new THREE.MeshStandardMaterial({
                    map: new THREE.TextureLoader().load(this.textures.foundation)
                })
            )
            floor.geometry.computeVertexNormals();
            floor.position.set(
                this.position.foundation.x,
                this.position.foundation.y + (i * this.area.wall.height / 2),
                this.position.foundation.z
            )

            floor.castShadow = true;
            floor.receiveShadow = true;

            this.parts[`floor${i}`] = floor;
            scene.add(floor);
        }
    }
    buildWalls() {
        var createDecorativeWall = (foundation, width, times = 1) => {
            console.log("Building decorative wall...");

            // Define the wall dimensions
            const wallHeight = this.area.wall.height * 3 * times; // Example: 3 floors tall
            const wallWidth = width; // Example wall width
            const wallThickness = 0.3; // Example thickness

            // Create the base wall geometry
            const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            const wallBrush = new Brush(wallGeometry);
            wallBrush.position.set(
                foundation.position.x,
                this.position.foundation.y + wallHeight / 2,
                foundation.position.z
            );
            wallBrush.updateMatrixWorld();

            // Create cutouts for windows at varying heights and sizes
            const evaluator = new Evaluator();
            
            // Create small windows at level 1
            const window1Geometry = new THREE.BoxGeometry(0.5, 0.5, wallThickness + 0.1); // Small square window
            const window1Brush = new Brush(window1Geometry);
            window1Brush.position.set(foundation.position.x, this.position.foundation.y + wallHeight / 6, foundation.position.z);
            window1Brush.updateMatrixWorld();
            
            // Create larger windows at level 2
            const window2Geometry = new THREE.BoxGeometry(1, 1, wallThickness + 0.1); // Larger window
            const window2Brush = new Brush(window2Geometry);
            window2Brush.position.set(foundation.position.x, this.position.foundation.y + wallHeight / 2, foundation.position.z);
            window2Brush.updateMatrixWorld();

            // Create small circular window at level 3
            const window3Geometry = new THREE.CylinderGeometry(0.3, 0.3, wallThickness + 0.1, 32); // Circular window
            const window3Brush = new Brush(window3Geometry);
            window3Brush.rotation.x = Math.PI / 2; // Rotate cylinder to face forward
            window3Brush.position.set(foundation.position.x, this.position.foundation.y + wallHeight * 5 / 6, foundation.position.z);
            window3Brush.updateMatrixWorld();

            // Perform the CSG subtraction to create the windows in the wall
            let finalWallGeometry = evaluator.evaluate(wallBrush, window1Brush, SUBTRACTION);
            finalWallGeometry = evaluator.evaluate(finalWallGeometry, window2Brush, SUBTRACTION);
            finalWallGeometry = evaluator.evaluate(finalWallGeometry, window3Brush, SUBTRACTION);

            let texture = new THREE.TextureLoader().load("/images/wallpaper3.jpg")
            texture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
            texture.wrapT = THREE.RepeatWrapping;
            // Convert the result back into a Mesh
            const decorativeWall = new THREE.Mesh(
                finalWallGeometry.geometry, 
                new THREE.MeshStandardMaterial({ 
                    map: texture,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.63
                }));
            decorativeWall.name = 'wall'
            // decorativeWall.computeBoundingSphere()
            const positions = finalWallGeometry.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i++) {
                if (isNaN(positions[i])) {
                    console.log(`NaN found at index ${i}`);
                }
            }

            scene.add(decorativeWall); // Add the wall with cutouts to the scene

            return decorativeWall
        }


        var createGlassWall = (foundation, width, iterations = 11, withBottom = true, i) => {
            console.log("Building glass wall...");
            var result = []



            // Define the glass wall dimensions
            const wallHeight = this.wallHeight * 3 / 11; // Example: 3 floors tall
            const wallWidth = width; // Example wall width
            const wallThickness = 0.1; // Thin thickness to represent glass

            // Create the base glass wall geometry (using a thin BoxGeometry to create a pane of glass)
            const glassGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            
            let glassOptions = {
                color: 0xA1C1E0, // Light blueish tint for glass
                opacity: 0.65, // Semi-transparent
                transparent: true, // Enable transparency
                roughness: 0.1, // Low roughness for a smoother glass look
                metalness: 0, // No metal effect
            }
            var txtr = new THREE.TextureLoader().load(`/images/trees/foliage/textures/foliage-7.jpg`);

            // Set texture wrapping to repeat
            txtr.wrapS = THREE.RepeatWrapping; // Horizontal wrapping
            txtr.wrapT = THREE.RepeatWrapping; // Vertical wrapping if needed

            // Set the number of repetitions (for example, repeat 4 times horizontally)
            txtr.repeat.set(randomInRange(11, 36), randomInRange(1, 7)); // Repeat 4 times in the X direction (columns), 1 time in the Y direction


            // Apply the texture to the glass material
            glassOptions.map = txtr;

            // Create transparent material for the glass
            const glassMaterial = new THREE.MeshStandardMaterial(glassOptions);

            // Create the glass wall mesh
            const glassWall = new THREE.Mesh(glassGeometry, glassMaterial);
            glassWall.position.set(
                foundation.position.x,
                this.centerPoint.y + wallHeight / 2 + this.offsetY,
                foundation.position.z
            );

            // Add the glass wall to the scene
            scene.add(glassWall);
            this.parts.push(glassWall);

            // Optionally, you can add a metal frame or borders around the glass
            const frameThickness = 0.01; // Example frame thickness
            const frameMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff, // Dark gray for the frame
                opacity: 0.5,
                transparent: true,
                metalness: 0.8, // Add metallic properties to the frame
                roughness: 1,
            });

            // Create a border frame around the glass
            const topFrameGeometry = new THREE.BoxGeometry(wallWidth + frameThickness, frameThickness, wallThickness);
            const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
            topFrame.position.set(foundation.position.x, glassWall.position.y + wallHeight / 2, foundation.position.z);
            scene.add(topFrame);
            this.parts.push(topFrame);

            let bottomFrame = new THREE.Mesh(topFrameGeometry, frameMaterial)
            if (withBottom) {
                bottomFrame.position.set(foundation.position.x, glassWall.position.y - wallHeight / 2, foundation.position.z);
                scene.add(bottomFrame);
                this.parts.push(bottomFrame);
            }

            const sideFrameGeometry = new THREE.BoxGeometry(frameThickness, wallHeight, wallThickness);
            const leftFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
            leftFrame.position.set(foundation.position.x - wallWidth / 2, glassWall.position.y, foundation.position.z);
            scene.add(leftFrame);
            this.parts.push(leftFrame);

            const rightFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
            rightFrame.position.set(foundation.position.x + wallWidth / 2, glassWall.position.y, foundation.position.z);
            scene.add(rightFrame);
            this.parts.push(rightFrame);

            // // Add random latticework bars across the wall (geometric lattice)
            // const latticeMaterial = new THREE.MeshStandardMaterial({
            //     color: 0x4F4F4F, // Same material for latticework
            //     metalness: 0.8,
            //     roughness: 0.2,
            // });

            // const latticeCount = 10; // Number of random lattice bars
            // for (let i = 0; i < latticeCount; i++) {
            //     const latticeThickness = 0.05; // Thin bars for the lattice
            //     const latticeGeometry = new THREE.BoxGeometry(
            //         Math.random() * wallWidth * 0.8 + wallWidth * 0.2, // Random width of the lattice
            //         latticeThickness, // Thin bar
            //         wallThickness
            //     );
                
            //     const lattice = new THREE.Mesh(latticeGeometry, latticeMaterial);

            //     // Randomly position the lattice
            //     const randomX = foundation.position.x - wallWidth / 2 + Math.random() * wallWidth;
            //     const randomY = this.centerPoint.y + Math.random() * wallHeight - wallHeight / 2;
                
            //     lattice.position.set(randomX, randomY, foundation.position.z);
                
            //     // Randomly rotate the lattice for an abstract pattern
            //     lattice.rotation.z = Math.random() * Math.PI * 2;

            //     // Add the lattice to the scene
            //     scene.add(lattice);
            //     result.push(lattice)
            //     this.parts.push(lattice);
            // }

            return [...result, glassWall, topFrame, bottomFrame, leftFrame, rightFrame];
        }



        var createCastleWall = (foundation, width) => {
            console.log("Building castle wall...");

            // Define the castle wall dimensions
            const wallHeight = this.wallHeight * 3; // Example: 3 floors tall
            const wallWidth = width; // Example width
            const wallThickness = 1; // Thicker than the other walls to represent stone
            const crenellationHeight = wallHeight * 0.1; // Height of the crenellations
            const crenellationWidth = wallWidth * 0.2; // Width of each crenellation gap
            const crenellationGap = crenellationWidth * 0.5; // Gap between each crenellation

            // Create the base castle wall geometry (without the crenellations)
            const castleWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            const castleWallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B5A2B }); // Brownish for stone

            const castleWall = new THREE.Mesh(castleWallGeometry, castleWallMaterial);
            castleWall.position.set(
                foundation.position.x,
                this.centerPoint.y + wallHeight / 2 + this.offsetY,
                foundation.position.z
            );
            scene.add(castleWall); // Add the base wall to the scene
            this.parts.push(castleWall)

            // Add crenellations to the top of the wall
            const numCrenellations = Math.floor(wallWidth / (crenellationWidth + crenellationGap)); // Number of crenellations
            for (let i = 0; i < numCrenellations; i++) {
                const crenellationGeometry = new THREE.BoxGeometry(crenellationWidth, crenellationHeight, wallThickness);
                const crenellation = new THREE.Mesh(crenellationGeometry, castleWallMaterial);
                
                const xOffset = i * (crenellationWidth + crenellationGap) - wallWidth / 2 + crenellationWidth / 2;
                crenellation.position.set(
                    foundation.position.x + xOffset,
                    this.centerPoint.y + wallHeight + crenellationHeight / 2 + this.offsetY,
                    foundation.position.z
                );
                scene.add(crenellation); // Add each crenellation to the scene
                this.parts.push(crenellation)
            }

            // Optionally, you can add a texture to simulate stone blocks
            const textureLoader = new THREE.TextureLoader();
            const stoneTexture = textureLoader.load('/images/wall3.jpg'); // Replace with your texture path
            castleWallMaterial.map = stoneTexture; // Apply texture to the wall material
            castleWallMaterial.needsUpdate = true; // Ensure the material updates after adding texture

            return castleWall
        }

        var createMossyWall = (foundation, width) => {
            console.log("Building mossy wall with circular cutouts...");

            // Define the wall dimensions
            const wallHeight = this.wallHeight * 3; // Example: 3 floors tall
            const wallWidth = width; // Example width
            const wallThickness = 0.5; // Example thickness for a mossy stone wall

            // Create the base wall geometry
            const mossyWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            const mossyWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3E4A33 }); // Mossy greenish-brown color

            // Apply a mossy texture if available
            const textureLoader = new THREE.TextureLoader();
            const mossTexture = textureLoader.load('/images/turf-wall.jpg'); // Replace with actual texture path
            mossyWallMaterial.map = mossTexture;
            mossyWallMaterial.needsUpdate = true;

            // Create the mossy wall mesh
            const mossyWall = new THREE.Mesh(mossyWallGeometry, mossyWallMaterial);
            mossyWall.position.set(
                foundation.position.x,
                this.centerPoint.y + wallHeight / 2 + this.offsetY,
                foundation.position.z
            );
            scene.add(mossyWall); // Add the mossy wall to the scene
            this.parts.push(mossyWall)

            // Create circular window cutouts using CSG (Constructive Solid Geometry)
            // const evaluator = new Evaluator();

            // // Define circular cutouts (windows)
            // const numWindows = 3; // Example: 3 circular windows
            // const windowRadius = 0.8; // Radius of the circular windows
            // const windowGap = wallHeight / (numWindows + 1); // Gap between windows
            // for (let i = 0; i < numWindows; i++) {
            //     // Create the circular window geometry directly as BufferGeometry (no need to convert)
            //     const windowGeometry = new THREE.CylinderGeometry(windowRadius, windowRadius, wallThickness + 0.1, 32); 
            //     const windowMesh = new THREE.Mesh(windowGeometry); // Create a mesh from the geometry

            //     windowMesh.rotation.z = Math.PI / 2; // Rotate to face the front
            //     windowMesh.updateMatrixWorld(); // Update the world matrix to account for transformations

            //     // No need for conversion to BufferGeometry, as THREE.CylinderGeometry is already BufferGeometry
            //     const windowBrush = new Brush(windowMesh.geometry); // Use Brush with BufferGeometry

            //     // Position the windows at different heights
            //     const yOffset = (i + 1) * windowGap - wallHeight / 2;
            //     windowBrush.position.set(
            //         foundation.position.x, 
            //         this.centerPoint.y + yOffset + this.offsetY,
            //         foundation.position.z
            //     );
            //     windowBrush.updateMatrixWorld();

            //     // Perform the CSG subtraction to create the window cutouts in the wall
            //     const finalGeometry = evaluator.evaluate(mossyWall, windowBrush, SUBTRACTION);
            //     mossyWall.geometry = finalGeometry.geometry; // Update the wall geometry with the cutouts
            // }



            // Convert the result back into a Mesh and add to the scene
            // mossyWall.geometry = finalGeometry.geometry;
            // mossyWall.material = mossyWallMaterial;
            scene.add(mossyWall); // Add the wall with circular cutouts to the scene
        }


        var side = 0
        for (var wall_instructions of [
            'decorative wall with cutout windows at 1 - 2 levels of varying sizes',
            'a wall of glass',
            'a castle wall',
            'a mossy wall with circular window cutouts'
        ]) {

            // Function to build the elevator on top of the foundation
            var _side = side++
            var height = this.wallHeight * 3
            console.log("Building on top of foundation...");

            // Use houseDim for dimensions
            const houseWidth = side % 2 == 0 ? this.area.foundation.width : this.area.foundation.depth;  // Width of the house/foundation
            const houseLength = side % 2 == 0 ? this.area.foundation.depth : this.area.foundation.width // Length of the house/foundation


            // // Example wall for the elevator shaft
            // const wallGeometry = new THREE.BoxGeometry(houseWidth, height, 0.1); // Width of the wall is the house width
            // const wallBrush = new Brush(wallGeometry);
            // wallBrush.position.set(
            //     foundation.position.x,  // X position matches the foundation's position
            //     this.centerPoint.y + height / 2 + this.offsetY, // Center vertically on foundation
            //     foundation.position.z - houseLength / 2 + 0.1 // Z position based on foundation's length
            // );
            // wallBrush.updateMatrixWorld();

            // // Example door cutout in the wall
            // const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.1); // Door size
            // const doorBrush = new Brush(doorGeometry);
            // doorBrush.position.set(
            //     foundation.position.x,  // X position matches foundation
            //     this.centerPoint.y + this.wallHeight / 2,  // Center door on wall's height
            //     foundation.position.z - houseLength / 2 + 0.1 // Same Z as the wall
            // );
            // doorBrush.updateMatrixWorld();

            // // Perform the CSG subtraction to create a door in the wall
            // const evaluator = new Evaluator();
            // const finalWallGeometry = evaluator.evaluate(wallBrush, doorBrush, SUBTRACTION);

            // // Convert the result back into a Mesh
            // const eWall = new THREE.Mesh(finalWallGeometry.geometry, new THREE.MeshStandardMaterial({ color: 0x808080 }));
            


            var walls = []


            switch (wall_instructions) {
                case 'decorative wall with cutout windows at 1 - 2 levels of varying sizes':
                    var aDecorativeWall = createDecorativeWall(this.parts.foundation, this.area.foundation.width);
                    aDecorativeWall.position.z += this.area.foundation.depth / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a wall of glass':
                    var aDecorativeWall = createDecorativeWall(this.parts.foundation, this.area.foundation.depth);
                    aDecorativeWall.position.x += this.area.foundation.width / 2
                    aDecorativeWall.rotation.y += Math.PI / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a castle wall':
                    var aDecorativeWall = createDecorativeWall(this.parts.foundation, this.area.foundation.width);
                    aDecorativeWall.position.z -= this.area.foundation.depth / 2
                    aDecorativeWall.rotation.y += -Math.PI 
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
                case 'a mossy wall with circular window cutouts':
                    var aDecorativeWall = createDecorativeWall(this.parts.foundation, this.area.foundation.depth);
                    aDecorativeWall.position.x -= this.area.foundation.width / 2
                    aDecorativeWall.rotation.y = -Math.PI / 2
                    scene.add(aDecorativeWall)
                    this.parts[aDecorativeWall.name] = aDecorativeWall
                    break;
            }
        }
    }

// class Castle {
//     offsetY = 1.5
//     elevatorSpeed = 0.2

//     constructor(centerPoint) {
//         this.centerPoint = centerPoint
//         if (this.centerPoint.y < 0) {
//             this.centerPoint.y = .01
//         }
//         this.houseDim = VM.map[VM.user.level]; // Width and Length of the house
//         this.parts = [];
//         this.elevator = []
//         this.wallHeight = 5;
//         var buildingHeight = this.centerPoint.y + (this.wallHeight * 3 * 13);
//         var elevatorHeight = 3

//         // Create the foundation
//         this.foundationHeight = 3;
//         const foundation = new THREE.Mesh(
//             new THREE.BoxGeometry(this.houseDim[0], this.foundationHeight, this.houseDim[1]),
//             new THREE.MeshStandardMaterial({
//                 color: 'gray',
//                 map: new THREE.TextureLoader().load("/images/concrete")
//             })
//         );
//         foundation.geometry.computeVertexNormals()
//         foundation.castShadow = true;
//         foundation.receiveShadow = true;
//         foundation.position.set(0, this.centerPoint.y - this.foundationHeight / 2, 0); // Position the foundation
//         this.parts.push(foundation);
//         scene.add(foundation);

//         var escalationCooridorDim = this.houseDim[0] * .05; // Size of the cut-out squares

//         // Create floors with cut-outs
//         for (var i = 1, j = 0; i < 13; i++, j++) {
//             let width = this.houseDim[0];
//             let length = this.houseDim[1];
//             var floorGroup = new THREE.Group();

//             // Create the first large part of the floor (remaining part after cut-out)
//             const floorPart1 = new THREE.Mesh(
//                 new THREE.BoxGeometry(width - escalationCooridorDim, this.foundationHeight, length),
//                 new THREE.MeshStandardMaterial({
//                     color: 'gray',
//                     map: new THREE.TextureLoader().load("/images/concrete")
//                 })
//             );
//             floorPart1.geometry.computeVertexNormals()
//             floorPart1.position.set(-escalationCooridorDim / 2, this.centerPoint.y, 0); // Shift to the left
//             floorGroup.add(floorPart1);

//             // // Create the second large part of the floor (remaining part after cut-out)
//             const floorPart2 = new THREE.Mesh(
//                 new THREE.BoxGeometry(width, this.foundationHeight, length - escalationCooridorDim),
//                 new THREE.MeshStandardMaterial({
//                     color: 'gray',
//                     map: new THREE.TextureLoader().load("/images/concrete")
//                 })
//             );
//             floorPart2.geometry.computeVertexNormals()
//             floorPart2.position.set(0, this.centerPoint.y, -escalationCooridorDim / 2); // Shift downward
//             floorGroup.add(floorPart2);

//             // Position the whole floor group for each level
//             floorGroup.position.set(0, this.centerPoint.y + (this.wallHeight * 3 * i) - (this.foundationHeight / 2) , 0);

//             // Cast and receive shadows
//             floorPart1.castShadow = true;
//             floorPart1.receiveShadow = true;
//             floorPart2.castShadow = true;
//             floorPart2.receiveShadow = true;

//             this.parts.push(floorGroup);
//             scene.add(floorGroup);
//         }



//         // Elevator floor
//         var eFloor = new THREE.Mesh(
//             new THREE.BoxGeometry(escalationCooridorDim, 0.2, escalationCooridorDim),
//             new THREE.MeshStandardMaterial({ color: 'maroon' })
//         );
//         eFloor.position.set(
//             this.houseDim[0] / 2 - escalationCooridorDim / 2, // X position (bottom-right corner)
//             this.centerPoint.y + this.offsetY, // Y position (same as floor)
//             this.houseDim[1] / 2 - escalationCooridorDim / 2  // Z position (bottom-right corner)
//         );
//         eFloor.geometry.computeVertexNormals()
//         eFloor.floorZero = this.centerPoint.y + this.offsetY
//         eFloor.interval = this.wallHeight * 3
//         eFloor.name = "elevator-floor"
//         this.elevator.push(eFloor)
//         scene.add(eFloor);
//         this.parts.push(eFloor)



//         // Elevator ceiling
//         var eCeiling = new THREE.Mesh(
//             new THREE.BoxGeometry(escalationCooridorDim, 0.2, escalationCooridorDim),
//             new THREE.MeshStandardMaterial({ color: 'maroon' })
//         );
//         eCeiling.position.set(
//             this.houseDim[0] / 2 - escalationCooridorDim / 2, 
//             this.centerPoint.y + elevatorHeight + this.offsetY,  // Y position (at ceiling height)
//             this.houseDim[1] / 2 - escalationCooridorDim / 2
//         );
//         eCeiling.geometry.computeVertexNormals()
//         this.elevator.push(eCeiling)
//         scene.add(eCeiling);
//         this.parts.push(eCeiling)

//         let texture = new THREE.TextureLoader().load('/images/wall12.jpg')

//         var elevatorShaftRight = new THREE.Mesh(
//             new THREE.BoxGeometry(
//                 escalationCooridorDim, buildingHeight, 0.2  // Segment height for this floor
//             ),
//             new THREE.MeshStandardMaterial({
//                 map: texture,
//                 side: THREE.DoubleSide
//             })
//         );
//         elevatorShaftRight.position.set(eFloor.position.x - escalationCooridorDim / 2, this.centerPoint.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
//         elevatorShaftRight.rotation.y = Math.PI / 2;
//         elevatorShaftRight.geometry.computeVertexNormals()
//         scene.add(elevatorShaftRight)
//         this.parts.push(elevatorShaftRight)

//         var elevatorShaftOutsideLeft = new THREE.Mesh(
//             new THREE.BoxGeometry(
//                 escalationCooridorDim, buildingHeight, 0.2  // Segment height for this floor
//             ),
//             new THREE.MeshStandardMaterial({
//                 transparent: true,
//                 opacity: 0.3,
//                 depthTest: true,   // Ensure depth testing is enabled
//                 depthWrite: false,  // Ensure writing to the depth buffer is enabled
//                 side: THREE.DoubleSide
//             })
//         );
//         elevatorShaftOutsideLeft.position.set(eFloor.position.x, this.centerPoint.y + buildingHeight / 2 + this.offsetY, eFloor.position.z + escalationCooridorDim / 2)
//         elevatorShaftOutsideLeft.geometry.computeVertexNormals()
//         scene.add(elevatorShaftOutsideLeft)
//         this.parts.push(elevatorShaftOutsideLeft)

//         var elevatorShaftOutsideRight = new THREE.Mesh(
//             new THREE.BoxGeometry(
//                 escalationCooridorDim, buildingHeight, 0.2  // Segment height for this floor
//             ),
//             new THREE.MeshStandardMaterial({
//                 transparent: true,
//                 opacity: 0.3,
//                 depthTest: true,   // Ensure depth testing is enabled
//                 depthWrite: false,  // Ensure writing to the depth buffer is enabled
//                 side: THREE.DoubleSide
//             })
//         );
//         elevatorShaftOutsideRight.position.set(eFloor.position.x + escalationCooridorDim / 2, this.centerPoint.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
//         elevatorShaftOutsideRight.rotation.y = Math.PI / 2;
//         elevatorShaftOutsideRight.geometry.computeVertexNormals();
//         scene.add(elevatorShaftOutsideRight)
//         this.parts.push(elevatorShaftOutsideRight)

//         // Iterate through each level (13 separate shaft segments)

//         for (let i = 1; i <= 13; i++) {
//             // Create the elevator shaft segment for this floor
//             var elevatorShaftLeft = new THREE.Mesh(
//                 new THREE.BoxGeometry(
//                     escalationCooridorDim, (this.wallHeight * 3), 0.1  // Segment height for this floor
//                 ),
//                 new THREE.MeshStandardMaterial({
//                     map: texture,
//                     side: THREE.DoubleSide
//                 })
//             );
            
//             // Calculate the correct y-position, summing each level incrementally
//             var yPosition = (i === 1)
//                 ? this.centerPoint.y + (this.wallHeight * 3) / 2 // Start at half height
//                 : this.centerPoint.y + ((this.wallHeight * 3 / 2) + (this.wallHeight * 3 * (i - 1)));  // Add height for each level

//             var floorYPosition = yPosition - (this.wallHeight * 3) / 2;

//             console.log(yPosition); // Debugging the correct y-positions

            
//             elevatorShaftLeft.position.set(
//                 eFloor.position.x, 
//                 yPosition,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2
//             );

//             // Convert the elevator shaft into a Brush for CSG operations
//             const shaftBrush = new Brush(elevatorShaftLeft.geometry);
//             shaftBrush.position.set(
//                 eFloor.position.x, 
//                 yPosition,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2
//             )
//             shaftBrush.updateMatrixWorld();

//             // Create the door geometry for the cutout
//             const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.2); // Door size
//             const doorBrush = new Brush(doorGeometry);
//             doorBrush.position.set(
//                 eFloor.position.x, 
//                 floorYPosition + this.offsetY + 1,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2
//             );
//             doorBrush.updateMatrixWorld();

//             // Subtract the door from the shaft segment (perform CSG subtraction)
//             const evaluator = new Evaluator();
//             const result = evaluator.evaluate(shaftBrush, doorBrush, SUBTRACTION);

//             // Create a mesh from the updated geometry for this shaft segment
//             const elevatorShaftLeftI = new THREE.Mesh(result.geometry, new THREE.MeshStandardMaterial({
//                 map: texture,
//                 transparent: false,
//                 side: THREE.DoubleSide
//             }));

//             // Add to scene and store the shaft segment
//             elevatorShaftLeftI.receiveShadow = true;
//             elevatorShaftLeftI.castShadow = true;
//             elevatorShaftLeftI.geometry.computeVertexNormals();
//             scene.add(elevatorShaftLeftI);
//             this.parts.push(elevatorShaftLeftI);



//             // ----------- Add Button Plate to Each Shaft -----------
//             var buttonPlate = new THREE.Mesh(
//                 new THREE.PlaneGeometry(0.3, 0.3),
//                 new THREE.MeshStandardMaterial({
//                     color: 'gold',
//                     metalness: 1,
//                     side: THREE.DoubleSide
//                 })
//             );

//             // Position the button plate on the right side of the door (outside the shaft)
//             // Adjust the position of the plate relative to the door and shaft
//             buttonPlate.position.set(
//                 eFloor.position.x - 1, 
//                 floorYPosition + this.offsetY + 1,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2 - .12
//             );
//             buttonPlate.geometry.computeVertexNormals();
            
//             // buttonPlate.rotation.y = Math.PI / 2;  // Rotate to face correctly

//             // this.parts.push(buttonPlate);  // Add to elevator array
//             scene.add(buttonPlate);  // Add to scene

//             var button = new THREE.Mesh(
//                 new THREE.CircleGeometry(.025, 20, 20),
//                 new THREE.MeshStandardMaterial({
//                     color: 'gray',
//                     transparent: true,
//                     opacity: 0.7,
//                     side: THREE.DoubleSide
//                 })
//             );
//             button.geometry.computeVertexNormals();
//             button.name = 'elevator-call-button';
//             button.floor = i - 1;
//             button.position.set(
//                 eFloor.position.x - 1, 
//                 floorYPosition + this.offsetY + 1,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2 - .13
//             );
//             button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
//             // button.rotation.y = Math.PI / 2
//             if (!i) {
//                 activeButtonLight.position.copy(button.position);
//                 scene.add(activeButtonLight)
//                 button.material.color.set('white')
//             }
//             scene.add(button);

//             var elevatorPointLight = new THREE.PointLight(0xffffff, 3, 5);
//             elevatorPointLight.position.set(
//                 eFloor.position.x - 1, 
//                 floorYPosition + this.offsetY + 2,  // Y-position at this level
//                 eFloor.position.z - escalationCooridorDim / 2 - .3
//             )
//             scene.add(elevatorPointLight)
//             var elevatorLightViz = new THREE.Mesh(
//                 new THREE.SphereGeometry(.1, 10, 10),
//                 new THREE.MeshBasicMaterial({
//                     color: 0xffffff
//                 })
//             );
//             elevatorLightViz.position.copy(elevatorPointLight.position)
//             scene.add(elevatorLightViz)
//             this.parts.push(elevatorLightViz)
//         }


//         // Elevator walls (4 walls)
        
//         for (var i = 0; i < 4; i++) {
//             var meshOptions = {}
//             if (i == 3 || i == 0) {
//                 meshOptions.transparent = true;
//                 meshOptions.opacity = 0;
//             } else {
//                 // meshOptions.map = texture;
//                 // meshOptions.color = 'blue'
//                 meshOptions.map = new THREE.TextureLoader().load("/images/velvet2.jpg")
                
//             } 
//             var eWall = new THREE.Mesh(
//                 new THREE.BoxGeometry(escalationCooridorDim, elevatorHeight, 0.1),
//                 new THREE.MeshBasicMaterial(meshOptions)
//             );
            
//             // Position each wall based on index
//             if (i == 0) {
//                 eWall.position.set(
//                     eFloor.position.x, 
//                     this.centerPoint.y + elevatorHeight / 2 + this.offsetY, 
//                     eFloor.position.z + escalationCooridorDim / 2
//                 ); // Front wall
//             }
//             if (i == 1) {
//                 const wallGeometry = new THREE.BoxGeometry(escalationCooridorDim, elevatorHeight, 0.1);
//                 const wallBrush = new Brush(wallGeometry);
//                 wallBrush.position.set(
//                     eFloor.position.x, 
//                     this.centerPoint.y + elevatorHeight / 2 + this.offsetY, 
//                     eFloor.position.z - escalationCooridorDim / 2 + .1
//                 );
//                 wallBrush.updateMatrixWorld();

//                 // Create the door as a Brush
//                 const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.1); // Door size
//                 const doorBrush = new Brush(doorGeometry);
//                 doorBrush.position.set(
//                     eFloor.position.x, 
//                     this.centerPoint.y + this.wallHeight / 2, 
//                     eFloor.position.z - escalationCooridorDim / 2 + .1
//                 );
//                 doorBrush.updateMatrixWorld();

//                 // Perform the CSG subtraction to create a door in the wall
//                 const evaluator = new Evaluator();
//                 const finalWallGeometry = evaluator.evaluate(wallBrush, doorBrush, SUBTRACTION);

//                 // Convert the result back into a Mesh
//                 eWall = new THREE.Mesh(finalWallGeometry.geometry, new THREE.MeshStandardMaterial(meshOptions));
                
                
//             }
//             if (i == 2) {
//                 eWall.position.set(
//                     eFloor.position.x - escalationCooridorDim / 2 + .1, 
//                     this.centerPoint.y + elevatorHeight / 2 + this.offsetY, 
//                     eFloor.position.z
//                 ); // Left wall
//                 eWall.rotation.y = Math.PI / 2; // Rotate left wall by 90 degrees
//             }
//             if (i == 3) {
//                 eWall.position.set(
//                     eFloor.position.x + escalationCooridorDim / 2, 
//                     this.centerPoint.y + elevatorHeight / 2 + this.offsetY, 
//                     eFloor.position.z
//                 ); // Right wall
//                 eWall.rotation.y = Math.PI / 2; // Rotate right wall by 90 degrees
//             }

//             this.elevator.push(eWall)

//             scene.add(eWall);
//             this.parts.push(eWall);
//         }

//         var buttonPlate = new THREE.Mesh(
//             new THREE.PlaneGeometry(.3, .8),
//             new THREE.MeshStandardMaterial({
//                 color: 'gold',
//                 metalness: 1,
//                 side: THREE.DoubleSide
//             })
//         );

//         buttonPlate.position.set(eFloor.position.x - escalationCooridorDim / 2 + .19, this.centerPoint.y + 2.5, eFloor.position.z)
//         buttonPlate.rotation.y = Math.PI / 2;

//         this.elevator.push(buttonPlate);
//         scene.add(buttonPlate);

//         var elevatorPointLight = new THREE.PointLight(0xffffff, 25, 5);
//         this.elevator.push(elevatorPointLight)
//         elevatorPointLight.position.set(
//             this.houseDim[0] / 2 - escalationCooridorDim / 2, 
//             this.centerPoint.y + elevatorHeight + 1,  // Y position (at ceiling height)
//             this.houseDim[1] / 2 - escalationCooridorDim / 2
//         )
//         scene.add(elevatorPointLight)
//         var elevatorLightViz = new THREE.Mesh(
//             new THREE.SphereGeometry(.3, 10, 10),
//             new THREE.MeshBasicMaterial({
//                 color: 0xffffff
//             })
//         );
//         this.elevator.push(elevatorLightViz)
//         elevatorLightViz.position.copy(elevatorPointLight.position)
//         scene.add(elevatorLightViz)

//         var plateHeight = 0.7;
//         var buttonSpacing = plateHeight / 12;  // Distance between each button
//         var plateCenterY = buttonPlate.position.y;  // Center of the plate along y-axis

//         var activeButtonLight = new THREE.PointLight(0xffffff, .05, 5);
//         activeButtonLight.name = 'active-button-light'
//         this.elevator.push(activeButtonLight)

//         for (var i = 0; i < 13; i++) {
//             var button = new THREE.Mesh(
//                 new THREE.CircleGeometry(.025, 20, 20),
//                 new THREE.MeshStandardMaterial({
//                     color: 'gray',
//                     transparent: true,
//                     opacity: 0.7
//                 })
//             );
//             button.name = 'elevator-button';
//             button.floor = i;
//             button.position.set(
//                 buttonPlate.position.x + .01,  // x position, you can adjust it if needed
//                 plateCenterY - plateHeight / 2 + i * buttonSpacing,  // y position, spacing the buttons evenly
//                 this.houseDim[1] / 2 - escalationCooridorDim / 2      // z position
//             );
//             button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
//             button.rotation.y = Math.PI / 2
//             if (!i) {
//                 activeButtonLight.position.copy(button.position);
//                 scene.add(activeButtonLight)
//                 button.material.color.set('white')
//             }
//             this.elevator.push(button)
//             scene.add(button);
//         }






//         console.log("elevator built~")



//         console.log('lighting the levels bottom-up') 

//         var createDecorativeWall = (foundation, width, times = 1) => {
//             console.log("Building decorative wall...");

//             // Define the wall dimensions
//             const wallHeight = this.wallHeight * 3 * times; // Example: 3 floors tall
//             const wallWidth = width; // Example wall width
//             const wallThickness = 0.3; // Example thickness

//             // Create the base wall geometry
//             const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
//             const wallBrush = new Brush(wallGeometry);
//             wallBrush.position.set(
//                 foundation.position.x,
//                 this.centerPoint.y + wallHeight / 2 + this.offsetY,
//                 foundation.position.z
//             );
//             wallBrush.updateMatrixWorld();

//             // Create cutouts for windows at varying heights and sizes
//             const evaluator = new Evaluator();
            
//             // Create small windows at level 1
//             const window1Geometry = new THREE.BoxGeometry(0.5, 0.5, wallThickness + 0.1); // Small square window
//             const window1Brush = new Brush(window1Geometry);
//             window1Brush.position.set(foundation.position.x, this.centerPoint.y + wallHeight / 6, foundation.position.z);
//             window1Brush.updateMatrixWorld();
            
//             // Create larger windows at level 2
//             const window2Geometry = new THREE.BoxGeometry(1, 1, wallThickness + 0.1); // Larger window
//             const window2Brush = new Brush(window2Geometry);
//             window2Brush.position.set(foundation.position.x, this.centerPoint.y + wallHeight / 2, foundation.position.z);
//             window2Brush.updateMatrixWorld();

//             // Create small circular window at level 3
//             const window3Geometry = new THREE.CylinderGeometry(0.3, 0.3, wallThickness + 0.1, 32); // Circular window
//             const window3Brush = new Brush(window3Geometry);
//             window3Brush.rotation.x = Math.PI / 2; // Rotate cylinder to face forward
//             window3Brush.position.set(foundation.position.x, this.centerPoint.y + wallHeight * 5 / 6, foundation.position.z);
//             window3Brush.updateMatrixWorld();

//             // Perform the CSG subtraction to create the windows in the wall
//             let finalWallGeometry = evaluator.evaluate(wallBrush, window1Brush, SUBTRACTION);
//             finalWallGeometry = evaluator.evaluate(finalWallGeometry, window2Brush, SUBTRACTION);
//             finalWallGeometry = evaluator.evaluate(finalWallGeometry, window3Brush, SUBTRACTION);

//             let texture = new THREE.TextureLoader().load("/images/wallpaper3.jpg")
//             texture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
//             texture.wrapT = THREE.RepeatWrapping;
//             // Convert the result back into a Mesh
//             const decorativeWall = new THREE.Mesh(
//                 finalWallGeometry.geometry, 
//                 new THREE.MeshStandardMaterial({ 
//                     map: texture,
//                     side: THREE.DoubleSide,
//                     transparent: true,
//                     opacity: 0.63
//                 }));
            
//             scene.add(decorativeWall); // Add the wall with cutouts to the scene

//             this.parts.push(decorativeWall)

//             return decorativeWall
//         }


//         var createGlassWall = (foundation, width, iterations = 11, withBottom = true, i) => {
//             console.log("Building glass wall...");
//             var result = []



//             // Define the glass wall dimensions
//             const wallHeight = this.wallHeight * 3 / 11; // Example: 3 floors tall
//             const wallWidth = width; // Example wall width
//             const wallThickness = 0.1; // Thin thickness to represent glass

//             // Create the base glass wall geometry (using a thin BoxGeometry to create a pane of glass)
//             const glassGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
            
//             let glassOptions = {
//                 color: 0xA1C1E0, // Light blueish tint for glass
//                 opacity: 0.65, // Semi-transparent
//                 transparent: true, // Enable transparency
//                 roughness: 0.1, // Low roughness for a smoother glass look
//                 metalness: 0, // No metal effect
//             }
//             var txtr = new THREE.TextureLoader().load(`/images/trees/foliage/textures/foliage-7.jpg`);

//             // Set texture wrapping to repeat
//             txtr.wrapS = THREE.RepeatWrapping; // Horizontal wrapping
//             txtr.wrapT = THREE.RepeatWrapping; // Vertical wrapping if needed

//             // Set the number of repetitions (for example, repeat 4 times horizontally)
//             txtr.repeat.set(randomInRange(11, 36), randomInRange(1, 7)); // Repeat 4 times in the X direction (columns), 1 time in the Y direction


//             // Apply the texture to the glass material
//             glassOptions.map = txtr;

//             // Create transparent material for the glass
//             const glassMaterial = new THREE.MeshStandardMaterial(glassOptions);

//             // Create the glass wall mesh
//             const glassWall = new THREE.Mesh(glassGeometry, glassMaterial);
//             glassWall.position.set(
//                 foundation.position.x,
//                 this.centerPoint.y + wallHeight / 2 + this.offsetY,
//                 foundation.position.z
//             );

//             // Add the glass wall to the scene
//             scene.add(glassWall);
//             this.parts.push(glassWall);

//             // Optionally, you can add a metal frame or borders around the glass
//             const frameThickness = 0.01; // Example frame thickness
//             const frameMaterial = new THREE.MeshStandardMaterial({
//                 color: 0xffffff, // Dark gray for the frame
//                 opacity: 0.5,
//                 transparent: true,
//                 metalness: 0.8, // Add metallic properties to the frame
//                 roughness: 1,
//             });

//             // Create a border frame around the glass
//             const topFrameGeometry = new THREE.BoxGeometry(wallWidth + frameThickness, frameThickness, wallThickness);
//             const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
//             topFrame.position.set(foundation.position.x, glassWall.position.y + wallHeight / 2, foundation.position.z);
//             scene.add(topFrame);
//             this.parts.push(topFrame);

//             let bottomFrame = new THREE.Mesh(topFrameGeometry, frameMaterial)
//             if (withBottom) {
//                 bottomFrame.position.set(foundation.position.x, glassWall.position.y - wallHeight / 2, foundation.position.z);
//                 scene.add(bottomFrame);
//                 this.parts.push(bottomFrame);
//             }

//             const sideFrameGeometry = new THREE.BoxGeometry(frameThickness, wallHeight, wallThickness);
//             const leftFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
//             leftFrame.position.set(foundation.position.x - wallWidth / 2, glassWall.position.y, foundation.position.z);
//             scene.add(leftFrame);
//             this.parts.push(leftFrame);

//             const rightFrame = new THREE.Mesh(sideFrameGeometry, frameMaterial);
//             rightFrame.position.set(foundation.position.x + wallWidth / 2, glassWall.position.y, foundation.position.z);
//             scene.add(rightFrame);
//             this.parts.push(rightFrame);

//             // // Add random latticework bars across the wall (geometric lattice)
//             // const latticeMaterial = new THREE.MeshStandardMaterial({
//             //     color: 0x4F4F4F, // Same material for latticework
//             //     metalness: 0.8,
//             //     roughness: 0.2,
//             // });

//             // const latticeCount = 10; // Number of random lattice bars
//             // for (let i = 0; i < latticeCount; i++) {
//             //     const latticeThickness = 0.05; // Thin bars for the lattice
//             //     const latticeGeometry = new THREE.BoxGeometry(
//             //         Math.random() * wallWidth * 0.8 + wallWidth * 0.2, // Random width of the lattice
//             //         latticeThickness, // Thin bar
//             //         wallThickness
//             //     );
                
//             //     const lattice = new THREE.Mesh(latticeGeometry, latticeMaterial);

//             //     // Randomly position the lattice
//             //     const randomX = foundation.position.x - wallWidth / 2 + Math.random() * wallWidth;
//             //     const randomY = this.centerPoint.y + Math.random() * wallHeight - wallHeight / 2;
                
//             //     lattice.position.set(randomX, randomY, foundation.position.z);
                
//             //     // Randomly rotate the lattice for an abstract pattern
//             //     lattice.rotation.z = Math.random() * Math.PI * 2;

//             //     // Add the lattice to the scene
//             //     scene.add(lattice);
//             //     result.push(lattice)
//             //     this.parts.push(lattice);
//             // }

//             return [...result, glassWall, topFrame, bottomFrame, leftFrame, rightFrame];
//         }



//         var createCastleWall = (foundation, width) => {
//             console.log("Building castle wall...");

//             // Define the castle wall dimensions
//             const wallHeight = this.wallHeight * 3; // Example: 3 floors tall
//             const wallWidth = width; // Example width
//             const wallThickness = 1; // Thicker than the other walls to represent stone
//             const crenellationHeight = wallHeight * 0.1; // Height of the crenellations
//             const crenellationWidth = wallWidth * 0.2; // Width of each crenellation gap
//             const crenellationGap = crenellationWidth * 0.5; // Gap between each crenellation

//             // Create the base castle wall geometry (without the crenellations)
//             const castleWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
//             const castleWallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B5A2B }); // Brownish for stone

//             const castleWall = new THREE.Mesh(castleWallGeometry, castleWallMaterial);
//             castleWall.position.set(
//                 foundation.position.x,
//                 this.centerPoint.y + wallHeight / 2 + this.offsetY,
//                 foundation.position.z
//             );
//             scene.add(castleWall); // Add the base wall to the scene
//             this.parts.push(castleWall)

//             // Add crenellations to the top of the wall
//             const numCrenellations = Math.floor(wallWidth / (crenellationWidth + crenellationGap)); // Number of crenellations
//             for (let i = 0; i < numCrenellations; i++) {
//                 const crenellationGeometry = new THREE.BoxGeometry(crenellationWidth, crenellationHeight, wallThickness);
//                 const crenellation = new THREE.Mesh(crenellationGeometry, castleWallMaterial);
                
//                 const xOffset = i * (crenellationWidth + crenellationGap) - wallWidth / 2 + crenellationWidth / 2;
//                 crenellation.position.set(
//                     foundation.position.x + xOffset,
//                     this.centerPoint.y + wallHeight + crenellationHeight / 2 + this.offsetY,
//                     foundation.position.z
//                 );
//                 scene.add(crenellation); // Add each crenellation to the scene
//                 this.parts.push(crenellation)
//             }

//             // Optionally, you can add a texture to simulate stone blocks
//             const textureLoader = new THREE.TextureLoader();
//             const stoneTexture = textureLoader.load('/images/wall3.jpg'); // Replace with your texture path
//             castleWallMaterial.map = stoneTexture; // Apply texture to the wall material
//             castleWallMaterial.needsUpdate = true; // Ensure the material updates after adding texture

//             return castleWall
//         }

//         var createMossyWall = (foundation, width) => {
//             console.log("Building mossy wall with circular cutouts...");

//             // Define the wall dimensions
//             const wallHeight = this.wallHeight * 3; // Example: 3 floors tall
//             const wallWidth = width; // Example width
//             const wallThickness = 0.5; // Example thickness for a mossy stone wall

//             // Create the base wall geometry
//             const mossyWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
//             const mossyWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3E4A33 }); // Mossy greenish-brown color

//             // Apply a mossy texture if available
//             const textureLoader = new THREE.TextureLoader();
//             const mossTexture = textureLoader.load('/images/turf-wall.jpg'); // Replace with actual texture path
//             mossyWallMaterial.map = mossTexture;
//             mossyWallMaterial.needsUpdate = true;

//             // Create the mossy wall mesh
//             const mossyWall = new THREE.Mesh(mossyWallGeometry, mossyWallMaterial);
//             mossyWall.position.set(
//                 foundation.position.x,
//                 this.centerPoint.y + wallHeight / 2 + this.offsetY,
//                 foundation.position.z
//             );
//             scene.add(mossyWall); // Add the mossy wall to the scene
//             this.parts.push(mossyWall)

//             // Create circular window cutouts using CSG (Constructive Solid Geometry)
//             // const evaluator = new Evaluator();

//             // // Define circular cutouts (windows)
//             // const numWindows = 3; // Example: 3 circular windows
//             // const windowRadius = 0.8; // Radius of the circular windows
//             // const windowGap = wallHeight / (numWindows + 1); // Gap between windows
//             // for (let i = 0; i < numWindows; i++) {
//             //     // Create the circular window geometry directly as BufferGeometry (no need to convert)
//             //     const windowGeometry = new THREE.CylinderGeometry(windowRadius, windowRadius, wallThickness + 0.1, 32); 
//             //     const windowMesh = new THREE.Mesh(windowGeometry); // Create a mesh from the geometry

//             //     windowMesh.rotation.z = Math.PI / 2; // Rotate to face the front
//             //     windowMesh.updateMatrixWorld(); // Update the world matrix to account for transformations

//             //     // No need for conversion to BufferGeometry, as THREE.CylinderGeometry is already BufferGeometry
//             //     const windowBrush = new Brush(windowMesh.geometry); // Use Brush with BufferGeometry

//             //     // Position the windows at different heights
//             //     const yOffset = (i + 1) * windowGap - wallHeight / 2;
//             //     windowBrush.position.set(
//             //         foundation.position.x, 
//             //         this.centerPoint.y + yOffset + this.offsetY,
//             //         foundation.position.z
//             //     );
//             //     windowBrush.updateMatrixWorld();

//             //     // Perform the CSG subtraction to create the window cutouts in the wall
//             //     const finalGeometry = evaluator.evaluate(mossyWall, windowBrush, SUBTRACTION);
//             //     mossyWall.geometry = finalGeometry.geometry; // Update the wall geometry with the cutouts
//             // }



//             // Convert the result back into a Mesh and add to the scene
//             // mossyWall.geometry = finalGeometry.geometry;
//             // mossyWall.material = mossyWallMaterial;
//             scene.add(mossyWall); // Add the wall with circular cutouts to the scene
//         }


//         var side = 0
//         for (var wall_instructions of [
//             'decorative wall with cutout windows at 1 - 2 levels of varying sizes',
//             'a wall of glass',
//             'a castle wall',
//             'a mossy wall with circular window cutouts'
//         ]) {

//             // Function to build the elevator on top of the foundation
//             var _side = side++
//             var height = this.wallHeight * 3
//             console.log("Building on top of foundation...");

//             // Use houseDim for dimensions
//             const houseWidth = side % 2 == 0 ? this.houseDim[0] : this.houseDim[1];  // Width of the house/foundation
//             const houseLength = side % 2 == 0 ? this.houseDim[1] : this.houseDim[0]; // Length of the house/foundation


//             // // Example wall for the elevator shaft
//             // const wallGeometry = new THREE.BoxGeometry(houseWidth, height, 0.1); // Width of the wall is the house width
//             // const wallBrush = new Brush(wallGeometry);
//             // wallBrush.position.set(
//             //     foundation.position.x,  // X position matches the foundation's position
//             //     this.centerPoint.y + height / 2 + this.offsetY, // Center vertically on foundation
//             //     foundation.position.z - houseLength / 2 + 0.1 // Z position based on foundation's length
//             // );
//             // wallBrush.updateMatrixWorld();

//             // // Example door cutout in the wall
//             // const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.1); // Door size
//             // const doorBrush = new Brush(doorGeometry);
//             // doorBrush.position.set(
//             //     foundation.position.x,  // X position matches foundation
//             //     this.centerPoint.y + this.wallHeight / 2,  // Center door on wall's height
//             //     foundation.position.z - houseLength / 2 + 0.1 // Same Z as the wall
//             // );
//             // doorBrush.updateMatrixWorld();

//             // // Perform the CSG subtraction to create a door in the wall
//             // const evaluator = new Evaluator();
//             // const finalWallGeometry = evaluator.evaluate(wallBrush, doorBrush, SUBTRACTION);

//             // // Convert the result back into a Mesh
//             // const eWall = new THREE.Mesh(finalWallGeometry.geometry, new THREE.MeshStandardMaterial({ color: 0x808080 }));
            


//             var walls = []


//             switch (wall_instructions) {
//                 case 'decorative wall with cutout windows at 1 - 2 levels of varying sizes':
//                     var aDecorativeWall = createDecorativeWall(foundation, this.houseDim[0]);
//                     aDecorativeWall.position.z += this.houseDim[1] / 2
                    
//                     walls.push(aDecorativeWall)
//                     break;
//                 case 'a wall of glass':
//                     var aDecorativeWall = createDecorativeWall(foundation, this.houseDim[1]);
//                     aDecorativeWall.position.x += this.houseDim[0] / 2
//                     aDecorativeWall.rotation.y += Math.PI / 2
                    
//                     walls.push(aDecorativeWall)
//                     break;
//                 case 'a castle wall':
//                     var aDecorativeWall = createDecorativeWall(foundation, this.houseDim[0]);
//                     aDecorativeWall.position.z -= this.houseDim[1] / 2
//                     aDecorativeWall.rotation.y += -Math.PI 
                    
//                     walls.push(aDecorativeWall)
//                     break;
//                 case 'a mossy wall with circular window cutouts':
//                     var aDecorativeWall = createDecorativeWall(foundation, this.houseDim[1]);
//                     aDecorativeWall.position.x -= this.houseDim[0] / 2
//                     aDecorativeWall.rotation.y = -Math.PI / 2
//                     walls.push(aDecorativeWall)
//                     break;
//             }

//             for (var i = 0; i < walls.length; i++) {
//                 const glassBoundingBox = new THREE.Box3().setFromObject(walls[i]);

//                 // Access foliage objects from the trees
//                 window.terrain.trees.map(tree => tree.foliage).forEach(foliage => {
//                     const foliageBoundingBox = new THREE.Box3().setFromObject(foliage);

//                     // Check if the foliage intersects with the glass bounding box
//                     if (glassBoundingBox.intersectsBox(foliageBoundingBox)) {

//                         // Get the foliage geometry (assuming it is a BufferGeometry)
//                         const foliageGeometry = foliage.geometry;
//                         foliageGeometry.computeBoundingBox();

//                         // Access foliage vertices to subtract the out-of-bounds ones
//                         const vertices = foliageGeometry.attributes.position;
//                         const vertex = new THREE.Vector3();

//                         for (let j = 0; j < vertices.count; j++) {
//                             vertex.fromBufferAttribute(vertices, j);

//                             // Check if the vertex is inside the glass bounding box in the XZ plane
//                             if (vertex.x > glassBoundingBox.min.x && vertex.x < glassBoundingBox.max.x &&
//                                 vertex.z > glassBoundingBox.min.z && vertex.z < glassBoundingBox.max.z) {
                                
//                                 // If the vertex is inside the glass wall bounds, "collapse" it vertically
//                                 // You could set it to the height of the glass or move it outside the bounds
//                                 vertex.y = glassBoundingBox.min.y;  // Collapsing the vertex to ground level, adjust as needed

//                                 // Alternatively, move the vertex outside the glass bounds in the XZ plane
//                                 // vertex.x = glassBoundingBox.min.x - someOffset;  // Example of repositioning

//                                 // Or completely remove/skip the vertex (if removing is supported by your setup)
//                             }

//                             // Update the vertex positions
//                             vertices.setXYZ(j, vertex.x, vertex.y, vertex.z);
//                         }

//                         // Mark geometry as needing an update
//                         foliageGeometry.attributes.position.needsUpdate = true;
//                     }
//                 });
//             }




            
            


        
//         }



//     }

}



class Terrain {
    // map
    // Grass
    constructor(options) {
        switch (options.user.level) {
        case LEVEL[1]:
            this.Grass = [
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
                new THREE.Color(0x00ff00),
            ]
            let _textures = options.map[options.user.level].textures;
            for (var key in _textures) {
                _textures[key] = _textures[key].map(t => new THREE.TextureLoader().load(t));
            }
            this.textures =  _textures;
            this.vertices = new Map();
            this.meshes = [];
            this.markers = {};
            this.surroundingCenters = [];
            this.currentMesh = 0;
            this.center = new THREE.Vector3(0, 0, 0);
            this.generate();
            break;
        default:
            return;
        }
    }

    init() {
        this.generate();
    }

    getSurroundingTriangles(point) {
        let surroundingTriangles = [];

        // Iterate through all grounds to find triangles that surround the given point
        this.grounds.forEach(ground => {
            const triangle = ground.triangle;

            // Check if the point lies inside the triangle using a point-in-triangle check
            if (this.isPointNearTriangle(point, triangle)) {
                surroundingTriangles.push(ground);
            }
        });

        return surroundingTriangles;
    }

    // Helper function to check if a point is near or inside a triangle
    isPointNearTriangle(point, triangle) {
        // Calculate barycentric coordinates or use distance-based checks
        const { a, b, c } = triangle;

        // Check if point is near any of the triangle's vertices or edges
        const distanceThreshold = 20; // Define a threshold distance to consider "near"
        const distToA = point.distanceTo(a);
        const distToB = point.distanceTo(b);
        const distToC = point.distanceTo(c);

        // If the point is within a certain distance of any vertex, we consider it "near" the triangle
        return (distToA < distanceThreshold || distToB < distanceThreshold || distToC < distanceThreshold);
    }



    generate(centerX = 0, centerY = 0, centerZ = 0) {
        const centerKey = `${centerX}_${centerZ}`;
        this.terrainType = 'dense'//['sparse', 'dense', 'half'][Math.floor(Math.random() * 3)];
        for (var i = 0; i < this.meshes.length; i++) {
            if (this.meshes[i].centerKey == centerKey) {
                debugger
            }
        }
        
        this.cliffs = [];
        this.grounds = [];
        this.grassTriangles = [];
        this.cliffMeshes = [];

        let t = VM.map[VM.user.level].quadrant;
        let center = { x: centerX, y: centerY, z: centerZ }

        let v0 = { x: center.x - t, y: center.y, z: center.z + t };
        let v1 = { x: center.x + t, y: center.y, z: center.z + t }; 
        let v2 = { x: center.x + t, y: center.y, z: center.z - t }; 
        let v3 = { x: center.x - t, y: center.y, z: center.z - t };

        let vertices = [];
        let indices = [];

        for (var key in VM.map[VM.user.level]) {
            this[key] = VM.map[VM.user.level][key];
        }

        const segmentSize = 1 / this.segments;
        this.groundColorMap = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(0));  // Initialize ground color map


        const neighbors = this.meshes.filter(mesh => this.isNeighbor(mesh.centerKey, centerKey));

        if (neighbors.length > 0) {
            var generationRootSlices = this.getRootSlices(centerKey, neighbors);
            for (var obj of generationRootSlices) {
                this.renderNoiseSlice(obj, this.width, this.height, center); 
            }
            
        }
        let perlinNoise = this.generatePerlinNoise({ center, centerKey });

        // let woodTerrain = this.generateRandomWoodsTerrain();

        // Generate vertices and initial setup
        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = i * segmentSize;
                let y = j * segmentSize;

                let v = new THREE.Vector3();
                v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
                v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
                v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

                let noiseX = Math.floor(x * (this.noiseWidth - 1));
                let noiseY = Math.floor(y * (this.noiseHeight - 1));
                let variance = perlinNoise[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;
                //let variance = woodTerrain[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;;

                v.y += variance;

                var inCastle = v.x > -45 && v.x < 45 && v.z > -30 && v.z < 30
                if (inCastle) {
                    v.y = 0
                }

                if ([v.x, v.y, v.z].some(isNaN)) {
                    debugger
                }
                vertices.push(v.x, v.y, v.z);
            }
        }


        for (var m of this.meshes) {
            for (var x1 = 0; x1 < m.geometry.attributes.position.array.length; x1 += 3) { 
                for (var x2 = 0; x2 < vertices.length; x2 += 3) {
                    var sameX = m.geometry.attributes.position.array[x1] == vertices[x2];
                    var sameZ = m.geometry.attributes.position.array[x1 + 2] == vertices[x2 + 2];
                    var differentY = m.geometry.attributes.position.array[x1 + 1] == vertices[x2 + 1]

                    if (sameX && sameZ && differentY) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];

                    } 
                    else if (sameX && Math.abs(m.geometry.attributes.position.array[x1 + 2] - vertices[x2 + 2]) < 2) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];
                    } else if (sameZ && Math.abs(m.geometry.attributes.position.array[x1] - vertices[x2]) < 2) {
                        vertices[x2 + 1] = m.geometry.attributes.position.array[x1 + 1];
                    }
                }
            }
        }


        var grassPatches = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(false));  // Initialize an array to track grass patches
        
        
        switch (this.terrainType) {
            case 'dense':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.09;
                        }
                    }
                }
                break;
            case 'sparse':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.009;
                        }
                    }
                }
                break;
            case 'half':
                for (let i = 0; i < this.segments; i++) {
                    for (let j = 0; j < this.segments; j++) {
                        for (var k = 0; k < 3; k++) {
                            grassPatches[i][j] = Math.random() < 0.05;
                        }
                    }
                }
                break;
                        
        }

        console.log('shouldnt be more than ' + this.segments * this.segments + ' trees')

        var start_i = 1.0;
        // Process triangles and apply grass in defined ranges
        for (let i = 0; i < this.segments; i++) {
            if (new Number(i / this.segments).toFixed(1) != start_i) {
                start_i = new Number((i + 1) / this.segments).toFixed(2);
                console.log(start_i)
            }
            for (let j = 0; j < this.segments; j++) {
                let a = i + j * (this.segments + 1);
                let b = (i + 1) + j * (this.segments + 1);
                let c = (i + 1) + (j + 1) * (this.segments + 1);
                let d = i + (j + 1) * (this.segments + 1);
                let x = i * segmentSize;
                let y = j * segmentSize;

                let v = new THREE.Vector3();
                v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
                v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
                v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

                var inCastle = v.x > -50 && v.x < 50 && v.z > -35 && v.z < 35

                var isNearGrassPatch = false && !inCastle/*(grassPatches[i][j] || 
                                          (i > 0 && grassPatches[i - 1][j]) ||  // Check left
                                          (i < this.segments && grassPatches[i + 1][j]) ||  // Check right
                                          (j > 0 && grassPatches[i][j - 1]) ||  // Check above
                                          (j < this.segments && grassPatches[i][j + 1]) ||  // Check below
                                          (i > 0 && j > 0 && grassPatches[i - 1][j - 1]) ||  // Check top-left diagonal
                                          (i < this.segments && j > 0 && grassPatches[i + 1][j - 1]) ||  // Check top-right diagonal
                                          (i > 0 && j < this.segments && grassPatches[i - 1][j + 1]) ||  // Check bottom-left diagonal
                                          (i < this.segments && j < this.segments && grassPatches[i + 1][j + 1])  // Check bottom-right diagonal
                );*/


                const isTree = false && eval(this.treeCondition);

                if (a >= 0 && b >= 0 && c >= 0 && d >= 0 && a < vertices.length / 3 && b < vertices.length / 3 && c < vertices.length / 3 && d < vertices.length / 3) {
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                    

                    const t1 = TriangleMesh(vertices, a, b, d, this.width, this.height);
                    const t2 = TriangleMesh(vertices, b, c, d, this.width, this.height);

                    [t1, t2].forEach((triangle) => {
                        VM.map[VM.user.level].grounds.push(triangle);

                        const normal = triangle.normal;
                        const slope = Math.atan2(normal.y, normal.x);

                        const isCliff = slope > 0.5 || slope < -0.5;
                        
                        //
                        // Grasses!
                        //
                        if (isNearGrassPatch) {
                            triangle.material.opacity = randomInRange(0.001, 0.5);
                            triangle.material.color.set(this.Grass[Math.floor(Math.random() * this.Grass.length)]);

                            const grassResult = this.createGrassPatch(indices, vertices, triangle);

                            VM.map[VM.user.level].grasses.push(grassResult);

                        }
                        //
                        // Trees!
                        //

                        if (false) {
                            var tree = this.createTree(triangle.triangle.a.x, triangle.triangle.a.y, triangle.triangle.a.z, 1);
                            VM.map[VM.user.level].trees.push(tree);

                             
                        }

                        //
                        // Cliffs!
                        //

                        if (isCliff) {
                            this.cliffs.push(triangle.triangle);
                        }
                    });

                    
                }
            }


        }

        
        // Now, let's apply the grass density in groundColorMap to color the vertices
        const colors = [];
        const gridSize = this.groundColorMap.length;  // Assuming groundColorMap is a 2D array of the grid size

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const density = this.groundColorMap[i][j];

                // Ensure that color application and grass application use the same coordinates
                const vertexIndex = i * (this.segments + 1) + j;  // Adjust based on segment count and grid

                if (vertexIndex < vertices.length / 3) {  // Ensure vertex index is within bounds
                    if (density > 0) {
                        // More grass means more green intensity
                        const greenIntensity = Math.min(0.8, Math.pow(density / 10, 0.7));  // Non-linear scaling for green intensity
                        const red = randomInRange(0, 0.2);  // Slightly larger range for red
                        const blue = randomInRange(0, 0.2);  // Slightly larger range for blue

                        colors.push(red, greenIntensity, blue);  // Push RGB color with more balanced variation

                    } else {
                        // No grass means brown soil
                        colors.push(randomInRange(0.1, 0.3), randomInRange(0.11, 0.15), randomInRange(0, 0.08));  // RGB color for dark brown soil
                    }
                }
            }
        }


        // Create red spheres at boundary positions
        const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // ... rest of the existing code ...

        // Add this method to the Terrain class
        

        this.colors = colors;
        this.gridSize = gridSize;

        // Apply vertex colors to the geometry
        const planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));  // Add vertex colors
        planeGeometry.setIndex(indices);
        planeGeometry.computeVertexNormals();
        planeGeometry.computeBoundingBox();

        // Apply the custom texture to the terrain
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,  // Enable vertex colors
            side: THREE.DoubleSide,
            wireframe: false,
            transparent: true,
            opacity: 0.5
        });

        const mesh = new THREE.Mesh(planeGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mesh = mesh;
        this.mesh.name = "terrain"
        this.mesh.noise = perlinNoise;

        this.mesh.centerKey = centerKey;

        scene.add(mesh);

       
        this.meshes.push(this.mesh);

        console.log("there are " + this.trees.length + " trees")
        // Now, let's find surrounding triangles and place additional trees
        // this.trees.forEach(tree => {
        //     let surroundingTriangles = this.getSurroundingTriangles(tree.trunk.position);
        //     surroundingTriangles.forEach((surroundingTriangle) => {

        //         var surroundingTree = this.createTree(
        //             surroundingTriangle.triangle.a.x,
        //             surroundingTriangle.triangle.a.y,
        //             surroundingTriangle.triangle.a.z,
        //             0.8 // Slightly smaller trees surrounding the main one
        //         );
        //         VM.map[VM.user.level].trees.push(surroundingTree);
                
        //     });
        // })

        return this;
    }
    

    getRootSlices(centerKey, neighbors) {
        let q = this.quadrant * 2;
        const slices = [];
        const [currentX, currentZ] = centerKey.split("_").map(Number);
    
        neighbors.forEach(neighbor => {
            const neighborNoise = neighbor.noise; // Assuming noise is stored in a property
            const [neighborX, neighborZ] = neighbor.centerKey.split("_").map(Number);
            const width = q; 
            const height = q;
    
            if (neighborX === currentX && neighborZ === currentZ - q) { // Neighbor is above
                const slice = [];
                for (let col = 0; col < width; col++) {
                    slice.push(neighborNoise[col]); // Top row of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(0, 0, 1) }); // Direction from neighbor to center
            } else if (neighborX === currentX && neighborZ === currentZ + q) { // Neighbor is below
                const slice = [];
                for (let col = 0; col < width; col++) {
                    slice.push(neighborNoise[(height - 1) * width + col]); // Bottom row of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(0, 0, -1) }); // Direction from neighbor to center
            } else if (neighborX === currentX + q && neighborZ === currentZ) { // Neighbor is to the left
                const slice = [];
                for (let row = 0; row < height; row++) {
                    slice.push(neighborNoise[row * width]); // Left column of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(1, 0, 0) }); // Direction from neighbor to center
            } else if (neighborX === currentX - q && neighborZ === currentZ) { // Neighbor is to the right
                const slice = [];
                for (let row = 0; row < height; row++) {
                    slice.push(neighborNoise[row * width + (width - 1)]); // Right column of neighbor
                }
                slices.push({ slice, direction: new THREE.Vector3(-1, 0, 0) }); // Direction from neighbor to center
            }
        });
    
        return slices;
    }
 

    renderNoiseSlice({ slice, direction }, width, height, center) {
        const segmentSize = 1; // Adjust based on your grid spacing
        const centerX = center.x;
        const centerZ = center.z;
    
        if (direction.equals(new THREE.Vector3(0, 0, -1))) { // Neighbor is below
            for (let col = 0; col < width; col++) {
                const noiseValue = slice[col];
                const x = (centerX * width + col - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = centerZ + this.quadrant; // Top row
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0xff0000 })
                );
                console.log('neighbor below', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(0, 0, 1))) { // Neighbor is above
            for (let col = 0; col < width; col++) {
                const noiseValue = slice[col];
                const x = (centerX * width + col - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = centerZ - this.quadrant; // Bottom row
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
                );
    
                console.log('neighbor above', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(1, 0, 0))) { // Neighbor is to the left
            for (let row = 0; row < height; row++) {
                const noiseValue = slice[row];
                const x = (centerX + this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = (centerZ * height + row - this.quadrant) * segmentSize;
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0x0000ff })
                );
                console.log('neighbor left', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        } else if (direction.equals(new THREE.Vector3(-1, 0, 0))) { // Neighbor is to the right
            for (let row = 0; row < height; row++) {
                const noiseValue = slice[row];
                const x = (centerX - this.quadrant) * segmentSize;
                const y = noiseValue * this.altitudeVariance; // Assuming noiseValue represents height
                const z = (centerZ * height + row - this.quadrant) * segmentSize;
    
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 32, 32),
                    new THREE.MeshBasicMaterial({ color: 0xffff00 })
                );
                console.log('neighbor right', x, y, z);
                sphere.position.set(x, y, z);
                scene.add(sphere);
            }
        }
    }
    
    determineGrassClusters() {
        const clusters = [];
        const visited = new Set();
    
        const shareEdge = (t1, t2) => {
            const t1Vertices = [t1.a, t1.b, t1.c];
            const t2Vertices = [t2.a, t2.b, t2.c];
            let sharedVertices = 0;
            for (let v of t1Vertices) {
                if (t2Vertices.some(v2 => v.distanceTo(v2) < 0.001)) {
                    sharedVertices++;
                }
            }
            return sharedVertices >= 2;
        };
    
        const findCluster = (startTriangle) => {
            const cluster = [];
            const queue = [startTriangle];
            
            while (queue.length > 0) {
                const currentTriangle = queue.shift();
                if (!visited.has(currentTriangle)) {
                    visited.add(currentTriangle);
                    cluster.push(currentTriangle);
    
                    for (const otherTriangle of this.grassTriangles) {
                        if (!visited.has(otherTriangle) && shareEdge(currentTriangle.triangle, otherTriangle.triangle)) {
                            queue.push(otherTriangle);
                        }
                    }
                }
            }
    
            return cluster;
        };
    
        const getPerimeterPoints = (cluster) => {
            const perimeterPoints = [];
            for (const triangle of cluster) {
                let neighborCount = 0;
                for (const otherTriangle of cluster) {
                    if (triangle !== otherTriangle && shareEdge(triangle.triangle, otherTriangle.triangle)) {
                        neighborCount++;
                    }
                }
                if (neighborCount < 3) {
                    perimeterPoints.push(triangle.triangle.a);
                    perimeterPoints.push(triangle.triangle.b);
                    perimeterPoints.push(triangle.triangle.c);
                }
            }
            return perimeterPoints;
        };
    
        for (const triangle of this.grassTriangles) {
            if (!visited.has(triangle)) {
                const newCluster = findCluster(triangle);
                if (newCluster.length > 0) {
                    const center = new THREE.Vector3(0, 0, 0);
                    let totalVertices = 0;
    
                    for (const t of newCluster) {
                        center.add(t.triangle.a);
                        center.add(t.triangle.b);
                        center.add(t.triangle.c);
                        totalVertices += 3;
                    }
    
                    if (totalVertices > 0) {
                        center.divideScalar(totalVertices);
                    }
    
                    const perimeterPoints = getPerimeterPoints(newCluster);
    
                    clusters.push({
                        center,
                        perimeterPoints
                    });
                }
            }
        }
    
        return clusters;
    }

    
    findClosestVertex(point, positionAttribute) {
        let closestIndex = -1;
        let closestDistance = Infinity;
    
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
            const distance = point.distanceTo(vertex);
    
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }
    
        return closestIndex;
    }

    findClosestVertex(position, vertices) {
        let closestIndex = -1;
        let closestDistance = Infinity;

        for (let i = 0; i < vertices.length / 3; i++) {
            const vertexPosition = new THREE.Vector3(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
            const distance = position.distanceTo(vertexPosition);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }
    
    updateGroundMaterial() {
        // Implement this method to update the ground material based on the new groundColorMap values
        // This might involve updating a texture or shader parameter
    }

    setSun(sun) {
        this.sun = sun;
    }

    generateRollingPerlinNoise() {
        const map = VM.map[VM.user.level];
        let octaveCount = map.octaveCount || 4;
        let amplitude = map.amplitude || 0.003;  // Slightly higher amplitude for rolling hills
        let persistence = map.persistence || 0.15;  // Moderate persistence for rolling terrain
        let whiteNoise = this.generateWhiteNoise();

        let smoothNoiseList = new Array(octaveCount);
        for (let i = 0; i < octaveCount; ++i) {
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise);
        }

        let perlinNoise = new Array(map.width * map.height);
        let totalAmplitude = 0;

        for (let i = octaveCount - 1; i >= 0; --i) {
            amplitude *= persistence;
            totalAmplitude += amplitude;

            for (let j = 0; j < perlinNoise.length; ++j) {
                perlinNoise[j] = perlinNoise[j] || 0;
                perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
            }
        }

        for (let i = 0; i < perlinNoise.length; ++i) {
            perlinNoise[i] /= totalAmplitude;
        }

        return perlinNoise;
    }

    generatePerlinNoiseV1(options = {}) {
        const map = VM.map[VM.user.level];

        let octaveCount = options.octaveCount || 4;
        let amplitude = options.amplitude || 0.05;
        let persistence = options.persistence || 0.1;
        let width = map.width;
        let height = map.height;
        let offsetX = 0;
        let offsetY = 0;
        let whiteNoise = this.generateWhiteNoise(width, height, offsetX, offsetY);
        let smoothNoiseList = new Array(octaveCount);

        for (let i = 0; i < octaveCount; ++i) {
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise, width, height);
        }
    
        let perlinNoise = new Array(width * height);
        let totalAmplitude = 0;
    
        for (let i = octaveCount - 1; i >= 0; --i) {
            amplitude *= persistence;
            totalAmplitude += amplitude;
    
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    let index = y * width + x;
                    perlinNoise[index] = perlinNoise[index] || 0;
                    perlinNoise[index] += smoothNoiseList[i][index] * amplitude;
                }
            }
        }
    
        for (let i = 0; i < perlinNoise.length; ++i) {
            perlinNoise[i] /= totalAmplitude;
        }
    
        return perlinNoise;
    }

    isNeighbor(centerKey1, centerKey2) {
        var q = this.quadrant * 2;
        const [x1, y1] = centerKey1.split("_").map(Number);
        const [x2, y2] = centerKey2.split("_").map(Number);
        return Math.abs(x1 - x2) <= q && Math.abs(y1 - y2) <= q;
    }

    generatePerlinNoise(options) {
        // Get the map for the user's level from the VM (some kind of virtual machine or game state)
        const map = VM.map[VM.user.level];

        // Define the number of octaves, which is basically how many layers of detail we'll add to the noise.
        // Each octave adds more fine detail to the noise, like going from big waves to little ripples.
        // If no value is passed in, it defaults to 4.
        let octaveCount = options.octaveCount || 5;

        // Define the initial amplitude. This controls how strong each layer (octave) of noise is.
        // The higher the amplitude, the more pronounced that layer will be.
        let amplitude = options.amplitude || 0.05;

        // Define persistence. This tells us how much the amplitude should decrease with each octave.
        // So each layer (octave) will have less and less influence as we add finer details.
        let persistence = options.persistence || 0.1;

        // Generate a "white noise" array. White noise is random, and it will be the base for all the smooth noise we generate later.
        // Think of it as the starting randomness, like rolling a dice for each pixel in the map.
        let whiteNoise = this.generateWhiteNoise();

        // Create an empty array to store the "smooth noise" layers.
        // We'll generate `octaveCount` smooth noise layers, which get finer and finer as the octaves go up.
        let smoothNoiseList = new Array(octaveCount);

        // Loop through each octave (from 0 to octaveCount-1) to generate and store smooth noise.
        for (let i = 0; i < octaveCount; ++i) {
            // Generate a smooth version of the white noise for this octave and store it.
            // Smooth noise is like white noise, but with gentler, less sharp changes between points.
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise);
        }

        // Get the width and height of the map.
        // This is important because we need to generate noise that fits exactly into this map size.
        const width = map.width;
        const height = map.height;

        // Create an array to hold the final Perlin noise for the entire map.
        // We initialize it with zeros. We'll add noise from all octaves to this array.
        let perlinNoise = new Array(width * height).fill(0); // Initialize with zeros

        // This will track the total amplitude we've added across all octaves.
        // We'll use this later to normalize the noise so it's not too strong.
        let totalAmplitude = 0;

        // Now we loop through each octave in reverse order (from high to low detail).
        for (let i = octaveCount - 1; i >= 0; --i) {
            // Reduce the amplitude for this octave by multiplying by persistence.
            // This makes each finer octave contribute less to the final noise.
            amplitude *= persistence;

            // Add this octave's amplitude to the totalAmplitude, so we can normalize it later.
            totalAmplitude += amplitude;

            // Now we add this octave's smooth noise to the Perlin noise.
            // For every point in the map (represented by perlinNoise[j]), we add smooth noise from this octave.
            for (let j = 0; j < perlinNoise.length; ++j) {
                // Multiply the smooth noise value by the amplitude and add it to the Perlin noise array.
                // This makes higher octaves (bigger details) have more influence, and lower octaves (finer details) have less.
                perlinNoise[j] += smoothNoiseList[i][j] * amplitude;
            }
        }

        // After combining all the octaves, the noise values may be too large or small.
        // So, we normalize the Perlin noise by dividing by the totalAmplitude.
        // This ensures the noise stays within a reasonable range (like between 0 and 1).
        for (let j = 0; j < perlinNoise.length; ++j) {
            // Divide each point in the Perlin noise by the total amplitude, so that everything sums up nicely.
            // We also make sure we don't divide by zero, by falling back to 1 if totalAmplitude is 0 (which is unlikely).
            perlinNoise[j] /= totalAmplitude || 1; // Prevent division by zero
        }

        // Finally, we return the Perlin noise, which can be used to generate terrain, textures, or other visual patterns.
        return perlinNoise;

    }

    generateWhiteNoise() {
        const noise = new Array(VM.map[VM.user.level].width * VM.map[VM.user.level].height);
        for (let i = 0; i < noise.length; ++i) {
            noise[i] = Math.random();
        }
        return noise;
    }

    generateSmoothNoise(octave, whiteNoise) {
        const map = VM.map[VM.user.level];
        var noise = new Array(map.width * map.height);
        var samplePeriod = Math.pow(2, octave);
        var sampleFrequency = 1 / samplePeriod;
        var noiseIndex = 0;
        for (var y = 0; y < map.height; ++y) {
          var sampleY0 = Math.floor(y / samplePeriod) * samplePeriod;
          var sampleY1 = (sampleY0 + samplePeriod) % map.height;
          var vertBlend = (y - sampleY0) * sampleFrequency;
          for (var x = 0; x < map.width; ++x) {
            var sampleX0 = Math.floor(x / samplePeriod) * samplePeriod;
            var sampleX1 = (sampleX0 + samplePeriod) % map.width;
            var horizBlend = (x - sampleX0) * sampleFrequency;

            // blend top two corners
            var top = this.interpolate(whiteNoise[sampleY0 * map.width + sampleX0], whiteNoise[sampleY1 * map.width + sampleX0], vertBlend);
            // blend bottom two corners
            var bottom = this.interpolate(whiteNoise[sampleY0 * map.width + sampleX1], whiteNoise[sampleY1 * map.width + sampleX1], vertBlend);
            // final blend
            noise[noiseIndex] = this.interpolate(top, bottom, horizBlend);
            noiseIndex += 1;
          }
        }
        return noise;
    }

    lerp(a, b, t) {
        return a * (1 - t) + b * t;
    }

    generateCellularNoise() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const noise = new Array(width * height).fill(0);
        
        // Initialize with random cells
        for (let i = 0; i < noise.length; i++) {
            noise[i] = Math.random() < 0.45 ? 1 : 0;
        }
        
        // Apply cellular automaton rules
        const iterations = 4;
        for (let iter = 0; iter < iterations; iter++) {
            const newNoise = [...noise];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(noise, x, y, width, height);
                    const i = y * width + x;
                    if (noise[i] === 1) {
                        newNoise[i] = (neighbors < 2 || neighbors > 3) ? 0 : 1;
                    } else {
                        newNoise[i] = (neighbors === 3) ? 1 : 0;
                    }
                }
            }
            noise.splice(0, noise.length, ...newNoise);
        }
        
        // Normalize to [0, 1] range
        return noise.map(v => v * Math.random());
    }

    generateRandomWoodsTerrain() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height).fill(0);
        
        // Step 1: Initialize with random seeds for groves
        const numSeeds = Math.floor(width * height * 0.005); // 0.5% of the area for fewer, larger groves
        for (let i = 0; i < numSeeds; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            terrain[y * width + x] = 1;
        }
        
        // Step 2: Grow groves using cellular automata
        const iterations = 6; // Increased iterations for larger groves
        for (let iter = 0; iter < iterations; iter++) {
            const newTerrain = [...terrain];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(terrain, x, y, width, height);
                    const i = y * width + x;
                    if (terrain[i] === 0 && neighbors >= 1 && Math.random() < 0.6) {
                        newTerrain[i] = 1;
                    }
                }
            }
            terrain.splice(0, terrain.length, ...newTerrain);
        }
        
        // Step 3: Create distance field for smooth transitions
        const distanceField = this.createDistanceField(terrain, width, height);
        
        // Step 4: Generate final terrain values with rolling hills
        const maxDistance = Math.max(...distanceField);
        return terrain.map((value, i) => {
            const normalizedDistance = distanceField[i] / maxDistance;
            
            // Use a sine function to create rolling hills
            const baseElevation = 0.3 + 0.4 * Math.sin(normalizedDistance * Math.PI);
            
            if (value === 1) {
                // Grove: Higher elevation with some variation
                return baseElevation + 0.2 + Math.random() * 0.1;
            } else {
                // Meadow: Lower elevation with gentle slopes
                return baseElevation + Math.random() * 0.05;
            }
        });
    }

    generateStructuredTerrain(centerX = 0, centerZ = 0, edges = null) {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height);
        
        // Step 1: Divide the terrain into regions
        const regions = this.divideIntoRegions(width, height);
        
        // Step 2: Assign base elevations to regions
        const baseElevations = {
            'high': 0.7,
            'medium': 0.5,
            'low': 0.3
        };
        
        // Step 3: Generate Perlin noise
        const noise = this.generatePerlinNoise(width, height);
        
        // Step 4: Combine regions with Perlin noise
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const region = regions[y][x];
                const baseElevation = baseElevations[region];
                const noiseValue = noise[i];
                
                // Combine base elevation with noise
                terrain[i] = baseElevation + noiseValue * 0.2; // Adjust 0.2 to control noise influence
            }
        }
        
        return terrain;
    }
    
    divideIntoRegions(width, height) {
        const regions = Array(height).fill().map(() => Array(width).fill('medium'));
        
        // Simple division into three vertical strips
        const thirdWidth = Math.floor(width / 3);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x < thirdWidth) {
                    regions[y][x] = 'low';
                } else if (x >= 2 * thirdWidth) {
                    regions[y][x] = 'high';
                }
            }
        }
        
        return regions;
    }
    
    generateValleyTerrain() {
        const width = VM.map[VM.user.level].width;
        const height = VM.map[VM.user.level].height;
        const terrain = new Array(width * height).fill(0);
        
        // Step 1: Initialize with random seeds for groves
        const numSeeds = Math.floor(width * height * 0.005); // 0.5% of the area for fewer, larger groves
        for (let i = 0; i < numSeeds; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            terrain[y * width + x] = 1;
        }
        
        // Step 2: Grow groves using cellular automata
        const iterations = 6;
        for (let iter = 0; iter < iterations; iter++) {
            const newTerrain = [...terrain];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const neighbors = this.countNeighbors(terrain, x, y, width, height);
                    const i = y * width + x;
                    if (terrain[i] === 0 && neighbors >= 1 && Math.random() < 0.6) {
                        newTerrain[i] = 1;
                    }
                }
            }
            terrain.splice(0, terrain.length, ...newTerrain);
        }
        
        // Step 3: Create distance field for smooth transitions
        const distanceField = this.createDistanceField(terrain, width, height);
        
        // Step 4: Generate final terrain values with rolling hills and valley incline
        const maxDistance = Math.max(...distanceField);
        return terrain.map((value, i) => {
            const x = i % width;
            const y = Math.floor(i / width);
            const normalizedDistance = distanceField[i] / maxDistance;
            
            // Create valley incline using sine waves
            const valleyIncline = Math.sin(x / width * Math.PI) * Math.sin(y / height * Math.PI);
            
            // Use a sine function to create rolling hills
            const baseElevation = 0.3 + 0.4 * Math.sin(normalizedDistance * Math.PI);
            
            // Combine rolling hills with valley incline
            const combinedElevation = baseElevation + 0.3 * valleyIncline;
            
            if (value === 1) {
                // Grove: Higher elevation with some variation
                return combinedElevation + 0.2 + Math.random() * 0.1;
            } else {
                // Meadow: Lower elevation with gentle slopes
                return combinedElevation + Math.random() * 0.05;
            }
        });
    }

    countNeighbors(grid, x, y, width, height) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + width) % width;
                const ny = (y + dy + height) % height;
                count += grid[ny * width + nx];
            }
        }
        return count;
    }
    
    createDistanceField(terrain, width, height) {
        const distanceField = new Array(width * height).fill(Infinity);
        const queue = [];
        
        // Initialize distance field
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (terrain[i] === 1) {
                    distanceField[i] = 0;
                    queue.push([x, y]);
                }
            }
        }
        
        // Flood fill to calculate distances
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const currentDist = distanceField[y * width + x];
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = (x + dx + width) % width;
                    const ny = (y + dy + height) % height;
                    const ni = ny * width + nx;
                    const newDist = currentDist + Math.sqrt(dx*dx + dy*dy);
                    
                    if (newDist < distanceField[ni]) {
                        distanceField[ni] = newDist;
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        
        return distanceField;
    }

    interpolate(x0, x1, alpha) {
        return x0 * (1 - alpha) + alpha * x1;
    }
    
    findClusters(triangles = []) {
        const clusters = [];
        const visited = new Array(triangles.length).fill(false);

        function shareEdge(triangle1, triangle2) {
            const edges1 = [
                [triangle1.a, triangle1.b],
                [triangle1.b, triangle1.c],
                [triangle1.c, triangle1.a]
            ];
            const edges2 = [
                [triangle2.a, triangle2.b],
                [triangle2.b, triangle2.c],
                [triangle2.c, triangle2.a]
            ];
            for (let edge1 of edges1) {
                for (let edge2 of edges2) {
                    if (
                        (edge1[0].equals(edge2[0]) && edge1[1].equals(edge2[1])) ||
                        (edge1[0].equals(edge2[1]) && edge1[1].equals(edge2[0]))
                    ) {
                        return true;
                    }
                }
            }
            return false;
        }

        function dfs(index, cluster) {
            visited[index] = true;
            cluster.push(triangles[index]);

            for (let i = 0; i < triangles.length; i++) {
                if (!visited[i] && shareEdge(triangles[index], triangles[i])) {
                    dfs(i, cluster);
                }
            }
        }

        for (let i = 0; i < triangles.length; i++) {
            if (!visited[i]) {
                const cluster = [];
                dfs(i, cluster);
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    createBufferGeometryFromCluster(cluster) {
        const vertices = [];
        const indices = [];
        const uvs = [];

        cluster.forEach((triangle, index) => {
            const startIndex = vertices.length / 3;
            vertices.push(
                triangle.a.x, triangle.a.y, triangle.a.z,
                triangle.b.x, triangle.b.y, triangle.b.z,
                triangle.c.x, triangle.c.y, triangle.c.z
            );
            uvs.push(
                0, 0,
                1, 0,
                1, 1
            );
            indices.push(startIndex, startIndex + 1, startIndex + 2);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    clusterCliffs() {
        var meshes = []
        const cliffClusters = this.findClusters(this.cliffs);
        cliffClusters.forEach(cluster => {
            const geometry = this.createBufferGeometryFromCluster(cluster);
            const material = new THREE.MeshBasicMaterial({ 
                // map: rockTexture,
                color: 'white',
                side: THREE.DoubleSide,
                wireframe: false
            });
                
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            // moveMeshAlongNormal(mesh, -0.05);
            meshes.push(mesh);
        });
        return meshes;
    }

    clusterGrounds() {
        var meshes = [];
        const groundClusters = this.findClusters(this.ground);
        groundClusters.forEach(cluster => {
            const geometry = createBufferGeometryFromCluster(cluster);
                const material = new THREE.MeshStandardMaterial({
                color: 'lawngreen',
                    side: THREE.DoubleSide
                });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            // moveMeshAlongNormal(mesh, -0.05);
            meshes.push(mesh);
        });
        return meshes;
    }

    getBarycentricCoordinates(p, triangle) {
        const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
        const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
        const v2 = new THREE.Vector3().subVectors(p, triangle.a);

        const d00 = v0.dot(v0);
        const d01 = v0.dot(v1);
        const d11 = v1.dot(v1);
        const d20 = v2.dot(v0);
        const d21 = v2.dot(v1);

        const denom = d00 * d11 - d01 * d01;
        const v = (d11 * d20 - d01 * d21) / denom;
        const w = (d00 * d21 - d01 * d20) / denom;
        const u = 1.0 - v - w;

        return [u, v, w];  // Return the barycentric weights for the three vertices
    }  

    findNearestTerrainCenters(position) {
        const roundedX = Math.round(position.x / this.quadrant) * this.quadrant;
        const roundedZ = Math.round(position.z / this.quadrant) * this.quadrant;
        
        // Calculate distances to the 4 nearest centers
        const centers = [
            {x: roundedX, y: 0, z: roundedZ},                           // Center
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ},       // Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ},       // Right
            {x: roundedX, y: 0, z: roundedZ - this.quadrant * 2},       // Top
            {x: roundedX, y: 0, z: roundedZ + this.quadrant * 2},       // Bottom
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ - this.quadrant * 2}, // Top-Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ - this.quadrant * 2}, // Top-Right
            {x: roundedX - this.quadrant * 2, y: 0, z: roundedZ + this.quadrant * 2}, // Bottom-Left
            {x: roundedX + this.quadrant * 2, y: 0, z: roundedZ + this.quadrant * 2}  // Bottom-Right
        ];

       

        this.surroundingCenters = centers;
        
        return centers;
    }
    
    getDirectionFromCurrent(current, target) {
        if (target.x > current.x) return 'right';
        if (target.x < current.x) return 'left';
        if (target.z > current.z) return 'top';
        if (target.z < current.z) return 'bottom';
        return 'none'; // Should never happen if current !== target
    }


    getTriangleCenter(triangle) {
        const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
        const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
        const centerZ = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
        return { x: centerX, y: centerY, z: centerZ };
    }

    static Tree = class {
        constructor(trunk, foliage) {
            this.trunk = trunk;  // TubeMesh (representing the trunk)
            this.foliage = foliage;  // SphereMesh (representing the foliage)
            this.boundingBox = new THREE.Box3().setFromObject(this.trunk).union(new THREE.Box3().setFromObject(this.foliage));
        }
    }

    createTree(x, y, z, alternate) {
        const textureIndex = Math.floor(Math.random() * 7);

        var trunkHeight = randomInRange(3, 25)
        var trunkBaseRadius = randomInRange(.1, .8)
        var rr = alternate ? randomInRange(.01, .1) : randomInRange(.1, .5)
        var trunkCurve = []
        var trunkRadius = []
        var zS = z
        var xS = x
        var yS = y;

        for (; yS < y + trunkHeight; yS += 0.02) {
            if (Math.random() < 0.13) {
                zS += randomInRange(-rr, rr)
            }
            if (Math.random() < 0.13) {
                xS += randomInRange(-rr, rr)
            }
            var r = trunkBaseRadius
            trunkRadius.push(r)
            trunkCurve.push(
                new THREE.Vector3(
                    xS,
                    yS, 
                    zS
                )
            )
        }

        // Default foliage (spherical)
        var foliageRadius = randomInRange(trunkHeight * .3, 2.85)
        const sphereGeometry = new THREE.SphereGeometry(foliageRadius, 10, 10);
        const greenValue = Math.floor(Math.random() * 256);
        const color = new THREE.Color(Math.random() < 0.05 ? randomInRange(0, 0.5) : 0, greenValue / 255, 0);
        const foliageIndex = textureIndex > 4 ? textureIndex - 3 : textureIndex;
        const foliageTexture = this.textures.foliage[Math.floor(Math.random() * 7)];

        // Set how many times the texture should repeat in the U and V directions
        foliageTexture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
        foliageTexture.wrapT = THREE.RepeatWrapping; // Repeat vertically

        // Adjust these values to control the repetition frequency
        foliageTexture.repeat.set(10, 10); // Increase these numbers for more repetitions and smaller texture

        let sphereMaterial = new THREE.MeshStandardMaterial({
            color,
            map: foliageTexture,
            transparent: false
        });

        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true
        sphere.name = 'foliage'
        sphere.receiveShadow = true
        sphere.position.set(xS, yS + (foliageRadius / 2), zS); // Set foliage position
        scene.add(sphere);

        var { array, itemSize } = sphereGeometry.attributes.position
        for (let i = 0; i < 21; i++) {
            for (var j = 0; j < 21; j++) {
                var vertexIndex = (i * (21 + 1) + j) * itemSize
                var x = array[vertexIndex]
                var z = array[vertexIndex + 1]
                var y = array[vertexIndex + 2]

                array[vertexIndex] = randomInRange(x - (foliageRadius * 1.1), x + foliageRadius * 1.1)
                array[vertexIndex + 1] = randomInRange(y - (foliageRadius * 1.1), y + foliageRadius * 1.1)
                array[vertexIndex + 2] = randomInRange(z - (foliageRadius * 1.1), z + foliageRadius * 1.1)
            }
        }


        const path = new THREE.CatmullRomCurve3(trunkCurve);

        var segments = Math.floor(randomInRange(5, 11))
        var radialSegments = 15

        // Create the tube geometry
        const tubeGeometry = new THREE.TubeGeometry(path, segments, trunkBaseRadius);

        const material = new THREE.MeshStandardMaterial({ 
            map: this.textures.barks[textureIndex],
            // color: 'red',
            side: THREE.DoubleSide
        });

        // Create the mesh
        const tubeMesh = new THREE.Mesh(tubeGeometry, material);
        tubeMesh.castShadow = true
        tubeMesh.receiveShadow = true
        tubeMesh.position.y -= 2

        // Add the mesh to the scene
        scene.add(tubeMesh);

        return new Terrain.Tree(tubeMesh, sphere);
    }

    createGrassBlade(instancedMesh, triangle, bladePositions, i) {

        const dummy = new THREE.Object3D();
        const u = Math.random();
        const v = Math.random() * (1 - u);
        const posX = (1 - u - v) * triangle.a.x + u * triangle.b.x + v * triangle.c.x;
        const posY = (1 - u - v) * triangle.a.y + u * triangle.b.y + v * triangle.c.y;
        const posZ = (1 - u - v) * triangle.a.z + u * triangle.b.z + v * triangle.c.z;
        bladePositions.push(new THREE.Vector3(posX, posY, posZ));
        
        dummy.position.set(posX, posY, posZ);
        dummy.rotation.y = randomInRange(0, Math.PI * 2);
        dummy.rotation.x += randomInRange(2, Math.PI)
        dummy.scale.set(randomInRange(0.8, 1.2), randomInRange(0.8, 2.2),randomInRange(0.8, 1.2))
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(i, dummy.matrix);

        return [instancedMesh, bladePositions];
    }

    createGrassResult(indices, vertices, triangleMesh, bladeCount = 1000, bladeHeight = 1, bladeWidth = 0.1) {
        var triangle = triangleMesh.triangle
        
        const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
        bladeGeometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color("lawngreen"),
            side: THREE.DoubleSide,
            roughness: 0.8,  // Makes the surface more diffuse
            metalness: 0.0,  // Non-metallic surface
        });
        

        let instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, bladeCount);
        let bladePositions = [];

        for (let i = 0; i < bladeCount; i++) {
            [instancedMesh, bladePositions] = this.createGrassBlade(instancedMesh, triangle, bladePositions, i);
        }

        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        return new GrassPatch({
            mesh: instancedMesh,
            triangleMesh,
            bladePositions: bladePositions 
        });
    }

    createGrassPatch(indices, vertices, mesh) {
        const grassResult = this.createGrassResult(
            indices, 
            vertices,
            mesh,
            VM.map[VM.user.level].grassBladeDensity,
            .8,
            .2
        );

        // Mark grass on groundColorMap to match patches
        grassResult.bladePositions.forEach((bladePosition) => {
            const closestVertexIndex = this.findClosestVertex(bladePosition, vertices);
            if (closestVertexIndex >= 0 && closestVertexIndex < vertices.length / 3) {
                const x = Math.floor(closestVertexIndex / (this.segments + 1));
                const y = closestVertexIndex % (this.segments + 1);
                this.groundColorMap[x][y] += .1;  // Increment the grass density at the closest vertex
            }
        });

        return grassResult;
    }

    setCamera(camera) {
        this.camera = camera;
    }
}

class UserController {
    objects = []
    intersects = []
    constructor(terrain, bvh) {
        this.record = false
        this.terrain = terrain;
        this.bvh = bvh;
        this.isJumping = false;
        this.previousPosition = null
        this.w = false;
        this.a = false;
        this.s = false;
        this.d = false;
        this.wS = .3
        this.aS = .2
        this.sS = .2
        this.dS = .2
        this.tS = .15
        this.shift = false
        this.space = false;
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
        this.leftShift = false;
        this.rightShift = false;
        this.isJumping = false;
        this.intersection = {}
        this.self = () => ({
               box: new THREE.Box3().setFromCenterAndSize(
                    this.camera.position,
                    new THREE.Vector3(.5, 1 + .2, .2)
                ),
               position: this.camera.position
            }
        ),
        this.width = .5;
        this.height = 1.2;
        this.depth = .2;
        this.weight = 0.1
        this._energy = { x: 1, y: .3, z: 1 };
        this.energy = { x: 1, y: .3, z: 1 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.energy_start = { x: 0, y: 0, z: 0 };
        this.centerKey = null;
        this.intersectsTerrain = [];
        this.time_held = {
            w: 0,
            a: 0,
            s: 0,
            d: 0
        }
        this.time = {
            jump: null
        }
        this.addEventListener();
        this.init();
    }

    addEventListener() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toUpperCase();
            if (key == 'W') {
                this.w = true;
                this.time_held.w = new Date().getTime();
            } else if (key == 'A') {
                this.a = true;
            } else if (key == 'S') {
                this.s = true;
            } else if (key == 'D') {
                this.d = true;
            } else if (key == ' ') {
                if (this.isJumping) return
                this.isJumping = true;
                this.time.jump = 0;
                this.handleJumping()
            } else if (key == 'ARROWUP') {
                this.ArrowUp = true;
            } else if (key == 'ARROWDOWN') {
                this.ArrowDown = true;
            } else if (key == 'ARROWLEFT') {
                this.ArrowLeft = true;
            } else if (key == 'ARROWRIGHT') {
                this.ArrowRight = true;
            } else if (key === 'ShiftLeft') {
                this.leftShift = true;
            } else if (key === 'ShiftRight') {
                this.rightShift = true;
            }
        })
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toUpperCase();
            if (key == 'W') {
                user.w = false;
                this.time_held.w = 0;
            } else if (key == 'A') {
                this.a = false;
            } else if (key == 'S') {
                this.s = false;
            } else if (key == 'D') {
                this.d = false;
            } else if (key == ' ') {
                this.space = false;
            } else if (key == 'ARROWUP') {
                this.ArrowUp = false;
            } else if (key == 'ARROWDOWN') {
                this.ArrowDown = false;
            } else if (key == 'ARROWLEFT') {
                this.ArrowLeft = false;
            } else if (key == 'ARROWRIGHT') {
                this.ArrowRight = false;
            } else if (key === 'ShiftLeft') {
                this.leftShift = false;
            } else if (key === 'ShiftRight') {
                this.rightShift = false;
            }
        });

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();

        window.addEventListener('click', (e) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, window.user.camera);

            var intersects = raycaster.intersectObjects(scene.children);

            if (intersects.length > 0) {
                for (var i = 0; i < intersects.length; i++) {
                    switch (intersects[i].object.name) {
                    case 'elevator-call-button':
                    case 'elevator-button':
                        intersects[i].object.material.color.set('white')
                        intersects[i].object.selected = true;
                        var interval = undefined
                        var eFloor = castle.elevator.find(m => m.name == 'elevator-floor');
                        var up = eFloor.interval * intersects[i].object.floor > eFloor.position.y - castle.offsetY;
                        var down = eFloor.interval * intersects[i].object.floor < eFloor.position.y - castle.offsetY;
                        var arrived = false
                        var targetFloor = intersects[i].object.floor
                        var targetHeight = eFloor.interval * targetFloor + castle.offsetY;

                        function riseElevator() {
                            if (arrived) return
                            castle.elevator.forEach(m => {
                                if (up) {
                                    m.position.y += castle.elevatorSpeed
                                } else if (down) {
                                    m.position.y -= castle.elevatorSpeed
                                } else {
                                    return
                                }
                                var current_floor = Math.floor(eFloor.position.y / eFloor.interval)

                                if (m.name == 'elevator-button') {
                                    if (m.floor == current_floor) {
                                        m.material.color.set('white')
                                        m.selected = false
                                        castle.elevator.filter(m => m.name == 'active-button-light').forEach(l => l.position.y = m.position.y)
                                    } else if (!m.selected) {
                                        m.material.color.set('gray')
                                    }
                                } else if (m.name == 'elevator-floor' && (up ? m.position.y >= targetHeight : m.position.y <= targetHeight)) {
                                    m.position.y = targetHeight;
                                    console.log('! reaching targetHeight', m.position.y)
                                    arrived = true
                                }
                            });
                            if (arrived) {
                                clearInterval(interval);
                            }
                        }
                        interval = riseElevator;
                        setInterval(interval, 1)
                        break;
                    default:
                        break;
                    }
                }
            }
        }, false);
    }

    init() {
        let position = VM.user.position;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1600);
        this.camera.near = 0.1;  // Increase this value
        this.camera.far = 1000;  // Reduce far plane if it's too large
        this.camera.updateProjectionMatrix();
        this.camera.touches = new Set()
        this.camera.foot = null;
        this.camera.position.set(position.x, position.y + 2, position.z);
        this.camera.velocity = new THREE.Vector3(0, 0, 0);
        this.cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position,
            new THREE.Vector3(1, 1, 1) // Adjust size if needed
        );
    }

    updateSpheres() {
        const sopCenter = window.user.camera.position.clone();
        
        // Define the raycaster from the user's position
        const raycaster = new THREE.Raycaster();
        const rayDirections = [
            new THREE.Vector3(1, 0, 0),    // Right
            new THREE.Vector3(-1, 0, 0),   // Left
            new THREE.Vector3(0, 1, 0),    // Up
            new THREE.Vector3(0, -1, 0),   // Down
            new THREE.Vector3(0, 0, 1),    // Forward
            new THREE.Vector3(0, 0, -1)    // Backward
        ];
        const rayDistance = 10; // Define the maximum distance to check for intersections (touching distance)

        // Check intersections with castle parts using raycasting
        Object.values(window.castle.parts).forEach(mesh => {
            
            if (mesh.position.distanceTo(this.camera.position) < 100) {
                user.objects.push(mesh);
                if (!mesh.parent) scene.add(mesh);
            } else if (mesh.parent) {
                scene.remove(mesh);
            }
        });

        // Check intersections with grounds (triangles) using raycasting
        VM.map[VM.user.level].grounds.forEach(mesh => {
            let isIntersecting = false;
            const triangleCenter = terrain.getTriangleCenter(mesh.triangle);

            // Cast rays in multiple directions
            rayDirections.forEach(dir => {
                raycaster.set(sopCenter, dir.normalize());
                const intersects = raycaster.intersectObject(mesh, true);

                if (intersects.length > 0 && intersects[0].distance <= rayDistance) {
                    isIntersecting = true;  // Object is within touching distance
                }
            });

            // Add or remove based on intersections
            if (isIntersecting) {
                user.objects.push(mesh);
                if (!mesh.parent) scene.add(mesh);
            } else if (mesh.parent) {
                scene.remove(mesh);
            }
        });

        // // Remove triangles outside the SOP from the scene
        // VM.map[VM.user.level].trees.forEach((tree) => {
        //     function isInSOP(point, sopCenter, sopRadius) {
        //         const dx = point.x - sopCenter.x;
        //         const dy = point.y - sopCenter.y;
        //         const dz = point.z - sopCenter.z;
        //         const distanceSquared = dx * dx + dy * dy + dz * dz;
        //         return distanceSquared <= sopRadius * sopRadius;
        //     }

        //     if (tree.foliage.parent && !isInSOP(tree.foliage.position, sopCenter, VM.map[VM.user.level].sop.trees)) {
        //         scene.remove(tree.trunk);
        //         scene.remove(tree.foliage);
        //     } else if (!tree.foliage.parent && isInSOP(tree.foliage.position, sopCenter, VM.map[VM.user.level].sop.trees)) {
        //         scene.add(tree.trunk);
        //         scene.add(tree.foliage);
        //     }
        // });

        // // Remove triangles outside the SOP from the scene
        // VM.map[VM.user.level].grasses.forEach((grass) => {
        //     var mesh = grass.mesh
        //     var pos = getInstancePosition(mesh, 0);

        //     if (mesh.parent && !isInSOP(pos, sopCenter, VM.map[VM.user.level].sop.grasses)) {
        //         scene.remove(mesh);
        //     } else if (!mesh.parent && isInSOP(pos, sopCenter, VM.map[VM.user.level].sop.grasses)) {
        //         scene.add(mesh);
        //     }
        // });
    }

    handleMovement() {
        this.objects = []
        this.intersects = []

        this.updateSpheres()
        this.handleCollision()

        const now = new Date().getTime();



        if (this.isFalling) {
            if (user.objects.length) {
                const rayOrigin = user.self().position.clone();
                const directions = [
                    new THREE.Vector3(0, -1, 0),  // Down
                    new THREE.Vector3(1, 0, 0),   // Right
                    new THREE.Vector3(-1, 0, 0),  // Left
                    new THREE.Vector3(0, 0, 1),   // Forward
                    new THREE.Vector3(0, 0, -1),  // Backward
                    new THREE.Vector3(0, 1, 0)    // Up (optional, if you want to handle ceilings)
                ];

                // Iterate through all directions and objects for raycasting
                for (let dir of directions) {
                    const raycaster = new THREE.Raycaster(rayOrigin, dir.normalize());
                    for (let obj of user.objects) {
                        const intersects = raycaster.intersectObject(obj, true);
                        if (intersects.length > 0 && intersects.some(obj => obj.distance < .55)) {
                            this.intersects.push(intersects[0]);
                            this.record = true;
                            setTimeout(() => { 
                                this.record = false;
                            }, 5000);

                            this.isFalling = false;
                            this.velocity.y = 0;
                            this.camera.position.y = intersects[0].point.y + this.height / 2;
                            this.usermesh.position.copy(this.camera.position);
                            break;
                        }
                    }

                    // Also check terrain meshes
                    for (let mesh of terrain.meshes) {
                        const intersects = raycaster.intersectObject(mesh, true);
                        if (intersects.length > 0 && intersects.some(obj => obj.distance < .55)) {
                            this.intersects.push(intersects[0]);
                            this.record = true;
                            setTimeout(() => { 
                                this.record = false;
                            }, 5000);

                            mesh.intersects = intersects;
                            this.isFalling = false;
                            this.velocity.y = 0;
                            break;
                        }
                    }
                }
            }

            // Apply gravity if still falling
            if (this.velocity.y > TERMINAL_VELOCITY) {
                this.velocity.y -= 0.03;  // Decrease velocity gradually
            }
            this.camera.position.y += this.velocity.y;
            this.usermesh.position.y += this.velocity.y;

        } else if (this.isJumping) {
            if (user.objects.length) {
                const rayOrigin = user.self().position.clone();
                const directions = [
                    new THREE.Vector3(0, -1, 0),  // Down
                    new THREE.Vector3(1, 0, 0),   // Right
                    new THREE.Vector3(-1, 0, 0),  // Left
                    new THREE.Vector3(0, 0, 1),   // Forward
                    new THREE.Vector3(0, 0, -1),  // Backward
                    new THREE.Vector3(0, 1, 0)    // Up (optional, if you want to handle ceilings)
                ];

                // Iterate through all directions and objects for raycasting
                for (let dir of directions) {
                    const raycaster = new THREE.Raycaster(rayOrigin, dir.normalize());
                    for (let obj of user.objects) {
                        const intersects = raycaster.intersectObject(obj, true);
                        if (intersects.length > 0 && intersects[0].distance < .55 && intersects[0].point.y > this.camera.position.y) {
                            this.intersects.push(intersects[0]);
                            this.record = true;
                            setTimeout(() => { 
                                this.record = false;
                            }, 5000);

                            this.isFalling = false;
                            this.velocity.y = 0;
                            // this.camera.position.y = intersects[0].point.y - this.height / 2 - .1;
                            this.usermesh.position.copy(this.camera.position);
                            break;
                        }
                    }
                }
            }

            if (this.energy.y > 0) {
                this.energy.y -= .01;  // Simulate loss of energy during the jump
                this.camera.position.y += this.energy.y;
                this.usermesh.position.y += this.energy.y;
            } else {
                this.energy.y = this._energy.y;
                this.isJumping = false;
                this.isFalling = true;  // Switch to falling after the jump peak
            }

        } else {
            const rayOrigin = user.self().position.clone();
            const rayDirection = new THREE.Vector3(0, -1, 0);  // Downward ray to check the ground
            const raycaster = new THREE.Raycaster(rayOrigin, rayDirection.normalize());
            const intersects = raycaster.intersectObjects(user.objects, true);

            if (intersects.length > 0 && intersects.some(obj => obj.distance < 2)) {
                this.record = true;
                this.intersects.push(intersects[0]);
                this.camera.position.y = intersects[0].point.y + this.height;
                this.usermesh.position.y = intersects[0].point.y + this.height;
            }

            if (intersects.length === 0 || !intersects.some(obj => obj.distance < 2)) {
                this.isFalling = true;  // No ground detected, switch to falling state
            }
        }


        // Movement (while not jumping, or with reduced movement during jumping)
        var combinedMovement = new THREE.Vector3();
        if (this.w || this.a || this.s || this.d) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            var forwardMovement = new THREE.Vector3();
            var rightMovement = new THREE.Vector3();

            if (this.w) {
                var time_held = performance.now() - this.time_held.w;
                this.time_held.w = performance.now();
                var MOVE_FORWARD = this.wS;

                if (time_held > 500) {
                    MOVE_FORWARD *= 11
                }

                this.camera.getWorldDirection(direction);
                // Ignore the y component to keep movement on the horizontal plane
                direction.y = 0;
                direction.normalize();  // Normalize to ensure the vector length stays consistent
                forwardMovement.add(direction.multiplyScalar(MOVE_FORWARD));
            }
            if (this.s) {
                this.camera.getWorldDirection(direction);
                // Ignore the y component to keep movement on the horizontal plane
                direction.y = 0;
                direction.normalize();
                forwardMovement.add(direction.multiplyScalar(this.isJumping ? -this.sS * 0.5 : -this.sS));
            }

            if (this.a) {
                this.camera.getWorldDirection(direction);
                right.crossVectors(this.camera.up, direction).normalize();
                rightMovement.add(right.multiplyScalar(this.isJumping ? this.aS * 0.5 : this.aS));
            }
            if (this.d) {
                this.camera.getWorldDirection(direction);
                right.crossVectors(this.camera.up, direction).normalize();
                rightMovement.add(right.multiplyScalar(this.isJumping ? -this.dS * 0.5 : -this.dS));
            }

            combinedMovement.add(forwardMovement).add(rightMovement);
        }

        // Handle rotation
        if (this.ArrowUp || this.ArrowDown) {
            if (this.ArrowUp) {
                this.camera.rotateX(this.tS);
            }
            if (this.ArrowDown) {
                this.camera.rotateX(-this.tS);
            }
        }

        if (this.ArrowLeft || this.ArrowRight) {
            let quaternionY = new THREE.Quaternion();
            let quaternionX = new THREE.Quaternion();

            if (this.ArrowLeft) {
                quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.tS);
            }

            if (this.ArrowRight) {
                quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.tS);
            }

            this.camera.quaternion.multiplyQuaternions(quaternionY, this.camera.quaternion);
        }

        // Handle collisions before applying movement
        // this.handleCollision();
// 
        // Apply movement after collision handling
        this.camera.position.add(combinedMovement);

        if (this.record) {
            var user_history = window.user.usermesh.clone();
            scene.add(user_history)
        }
        window.user.usermesh.position.copy(this.camera.position)
        window.user.usermesh.rotation.copy(this.camera.rotation)

        this.updateBoundingBox();
    }

    handleJumping() {
        // Apply jump velocity to the camera position
        this.isJumping = true; 
    }






    // // Main collision handler
        // Main collision handler
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
            if (i === 2) {  // Forward collision is stronger
                collisionResponseForce = 0.5;
            }

            // Create a raycaster
            const raycaster = new THREE.Raycaster(this.camera.position, dir.normalize());

            // // Check for intersections with trees
            // const intersectsTrees = raycaster.intersectObjects(this.terrain.trees.flatMap(tree => [tree.trunk, tree.foliage]), true);
            // if (intersectsTrees.length > 0 && intersectsTrees[0].distance < collisionDistance) {
            //     this.handleTreeCollision(intersectsTrees[0], dir, collisionResponseForce);
            // }

            // Check for intersections with castle parts
            try {
                const intersectsCastle = raycaster.intersectObjects(user.objects, true);
                if (intersectsCastle.length > 0 && intersectsCastle.some(i => i.distance < 1)) {
                    this.handleCastleCollision(intersectsCastle[0], dir, collisionResponseForce);
                }
            } catch (e) {
                debugger
            }
        }
    
    }



    // Handle tree collision
    handleTreeCollision(intersection, direction, responseForce) {
        const responseDirection = this.camera.position.clone().sub(intersection.point).normalize();
        this.camera.position.add(responseDirection.multiplyScalar(responseForce));

        if (direction.equals(new THREE.Vector3(0, -1, 0))) {
            this.camera.velocity.y = 0;
            this.camera.position.y = intersection.point.y + 1;
        } else if (direction.equals(new THREE.Vector3(0, 1, 0))) {
            this.camera.velocity.y = Math.min(this.camera.velocity.y, 0);
        }
    }

    // Handle castle part collision
    handleCastleCollision(intersection, direction, responseForce) {
        const responseDirection = this.camera.position.clone().sub(intersection.point).normalize();

        // If it's a vertical intersection (like standing on a foundation)
        if (isVerticalIntersection(intersection.face.normal) && (this.isFalling || this.isJumping)) {
            this.energy.y = this._energy.y;
            this.isJumping = false;
            this.isFalling = true;  // Switch to falling after the jump peak
        } else {
            // Horizontal collision with walls, push the player away
            this.camera.position.add(responseDirection.multiplyScalar(responseForce));
        }
    }




    // Update terrain after collision or landing
    updateTerrain(intersection) {
        const terrainKey = intersection.object.centerKey; // Assuming each terrain mesh has a centerKey

        if (terrainKey && this.centerKey !== terrainKey) {
            let center = terrainKey.split("_").map(Number);
            this.centerKey = terrainKey;
            this.terrain.center = new THREE.Vector3(center[0], 0, center[1]);
            this.terrain.surroundingCenters = [];
            this.terrain.findNearestTerrainCenters(this.terrain.center);
        }
    }



    // Ensure the wireframe stays in sync with the bounding box
    updateBoundingBox() {
        // // Set the bounding box based on the this.camera's current position
        // this.cameraBoundingBox.setFromCenterAndSize(
        //     this.camera.position,
        //     new THREE.Vector3(1, 2, 1) // Adjust size if needed
        // );
        
        // // Update the wireframe box position and size to match the bounding box
        // const center = this.cameraBoundingBox.getCenter(new THREE.Vector3());
        // const size = this.cameraBoundingBox.getSize(new THREE.Vector3());

        // wireframeBox.position.copy(center);
        // wireframeBox.rotation.copy(this.camera.rotation);
        // wireframeBox.scale.set(size.x, size.y, size.z);
    }
}




function isVerticalIntersection(normal) {
    // If the normal of the intersected object is pointing mostly upward or downward, it's vertical
    return Math.abs(normal.y) > 0.7; // Adjust threshold as necessary
}




class View {
    constructor() {
        window.scene = new THREE.Scene();
        window.renderer = new THREE.WebGLRenderer();
        window.renderer.setSize(window.innerWidth, window.innerHeight);
        window.renderer.shadowMap.enabled = true;
        window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        window.renderer.domElement.id = "view";
    }

    init() {
        document.body.appendChild(window.renderer.domElement);


        console.log(VM);

        window.terrain = new Terrain(VM);

        WIRE('boundingBox',  null, window.terrain.meshes[0].position, 
            VM.map[VM.user.level].structures[0].area.foundation.width,
            VM.map[VM.user.level].structures[0].area.foundation.height, 
            VM.map[VM.user.level].structures[0].area.foundation.depth,
            true
        )



        window.boundingVolumeHierarchy = new BoundingVolumeHierarchy();
        window.user = new UserController(terrain, boundingVolumeHierarchy);
        window.sky = new Sky(window.user);
        window.terrain.setSun(window.sky.sun);
        window.terrain.setCamera(window.user.camera);

    
      
        boundingVolumeHierarchy.init(window.terrain.grassTriangles);
        
        this.addUser();

        var mapQuadrant = +getComputedStyle(devview.children[0]).width.split('px')[0];
        var centerTile = devview.children[12];
        var mapCenter = (+getComputedStyle(centerTile).height.split('px')[0] / 2) + centerTile.offsetTop;
        let time = 0;

        // // [Timeline("Start")]
        window.Animate = function() {
            window.requestAnimationFrame(Animate);
            window.sky.update();
            window.user.handleMovement();
            window.renderer.render(window.scene, window.user.camera);

            // todo - add faeries like those from The Faerie Queene by Edmund Spenser
            // simulating an infinite mythical environment
            // movePointLights(pointLights, curves, time);
            // time += 0.01; // Increment time to move the lights

           
            
            // Calculate user position on the 5x5 grid
            let userPosition = window.user.camera.position;
            let posIncX = userPosition.x / terrain.quadrant / 2;
            let posIncZ = userPosition.z / terrain.quadrant / 2;

            if (Number.isNaN(posIncX)) {
                posIncX = 0;
            }
            if (Number.isNaN(posIncZ)) {
                posIncZ = 0;
            }

            // Calculate the pixel position relative to the center of the grid
            var pointerX = posIncX * mapQuadrant + mapCenter;
            var pointerY = posIncZ * mapQuadrant + mapCenter;

            // Position the pointer
            pointer.style.left = `${pointerX}px`;
            pointer.style.top = `${pointerY}px`;

            // Debugging

            // var centerKey = `${Math.round(userPosition.x / 128) * 128}_${Math.round(userPosition.z / 128) * 128}`;
            // document.querySelectorAll('.quadrant').forEach(q => {
            //     for (var i = 0; i < terrain.meshes.length; i++) {
            //         document.getElementById(terrain.meshes[i].centerKey).classList.add('built');
            //     }
            //     q.classList.remove("on")
            // });
            // document.getElementById(centerKey).classList.add('on');
            document.getElementById('map').innerHTML = `<pre style="font-size: 0.5rem; width: 80vw; height: 80vh; background: rgba(0,0,0,0.3); color:white">${JSON.stringify({
                x: user.usermesh.position.x,
                y: user.usermesh.position.y,
                z: user.usermesh.position.z,
                objects_near: user.objects.length,
                isJumping: user.isJumping,
                user: {
                    velocity: user.velocity,
                    energy: user.energy,
                    intersections: user.intersects.map(i => i.point),
                    record: user.record
                }
            }, null, 2)}</pre>`

            window.user.previousPosition = window.user.camera.position.clone()


            
            //  for (var time in window.user.time) {
            //     if (window.user.time[time] == 0 || window.user.time[time] > 0) {
            //         console.log(time, window.user.time[time])
            //         window.user.time[time] += 0.001
            //     }
            // }
        }


        Animate();


    }

    addUser() {
        // Create a wireframe box to visualize the bounding box
        
        window.user.usermesh = WIRE('boundingBox', null, window.user.camera.position, .5, 1.2, .2, this.record ? false : true)
        window.user.usermesh.position.set(0, .7, 0)

        window.terrain.findNearestTerrainCenters(terrain.center);

        // Add the wireframe to the scene
        window.scene.add(window.user.usermesh);

        var mesh = terrain.meshes[0];

        //var [x, y, z] = [mesh.geometry.attributes.position.array[333], mesh.geometry.attributes.position.array[334] + 1, mesh.geometry.attributes.position.array[335]];
        let x, y, z;
        for (var i = 0; i < mesh.geometry.attributes.position.array.length; i += 3) {
            var _x = Math.abs(mesh.geometry.attributes.position.array[i] - 20);
            var _z = Math.abs(mesh.geometry.attributes.position.array[i + 2] - 20);

            if (_x < 2 && _z < 2) {
                x = mesh.geometry.attributes.position.array[i]
                y = mesh.geometry.attributes.position.array[i + 1] + 1
                z = mesh.geometry.attributes.position.array[i + 2]
                break;
            }
        }

        window.user.camera.position.set(0, 1.5 + user.height / 2, 0);
        window.user.usermesh.position.set(0, 1.5 + user.height / 2, 0);
        window.user.camera.rotation.set(0, 1.533185307179759, 0)


        var centerPoint = getCenterOfGeometry(mesh.geometry);
        centerPoint.y -= 4.5

        window.castle = new Structure(VM.map[VM.user.level].structures.filter(s => s.name == 'castle').pop())

        window.castle.erect();


       
        
    }

}

function getCenterOfGeometry(geometry) {
    // Get the position attribute of the geometry (which contains all the vertices)
    const position = geometry.attributes.position;

    // Variables to hold the sum of all x, y, and z values
    let xSum = 0, ySum = 0, zSum = 0;

    // Loop over all the vertices in the geometry
    for (let i = 0; i < position.count; i++) {
        xSum += position.getX(i);
        ySum += position.getY(i);
        zSum += position.getZ(i);
    }

    // Compute the average for x, y, and z to get the center
    const centerX = xSum / position.count;
    const centerY = ySum / position.count;
    const centerZ = zSum / position.count;

    // Return the center point as a Three.js Vector3
    return new THREE.Vector3(centerX, centerY, centerZ);
}


document.getElementById('map').innerHTML = new Array(25).fill(``).map((html, index) => {
    const x = ((index % 5) - 2) * 128; // -2, -1, 0, 1, 2 based on column
    const z = (Math.floor(index / 5) - 2) * 128; // -2, -1, 0, 1, 2 based on row

    // Return the HTML for each div, including the id in the format x_z
    return `<div class="quadrant" id="${x}_${z}">${x}_${z}</div>`;
}).join('');


window.VM = new ViewModel();
window.view = new View();

window.devview = document.getElementById('map');


function createRandomBezierCurve(heightLimit = 10) {
    // Calculate the bounding box of all meshes
    const boundingBox = new THREE.Box3();
    terrain.meshes.forEach(mesh => boundingBox.expandByObject(mesh));

    // Get the bounds of the bounding box
    const min = boundingBox.min;
    const max = boundingBox.max;

    // Function to generate a random point within the bounding box and height limit
    function randomPoint() {
        return new THREE.Vector3(
            THREE.MathUtils.randFloat(min.x, max.x),
            THREE.MathUtils.randFloat(min.y, max.y + heightLimit),
            THREE.MathUtils.randFloat(min.z, max.z)
        );
    }

    // Create control points for the Bezier curve
    const p0 = randomPoint();
    const p1 = randomPoint();
    const p2 = randomPoint();
    const p3 = randomPoint();

    return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
}

await VM.init("Peter", view);











function WIRE(type, mesh, position = new THREE.Vector3(0, 0, 0), width = 1, height = 1, depth = 1, isWire) {
    if (type === 'boundingBox') {
        let box;

        // If a mesh is provided, create the bounding box from the object
        if (mesh) {
            box = new THREE.Box3().setFromObject(mesh);
        } 
        // If no mesh, manually create a box using the provided position and dimensions
        else if (position) {
            const min = new THREE.Vector3(
                position.x - width / 2,
                position.y - height / 2,
                position.z - depth / 2
            );
            const max = new THREE.Vector3(
                position.x + width / 2,
                position.y + height / 2,
                position.z + depth / 2
            );
            box = new THREE.Box3(min, max);
        }

        // Create the wireframe geometry
        const boxSize = box.getSize(new THREE.Vector3());  // Get the dimensions of the box
        const boxGeometry = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
        const wireframeMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00, // Wireframe color (green)
            wireframe: isWire
        });
        const wireframe = new THREE.Mesh(boxGeometry, wireframeMaterial);
        wireframe.castShadow = true
        // Set the position of the wireframe
        const boxCenter = box.getCenter(new THREE.Vector3());
        wireframe.position.copy(boxCenter);

        scene.add(wireframe)

        return wireframe;  // Return the wireframe object
    } else {
        // Handle other types if needed
    }
}












