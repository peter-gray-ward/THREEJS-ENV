import * as THREE from '/three';
import * as PERLIN from '/perlin-noise';

window.THREE = THREE;

window.w = false;
window.a = false;
window.s = false;
window.d = false;
window.wS = .03;
window.aS = .03;
window.sS = .01;
window.dS = .03;
window.tS = 0.075
window.space = false;
window.ArrowUp = false;
window.ArrowRight = false;
window.ArrowDown = false;
window.ArrowLeft = false;
window.isJumping = false;

window.BVH = {}
window.stage = {
	devGridDots: false,
	userBoxFrame: false,
	sun: {},
	earth: {
		radius: 1000
	},
    terrain: {}
}

window.activeMapIndex = -1;
window.priorMapIndex = -1
window.map = {}

window.scene = new THREE.Scene();
window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
window.camera.touches = new Set()
window.camera.foot = null;
window.scene.add(window.camera);
window.renderer = new THREE.WebGLRenderer();
window.renderer.setSize(window.innerWidth, window.innerHeight);
window.renderer.shadowMap.enabled = true;
window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.renderer.domElement.id = "view";
document.body.appendChild(window.renderer.domElement);


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
        return false;
    }

    if (bvhNode.triangles.length > 0) {
        for (const triangle of bvhNode.triangles) {
            if (cameraBoundingVolume.intersectsTriangle(triangle.triangle)) {
                return true;
            }
        }
        return false;
    }

    return (
        checkCollision(cameraBoundingVolume, bvhNode.left) ||
        checkCollision(cameraBoundingVolume, bvhNode.right)
    );
}

const cellSize = 10; // Define your cell size
let grid = {};

function addToGrid(triangle) {
    const boundingBox = triangle.geometry.boundingBox;
    const minCell = new THREE.Vector3(
        Math.floor(boundingBox.min.x / cellSize),
        Math.floor(boundingBox.min.y / cellSize),
        Math.floor(boundingBox.min.z / cellSize)
    );
    const maxCell = new THREE.Vector3(
        Math.floor(boundingBox.max.x / cellSize),
        Math.floor(boundingBox.max.y / cellSize),
        Math.floor(boundingBox.max.z / cellSize)
    );

    for (let x = minCell.x; x <= maxCell.x; x++) {
        for (let y = minCell.y; y <= maxCell.y; y++) {
            for (let z = minCell.z; z <= maxCell.z; z++) {
                const cellKey = `${x}_${y}_${z}`;
                if (!grid[cellKey]) {
                    grid[cellKey] = [];
                }
                grid[cellKey].push(triangle);
            }
        }
    }
}

// Add all triangles to the grid

function getCellKey(position) {
    const cellX = Math.floor(position.x / cellSize);
    const cellY = Math.floor(position.y / cellSize);
    const cellZ = Math.floor(position.z / cellSize);
    return `${cellX}_${cellY}_${cellZ}`;
}

