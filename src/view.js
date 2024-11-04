import * as THREE from '/lib/Three.module.min.js';

import { CSG } from '/lib/CSG.js'
import { SUBTRACTION, Brush, Evaluator } from '/lib/three-bvh-csg.js';
import ViewModel from "/src/view-model.js";
import { Reflector } from '/lib/Reflector.js'

var debounced_event = undefined

window.CONCRETE = new THREE.TextureLoader().load("/images/seraphic-metallic-texture-polished-concrete.avif", texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(11, 11);
})
window.GROUND2 = new THREE.TextureLoader().load("/images/ground-2.JPG",texture => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.rotation = Math.random() * Math.PI * 2
    texture.repeat.set(100, 100)
})
window.rockTexture = new THREE.TextureLoader().load("/images/dry-rough-rock-face-texture.jpg", texture => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
})
window.CYPRESSGREENS = ['#93b449', '#6b881c', '#a9cc4e']
window.LATHECOLORS = ['#00ffff', '#ff00ff', '#ffff00']
window.CYPRESSBRANCH = new THREE.TextureLoader().load("/images/branch.webp")
window.TRUNKTEXTURE = new THREE.TextureLoader().load("/images/bark-5.jpg")
window.cementTexture = new THREE.TextureLoader().load("/images/ground-0.jpg", texture => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.rotation = Math.random() * Math.PI * 2
    texture.repeat.set(100, 100)
})
var clock = new THREE.Clock()
const evaluator = new Evaluator();
const t = 100
const groundTexture = new THREE.TextureLoader().load("/images/ground-0.jpg", texture => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(11, 11)
})

var landscape = {
    field: {
        center: {
            x: 0,
            y: 10,
            z: 0
        },
        width: 50,
        depth: 35
    }
}
landscape = { ...landscape, ...landscape.field }

var house = {
    center: landscape.field.center,
    width: 30,
    depth: 20,
    height: 3,
    foundation: {
        width: 20,
        height: 1,
        depth: 20
    }
}
var dockDepth = house.width
const boardwalk = {
    width: (landscape.field.width / 2) - (house.width / 2),
    depth: dockDepth,
    height: 0.2,
    center: {
        x: (house.width / 2) + (((landscape.field.width / 2) - (house.width / 2)) / 2),
        y: house.center.y + .1,
        z: 0
    }
}
const boardwalk2 = {
    width: house.width,
    depth: landscape.field.depth - boardwalk.depth,
    height: 0.2,
    center: {
        x: house.center.x,
        y: boardwalk.center.y,
        z: (house.center.z + house.depth / 2) + ((landscape.field.depth - boardwalk.depth) / 2)
    }
}

const alley = {
    width: house.width,
    depth: landscape.field.depth - boardwalk.depth,
    height: 0.2,
    center: {
        x: house.center.x,
        y: boardwalk.center.y,
        z: (house.center.z - house.depth / 2) - ((landscape.field.depth - boardwalk.depth) / 2)
    }
}




class RailingCurve extends THREE.Curve {
    constructor(frequency = Math.PI, amplitude) {
        super()
        this.frequency = frequency
        this.amplitude = amplitude
    }
    getPoint(t) {
        const z = t * 2
        const y = Math.sin(this.frequency * z) * this.amplitude
        return new THREE.Vector3(0, y, z)
    }
}

function RailingPost(start, end, scale = 0.01, ballScale = 5, justPost = false) {

    var post = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.75, 0.075),
        new THREE.MeshStandardMaterial({ 
            map: CONCRETE,
        })
    );
    post.position.y = 0.75 / 2;

    var postCapShape = new THREE.Shape();
    postCapShape.moveTo(0, 0);
    postCapShape.lineTo(scale, 0);
    postCapShape.lineTo(scale, scale);
    postCapShape.lineTo(0, scale);
    postCapShape.lineTo(0, 0);

    var postCap = new THREE.Mesh(
        new THREE.ExtrudeGeometry(postCapShape, {
            steps: 6,
            depth: .03,
            bevelThickness: scale,
            bevelSize: scale * 7,
            bevelOffset: 0,
            bevelSegments: 11
        }),
        new THREE.MeshStandardMaterial({ 
            color: 'red',
            roughness: 0,
            metalness: 1
        })
    );
    postCap.rotation.x = Math.PI / 2
    postCap.position.y = 0.75; // Place on top of the post

    var postCap2 = new THREE.Mesh(
        new THREE.ExtrudeGeometry(postCapShape, {
            steps: 6,
            depth: .03,
            bevelThickness: scale * .9,
            bevelSize: scale * 5,
            bevelOffset: 0,
            bevelSegments: 11
        }),
        new THREE.MeshStandardMaterial({ 
            color: 'red',
            roughness: 0,
            metalness: 1
         })
    );
    postCap2.rotation.x = Math.PI / 2
    postCap2.position.y = 0.8; // Place on top of the post

    // Create the post ball
    var postBall = new THREE.Mesh(
        new THREE.SphereGeometry(scale * ballScale, 8, 8),
        new THREE.MeshBasicMaterial({ 
            color: 'red',
            transparent: true,
            opacity: 0.2
         })
    );
    postBall.position.y = 0.85; // Place on top of the cap


    var amplitude = 0.1

    var railingCurve = new RailingCurve(11, amplitude)

    var postRailing = new THREE.Mesh(
        new THREE.TubeGeometry(railingCurve, Math.floor(randomInRange(8, 50)), .01),
        new THREE.MeshStandardMaterial({ 
            map: new THREE.TextureLoader().load("/images/bark-5.jpg")
         })
    )
    postRailing.position.y = 0.75; // Place on top of the post

    // Group the parts together
    var group = new THREE.Group();
    
    if (ballScale >= 5) {
        group.add(post);
        group.add(postCap);
        group.add(postCap2)
    }
    if (!justPost) {
        group.add(postRailing)
    }
    group.add(postBall);


    // Set the overall position of the group
    group.position.set(start.x - .2, start.y, start.z);

    for (var child of group.children) {
        child.castShadow = true
        child.receiveShadow = true
    }

    
    return group;
}




const COVEZ = randomInRange(3, 10)

function isIn(v, which) {
   
        
    switch (which) {
    case 'yard':
        return v.x > landscape.center.x - landscape.width / 2
            && v.x < landscape.center.x + landscape.width / 2
            && v.z > landscape.center.z - landscape.depth / 2
            && v.z < landscape.center.z + landscape.depth / 2
    case 'house':
        return v.x > house.center.x - house.width / 2
            && v.x < house.center.x + house.width / 2
            && v.z > house.center.z - house.depth / 2
            && v.z < house.center.z + house.depth / 2
    case 'sideyard':
        return (
            v.x >= (house.center.z - house.foundation.depth / 2 - 5) && 
            v.x <= (house.center.x - house.foundation.width / 2 - 30) &&
            v.y >= (house.center.y - house.foundation.height / 2) && 
            v.y <= (house.center.y + house.foundation.height / 2) &&
            v.z >= (house.center.z - house.foundation.depth / 2 - 50) && 
            v.z <= (house.center.z - house.foundation.depth / 2 - 5)
        );
    case 'backyard':
        return (
            v.x <= house.center.x - house.foundation.width / 2
        )
    case 'dock':
        return (
            v.x > boardwalk.center.x + boardwalk.width / 2
            && v.x < boardwalk.center.x + boardwalk.depth
            && v.z > boardwalk.center.z - boardwalk.depth / 2
            && v.z < boardwalk.center.z + boardwalk.depth / 2
        )
    case 'cove':
        const dockEndX = boardwalk.center.x + boardwalk.width / 2 + 20;
        const windingZ = Math.sin((v.x - dockEndX) / t * Math.PI * 2) * 10;  // Winding factor
        const inXRange = v.x > dockEndX && v.x < t + 20;
        const inZRange = Math.abs(v.z - boardwalk.center.z - windingZ) < COVEZ; // Width of the winding path
        return (inXRange && inZRange)
    
    default:
        return false;
    }
}

function randomPointOnTriangle(A, B, C) {
    // Generate two random numbers between 0 and 1
    let u = Math.random();
    let v = Math.random();

    // If u + v > 1, flip the coordinates to keep the point inside the triangle
    if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
    }

    // Calculate the random point P on the triangle
    const P = new THREE.Vector3();
    P.addScaledVector(A, 1 - u - v);
    P.addScaledVector(B, u);
    P.addScaledVector(C, v);

    return P;
}

var RANDOMIMAGES = []
// for (var i = 0; i < 100; i++) {
//     var xhr = new XMLHttpRequest()
//     xhr.open('GET', '/random-image?time=' + Math.random())
//     xhr.addEventListener('load', function() {
//         RANDOMIMAGES.push(this.response)
//     })
//     xhr.send()
// }

var twoPi = Math.PI * 2
function piBy01() {
    var arr = []
    for (var i = 0; i < twoPi; i += .01) {
        arr.push(i)
    }
    return arr
}

function interpolateArrays(array1, array1Index, array2) {
    var sourceIndexPercent = new Number(array1Index / array1.length).toFixed(2)
    var targetIndex = Math.floor(array2 / sourceIndexPercent)
    return array2[targetIndex]
}

var pillars = []
var composer

window.THREE = THREE;

const cameraBoundingBox = () => new THREE.Box3().setFromCenterAndSize(
    window.user.camera.position,
    new THREE.Vector3(.35, 1.2, .2) // Adjust size if needed
);

window.sliding = false


window.GRAVITY = -0.05
window.TERMINAL_VELOCITY = -.5,

window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
window.map = {}
var oceanBackground = null;

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

window.sceneRadius = 150

var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
// Global bounding box for the camera

function getPositionFromVertexArray(array) {
    const positions = [];
    // Iterate through the array, stepping by 3 to group (x, y, z) coordinates
    for (let i = 0; i < array.length; i += 3) {
        const position = {
            x: array[i],        // x coordinate
            y: array[i + 1],    // y coordinate
            z: array[i + 2]     // z coordinate
        };
        positions.push(position);
    }
    return positions;
}

function asdwFromNormalAndDistance(normal, cameraPosition, intersectionPoint) {
    const movementKeys = [];

    // Calculate the vector from the camera to the intersection point
    const directionToIntersection = [
        intersectionPoint[0] - cameraPosition[0],
        intersectionPoint[1] - cameraPosition[1],
        intersectionPoint[2] - cameraPosition[2]
    ];

    // Normalize the directionToIntersection vector
    const magnitude = Math.sqrt(
        directionToIntersection[0] ** 2 +
        directionToIntersection[1] ** 2 +
        directionToIntersection[2] ** 2
    );
    const normalizedDirection = [
        directionToIntersection[0] / magnitude,
        directionToIntersection[1] / magnitude,
        directionToIntersection[2] / magnitude
    ];

    // Dot product of the normal and the direction from the camera
    const dotProduct = 
        normalizedDirection[0] * normal[0] +
        normalizedDirection[1] * normal[1] +
        normalizedDirection[2] * normal[2];

    // Determine if the intersection is in front (forward) or behind (backward)
    if (dotProduct > 0) {
        movementKeys.push('W'); // Move forward (W) toward the surface
    } else if (dotProduct < 0) {
        movementKeys.push('S'); // Move backward (S) away from the surface
    }

    // Cross product for determining left (A) or right (D)
    const rightVector = [
        cameraPosition[1] * normal[2] - cameraPosition[2] * normal[1],
        cameraPosition[2] * normal[0] - cameraPosition[0] * normal[2],
        cameraPosition[0] * normal[1] - cameraPosition[1] * normal[0]
    ];

    // Dot product of the right vector and the direction to the intersection
    const dotRight = 
        normalizedDirection[0] * rightVector[0] +
        normalizedDirection[1] * rightVector[1] +
        normalizedDirection[2] * rightVector[2];

    // Determine left (A) or right (D) movement
    if (dotRight > 0) {
        movementKeys.push('D'); // Move right (D)
    } else {
        movementKeys.push('A'); // Move left (A)
    }

    return movementKeys;
}

function mapToRange(normalizedValue, minNew, maxNew) {
    return minNew + normalizedValue * (maxNew - minNew);
}

function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}

class GrassPatch {
    constructor(initobject) {
        this.mesh = initobject.mesh;
        this.triangle = initobject.triangle
        this.bladePositions = initobject.bladePositions;
        this.ground = initobject.ground
    }
}


function TriangleMesh(vertices, a, b, c, terrainWidth, terrainHeight, map) {

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
        wireframe: false,
        map,
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
    triangleMesh.triangle.indices = [0,1,2]

    // Calculate the triangle's normal and slope
    const normal = new THREE.Vector3();
    triangleMesh.triangle.getNormal(normal);
    const slope = Math.acos(normal.dot(new THREE.Vector3(0, 1, 0))) * (180 / Math.PI);

    triangleMesh.slope = slope;
    triangleMesh.normal = normal;
    triangleMesh.triangle.uvs = uvs;  // Store UVs for later use (e.g., for texture painting)

    return triangleMesh;
}


function Triangle(vertices, a, b, c) {
    const vertexPositions = [
        vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],  // Vertex a
        vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],  // Vertex b
        vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]   // Vertex c
    ];

    for (var i = 0; i < vertexPositions.length; i++) {
        if (Number.isNaN(vertexPositions[i])) {
            debugger
        }
    }

    // Create the THREE.Triangle object
    const triangle = new THREE.Triangle(
        new THREE.Vector3(vertexPositions[0], vertexPositions[1], vertexPositions[2]),
        new THREE.Vector3(vertexPositions[3], vertexPositions[4], vertexPositions[5]),
        new THREE.Vector3(vertexPositions[6], vertexPositions[7], vertexPositions[8])
    );

    // Set up indices (for BufferGeometry)
    const indices = [0, 1, 2];  // Indices for a single triangle (points a, b, c)

    // Create the BufferGeometry
    const triangleGeometry = new THREE.BufferGeometry();
    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexPositions), 3));
    triangleGeometry.setIndex(indices);
    triangleGeometry.computeBoundingBox()

    // Create a mesh for the triangle with a basic material (optional)
    const triangleMesh = new THREE.Mesh(
        triangleGeometry, 
        new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        side: THREE.BackSide
    }));
    triangleMesh.name = `${a}_${b}_${c}`

    // Return the triangle data and mesh
    return {
        triangle: triangle,            // THREE.Triangle object
        position: new THREE.Vector3(
            (triangle.a.x + triangle.b.x + triangle.c.x / 3),
            (triangle.a.y + triangle.b.y + triangle.c.y / 3),
            (triangle.a.z + triangle.b.z + triangle.c.z / 3),
        ),
        vertexPositions: vertexPositions, // Raw vertex positions
        indices: indices,                // Indices for BufferGeometry
        mesh: triangleMesh               // The mesh object for this triangle
    };
}

