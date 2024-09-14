import * as THREE from '/node_modules/three/build/three.module.min.js';


window.scene = new THREE.Scene();

function TriangleMesh(vertices, a, b, c) {
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

    const color = Math.random() < 0.5 ? 'whitesmoke' : '#EBEDEF'//new THREE.Color(Math.random(), Math.random(), Math.random())

    const triangleMaterial = new THREE.MeshStandardMaterial({
        color, // Random color for the triangles
        side: THREE.DoubleSide
    });
    const triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.castShadow = true;
    triangleMesh.receiveShadow = true;
    triangleMesh.triangle = new THREE.Triangle(
        new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
        new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
        new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
    );
    triangleMesh.rgb = undefined

    // Calculate normal and slope
    const normal = new THREE.Vector3();
    triangleMesh.triangle.getNormal(normal);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);
    triangleMesh.slope = slope;
    triangleMesh.normal = normal;

    return triangleMesh;
}

class BoundingVolumeHierarchy {

    constructor() {}

    static BVHNode = class {
        constructor(boundingBox, triangles, left = null, right = null) {
            this.boundingBox = boundingBox;
            this.triangles = triangles;
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
}

class Terrain {
    constructor(center = { x: 0, y: 0, z: 0 }, quadrant = 100, options = { noiseWidth: 200, noiseHeight: 100 }) {
        this.center = center;
        this.quadrant = quadrant;
        this.sop = Math.floor(quadrant / 3);
        this.width = quadrant * 2;
        this.height = quadrant * 2;
        this.v0 = { x: center.x - quadrant, y: center.y, z: center.z + quadrant };
        this.v1 = { x: center.x + quadrant, y: center.y, z: center.z + quadrant }; 
        this.v2 = { x: center.x + quadrant, y: center.y, z: center.z - quadrant }; 
        this.v3 = { x: center.x - quadrant, y: center.y, z: center.z - quadrant };
        this.segments = quadrant * 2;
        this.noiseWidth = options.noiseWidth;
        this.noiseHeight = options.noiseHeight;
        this.cliffs = [];
        this.grounds = [];
        this.triangles = [];
        this.cliffMeshes = [];
        this.groundMeshes = [];
        this.altitudeVariance = 10;
    }

    generatePerlinNoise(options = {}) {
        let octaveCount = options.octaveCount || 4;
        let amplitude = options.amplitude || 0.1;
        let persistence = options.persistence || 0.2;
        let whiteNoise = this.generateWhiteNoise();

        let smoothNoiseList = new Array(octaveCount);
        for (let i = 0; i < octaveCount; ++i) {
            smoothNoiseList[i] = this.generateSmoothNoise(i, whiteNoise);
        }

        let perlinNoise = new Array(this.width * this.height);
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

    generateWhiteNoise() {
        const noise = new Array(this.width * this.height);
        for (let i = 0; i < noise.length; ++i) {
            noise[i] = Math.random();
        }
        return noise;
    }

    generateSmoothNoise(octave, whiteNoise) {
        var noise = new Array(this.width * this.height);
        var samplePeriod = Math.pow(2, octave);
        var sampleFrequency = 1 / samplePeriod;
        var noiseIndex = 0;
        for (var y = 0; y < this.height; ++y) {
          var sampleY0 = Math.floor(y / samplePeriod) * samplePeriod;
          var sampleY1 = (sampleY0 + samplePeriod) % this.height;
          var vertBlend = (y - sampleY0) * sampleFrequency;
          for (var x = 0; x < this.width; ++x) {
            var sampleX0 = Math.floor(x / samplePeriod) * samplePeriod;
            var sampleX1 = (sampleX0 + samplePeriod) % this.width;
            var horizBlend = (x - sampleX0) * sampleFrequency;

            // blend top two corners
            var top = this.interpolate(whiteNoise[sampleY0 * this.width + sampleX0], whiteNoise[sampleY1 * this.width + sampleX0], vertBlend);
            // blend bottom two corners
            var bottom = this.interpolate(whiteNoise[sampleY0 * this.width + sampleX1], whiteNoise[sampleY1 * this.width + sampleX1], vertBlend);
            // final blend
            noise[noiseIndex] = this.interpolate(top, bottom, horizBlend);
            noiseIndex += 1;
          }
        }
        return noise;
    }

    interpolate(x0, x1, alpha) {
        return x0 * (1 - alpha) + alpha * x1;
    }


    // Helper function to find connected clusters
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
                side: THREE.BackSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            // moveMeshAlongNormal(mesh, -0.05);
            meshes.push(mesh);
        });
        return meshes;
    }

