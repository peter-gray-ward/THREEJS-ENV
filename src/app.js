import * as THREE from '/node_modules/three/build/three.module.min.js';


window.scene = new THREE.Scene();
window.renderer = new THREE.WebGLRenderer();
window.renderer.setSize(window.innerWidth, window.innerHeight);
window.renderer.shadowMap.enabled = true;
window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.renderer.domElement.id = "view";
document.body.appendChild(window.renderer.domElement);

const TERMINAL_VELOCITY = -1.1 // lol

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
        transparent: true,
        opacity: 0,
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

class Textures {
    constructor() {
        this.barks = Array.from({ length: 7 }).map((_, i) => {
            return new THREE.TextureLoader().load(`/images/trees/bark/bark-${i + 1}.jpg`);
        });
        this.branches = Array.from({ length: 4 }).map((_, i) => {
            return new THREE.TextureLoader().load(`/images/trees/foliage/branches/tree-branch-${i + 1}.png`);
        });
        this.foliage = Array.from({ length: 7 }).map((_, i) => {
            return new THREE.TextureLoader().load(`/images/trees/foliage/textures/foliage-${i + 1}.jpg`);
        });
    }
}

class Sky {

    constructor(user) {
        this.counter = 0;
        this.user = user;
        this.sceneRadius = 150;
        this.angularSpeed = 2 * Math.PI;
        this.time = 0;

        this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, .15); // Sky and ground color
        this.hemisphereLight.position.set(0, 100, 0);
        scene.add(this.hemisphereLight);


        this.sun = new THREE.DirectionalLight(0xffffff, 5);
        this.sun.position.set(0, 150, 0);
        scene.add(this.sun)
        this.sun.lookAt(0, 0, 0)

        this.sun.castShadow = true; // Enable shadow casting for the light

        // Optionally configure shadow map size for better shadow quality
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        // Configure the shadow camera for the directional light (this affects shadow casting area)
        this.sun.shadow.camera.near = 0.05;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.camera.left = -500;
        this.sun.shadow.camera.right = 500;
        this.sun.shadow.camera.top = 500;
        this.sun.shadow.camera.bottom = -500;
        this.sky = [];
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(2, 30, 30), 
            new THREE.MeshBasicMaterial({ 
                side: THREE.DoubleSide, 
                color: 'white' 
            })
        );
        this.sphere.position.set(0, 150, 0);
        scene.add(this.sphere)

        this.createDome();

    }

    createDome() {
        var gridSize = 75;
        var planeSize = 27; // Adjust this size to your preference
        var radius = this.sceneRadius * 3; // Adjust this radius for the dome's curvature
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
                    color: 0xf95a75,
                    transparent: true,
                    opacity: 1
                });

                var plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.position.set(x, y - this.sceneRadius * .6, z);
                // plane.lookAt(window.user.camera.position.x, user.camera.position.y, user.camera.position.z);
                // this.plane.rotation.z = randomInRange(0, Math.PI * 2)

                this.sky.push(plane);

                if (z > maxdist) z = maxdist;

                scene.add(plane);
            }
        }
    }

    update() {
        // this.time += 0.001;
        // var theta = this.angularSpeed * this.time;
        // var sunX = this.sceneRadius * Math.cos(theta);
        // var sunY = this.sceneRadius * Math.sin(theta);
        
        // this.sun.position.x = sunX;
        // this.sun.position.y = sunY;
        // this.sphere.position.x = sunX;
        // this.sphere.position.y = sunY;

        for (var i = 0; i < this.sky.length; i++) {
            var distanceToSun = this.sky[i].position.distanceTo(this.sun.position);

            if (distanceToSun < sunMinDist) sunMinDist = distanceToSun
            if (distanceToSun > sunMaxDist) sunMaxDist = distanceToSun


            // Calculate intensity based on distance
            var intensity = 1 - (distanceToSun / sunMaxDist);

            // Ensure intensity stays within valid range (0 to 1)
            intensity = Math.max(0, Math.min(1, intensity));

            // Define the colors for the gradient (white for close, dark blue for far)
            var colorNear = new THREE.Color('#4287f5');
            var colorFar = new THREE.Color('darkblue');

            // Optionally, adjust opacity further to smooth the transition


            // Interpolate between the colors based on intensity
            var color = new THREE.Color().lerpColors(colorFar, colorNear, intensity);

            // Update the color of the plane's material
            this.sky[i].material.color.copy(color);
            this.sky[i].material.needsUpdate = true; // Ensure material update
            this.sky[i].lookAt(this.user.camera.position.x, this.user.camera.position.y, this.user.camera.position.z)
            // Optionally, adjust material opacity based on intensity for a smoother transition

            if (this.sun.position.y > 0) {
                this.sky[i].material.opacity = 1
            } else if (distanceToSun > day) {
                this.sky[i].material.opacity = intensity * .13;
            }
        }
    }
}