function TriangleGrid(vertices, a, b, c) {
    const vertexPositions = [
        vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2],  // Vertex a
        vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2],  // Vertex b
        vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]   // Vertex c
    ];

    // Midpoints of the edges
    const midpointAB = [
        (vertexPositions[0] + vertexPositions[3]) / 2, // X midpoint between a and b
        (vertexPositions[1] + vertexPositions[4]) / 2, // Y midpoint
        (vertexPositions[2] + vertexPositions[5]) / 2  // Z midpoint
    ];

    const midpointBC = [
        (vertexPositions[3] + vertexPositions[6]) / 2, // X midpoint between b and c
        (vertexPositions[4] + vertexPositions[7]) / 2, // Y midpoint
        (vertexPositions[5] + vertexPositions[8]) / 2  // Z midpoint
    ];

    const midpointCA = [
        (vertexPositions[6] + vertexPositions[0]) / 2, // X midpoint between c and a
        (vertexPositions[7] + vertexPositions[1]) / 2, // Y midpoint
        (vertexPositions[8] + vertexPositions[2]) / 2  // Z midpoint
    ];


    const smallerTriangles = [
        // Outer triangle 1: a, midpointAB, midpointCA
        [vertexPositions.slice(0, 3), midpointAB, midpointCA],

        // Outer triangle 2: b, midpointBC, midpointAB
        [vertexPositions.slice(3, 6), midpointBC, midpointAB],

        // Outer triangle 3: c, midpointCA, midpointBC
        [vertexPositions.slice(6, 9), midpointCA, midpointBC],

        // Inner upside-down triangle: midpointAB, midpointBC, midpointCA
        [midpointAB, midpointBC, midpointCA]
    ];

    const triangles = [];

    // Create a mesh for each smaller triangle
    smallerTriangles.forEach((triangleVertices, index) => {
        var triangle = new THREE.Triangle(
            new THREE.Vector3(...triangleVertices[0]),
            new THREE.Vector3(...triangleVertices[1]),
            new THREE.Vector3(...triangleVertices[2])
        )

        const center = new THREE.Vector3();
        triangle.getMidpoint(center);

        const normal = new THREE.Vector3();
        triangle.getNormal(normal);
        const side1 = triangle.a.distanceTo(triangle.b);
        const side2 = triangle.b.distanceTo(triangle.c);
        const side3 = triangle.c.distanceTo(triangle.a);
        const averageSide = (side1 + side2 + side3) / 3;
        const matrix = new THREE.Matrix4();
        matrix.setPosition(center.x, center.y, center.z);

        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        matrix.makeRotationFromQuaternion(quaternion);

        matrix.scale(new THREE.Vector3(averageSide, averageSide, averageSide));

        triangle.matrix = matrix
        triangle.center = center
        triangle.normal = normal

        triangles.push(triangle);
     });

    // Return the array of triangle meshes
    return triangles
}

function Lathe(x, y, z, radius, color, map) {
    const height = radius * 2
    const group = new THREE.Group();
    
    // Define mesh material arguments
    const meshMaterialArgs = { 
        side: THREE.DoubleSide, 
        transparent: false,
        wireframe: false,
        metalness: 1,
        opacity: 0.5
    }
    if (map) {
        meshMaterialArgs.map = map
    }
    // Create the mesh material
    const meshMaterial = new THREE.MeshStandardMaterial(meshMaterialArgs);
    
    // Generate profile points for LatheGeometry
    const points = [];
    for (let i = 0; i <= 10; i++) {
        const heightStep = (i / 10) * height;
        const  x = Math.sin(i * 0.2) * (height / 2) * (Math.random() < 0.5 ? -1 : 1)
        const  y = heightStep - (height / 2) 

        points.push(new THREE.Vector2(x, y));
    }

    // Lathe geometry parameters
    const data = {
        segments: 12,
        phiStart: Math.random(),
        phiLength: 3.14
    };

    // Create the lathe geometry
    const geometry = new THREE.LatheGeometry(points, data.segments, data.phiStart, data.phiLength);
    geometry.computeVertexNormals()
    // Create the wireframe and mesh and add them to the group
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.castShadow = true
    mesh.receiveShadow = true

    group.add(mesh);

    // Set the position of the group
    group.position.set(x, y + (height / 2), z);

    return group
}


function getInstancePosition(instancedMesh, index) {
    const matrix = new THREE.Matrix4();
    instancedMesh.getMatrixAt(index, matrix);  // Get the transformation matrix for the instance

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);  // Extract the position from the matrix

    return position;
}

function colorshade(rgb) {
    if (rgb === 0) {
        // Random shade of red
        const red = Math.floor(Math.random() * 256);  // Generate a random value for red (0-255)
        return `rgb(${red}, 0, 0)`;  // Full red, no green, no blue
    } else if (rgb === 1) {
        // Random shade of green
        const green = Math.floor(Math.random() * 256);
        return `rgb(0, ${green}, 0)`;  // Full green, no red, no blue
    } else if (rgb === 2) {
        // Random shade of blue
        const blue = Math.floor(Math.random() * 256);
        return `rgb(0, 0, ${blue})`;  // Full blue, no red, no green
    } else {
        // Random color (any shade of RGB)
        const red = Math.floor(Math.random() * 256);
        const green = Math.floor(Math.random() * 256);
        const blue = Math.floor(Math.random() * 256);
        return `rgb(${red}, ${green}, ${blue})`;
    }
}

class Sky {
    time = 0
    constructor(user) {
        this.counter = 0;
        this.user = user;
        this.sceneRadius = 550;
        this.full_circle = 2 * Math.PI;

        this.starLight = new THREE.AmbientLight(0xfefeff,  .06); // Sky and ground color
        this.starLight.position.set(0, 0, 0);
        scene.add(this.starLight);

        
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
        this.sun.shadow.camera.far = 9900;
        this.sun.shadow.camera.left = -100;
        this.sun.shadow.camera.right = 100;
        this.sun.shadow.camera.top = 100;
        this.sun.shadow.camera.bottom = -100;
        this.sky = [];
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(11, 30, 30), 
            new THREE.MeshBasicMaterial({ 
                side: THREE.DoubleSide, 
                color: 'white' 
            })
        );
        this.sphere.position.copy(this.sun.position)
        scene.add(this.sphere)



        this.createDome();
        // for (var i = 0; i < 29; i++) {
        //     var cloud = this.MakeCloud()
        //     cloud.position.y += randomInRange(50, 250)
        //     cloud.position.x -= randomInRange(-50, 50)
        //     cloud.position.z -= randomInRange(-50, 50)

        //     scene.add(cloud)
        // }

    }

    createStars(points) {
        var starMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.1
        })
        var colors = []
        for (var i = 0; i < points.length; i += 3) {
            colors.push(1, 1, 1)
        }
        var starGeometry = new THREE.BufferGeometry()
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

        var mesh = new THREE.Points(starGeometry, starMaterial)
        this.stars = mesh
        scene.add(mesh)
    }

    createDome() {
        var gridSize = 90;  // Larger grid size for more detail at the horizon
        var radius = this.sceneRadius;
        var points = [];  // Array to hold positions for all points in the dome
        var colors = [];  // Array to store color for each point
        var thetaPhiArray = [];  // Array to store the theta and phi angles for each point
        var maxdist = 0;
        var highestY = 0;

        // Material for the points
        var pointMaterial = new THREE.PointsMaterial({
            size: 50,  // Size of each point
            vertexColors: true,  // Allow different colors per vertex (point)
            transparent: false
        });

        // Loop through to calculate points in spherical coordinates
        var starPoints = []
        for (var i = 0; i < gridSize; i++) {
            for (var j = 0; j < gridSize; j++) {
                // Calculate spherical coordinates
                var theta = (i / gridSize) * Math.PI;
                var phi = (j / gridSize) * Math.PI;

                // Convert spherical coordinates to Cartesian coordinates
                var x = radius * Math.sin(phi) * Math.cos(theta);
                var z = radius * Math.cos(phi);
                var y = radius * Math.sin(phi) * Math.sin(theta);

                if (y > highestY) highestY = y;

                // Lerp colors from sky blue to white based on the height (closer to horizon = more white)
                var horizonFactor = Math.pow(Math.abs(y / radius), 0.3);  // 0 at horizon, 1 at top
                var skyColor = new THREE.Color(0xbde9ff);  // Sky blue color
                var white = new THREE.Color(0xffffff);  // White at horizon
                var color = new THREE.Color().lerpColors(white, skyColor, horizonFactor);  // Interpolate color

                // Add position to points array
                points.push(x, y, z);

                // Add color to the colors array (r, g, b values)
                colors.push(color.r, color.g, color.b);

                // Store theta and phi for use in lighting updates later
                thetaPhiArray.push({ theta: theta, phi: phi });

                if (Math.random() < 0.09) {
                    starPoints.push(randomInRange(x - 25, x  + 25), y - 50, randomInRange(z - 25, z + 25))
                }

                if (z > maxdist) maxdist = z;
            }
        }

        this.createStars(starPoints)

        // Create buffer geometries to hold the positions and colors for the points
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Store the theta and phi for each point inside the geometry
        geometry.userData = { thetaPhiArray: thetaPhiArray };

        // Create the points cloud and add it to the scene
        var pointCloud = new THREE.Points(geometry, pointMaterial);
        this.sky.push(pointCloud);  // Add the point cloud to the sky array for updates
        scene.add(pointCloud);  // Add the point cloud to the scene
    }

    update() {
        if (this.time > Math.PI * 2) {
            this.time = 0;
        }

        // Update the sun's position based on time
        var sunX = (this.sceneRadius * 0.95) * Math.cos(this.time);
        var sunY = (this.sceneRadius * 0.95) * Math.sin(this.time);
        var sunZ = 0;
        this.sun.position.set(sunX, sunY, sunZ);
        this.sphere.position.set(sunX, sunY, sunZ);  // Optional visualization of the sun

        // Base colors for each sky state
        const skyDay = new THREE.Color(0xbde9ff);
        const skyDawnDusk = new THREE.Color(0x74c1e8);
        const skyNight = new THREE.Color(0x001f3f);
        const horizonDay = new THREE.Color(0xffffff);
        const horizonDawnDusk = new THREE.Color(0xffc0cb);

        // Set transition factor based on time (0 for day, 1 for dawn/dusk, 2 for night)
        let transitionFactor = (
            (
                this.time > Math.PI * 2 - Math.PI / 16
                || this.time < Math.PI / 16
            ) ||
            (
                this.time < Math.PI + Math.PI / 16
                && this.time > Math.PI - Math.PI / 16
            )
        ) ? 1 : (
            this.time < Math.PI ? 0 : 2
        )

        if (transitionFactor == 2) {
            this.stars.material.opacity = 1
            this.stars.needsUpdate = true
            this.sun.intensity = 0
            scene.add(this.stars)
        } else {
            scene.remove(this.stars)
        }


        // Access geometry's color attribute to update individual vertex colors
        const colorAttribute = this.sky[0].geometry.attributes.color;


        for (let i = 0; i < colorAttribute.count; i++) {
            // Retrieve position of each vertex
            let x = this.sky[0].geometry.attributes.position.getX(i);
            let y = this.sky[0].geometry.attributes.position.getY(i);
            let z = this.sky[0].geometry.attributes.position.getZ(i);

            if (transitionFactor == 2) {
                this.sky[0].material.opacity = 0.8
            } else {
                this.sky[0].material.opacity = 1
            }

            // Calculate angular position in the x direction
            let theta = Math.atan2(y, x); // Angle of the point in the horizontal plane
            let sunsetAngle = Math.PI / 8; // Define the center angle for sunset/sunrise effect
            let edgeFalloff = sunsetAngle * 1.5; // Define a wider range for gradual blending

            // Define base sky and horizon colors based on transitionFactor
            let skyColor, horizonColor;
            if (transitionFactor < 1) {
                skyColor = new THREE.Color().lerpColors(skyDay, skyDawnDusk, transitionFactor);
                horizonColor = new THREE.Color().lerpColors(horizonDay, horizonDawnDusk, transitionFactor);
            } else {
                skyColor = new THREE.Color().lerpColors(skyDawnDusk, skyNight, transitionFactor - 1);
                horizonColor = new THREE.Color().lerpColors(horizonDawnDusk, skyNight, transitionFactor - 1);
            }

            // Horizon effect: blend between horizon and sky color based on height
            let horizonFactor = Math.pow(Math.abs(y / this.sceneRadius), 0.5);
            let baseColor = new THREE.Color().lerpColors(horizonColor, skyColor, horizonFactor);

            // Determine if vertex is within the sunset zone with a gradual transition
            let thetaOffset = Math.abs(theta) - sunsetAngle;
            let isNearSunsetZone = transitionFactor === 1 && Math.abs(theta) < edgeFalloff;

            let sunsetBlendFactor = isNearSunsetZone
                ? Math.max(0, 1 - (thetaOffset / (edgeFalloff - sunsetAngle)))
                : 0;

            // Blend between sunset color and base color within the sunset zone
            let sunColors = transitionFactor == 1 ? [
                new THREE.Color(0xffc099),  // Soft yellow
                baseColor
            ] : [
                horizonColor,
                skyColor
            ]

            let twilightspan = 300
            let distanceFromCenter = new THREE.Vector3(x, y, z).distanceTo(this.sun.position);
            let distanceFactor = Math.min(distanceFromCenter / twilightspan, 1); // Normalize to range [0, 1]
            let colorIndex = Math.floor(distanceFactor * (sunColors.length - 1));
            let nextColorIndex = Math.min(colorIndex + 1, sunColors.length - 1);
            let blendFactor = distanceFactor * (sunColors.length - 1) - colorIndex;

            let positionFactor = (Math.sin(x * 0.1 + y * 0.1 + z * 0.1) + 1) / 2; // Position-based blending factor (0 to 1)
            // let colorIndex = Math.abs(Math.floor((x + y + z) * 0.1) % sunColors.length);
            // let nextColorIndex = (colorIndex + 1) % sunColors.length;
            let sunEffectColor = new THREE.Color(sunColors[Math.floor(Math.random() * sunColors.length)])
            let vertexColor = new THREE.Color().lerpColors(sunColors[colorIndex], sunColors[nextColorIndex], blendFactor);

            // Additional blending with white if the vertex is very close to the sun
            let distanceToSun = new THREE.Vector3(x, y, z).distanceTo(this.sun.position);
            let dist = transitionFactor == 1 ? twilightspan : 80
            vertexColor = distanceToSun < dist
                ? new THREE.Color().lerpColors(transitionFactor == 1 ? vertexColor : baseColor, new THREE.Color(0xffffff), 1 - (distanceToSun / dist))
                : baseColor;

            // Set the color for this vertex in the color attribute
            colorAttribute.setXYZ(i, vertexColor.r, vertexColor.g, vertexColor.b);
        }

        // Update the color attribute to apply changes
        colorAttribute.needsUpdate = true;

        if (this.time > Math.PI + Math.PI / 16 && this.time < Math.PI * 2 - Math.PI / 16) {
            this.sun.intensity = 0
            castle.lamplight.intensity = 15
        } else {
            this.sun.intensity = 3
            castle.lamplight.intensity = 0
        }

        // Increment time for next update
        this.time += 0.005;
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
                const radius = (j / numSpheres) * randomInRange(sphereSmall, sphereLarge); // Much smaller spheres for a wispy look

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
                    randomInRange(clusterHeight - sphereLarge, clusterHeight - sphereLarge - sphereSmall),
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
}

