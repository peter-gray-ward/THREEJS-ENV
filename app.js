import * as THREE from '/three';

var scene = new THREE.Scene();
var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
scene.add(origin);

var camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.75) / window.innerHeight, 0.1, 100000);
scene.add(camera);
camera.floor = 0;
camera.touchingFloor = true;
camera.floorDiff = 0;
camera.position.set(3, 0.5, 3);
camera.up = new THREE.Vector3(0, 1, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var priorPosition = camera.position.clone();

var display = {
	devGridDots: true,
	userBoxFrame: false,
	camera: {
		boxType: 'person'
	}
}
var far = 10000;

const distanceToSunInInches = 588768000000;

/**
 * Calculates a vertex position at a specified range (distance) from a given center point.
 * 
 * @param {number} range - The distance from the center point to the new vertex.
 * @param {number} x - The x-coordinate of the original point.
 * @param {number} y - The y-coordinate of the original point.
 * @param {number} z - The z-coordinate of the original point.
 * @param {THREE.Vector3} center - The center point from which the distance is measured.
 * @returns {THREE.Vector3} The new vertex position.
 */

function vertexFromPointAtRangeFromCenterAtDistance(range, x, y, z, center) {
   const point = new Vector3(x, y, z);
   const direction = new Vector3().subVectors(point, center).normalize();
   const alteredPosition = new Vector3().addVectors(center, direction.multiplyScalar(range));
   return alteredPosition;
}

const prefixes = ['Al', 'Bran', 'Cer', 'Dra', 'El', 'Fen', 'Gor', 'Hyl', 'Ira', 'Jen'];
const suffixes = ['dor', 'wen', 'mar', 'ral', 'tan', 'vin', 'lor', 'mus', 'rid', 'sor'];

function generateName() {
   const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
   const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
   return prefix + suffix;
}

function secondFlooredDivisibleBy(date, factor) {
   const seconds = date.getSeconds();
   return seconds % factor === 0;
};


function randomInRange(from, to, startDistance = 0) {
   const min = Math.min(from, to) + startDistance;
   const max = Math.max(from, to) + startDistance;
   const val = Math.random() * (max - min) + min;
   return val;
}

function randomInRange2(min, max) {
   return Math.random() * (max - min) + min;
 }
 
 // Function to generate a random position within a sphere
function randomPositionInSphere(radius) {
   let u = Math.random();
   let v = Math.random();
   let theta = 2 * Math.PI * u;
   let phi = Math.acos(2 * v - 1);
   let r = Math.cbrt(Math.random()) * radius;
   let x = r * Math.sin(phi) * Math.cos(theta);
   let y = r * Math.sin(phi) * Math.sin(theta);
   let z = r * Math.cos(phi);
   return new Vector3(x, y, z);
 }


function randomColorInRange(fromColor, toColor) {
 const color1 = new Color(fromColor);
 const color2 = new Color(toColor);
 const factor = Math.random();
 const interpolatedColor = color1.clone().lerp(color2, factor);
 return interpolatedColor;
}


function width3rd() {
 return window.innerWidth * 0.3333333;
}

function height3rd() {
 return window.innerHeight * 0.333333;
}

function isStar(name) {
   const starRegex = /^Star/;
   return starRegex.test(name);
}


function sortScene(scene, user) {
   scene.children.sort((a, b) => user.position.distanceTo(a.position) - user.position.distanceTo(b.position));
}

function getStatus(meshName) {
   return meshName.split('::')[1];
}

function nameBase(meshName) {
   return meshName.split("::")[0];
}

function isActive(mesh) {
   return /::active/.test(mesh.name);
}

function get2DPosition(star, user, id) {
   const __vector__ = star.position.clone().project(user);
   const vector = new Vector2(__vector__.x, __vector__.y);

   // Center the coordinates within the div
   const div = document.querySelector(id);

   if (div && div instanceof HTMLElement) {
      const css = getComputedStyle(div);
      const width = +css.width.replace('px', '');
      const height = +css.height.replace('px', '');
      const divCenterX = width / 2;
      const divCenterY = height / 2;

      // Convert normalized device coordinates to screen coordinates
      const xNDC = vector.x; // Normalized device coordinate x
      const yNDC = vector.y; // Normalized device coordinate y

      // Map NDC (-1 to 1) to range (0 to div width and height)
      const x = (xNDC * divCenterX) + divCenterX;
      const y = -(yNDC * divCenterY) + divCenterY; // Invert y-axis

      return {
         x,
         y
      };
   } else {
      return {
         x: 0,
         y: 0
      };
   }
}


// Assuming `this` is the camera
function getOffsetVector(user, forwardAmount, upAmount, rightAmount) {
   // Get the camera's direction vectors
   const forward = new Vector3();
   user.getWorldDirection(forward);

   const up = user.up.clone().normalize();

   const right = new Vector3();
   right.crossVectors(up, forward).normalize();

   // Create the offset vector in the local coordinate system
   const offset = new Vector3()
       .addScaledVector(forward, forwardAmount)
       .addScaledVector(up, upAmount)
       .addScaledVector(right, rightAmount);

   // Get the new position by adding the offset to the camera's current position
   const newPosition = user.position.clone().add(offset);

   return newPosition;
}





function Candy(mesh) {
   var i = 0;
   
   const { array, itemSize } = mesh.geometry.attributes['position'];
   for (var j = 0; j < array.length; j += 3) {
      array[j] += randomInRange(0.3, 1.5);
      array[j + 1] += randomInRange(0.3, 1.5);
      array[j + 2] += randomInRange(0.3, 1.5);
   }

   mesh.geometry.attributes['position'].needsUpdate = true;
   mesh.geometry.computeBoundingSphere()
   return mesh;
}



function getCurrentTime() {
    // Parameters for the Earth's orbit and rotation
    const semiMajorAxis = 1000; // Distance from the Sun in inches
    const orbitalPeriod = 3600; // Orbit period in seconds (1 hour)
    const rotationPeriod = 3600; // Rotation period in seconds (1 hour)

    // Current time in seconds
    const time = performance.now() / 1000; 

    // Calculate the angle in the orbit (in radians)
    const orbitAngle = (time / orbitalPeriod) * 2 * Math.PI;

    // Calculate days out of 365
    const daysOutOf365 = Math.floor((orbitAngle / (2 * Math.PI)) * 365);

    // Calculate the angle for the Earth's rotation (in radians)
    const rotationAngle = (time / rotationPeriod) * 2 * Math.PI;

    // Calculate hours and minutes
    const totalMinutes = (rotationAngle / (2 * Math.PI)) * 144000; // 1440 minutes in a day
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    return { daysOutOf365, hours, minutes };
}




var axisLength = 100;
const P = 100
var actives = [];
const N = 3;

// Function to calculate the normal of a triangle
function calculateNormal(a, b, c) {
    const edge1 = new THREE.Vector3().subVectors(b, a);
    const edge2 = new THREE.Vector3().subVectors(c, a);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    return normal;
}

HTMLElement.prototype.css = function(obj) {
	for (var key in obj) {
		this.style[key] = obj[key];
	}
}

// Helper function to create a dotted axis line
function createDottedAxis(color, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: .1, // size of the dashes
        gapSize: 0.05, // size of the gaps
        linewidth: 1
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances(); // This is necessary for the dashed effect
    scene.add(line);
}

function calculatePlane(triangle) {
    const edge1 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    const edge2 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    const d = -normal.dot(triangle.a);
    return { normal, d };
}

function intersectLinePlane(p0, p1, plane) {
    const lineDir = new THREE.Vector3().subVectors(p1, p0);
    const t = -(plane.normal.dot(p0) + plane.d) / plane.normal.dot(lineDir);

    if (t >= 0 && t <= 1) {
        const intersection = new THREE.Vector3().addVectors(p0, lineDir.multiplyScalar(t));
        return intersection;
    }
    return null;
}

function isPointInBoundingBox(point, min, max) {
    return point.x >= min.x && point.x <= max.x &&
           point.y >= min.y && point.y <= max.y &&
           point.z >= min.z && point.z <= max.z;
}

function isPointInTriangle(point, triangle) {
    const v0 = new THREE.Vector3().subVectors(triangle.c, triangle.a);
    const v1 = new THREE.Vector3().subVectors(triangle.b, triangle.a);
    const v2 = new THREE.Vector3().subVectors(point, triangle.a);

    const dot00 = v0.dot(v0);
    const dot01 = v0.dot(v1);
    const dot02 = v0.dot(v2);
    const dot11 = v1.dot(v1);
    const dot12 = v1.dot(v2);

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v <= 1);
}