class Terrain {
    constructor(center = { x: 0, y: 0, z: 0 }, quadrant = 100, options = { noiseWidth: 200, noiseHeight: 100 }, textures = new Textures()) {
        this.center = center;
        this.quadrant = quadrant;
        this.width = quadrant * 2;
        this.height = quadrant * 2;
        this.sop = {
            trees: quadrant * 3,
            grasses: quadrant * .3
        }
        this.Grass = [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ];
        this.v0 = { x: center.x - quadrant, y: center.y, z: center.z + quadrant };
        this.v1 = { x: center.x + quadrant, y: center.y, z: center.z + quadrant }; 
        this.v2 = { x: center.x + quadrant, y: center.y, z: center.z - quadrant }; 
        this.v3 = { x: center.x - quadrant, y: center.y, z: center.z - quadrant };
        this.segments = quadrant;
        this.noiseWidth = options.noiseWidth;
        this.noiseHeight = options.noiseHeight;
        this.cliffs = [];
        this.grounds = [];
        this.triangles = [];
        this.cliffMeshes = [];
        this.groundMeshes = [];
        this.trees = [];
        this.grasses = [];
        this.altitudeVariance = 10;
        this.textures = textures;
    }

    generateRollingPerlinNoise(options = {}) {
        let octaveCount = options.octaveCount || 4;
        let amplitude = options.amplitude || 0.003;  // Slightly higher amplitude for rolling hills
        let persistence = options.persistence || 0.15;  // Moderate persistence for rolling terrain
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


    generatePerlinNoise(options = {}) {
        let octaveCount = options.octaveCount || 4;
        let amplitude = options.amplitude || 0.05;
        let persistence = options.persistence || 0.1;
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

    getRandomPosition() {
        const positions = this.mesh.geometry.attributes.position.array;
        const vertexCount = Math.floor(positions.length / 3); // Total number of vertices
        const randomVertexIndex = Math.floor(Math.random() * vertexCount); // Random vertex index

        // Calculate the correct array index for the x, y, z coordinates of the random vertex
        const index = randomVertexIndex * 3;

        return {
            x: positions[index],        // x-coordinate
            y: positions[index + 1],    // y-coordinate
            z: positions[index + 2]     // z-coordinate
        };
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


  
    generate() {
        let vertices = [];
        let indices = [];
        const segmentSize = 1 / this.segments;
        const groundColorMap = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(0));  // Initialize ground color map

        let perlinNoise = this.generateRollingPerlinNoise();

        // Generate vertices and initial setup
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
            }
        }

        var grassPatches = new Array(this.segments + 1).fill().map(() => new Array(this.segments + 1).fill(false));  // Initialize an array to track grass patches

        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                // Define the random range for grass patches
                const isInGrassPatch = (i >= randomInRange(0, this.quadrant * 2) && i <= randomInRange(0, this.quadrant * 2)) &&
                                       (j >= randomInRange(0, this.quadrant * 2) && j <= randomInRange(10, this.quadrant * 2));

                // Store grass patch in grassPatches array
                if (isInGrassPatch || Math.random() < 0.01) {
                    grassPatches[i][j] = true;  // Mark this cell as part of a grass patch
                }
            }
        }



        // Process triangles and apply grass in defined ranges
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                let a = i + j * (this.segments + 1);
                let b = (i + 1) + j * (this.segments + 1);
                let c = (i + 1) + (j + 1) * (this.segments + 1);
                let d = i + (j + 1) * (this.segments + 1);

                if (a >= 0 && b >= 0 && c >= 0 && d >= 0 && a < vertices.length / 3 && b < vertices.length / 3 && c < vertices.length / 3 && d < vertices.length / 3) {
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                    

                    const t1 = TriangleMesh(vertices, a, b, d, this.width, this.height);
                    const t2 = TriangleMesh(vertices, b, c, d, this.width, this.height);

                    [t1, t2].forEach((triangle) => {
                        

                        const isTree = Math.random() < 0.03;

                        //  // Check if this triangle is either in a grass patch or adjacent to one
                        const isNearGrassPatch = (grassPatches[i][j] || 
                                                  (i > 0 && grassPatches[i - 1][j]) ||  // Check left
                                                  (i < this.segments && grassPatches[i + 1][j]) ||  // Check right
                                                  (j > 0 && grassPatches[i][j - 1]) ||  // Check above
                                                  (j < this.segments && grassPatches[i][j + 1]) ||  // Check below
                                                  (i > 0 && j > 0 && grassPatches[i - 1][j - 1]) ||  // Check top-left diagonal
                                                  (i < this.segments && j > 0 && grassPatches[i + 1][j - 1]) ||  // Check top-right diagonal
                                                  (i > 0 && j < this.segments && grassPatches[i - 1][j + 1]) ||  // Check bottom-left diagonal
                                                  (i < this.segments && j < this.segments && grassPatches[i + 1][j + 1])  // Check bottom-right diagonal
                        );


                        if (isNearGrassPatch) {
                            triangle.material.opacity = .8;
                            triangle.material.color.set(this.Grass[Math.floor(Math.random() * this.Grass.length)]);

                            const grassResult = this.applyGrassToTriangle(
                                triangle.triangle,
                                5,
                                randomInRange(0.1, 0.2),
                                randomInRange(0.05, 0.07)
                            );  // Apply grass to the triangle
                            
                    
                            // Mark grass on groundColorMap to match patches
                            grassResult.bladePositions.forEach((bladePosition) => {
                                const closestVertexIndex = this.findClosestVertex(bladePosition, vertices);
                                if (closestVertexIndex >= 0 && closestVertexIndex < vertices.length / 3) {
                                    const x = Math.floor(closestVertexIndex / (this.segments + 1));
                                    const y = closestVertexIndex % (this.segments + 1);
                                    groundColorMap[x][y] += 1;  // Increment the grass density at the closest vertex
                                }
                            });

                            this.grasses = this.grasses.concat(grassResult.mesh);
                           
                        }

                        this.triangles.push(triangle);

                        if (isTree) {
                            var tree = this.createTree(triangle.triangle.a.x, triangle.triangle.a.y, triangle.triangle.a.z, 1);
                            this.trees.push(tree);
                        }
                    });
                }
            }
        }

        // Now, let's apply the grass density in groundColorMap to color the vertices
        const colors = [];
        const gridSize = groundColorMap.length;  // Assuming groundColorMap is a 2D array of the grid size

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const density = groundColorMap[i][j];

                // Ensure that color application and grass application use the same coordinates
                const vertexIndex = i * (this.segments + 1) + j;  // Adjust based on segment count and grid

                if (vertexIndex < vertices.length / 3) {  // Ensure vertex index is within bounds
                    if (density > 0) {
                        // More grass means more green intensity
                        const greenIntensity = Math.min(1, density / 10);  // Scale density for grass intensity
                        colors.push(randomInRange(0, 0.1), greenIntensity, randomInRange(0, 0.1));  // RGB color with green based on grass density
                    } else {
                        // No grass means brown soil
                        colors.push(randomInRange(0.1, 0.3), randomInRange(0.11, 0.15), randomInRange(0, 0.08));  // RGB color for dark brown soil
                    }
                }
            }
        }

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
            transparent: false,
            opacity: 0.1
        });

        const mesh = new THREE.Mesh(planeGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.mesh = mesh;
        scene.add(this.mesh);

        return this;
    }


    updateTerrain(playerPosition) {
        // Define the SOP as a center and a radius
        const sopCenter = { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z };

        // Update visible triangles and clusters
        this.updateVisibleTrianglesAndClusters(sopCenter);

        // Update the terrain's current center
        this.center = sopCenter;
        
        // Update the terrain vertices (`v0`, `v1`, `v2`, `v3`) if necessary (depends on use case)
        this.v0 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v1 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z + this.quadrant };
        this.v2 = { x: this.center.x + this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
        this.v3 = { x: this.center.x - this.quadrant, y: this.center.y, z: this.center.z - this.quadrant };
    }

    updateVisibleTrianglesAndClusters(sopCenter) {
        // Helper function to determine if a point is within the SOP
        function isInSOP(point, sopCenter, sopRadius) {
            const dx = point.x - sopCenter.x;
            const dy = point.y - sopCenter.y;
            const dz = point.z - sopCenter.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            return distanceSquared <= sopRadius * sopRadius;
        }


        // Add triangles within the SOP to the scene
        this.triangles.forEach((mesh) => {
            const triangle = mesh.triangle; // Get the triangle representation from the mesh
            const triangleCenter = this.getTriangleCenter(triangle);

            if (!mesh.parent && isInSOP(triangleCenter, sopCenter, this.sop.grasses)) {
                scene.add(mesh);
            } else if (mesh.parent && !isInSOP(triangleCenter, sopCenter, this.sop.grasses)) {
                scene.remove(mesh);
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

        // Remove triangles outside the SOP from the scene
        this.trees.forEach((tree) => {
            if (tree.foliage.parent && !isInSOP(tree.foliage.position, sopCenter, this.sop.trees)) {
                scene.remove(tree.trunk);
                scene.remove(tree.foliage);
            } else if (!tree.foliage.parent && isInSOP(tree.foliage.position, sopCenter, this.sop.trees)) {
                scene.add(tree.trunk);
                scene.add(tree.foliage);
            }
        });


        // Remove triangles outside the SOP from the scene
        this.grasses.forEach((grass) => {
            var pos = getInstancePosition(grass, 0);
            if (grass.parent && !isInSOP(pos, sopCenter, this.sop.grasses)) {
                scene.remove(grass);
            } else if (!grass.parent && isInSOP(pos, sopCenter, this.sop.grasses)) {
                scene.add(grass);
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
            transparent: true
        });

        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true
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


    applyGrassToTriangle(triangle, bladeCount = 11, bladeHeight = 1, bladeWidth = 0.1) {
        // Create geometry for a single grass blade
        const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
        bladeGeometry.translate(0, bladeHeight / 2, 0);  // Set the blade's pivot at the bottom

        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff0f,
            side: THREE.DoubleSide,
        });

        // Create an InstancedMesh to handle multiple instances of grass blades efficiently
        const instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, bladeCount);
        const bladePositions = [];  // To store blade positions for density updates

        const dummy = new THREE.Object3D(); // Temporary object for positioning each blade

        for (let i = 0; i < bladeCount; i++) {
            // Randomly generate positions for each blade on the triangle surface
            const u = Math.random();
            const v = Math.random() * (1 - u);  // Ensure the point lies within the triangle

            // Interpolate the position on the triangle
            const posX = (1 - u - v) * triangle.a.x + u * triangle.b.x + v * triangle.c.x;
            const posY = (1 - u - v) * triangle.a.y + u * triangle.b.y + v * triangle.c.y;
            const posZ = (1 - u - v) * triangle.a.z + u * triangle.b.z + v * triangle.c.z;

            // Store the grass blade position for groundColorMap updates
            bladePositions.push(new THREE.Vector3(posX, posY, posZ));

            // Randomly rotate and position the grass blade
            const randomRotation = Math.random() * Math.PI * 2;
            dummy.position.set(posX, posY, posZ);
            dummy.rotation.y = randomRotation;
            dummy.rotation.x += randomInRange(-0.01, 0.01)

            // Apply transformation to the instance
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        // Return both the instanced mesh and the positions of the grass blades
        return {
            mesh: instancedMesh,
            bladePositions: bladePositions  // Return the positions of the grass blades
        };
    }





}


class UserController {
    constructor(terrain, bvh) {
        this.terrain = terrain;
        this.bvh = bvh;
        this.isJumping = false;
        this.w = false;
        this.a = false;
        this.s = false;
        this.d = false;
        this.wS = .2
        this.aS = .1
        this.sS = .1
        this.dS = .1
        this.tS = .4
        this.shift = false
        this.space = false;
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.velocity = new THREE.Vector3(); // General velocity
        this.intersectsTerrain = [];
        this.init();
    }

    init() {
        let position = this.terrain.getRandomPosition();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1600);
        this.camera.touches = new Set()
        this.camera.foot = null;
        this.camera.position.set(position.x, position.y + 1.1, position.z);
        this.camera.velocity = new THREE.Vector3(0, 0, 0);
        this.cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position,
            new THREE.Vector3(1, 1, 1) // Adjust size if needed
        );
    }

    handleMovement() {
        // Handle gravity and jumping
        if (this.isJumping) {
            this.handleJumping();
        } else {
            this.applyGravity();
        }

        // Movement (while not jumping, or with reduced movement during jumping)
        var combinedMovement = new THREE.Vector3();
        if (this.w || this.a || this.s || this.d) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            var forwardMovement = new THREE.Vector3();
            var rightMovement = new THREE.Vector3();

            if (this.w) {
                this.camera.getWorldDirection(direction);
                // Ignore the y component to keep movement on the horizontal plane
                direction.y = 0;
                direction.normalize();  // Normalize to ensure the vector length stays consistent
                forwardMovement.add(direction.multiplyScalar(this.isJumping ? this.wS * 0.5 : this.wS));
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
        this.handleCollision();

        // Apply movement after collision handling
        this.camera.position.add(combinedMovement);

        this.updateBoundingBox();
    }

    handleCollision() {
        // Define the directions to check for collision (forward, backward, left, right, up, down)
        const directions = [
            [ new THREE.Vector3(1, 0, 0),  this.dS],    // Right
            [ new THREE.Vector3(-1, 0, 0), this.aS],   // Left
            [ new THREE.Vector3(0, 0, 1),  this.wS],    // Forward
            [ new THREE.Vector3(0, 0, -1), this.sS],   // Backward
            [ new THREE.Vector3(0, 1, 0),  this.jumpVelocity],    // Up
            [ new THREE.Vector3(0, -1, 0), 0.03 * 0.8]   // Down
        ];

        var dirs = {d:true,a:true,w:true,s:true,up:true,down:true}
        const cameraBoundingBox = new THREE.Box3(
            new THREE.Vector3(this.camera.position.x - 0.5, this.camera.position.y - 1.0, this.camera.position.z - 0.5), // Min point (simulating human size)
            new THREE.Vector3(this.camera.position.x + 0.5, this.camera.position.y + 1.0, this.camera.position.z + 0.5)  // Max point (simulating human size)
        );


        // Loop through each direction to cast rays and detect collisions
        var i = 0;
        for (let dir of directions) {
            const raycaster = new THREE.Raycaster(this.camera.position, dir[0].normalize());

            // Check for intersections with tree trunks and foliage
            const intersectsTrees = raycaster.intersectObjects(this.terrain.trees.flatMap(tree => [tree.trunk, tree.foliage]), true);

            var objs = []

            if (intersectsTrees.length > 0) {

                intersectsTrees.forEach(m => {
                    var radii = [
                        (m.object.geometry.boundingBox.max.x - m.object.geometry.boundingBox.min.x) / 2,
                        (m.object.geometry.boundingBox.max.y - m.object.geometry.boundingBox.min.y) / 2,
                        (m.object.geometry.boundingBox.max.z - m.object.geometry.boundingBox.min.z) / 2
                    ];


                    if (m.distance <= radii[dir.check]) {
                        this.canMove[dir.axis] = false;  // Block movement in the corresponding direction
                    }

                    // right
                    if (this.d && m.distance <= radii[0]) {
                        dirs.d = false
                        objs.push(m.object)
                    }

                    // left
                    if (this.a && m.distance <= radii[0]) {
                        dirs.a = false
                        objs.push(m.object)
                    }

                    // forward
                    if (this.w && m.distance <= radii[2]) {
                        dirs.w = false
                        objs.push(m.object)
                    } 

                    // back
                    if (this.s && m.distance <= radii[2]) {
                        dirs.s = false
                        objs.push(m.object)
                    } 

                    // up
                    if (this.isJumping && m.distance <= radii[1]) {
                        this.camera.velocity.y = 0;
                        dirs.up = false
                        objs.push(m.object)
                    } 

                    // down
                    if (this.camera.velocity.y < 0 && m.distance <= radii[1]) {
                        this.camera.velocity.y = 0;
                        objs.push(m.object)
                    } 

                })
            }

            

            i++;
        }

        for (var d in dirs) {
            if (!dirs[d]) {
                switch (d) {
                case 'w':   
                    this.wS = 0;
                    break;
                case 'a':
                    this.aS = 0
                    break
                case 's':
                    this.sS = 0
                    break;
                case 'd':
                    this.dS = 0
                    break
                }
            } else {
                switch (d) {
                case 'w':
                    this.wS = .2
                    break;
                case 'a':
                    this.aS = .1
                    break;
                case 's':
                    this.sS = .1
                    break;
                case 'd':
                    this.dS = .1
                    break;
                }
            }
        }

        document.getElementById('loaded').innerHTML =  `
${objs.map(o => `${o.uuid}`).join(',')}
${JSON.stringify(dirs, null, 2)}
        `
    }

    handleJumping() {
        // Adjust the camera's position using jump velocity
        this.camera.position.y += this.jumpVelocity;

        // Apply gravity to reduce the jump velocity
        this.jumpVelocity -= 0.03 * 0.8; // Adjust gravity effect

        // Raycast to detect if we're hitting the ground
        const raycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        this.intersectsTerrain = raycaster.intersectObject(this.terrain.mesh, true);

        if (this.intersectsTerrain.length > 0 && this.intersectsTerrain[0].distance < 1) { // Adjust distance as needed
            const intersection = this.intersectsTerrain[0];
            this.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
            this.camera.velocity.y = 0; // Reset vertical velocity upon collision
            this.isJumping = false;  // Ensure jumping is reset when grounded
        }

    }

    applyGravity() {
        // Apply gravity only if not jumping
        if (!this.isJumping) {
            this.camera.velocity.y += -0.05; // Increase gravity effect (from -0.02 to -0.05)

            // Limit falling speed to terminal velocity
            if (this.camera.velocity.y < TERMINAL_VELOCITY) {
                this.camera.velocity.y = TERMINAL_VELOCITY;
            }

            this.camera.position.y += this.camera.velocity.y;

            // Check for ground collision using raycasting
            const raycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
            this.intersectsTerrain = raycaster.intersectObject(this.terrain.mesh, true);

            if (this.intersectsTerrain.length > 0 && this.intersectsTerrain[0].distance < 1) { // Adjust distance as needed
                const intersection = this.intersectsTerrain[0];
                this.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
                this.camera.velocity.y = 0; // Reset vertical velocity upon collision
            }
        }
    }


    // Ensure the wireframe stays in sync with the bounding box
    updateBoundingBox() {
        // Set the bounding box based on the this.camera's current position
        this.cameraBoundingBox.setFromCenterAndSize(
            this.camera.position,
            new THREE.Vector3(1, 1, 1) // Adjust size if needed
        );
        
        // Update the wireframe box position and size to match the bounding box
        const center = this.cameraBoundingBox.getCenter(new THREE.Vector3());
        const size = this.cameraBoundingBox.getSize(new THREE.Vector3());

        wireframeBox.position.copy(center);
        wireframeBox.rotation.copy(this.camera.rotation);
        wireframeBox.scale.set(size.x, size.y, size.z);
    }
}


window.terrain = new Terrain().generate();
window.boundingVolumeHierarchy = new BoundingVolumeHierarchy();
window.user = new UserController(terrain, boundingVolumeHierarchy);
window.sky = new Sky(window.user);

boundingVolumeHierarchy.init(window.terrain.triangles);

window.sliding = false
window.THREE = THREE;

const FOV = 1600
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
window.map = {}
var oceanBackground = null;
window.sceneRadius = 150

var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
// Global bounding box for the camera


window.addEventListener('keydown', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        user.w = true;
    } else if (key == 'A') {
        user.a = true;
    } else if (key == 'S') {
        user.s = true;
    } else if (key == 'D') {
        user.d = true;
    } else if (key == ' ') {
        user.isJumping = true;
        user.jumpVelocity = 0.4;
    } else if (key == 'ARROWUP') {
        user.ArrowUp = true;
    } else if (key == 'ARROWDOWN') {
        user.ArrowDown = true;
    } else if (key == 'ARROWLEFT') {
        user.ArrowLeft = true;
    } else if (key == 'ARROWRIGHT') {
        user.ArrowRight = true;
    } else if (key == 'SHIFT') {
        user.shift = true;
    }
})