    generate() {
        let vertices = [];
        let indices = [];
        let uvs = [];
        const cellSize = 1;
        const segmentSize = 1 / this.segments;

        let perlinNoise = this.generatePerlinNoise();

        const centerX = 0.5;
        const centerY = 0.5;
        const flatRadius = 0.1; // Adjust this radius as needed

        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = i * segmentSize;
                let y = j * segmentSize;

                let v = new THREE.Vector3();
                v.x = (1 - x) * (1 - y) * this.v0.x + x * (1 - y) * this.v1.x + x * y * this.v2.x + (1 - x) * y * this.v3.x;
                v.y = (1 - x) * (1 - y) * this.v0.y + x * (1 - y) * this.v1.y + x * y * this.v2.y + (1 - x) * y * this.v3.y;
                v.z = (1 - x) * (1 - y) * this.v0.z + x * (1 - y) * this.v1.z + x * y * this.v2.z + (1 - x) * y * this.v3.z;

                let noiseX = Math.floor(x * (this.noiseWidth - 1));
                let noiseY = Math.floor(y * (this.noiseHeight - 1));
                let height = perlinNoise[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;

                v.y += height;
                
                vertices.push(v.x, v.y, v.z);
                uvs.push(x, y);

            }
        }

        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                let a = i + j * (this.segments + 1);
                let b = (i + 1) + j * (this.segments + 1);
                let c = (i + 1) + (j + 1) * (this.segments + 1);
                let d = i + (j + 1) * (this.segments + 1);

                if (a >= 0 
                    && b >= 0 
                    && c >= 0 
                    && d >= 0 
                    && a < vertices.length / 3 
                    && b < vertices.length / 3 
                    && c < vertices.length / 3 
                    && d < vertices.length / 3) {

                    indices.push(a, b, d);
                    indices.push(b, c, d);

                    const t1 = TriangleMesh(vertices, a, b, d);          
                    const t2 = TriangleMesh(vertices, b, c, d);

                    [t1, t2].forEach((t) => {
                        const normal = getTriangleNormal(t.triangle);
                        const slope = t.slope;

                        if (slope > 150) {
                            // moveMeshAlongNormal(t, -0.03)
                            // scene.add(t);
                            this.triangles.push(t);
                            t.climbable = true;
                            this.grounds.push(t.triangle)

                            // if (t.triangle.a.y > 20 && Math.random() < 0.03) {
                            //     let tree = CREATE_A_TREE(t.triangle.a.x, t.triangle.a.y, t.triangle.a.z, 1);
                            //     window.TREES.push(tree);
                            // }


                            // for (var i = 0; i < 3; i++) {
                            //     var g = new THREE.PlaneGeometry(randomInRange(0.2, 1.4), randomInRange(1, 3));
                            //     var m = new THREE.MeshStandardMaterial({
                            //         map: Math.random() < 0.5 ? snapdragon : nasturtiums,
                            //         side: THREE.DoubleSide,
                            //         transparent: true,
                            //         opacity: 1
                            //     });
                            //     var mesh = new THREE.Mesh(g, m);
                            //     var _ = Math.random() < 0.2 ? a : (Math.random() < 0.4 ? b : c)
                            //     mesh.position.set(
                            //         vertices[_ * 3], vertices[_ * 3 + 1], vertices[_ * 3 + 2]
                            //     );
                            //     // mesh.rotation.z = -Math.PI;
                            //     mesh.rotation.y = Math.random() * Math.PI * 2;
                            //     mesh.position.x += randomInRange(-.2, .2);
                            //     mesh.position.z += randomInRange(-.2, .2);
                            //     mesh.castShadow = true;
                            //     mesh.receiveShadow = true;
                            //     scene.add(mesh);
                            // }

                        // [Object("SlidingSlope")]
                        } else if (slope < 107) {
                            // moveMeshAlongNormal(t, -0.05);
                            t.climbable = false;
                            this.triangles.push(t);
                            this.cliffs.push(t.triangle)
                        } else {
                            this.triangles.push(t);
                            // scene.add(t);
                            t.climbable = true;
                            // this.other.push(t.triangle)
                        }

                    });
                } else {
                    console.warn(`Invalid indices detected: a=${a}, b=${b}, c=${c}, d=${d}`);
                }
            }
        }

        this.cliffsMeshes = this.clusterCliffs();
        this.groundMeshes = this.clusterGrounds();

        // window.TREES = partitionTrees3D(window.TREES, 8, 8, 8, gridSize, gridSize, gridSize);


        var planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        planeGeometry.setIndex(indices);
        planeGeometry.computeVertexNormals();
        planeGeometry.computeBoundingBox();

        var material = new THREE.MeshStandardMaterial({
            color: 'blue',
            side: THREE.DoubleSide,
            wireframe: false,
            opacity: .5,
            transparent: true
        });

        this.mesh = new THREE.Mesh(planeGeometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        this.mesh.position.set(0, 0, 0);
        scene.add(this.mesh);

        return this;
    }

    updateTerrain(playerPosition) {
        // Define the SOP as a center and a radius
        const sopCenter = { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z };
        const sopRadius = this.sop; // SOP radius defining the extent of the player's perception

        // Update visible triangles and clusters
        this.updateVisibleTrianglesAndClusters(sopCenter, sopRadius);

        // Update the terrain's current center
        this.center = sopCenter;
        
        // Update the terrain vertices (`v0`, `v1`, `v2`, `v3`) if necessary (depends on use case)
        this.v0 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v1 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v2 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
        this.v3 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
    }

    updateVisibleTrianglesAndClusters(sopCenter, sopRadius) {
        // Helper function to determine if a point is within the SOP
        function isInSOP(point, sopCenter, sopRadius) {
            const dx = point.x - sopCenter.x;
            const dy = point.y - sopCenter.y;
            const dz = point.z - sopCenter.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            return distanceSquared <= sopRadius * sopRadius;
        }

        // Remove triangles outside the SOP from the scene
        this.triangles.forEach((mesh) => {
            const triangle = mesh.triangle; // Get the triangle representation from the mesh
            const triangleCenter = this.getTriangleCenter(triangle);

            if (mesh && mesh.parent && !isInSOP(triangleCenter, sopCenter, sopRadius)) {
                scene.remove(mesh);
                mesh.triangle.inSOP = false; // Mark as not in SOP
            }
        });

        // Add triangles within the SOP to the scene
        this.triangles.forEach((mesh) => {
            const triangle = mesh.triangle; // Get the triangle representation from the mesh
            const triangleCenter = this.getTriangleCenter(triangle);

            if (!mesh.parent && isInSOP(triangleCenter, sopCenter, sopRadius)) {
                scene.add(mesh);
                mesh.triangle.inSOP = true; // Mark as in SOP
            }
        });

        // Repeat for cliffs and grounds clusters if needed
        this.cliffMeshes.forEach((mesh) => {
            const meshCenter = this.getTriangleCenter(mesh.triangle);
            if ((meshCenter.x < sopCenter.x - sopRadius || meshCenter.x > sopCenter.x + sopRadius ||
                meshCenter.z < sopCenter.z - sopRadius || meshCenter.z > sopCenter.z + sopRadius)) {
                scene.remove(mesh);
            } else {
                scene.add(mesh);
            }
        });

        this.groundMeshes.forEach((mesh) => {
            const meshCenter = this.getTriangleCenter(mesh.triangle);
            if ((meshCenter.x < sopCenter.x - sopRadius || meshCenter.x > sopCenter.x + sopRadius ||
                meshCenter.z < sopCenter.z - sopRadius || meshCenter.z > sopCenter.z + sopRadius)) {
                scene.remove(mesh);
            } else {
                scene.add(mesh);
            }
        });
    }

    // Helper method to calculate the center of a triangle
    getTriangleCenter(triangle) {
        const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
        const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
        const centerZ = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
        return { x: centerX, y: centerY, z: centerZ };
    }




}