// Array to store each triangle's specific sine wave parameters for rotation
var triangleRotationWaves = new Map();  // Could also use an array if easier

// Initialize each triangle's wave parameters for rotation (frequency, phase)
function initializeTriangleRotationWaves(triangleCount) {
    for (let i = 0; i < triangleCount; i++) {
        triangleRotationWaves.set(i, {
            frequency: Math.random() * 0.1 + 0.05,  // Random frequency for rotation
            phase: Math.random() * Math.PI * 2  // Random initial phase
        });
    }
}

function rotateAroundPoint(v, center, angle) {
    var cosAngle = Math.cos(angle);
    var sinAngle = Math.sin(angle);
    var x = v.x - center.x;
    var z = v.z - center.z;

    // Rotate the vertex around the Y-axis (assuming water is horizontal)
    var rotatedX = cosAngle * x - sinAngle * z;
    var rotatedZ = sinAngle * x + cosAngle * z;

    // Return the rotated vertex position, translating it back to the center point
    return new THREE.Vector3(rotatedX + center.x, v.y, rotatedZ + center.z);
}

var uw = 0
function UndulateWater(sunPositionX, sunPositionY, sunPositionZ) {
    if (uw++ % 5 !== 0) return
    if (uw > 100) uw = 0
    var originalWaterPosition = terrain.water.geometry.attributes.position.array;
    var time = performance.now() * 0.001;  // Time factor for animating the waves
    var waterVertices = terrain.water.geometry.attributes.position.array;
    var sunPosition = new THREE.Vector3(sunPositionX, sunPositionY, sunPositionZ);

    // Define the number of sine waves and their properties
    const numWaves = 9;  // Number of sine waves
    const waveDirections = [];
    const waveFrequencies = [];
    const waveAmplitudes = [];
    
    // Set a base Y offset for stabilization
    const baseY = -5;  // Stabilize around this Y value

    // Generate random directions, frequencies, and smaller amplitudes for each wave
    for (let i = 0; i < numWaves; i++) {
        waveDirections.push(new THREE.Vector3(
            Math.random() * 2 - 1,  // Random X direction
            0,                      // No Y movement in the direction vector
            Math.random() * 2 - 1   // Random Z direction
        ).normalize());  // Normalize to ensure consistent direction

        waveFrequencies.push(randomInRange(0.05, 0.1));  // Random frequency for each wave
        waveAmplitudes.push(randomInRange(0.01, 0.2));  // Subtle random amplitude for each wave
    }

    // Apply waves to the water vertices
    for (let i = 0; i < originalWaterPosition.length; i += 9) {  // Loop over every triangle (3 vertices per triangle)

        var v0 = new THREE.Vector3(originalWaterPosition[i], originalWaterPosition[i + 1], originalWaterPosition[i + 2]);
        var v1 = new THREE.Vector3(originalWaterPosition[i + 3], originalWaterPosition[i + 4], originalWaterPosition[i + 5]);
        var v2 = new THREE.Vector3(originalWaterPosition[i + 6], originalWaterPosition[i + 7], originalWaterPosition[i + 8]);

        // Initialize displacement values
        var displacementV0 = 0;
        var displacementV1 = 0;
        var displacementV2 = 0;

        // Apply all waves to each vertex
        for (let w = 0; w < numWaves; w++) {
            const direction = waveDirections[w];
            const frequency = waveFrequencies[w];
            const amplitude = waveAmplitudes[w];

            // Project the position onto the wave direction
            const waveV0 = v0.dot(direction);
            const waveV1 = v1.dot(direction);
            const waveV2 = v2.dot(direction);

            // Apply sine wave displacement based on the projection
            displacementV0 += Math.sin(waveV0 * frequency + time) * amplitude;
            displacementV1 += Math.sin(waveV1 * frequency + time) * amplitude;
            displacementV2 += Math.sin(waveV2 * frequency + time) * amplitude;
        }

        // Stabilize around baseY and add subtle displacements
        v0.y = baseY + displacementV0;
        v1.y = baseY + displacementV1;
        v2.y = baseY + displacementV2;

        // Update the vertex positions in the waterVertices array
        waterVertices[i] = v0.x; waterVertices[i + 1] = v0.y; waterVertices[i + 2] = v0.z;
        waterVertices[i + 3] = v1.x; waterVertices[i + 4] = v1.y; waterVertices[i + 5] = v1.z;
        waterVertices[i + 6] = v2.x; waterVertices[i + 7] = v2.y; waterVertices[i + 8] = v2.z;
    }

    terrain.water.geometry.attributes.position.needsUpdate = true;  // Ensure the geometry updates
}

class ObjectEdit {
    element = document.createElement('div')
    element_width() {
        return window.innerWidth * .64
    }
    element_height() {
        return window.innerHeight * .36
    }
    clickX = -1
    clickY = -1
    scene_selection = undefined
    mouse = new THREE.Vector2()
    raycaster = new THREE.Raycaster()
    debounced_event = undefined

    constructor() {
        this.element.classList.add('object-edit')
    }

    static isClass(classname, element) {
        while (element && !element.classList.contains(classname)) {
            element = element.parentElement
        }
        return element
    }

    addEventListeners() {
        let that = this
        document.querySelector('#object-edit__search').addEventListener('keydown', event => {
            if (this.debounced_event) clearInterval(this.debounced_event)
            this.debounced_event  = setTimeout(this.searchInput.bind(that, event.srcElement.value), 1700);
        })
    }

    click(event) {}

    renderModal(event) {
        if (document.querySelectorAll('.object-edit').length) {
            document.querySelectorAll('.object-edit').forEach(e => e.remove())
        }
        this.clickX = event.clientX
        this.clickY = event.clientY
        this.mouse.x = (this.clickX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(this.clickY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, window.user.camera);
        var intersects = this.raycaster.intersectObjects(scene.children);
        if (intersects.length) {
            this.scene_selection = intersects.shift()
            var twentyWindow = window.innerWidth * 0.2
            var tenWindow = window.innerHeight * 0.1
            this.element.classList.add('object-edit')
            this.element.id = this.scene_selection.object.uuid
            var offsetLeft = twentyWindow / 2
            var left = this.clickX - offsetLeft
            var top = this.clickY - tenWindow
            if (left < 0) {
                left = 0
            } else if (left > window.innerWidth - this.element_width()) {
                left = window.innerWidth - this.element_width()
            }
            if (top < 0) {
                top = 0
            } else if (top > window.innerHeight - this.element_height()) {
                top = window.innerHeight - this.element_height()
            }
            this.element.style.left = 0 + 'px'
            this.element.style.top = 0 + 'px'
            this.element.innerHTML = `
                <div class="object-edit-container">
                    <div id="object-edit__controller">
                        <section class="object-edit__headline-view ">
                            <code>${this.scene_selection.object.uuid}</code>
                            <div id="picture-on-deck"></div>
                        </section>
                        <div class="object-edit__edit-selections">
                            <input type="text" id="object-edit__search" value="• search image •" />
                            <button>Assign to Object</button>
                        </div>
                    </div>
                    <div class="object-edit__search-result-view"></div>
                </div>

            `

            document.body.appendChild(this.element)

            this.element.querySelector('input').addEventListener('focus', e => e.srcElement.classList.add('focused'))
            this.element.querySelector('input').addEventListener('blur', e => e.srcElement.classList.remove('focused'))

            this.addEventListeners()
        }
    }

    searchInput(search_term) {
        var search = new XMLHttpRequest()
        search.open('GET', `/search-image/${search_term}`)
        search.addEventListener('load', this.loadSearchResults)
        search.send()
    }

    static tags_survey(options, prompt) {
        return new Promise(resolve => {
            document.querySelector('.object-edit__info').innerHTML = `
                <h2>Image Tag & Description</h2>
                <div class="option-boxes">
                    ${Object.keys(view.images).map(image_tag => {
                        return '<div class="option-box">' + image_tag + '</div>'
                    }).join('')}
                    <div class="option-box new" contenteditable>... a new</div>
                </div>
            `
            document.querySelector('.object-edit__info')
                            .querySelectorAll('.option-boxes .option-box').forEach(optionBox => {

                if (optionBox.classList.contains('new')) {
                    optionBox.addEventListener('input', function(event) {
                        if (event.key.toUpperCase() == 'ENTER') {
                            resolve(event.srcElement.innerHTML)
                        }
                    })
                } else {
                    optionBox.addEventListener('click', function(event) {
                        resolve(event.srcElement.innerHTML)
                    })
                }
            })
        })
    }

    loadSearchResults(that) {
        var search_results = JSON.parse(this.response)
        var searchResultContainer = editor.element.querySelector('.object-edit__search-result-view')
        for (var child of searchResultContainer.children) {
            child.remove()
        }
        for (var hit of search_results.data.hits) {
            var div = document.createElement('div')
            div.classList.add('object-edit__search-result')
            div.style.background = `url(${hit.largeImageURL})`
            div.addEventListener('dblclick', function(event) {
                var url = event.srcElement.style.background
                document.getElementById('picture-on-deck').style.background = url;
                url = url.replace('url(', '')
                url = url.replace(')','')
                let tags = Object.keys(view.images)
                
            })
            searchResultContainer.appendChild(div)
        }
    }
}

class Castle {
    offsetY = 1.5
    elevatorSpeed = 0.2

    constructor(castleBaseCenter) {
        for (var key in VM.map.structures[0]) {
            this[key] = VM.map.structures[0][key]
        }
        this.parts = [];
        this.elevator = []
        this.objects = []

        var buildingHeight = 300
        var elevatorHeight = 3
        const floorHeight = 4
        const foundationY = house.center.y - (house.foundation.height / 2)
        var floorY = foundationY


        this.building(foundationY)
        
        this.lamplight = this.createHarryPotterLampPost(
            boardwalk.center.x - boardwalk.width / 2 + 1, 
            boardwalk.center.y, 
            boardwalk.center.z - boardwalk.depth / 2 + 1
        )

    
        const boardwalkTexture = new THREE.TextureLoader().load("/images/cobblestone.jpg", texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
        })

        const boardwalk2Texture = new THREE.TextureLoader().load("/images/cobblestone.jpg", texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.rotation = Math.PI / 2
            texture.repeat.set(1, 2);
        })

        const alleyTexture = new THREE.TextureLoader().load("/images/cobblestone.jpg", texture => {
           texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.rotation = Math.PI / 2
            texture.repeat.set(1, 2);
        })
        

