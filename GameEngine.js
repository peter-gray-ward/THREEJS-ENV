import * as THREE from '/three';
import * as PERLIN from '/perlin-noise';
import * as HOUSING from '/housing';
import Delaunator from '/delaunator';

function getX(point) {
    return point.x;
}

function getY(point) {
    return point.y;
}

window.lightmap = []

var T = 70
window.THREE = THREE;
window.w = false;
window.a = false;
window.s = false;
window.d = false;
window.wS = .2;
window.aS = .2;
window.sS = .2;
window.dS = .2;
window.tS = 0.1
window.space = false;
window.ArrowUp = false;
window.ArrowRight = false;
window.ArrowDown = false;
window.ArrowLeft = false;
window.isJumping = false;
window.dom = []
window.BVH = {}
window.buildings = []
window.stage = {
	devGridDots: false,
	userBoxFrame: false,
	sun: {},
	earth: {
		radius: 1000
	},
    terrain: {},
    Sky: [],
    sunAngle: 0,
    sun: {}
}
const FOV = 1300
const TERMINAL_VELOCITY = -.8;
var Grass = [
    '#33462d', //
    '#435c3a', //
    '#4e5e3e', //
    '#53634c', //
    '#53634c', // (duplicate, same as above)
    '#536c46', //
    '#5d6847', //
];
let cloudParticles = [];
window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
window.activeMapIndex = -1;
window.priorMapIndex = -1
window.map = {}
var oceanBackground = null;
window.scene = new THREE.Scene();
window.sceneRadius = 150
window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, FOV);
window.camera.touches = new Set()
window.camera.foot = null;
window.camera.velocity = new THREE.Vector3(0, 0, 0);

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
window.terrain = {}
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
        window.jumpVelocity = 0.52;

    } else if (key == 'ARROWUP') {
        window.ArrowUp = true;
    } else if (key == 'ARROWDOWN') {
        window.ArrowDown = true;
    } else if (key == 'ARROWLEFT') {
        window.ArrowLeft = true;
    } else if (key == 'ARROWRIGHT') {
        window.ArrowRight = true;
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
    }
})
const mossTexture = new THREE.TextureLoader().load("/moss")

function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}


class BVHNode {
    constructor(boundingBox, triangles, left = null, right = null) {
        this.boundingBox = boundingBox;
        this.triangles = triangles;
        this.left = left;
        this.right = right;
    }
}


function buildBVH(triangles, depth = 0) {
    if (triangles.length === 1) {
        return new BVHNode(triangles[0].geometry.boundingBox, [triangles[0]]);
    }

    const axis = depth % 3; // Cycle through x, y, z axes
    triangles.sort((a, b) => a.geometry.boundingBox.min[axis] - b.geometry.boundingBox.min[axis]);

    const mid = Math.floor(triangles.length / 2);
    const leftTriangles = triangles.slice(0, mid);
    const rightTriangles = triangles.slice(mid);

    const leftChild = buildBVH(leftTriangles, depth + 1);
    const rightChild = buildBVH(rightTriangles, depth + 1);

    const boundingBox = new THREE.Box3();
    boundingBox.union(leftChild.boundingBox);
    boundingBox.union(rightChild.boundingBox);

    return new BVHNode(boundingBox, [], leftChild, rightChild);
}