class Tree {
    constructor(trunk, foliage) {
        this.trunk = trunk;  // TubeMesh (representing the trunk)
        this.foliage = foliage;  // SphereMesh (representing the foliage)
        this.boundingBox = new THREE.Box3().setFromObject(this.trunk).union(new THREE.Box3().setFromObject(this.foliage));
    }
}

class SceneController {
    constructor() {

    }

    render() {

    }

    updateBackground() {

    }

    animateNature() {

    }
}

class CharacterController {
    constructor(camera, terrain) {
        this.camera = camera;
        this.terrain = terrain;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.velocity = new THREE.Vector3(); // General velocity
    }

    handleMovement() {
        // Implement movement logic here using this.camera and this.velocity
    }

    handleJumping() {
        // Implement jumping logic here
    }

    applyGravity() {
        // Implement gravity logic here
    }

    detectCollision() {
        // Implement collision detection logic here
    }
}



window.terrain = new Terrain().generate();
window.boundingVolumeHierarchy = new BoundingVolumeHierarchy();

boundingVolumeHierarchy.init(terrain.triangles);

window.sliding = false
window.THREE = THREE;
window.w = false;
window.a = false;
window.s = false;
window.d = false;
window.wS = .1
window.aS = .1
window.sS = .1
window.dS = .1
window.tS = .2
window.shift = false
window.space = false;
window.ArrowUp = false;
window.ArrowRight = false;
window.ArrowDown = false;
window.ArrowLeft = false;
window.isJumping = false;
window.BVH = {}
const FOV = 1600
const TERMINAL_VELOCITY = -5.1 // lol
var Grass = [
    '#33462d', //
    '#435c3a', //
    '#4e5e3e', //
    '#53634c', //
    '#53634c', // (duplicate, same as above)
    '#536c46', //
    '#5d6847', //
];
window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
window.activeMapIndex = -1;
window.priorMapIndex = -1
window.map = {}
var oceanBackground = null;
window.sceneRadius = 150
window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, FOV);
window.camera.touches = new Set()
window.camera.foot = null;
window.camera.velocity = new THREE.Vector3(0, 0, 0);
var jumpVelocity = .3;
window.camera.sectionTouched = null;
window.camera.triangleTouched = null;
window.scene.add(window.camera);
window.renderer = new THREE.WebGLRenderer();
window.renderer.setSize(window.innerWidth, window.innerHeight);
window.renderer.shadowMap.enabled = true;
window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.renderer.domElement.id = "view";
document.body.appendChild(window.renderer.domElement);
var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
// Global bounding box for the camera
const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
    camera.position,
    new THREE.Vector3(1, 1, 1) // Adjust size if needed
);