function checkCollisionWithGrid(cameraBoundingVolume) {
    const minCell = getCellKey(cameraBoundingVolume.min);
    const maxCell = getCellKey(cameraBoundingVolume.max);

    for (let x = minCell.x; x <= maxCell.x; x++) {
        for (let y = minCell.y; y <= maxCell.y; y++) {
            for (let z = minCell.z; z <= maxCell.z; z++) {
                const cellKey = `${x}_${y}_${z}`;
                const triangles = grid[cellKey];
                if (triangles) {
                    for (const triangle of triangles) {
                        if (cameraBoundingVolume.intersectsTriangle(triangle.triangle)) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}




function generatePointsInTriangle(v0, v1, v2, numPoints) {
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
        for (let j = 0; j < numPoints; j++) {
            const u = i / (numPoints - 1);
            const v = j / (numPoints - 1);
            

            if (u + v <= 1) {
            	const vector = new THREE.Vector3()
                    .addScaledVector(v0, 1 - u - v)
                    .addScaledVector(v1, u)
                    .addScaledVector(v2, v);
           
                points.push(vector);
            }
        }
    }
    
    return points;
}


function touch(triangleMesh) {
}
function checkCollisionsWithGrid(cameraBoundingBox, grid) {
    for (const cellKey in grid) {
        const triangles = grid[cellKey];
        for (const triangle of triangles) {
            if (checkCollision(cameraBoundingBox, triangle.triangle)) {
                scene.add(triangle); // Visualize the intersecting triangle
                camera.touches.add(triangle); // Add to touches
                scene.add(cameraBoundingBox); // Visualize the camera bounding box
                return; // Exit after first collision is detected
            }
        }
    }
}



// Function to get the adjacent indices
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

function calculateCentroid(vertices, a, b, c) {
    const ax = vertices[a * 3];
    const ay = vertices[a * 3 + 1];
    const az = vertices[a * 3 + 2];

    const bx = vertices[b * 3];
    const by = vertices[b * 3 + 1];
    const bz = vertices[b * 3 + 2];

    const cx = vertices[c * 3];
    const cy = vertices[c * 3 + 1];
    const cz = vertices[c * 3 + 2];

    return new THREE.Vector3(
        (ax + bx + cx) / 3,
        (ay + by + cy) / 3,
        (az + bz + cz) / 3
    );
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
	var pointLight = new THREE.PointLight(0xfffefe, 999999);

	pointLight.castShadow = true;
	var halfSize = 1000 * 2;
	pointLight.shadow.camera.left = -halfSize;
	pointLight.shadow.camera.right = halfSize;
	pointLight.shadow.camera.top = halfSize;
	pointLight.shadow.camera.bottom = -halfSize;

	scene.add(pointLight)
	pointLight.position.set(0, 100, 0)
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

    const triangleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()), // Red color for the triangles
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

    var points = generatePointsInTriangle(triangleMesh.triangle.a, triangleMesh.triangle.b, triangleMesh.triangle.c, 21);
    triangleMesh.points = points;

    return triangleMesh
}

function Terrain(T, v0, v1, v2, v3, segments, options = { slightBay: true }) {
    // Initialize arrays to store vertices, indices, and uvs
    let vertices = [];
    let indices = [];
    let uvs = [];
    const cellSize = 10; // Define cell size based on the desired radius

    // Calculate segment size
    const segmentSize = 1 / segments;

    const noiseWidth = T;
    const noiseHeight = T * 2;
    const perlinNoise = PERLIN.generatePerlinNoise(noiseWidth, noiseHeight);

    // Step 1: Create vertices and uvs
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
            let height = perlinNoise[noiseY * noiseWidth + noiseX] * 55; // Adjust the multiplier for desired height

            v.y += height;

            vertices.push(v.x, v.y, v.z);
            uvs.push(x, y);
        }
    }

    // Function to calculate the centroid of a triangle
    function calculateCentroid(vertices, a, b, c) {
        const ax = vertices[a * 3];
        const ay = vertices[a * 3 + 1];
        const az = vertices[a * 3 + 2];

        const bx = vertices[b * 3];
        const by = vertices[b * 3 + 1];
        const bz = vertices[b * 3 + 2];

        const cx = vertices[c * 3];
        const cy = vertices[c * 3 + 1];
        const cz = vertices[c * 3 + 2];

        return new THREE.Vector3(
            (ax + bx + cx) / 3,
            (ay + by + cy) / 3,
            (az + bz + cz) / 3
        );
    }

    // Function to determine the cell key based on a position
    function getCellKey(position) {
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        const cellZ = Math.floor(position.z / cellSize);
        return `${cellX}_${cellY}_${cellZ}`;
    }

    var triangles = []

    // Step 2: Create indices for triangles and store in map
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            let a = i + j * (segments + 1);
            let b = (i + 1) + j * (segments + 1);
            let c = (i + 1) + (j + 1) * (segments + 1);
            let d = i + (j + 1) * (segments + 1);

            // Add boundary checks
            if (a >= 0 && b >= 0 && c >= 0 && d >= 0 &&
                a < vertices.length / 3 && b < vertices.length / 3 && c < vertices.length / 3 && d < vertices.length / 3) {
                // Triangle 1
                indices.push(a, b, d);
                let centroid1 = calculateCentroid(vertices, a, b, d);
                let partitionKey1 = getCellKey(centroid1);
                if (!map[partitionKey1]) {
                    map[partitionKey1] = [];
                }
                const t1 = TriangleMesh(vertices, a, b, d)
                map[partitionKey1].push(t1);


                // Triangle 2
                indices.push(b, c, d);
                let centroid2 = calculateCentroid(vertices, b, c, d);
                let partitionKey2 = getCellKey(centroid2);
                if (!map[partitionKey2]) {
                    map[partitionKey2] = [];
                }
                const t2 = TriangleMesh(vertices, b, c, d)
                map[partitionKey2].push(t2);

                triangles.push(t1, t2);

            } else {
                console.warn(`Invalid indices detected: a=${a}, b=${b}, c=${c}, d=${d}`);
            }
        }

        window.BVH = buildBVH(triangles);
    }

    // Step 3: Create geometry and mesh
    var planeGeometry = new THREE.BufferGeometry();
    planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // Adding UVs to geometry
    planeGeometry.setIndex(indices);
    planeGeometry.computeVertexNormals();
    planeGeometry.computeBoundingBox();

    var material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        wireframe: true,
        side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(planeGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;


    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    

    return mesh;
}