function checkCollision(cameraBoundingVolume, bvhNode) {
    if (!cameraBoundingVolume.intersectsBox(bvhNode.boundingBox)) {
        return null;
    }

    if (bvhNode.triangles.length > 0) {
        for (const triangle of bvhNode.triangles) {
            if (cameraBoundingVolume.intersectsTriangle(triangle.triangle)) {
                return triangle.triangle;
            }
        }
        return null;
    }

    return (
        checkCollision(cameraBoundingVolume, bvhNode.left) ||
        checkCollision(cameraBoundingVolume, bvhNode.right)
    );
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


function GetMeshForTriangle(triangle) {
    for (var i = 0; i < dom.length; i++) {
        if (dom[i].triangle == triangle) {
            var cbb = new THREE.Box3().setFromCenterAndSize(
                camera.position,
                new THREE.Vector3(1, 1, 1) // Adjust the size as needed
            );
            return {
                mesh: dom[i],
                underFoot: TriangleAsUnderFoot(cbb, triangle),
                overHead: TriangleAsOverhead(cbb, triangle)
            }
        }
    }
    return null;
}


function touch(triangleMesh) {
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

function Sun() {
	var pointLight = new THREE.DirectionalLight(0xfffefe, 5);

	pointLight.castShadow = true;
	var halfSize = 1000 * 2;
	pointLight.shadow.camera.left = -halfSize;
	pointLight.shadow.camera.right = halfSize;
	pointLight.shadow.camera.top = halfSize;
	pointLight.shadow.camera.bottom = -halfSize;

    var orb = new THREE.Mesh(
        new THREE.SphereGeometry(3, 100, 100),
        new THREE.MeshBasicMaterial({ color: 0xfffefe })
    );

    stage.sun = pointLight
    stage.orb = orb;
	pointLight.position.set(T * 3, T * 3, 0)
    pointLight.lookAt(origin);
    scene.add(stage.orb)
    scene.add(pointLight)

    for (var i = 0; i < 1000; i++) {
        var y = randomInRange(sceneRadius, sceneRadius * 4);
        var x = randomInRange(-sceneRadius * 10, sceneRadius * 10)
        var z = randomInRange(-sceneRadius * 10, sceneRadius * 10)


        if (x < sceneRadius && x > -sceneRadius && z < sceneRadius && z > -sceneRadius) {
          y = randomInRange(-100, -50)
        }
        var radius = new THREE.Vector3(x,y,z).distanceTo(origin.position) / (sceneRadius * 3) * randomInRange(.1, 1)
        var star = new THREE.Mesh(new THREE.SphereGeometry(radius, 5, 5), new THREE.MeshBasicMaterial({color:0xffffff}));
        star.position.set(x,y,z)

        var dist = star.position.distanceTo(origin.position)
        if (dist > sceneRadius * 2) scene.add(star);

    }

}

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

    const triangleMaterial = new THREE.MeshStandardMaterial({
        // color: new THREE.Color(Math.random(), Math.random(), Math.random()), // Random color for the triangles
        color: 'lawngreen',
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

    // Calculate normal and slope
    const normal = new THREE.Vector3();
    triangleMesh.triangle.getNormal(normal);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);
    triangleMesh.slope = slope;

    return triangleMesh;
}



function heightAt(x, y, noiseWidth, noiseHeight, perlinNoise) {
    const noiseX = Math.floor(x * (noiseWidth - 1));
    const noiseY = Math.floor(y * (noiseHeight - 1));
    return perlinNoise[noiseY * noiseWidth + noiseX] * 55; // Adjust the multiplier for desired height
}


function generateCanvasTexture(width, height, perlinNoise, noiseWidth, noiseHeight, v0, v1, v2, v3) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const gradientMap = {
        beach: [{ r: 218, g: 224, b: 201 }, { r: 200, g: 210, b: 180 }],
        moss: [{ r: 93, g: 183, b: 93 }, { r: 115, g: 200, b: 115 }],
        grass: [{ r: 35, g: 196, b: 34 }, { r: 189, g: 224, b: 93 }],
        rock: [{ r: 100, g: 100, b: 100 }, { r: 120, g: 120, b: 120 }],
        forest: [{ r: 16, g: 87, b: 67 }, { r: 27, g: 167, b: 93 }]
    };

    function blendColors(color1, color2, blendFactor) {
        const r = color1.r * (1 - blendFactor) + color2.r * blendFactor;
        const g = color1.g * (1 - blendFactor) + color2.g * blendFactor;
        const b = color1.b * (1 - blendFactor) + color2.b * blendFactor;
        return { r, g, b };
    }

    function getColor(noiseValue) {
        if (noiseValue < 0.3) {
            return blendColors(gradientMap.beach[0], gradientMap.beach[1], Math.random());
        } else if (noiseValue < 0.4) {
            return blendColors(gradientMap.moss[0], gradientMap.moss[1], Math.random());
        } else if (noiseValue < 0.6) {
            return blendColors(gradientMap.grass[0], gradientMap.grass[1], Math.random());
        } else if (noiseValue < 0.8) {
            return blendColors(gradientMap.rock[0], gradientMap.rock[1], Math.random());
        } else {
            return blendColors(gradientMap.forest[0], gradientMap.forest[1], Math.random());
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const noiseValue = perlinNoise[y * width + x];
            const color = getColor(noiseValue);

            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(x, y, 1, 1);

            // Add detailed textures or additional noise if needed
            // e.g., using ctx.drawImage() to overlay a texture image
        }
    }

    return new THREE.CanvasTexture(canvas);
}

function CREATE_A_ROCK(x, y, z) {
    const rockGeometry = new THREE.BoxGeometry(1, 1, 1); // Simple box for demonstration
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray color
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);

    rock.position.set(x, y, z);

    // Add some randomness to the size and rotation for variety
    rock.scale.set(
        Math.random() * 2 + 0.5, // Random scale between 0.5 and 2.5
        Math.random() * 2 + 0.5,
        Math.random() * 2 + 0.5
    );

    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );

    scene.add(rock);
}