function getBoxEdges(min, max) {
    const vertices = [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z)
    ];

    return [
        [vertices[0], vertices[1]], [vertices[0], vertices[2]], [vertices[0], vertices[4]],
        [vertices[1], vertices[3]], [vertices[1], vertices[5]],
        [vertices[2], vertices[3]], [vertices[2], vertices[6]],
        [vertices[3], vertices[7]],
        [vertices[4], vertices[5]], [vertices[4], vertices[6]],
        [vertices[5], vertices[7]],
        [vertices[6], vertices[7]]
    ];
}

function getIntersectionPoint(cameraBoundingBox, triangle) {
    const { min: cameraMin, max: cameraMax } = cameraBoundingBox;

    const v0 = triangle.a;
    const v1 = triangle.b;
    const v2 = triangle.c;

    const axes = [
        1, 0, 0,  // X-axis
        0, 1, 0,  // Y-axis
        0, 0, 1   // Z-axis
    ];

    const extents = new THREE.Vector3(
        (cameraMax.x - cameraMin.x) / 2,
        (cameraMax.y - cameraMin.y) / 2,
        (cameraMax.z - cameraMin.z) / 2
    );

    const center = new THREE.Vector3(
        (cameraMax.x + cameraMin.x) / 2,
        (cameraMax.y + cameraMin.y) / 2,
        (cameraMax.z + cameraMin.z) / 2
    );

    const v0c = new THREE.Vector3().subVectors(v0, center);
    const v1c = new THREE.Vector3().subVectors(v1, center);
    const v2c = new THREE.Vector3().subVectors(v2, center);

    if (!satForAxes(axes, v0c, v1c, v2c, extents)) {
        return null;
    }

    // Find intersection points on the bounding box edges with the triangle plane
    const plane = calculatePlane(triangle);
    const boxEdges = getBoxEdges(cameraMin, cameraMax);

    let intersectionPoints = [];
    for (const edge of boxEdges) {
        const intersection = intersectLinePlane(edge[0], edge[1], plane);
        if (intersection && isPointInBoundingBox(intersection, cameraMin, cameraMax) && isPointInTriangle(intersection, triangle)) {
            intersectionPoints.push(intersection);
        }
    }

    if (intersectionPoints.length === 0) {
        return null;
    }

    // Calculate the center of the line of intersection
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const point of intersectionPoints) {
        sumX += point.x;
        sumY += point.y;
        sumZ += point.z;
    }

    const centerPoint = new THREE.Vector3(sumX / intersectionPoints.length, sumY / intersectionPoints.length, sumZ / intersectionPoints.length);
    return centerPoint;
}

function satForAxes(axes, v0, v1, v2, extents) {
    const _testAxis = new THREE.Vector3();

    for (let i = 0, j = axes.length - 3; i <= j; i += 3) {
        _testAxis.fromArray(axes, i);
        const r = extents.x * Math.abs(_testAxis.x) + extents.y * Math.abs(_testAxis.y) + extents.z * Math.abs(_testAxis.z);
        const p0 = v0.dot(_testAxis);
        const p1 = v1.dot(_testAxis);
        const p2 = v2.dot(_testAxis);
        if (Math.max(-Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) {
            return false;
        }
    }

    return true;
}


// Create dotted axes with different colors
createDottedAxis('red', new THREE.Vector3(0, 0, 0), new THREE.Vector3(axisLength, 0, 0)); // X-axis
createDottedAxis('yellow', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axisLength, 0)); // Y-axis
createDottedAxis('green', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axisLength)); // Z-axis