// Function to partition the trees into a 3D grid
function partitionTrees3D(trees, gridSizeX, gridSizeY, gridSizeZ, terrainSizeX, terrainSizeY, terrainSizeZ) {
    const partitionedTrees = Array.from({ length: gridSizeX }, () =>
        Array.from({ length: gridSizeY }, () =>
            Array.from({ length: gridSizeZ }, () => [])));

    const cellSizeX = terrainSizeX / gridSizeX;
    const cellSizeY = terrainSizeY / gridSizeY;
    const cellSizeZ = terrainSizeZ / gridSizeZ;

    var treesFound = 0

    trees.forEach(tree => {
        const minX = Math.floor((tree.boundingBox.min.x + terrainSizeX / 2) / cellSizeX);
        const minY = Math.floor((tree.boundingBox.min.y) / cellSizeY);
        const minZ = Math.floor((tree.boundingBox.min.z + terrainSizeZ / 2) / cellSizeZ);
        const maxX = Math.floor((tree.boundingBox.max.x + terrainSizeX / 2) / cellSizeX);
        const maxY = Math.floor((tree.boundingBox.max.y) / cellSizeY);
        const maxZ = Math.floor((tree.boundingBox.max.z + terrainSizeZ / 2) / cellSizeZ);


        for (let x = Math.max(0, minX); x <= Math.min(gridSizeX - 1, maxX); x++) {
            for (let y = Math.max(0, minY); y <= Math.min(gridSizeY - 1, maxY); y++) {
                for (let z = Math.max(0, minZ); z <= Math.min(gridSizeZ - 1, maxZ); z++) {
                    partitionedTrees[x][y][z].push(tree);
                    treesFound++
                }
            }
        }
    });

    console.log(window.TREES.length, treesFound) // 496 297100

    return partitionedTrees;
}

// Function to get trees in a 3D sector based on user position
function getTreesInSector3D(userPosition, partitionedTrees, gridSizeX, gridSizeY, gridSizeZ, terrainSizeX, terrainSizeY, terrainSizeZ) {
    const cellSizeX = terrainSizeX / gridSizeX;
    const cellSizeY = terrainSizeY / gridSizeY;
    const cellSizeZ = terrainSizeZ / gridSizeZ;

    const x = Math.floor((userPosition.x + terrainSizeX / 2) / cellSizeX);
    const y = Math.floor(userPosition.y / cellSizeY);
    const z = Math.floor((userPosition.z + terrainSizeZ / 2) / cellSizeZ);

    if (x >= 0 && x < gridSizeX && y >= 0 && y < gridSizeY && z >= 0 && z < gridSizeZ) {
        return partitionedTrees[x][y][z];
    }

    return [];
}


window.addEventListener('keydown', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        window.w = true;
    } else if (key == 'A') {
        window.a = true;
    } else if (key == 'S') {
        window.s = true;
    } else if (key == 'D') {
        window.d = true;
    } else if (key == ' ') {
        window.isJumping = true;
        window.jumpVelocity = jumpVelocity

    } else if (key == 'ARROWUP') {
        window.ArrowUp = true;
    } else if (key == 'ARROWDOWN') {
        window.ArrowDown = true;
    } else if (key == 'ARROWLEFT') {
        window.ArrowLeft = true;
    } else if (key == 'ARROWRIGHT') {
        window.ArrowRight = true;
    } else if (key == 'SHIFT') {
        window.shift = true;
    }
})

window.addEventListener('keyup', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        window.w = false;
    } else if (key == 'A') {
        window.a = false;
    } else if (key == 'S') {
        window.s = false;
    } else if (key == 'D') {
        window.d = false;
    } else if (key == ' ') {
        window.space = false;
    } else if (key == 'ARROWUP') {
        window.ArrowUp = false;
    } else if (key == 'ARROWDOWN') {
        window.ArrowDown = false;
    } else if (key == 'ARROWLEFT') {
        window.ArrowLeft = false;
    } else if (key == 'ARROWRIGHT') {
        window.ArrowRight = false;
    } else if (key == 'SHIFT') {
        window.shift = false;
    }
})

function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}




const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', function(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;

        intersectedObject.material.opacity = intersectedObject.material.opacity ? 0 : 1;

        if (intersectedObject.material.opacity && intersectedObject.material.addToBVH) {
            window.BVH = addObjectToBVH(intersectedObject, window.BVH);
            intersectedObject.material.addToBVH = false;
        } else {
            window.BVH = removeObjectFromBVH(intersectedObject, window.BVH);
            intersectedObject.material.addToBVH = true;
        }
    } else {
        // document.getElementById("collision-result").innerHTML = "No collision";
    }
});


function checkCollision(cameraBoundingVolume, bvhNode, triangles = []) {
    if (!bvhNode) {
        bvhNode = window.boundingVolumeHierarchy.BVH; // Assuming this is where the global BVH is stored
    }

    // If the bounding volume doesn't intersect the current node's bounding box, return the current triangles array
    if (!cameraBoundingVolume.intersectsBox(bvhNode.boundingBox)) {
        return triangles;
    }

    // If this node contains triangles, check each one
    if (bvhNode.triangles && bvhNode.triangles.length > 0) {
        for (const mesh of bvhNode.triangles) {
            if (cameraBoundingVolume.intersectsTriangle(mesh.triangle)) {
                // If an intersection occurs, push the triangle to the array
                triangles.push(mesh);
            }
        }
    }

    // Continue checking the left and right children nodes if they exist
    if (bvhNode.left) {
        checkCollision(cameraBoundingVolume, bvhNode.left, triangles);
    }
    if (bvhNode.right) {
        checkCollision(cameraBoundingVolume, bvhNode.right, triangles);
    }

    // Return the array of all intersected triangles
    return triangles;
}