function isFlatSurface(x, y, width, height, perlinNoise) {
    const threshold = 0.1; // Adjust this threshold for "flatness"
    const centerValue = perlinNoise[y * width + x];

    const adjacentValues = [
        perlinNoise[(y - 1) * width + x],
        perlinNoise[(y + 1) * width + x],
        perlinNoise[y * width + (x - 1)],
        perlinNoise[y * width + (x + 1)]
    ];

    for (const value of adjacentValues) {
        if (Math.abs(centerValue - value) > threshold) {
            return false;
        }
    }

    return true;
}

function generateRandomPointsInTriangle(a, b, c, numPoints = 11) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const r1 = Math.random();
        const r2 = Math.random();
        const sqrtR1 = Math.sqrt(r1);

        const x = (1 - sqrtR1) * a.x + sqrtR1 * (1 - r2) * b.x + sqrtR1 * r2 * c.x;
        const y = (1 - sqrtR1) * a.y + sqrtR1 * (1 - r2) * b.y + sqrtR1 * r2 * c.y;
        const z = (1 - sqrtR1) * a.z + sqrtR1 * (1 - r2) * b.z + sqrtR1 * r2 * c.z;

        points.push(new THREE.Vector3(x, y, z));
    }
    return points;
}

function applyHorizontalDisplacement(points, normal, displacementRange = 2) {
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(normal, up).normalize();
    const displacement = (Math.random() - 0.5) * displacementRange;

    points.forEach(point => {
        point.add(axis.clone().multiplyScalar(displacement));
    });
}
function moveMeshAlongNormal(mesh, offset) {
    // Calculate the normal of the mesh's geometry
    const geometry = mesh.geometry;
    geometry.computeVertexNormals();

    // Assuming the mesh is a single triangle
    const normal = new THREE.Vector3();
    const positions = geometry.attributes.position;
    const vertexA = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
    const vertexB = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
    const vertexC = new THREE.Vector3(positions.getX(2), positions.getY(2), positions.getZ(2));

    const triangle = new THREE.Triangle(vertexA, vertexB, vertexC);
    triangle.getNormal(normal);

    // Move the mesh along the normal
    mesh.position.add(normal.multiplyScalar(offset));
}

var logcount = 0
var lightcount = 0
function MakeTrianglesFromTerrainSegments(segments, vertices, indices, dom, scene) {
    var result = {
        cliffs: [],
        ground: [],
        other: []
    }
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            let a = i + j * (segments + 1);
            let b = (i + 1) + j * (segments + 1);
            let c = (i + 1) + (j + 1) * (segments + 1);
            let d = i + (j + 1) * (segments + 1);

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

                

                [t1, t2].forEach(function(t) {
                    const normal = getTriangleNormal(t.triangle);
                    const slope = t.slope;
                    if (slope > 160) {
                        //console.log('creating a flat ground')
                        moveMeshAlongNormal(t, -0.03)
                
                        // t.material.color = 0xffffff
                        scene.add(t);
                        dom.push(t)

                        result.ground.push(t.triangle)

                        if (t.triangle.a.y > 20) {
                            CREATE_A_TREE(t.triangle.a.x, t.triangle.a.y, t.triangle.a.z, 1);
                        }


                    } else if (slope < 107) {
                        moveMeshAlongNormal(t, -0.03)

                        t.material.color.set(new THREE.Color(Math.random(),Math.random(),Math.random()))
                        // scene.add(t);
                        dom.push(t)

                        result.cliffs.push(t.triangle)

                    } else {
                        dom.push(t)

                        result.other.push(t.triangle)

                    
                    }

                });
            } else {
                console.warn(`Invalid indices detected: a=${a}, b=${b}, c=${c}, d=${d}`);
            }
        }
    }

    clusterResult(result)
}