        const steptexture = new THREE.TextureLoader().load("/images/floor2.jpg", texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
        })
        

        var opts = {}
        opts.map = boardwalkTexture;
        var tilePlane = new THREE.Mesh(
            new THREE.BoxGeometry(boardwalk.width, boardwalk.height, boardwalk.depth),
            new THREE.MeshStandardMaterial(opts)
        );
        tilePlane.receiveShadow = true;
        tilePlane.castShadow = true
        tilePlane.position.set(boardwalk.center.x, boardwalk.center.y, boardwalk.center.z);
        this.parts.push(tilePlane)
        tilePlane.frustrumCulled = true
        scene.add(tilePlane)

        this.createABoardwalk(boardwalk, boardwalkTexture)
        this.createABoardwalk(boardwalk2, boardwalk2Texture)
        this.createABoardwalk(alley, alleyTexture)

        var dock = {
            width: boardwalk.width * 1.5 + 4, 
            height: boardwalk.height, 
            depth: boardwalk.depth / 2,
            x: (landscape.field.width / 2) + (boardwalk.width / 2) + 1,
            y: -3,
            z: 3
        }

        this.createRocks(dock)


        var dockStepDepth = house.width * .4
        var dockWidth = (landscape.field.width / 2) - (house.width / 2)
        var stepWidth = .3
        var stepHeight = .15
        var stepY = boardwalk.center.y - (stepHeight / 2)
        var stepX = boardwalk.center.x + (boardwalk.width / 2)
        var stepZ = boardwalk.center.z - (boardwalk.depth / 2.5)
        
        var stepCount = Math.abs(boardwalk.center.y - dock.y) / stepHeight
        var turning = false
        for (var i = 0; i < stepCount; i++) {
            var stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, 2)
            if (i > (stepCount / 2) && turning) {
                stepGeo.rotateY(Math.PI / 2)
            }
            var step = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({
                map: steptexture,
                side: THREE.DoubleSide
            }))
            step.position.set(stepX, stepY, stepZ)
            
            if (i > (stepCount / 2)) {
                if (!turning) {
                    turning = true
                    var stepTurnPlane = new THREE.Mesh(
                        new THREE.BoxGeometry(2, 0.15, 2),
                        new THREE.MeshStandardMaterial({
                            map: steptexture,
                            side: THREE.DoubleSide
                        })
                    )
                    stepTurnPlane.position.set(stepX + 1, stepY, stepZ)
                    scene.add(stepTurnPlane)
                    this.parts.push(stepTurnPlane)
                    stepZ += .9
                    stepX += 1
                }
                stepZ += stepHeight
            } else {
                stepX += stepWidth
            }

            stepY -= stepHeight
            scene.add(step)
            this.parts.push(step)
        }
    }

    createHarryPotterLampPost(x, y, z) {
        const lampHeight = 5;

        // Create the lamp post (a tall cylinder)
        const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, lampHeight, 8);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 'black' });
        const lampPost = new THREE.Mesh(postGeometry, postMaterial);
        lampPost.position.set(x, y + lampHeight / 2, z); // Position it so the base is at the given coordinates
        scene.add(lampPost);

        // Create the top cap of the lamp post (a sphere)
        const capGeometry = new THREE.SphereGeometry(0.2, 8, 8); // Small cap on top of the post
        const capMaterial = new THREE.MeshStandardMaterial({ color: 'black' });
        const lampPostCap = new THREE.Mesh(capGeometry, capMaterial);
        lampPostCap.position.set(x, y + lampHeight, z); // Position at the top of the post
        scene.add(lampPostCap);

        // Define the lightbulb shape using LatheGeometry (profile of half-bulb)
        const bulbShape = new THREE.Shape();
        bulbShape.moveTo(0, 0);
        bulbShape.lineTo(0.1, 0);    // Bottom width of bulb
        bulbShape.quadraticCurveTo(0.3, 0.5, 0.1, 1);  // Curve out for bulb shape
        bulbShape.lineTo(0, 1);      // Taper off to the top

        // Create LatheGeometry from the shape
        const bulbGeometry = new THREE.LatheGeometry(bulbShape.getPoints(20), 32);
        const bulbMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            metalness: 0,
            roughness: 0.1,
            transmission: 0.9, // For a glass effect
            side: THREE.DoubleSide
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.set(x, y + lampHeight + 0.3, z); // Slightly above the cap
        scene.add(bulb);

        // Create the filament (wick) inside the bulb
        const filamentGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const filamentMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffcc00 });
        const filament = new THREE.Mesh(filamentGeometry, filamentMaterial);
        filament.position.set(x, y + lampHeight + 0.7, z); // Position inside the bulb
        scene.add(filament);

        // Add a point light to represent the light source, with daylight color
        const pointLight = new THREE.PointLight(0xfff7e8, 105, 15); // Soft white light
        pointLight.position.set(x, y + lampHeight + 0.5, z);
        pointLight.castShadow = true; // Enable shadows if needed
        scene.add(pointLight);

        // var group = new THREE.Group()
        // group.add(lampPost)
        // group.add(lampPostCap)
        // group.add(bulb)
        // group.add(filament)
        // group.add(pointLight)

        return pointLight
    }

    createABoardwalk(bw, boardwalkTexture, imageRotation) {
        var opts = {}
        opts.map = boardwalkTexture;
        var tilePlane = new THREE.Mesh(
            new THREE.BoxGeometry(bw.width, bw.height, bw.depth),
            new THREE.MeshStandardMaterial(opts)
        );
        tilePlane.receiveShadow = true;
        tilePlane.castShadow = true
        tilePlane.position.set(bw.center.x, bw.center.y, bw.center.z);
        this.parts.push(tilePlane)
        tilePlane.frustrumCulled = true
        scene.add(tilePlane)


        var x = bw.center.x + bw.width / 2;
        var y = bw.center.y + 0.75 / 2 - bw.height / 2
        var z = bw.center.z - (bw.depth / 2.5) + 1
        var endZ =  bw.center.z + bw.depth / 2
        while (z < endZ) {
            var justPost = false
            if (Math.abs(endZ - z) <= 3) justPost = true

            var rp = RailingPost(
                new THREE.Vector3(x, y - 0.2, z), 
                new THREE.Vector3(x, y - 0.2, z + 2),
                0.01, 5, justPost
            )
            scene.add(rp)
            this.objects.push(rp)

            rp = RailingPost(
                new THREE.Vector3(x, y - 0.4, z), 
                new THREE.Vector3(x, y - 0.2, z + 2),
                0.01, 3, justPost
            )
            scene.add(rp)

            this.objects.push(rp)

            rp = RailingPost(
                new THREE.Vector3(x, y - 0.6, z), 
                new THREE.Vector3(x, y - 0.2, z + 2),
                0.01, 3, justPost
            )
            scene.add(rp)

            this.objects.push(rp)

            z += 2
        }
    }

    buildElevator() {
        // Elevator floor
        var eFloor = new THREE.Mesh(
            new THREE.BoxGeometry(elevatorWidth, 0.2, elevatorWidth),
            new THREE.MeshStandardMaterial({ color: 'maroon' })
        );
        eFloor.position.set(
            house.width / 2 - elevatorWidth / 2,
            castleBaseCenter.y + this.offsetY,
            house.width / 2 - elevatorWidth / 2
        );
        eFloor.geometry.computeVertexNormals()
        eFloor.floorZero = castleBaseCenter.y + this.offsetY
        eFloor.interval = this.wallHeight * 3
        eFloor.name = "elevator-floor"
        this.elevator.push(eFloor)
        scene.add(eFloor);

        var eCeiling = new THREE.Mesh(
            new THREE.BoxGeometry(elevatorWidth, 0.2, elevatorWidth),
            new THREE.MeshStandardMaterial({ color: 'maroon' })
        );
        eCeiling.position.set(
            house.width / 2 - elevatorWidth / 2, 
            castleBaseCenter.y + elevatorHeight + this.offsetY, 
            house.width / 2 - elevatorWidth / 2
        );
        eCeiling.geometry.computeVertexNormals()
        this.elevator.push(eCeiling)
        scene.add(eCeiling);

        let texture = new THREE.TextureLoader().load('/images/wall12.jpg')

        var elevatorShaftInnerRight = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2
            ),
            new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide
            })
        );
        elevatorShaftInnerRight.position.set(
            eFloor.position.x - elevatorWidth / 2, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
        elevatorShaftInnerRight.rotation.y = Math.PI / 2;
        elevatorShaftInnerRight.geometry.computeVertexNormals()
        scene.add(elevatorShaftInnerRight)


        var elevatorShaftOuterLeft = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2  // Segment height for this floor
            ),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.3,
                depthTest: true,   // Ensure depth testing is enabled
                depthWrite: false,  // Ensure writing to the depth buffer is enabled
                side: THREE.DoubleSide
            })
        );
        elevatorShaftOuterLeft.position.set(
            eFloor.position.x, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, 
            eFloor.position.z + elevatorWidth / 2
        )
        elevatorShaftOuterLeft.geometry.computeVertexNormals()
        scene.add(elevatorShaftOuterLeft)
        // this.parts.push(elevatorShaftOuterLeft)

        var elevatorShaftOuterRight = new THREE.Mesh(
            new THREE.BoxGeometry(
                elevatorWidth, buildingHeight, 0.2  // Segment height for this floor
            ),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.3,
                depthTest: true,   // Ensure depth testing is enabled
                depthWrite: false,  // Ensure writing to the depth buffer is enabled
                side: THREE.DoubleSide
            })
        );
        elevatorShaftOuterRight.position.set(eFloor.position.x + elevatorWidth / 2, castleBaseCenter.y + buildingHeight / 2 + this.offsetY, eFloor.position.z)
        elevatorShaftOuterRight.rotation.y = Math.PI / 2;
        elevatorShaftOuterRight.geometry.computeVertexNormals();
        scene.add(elevatorShaftOuterRight)
        // this.parts.push(elevatorShaftOuterRight)



        var elevatorShaftInnerLeft;
        for (let i = 1; i <= 13; i++) {
            var elevatorShaftLeft = new THREE.Mesh(
                new THREE.BoxGeometry(
                    elevatorWidth, this.wallHeight * 3, 0.1
                ),
                new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                })
            );
            
            var yPosition = buildingHeight + (this.wallHeight * 3 / 2) * i

            var floorYPosition = yPosition - (this.wallHeight * 3) / 2;

            
            elevatorShaftLeft.position.set(
                eFloor.position.x, 
                yPosition,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            );

            // Convert the elevator shaft into a Brush for CSG operations
            const shaftBrush = new Brush(elevatorShaftLeft.geometry);
            shaftBrush.position.set(
                eFloor.position.x, 
                yPosition,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            )
            shaftBrush.updateMatrixWorld();

            // Create the door geometry for the cutout
            const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.2); // Door size
            const doorBrush = new Brush(doorGeometry);
            doorBrush.position.set(
                eFloor.position.x, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2
            );
            doorBrush.updateMatrixWorld();

            // Subtract the door from the shaft segment (perform CSG subtraction)
            const evaluator = new Evaluator();
            const result = evaluator.evaluate(shaftBrush, doorBrush, SUBTRACTION);

            // Create a mesh from the updated geometry for this shaft segment
            elevatorShaftInnerLeft = new THREE.Mesh(result.geometry, new THREE.MeshStandardMaterial({
                map: texture,
                transparent: false,
                side: THREE.DoubleSide
            }));

            // Add to scene and store the shaft segment
            elevatorShaftInnerLeft.receiveShadow = true;
            elevatorShaftInnerLeft.castShadow = true;
            elevatorShaftInnerLeft.geometry.computeVertexNormals();
            scene.add(elevatorShaftInnerLeft);
            // this.parts.push(elevatorShaftInnerLeft);



            // ----------- Add Button Plate to Each Shaft -----------
            var buttonPlate = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 0.3),
                new THREE.MeshStandardMaterial({
                    color: 'gold',
                    metalness: 1,
                    side: THREE.DoubleSide
                })
            );

            // Position the button plate on the right side of the door (outside the shaft)
            // Adjust the position of the plate relative to the door and shaft
            buttonPlate.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .12
            );
            buttonPlate.geometry.computeVertexNormals();
            
            // buttonPlate.rotation.y = Math.PI / 2;  // Rotate to face correctly

            // this.parts.push(buttonPlate);  // Add to elevator array
            scene.add(buttonPlate);  // Add to scene

            var button = new THREE.Mesh(
                new THREE.CircleGeometry(.025, 20, 20),
                new THREE.MeshStandardMaterial({
                    color: 'gray',
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                })
            );
            button.geometry.computeVertexNormals();
            button.name = 'elevator-call-button';
            button.floor = i - 1;
            button.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 1,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .13
            );
            button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
            // button.rotation.y = Math.PI / 2
            if (!i) {
                activeButtonLight.position.copy(button.position);
                scene.add(activeButtonLight)
                button.material.color.set('white')
            }
            scene.add(button);

            var elevatorPointLight = new THREE.PointLight(0xffffff, 3, 5);
            elevatorPointLight.position.set(
                eFloor.position.x - 1, 
                floorYPosition + this.offsetY + 2,  // Y-position at this level
                eFloor.position.z - elevatorWidth / 2 - .3
            )
            scene.add(elevatorPointLight)
            var elevatorLightViz = new THREE.Mesh(
                new THREE.SphereGeometry(.1, 10, 10),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff
                })
            );
            elevatorLightViz.position.copy(elevatorPointLight.position)
            scene.add(elevatorLightViz)
            // this.parts.push(elevatorLightViz)
        }


        // Elevator walls (4 walls)
        
        for (var i = 0; i < 4; i++) {
            var meshOptions = {}
            if (i == 3 || i == 0) {
                meshOptions.transparent = true;
                meshOptions.opacity = 0;
            } else {
                // meshOptions.map = texture;
                // meshOptions.color = 'blue'
                meshOptions.map = new THREE.TextureLoader().load("/images/velvet2.jpg")
                
            } 
            var eWall = new THREE.Mesh(
                new THREE.BoxGeometry(elevatorWidth, elevatorHeight, 0.1),
                new THREE.MeshBasicMaterial(meshOptions)
            );
            
            // Position each wall based on index
            if (i == 0) {
                eWall.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z + elevatorWidth / 2
                ); // Front wall
            }
            if (i == 1) {
                const wallGeometry = new THREE.BoxGeometry(elevatorWidth, elevatorHeight, 0.1);
                const wallBrush = new Brush(wallGeometry);
                wallBrush.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z - elevatorWidth / 2 + .1
                );
                wallBrush.updateMatrixWorld();

                // Create the door as a Brush
                const doorGeometry = new THREE.BoxGeometry(1.25, 2, 0.1); // Door size
                const doorBrush = new Brush(doorGeometry);
                doorBrush.position.set(
                    eFloor.position.x, 
                    castleBaseCenter.y + this.wallHeight / 2, 
                    eFloor.position.z - elevatorWidth / 2 + .1
                );
                doorBrush.updateMatrixWorld();

                // Perform the CSG subtraction to create a door in the wall
                const evaluator = new Evaluator();
                const finalWallGeometry = evaluator.evaluate(wallBrush, doorBrush, SUBTRACTION);

                // Convert the result back into a Mesh
                eWall = new THREE.Mesh(finalWallGeometry.geometry, new THREE.MeshStandardMaterial(meshOptions));
                
                
            }
            if (i == 2) {
                eWall.position.set(
                    eFloor.position.x - elevatorWidth / 2 + .1, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z
                ); // Left wall
                eWall.rotation.y = Math.PI / 2; // Rotate left wall by 90 degrees
            }
            if (i == 3) {
                eWall.position.set(
                    eFloor.position.x + elevatorWidth / 2, 
                    castleBaseCenter.y + elevatorHeight / 2 + this.offsetY, 
                    eFloor.position.z
                ); // Right wall
                eWall.rotation.y = Math.PI / 2; // Rotate right wall by 90 degrees
            }

            this.elevator.push(eWall)

            scene.add(eWall);
            // this.parts.push(eWall);
        }

        var buttonPlate = new THREE.Mesh(
            new THREE.PlaneGeometry(.3, .8),
            new THREE.MeshStandardMaterial({
                color: 'gold',
                metalness: 1,
                side: THREE.DoubleSide
            })
        );

        buttonPlate.position.set(eFloor.position.x - elevatorWidth / 2 + .19, castleBaseCenter.y + 2.5, eFloor.position.z)
        buttonPlate.rotation.y = Math.PI / 2;

        this.elevator.push(buttonPlate);
        scene.add(buttonPlate);

        var elevatorPointLight = new THREE.PointLight(0xffffff, 25, 5);
        this.elevator.push(elevatorPointLight)
        elevatorPointLight.position.set(
            house.width / 2 - elevatorWidth / 2, 
            castleBaseCenter.y + elevatorHeight + 1,  // Y position (at ceiling height)
            house.width / 2 - elevatorWidth / 2
        )
        scene.add(elevatorPointLight)
        var elevatorLightViz = new THREE.Mesh(
            new THREE.SphereGeometry(.3, 10, 10),
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            })
        );
        this.elevator.push(elevatorLightViz)
        elevatorLightViz.position.copy(elevatorPointLight.position)
        scene.add(elevatorLightViz)

        var plateHeight = 0.7;
        var buttonSpacing = plateHeight / 12;  // Distance between each button
        var plateCenterY = buttonPlate.position.y;  // Center of the plate along y-axis

        var activeButtonLight = new THREE.PointLight(0xffffff, .05, 5);
        activeButtonLight.name = 'active-button-light'
        this.elevator.push(activeButtonLight)

        for (var i = 0; i < 13; i++) {
            var button = new THREE.Mesh(
                new THREE.CircleGeometry(.025, 20, 20),
                new THREE.MeshStandardMaterial({
                    color: 'gray',
                    transparent: true,
                    opacity: 0.7
                })
            );
            button.name = 'elevator-button';
            button.floor = i;
            button.position.set(
                buttonPlate.position.x + .01,  // x position, you can adjust it if needed
                plateCenterY - plateHeight / 2 + i * buttonSpacing,  // y position, spacing the buttons evenly
                house.width / 2 - elevatorWidth / 2      // z position
            );
            button.floorZero = plateCenterY - plateHeight / 2 + i * buttonSpacing
            button.rotation.y = Math.PI / 2
            if (!i) {
                activeButtonLight.position.copy(button.position);
                scene.add(activeButtonLight)
                button.material.color.set('white')
            }
            this.elevator.push(button)
            scene.add(button);
        }
    }

    building(floorY) {
        floorY += boardwalk.height
        for (var level = 0; level < 1; level++) {
            const foundation = new THREE.Mesh(
                new THREE.BoxGeometry(house.width, house.foundation.height, house.depth),
                    new THREE.MeshStandardMaterial({
                        map: CONCRETE,
                        side: THREE.DoubleSide
                    }),
                    
            )
            foundation.position.set(0, floorY, 0)
            
            foundation.frustrumCulled = true
            this.objects.push(foundation)
            this.parts.push(foundation)
            scene.add(foundation)



            if (level == 0) continue

            for (var i = 0; i < 4; i++) {
                const group = new THREE.Group()
                var geometry = new THREE.PlaneGeometry(i % 2 == 0 ? house.depth : house.width, house.height);
                const wall = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
                    color: 0x777777,
                    opacity: 0.5,
                    side: THREE.DoubleSide,
                    transparent: true
                }));

                wall.position.set(
                    house.center.x, 
                    floorY + house.height / 2 + house.foundation.height / 2,
                    house.center.z
                )
                switch (i) {
                case 0:
                    wall.rotation.y = Math.PI / 2
                    wall.position.x = house.width / 2
                    break
                case 1:
                    wall.position.z = house.depth / 2
                    break
                case 2:
                    wall.rotation.y = Math.PI / 2
                    wall.position.x = -house.width / 2
                    break
                case 3:
                    wall.position.z = -house.depth / 2
                    break
                }
                group.add(wall)
                scene.add(group)
                this.parts.push(group)
                this.objects.push(group);
            }

            floorY += house.height + house.foundation.height
        }

        const roofVertices = [];
        const roofIndices = [];
        const segmentSize = 2;
        const rows = Math.floor(house.width / segmentSize);
        const cols = Math.floor(house.depth / segmentSize);

        for (let i = 0; i <= rows; i++) {
            for (let j = 0; j <= cols; j++) {
                const x = house.center.x - house.width / 2 + i * segmentSize;
                const z = house.center.z - house.depth / 2 + j * segmentSize;
                const y = randomInRange(floorY, floorY + 10);  // Apply random height for variation
                roofVertices.push(x, y, z);

                // Skip last row/column to avoid indexing out of bounds
                if (i < rows && j < cols) {
                    const topLeft = i * (cols + 1) + j;
                    const topRight = topLeft + 1;
                    const bottomLeft = (i + 1) * (cols + 1) + j;
                    const bottomRight = bottomLeft + 1;

                    // Create two triangles for the quad
                    roofIndices.push(topLeft, bottomLeft, bottomRight); // First triangle
                    roofIndices.push(topLeft, bottomRight, topRight);   // Second triangle
                }
            }
        }
        // const roofGeo = new THREE.BufferGeometry()
        // roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofVertices, 3))
        // roofGeo.setIndex(roofIndices)
        // roofGeo.computeVertexNormals()
        // var roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({
        //     color: 'silver',
        //     metalness: 1,
        //     roughness: 0,
        //     side: THREE.DoubleSide
        // }))
        // roof.castShadow = true
        // roof.receiveShadow = true
        // roof.position.set(house.center.x, floorY, house.center.z)
        // this.objects.push(roof)
        // scene.add(roof)
    }