function generatePointsInTriangle(A, B, C, numPoints = 40) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        // Generate two random numbers
        const r1 = Math.random();
        const r2 = Math.random();
        const sqrtR1 = Math.sqrt(r1);

        // Calculate barycentric coordinates
        const lambda1 = 1 - sqrtR1;
        const lambda2 = sqrtR1 * (1 - r2);
        const lambda3 = sqrtR1 * r2;

        // Calculate the coordinates of the random point
        const x = lambda1 * A.x + lambda2 * B.x + lambda3 * C.x;
        const y = lambda1 * A.y + lambda2 * B.y + lambda3 * C.y;
        const z = lambda1 * A.z + lambda2 * B.z + lambda3 * C.z;

        // Create a new Vector3 and add it to the points array
        points.push(new THREE.Vector3(x, y, z));
    }
    return points;
}


function getTriangleNormal(triangle) {
    const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    return new THREE.Vector3().crossVectors(v0, v1).normalize();
}


function TriangleAsUnderFoot(cameraBoundingBox, triangle) {
    const normal = getTriangleNormal(triangle);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

    // Check if the triangle is within the camera bounding box vertically
    const minZ = Math.min(triangle.a.z, triangle.b.z, triangle.c.z);
    const maxZ = Math.max(triangle.a.z, triangle.b.z, triangle.c.z);

    if (cameraBoundingBox.min.z <= maxZ && cameraBoundingBox.max.z >= minZ) {
        return { Vector3: normal, slope: slope };
    }
    return null;
}


function TriangleAsAdjacent(triangle1, triangle2) {
    const vertices1 = [triangle1.a, triangle1.b, triangle1.c];
    const vertices2 = [triangle2.a, triangle2.b, triangle2.c];

    const sharedVertices = vertices1.filter(v1 =>
        vertices2.some(v2 => v1.equals(v2))
    );

    return sharedVertices.length === 2;
}


function TriangleAsOverhead(cameraBoundingBox, triangle) {
    const normal = getTriangleNormal(triangle);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, -1, 0))) * (180 / Math.PI);

    // Check if the triangle is within the camera bounding box vertically
    const minZ = Math.min(triangle.a.z, triangle.b.z, triangle.c.z);
    const maxZ = Math.max(triangle.a.z, triangle.b.z, triangle.c.z);

    if (cameraBoundingBox.min.z <= maxZ && cameraBoundingBox.max.z >= minZ) {
        return { Vector3: normal, slope: slope };
    }
    return null;
}


function GetMeshForTriangle(mesh) {
    for (var i = 0; i < dom.length; i++) {
        if (dom[i].triangle == mesh.triangle) {
            var cbb = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(1, 1, 1) // Adjust the size as needed
            );
            return {
                mesh,
                underFoot: TriangleAsUnderFoot(cbb, triangle),
                overHead: TriangleAsOverhead(cbb, triangle)
            }
        }
    }
    return null;
}

function getAdjacentIndices(mapIndex) {
    const [x, y, z] = mapIndex.split('_').map(Number);
    const adjacentIndices = [
        `${x}_${y}_${z}`,
        `${x+1}_${y}_${z}`,
        `${x}_${y+1}_${z}`,
        `${x+1}_${y+1}_${z}`
    ];
    return adjacentIndices;
}

var p = document.createElement('pre');
p.style.background = 'rgba(0,0,0,0.8)'
p.style.color = 'white'
document.body.appendChild(p);
p.style.position = 'absolute'
p.style.left = '0px'
p.style.top = '0px'
p.style.overflow = 'auto';
p.style.maxHeight = '100vh';
p.style.padding = '0.15rem 1rem'






// var dimFairyLight = new THREE.AmbientLight(new THREE.Color('white'), 0.05);
// dimFairyLight.position.set(0,0,0)
// scene.add(dimFairyLight)





// [Object("Sun")]
window.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, .9); // Sky and ground color
hemisphereLight.position.set(0, 150, 0);
scene.add(hemisphereLight);


// [Object("Sun")]
window.sun = new THREE.DirectionalLight(0xffffff, 5);
sun.position.set(0, 150, 0);
scene.add(sun)
sun.lookAt(0, 0, 0)

sun.castShadow = true; // Enable shadow casting for the light

// Optionally configure shadow map size for better shadow quality
sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;

// Configure the shadow camera for the directional light (this affects shadow casting area)
sun.shadow.camera.near = 0.05;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;


var sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 30, 30), new THREE.MeshBasicMaterial({ color: 'white' }));
sphere.position.copy(sun);
scene.add(sphere)

function Sun() {}
window.TreesTouchingUser = 0