// Helper function to check if two triangles share an edge
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

// Helper function to find connected clusters
function findClusters(triangles) {
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

function createBufferGeometryFromCluster(cluster) {
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


// Main function to process the result object and create geometries for clusters
function clusterResult(result) {
    var rockTexture = new THREE.TextureLoader().load("/random-image?tag=wall")
    // rockTexture.wrapS = THREE.RepeatWrapping;
    // rockTexture.wrapT = THREE.RepeatWrapping;
    // rockTexture.repeat.set(2, 2); // Adjust the repeat value to control the texture scaling
    
    // Process cliff triangles
    const cliffClusters = findClusters(result.cliffs);
    cliffClusters.forEach(cluster => {
        const geometry = createBufferGeometryFromCluster(cluster);
        const material = new THREE.MeshBasicMaterial({ 
            // map: rockTexture,
            color: new THREE.Color(Math.random(),Math.random(),Math.random()),
            side: THREE.DoubleSide ,
            wireframe: true
        });
            
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        moveMeshAlongNormal(mesh, -0.01);
        scene.add(mesh);
    });
}

var dimFairyLight = new THREE.AmbientLight(new THREE.Color('turquoise'), 0.05);
dimFairyLight.position.set(0,0,0)
scene.add(dimFairyLight)

function Terrain(T, v0, v1, v2, v3, segments, options = { slightBay: true }) {
    let vertices = [];
    let indices = [];
    let uvs = [];
    const cellSize = 1;
    const segmentSize = 1 / segments;

    const noiseWidth = T;
    const noiseHeight = T * 2;
    let perlinNoise = PERLIN.generatePerlinNoise(noiseWidth, noiseHeight);

    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            let x = i * segmentSize;
            let y = j * segmentSize;

            let v = new THREE.Vector3();
            v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
            v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
            v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

            let noiseX = Math.floor(x * (noiseWidth - 1));
            let noiseY = Math.floor(y * (noiseHeight - 1));
            let height = perlinNoise[noiseY * noiseWidth + noiseX] * 55;

            v.y += height;

            vertices.push(v.x, v.y, v.z);
            uvs.push(x, y);
        }
    }

    MakeTrianglesFromTerrainSegments(segments, vertices, indices, dom, scene)

    window.BVH = buildBVH(dom);

    const terrainTexture = generateCanvasTexture(noiseWidth, noiseHeight, perlinNoise, noiseWidth, noiseHeight, v0, v1, v2, v3);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;

    var planeGeometry = new THREE.BufferGeometry();
    planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    planeGeometry.setIndex(indices);
    planeGeometry.computeVertexNormals();
    planeGeometry.computeBoundingBox();

    var material = new THREE.MeshStandardMaterial({
        map: terrainTexture,
        side: THREE.DoubleSide,
        wireframe: false
    });

    var mesh = new THREE.Mesh(planeGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    return mesh;
}


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
HAS COLLISION:   ${camera.hasCollision}  ${ camera.hasCollision ? `
    ${camera.triangleTouched.a.x}, ${camera.triangleTouched.a.y}, ${camera.triangleTouched.a.z}
    ${camera.triangleTouched.b.x}, ${camera.triangleTouched.b.y}, ${camera.triangleTouched.b.z}
    ${camera.triangleTouched.c.x}, ${camera.triangleTouched.c.y}, ${camera.triangleTouched.c.z}
` : ''}
JUMPING: ${window.isJumping}
SECTION TOUCHED: <table style="overflow: auto;wmax-width:100vw;">
	<tr>
		<th>uuid</th>
        <th>touch type</th>
        <th>slope</th>
	</tr>
    ${ camera.sectionTouched && camera.sectionTouched.mesh ? `
        <tr>
            <td>${camera.sectionTouched.mesh.uuid}</td>
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



window.Animate = function() {
    window.requestAnimationFrame(Animate);

    var combinedMovement = new THREE.Vector3();

    // Handle movement
    if (window.w || window.a || window.s || window.d) {
        var direction = new THREE.Vector3();
        var right = new THREE.Vector3();
        var forwardMovement = new THREE.Vector3();
        var rightMovement = new THREE.Vector3();

        if (window.w) {
            window.camera.getWorldDirection(direction);
            forwardMovement.add(direction.multiplyScalar(isJumping ? window.wS * 2 : window.wS));
        }
        if (window.a) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(window.aS));
        }
        if (window.s) {
            window.camera.getWorldDirection(direction);
            forwardMovement.add(direction.multiplyScalar(-window.sS));
        }
        if (window.d) {
            window.camera.getWorldDirection(direction);
            right.crossVectors(window.camera.up, direction).normalize();
            rightMovement.add(right.multiplyScalar(-window.dS));
        }

        combinedMovement.add(forwardMovement).add(rightMovement);
    }

    // Handle jump and gravity
    if (window.isJumping) {
        window.camera.position.y += window.jumpVelocity;
        window.jumpVelocity -= 0.03; // Adjust the gravity effect on jump

        // Check for collision with ground using raycasting
        const raycaster = new THREE.Raycaster(window.camera.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(window.terrain, true);

        if (intersects.length > 0 && intersects[0].distance < 1) { // Adjust distance as needed
            const intersection = intersects[0];
            window.isJumping = false;
            window.jumpVelocity = 0;
            window.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
        }
    } else {
        // Gravity
        window.camera.velocity.y += -0.01; // Gravity effect

        // Limit falling speed to terminal velocity
        if (window.camera.velocity.y < TERMINAL_VELOCITY) {
            window.camera.velocity.y = TERMINAL_VELOCITY;
        }

        window.camera.position.y += window.camera.velocity.y;

        // Check for ground collision using raycasting
        const raycaster = new THREE.Raycaster(window.camera.position, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(window.terrain, true);

        if (intersects.length > 0 && intersects[0].distance < 1) { // Adjust distance as needed
            const intersection = intersects[0];
            window.camera.position.y = intersection.point.y + 1; // Adjust for the height of the triangle surface
            window.camera.velocity.y = 0; // Reset vertical velocity upon collision
        }
    }

    // Handle collision detection for horizontal movements
    const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
        camera.position,
        new THREE.Vector3(1, 1, 1) // Adjust the size as needed
    );
    const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
    if (collisionDetected) {
        camera.hasCollision = true;
        camera.triangleTouched = collisionDetected;
        var section = GetMeshForTriangle(collisionDetected);
        camera.sectionTouched = section;
        camera.touches.add(section.mesh);
        // scene.add(section.mesh);

        // Adjust position to stay on top of the triangle
        if (window.camera.position.y < section.mesh.position.y + 1) {
            window.camera.position.y = section.mesh.position.y + 1;
        }

        if (combinedMovement.length() > 0) {
            var triangleNormal = new THREE.Vector3();
            camera.triangleTouched.getNormal(triangleNormal);
            combinedMovement.projectOnPlane(triangleNormal);

            var newPosition = new THREE.Vector3().copy(window.camera.position).add(combinedMovement);
            var isInsideTriangle = isPointInTriangle(newPosition, camera.triangleTouched);

            if (isInsideTriangle) {
                window.camera.position.copy(newPosition);
            } else {
                window.camera.position.add(combinedMovement);
            }
        }
    } else {
        camera.hasCollision = false;
        window.camera.position.add(combinedMovement);
    }

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

    // Nature animations....
    animateClouds();
    AnimateSky();

    if (camera.position.y < 0) {
        if (oceanBackground == null) {
            oceanBackground = document.createElement('div');
            oceanBackground.classList.add('ocean');
            document.body.appendChild(oceanBackground);
        }
    } else {
        if (oceanBackground !== null) {
            oceanBackground.remove();
            oceanBackground = null;
        }
    }

    window.renderer.render(window.scene, window.camera);
};



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





window.terrain = Terrain(T,
    { x: -T, y: 0, z: T },
    { x: T, y: 0, z: T },
    { x: T, y: 0, z: -T },
    { x: -T, y: 0, z: -T },
    100
)
Sun()
Animate();




class Ocean {
    constructor(radius = 550, amplitude = 0.09) {
        this.radius = radius;
        this.amplitude = amplitude;
        this.segments = 1000;
        this.oceanMesh = null;
        this.heightMap = [];
        this.initialYPositions = [];
        this.currentWavePositions = [];
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        this.MakeOcean();
        this.storeInitialYPositions();
        this.WaveOcean();
        // this.EbbOcean();
    }

    _MakeVerticesWithRandomHorizontalAdjustments(segments, v0, v1, v2, v3, negY = -0.05, posY = 0.09, options) {
        let vertices = [];
        let indices = [];
        let uvs = [];
        let map = {};
        this.heightMap = Array.from(Array(segments + 1), () => new Array(segments + 1));


        for (let i = 0; i <= segments; i++) {
            for (let j = 0; j <= segments; j++) {
                let x = (1 - i / segments) * ((1 - j / segments) * v0.x + (j / segments) * v3.x) + 
                        (i / segments) * ((1 - j / segments) * v1.x + (j / segments) * v2.x);
                let z = (1 - i / segments) * ((1 - j / segments) * v0.z + (j / segments) * v3.z) + 
                        (i / segments) * ((1 - j / segments) * v1.z + (j / segments) * v2.z);
                let y = (1 - i / segments) * ((1 - j / segments) * v0.y + (j / segments) * v3.y) + 
                        (i / segments) * ((1 - j / segments) * v1.y + (j / segments) * v2.y);
                y += randomInRange(negY, posY)
                vertices.push(x, y, z);
                uvs.push(i / segments, j / segments);
                map[Math.round(x) + '_' + Math.round(z)] = y;
                this.heightMap[i][j] = y;

                
            }
        }

        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < segments; j++) {
                let a = i * (segments + 1) + j;
                let b = i * (segments + 1) + (j + 1);
                let c = (i + 1) * (segments + 1) + (j + 1);
                let d = (i + 1) * (segments + 1) + j;
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        return { vertices, indices, uvs, map };
    }

    MakeOcean() {
        var radius = this.radius;
        var { vertices, indices, uvs, map } = this._MakeVerticesWithRandomHorizontalAdjustments(
            this.segments,
            new THREE.Vector3(-radius, 0, -radius),
            new THREE.Vector3(-radius, 0, radius),
            new THREE.Vector3(radius, 0, radius),
            new THREE.Vector3(radius, 0, -radius),
            0,
            0,
            {}
        );

        var planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        planeGeometry.setIndex(indices);
        planeGeometry.computeVertexNormals();
        planeGeometry.computeBoundingBox();
        planeGeometry.boundingBox.min.y -= 100;
        // planeGeometry.boundingBox.max.y;

        var material = new THREE.MeshStandardMaterial({ 
            color: 'royalblue',
            map: new THREE.TextureLoader().load("/image?id=572a9275-377c-4e52-be7c-27600a2d4eaf"),
            side: THREE.BackSide,
            opacity: 0.98,
            bumpScale: 0,
            transparent: true,
            // wireframe: true
        });

        this.oceanMesh = new THREE.Mesh(planeGeometry, material);
        this.oceanMesh.name = "touchable::ocean";
        this.oceanMesh.castShadow = true;
        this.oceanMesh.receiveShadow = true;

        this.oceanMesh.surface = map;
        this.oceanMesh.position.set(0,20,0);

        window.ocean = this.oceanMesh;

        scene.add(this.oceanMesh);
    }

    storeInitialYPositions() {
        const positions = this.oceanMesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            this.initialYPositions.push(positions[i + 1]);
        }
    }

    WaveOcean() {
      const positions = this.oceanMesh.geometry.attributes.position.array;
      const time = this.clock.getElapsedTime();
      const frequency = 1.5;
      const amplitude = this.amplitude;
      const segments = this.segments;
      const segmentSize = (this.radius * 2) / segments;

      for (let i = 0; i <= segments; i++) {
          for (let j = 0; j <= segments; j++) {
              const index = (i * (segments + 1) + j) * 3;
              const x = positions[index];
              const z = positions[index + 2];


              
              positions[index + 1] = this.initialYPositions[index / 3] + Math.sin(frequency * (x + time)) * amplitude * Math.sin(frequency * (z + time));

              // Update the height map
              this.heightMap[i][j] = positions[index + 1];
          }
      }

      this.oceanMesh.geometry.attributes.position.needsUpdate = true;
      requestAnimationFrame(this.WaveOcean.bind(this));
    }

    EbbOcean() {
      const positions = this.oceanMesh.geometry.attributes.position.array;
      const time = this.clock.getElapsedTime();
      const waveFrequency = 2.0; // Frequency of the temporary wave
      const waveAmplitude = 0.1; // Amplitude of the temporary wave

      // Calculate temporary wave positions
      for (let i = 0; i < this.initialYPositions.length; i++) {
          const phaseShift = i * 0.1; // Adjust this value for phase shift
          const wavePosition = Math.sin(waveFrequency * (time + phaseShift)) * waveAmplitude;
          this.currentWavePositions[i] = wavePosition;
      }

      // Apply temporary wave to ocean mesh
      for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] = this.initialYPositions[i / 3] + this.currentWavePositions[i / 3];
      }

      this.oceanMesh.geometry.attributes.position.needsUpdate = true;
      requestAnimationFrame(this.EbbOcean.bind(this));
    }

    getHeightAtPosition(x, z) {
        const segmentSize = (this.radius * 2) / this.segments;
        const gridX = Math.floor((x + this.radius) / segmentSize);
        const gridZ = Math.floor((z + this.radius) / segmentSize);

        // Ensure the position is within the height map bounds
        if (gridX < 0 || gridX >= this.segments || gridZ < 0 || gridZ >= this.segments) {
            return 0; // Return 0 if out of bounds, adjust as needed
        }

        // Bilinear interpolation to get the height at the exact position
        const x1 = gridX * segmentSize - this.radius;
        const x2 = (gridX + 1) * segmentSize - this.radius;
        const z1 = gridZ * segmentSize - this.radius;
        const z2 = (gridZ + 1) * segmentSize - this.radius;

        const Q11 = this.heightMap[gridX][gridZ];
        const Q12 = this.heightMap[gridX][gridZ + 1];
        const Q21 = this.heightMap[gridX + 1][gridZ];
        const Q22 = this.heightMap[gridX + 1][gridZ + 1];

        const height = (Q11 * (x2 - x) * (z2 - z) +
                        Q21 * (x - x1) * (z2 - z) +
                        Q12 * (x2 - x) * (z - z1) +
                        Q22 * (x - x1) * (z - z1)) / ((x2 - x1) * (z2 - z1));

        return height;
    }
}


new Ocean()


function createDome() {
  var gridSize = 20;
  var planeSize = 120; // Adjust this size to your preference
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

function createSky() {
        const vertexShader = `
        varying vec3 vPosition;

        void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // Fragment shader
    const fragmentShader = `
        varying vec3 vPosition;

        uniform vec3 sunPosition;

        void main() {
            float intensity = dot(normalize(vPosition), normalize(sunPosition));
            intensity = clamp(intensity, 0.0, 1.0);

            vec3 color = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 0.5, 1.0), intensity);
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    // Shader material
    const skyMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.8
    });

    // Create the sky sphere
    const skyGeometry = new THREE.SphereGeometry(500, 100, 100);
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);

    // Return the sky mesh
    sky.position.set(0,0,0)
    stage.skySphere = sky
    scene.add(sky)
}

createDome()
// createSky()

function AnimateSky() {
  var T2 = T * 2;
  var T3 = sceneRadius * 2.5
  var x = T3 * Math.cos(stage.sunAngle);
  var y = T3 * Math.sin(stage.sunAngle);

  stage.sun.position.set(x, y, stage.sun.position.z);
  stage.orb.position.set(x, y, stage.sun.position.z);

  for (var i = 0; i < stage.Sky.length; i++) {
      var distanceToSun = stage.Sky[i].position.distanceTo(stage.sun.position);

      if (distanceToSun < sunMinDist) sunMinDist = distanceToSun
      if (distanceToSun > sunMaxDist) sunMaxDist = distanceToSun


      // Calculate intensity based on distance
      var intensity = 1 - (distanceToSun / sunMaxDist);

      // Ensure intensity stays within valid range (0 to 1)
      intensity = Math.max(0, Math.min(1, intensity));

      // Define the colors for the gradient (white for close, dark blue for far)
      var colorNear = new THREE.Color('#4287f5');
      var colorFar = new THREE.Color('#4287f5');

      // Optionally, adjust opacity further to smooth the transition
      

      // Interpolate between the colors based on intensity
      var color = new THREE.Color().lerpColors(colorFar, colorNear, intensity);

      // Update the color of the plane's material
      stage.Sky[i].material.color.copy(color);
      stage.Sky[i].material.needsUpdate = true; // Ensure material update
      // Optionally, adjust material opacity based on intensity for a smoother transition
        
      if (stage.sun.position.y > 0) {
        intensity = 1
    }


        stage.Sky[i].material.opacity = Math.pow(intensity, 2)
      
      // if (distanceToSun > maxDistance) stage.Sky[i].material.opacity = Math.sqrt(opacity, 3);
      stage.Sky[i].lookAt(camera.position.x, camera.position.y, camera.position.z);
  }


  stage.sunAngle += .003;
  
  if (stage.sunAngle > Math.PI * 2) {
    stage.sunAngle = 0
  }
}



function createClouds() {
  const sceneRadius = FOV; // Define scene radius for cloud distribution

  // Create cumulonimbus cloud particles
  for (let i = 0; i < 3; i++) {
    const cloudNodeCount = randomInRange(20,30); // More particles for cumulonimbus clouds
    const positions = new Float32Array(cloudNodeCount * 3);

    for (let j = 0; j < cloudNodeCount; j++) {
      const x = randomInRange(-randomInRange(40, 80), randomInRange(40, 80));
      const y = randomInRange(0, 200); // Taller cloud structure
      const z = randomInRange(-randomInRange(40, 80), randomInRange(40, 80));

      positions[j * 3] = x;
      positions[j * 3 + 1] = y;
      positions[j * 3 + 2] = z;
    }

    const cloudGeometry = new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const cloudMaterial = new THREE.PointsMaterial({ 
      color: stage.sun.position.y < 0 ? 0x495a75 : 0xffffff,//, 
      size: randomInRange(20, 100), 
      transparent: true, 
      opacity: 0.6 
    });
    const cloud = new THREE.Points(cloudGeometry, cloudMaterial);
    cloud.castShadow = true;
    cloud.receiveShadow = true;
    cloud.position.set(
      randomInRange(-100 * 3, 100 * 3),
      randomInRange(30, 150), // Clouds height range
      randomInRange(-100 * 3, 100 * 3)
    );
    scene.add(cloud);
    cloudParticles.push(cloud);
  }
}


var al = new THREE.AmbientLight(0xffffce, 0.05);
scene.add(al);
al.position.set(0, 50, 0)


function animateClouds() {
  const cloudSpeed = .1; // Adjust the speed as needed
  cloudParticles.forEach(cloud => {
    cloud.position.x += cloudSpeed;
    if (cloud.position.x > FOV) {
      cloud.position.x = -FOV; // Wrap around to the other side
    }
  });
}


// setInterval(createClouds, 3000);


function getRandomShadeOfGreen() {
    // Generate a random green value between 0 and 255
    const greenValue = Math.floor(Math.random() * 256);
    // Create a new THREE.Color object with the random green value
    const color = new THREE.Color(Math.random() < 0.05 ? randomInRange(0, 0.5) : 0, greenValue / 255, Math.random() < 0.5 ? randomInRange(0, 0.1) : 0);
    return color;
}

function CREATE_A_TREE(x, y, z, alternate) {
    var trunkHeight = randomInRange(4, 6)
    var trunkBaseRadius = randomInRange(.01, .2)
    var rr = alternate ? randomInRange(.01, .1) : randomInRange(.1, .5)
    var trunkCurve = []
    var trunkRadius = []

    const barkTexture = new THREE.TextureLoader().load("/tree1/bark.jpg")

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
    var foliageRadius = randomInRange(1, 1.5)
    const sphereGeometry = new THREE.SphereGeometry(foliageRadius, 10, 10);
    let sphereMaterial = new THREE.MeshStandardMaterial({
        color: getRandomShadeOfGreen(),
        transparent: true,
        opacity: randomInRange(0.7, 1)
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

    const material = new THREE.MeshBasicMaterial({ 
        map: barkTexture,
        // color: 'red',
        side: THREE.DoubleSide
    });

    // Create the mesh
    const tubeMesh = new THREE.Mesh(tubeGeometry, material);
    // tubeMesh.castShadow = true
    // tubeMesh.receiveShadow = true
    tubeMesh.position.y -= 2

    // Add the mesh to the scene
    scene.add(tubeMesh);  
}



Watch()