createRocks(dock) {
    const width = dock.width;
    const depth = dock.depth;
    const numRocks = 8;

    // Define the grid size based on the number of rocks and dock dimensions
    const gridCols = Math.ceil(Math.sqrt(numRocks));
    const gridRows = Math.ceil(numRocks / gridCols);
    const cellWidth = width / gridCols;
    const cellDepth = depth / gridRows;

    let rockPositions = []; // Store positions of rocks for reference

    for (let i = 0; i < numRocks; i++) {
        // Randomize rock size within each cell
        const rockWidth = randomInRange(cellWidth / 2, cellWidth * 3)

        // Calculate cell position based on index
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);

        // Calculate the center of the selected cell
        const cellCenterX = (dock.x - width / 2) + col * cellWidth + cellWidth / 2;
        const cellCenterZ = (dock.z - depth / 2) + row * cellDepth + cellDepth / 2;

        // Randomize position within the cell boundaries, keeping rock within cell limits
        const rockPosition = {
            x: randomInRange(cellCenterX - cellWidth / 4, cellCenterX + cellWidth / 4),
            y: dock.y,
            z: randomInRange(cellCenterZ - cellDepth / 4, cellCenterZ + cellDepth / 4)
        };

        // Create and position the rock
        let rock = new THREE.Mesh(
            new THREE.IcosahedronGeometry(rockWidth / 2, 0),
            new THREE.MeshStandardMaterial({ color: 'gray', map: rockTexture })
        );
        rock.position.set(rockPosition.x, randomInRange(rockPosition.y - 2, rockPosition.y - 5), rockPosition.z); // Assumes ground level is y = 0
        rock.receiveShadow = true;
        rock.castShadow = true;
        rock.frustumCulled = true;

        // Add the rock to the scene and to the parts array
        scene.add(rock);
        this.parts.push(rock);
        
        // Save the position for reference
        rockPositions.push(rockPosition);
    }
}



    update() {
        for (var object of this.objects) {
            if (object instanceof THREE.Group) {
                if (!object.boundingBox) {
                    object.boundingBox = new THREE.Box3().setFromObject(object)
                }
                if (cameraBoundingBox().intersectsBox(object.boundingBox)) {
                    const boundingBoxCenter = new THREE.Vector3();
                    object.boundingBox.getCenter(boundingBoxCenter);
                    var directionFromUser = new THREE.Vector3()
                    directionFromUser.subVectors(boundingBoxCenter, user.camera.position).normalize()

                    user.camera.position.x -= directionFromUser.x
                    // user.camera.position.y -= directionFromUser.y
                    user.camera.position.z -= directionFromUser.z

                    if (user.w) {
                        user.wS = 0.0
                    }
                    if (user.a) {
                        user.aS = 0.0
                    }
                    if (user.s) {
                        user.sS = 0.0
                    }
                    if (user.d) {
                        user.dS = 0.0
                    }
                }
            }
        }
    }
}

const sphereGeometries = {};
const leafMaterials = {};

function OrganizeFoliage(mesh) {
        for (let i = 0; i < mesh.geometry.attributes.position.array.length; i += 3) {
            mesh.geometry.attributes.position.array[i] += mesh.geometry.hlod[i];
            mesh.geometry.attributes.position.array[i + 1] += mesh.geometry.hlod[i + 1];
            mesh.geometry.attributes.position.array[i + 2] += mesh.geometry.hlod[i + 2];
        }
        mesh.geometry.needsUpdate = true
}

function DisrganizeFoliage(mesh) {
        for (let i = 0; i < mesh.geometry.attributes.position.array.length; i += 3) {
            mesh.geometry.attributes.position.array[i] += mesh.geometry.llod[i];
            mesh.geometry.attributes.position.array[i + 1] += mesh.geometry.llod[i + 1];
            mesh.geometry.attributes.position.array[i + 2] += mesh.geometry.llod[i + 2];
        }
        mesh.geometry.needsUpdate = true
}

function getCachedSphereGeometry(radius, map, transparent) {
    if (!sphereGeometries[radius]) {
        const geometry = new THREE.SphereGeometry(
            randomInRange(radius - 1, radius + 1), 
            11, 11
        );
        
        if (transparent) {
            
        } else {

            // Add a color attribute with an array of random colors for each vertex
            const vertexCount = geometry.attributes.position.count;
            const colors = new Float32Array(vertexCount * 3); // 3 values (RGB) per vertex

            // Populate the color array with initial random colors
            for (let i = 0; i < vertexCount; i++) {
                colors[i * 3] = Math.random();     // Red
                colors[i * 3 + 1] = Math.random(); // Green
                colors[i * 3 + 2] = Math.random(); // Blue
            }

            // Set the color attribute to the geometry
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));


            // Now you can manipulate position and color attributes
            for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
                geometry.attributes.position.array[i] += randomInRange(-radius, radius);
                geometry.attributes.position.array[i + 1] += randomInRange(-radius / 3, radius / 1.5);
                geometry.attributes.position.array[i + 2] += randomInRange(-radius, radius);

                // Update color values (optional if you want dynamic colors)
                geometry.attributes.color.array[i] = Math.random();
                geometry.attributes.color.array[i + 1] = Math.random();
                geometry.attributes.color.array[i + 2] = Math.random();
            }

            // Recompute normals and mark attributes as needing updates
            geometry.computeVertexNormals();
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;

        }

        sphereGeometries[radius] = geometry;
    }
    return sphereGeometries[radius];
}

function getCachedLeafMaterial(color, map, transparent) {
    if (!leafMaterials[color]) {
        var leafMaterialArgs = { 
            color: CYPRESSGREENS[Math.floor(Math.random() * CYPRESSGREENS.length)],
            side: THREE.DoubleSide,
            transparent: true,
            // opacity: .8
        }
        if (map) {
            leafMaterialArgs.map = map
        }
        leafMaterials[color] = new THREE.MeshStandardMaterial(leafMaterialArgs);
    }
    leafMaterials.needsUpdate = true
    return leafMaterials[color];
}


const tree = {
        cypress: {
            height: randomInRange(15, 20),
            width: randomInRange(1, 1.9),
            colors: ['#93b449', '#6b881c', '#a9cc4e'], 
            trimmed: Math.random() < 0.5 ? true : false
        }
 };

class Terrain {
    // map
    // Grass
    segments = 79
    visited = { }
    paintings = [ ]
    constructor(options) {
        // this.grassTexture = new THREE.TextureLoader().load("/images/nasturtiums1.jpg")
        this.Grass = [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ]
        for (var key in options.map) {
            this[key] = options.map[key]
        }
        this.sop = VM.map.sop
        // this.textures =  _textures;
        this.vertices = new Map();
        this.meshes = [];
        this.plants = []
        this.markers = {};
        this.surroundingCenters = [];
        this.currentMesh = 0;
        this.center = new THREE.Vector3(0, 0, 0);


       



        this.generateTerrain();
    }

    init() {
        this.generateTerrain();
    }

    getPoint(t, optionalTarget = new THREE.Vector3()) {
        // Interpolate between the points based on t
        const pointIndex = (this.points.length - 1) * t;
        const index1 = Math.floor(pointIndex);
        const index2 = Math.min(index1 + 1, this.points.length - 1);

        // Get the two points to interpolate between
        const point1 = this.points[index1];
        const point2 = this.points[index2];

        // Linear interpolation
        optionalTarget.lerpVectors(point1, point2, pointIndex - index1);
        
        return optionalTarget;
    }

    createFlora(x, Y, z, treeKind) {
        var tree = {
            cypress: {
                height: randomInRange(11.1, 60),
                width: randomInRange(1, 2),
                colors: CYPRESSGREENS, 
                trimmed: Math.random() < 0.5 ? true : false,
                map: new THREE.TextureLoader().load("/images/leaf-oval-green.png"),
                trunk: {
                    map: TRUNKTEXTURE
                },
                trunkHeight: randomInRange(9, 11)
            },
            oak: {
                height: randomInRange(11.1, 60),
                width: randomInRange(1, 2),
                colors: CYPRESSGREENS, 
                trimmed: Math.random() < 0.5 ? true : false,
                map: new THREE.TextureLoader().load("/images/leaf-branch.webp"),
                trunk: {
                    map: TRUNKTEXTURE
                }
            }
        };


        const twoPi = Math.PI * 2;
        const instanceCount = Math.floor(tree[treeKind].height * 7); // Adjust count as needed
        const instancedMesh = new THREE.InstancedMesh(
            getCachedSphereGeometry(tree[treeKind].width / 2),
            getCachedLeafMaterial(tree[treeKind].colors[0], tree[treeKind].map, new THREE.TextureLoader().load('/images/leaf-branch.webp')), // Initial color
            instanceCount
        );
        instancedMesh.frustrumCulled = true

        // Define gradient colors for leaves
        const startColor = new THREE.Color(tree[treeKind].colors[0]); // Darker color at the base
        const endColor = new THREE.Color(tree[treeKind].colors[tree[treeKind].colors.length - 1]); // Lighter color at the top

        let index = 0;
        var none = true //Math.random() < 0.5
        var ydiff = 0
        var hasFoliage = false
        while (!hasFoliage) {
            for (let y = Y; y < Y + tree[treeKind].height; y += 1) {
                if (tree[treeKind].height > 20 && Math.random() < 0.5) {
                    continue
                }
                const progress = (y - Y) / tree[treeKind].height;
                let radiusAtY = (1 - progress) * (tree[treeKind].width / 2) * randomInRange(2, 3.25);
                if (radiusAtY < 1) radiusAtY = 1;
                if (none && ydiff++ < tree[treeKind].trunkHeight) {
                    radiusAtY = 0
                } else if (none) {
                    radiusAtY *= randomInRange(1, 4)
                }

                if (Math.random() < 0.4) {
                    radiusAtY = 0
                }

                if (radiusAtY > 0) {
                    hasFoliage = true
                }

                const interpolatedColor = startColor.clone().lerp(endColor, progress);

                for (let p = 0; p < twoPi && index < instanceCount; p += randomInRange(0.6, 2.0)) {
                    const matrix = new THREE.Matrix4();
                    const randomAngle = randomInRange(-0.4, 0.4);
                    const randomHeightAdjustment = randomInRange(-0.3, 0.3);

                    const xPos = x + (radiusAtY * Math.cos(p + randomAngle)) + randomInRange(-0.75, 0.75);
                    const zPos = z + (radiusAtY * Math.sin(p + randomAngle)) + randomInRange(-0.75, 0.75);
                    const yPos = y + randomHeightAdjustment;

                    matrix.setPosition(xPos, yPos, zPos);
                    matrix.scale(new THREE.Vector3(radiusAtY, radiusAtY, radiusAtY));
                    instancedMesh.setMatrixAt(index, matrix);

                    // Set color for each instance based on height progress
                    instancedMesh.setColorAt(index, new THREE.Color(Math.random(), Math.random(), Math.random()));

                    index++;
                }
            }

        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        var radiusBottom =  tree[treeKind].height * .02
        var radiusTop = radiusBottom * .1
        // Create the trunk
        const trunkGeometry = new THREE.CylinderGeometry(
            radiusTop,// : Float, 
            radiusBottom,// : Float, 
            tree[treeKind].height,//height : Float, 
            3,//radialSegments : Integer, 
            7,//heightSegments : Integer, 
             true,//openEnded : Boolean, 
             Math.random() * Math.PI * 2,//thetaStart : Float, 
             Math.PI * 2//thetaLength : Float
        );
        const trunkMaterial = new THREE.MeshStandardMaterial({
            map: TRUNKTEXTURE,
            transparent: false
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, Y + tree[treeKind].height / 2, z);
        trunk.branches = [];
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        return new Terrain.Tree(trunk, instancedMesh);
    }



    generateTerrain(centerX = 0, centerY = 0, centerZ = 0) {
        const centerKey = `${centerX}_${centerZ}`;
        this.initializeTerrain();
        const perlinNoise = Terrain.generatePerlinNoise({ center: { x: centerX, y: centerY, z: centerZ }, centerKey });

        // Generate terrain vertices
        const vertices = this.generateVertices(perlinNoise, centerX, centerY, centerZ);

        // Generate cove vertices and indices
        const { theCove, indices } = this.generateCoveVertices(-this.width / 2, this.width / 2, -this.height / 2, this.height / 2);

        // Create and add water mesh
        this.water = this.createWaterMesh(theCove, indices);

        // Adjust terrain based on existing meshes
        this.adjustVerticesBasedOnMeshes(vertices);

        // Populate terrain features
        this.populateTerrainFeatures(vertices, indices);
    }

   createWaterMesh(vertices, indices) {
        // var vertices = [];
        // var indices = [];
        var widthSegments = 20; // Number of segments along the width
        var heightSegments = 20; // Number of segments along the height
        var segmentSize = 3;

        // // Generate vertices for a grid
        // for (var i = 0; i <= widthSegments; i++) {
        //     for (var j = 0; j <= heightSegments; j++) {
        //         vertices.push(i * segmentSize - 20, -10, j * segmentSize - 20);
        //     }
        // }

        // Generate indices for each segment to form triangles
        for (var i = 0; i < widthSegments; i++) {
            for (var j = 0; j < heightSegments; j++) {
                var a = i * (heightSegments + 1) + j;
                var b = i * (heightSegments + 1) + (j + 1);
                var c = (i + 1) * (heightSegments + 1) + j;
                var d = (i + 1) * (heightSegments + 1) + (j + 1);

                // Two triangles per square
                indices.push(a, b, d); // Triangle 1
                indices.push(a, d, c); // Triangle 2
            }
        }

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        var mat = new THREE.MeshStandardMaterial({
            map: new THREE.TextureLoader().load("/images/waternormals.jpg"),
            side: THREE.DoubleSide
        });

        var mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
    }

    // Helper functions
    initializeTerrain() {
        this.terrainType = 'half';  // ['sparse', 'dense', 'half'][Math.floor(Math.random() * 3)];
        this.cliffs = [];
        this.grounds = [];
        this.grassTriangles = [];
        this.cliffMeshes = [];
        this.v0 = new THREE.Vector3(this.center.x - this.t, 0, this.center.z - this.t)
        this.v1 = new THREE.Vector3(this.center.x + this.t, 0, this.center.z - this.t)
        this.v2 = new THREE.Vector3(this.center.x + this.t, 0, this.center.z + this.t)
        this.v3 = new THREE.Vector3(this.center.x + this.t, 0, this.center.z + this.t)
    }

    generateVertices(perlinNoise, centerX, centerY, centerZ) {
        const vertices = [];
        const segmentSize = 1 / this.segments;
        const v0 = { x: centerX - t, y: centerY, z: centerZ + t };
        const v1 = { x: centerX + t, y: centerY, z: centerZ + t }; 
        const v2 = { x: centerX + t, y: centerY, z: centerZ - t }; 
        const v3 = { x: centerX - t, y: centerY, z: centerZ - t };

        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let v = this.interpolateVertex(i, j, v0, v1, v2, v3, segmentSize, perlinNoise);
                vertices.push(v.x, v.y, v.z);
            }
        }
        return vertices;
    }