var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.75, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "view";
document.body.appendChild(renderer.domElement);

var al = new THREE.AmbientLight(0xffffce, .03);
al.position.set(0, 0, 0);
scene.add(al);
var imageModal = document.createElement('div');

function xhr(options = { body: {} }) {
	var x = new XMLHttpRequest();
	x.open(options.method, options.url);
	x.addEventListener('load', options.load);
	x.send(JSON.stringify(options.body));
}


function getChildIndex(child) {
    const parent = child.parentNode;
    const childrenArray = Array.from(parent.children);
    return childrenArray.indexOf(child);
}


function round(n, k) {
	let ok = k * 10;
	return Math.round(n * ok) / ok;
}

class User {
	name = "Peter";
	space = "Playground";
	touchedObjects = [];
	onFloor = true
	addTouchedObject(to) {
		var exists = false
		for (var i = 0; i < this.touchedObjects.length; i++) {
			if (this.touchedObjects[i].name == to.name) {
				exists = true;
				for (var key in to) {
					this.touchedObjects[i][key] = to[key];
				}
				break;
			}
		}
		if (!exists) {
			this.touchedObjects.push(to);
		}
	}
	removeTouchedObject(pto) {
		for (var i = 0; i < this.touchedObjects.length; i++) {
			if (this.touchedObjects[i].name == pto.name) {
				this.touchedObjects.splice(i, 1);
				return;
			}
		}
	}
}


let user = new User();

function BoxHelper(object, boxSize = new THREE.Vector3()) {
	var cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(object.position.clone(), boxSize);

	// Apply rotation to the bounding box
	const matrix = new THREE.Matrix4().makeRotationFromQuaternion(object.quaternion);
	const vertices = [
	    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	    new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	];

	vertices.forEach(v => v.applyMatrix4(matrix).add(object.position.clone()));

	const rotatedBoundingBox = new THREE.Box3().setFromPoints(vertices);
	// Optionally visualize the bounding box for debugging
	const boxHelper = new THREE.Box3Helper(rotatedBoundingBox, 0xffff00);

	return boxHelper;
}

class Level {
	PhysicalObjects = {}
	sun = undefined;
	floorGroup = new THREE.Group();
}

let level = new Level();

class Page {
	width = window.innerWidth * 0.75;
	height = window.innerHeight;
}

let page = new Page();
function convertPlaneToTriangles(geometry) {
    const triangles = [];
    const positionAttribute = geometry.attributes.position;
    const indexAttribute = geometry.index;

    for (let i = 0; i < indexAttribute.count; i += 3) {
        const a = indexAttribute.getX(i);
        const b = indexAttribute.getX(i + 1);
        const c = indexAttribute.getX(i + 2);

        const vertexA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
        const vertexB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
        const vertexC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

        triangles.push([vertexA, vertexB, vertexC]);
    }

    return triangles;
}