camera.position.y = 50

function Watch() {
	requestAnimationFrame(Watch)
    var cbb = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(1, 1, 1) // Adjust the size as needed
            );
	p.innerHTML = `
CAMERA:   ${camera.position.x}, ${camera.position.y}, ${camera.position.z}
JUMP VELOCITY:  ${window.jumpVelocity}
Velocity: ${window.camera.velocity.y}
TreesTouchingUser: ${TreesTouchingUser.length}
HAS COLLISION:   ${camera.hasCollision}  ${ camera.hasCollision ? `
    ${camera.triangleTouched.a.x}, ${camera.triangleTouched.a.y}, ${camera.triangleTouched.a.z}
    ${camera.triangleTouched.b.x}, ${camera.triangleTouched.b.y}, ${camera.triangleTouched.b.z}
    ${camera.triangleTouched.c.x}, ${camera.triangleTouched.c.y}, ${camera.triangleTouched.c.z}
` : ''}
JUMPING: ${window.isJumping}
SLIDING: ${window.sliding}

SECTION TOUCHED: <table style="overflow: auto;wmax-width:100vw;">
	<tr>
		<th>climbable</th>
        <th>touch type</th>
        <th>slope</th>
	</tr>
    ${ camera.sectionTouched && camera.sectionTouched.mesh ? `
        <tr>
            <td>${camera.sectionTouched.mesh.climbable}</td>
            <td>${(
                camera.sectionTouched.underFoot ? 'under-foot' : (
                    camera.sectionTouched.overHead ? 'over-head' : '?'
                )
            )}</td>
            <td>
                ${(
                    camera.sectionTouched.underFoot ? camera.sectionTouched.underFoot.slope : (
                        camera.sectionTouched.overHead ? camera.sectionTouched.overHead.slope : '?'
                    )
                )}
            </td>
        </tr>` : ''
    }
</table>
`
}


// [Timeline("Start")]
window.Animate = function() {
    window.requestAnimationFrame(Animate);

    var combinedMovement = new THREE.Vector3();

    // Movement (while not jumping, or with reduced movement during jumping)
    if (window.w || window.a || window.s || window.d) {
        var direction = new THREE.Vector3();
        var right = new THREE.Vector3();
        var forwardMovement = new THREE.Vector3();
        var rightMovement = new THREE.Vector3();

        if (window.w) {
            window.camera.getWorldDirection(direction);
            // Reduce movement speed if jumping, or apply normal movement speed on the ground
            forwardMovement.add(direction.multiplyScalar(window.isJumping ? window.wS * 0.5 : window.wS));
        }
        if (window.a) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(window.isJumping ? window.aS * 0.5 : window.aS));
        }
        if (window.s) {
            window.camera.getWorldDirection(direction);
            forwardMovement.add(direction.multiplyScalar(window.isJumping ? -window.sS * 0.5 : -window.sS));
        }
        if (window.d) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(window.isJumping ? -window.dS * 0.5 : -window.dS));
        }

        combinedMovement.add(forwardMovement).add(rightMovement);
    }

    // Jump & Gravity
    if (window.isJumping) {
        window.camera.position.y += window.jumpVelocity;
        window.jumpVelocity -= 0.03 * 0.8; // Adjust the gravity effect on jump

        // Check for collision with ground using raycasting
        const raycaster = new THREE.Raycaster(window.camera.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(window.terrain.mesh, true);

        if (intersects.length > 0 && intersects[0].distance < 1) { // Adjust distance as needed
            const intersection = intersects[0];
            window.isJumping = false;
            window.jumpVelocity = 0;
            window.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
        }
    } else {
        // Gravity
        window.camera.velocity.y += -0.02; // Gravity effect

        // Limit falling speed to terminal velocity
        if (window.camera.velocity.y < TERMINAL_VELOCITY) {
            window.camera.velocity.y = TERMINAL_VELOCITY;
        }

        window.camera.position.y += window.camera.velocity.y;

        // Check for ground collision using raycasting
        const raycaster = new THREE.Raycaster(window.camera.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(window.terrain.mesh, true);

        if (intersects.length > 0 && intersects[0].distance < 1) { // Adjust distance as needed
            const intersection = intersects[0];
            window.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
            window.camera.velocity.y = 0; // Reset vertical velocity upon collision
        }
    }

    Collide(combinedMovement);


    // Handle rotation
    if (window.ArrowUp || window.ArrowDown) {
        if (window.ArrowUp) {
            camera.rotateX(window.tS);
        }
        if (window.ArrowDown) {
            camera.rotateX(-window.tS);
        }
    }

    if (window.ArrowLeft || window.ArrowRight) {
        let quaternionY = new THREE.Quaternion();
        let quaternionX = new THREE.Quaternion();

        if (window.ArrowLeft) {
            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), window.tS);
        }

        if (window.ArrowRight) {
            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -window.tS);
        }

        camera.quaternion.multiplyQuaternions(quaternionY, window.camera.quaternion);
    }

    window.terrain.updateTerrain(window.camera.position);

    window.renderer.render(window.scene, window.camera);
};