    interpolateVertex(i, j, v0, v1, v2, v3, segmentSize, perlinNoise) {
        const x = i * segmentSize;
        const y = j * segmentSize;
        let v = new THREE.Vector3(
            (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x,
            (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y,
            (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z
        );

        // Apply perlin noise and additional adjustments
        const noiseX = Math.floor(x * (this.noiseWidth - 1));
        const noiseY = Math.floor(y * (this.noiseHeight - 1));
        const variance = perlinNoise[noiseY * this.noiseWidth + noiseX] * this.altitudeVariance;
        v.y += variance;

        // Flatten terrain in specified regions
        this.flattenTerrain(v);

        return v;
    }

    flattenTerrain(v) {
        const inField = v.x > -landscape.field.width / 2 && v.x < landscape.field.width / 2 && v.z > -landscape.field.depth / 2 && v.z < landscape.field.depth / 2;
        if (inField) v.y = landscape.field.center.y;

        if (isIn(v, 'dock')) v.y = -20;

        if (isIn(v, 'cove')) v.y = randomInRange(-20, -5)

        if (isIn(v, 'sideyard')) v.y = house.center.y;
    }

    generateCoveVertices(minX, maxX, minZ, maxZ) {
        const theCove = [];
        const indices = [];
        const xStep = (maxX - minX) / this.segments;
        const zStep = (maxZ - minZ) / this.segments;

        for (let i = 0; i <= this.segments; i++) {
            for (let j = 0; j <= this.segments; j++) {
                let x = minX + i * xStep;
                let z = minZ + j * zStep;
                theCove.push(x, -5, z);

                // Generate indices for two triangles in each grid cell
                if (i < this.segments && j < this.segments) {
                    let topLeft = i * (this.segments + 1) + j;
                    let topRight = (i + 1) * (this.segments + 1) + j;
                    let bottomLeft = i * (this.segments + 1) + (j + 1);
                    let bottomRight = (i + 1) * (this.segments + 1) + (j + 1);
                    indices.push(topLeft, bottomLeft, bottomRight, topLeft, bottomRight, topRight);
                }
            }
        }
        return { theCove, indices };
    }


    adjustVerticesBasedOnMeshes(vertices) {
        for (let m of this.meshes) {
            this.alignMeshHeights(vertices, m.geometry.attributes.position.array);
        }
    }

    alignMeshHeights(vertices, meshPositions) {
        for (let x1 = 0; x1 < meshPositions.length; x1 += 3) {
            for (let x2 = 0; x2 < vertices.length; x2 += 3) {
                if (this.verticesMatch(meshPositions, vertices, x1, x2)) {
                    vertices[x2 + 1] = meshPositions[x1 + 1];
                }
            }
        }
    }

    verticesMatch(meshPositions, vertices, x1, x2) {
        return (meshPositions[x1] === vertices[x2] && meshPositions[x1 + 2] === vertices[x2 + 2]) || 
               (Math.abs(meshPositions[x1 + 2] - vertices[x2 + 2]) < 2 && meshPositions[x1] === vertices[x2]) || 
               (Math.abs(meshPositions[x1] - vertices[x2]) < 2 && meshPositions[x1 + 2] === vertices[x2 + 2]);
    }

    populateTerrainFeatures(vertices, indices) {
        const segmentSize = 1 / this.segments;
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                this.addTerrainFeature(i, j, segmentSize, vertices, indices);
            }
        }
        this.clusterCliffs()
    }

    addTerrainFeature(i, j, segmentSize, vertices, indices) {
        let a = i + j * (this.segments + 1);
        let b = (i + 1) + j * (this.segments + 1);
        let c = (i + 1) + (j + 1) * (this.segments + 1);
        let d = i + (j + 1) * (this.segments + 1);

        indices.push(a, b, d); // First triangle in the quad
        indices.push(b, c, d); // Second triangle in the quad

        let x = i * segmentSize;
        let y = j * segmentSize;
        let v = new THREE.Vector3();

        v.x = (1 - x) * (1 - y) * this.v0.x + x * (1 - y) * this.v1.x + x * y * this.v2.x + (1 - x) * y * this.v3.x;
        v.y = (1 - x) * (1 - y) * this.v0.y + x * (1 - y) * this.v1.y + x * y * this.v2.y + (1 - x) * y * this.v3.y;
        v.z = (1 - x) * (1 - y) * this.v0.z + x * (1 - y) * this.v1.z + x * y * this.v2.z + (1 - x) * y * this.v3.z;

        const t1 = TriangleMesh(vertices, a, b, d, this.width, this.height, groundTexture);
        const t2 = TriangleMesh(vertices, b, c, d, this.width, this.height, groundTexture);

        [t1, t2].forEach((triangleMesh) => {

            var trianglePosition = this.getTriangleCenter(triangleMesh.triangle)
            var triangle = triangleMesh.triangle

            this.grounds.push(triangleMesh)

            /* TERRAIN FEATURES */
            const CLIFF = Math.abs(triangleMesh.normal.y) < 0.4 && (Math.abs(triangleMesh.normal.x) > 0.4 || Math.abs(triangleMesh.normal.z) > 0.4)
            const YARD = isIn(trianglePosition, 'yard')
            const HOUSE = isIn(trianglePosition, 'house')
            const DOCK = isIn(trianglePosition, 'dock')
            const SIDEYARD = isIn(trianglePosition, 'sideyard')
            const BACKYARD = isIn(trianglePosition, 'backyard')
            const COVE = isIn(trianglePosition, 'cove')

           
            if (CLIFF) {
                this.cliffs.push(triangle)
            } else {
                let cypressTreePosition
                if (
                        (
                            !CLIFF && !COVE && !HOUSE && !YARD && !SIDEYARD && !DOCK
                            && (
                                (
                                    trianglePosition.x > 20 ?  Math.random() < 0.005 : (
                                        trianglePosition.z > 20 ? Math.random() < 0.008 : Math.random() < 0.003
                                    )
                                )
                            )
                        ) || (
                            BACKYARD && Math.random() < 0.01
                        )
                    ) {
                    cypressTreePosition = randomPointOnTriangle(triangle.a, triangle.b, triangle.c)
                    var cypressTree = this.createFlora(cypressTreePosition.x, cypressTreePosition.y, cypressTreePosition.z, 'cypress')
                    this.trees.push(cypressTree)
                }

                if (false && (YARD || SIDEYARD) && !HOUSE) {
                    var instanceCount = YARD ? 9000 : 1000
                    var instancedMesh = new THREE.InstancedMesh(
                        new THREE.PlaneGeometry(randomInRange(.01, 0.08), randomInRange(.1, 0.2)),
                        new THREE.MeshStandardMaterial({ color: 'green', side: THREE.DoubleSide }),
                        instanceCount
                    )
                    instancedMesh.castShadow = true
                    instancedMesh.receiveShadow = true
                    // instancedMesh.position.set(trianglePosition.x, trianglePosition.y, trianglePosition.z)
                    instancedMesh.triangle = triangle
                   for (let k = 0; k < instanceCount; k++) {
                        // Generate a random position on the triangle
                        const pos = randomPointOnTriangle(triangle.a, triangle.b, triangle.c);
                        const grass = new THREE.Object3D();
                        grass.position.copy(pos);
                        grass.rotation.y = Math.random() * Math.PI * 2;
                        grass.rotation.x = randomInRange(0, 0.2);
                        const heightScale = randomInRange(0.5, 1.5);
                        grass.scale.set(1, heightScale, 1);
                        grass.updateMatrix();
                        instancedMesh.setMatrixAt(k, grass.matrix);
                        instancedMesh.setColorAt(k, new THREE.Color(randomInRange(0, 0.2), randomInRange(0.8, 1),randomInRange(0, 0.2)));
                    }

                    // Ensure the instance color attribute is updated
                    instancedMesh.instanceColor.needsUpdate = true;
                    instancedMesh.instanceMatrix.needsUpdate = true;

                    scene.add(instancedMesh)
                    this.grasses.push(instancedMesh)
                }
            }
        })

       
    }


    createInstancedMeshGrounds() {
        // create instanced meshes for simple items
        var triangleGeometry = new THREE.BufferGeometry();
        let triangleVertices = new Float32Array([
            0, 0, 0,  // Vertex 1 (relative to the origin)
            1, 0, 0,  // Vertex 2
            0, 1, 0   // Vertex 3
        ]);   
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(triangleVertices, 3));

          // Step 2: Set up MeshStandardMaterial with vertex colors enabled
        var groundInstancedMeshmaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const instanceCount = this.grounds.length;
        this.groundInstancedMesh = new THREE.InstancedMesh(triangleGeometry, groundInstancedMeshmaterial, instanceCount);
        this.groundInstancedMesh.castShadow = true
        this.groundInstancedMesh.receiveShadow = true      
        this.groundInstancedMesh.material.receiveShadow = true;
        this.groundInstancedMesh.material.castShadow = true;

        // Step 3: For each ground element, update the instance matrix
        for (let i = 0; i < this.grounds.length; i++) {
            const groundTriangle = this.grounds[i];
            const trianglePosition = new THREE.Vector3(
                groundTriangle.center.x,
                groundTriangle.center.y,
                groundTriangle.center.z
            );
            const triangleNormal = groundTriangle.normal;

            // Use an Object3D to easily apply transformations
            const object3d = new THREE.Object3D();

            // Copy and decompose the existing matrix if it exists, or create a new one
            if (groundTriangle.matrix) {
                object3d.matrix.copy(groundTriangle.matrix);
                object3d.matrix.decompose(object3d.position, object3d.rotation, object3d.scale);
            } else {
                throw new Error("A ground triangle is missing a matrix.")
            }

            // Set the new position
            object3d.position.copy(trianglePosition);

            // Apply random rotation around Z-axis
            object3d.rotation.z = Math.random() * Math.PI * 2;

            // Set scale for each instance (adjust as needed)
            object3d.scale.set(2.75, 2.75, 2.75);

            // Align rotation based on triangle normal
            object3d.lookAt(trianglePosition.clone().add(triangleNormal));

            // Update the matrix based on new transformations
            object3d.updateMatrix();

            // Set the updated matrix on the instance
            this.groundInstancedMesh.setMatrixAt(i, object3d.matrix);
        }

        // Step 4: Ensure the instance matrices are updated
        this.groundInstancedMesh.instanceMatrix.needsUpdate = true;

        // Finally, add the instanced mesh to the scene
        // scene.add(this.groundInstancedMesh);

    }

    getTriangleNormal(triangle) {
        const v0 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
        const v1 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
        return new THREE.Vector3().crossVectors(v0, v1).normalize();
    }
   