class Creator {
	addChild = false;
	activePolygonVerticesIndex = -1;
	polygonVertices = [];
	ConnectTheDotsWithPolygons() {

		/**
		 * 
		  	Vertices: Collect vertex positions and store them in a Float32Array.
			Indices: Define the order in which vertices form triangles.
			Normals: Calculate normals for proper shading.
			Material: Create a material for the mesh.
			Mesh: Create the mesh with the geometry and material, and add it to the scene.
		*
		*/
	    const geometry = new THREE.BufferGeometry();

	    // Create an array for the vertices
	    const vertices = [];

	    // Add vertices to the array
	    this.polygonVertices[this.activePolygonVerticesIndex].forEach(p => {
			add2DText(
				scene, 
				`(${p.x}, ${p.y}, ${p.z})`, 
				0.5, 
				'white', 
				{ x: p.x, y: p.y, z: p.z }, 
				true,
				'transparent'
			);
	        vertices.push(p.x, p.y, p.z);
	    });

	    // Convert the vertices array to a Float32Array
	    const verticesArray = new Float32Array(vertices);

	    // Set the vertices to the BufferGeometry
	    geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));

	    // Create an array for the indices
	    const indices = [];

	    // Define faces from the vertices (triangulate the this.polygonVertices)
	    // Here we'll assume the this.polygonVertices are ordered and form a convex polygon
	    for (let i = 1; i < this.polygonVertices[this.activePolygonVerticesIndex].length - 1; i++) {
	        if (true || Math.random() < 0.5) {
	        	indices.push(i - 1, i, i + 1);
	        } else {
	        	indices.push(0, i, i + 1);
	        }
	    }

	    console.log(indices);

	    // Set the indices to the BufferGeometry
	    geometry.setIndex(indices);

	    // Compute normals for shading
	    geometry.computeVertexNormals();

	    // Create a material for the mesh
	    const material = new THREE.MeshStandardMaterial({ 
	    	color: new THREE.Color(Math.random(), Math.random(), Math.random()), 
	    	side: THREE.DoubleSide 
	    });

	    // Create the mesh
	    const mesh = new THREE.Mesh(geometry, material);
	    

	    mesh.receiveShadow = true;
	    mesh.castShadow = true;
	    mesh.name = "touchable::polygon::" + JSON.stringify(vertices);

	    const triangles = [];
		const positions = geometry.attributes.position.array;

		for (let i = 0; i < indices.length; i += 3) {
		    const vertex1 = new THREE.Vector3(
		        positions[indices[i] * 3],
		        positions[indices[i] * 3 + 1],
		        positions[indices[i] * 3 + 2]
		    );
		    const vertex2 = new THREE.Vector3(
		        positions[indices[i + 1] * 3],
		        positions[indices[i + 1] * 3 + 1],
		        positions[indices[i + 1] * 3 + 2]
		    );
		    const vertex3 = new THREE.Vector3(
		        positions[indices[i + 2] * 3],
		        positions[indices[i + 2] * 3 + 1],
		        positions[indices[i + 2] * 3 + 2]
		    );

		    // triangles.push({ a: vertex1, b: vertex2, c: vertex3 });

	        const vertices = new Float32Array([
		        vertex1.x, vertex1.y, vertex1.z,
		        vertex2.x, vertex2.y, vertex2.z,
		        vertex3.x, vertex3.y, vertex3.z
		    ]);

		    const triangleGeometry = new THREE.BufferGeometry();
		    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
			triangleGeometry.computeVertexNormals();
		    var triangleMaterial = new THREE.MeshStandardMaterial({ 
		    	color: new THREE.Color(Math.random(),Math.random(),Math.random()),
		    	side: THREE.DoubleSide
		    });
		    var triangleMesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
		    triangleMesh.castShadow = true;
	    	triangleMesh.receiveShadow = true;
	    	triangleMesh.triangle = new THREE.Triangle(
	    		new THREE.Vector3(vertex1.x, vertex1.y, vertex1.z),
	    		new THREE.Vector3(vertex2.x, vertex2.y, vertex2.z),
	    		new THREE.Vector3(vertex3.x, vertex3.y, vertex3.z)
	    	);
	    	triangleMesh.triangle.normal = calculateNormal(triangleMesh.triangle.a, triangleMesh.triangle.b, triangleMesh.triangle.c)
	    	triangleMesh.name = "touchable::triangle";
		    scene.add(triangleMesh);

		}

		// mesh.triangles = triangles;

		console.log(triangles)

		const itemBoundingBox = new THREE.Box3().setFromObject(mesh);
		const boxHelper = new THREE.BoxHelper(mesh, 0xff0000);
		scene.add(boxHelper);

		// scene.add(mesh);
	}

	MakeFlatFloor() {}
	AddDoor() {}
	AddWall() {}
	AddWindow() {}
	AddCeiling() {}
	AddStairs() {}

	MakeFlatishGround() {
	    if (this.polygonVertices[this.activePolygonVerticesIndex].length == 4) {
	        var v0 = this.polygonVertices[this.activePolygonVerticesIndex][0];
	        var v1 = this.polygonVertices[this.activePolygonVerticesIndex][1];
	        var v2 = this.polygonVertices[this.activePolygonVerticesIndex][2];
	        var v3 = this.polygonVertices[this.activePolygonVerticesIndex][3];

	        var segments = Math.floor(randomInRange(10, 20)); // Number of segments along each axis
	        var terrain = {};

	        var vertices = [];
	        var indices = [];

	        function randomInRange(min, max) {
	            return Math.random() * (max - min) + min;
	        }

	        // Create vertices with random vertical adjustments
	        for (let i = 0; i <= segments; i++) {
	            for (let j = 0; j <= segments; j++) {
	                let x = (1 - i / segments) * ((1 - j / segments) * v0.x + (j / segments) * v3.x) + 
	                        (i / segments) * ((1 - j / segments) * v1.x + (j / segments) * v2.x);
	                let z = (1 - i / segments) * ((1 - j / segments) * v0.z + (j / segments) * v3.z) + 
	                        (i / segments) * ((1 - j / segments) * v1.z + (j / segments) * v2.z);
	                let y = (1 - i / segments) * ((1 - j / segments) * v0.y + (j / segments) * v3.y) + 
	                        (i / segments) * ((1 - j / segments) * v1.y + (j / segments) * v2.y);
	                y += randomInRange(randomInRange(-0.05, -0.01), randomInRange(0.01, 0.09)); // Random vertical adjustment
	                vertices.push(x, y, z);
	                terrain[round(x, 2) + '_' + round(z, 2)] = y;
	            }
	        }

	        // Create indices for the plane
	        for (let i = 0; i < segments; i++) {
	            for (let j = 0; j < segments; j++) {
	                let a = i * (segments + 1) + j;
	                let b = i * (segments + 1) + (j + 1);
	                let c = (i + 1) * (segments + 1) + (j + 1);
	                let d = (i + 1) * (segments + 1) + j;

	                // Two triangles per segment
	                indices.push(a, b, d);
	                indices.push(b, c, d);
	            }
	        }

	        var planeGeometry = new THREE.BufferGeometry();
	        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	        planeGeometry.setIndex(indices);
	        planeGeometry.computeVertexNormals();
	        planeGeometry.computeBoundingBox();

	        planeGeometry.boundingBox.min.y -= 0.5;
	        planeGeometry.boundingBox.max.y += 0.5;


	        var material = new THREE.MeshStandardMaterial({ 
	        	// color: new THREE.Color(Math.random(), Math.random(), Math.random()),
	        	color: 0xffffff,
	        	wireframe: true, 
	        	side: THREE.DoubleSide 
	        });
	        var mesh = new THREE.Mesh(planeGeometry, material);
	        mesh.name = "touchable::plane";
	        mesh.terrain = terrain;

	        scene.add(mesh);
	    }
	}


	selectPointGroup(event) {
		var src = event.srcElement;
		var activeIndex = this.activePolygonVerticesIndex;

		if (src.parentElement.classList.contains('active')) {
			src.parentElement.classList.remove('active');
			src.id = '';
			this.activePolygonVerticesIndex = null;

			console.log('deactivating point group');
		} else {
			src.parentElement.classList.add('active')
			src.id = 'selected-point-group';
			this.activePolygonVerticesIndex = +src.dataset.id;
			activeIndex = this.activePolygonVerticesIndex

			console.log('activating point group');
		}


		for (var i = 0; i < scene.children.length; i++) {
			if (/^devdot/.test(scene.children[i].name)) {
				for (var j = 0; j < this.polygonVertices[activeIndex].length; j++) {
					const a = this.polygonVertices[activeIndex][j].x == scene.children[i].position.x 
					const b = this.polygonVertices[activeIndex][j].y == scene.children[i].position.y 
					const c = this.polygonVertices[activeIndex][j].z == scene.children[i].position.z
					if (a && b && c) {
						if (this.activePolygonVerticesIndex !== null) {
							scene.children[i].material.color.set('red');
						} else {
							scene.children[i].material.color.set('white');
						}
					}
				}
			}
		}
	} //askdhifaskldhjfs

	update() {
		for (var i = 0; i < this.polygonVertices.length; i++) {
			document.querySelectorAll('.point-group').forEach((pre, i) => {
				pre.innerHTML = JSON.stringify(this.polygonVertices[i], null, 2);
			});
		}



		document.getElementById('touched-objects').innerHTML = user.touchedObjects.map(to => `<div class="row">
			<div>${to.name}</div>
			<div>${JSON.stringify(to.center, null, 1)}</div>
			<div>${to.cameraFaceTouched}</div>
		</div>`).join('')
		
		document.getElementById('intersection-points').innerHTML = `
<span>floor: ${camera.floor}</span> <br />
<pre>
x: ${camera.position.x}
y: ${camera.position.y}
z: ${camera.position.z}
</pre>
		`
		// xhr({
		// 	method: 'POST',
		// 	url: `/items?user=${user.name}&space=${user.space}`,
		// 	body: this.polygonVertices
		// });


	}
}