// Create a wireframe box to visualize the bounding box
const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // Adjust dimensions as needed
const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Wireframe color (green, adjust as needed)
    wireframe: true
});
const wireframeBox = new THREE.Mesh(boxGeometry, wireframeMaterial);

// Add the wireframe to the scene
scene.add(wireframeBox);

// Ensure the wireframe stays in sync with the bounding box
function updateBoundingBox() {
    // Set the bounding box based on the camera's current position
    cameraBoundingBox.setFromCenterAndSize(
        camera.position,
        new THREE.Vector3(1, 1, 1) // Adjust size if needed
    );
    
    // Update the wireframe box position and size to match the bounding box
    const center = cameraBoundingBox.getCenter(new THREE.Vector3());
    const size = cameraBoundingBox.getSize(new THREE.Vector3());

    wireframeBox.position.copy(center);
    wireframeBox.rotation.copy(camera.rotation);
    wireframeBox.scale.set(size.x, size.y, size.z);
}


function checkTreeCollision(cameraBoundingBox) {
    const treesInNearbySectors = getTreesInNearbySectors(cameraBoundingBox);

    const treesTouchingUser = [];

    treesInNearbySectors.forEach(tree => {
        // Check collision with the tree's trunk
        const trunkBoundingBox = new THREE.Box3().setFromObject(tree.trunk);
        if (trunkBoundingBox.intersectsBox(cameraBoundingBox)) {
            treesTouchingUser.push(tree);
        }

        // Optionally check collision with foliage (if applicable)
        const foliageBoundingBox = new THREE.Box3().setFromObject(tree.foliage);
        if (foliageBoundingBox.intersectsBox(cameraBoundingBox)) {
            treesTouchingUser.push(tree);
        }
    });

    return treesTouchingUser;
}

// Function to get trees from nearby sectors based on camera's bounding box
function getTreesInNearbySectors(cameraBoundingBox) {
    const userPosition = cameraBoundingBox.getCenter(new THREE.Vector3());

    // Assuming you have a grid-based partitioning system like before
    // This function gets trees from the grid sectors that are near the camera
    const nearbyTrees = [];

    const sectorsToCheck = getSectorsToCheck(userPosition);

    sectorsToCheck.forEach(sector => {
        // Add all trees in the sector to the list of trees to check
        nearbyTrees.push(...window.TREES[sector.x][sector.y][sector.z]);
    });

    return nearbyTrees;
}

// Helper function to get which sectors to check based on the camera's position
// This checks the current sector and optionally adjacent sectors
function getSectorsToCheck(userPosition) {
    const gridSizeX = 8, gridSizeY = 8, gridSizeZ = 8;  // Example grid size
    const terrainSizeX = T*2, terrainSizeY = T*2, terrainSizeZ = T*2;  // Example terrain size

    const cellSizeX = terrainSizeX / gridSizeX;
    const cellSizeY = terrainSizeY / gridSizeY;
    const cellSizeZ = terrainSizeZ / gridSizeZ;

    // Calculate which sector the user is in
    const sectorX = Math.floor((userPosition.x + terrainSizeX / 2) / cellSizeX);
    const sectorY = Math.floor(userPosition.y / cellSizeY);
    const sectorZ = Math.floor((userPosition.z + terrainSizeZ / 2) / cellSizeZ);

    // Get neighboring sectors (the sector the user is in and possibly adjacent sectors)
    const sectorsToCheck = [];
    for (let x = sectorX - 1; x <= sectorX + 1; x++) {
        for (let y = sectorY - 1; y <= sectorY + 1; y++) {
            for (let z = sectorZ - 1; z <= sectorZ + 1; z++) {
                if (x >= 0 && x < gridSizeX && y >= 0 && y < gridSizeY && z >= 0 && z < gridSizeZ) {
                    sectorsToCheck.push({ x, y, z });
                }
            }
        }
    }

    return sectorsToCheck;
}