    trianglePosition(v0, v1, v2) {
        // Create a new vector to store the center (centroid) of the triangle
        let center = new THREE.Vector3();

        // Compute the center (centroid) of the triangle
        center.x = (v0.x + v1.x + v2.x) / 3;
        center.y = (v0.y + v1.y + v2.y) / 3;
        center.z = (v0.z + v1.z + v2.z) / 3;

        return center;
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


    generateRollingPerlinNoise() {
        const map = VM.map;
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

    static generatePerlinNoise(options) {
        // Get the map for the user's level from the VM (some kind of virtual machine or game state)
        const map = VM.map;

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
        let whiteNoise = Terrain.generateWhiteNoise();

        // Create an empty array to store the "smooth noise" layers.
        // We'll generate `octaveCount` smooth noise layers, which get finer and finer as the octaves go up.
        let smoothNoiseList = new Array(octaveCount);

        // Loop through each octave (from 0 to octaveCount-1) to generate and store smooth noise.
        for (let i = 0; i < octaveCount; ++i) {
            // Generate a smooth version of the white noise for this octave and store it.
            // Smooth noise is like white noise, but with gentler, less sharp changes between points.
            smoothNoiseList[i] = Terrain.generateSmoothNoise(i, whiteNoise);
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

    static generateWhiteNoise() {
        const noise = new Array(VM.map.width * VM.map.height);
        for (let i = 0; i < noise.length; ++i) {
            noise[i] = Math.random();
        }
        return noise;
    }

    static generateSmoothNoise(octave, whiteNoise) {
        const map = VM.map;
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
            var top = Terrain.interpolate(whiteNoise[sampleY0 * map.width + sampleX0], whiteNoise[sampleY1 * map.width + sampleX0], vertBlend);
            // blend bottom two corners
            var bottom = Terrain.interpolate(whiteNoise[sampleY0 * map.width + sampleX1], whiteNoise[sampleY1 * map.width + sampleX1], vertBlend);
            // final blend
            noise[noiseIndex] = Terrain.interpolate(top, bottom, horizBlend);
            noiseIndex += 1;
          }
        }
        return noise;
    }

    lerp(a, b, t) {
        return a * (1 - t) + b * t;
    }

    generateCellularNoise() {
        const width = VM.map.width;
        const height = VM.map.height;
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
    
  
    static interpolate(x0, x1, alpha) {
        return x0 * (1 - alpha) + alpha * x1;
    }
    
 
    shareEdge(triangle1, triangle2) {
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

    dfs(index, cluster) {
        this.visited[index] = true;
        cluster.push(this.cliffs[index]);
        for (let i = 0; i < this.cliffs.length; i++) {
            if (!this.visited[i] && this.shareEdge(this.cliffs[index], this.cliffs[i])) {
                this.dfs(i, cluster);
            }
        }
    }

    clusterTriangles(clusterKey, array) {
        const clusters = []
        this.visited[clusterKey] = new Array(array.length).fill(false)
        for (var i = 0; i < array.length; i++) {
            if (!this.visited[clusterKey][i]) {

            }
        }
    }

    clusterCliffs() {
        const clusters = [];

        this.visited.cliffs = new Array(this.cliffs.length).fill(false);
   
        for (let i = 0; i < this.cliffs.length; i++) {
            if (!this.visited.cliffs[i]) {
                const cluster = [];
                this.dfs(i, cluster);
                clusters.push(cluster);
            }
        }

        this.cliffs = []

        // console.log("clustering " + clusters.length + " cliffs clusters")


        var cluster_color = new THREE.Color(Math.random(), Math.random(), Math.random())
        // const cluster_image = new THREE.TextureLoader().load("/images/dry-rough-rock-face-texture.jpg")
        clusters.forEach(cluster => {
            const cluster_image = new THREE.TextureLoader().load("/images/dry-rough-rock-face-texture.jpg", (texture) => {
                // Randomly select an area of the texture
                const zoomLevel = 3; // Adjust this value for more or less zoom
                const randomX = Math.random() * (1 - 1 / zoomLevel);
                const randomY = Math.random() * (1 - 1 / zoomLevel);

                // Apply the offset and repeat to zoom into a specific part
                texture.offset.set(randomX, randomY);
                texture.repeat.set(zoomLevel, zoomLevel);
                texture.needsUpdate = true;
            });
            var cliffGeometry = new THREE.BufferGeometry()
            var points = []
            cluster.forEach(triangle => {
                const index0 = triangle.indices[0];
                const index1 = triangle.indices[1];
                const index2 = triangle.indices[2];

                const a = triangle.a
                const b = triangle.b
                const c = triangle.c

                // // Create geometry for this triangle
                const geometry = new THREE.BufferGeometry();
                const vertices = new Float32Array([
                    a.x, a.y, a.z,
                    b.x, b.y, b.z,
                    c.x, c.y, c.z
                ]);
                points.push(a.x, a.y, a.z,
                    b.x, b.y, b.z,
                    c.x, c.y, c.z)
                const uvs = new Float32Array([
                    0, 0,  // UV for vertex a
                    1, 0,  // UV for vertex b
                    0.5, 1 // UV for vertex c (or adjust to your triangle size)
                ]);


                // Fix: Reverse the order of the cross product to flip the normal
                const edge1 = new THREE.Vector3().subVectors(c, a);  // Use c - a instead of b - a
                const edge2 = new THREE.Vector3().subVectors(b, a);  // Use b - a instead of c - a
                const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();  // Cross product for normal

                // Create the normal array (same normal for all 3 vertices in this flat triangle)
                const normals = new Float32Array([
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z
                ]);

                // Set position and normal attributes for the geometry
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
                geometry.setAttribute('uvs', new THREE.BufferAttribute(uvs, 3));

                geometry.computeVertexNormals();

                // Load the texture for the cliff triangle
                

                // Create the material with the texture
                const material = new THREE.MeshBasicMaterial({
                    map: cluster_image,
                    // color: cluster_color,
                    side: THREE.DoubleSide,
                    transparent: false,
                    wireframe: false
                });

                // Create the mesh for the triangle
                const mesh = new THREE.Mesh(geometry, material);
                mesh.receiveShadow = true;
                mesh.castShadow = true;
                mesh.position.y += .2;

                // Store triangle for later use if needed
                mesh.triangle = triangle;

                triangle.normal = normal;

                this.cliffs.push(mesh);
            });
        });
    }

    updateTerrain() {
        var sopCenter = user.camera.position
        // Helper function to determine if a point is within the SOP
        function isInSOP(point, sopCenter, sopRadius) {
            const dx = point.x - sopCenter.x;
            const dy = point.y - sopCenter.y;
            const dz = point.z - sopCenter.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            return distanceSquared <= sopRadius * sopRadius;
        }

        // Remove triangles outside the SOP from the scene

        this.trees.forEach((tree) => {
            // Add or remove tree based on SOP (Screen-oriented projection) center check
            if (tree.trunk.parent && !isInSOP(tree.trunk.position, sopCenter, this.sop.trees)) {
                /* Disorganize */
                scene.remove(tree.foliage)
                scene.remove(tree.trunk)
            } else if (!tree.trunk.parent && isInSOP(tree.trunk.position, sopCenter, this.sop.trees)) {
                /* Organize */
                scene.add(tree.foliage)
                scene.add(tree.trunk)
            }
        });


        this.plants.forEach(plant => {
            if (plant.parent && !isInSOP(plant.position.clone(), sopCenter, this.sop.grasses)) {
                scene.remove(plant);
            } else if (!plant.parent && isInSOP(plant.position.clone(), sopCenter, this.sop.grasses)) {
                scene.add(plant);
            }
        })

        this.grounds.forEach(ground => {
            const center = new THREE.Vector3(
                ((ground.triangle.a.x + ground.triangle.a.x + ground.triangle.c.x)/ 3),
                ((ground.triangle.a.y + ground.triangle.a.y + ground.triangle.c.y)/ 3),
                ((ground.triangle.a.z + ground.triangle.a.z + ground.triangle.c.z)/ 3)
            )
            if (ground.parent && center.distanceTo(user.camera.position) > this.sop.grounds) {
                scene.remove(ground);
            } else if (!ground.parent && center.distanceTo(user.camera.position) < this.sop.grounds/*&& isInSOP(center, sopCenter, this.sop.grounds)*/) {
                scene.add(ground);
            }
        })

        // Remove triangles outside the SOP from the scene
        this.grasses.forEach(grass => {
            var t = this.getTriangleCenter(grass.triangle)
            const pos = new THREE.Vector3(
                t.x, t.y, t.z
            ).distanceTo(user.camera.position)
            if (grass.parent && pos > this.sop.grasses) {
                scene.remove(grass)
            } else if (!grass.parent && pos < this.sop.grasses) {
                scene.add(grass)
            }
        });

         this.cliffs.forEach(cliff => {
            var pos = this.getTriangleCenter(cliff.triangle)
            if (cliff.parent && !isInSOP(pos, sopCenter, this.sop.cliffs)) {
                scene.remove(cliff);
            } else if (!cliff.parent && isInSOP(pos, sopCenter, this.sop.cliffs)) {
                scene.add(cliff);
            }
        });       
    }

    getTriangleCenter(triangle) {
        const centerX = (triangle.a.x + triangle.b.x + triangle.c.x) / 3;
        const centerY = (triangle.a.y + triangle.b.y + triangle.c.y) / 3;
        const centerZ = (triangle.a.z + triangle.b.z + triangle.c.z) / 3;
        return { x: centerX, y: centerY, z: centerZ };
    }

    static Tree = class {
        constructor(trunk, foliage) {
            this.trunk = trunk; 
            if (foliage) {
                 this.foliage = foliage;  
            }
            this.boundingBox = new THREE.Box3().setFromObject(this.trunk).union(new THREE.Box3().setFromObject(this.foliage));
        }
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

    createGrassResult(indices, vertices, triangle, bladeCount = 11, bladeHeight = 1, bladeWidth = 0.1) {


        const bladeGeometry = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, 4);
        bladeGeometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: ['#93b449', '#6b881c', '#a9cc4e', 'lawngreen'][Math.floor(Math.random() * 4)],
            // color: new THREE.Color(this.Grass[Math.floor(Math.random() * this.Grass.length)]),
            // map: this.grassTexture,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1
        });
        

        let instancedMesh = new THREE.InstancedMesh(bladeGeometry, material, bladeCount);
        let bladePositions = [];

        for (let i = 0; i < bladeCount; i++) {
            [instancedMesh, bladePositions] = this.createGrassBlade(instancedMesh, triangle, bladePositions, i);
        }

        instancedMesh.frustrumCulled = true
        // instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMesh.position.y += bladeHeight / 2

        var ground_triangles = new Triangle(vertices, triangle.a, triangle.b, triangle.c, this.width, this.height)
        var groundMeshGeometry = new THREE.BufferGeometry()
        var ground_points = []
        for (var triangle of ground_triangles) {
            for (var vertex in ground_triangles[triangle]) {
                ground_points.push(vertex.x, vertex.y, vertex.z)
            }
        }
        groundMeshGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ground_points), 3))
        groundMeshGeometry.computeVertexNormals()
        groundMeshGeometry.computeBoundingBox()
        var ground = new THREE.Mesh(groundMeshGeometry, new THREE.MeshStandardMaterial({
            map: new THREE.TextureLoader().load("/images/ground-0.jpg"),
            side: THREE.DoubleSide
        }))
        ground.castShadow = true;
        ground.receiveShadow = true
        return new GrassPatch({
            ground,
            mesh: instancedMesh,
            triangle,
            bladePositions: bladePositions 
        });
    }

    createGrassPatch(indices, vertices, mesh) {
        const grassResult = this.createGrassResult(
            indices, 
            vertices,
            mesh,
            5,
            randomInRange(0.05, 0.2),
            randomInRange(0.1, 0.5)
        );

        // Mark grass on groundColorMap to match patches
        grassResult.bladePositions.forEach((bladePosition) => {
            const closestVertexIndex = this.findClosestVertex(bladePosition, vertices);
            if (closestVertexIndex >= 0 && closestVertexIndex < vertices.length / 3) {
                const x = Math.floor(closestVertexIndex / (this.segments + 1));
                const y = closestVertexIndex % (this.segments + 1);
            }
        });

        return grassResult;
    }

    setCamera(camera) {
        this.camera = camera;
    }
}

class UserController {
    inersections = []
    constructor(terrain) {
        this.terrain = terrain;
        this.isJumping = false;
        this.touchdown = false
        this.touchposition = {x:0,y:0}
        this.w = false;
        this.a = false;
        this.s = false;
        this.d = false;
        this._w = false;
        this._a = false;
        this._s = false;
        this._d = false;
        this.wS = .1
        this.aS = .1
        this.sS = .1
        this.dS = .1
        this.tS = .4
        this.mousedown = false
        this.shift = false
        this.space = false;
        this.ArrowUp = false;
        this.ArrowRight = false;
        this.ArrowDown = false;
        this.ArrowLeft = false;
        this.leftShift = false;
        this.rightShift = false;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.centerKey = null;
        this.cmd = false;
        this.velocity = new THREE.Vector3(); // General velocity
        this.intersectsTerrain = [];
        this.time_held = {
            w: 0,
            a: 0,
            s: 0,
            d: 0
        }
        this.addEventListener();
        this.init();
        this.objects = []
    }

    moveForward() {
        var { _w, _x, _y, _z } = this.camera.quaternion;
        var forward_X = 2 * (_x * _z + _w * _y);
        var forward_Y = 2 * (_y * _z - _w * _x);
        var forward_Z = 1 - 2 * (_x**2 + _y**2);
        
        var distance = -this.wS;
        forward_X *= distance;
        forward_Y *= distance;
        forward_Z *= distance;

        this.camera.position.add(new THREE.Vector3(forward_X, forward_Y, forward_Z));
    }

    init() {
        let position = VM.user.position;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);
        this.camera.near = 0.1;  // Increase this value
        this.camera.far = 10000;  // Reduce far plane if it's too large
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

    touchend (event) {
        alert(`${event.touches[0].clientX}, ${event.touches[0].clientY}`)
        if (event.touches[0].clientX > window.innerWidth - 100 &&
            event.touches[0].clientY > window.innerHeight - 100) {
            alert('this.shouldMoveForward = false')
            this.shouldMoveForward = false
        }
        
        lastTouchX = null;
        lastTouchY = null;
    }