class Controller {
    w = false;
    a = false;
    s = false;
    d = false;
    wS = 0.02;
    aS = 0.02;
    sS = 0.02;
    dS = 0.02;
    space = false;
    ArrowUp = false;
    ArrowRight = false;
    ArrowDown = false;
    ArrowLeft = false;
    isJumping = false;
    velocity = new THREE.Vector3();
    gravity = -0.009;
    jumpStrength = .1;
    mouse = {
    	x: 0,
    	y: 0
    }
    raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	hoverPlane = null;
	page = 'generate-polygon';
	tabs = ['create-outside', 'generate-polygon', 'apply-images', 'manage-spaces'];
	creator = new Creator();

    constructor() {}

    Self() {
        window.addEventListener('keydown', this.listen.bind(this));
        window.addEventListener('keyup', this.unlisten.bind(this));
        window.addEventListener('click', this.click.bind(this))
    }

    calculateTrajectory(prior, current) {
	    const dx = current.x - prior.x;
	    const dy = current.y - prior.y;

	    let direction = '';

	    if (dy > 0) {
	        direction += 'w';
	    } else if (dy < 0) {
	        direction += 's';
	    }

	    if (dx > 0) {
	        direction += 'd';
	    } else if (dx < 0) {
	        direction += 'a';
	    }

	    return direction || 'idle';
	}

    click(e) {
    	if (this.creator.activePolygonVerticesIndex == -1) return;

    	this.mouse.x = (e.clientX / page.width) * 2 - 1;
		this.mouse.y = - (e.clientY / page.height) * 2 + 1;
		this.raycaster.setFromCamera(this.mouse, camera);

		const intersects = this.raycaster.intersectObjects(scene.children, true);

		
		if (intersects.length > 0) {

			var i = 0;
			var target = intersects[i++];
			while (target && target.object && !target.object.isMesh) target = intersects[i++];

			if (target) {
				target = target.object;
				if (/^devdot/.test(target.name)) {
					if (target.material.color.g == 0) {
						
					} else {
						target.material.color.set('red');
						
					}

					this.creator.polygonVertices[this.creator.activePolygonVerticesIndex].push({ 
						x: target.position.x, 
						y: target.position.y, 
						z: target.position.z 
					});
				} else {
					imageModal.innerHTML = '';
					imageModal.css({
						position: 'absolute',
						top: e.clientY + 'px',
						left: e.clientX + 'px',
						width: '30vw',
						height: '55vh',
						padding: '0.1rem',
						backgroundColor: 'white'
					});
					document.body.appendChild(imageModal);
					loadTags(imageModal)
				}
				
				this.creator.update();
			}

		}
    }

    listen(e) {
        if (e.key == 'w') {
            this.w = true;
        } else if (e.key == 'a') {
            this.a = true;
        } else if (e.key == 's') {
            this.s = true;
        } else if (e.key == 'd') {
            this.d = true;
        } else if (e.key == ' ') {
            this.space = true;
        } else if (e.key == 'ArrowUp') {
            this.ArrowUp = true;
        } else if (e.key == 'ArrowDown') {
            this.ArrowDown = true;
        } else if (e.key == 'ArrowLeft') {
            this.ArrowLeft = true;
        } else if (e.key == 'ArrowRight') {
            this.ArrowRight = true;
        } else if (e.key == 't') {
        	display.devGridDots = !display.devGridDots;
        	DevGrid(N, display.devGridDots);
        } else if (e.key == 'y') {
        	display.userBoxFrame = !display.userBoxFrame;
        	//DevGrid(N, display.userBoxFrame);
        }
    }

    unlisten(e) {
        if (e.key == 'w') {
            this.w = false;
        } else if (e.key == 'a') {
            this.a = false;
        } else if (e.key == 's') {
            this.s = false;
        } else if (e.key == 'd') {
            this.d = false;
        } else if (e.key == ' ') {
            this.space = false;
        } else if (e.key == 'ArrowUp') {
            this.ArrowUp = false;
        } else if (e.key == 'ArrowDown') {
            this.ArrowDown = false;
        } else if (e.key == 'ArrowLeft') {
            this.ArrowLeft = false;
        } else if (e.key == 'ArrowRight') {
            this.ArrowRight = false;
        }
    }