function Collide(combinedMovement) {
    
    updateBoundingBox()

    // Handle Terrain
    const TerrainMeshesTouchingUser = checkCollision(cameraBoundingBox);


    // If there are intersecting triangles
    if (TerrainMeshesTouchingUser.length) {
        // Iterate over all intersecting triangles
        for (let i = 0; i < TerrainMeshesTouchingUser.length; i++) {
            const mesh = TerrainMeshesTouchingUser[i];

            const triangleColor = mesh.material.color;

            // Get the note based on the triangle's color
            // const note = getNoteFromColor(triangleColor, keyNotes);

            // Play the note (pseudo-code for playing sound)
            // playNoteSound(note);

            
            camera.hasCollision = true;
            camera.triangleTouched = mesh.triangle; 

            // mesh.material.color.set(Math.random(), Math.random(), 1);

            if (camera.position.y < mesh.position.y + 1) {
                camera.position.y = mesh.position.y + 1;
            }

            if (!mesh.climbable && !window.shift) {
                const slopeDirection = new THREE.Vector3();
                const meshNormal = mesh.normal;

                slopeDirection.copy(meshNormal).normalize();
                const slopeMovement = slopeDirection.multiplyScalar(-0.2);

                window.sliding = true;
                camera.position.add(slopeMovement);
            }

            if (combinedMovement.length() > 0) {
                combinedMovement.projectOnPlane(mesh.normal); 

                const newPosition = new THREE.Vector3().copy(camera.position).add(combinedMovement);
                const isInsideTriangle = isPointInTriangle(newPosition, mesh.triangle);  

                if (isInsideTriangle) {
                    camera.position.copy(newPosition);
                } else {
                    camera.position.add(combinedMovement); 
                }
            }
        }
    } else {
        // If no triangles are intersecting, reset the collision state
        camera.hasCollision = false;
        camera.triangleTouched = null;

        // Apply the normal movement without any restrictions
        camera.position.add(combinedMovement);
    }

    // CollideWithTrees(combinedMovement);

    camera.position.add(combinedMovement);

    // Reset the state for all triangles in the BVH (untouched state)
    function resetAllTriangles(bvhNode) {
        if (!bvhNode) return;

        // If the node contains triangles, reset their color
        if (bvhNode.triangles && bvhNode.triangles.length > 0) {
            for (const triangle of bvhNode.triangles) {
                // Reset the triangle's material color if it has a stored original color
                if (triangle.bin) {
                    triangle.material.color.copy(triangle.bin);
                    triangle.bin = undefined;  // Clear the stored color
                }
            }
        }

        // Traverse the left and right nodes recursively
        if (bvhNode.left) resetAllTriangles(bvhNode.left);
        if (bvhNode.right) resetAllTriangles(bvhNode.right);
    }

    // Call the reset function after processing collisions
    resetAllTriangles(window.BVH);

}

// Helper function to check if a point is inside a triangle
function isPointInTriangle(point, triangle) {
    var v0 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    var v1 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    var v2 = new THREE.Vector3().subVectors(point, triangle.a);

    var dot00 = v0.dot(v0);
    var dot01 = v0.dot(v1);
    var dot02 = v0.dot(v2);
    var dot11 = v1.dot(v1);
    var dot12 = v1.dot(v2);

    var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v < 1);
}

// ocean



// terrain
var snapdragon = new THREE.TextureLoader().load("/images/snap-dragon.png")
var nasturtiums = new THREE.TextureLoader().load("/images/nasturtiums.jpg")



function createDome() {
  var gridSize = 75;
  var planeSize = 27; // Adjust this size to your preference
  var radius = sceneRadius * 3; // Adjust this radius for the dome's curvature
  var maxdist = 0

  for (var i = 0; i < gridSize; i++) {
    for (var j = 0; j < gridSize; j++) {
      // Calculate spherical coordinates
      var theta = (i / gridSize) * Math.PI; // Azimuthal angle
      var phi = (j / gridSize) * Math.PI;   // Polar angle

      // Convert spherical coordinates to Cartesian coordinates
      var x = radius * Math.sin(phi) * Math.cos(theta);
      var z = radius * Math.cos(phi);
      var y = radius * Math.sin(phi) * Math.sin(theta);

      var planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
      var planeMaterial = new THREE.MeshBasicMaterial({
        color: stage.sunAngle > Math.PI ? 0xf95a75 : "white",
        transparent: true,
        opacity: 1
      });

      var plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.position.set(x, y - sceneRadius * .6, z);
      plane.lookAt(camera.position.x, camera.position.y, camera.position.z);
      // plane.rotation.z = randomInRange(0, Math.PI * 2)

      if (z > maxdist) z = maxdist

      stage.Sky.push(plane);
      scene.add(plane);
    }
  }
}

// createDome()


var al = new THREE.AmbientLight(0xffffce, 0.05);
scene.add(al);
al.position.set(0, 50, 0)


// setInterval(createClouds, 3000);


function getRandomShadeOfGreen() {
    // Generate a random green value between 0 and 255
    const greenValue = Math.floor(Math.random() * 256);
    // Create a new THREE.Color object with the random green value
    const color = new THREE.Color(Math.random() < 0.05 ? randomInRange(0, 0.5) : 0, greenValue / 255, 0);
    return color;
}

function CREATE_A_TREE(x, y, z, alternate) {
    var trunkHeight = randomInRange(5, 15)
    var trunkBaseRadius = randomInRange(.05, trunkHeight / 18)
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
    var foliageRadius = randomInRange(trunkHeight * .3, 1.85)
    const sphereGeometry = new THREE.SphereGeometry(foliageRadius, 10, 10);
    let sphereMaterial = new THREE.MeshStandardMaterial({
        color: getRandomShadeOfGreen(),
        transparent: false
    });
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.castShadow = true
    sphere.receiveShadow = true
    sphere.position.set(xS, yS - foliageRadius, zS); // Set foliage position
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
        // map: barkTexture,
        color: 'red',
        side: THREE.DoubleSide
    });

    // Create the mesh
    const tubeMesh = new THREE.Mesh(tubeGeometry, material);
    tubeMesh.castShadow = true
    tubeMesh.receiveShadow = true
    tubeMesh.position.y -= 2

    // Add the mesh to the scene
    scene.add(tubeMesh);

    return new Tree(tubeMesh, sphere);
}



// Watch()



Animate();