var al = new THREE.AmbientLight(0xfffefe, 3);
al.position.set(0,0,0);
scene.add(al)

camera.position.y = 50

function Watch() {
	requestAnimationFrame(Watch)
	p.innerHTML = `
CAMERA:   ${camera.position.x}, ${camera.position.y}, ${camera.position.z}
HAS COLLISION:   ${camera.hasCollision}
TOUCHING: (${Array.from(camera.touches).length}) <table style="overflow: auto;wmax-width:100vw;">
	<tr>
		<th>uuid</th>
		<th>position</th>
		<th>distance</th>
	</tr>
	${Array.from(camera.touches)
        .filter(a => a instanceof THREE.Vector3)
		.map(o => `<tr>
		<td style="border: 1px solid rgba(255,11,11,0.5)">${o.uuid}</td>
		<td style="border: 1px solid rgba(255,255,11,0.5)">${o.x.toFixed(3)}, ${o.y.toFixed(3)}, ${o.z.toFixed(3)}</td>
		<td style="border: 1px solid rgba(255,11,255,0.5)">${camera.position.distanceTo(o)}</td>
	</tr>`).join('')}
</table>
`
}





window.Animate = function() {
    window.requestAnimationFrame(Animate)
    if (window.w) {
        var direction = new THREE.Vector3();
        window.camera.getWorldDirection(direction);
        direction.multiplyScalar(window.wS);
        window.camera.position.add(direction);
    }
    if (window.a) {
        var direction = new THREE.Vector3();
        var right = new THREE.Vector3();
        window.camera.getWorldDirection(direction);
        right.crossVectors(window.camera.up, direction).normalize();
        right.multiplyScalar(window.aS);
        window.camera.position.add(right);
    }
    if (window.s) {
        var direction = new THREE.Vector3();
        window.camera.getWorldDirection(direction);
        direction.multiplyScalar(-window.sS);
        window.camera.position.add(direction);
    }
    if (window.d) {
        var direction = new THREE.Vector3();
        var right = new THREE.Vector3();
        window.camera.getWorldDirection(direction);
        right.crossVectors(window.camera.up, direction).normalize();
        right.multiplyScalar(-window.dS);
        window.camera.position.add(right);
    }
    if (window.ArrowUp || window.ArrowDown) {

        if (window.ArrowUp) {
            camera.rotateX(window.tS)
        }

        if (window.ArrowDown) {
            camera.rotateX(-window.tS)
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

    const cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(
        camera.position,
        new THREE.Vector3(1, 1, 1) // Adjust the size as needed
    );
    const collisionDetected = checkCollision(cameraBoundingBox, window.BVH);
    if (collisionDetected) {
        camera.hasCollision = true;
    } else {
        camera.hasCollision = false;
    }

    window.renderer.render(window.scene, window.camera)
}

function UPDATE(cameraPosition, map) {
    const cellSize = 10; // Should match the cell size used in Terrain function

    // Determine the current map index based on the camera position
    const currentX = Math.floor(cameraPosition.x / cellSize);
    const currentY = Math.floor(cameraPosition.y / cellSize);
    const currentZ = Math.floor(cameraPosition.z / cellSize);
    const currentMapIndex = `${currentX}_${currentY}_${currentZ}`;

    // Update activeMapIndex and priorMapIndex
    if (window.activeMapIndex !== currentMapIndex) {
        window.priorMapIndex = window.activeMapIndex;
        window.activeMapIndex = currentMapIndex;

        // Remove meshes from the prior map index
        if (window.priorMapIndex !== -1) {
            let priorIndices = getAdjacentIndices(window.priorMapIndex);
            priorIndices.forEach(index => {
                if (map[index]) {
                    map[index].forEach(mesh => scene.remove(mesh));
                }
            });
        }

        camera.touches = new Set()

        // // Add meshes for the active map index and its neighbors
        let activeIndices = getAdjacentIndices(window.activeMapIndex);
        var mindist = Infinity
        var triangles = []
        activeIndices.forEach(index => {
            if (map[index]) {
                map[index].forEach(cell => {
                    const cameraBoundingBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 'red', wireframe: true }))
                    if (cameraBoundingBox.intersectsTriangle(cell.triangle)) {
                        scene.add(cell);
                        camera.touches.add(cell)
                        scene.add(cameraBoundingBox);
                    }
                });
            }
        });
    }

    if (window.camera.foot == null) {
        window.camera.position.y += -0.01;
    }
}


var T = 64
var terrain = Terrain(T,
    { x: -T, y: 0, z: T },
    { x: T, y: 0, z: T },
    { x: T, y: 0, z: -T },
    { x: -T, y: 0, z: -T },
    100
)
Sun()
Animate();
Watch()