    activate() {
    	var active = false;
    	priorPosition = camera.position;
        if (this.w) {
            var direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.multiplyScalar(this.wS);
            camera.position.add(direction);
        	active = true;
        }
        if (this.a) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            camera.getWorldDirection(direction);
            right.crossVectors(camera.up, direction).normalize();
            right.multiplyScalar(this.aS);
            camera.position.add(right);
        	active = true;
        }
        if (this.s) {
            var direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.multiplyScalar(-this.sS);
            camera.position.add(direction);
        	active = true;
        }
        if (this.d) {
            var direction = new THREE.Vector3();
            var right = new THREE.Vector3();
            camera.getWorldDirection(direction);
            right.crossVectors(camera.up, direction).normalize();
            right.multiplyScalar(-this.dS);
            camera.position.add(right);
        	active = true;
        }
        if (this.ArrowUp) {
            camera.rotateX(0.1);
        	active = true;
        }
        if (this.ArrowDown) {
            camera.rotateX(-0.1);
        	active = true;
        }
        if (this.ArrowLeft || this.ArrowRight) {
            let quaternionY = new THREE.Quaternion();
	        let quaternionX = new THREE.Quaternion();

	        // Yaw rotation - Turning left or right
	        if (this.ArrowLeft) {
	            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.1);
	        }

	        if (this.ArrowRight) {
	            quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.1);
	        }

	        camera.quaternion.multiplyQuaternions(quaternionY, camera.quaternion);
	        active = true;
        }

        if (this.space && !this.isJumping) {
            this.velocity.y = this.jumpStrength;
            this.isJumping = true;
            active = true;
        }



        this.velocity.y += this.gravity;
        camera.position.y += this.velocity.y;
    	camera.position.y = Math.round(camera.position.y * P) / P;

        if (camera.position.y <= camera.floor + 0.5) {
            this.velocity.y = 0;
            camera.position.y = camera.floor + 0.5;
            this.isJumping = false;
        }

        this.creator.update()

        if (active && imageModal) imageModal.remove();
    }

	touch() {
	    user.touchedObjects = [];
	    this.wS = 0.05;
	    this.aS = 0.05;
	    this.sS = 0.05;
	    this.dS = 0.05;

	    actives.forEach(atc => scene.remove(atc));
	    actives = [];
	    let boxSize;
	    var cameraPosition = camera.position.clone();

	    if (display.camera.boxType == 'person') {
	        boxSize = new THREE.Vector3(.2, .5, .01);
	        cameraPosition.y -= .2;
	    } else if (display.camera.boxType == 'ediface-small') {
	        boxSize = new THREE.Vector3(1, 6, 3);
	    }

	    var cameraBoundingBox = new THREE.Box3().setFromCenterAndSize(cameraPosition, boxSize);

	    if (display.userBoxFrame) {
	        const matrix = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
	        const vertices = [
	            new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	            new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, boxSize.z / 2),
	            new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	            new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, boxSize.z / 2),
	            new THREE.Vector3(boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	            new THREE.Vector3(-boxSize.x / 2, boxSize.y / 2, -boxSize.z / 2),
	            new THREE.Vector3(boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	            new THREE.Vector3(-boxSize.x / 2, -boxSize.y / 2, -boxSize.z / 2),
	        ];

	        vertices.forEach(v => v.applyMatrix4(matrix).add(cameraPosition));

	        const rotatedBoundingBox = new THREE.Box3().setFromPoints(vertices);
	        const boxHelper = new THREE.Box3Helper(rotatedBoundingBox, 0xffff00);
	        scene.add(boxHelper);
	    }

	    var touchablePlanes = scene.children.filter(child => /touchable/.test(child.name));
	    window.intersects = false;
	    display.userBoxFrame = false;

	    let intersectionPoints = [];

	    if (touchablePlanes.length) {
	        for (var k = 0; k < touchablePlanes.length; k++) {
	            var o = touchablePlanes[k];

	            if (o.name == "touchable::plane") {
	            	if (cameraBoundingBox.intersectsBox(o.geometry.boundingBox)) {
	            		let foot = camera.position.clone();
	            		foot.y -= 0.5;
	            		var closestDist = Infinity;
	            		var closestY = 0;
	            		for (var key in o.terrain) {
	            			var xz = key.split("_").map(Number);
	            			let dist = Math.sqrt(Math.pow(xz[0] - camera.position.z, 2) + Math.pow(xz[1] - camera.position.z, 2));
	            			if (dist < closestDist) {
	            				closestDist = dist;
	            				closestY = o.terrain[key];
	            			}
	            		}
	            		camera.floor = closestY;
	            		camera.floorDiff = Math.abs(camera.position.y - camera.floor);
	                	camera.position.y = camera.floor + 0.5;
	            		controller.creator.update();
	            	}
	            } else if (o.triangle && cameraBoundingBox.intersectsTriangle(o.triangle)) {
	                //display.userBoxFrame = true;
	                //setTimeout(function() { display.userBoxFrame = false }, 300);

	                const rays = [
	                    new THREE.Ray(cameraBoundingBox.min, new THREE.Vector3(1, 0, 0)),
	                    new THREE.Ray(cameraBoundingBox.min, new THREE.Vector3(0, 1, 0)),
	                    new THREE.Ray(cameraBoundingBox.min, new THREE.Vector3(0, 0, 1)),
	                    new THREE.Ray(cameraBoundingBox.max, new THREE.Vector3(-1, 0, 0)),
	                    new THREE.Ray(cameraBoundingBox.max, new THREE.Vector3(0, -1, 0)),
	                    new THREE.Ray(cameraBoundingBox.max, new THREE.Vector3(0, 0, -1))
	                ];

	                const triangleNormal = calculateNormal(o.triangle.a, o.triangle.b, o.triangle.c);

	                for (let i = 0; i < rays.length; i++) {
	                    const intersectionPoint = new THREE.Vector3();
	                    const intersects = rays[i].intersectTriangle(o.triangle.a, o.triangle.b, o.triangle.c, false, intersectionPoint);
	                    if (intersects) {
	                        let center = new THREE.Vector3();
	                        user.touchedObjects.push({
	                            name: o.name,
	                            center: center.addVectors(o.triangle.a, o.triangle.b).add(o.triangle.c).divideScalar(3)
	                        });

	                        intersectionPoint.x = Math.round(intersectionPoint.x * 1000) / 1000;
	                        intersectionPoint.y = Math.round(intersectionPoint.y * 1000) / 1000;
	                        intersectionPoint.z = Math.round(intersectionPoint.z * 1000) / 1000;

	                        intersectionPoints.push({ point: intersectionPoint, normal: o.triangle.normal });
	                    }
	                }
	            }
	        }
	    }

	    if (intersectionPoints.length) {
	        // Find the most relevant intersection point
	        let relevantIntersection = intersectionPoints[0];

	        for (let i = 1; i < intersectionPoints.length; i++) {
	            if (intersectionPoints[i].point.y < relevantIntersection.point.y) {
	                relevantIntersection = intersectionPoints[i];
	            }
	        }

	        if (Math.abs(relevantIntersection.normal.y) > Math.cos(Math.PI / 4)) {
	            let thisYFloor = Math.floor(relevantIntersection.point.y * 1000) / 1000;
	            camera.floorDiff = Math.abs(thisYFloor - camera.floor);
	            camera.floor = thisYFloor;

	            if (camera.floorDiff > 0.05 && camera.floorDiff < 0.5) {
	                controller.creator.update();
	                camera.position.y = thisYFloor + 0.5;
	            }
	        } else {
	            if (this.w) this.wS = 0.0;
	            if (this.a) this.aS = 0.0;
	            if (this.s) this.sS = 0.0;
	            if (this.d) this.dS = 0.0;
	        }
	    } else {
	        camera.floor = 0;
	    }
	}

    navigate() {
    	this.tabs.forEach(tab => {
    		if (tab !== this.page) {
    			document.getElementById(tab).classList.remove('active');
    			document.querySelector('.' + tab).classList.remove('active');
    		} else {
    			document.getElementById(tab).classList.add('active');
    			document.querySelector('.' + tab).classList.add('active');
    		}
    	});
    }
}