    addEventListener() {
        window.addEventListener('keydown', (e) => {
            if (/object-edit/.test(e.srcElement.className)) return
            const key = e.key.toUpperCase();
            if (key == 'META') {
                this.meta = true
            }
            if (this.cmd && key == 'S') {
                
            } if (key == 'W') {
                this.w = true;
                this.time_held.w = new Date().getTime();
            } else if (key == 'A') {
                this.a = true;
            } else if (key == 'S') {
                event.preventDefault()
                if (this.meta) {
                    alert('saved')
                    localStorage.position = JSON.stringify({ x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z })
                    localStorage.rotation = JSON.stringify({ x: this.camera.rotation._x, y: this.camera.rotation._y, z: this.camera.rotation._z })
                } else {
                    this.s = true;
                }
            } else if (key == 'D') {
                this.d = true;
            } else if (key == ' ') {
                this.isJumping = true;
                this.jumpVelocity = this.run ? 1 : 0.2;
            } else if (key == 'ARROWUP') {
                this.ArrowUp = true;
            } else if (key == 'ARROWDOWN') {
                this.ArrowDown = true;
            } else if (key == 'ARROWLEFT') {
                this.ArrowLeft = true;
            } else if (key == 'ARROWRIGHT') {
                this.ArrowRight = true;
            } else if (key === 'SHIFT') {
                this.run = true
            } else if (key === 'ShiftRight') {
                this.rightShift = true;
            }
        })
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toUpperCase();
            if (key == 'META') {
                this.cmd = false
            }
            if (key == 'W') {
                user.w = false;
                this.wS = .1
                this.time_held.w = 0;
            } else if (key == 'A') {
                this.a = false;
                this.aS = .1
            } else if (key == 'S') {
                this.s = false;
                 this.sS = .1
            } else if (key == 'D') {
                this.d = false;
                this.dS = .1
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
            } else if (key === 'SHIFT') {
                this.run = false;
            } else if (key === 'ShiftRight') {
                this.rightShift = false;
            }
        });

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();


        window.addEventListener('click', (e) => {
            let objectedit = ObjectEdit.isClass('object-edit', e.srcElement)
            if (objectedit) {
                return window.editor.click(e)
            }

            document.querySelectorAll('.object-edit').forEach(e => e.remove())

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
                        // console.log(targetFloor, targetHeight);
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
                                    // console.log('reaching targetHeight', m.position.y)
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


        this.yaw = 0;   // Rotation around the Y-axis (left/right)
        this.pitch = 0; // Rotation around the X-axis (up/down)
        this.maxPitch = Math.PI / 2;
        this.previous = { movementX: 0, movementY: 0 }
        this.targetLook = new THREE.Vector3();

        window.addEventListener('mousedown', () => { this.mouseDown = true });
        window.addEventListener('mouseup', () => { this.mouseDown = false });

        let lastTouchX = null;
        let lastTouchY = null;

        // Define the max angle for the arc (in radians)
        const maxAngle = THREE.MathUtils.degToRad(45);  // 45 degrees in radians
        const baseSensitivity = 0.0085; 

        // Mouse move event for controlling camera rotation
        window.addEventListener('mousemove', (event) => {
            if (this.mouseDown) {
                const canvas = document.querySelector('canvas');
                const centerX = canvas.clientWidth / 2;
                const centerY = canvas.clientHeight / 2;
                const deltaX = event.clientX - centerX;
                const deltaY = event.clientY - centerY;
                const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);  // Max distance to edge of canvas
                const scaledSensitivity = baseSensitivity * (distanceFromCenter / maxDistance);

                // Apply scaled sensitivity to yaw and pitch adjustments
                this.yaw -= event.movementX * scaledSensitivity;
                this.pitch -= event.movementY * scaledSensitivity;

                // Clamp the pitch to avoid flipping
                this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

                const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');  // Yaw-Pitch-Roll
                this.camera.quaternion.setFromEuler(euler);  // Apply rotation to the camera
            }
        });


        window.addEventListener('touchstart', (event) => {
            this.touchdown = true;
            lastTouchX = event.touches[0].clientX;
            lastTouchY = event.touches[0].clientY;
            if (event.touches[0].clientX > window.innerWidth - 100 &&
                event.touches[0].clientY > window.innerHeight - 100) {
                this.shouldMoveForward = true
            } else if (event.touches[0].clientX > window.innerWidth - 100 &&
                event.touches[0].clientY > window.innerHeight - 200) {
                this.shouldMoveForward = false
            }
        });

        window.addEventListener('touchmove', (event) => {
            if (event.touches[0].clientX > window.innerWidth - 100 &&
                event.touches[0].clientY > window.innerHeight - 100) {
                return
            } 
            const touch = event.touches[0];
            const canvas = document.querySelector('canvas');
            const centerX = canvas.clientWidth / 2;
            const centerY = canvas.clientHeight / 2;
            const deltaX = touch.clientX - centerX;
            const deltaY = touch.clientY - centerY;
            const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);  // Max distance to edge of canvas
            const scaledSensitivity = baseSensitivity * (distanceFromCenter / maxDistance);

            // Calculate movement relative to last touch position
            const movementX = touch.clientX - lastTouchX;
            const movementY = touch.clientY - lastTouchY;

            this.yaw -= movementX * scaledSensitivity;
            this.pitch -= movementY * scaledSensitivity;

            // Clamp the pitch to avoid flipping
            this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

            const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');  // Yaw-Pitch-Roll
            this.camera.quaternion.setFromEuler(euler);  // Apply rotation to the camera

            // Update last touch positions
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        })



        window.addEventListener('cancel', (event) => {
            alert(`${event.touches[0].clientX}, ${event.touches[0].clientY}`)
             if (event.touches[0].clientX > window.innerWidth - 100 &&
                event.touches[0].clientY > window.innerHeight - 100) {
                alert('this.shouldMoveForward = false')
                this.shouldMoveForward = false
            }
            
            lastTouchX = null;
            lastTouchY = null;
        });

    }

    handleMovement() {
        this.intersections = []
        const now = new Date().getTime();

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
            var combinedMovement = new THREE.Vector3();  // To store the final movement result

            if (this.w && !this._w) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Ignore vertical movement
                direction.normalize();  // Ensure consistent vector length
                forwardMovement.add(direction.multiplyScalar(this.wS + (this.run ? 0.23 : 0)));  // Move forward by this.wS
            }

            if (this.s && !this._s) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;
                direction.normalize();  // Normalize for consistent movement
                forwardMovement.sub(direction.multiplyScalar(this.sS + (this.run ? 0.23 : 0)));  // Move backward by this.sS
            }

            if ((this.a && !this._a)) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Keep movement in the horizontal plane
                right.crossVectors(this.camera.up, direction).normalize();  // Calculate the right vector
                rightMovement.add(right.multiplyScalar(this.aS + (this.run ? 0.23 : 0)));  // Move right
            } 

            if ((this.d && !this._d)) {
                this.camera.getWorldDirection(direction);
                direction.y = 0;  // Keep movement in the horizontal plane
                right.crossVectors(this.camera.up, direction).normalize();  // Calculate the right vector
                rightMovement.sub(right.multiplyScalar(this.dS + (this.run ? 0.23 : 0))); 
            }


            combinedMovement.add(forwardMovement).add(rightMovement);
            this.camera.position.add(combinedMovement);


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

        this.handleCollision()


        // Apply movement after collision handling
        this.camera.position.add(combinedMovement);
    }
        
    handleCollision() {
        const cameraBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position.clone(),
            new THREE.Vector3(.5, 1.2, .2)  // Adjust based on camera size
        );

        const directions = [
            new THREE.Vector3(0, -1, 0),   // Down
            new THREE.Vector3(0, 1, 0),    // Up
            new THREE.Vector3(1, 0, 0),    // Right
            new THREE.Vector3(-1, 0, 0),   // Left
            new THREE.Vector3(0, 0, 1),    // Forward
            new THREE.Vector3(0, 0, -1),   // Backward
        ];


        for (const direction of directions) {
            var dir = direction

            const ray = new THREE.Ray(this.camera.position.clone(), direction.clone().normalize());

            let closestIntersection = null;
            let minDistance = .5;
            let intersectionNormal = null;

            terrain.cliffs.forEach(cliff => {

                const a = cliff.triangle.a;
                const b = cliff.triangle.b;
                const c = cliff.triangle.c;

                const intersectionPoint = new THREE.Vector3();

                const intersects = ray.intersectTriangle(a, b, c, false, intersectionPoint);

                if (intersects) {
                    const distance = this.camera.position.distanceTo(intersectionPoint);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIntersection = { normal: cliff.triangle.normal, point: intersects }
                    }
                }
            });

            if (closestIntersection) {
                const cameraToIntersection = new THREE.Vector3().subVectors(closestIntersection.point, this.camera.position);
                const dotProduct = cameraToIntersection.dot(closestIntersection.normal);
                const offset = user.wS * 2;  // Adjust based on your needs

                const normalOffset = closestIntersection.normal.clone().multiplyScalar(offset);

                if (this.floor !== null && normalOffset.y !== 0) normalOffset.y = 0

                this.camera.position.add(normalOffset);

                this.camera.velocity.y = 0;
                this.isJumping = false;

                break;
            }

            const raycaster = new THREE.Raycaster(this.camera.position, dir.normalize());

            const intersectsTrees = raycaster.intersectObjects(this.terrain.trees.flatMap(tree => [tree.trunk, tree.foliage]), true);
            if (intersectsTrees.length > 0 && intersectsTrees[0].distance < 1) {
                console.log("intersecting a tree")
                const responseDirection = this.camera.position.clone().sub(intersectsTrees[0].point).normalize();
                this.camera.position.add(responseDirection.multiplyScalar(1));

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
                    this.camera.position.add(responseDirection.multiplyScalar(1));
                }
            }


            if (this.isJumping) {
                var closestGround = undefined
            }
        }
    }

    getClosestPointOnBox(box, point) {
        const clampedX = Math.max(box.min.x, Math.min(point.x, box.max.x));
        const clampedY = Math.max(box.min.y, Math.min(point.y, box.max.y));
        const clampedZ = Math.max(box.min.z, Math.min(point.z, box.max.z));

        return new THREE.Vector3(clampedX, clampedY, clampedZ);
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
        if (isVerticalIntersection(intersection.face.normal)) {
            this.camera.velocity.y = 0;
            this.camera.position.y = intersection.point.y + 1;  // Adjust height for foundation

            // Optionally, you can "stop" here or adjust new terrain logic
            // this.terrain.createNewTerrain(); // Create new terrain logic, if necessary
        } else {
            // Horizontal collision with walls, push the player away
            this.camera.position.add(responseDirection.multiplyScalar(responseForce));
        }
    }

    handleJumping() {
        // Update camera position based on the jump velocity
        this.camera.position.y += this.jumpVelocity;
        this.jumpVelocity += GRAVITY * 0.7; // Simulate gravity by decreasing velocity

        // Cast a ray from the camera downwards to detect the ground
        const downRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        const downIntersection = this.findClosestIntersection(downRaycaster);

        // Cast a ray upwards to detect ceilings
        const upRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, 1, 0));
        const upIntersection = this.findClosestIntersection(upRaycaster);

        // Ground collision detection
        if (downIntersection && downIntersection.distance < 1) {
            this.intersections.push(downIntersection.object)
            // console.log("Camera is above the ground, landing");

            // Adjust the camera position to the surface plus a small offset to simulate landing
            this.camera.position.y = downIntersection.point.y + .6;
            this.floor = this.camera.position.y ;
            this.camera.velocity.y = 0;
            this.isJumping = false;
        } else {
            this.floor = null
        }

        // Ceiling collision detection
        if (upIntersection && upIntersection.distance < .5) {
            this.intersections.push(upIntersection.object)
            // console.log("Camera hit the ceiling");

            // Prevent the camera from going through the ceiling
            this.camera.position.y = upIntersection.point.y - .5; // Adjust based on how close you want to stop
            this.camera.velocity.y = 0;
            this.isJumping = false;

            // Optional: handle additional ceiling collision logic here
        }

        // If neither intersection is detected, continue falling
        if (!downIntersection && !upIntersection) {
            // console.log("No intersection detected, camera still in the air");
        }
    }



    applyGravity() {
        if (this.camera.velocity.y < TERMINAL_VELOCITY) {
            this.camera.velocity.y = TERMINAL_VELOCITY;
        } else {
            this.camera.velocity.y += GRAVITY; 
        }
        this.camera.position.y += this.camera.velocity.y;

        const raycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, -1, 0));
        const intersection = this.findClosestIntersection(raycaster);

        if (intersection && intersection.distance < 1) {
            this.intersections.push(intersection)

            var newY = intersection.point.y + 1

            this.camera.position.y = newY;
            this.floor = intersection.point.y + 1

            this.camera.velocity.y = 0;
            this.isJumping = false;

        } else {
            this.floor = null
        }
        
        // Cast a ray upwards to detect ceilings
        const upRaycaster = new THREE.Raycaster(this.camera.position, new THREE.Vector3(0, 1, 0));
        const upIntersection = this.findClosestIntersection(upRaycaster);


        // Ceiling collision detection
        if (upIntersection && upIntersection.distance < .5) {
            // console.log("Camera hit the ceiling");

            // Prevent the camera from going through the ceiling
            this.camera.position.y = upIntersection.point.y - .5; // Adjust based on how close you want to stop
            this.camera.velocity.y = 0;
            this.isJumping = false;

            // Optional: handle additional ceiling collision logic here
        }
    }

    // Helper function to find the closest intersection with terrain
    findClosestIntersection(raycaster) {
        let closestIntersection = null;
        let minDistance = 1;

        for (let m of scene.children) {
            var mesh = m.mesh ? m.mesh : m
            const intersects = raycaster.intersectObject(mesh, true);
            if (intersects.length > 0 && intersects[0].distance < minDistance) {
                closestIntersection = intersects[0];
                minDistance = intersects[0].distance;
            }
        }

        return closestIntersection;
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

    init(model) {
        for (var key in model) {
            this[key] = model[key]
        }

        document.body.appendChild(window.renderer.domElement);


        window.terrain = new Terrain(VM);


        window.user = new UserController(terrain);


        window.sky = new Sky(window.user);

        var castleBaseCenter = new THREE.Vector3(0, 0, 0)

        window.castle = new Castle(castleBaseCenter);

        
        this.addUser();


        window.editor = new ObjectEdit()

        Animate();


    }



    addUser() {
        // Create a wireframe box to visualize the bounding box
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1); // Adjust dimensions as needed
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Wireframe color (green, adjust as needed)
            wireframe: true
        });
        window.wireframeBox = new THREE.Mesh(boxGeometry, wireframeMaterial);


        // Add the wireframe to the scene
        window.scene.add(wireframeBox);

        var userPosition = user.camera.position
        var userRotation = {
            x: user.camera.rotation._x,
            y: user.camera.rotation._y,
            z: user.camera.rotation._z
        }

        if (localStorage.position) {
            userPosition = JSON.parse(localStorage.position)
        }

        if (localStorage.rotation) {
            userRotation = JSON.parse(localStorage.rotation)
        }

        user.camera.position.set(userPosition.x, userPosition.y, userPosition.z)
        user.camera.rotation.set(userRotation.x, userRotation.y, userRotation.z)
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





window.VM = new ViewModel();
window.view = new View();




await VM.init("Peter", view);






window.Animate = function() {
        window.requestAnimationFrame(Animate);

        window.sky.update()
        window.terrain.updateTerrain()
        window.user.handleMovement()
        UndulateWater()
        window.castle.update()
       
        if (user.shouldMoveForward) {
            user.moveForward()
        }

        window.renderer.render(window.scene, window.user.camera);
}