window.addEventListener('keyup', function(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        user.w = false;
    } else if (key == 'A') {
        user.a = false;
    } else if (key == 'S') {
        user.s = false;
    } else if (key == 'D') {
        user.d = false;
    } else if (key == ' ') {
        user.space = false;
    } else if (key == 'ARROWUP') {
        user.ArrowUp = false;
    } else if (key == 'ARROWDOWN') {
        user.ArrowDown = false;
    } else if (key == 'ARROWLEFT') {
        user.ArrowLeft = false;
    } else if (key == 'ARROWRIGHT') {
        user.ArrowRight = false;
    } else if (key == 'SHIFT') {
        user.shift = false;
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

// window.addEventListener('mousedown', function(event) {
//     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//     raycaster.setFromCamera(mouse, window.user.camera);

//     const intersects = raycaster.intersectObjects(scene.children, true);

//     if (intersects.length > 0) {
//         const intersectedObject = intersects[0].object;

//         intersectedObject.material.opacity = intersectedObject.material.opacity ? 0 : 1;

//         if (intersectedObject.material.opacity && intersectedObject.material.addToBVH) {
//             window.BVH = addObjectToBVH(intersectedObject, window.BVH);
//             intersectedObject.material.addToBVH = false;
//         } else {
//             window.BVH = removeObjectFromBVH(intersectedObject, window.BVH);
//             intersectedObject.material.addToBVH = true;
//         }
//     } else {
//         // document.getElementById("collision-result").innerHTML = "No collision";
//     }
// });









// var dimFairyLight = new THREE.AmbientLight(new THREE.Color('white'), 0.05);
// dimFairyLight.position.set(0,0,0)
// scene.add(dimFairyLight)


// Create a wireframe box to visualize the bounding box
const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // Adjust dimensions as needed
const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Wireframe color (green, adjust as needed)
    wireframe: true
});
const wireframeBox = new THREE.Mesh(boxGeometry, wireframeMaterial);

// Add the wireframe to the scene
scene.add(wireframeBox);



// terrain
var snapdragon = new THREE.TextureLoader().load("/images/snap-dragon.png")
var nasturtiums = new THREE.TextureLoader().load("/images/nasturtiums.jpg")






// var al = new THREE.AmbientLight(0xffffce, 0.05);
// scene.add(al);
// al.position.set(0, 50, 0)


// setInterval(createClouds, 3000);







// [Timeline("Start")]
window.Animate = function() {
    window.requestAnimationFrame(Animate);
    window.sky.update();
    window.user.handleMovement();
    window.terrain.updateTerrain(window.user.camera.position);
    window.renderer.render(window.scene, window.user.camera);
};


Animate();