function Control() {
	var controller = new Controller();


	/********/ /********/ /********/
	/********/ /********/ /********/
	/********/ /********/ /********/

	var c = document.createElement('section');
	c.id = 'controller';
	document.body.appendChild(c);

	var controllerTabs = document.createElement('div');
	controllerTabs.id = 'controller-tabs';
	controllerTabs.innerHTML = `<button id="create-outside">Self</button><button id="generate-polygon" class="active">Build Objects</button><button id="apply-images">Search Images</button><button id="manage-spaces">Manage Spaces</button>`

	document.getElementById('controller').appendChild(controllerTabs);
	document.querySelectorAll('#controller-tabs > button').forEach(button => {
		button.addEventListener('click', function(e) {
			for (var i = 0; i < controller.tabs.length; i++) {
				if (e.srcElement.id == controller.tabs[i]) {
					document.getElementById(controller.tabs[i]).classList.add('active');
					document.querySelector('.' + controller.tabs[i]).classList.add('active');
				} else {
					document.getElementById(controller.tabs[i]).classList.remove('active');
					document.querySelector('.' + controller.tabs[i]).classList.remove('active');
				}
			}
			controller.page = e.srcElement.id;
			controller.navigate();
		});
	})


	var createOutside = document.createElement('section');
	createOutside.classList.add('page');
	createOutside.classList.add('create-outside');
	createOutside.innerHTML = `<div id="self-control">
		<input type="number" id="gravity" value="${controller.gravity}" />
		<input type="number" id="jumpStrength" value="${controller.jumpStrength}" />
	</div>`;

	c.appendChild(createOutside);

	document.getElementById('gravity').addEventListener('change', e => controller.gravity = +e.srcElement.value);

	document.getElementById('jumpStrength').addEventListener('change', e => controller.jumpStrength = +e.srcElement.value);


	var candidatePoints = document.createElement('section');
	candidatePoints.classList.add('page');
	candidatePoints.classList.add('active');
	candidatePoints.classList.add('generate-polygon');
	candidatePoints.innerHTML = `<div id="touch">
	<pre id="intersection-points"></pre>
		<div class="header"><div>name</div><div>center</div><div>camera face touched</div></div>
		<div id="touched-objects">${
			user.touchedObjects.map(to => `<div class="row"><div>${to.name}</div><div>${JSON.stringify(to.center, null, 1)}</div><div>${to.cameraFaceTouched}</div></div>`).join('')
		}</div>
	</div>
	<div class="header"><div>Points</div><div>Actions</div></div>
	<div id="add-polygon-row" class="row"><button id="add-polygon">+</button></div>`;

	c.appendChild(candidatePoints);

	document.getElementById('add-polygon').addEventListener('click', (e) => {
		e.preventDefault();


		var id = controller.creator.polygonVertices.length;
		controller.creator.polygonVertices.push([]);

		var pg = document.createElement('div');
		['row', 'three', 'polygonpoints'].forEach(c => pg.classList.add(c));
		pg.innerHTML = `<pre class="point-group" data-id="${id}"></pre>
			<div>
				<button class="generate-polygon">Triangle Path</button>
				<button class="flatish-ground">Flatish Ground</button>
				<button class="flatish-triangle">Flatish Triangle Path</button>
			</div>`;

		document.getElementById('add-polygon-row').insertAdjacentElement('beforebegin', pg);
		
		pg.children[0].addEventListener('click', controller.creator.selectPointGroup.bind(controller.creator));

		pg.children[1].children[0].addEventListener('click', e => {
			controller.creator.addChild = true;
			controller.creator.ConnectTheDotsWithPolygons.bind(controller.creator);
			controller.creator.ConnectTheDotsWithPolygons();
			controller.creator.addChild = false;
		});


		pg.children[1].children[1].addEventListener('click', controller.creator.MakeFlatishGround.bind(controller.creator));
	})	


	var applyImages = document.createElement('section');
	applyImages.classList.add('page');
	applyImages.classList.add('apply-images');
	applyImages.innerHTML = `?`;


	c.appendChild(applyImages);

	var manageSpaces = document.createElement('section');
	manageSpaces.classList.add('page');
	manageSpaces.classList.add('manage-spaces');
	manageSpaces.innerHTML = `<pre>
${JSON.stringify(camera.intersects, null, 1)}
	</pre>`;


	c.appendChild(manageSpaces);


	controller.Self();

	return controller
}

var controller = Control()

/********| |********| |********/
/********| |********| |********/
/********| |********| |********/
window.devGridDots = [];
function DevGrid(radius, display) {
	window.devGridDots.forEach(function(dgd) {
		scene.remove(dgd);
		dgd.geometry.dispose();
		dgd.material.dispose();
	});
	window.devGridDots = [];
	if (display) {
		var gridstep = .35// 0.75;
	    for (var x = 0; x < radius * 2; x += gridstep) {
	        for (var y = 0; y < radius * 2; y += gridstep) {
	            for (var z = 0; z < radius * 2; z += gridstep) {
	            	let _x = Math.round(x * 100) / 100; 
	            	let _y = Math.round(y * 100) / 100;
	            	let _z = Math.round(z * 100) / 100;
	                var dot = new THREE.Mesh(
	                    new THREE.SphereGeometry(.02, 11, 11),
	                    new THREE.MeshStandardMaterial({
	                        color: 'white',
	                        side: THREE.DoubleSide
	                    })
	                );
	                dot.position.set(_x, _y, _z);
	                dot.castShadow = true;
	                dot.receiveShadow = true;
	                dot.name = 'devdot';
	                dot.uid = `${_x}_${_y}_${_z}`;
	                // add2DText(scene, dot.uid, .31, 'yellow', {x,y,z}, true, 'transparent');
	                
	                scene.add(dot);
	                devGridDots.push(dot);
	            }
	        }
	    }
	}

    // var g = new THREE.PlaneGeometry(radius * 2, radius * 2, 300, 300);
    // var m = new THREE.MeshStandardMaterial({
    //     color: 'blue',
    //     wireframe: false,
    //     side: THREE.DoubleSide
    // });
    // var plane = new THREE.Mesh(g, m);
    // plane.name = 'ground';
    // plane.receiveShadow = true;
    // plane.position.set(0, 0, 0);
    // plane.rotation.x = -Math.PI / 2;
    // scene.add(plane);
}

function Sun() {
    var pointLight = new THREE.PointLight(0xfffffe, 100000, 1000);
    pointLight.position.set(100, 100, 0);
    pointLight.lookAt(0, 0, 0);
    pointLight.castShadow = true;
    scene.add(pointLight);

    var counter = 0;
    var sway = false;
    function move() {
        window.requestAnimationFrame(move);
        pointLight.position.x += sway ? -0.1 : 0.1;
        pointLight.position.z += sway ? 0.1 : -0.1;
        counter += sway ? -1 : 1;
        if (Math.abs(counter) == 122) {
            sway = !sway;
        }
    }

    level.sun = new THREE.Mesh(
    	new THREE.SphereGeometry(1, 10, 10),
    	new THREE.MeshBasicMaterial({ color: 0xffffec })
    );
    level.sun.position.set(100, 100, 0);
    // let center = level.sun.ge
    // for (var i = 0; i < level.sun.geometry.attributes.position.array.length; i++) {
    // 	var vertexPosition = new THREE.Vector3(level.sun.geometry.attributes.position.array[i], level.sun.geometry.attributes.position.array[i + 1],level.sun.geometry.attributes.position.array[i + 2]);
    // 	var direction = level.sun.position.clone().sub(vertexPosition).normalize();

    // }
    scene.add(level.sun);
}

function createTextTexture(message, fontSize = 50, fontColor = 'white', backgroundColor = 'transparent') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const padding = 10;
    const dpi = 700; // Increase DPI for better resolution
    const scaleFactor = dpi / 72; // Scale factor based on DPI

    context.font = `${fontSize * scaleFactor}px Arial`;
    const textWidth = context.measureText(message).width;
    canvas.width = (textWidth + padding * 2) * scaleFactor;
    canvas.height = (fontSize + padding * 2) * scaleFactor;

    context.font = `${fontSize * scaleFactor}px Arial`;
    context.scale(scaleFactor, scaleFactor); // Apply scale factor to context
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);

    context.fillStyle = fontColor;
    context.fillText(message, padding, fontSize + padding);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    return texture;
}

function add2DText(scene, message, fontSize, fontColor, position, isSprite, backgroundColor) {
    const texture = createTextTexture(message, fontSize, fontColor, backgroundColor);
    const scale = .001; // Adjust scale as needed for the desired size
    if (isSprite) {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(texture.image.width * scale, texture.image.height * scale, 1);
        scene.add(sprite);
    } else {
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const geometry = new THREE.PlaneGeometry(texture.image.width * scale, texture.image.height * scale); // Adjust size as needed
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        scene.add(mesh);
    }
}

function RenderAll() {
	add2DText(
		scene, '(0,0,0)', 2, 'lawngreen', { x: 0, y: 2, z: 0 }, true, 'transparent');

	devGridDots.forEach(dgd => scene.remove(dgd));
	devGridDots = [];
	DevGrid(N, display.devGridDots);
	Sun();
	Animate();

	document.getElementById('intersection-points').innerHTML = `
		<span>floor: ${camera.floor}</span> <br />
		<pre>
			x: ${camera.position.x}
			y: ${camera.position.y}
			z: ${camera.position.z}
		</pre>
		`
}

RenderAll();


function Animate() { 
    window.requestAnimationFrame(() => Animate());

    controller.activate();
    controller.touch();

    renderer.render(scene, camera);
}


function loadTags(div) {
	xhr({
		method: "GET",
		url: "/image-tags",
		load: function() {
			var tags = JSON.parse(this.response);
			imageModal.innerHTML = `
			<div class="breadcrumbs">tags</div>
			<div>
				${
					tags.map(tag => `<button class="tag" data-tag="${tag}">${tag}</div>`).join('')
				}
			</div>
			`;
			document.querySelectorAll('.tag').forEach(function(button) {
				button.addEventListener('click', function() {
					var tag = this.dataset.id;
					loadImages(tag);
				});
			})
		}
	})
}

function loadImages(tag) {

}

