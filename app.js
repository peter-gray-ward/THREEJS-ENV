import * as THREE from '/three';
import * as PERLIN from '/perlin-noise';

var scene = new THREE.Scene();
var origin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), new THREE.MeshStandardMaterial({ color: 'turquoise' }));
origin.position.set(0, 0, 0);
scene.add(origin);
scene.grounds = [];
scene.objects = [];

var camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.75) / window.innerHeight, 0.1, 100000);
scene.add(camera);
camera.floor = 0;
camera.inOcean = true;
camera.touchingFloor = true;
camera.floorDiff = 0;
camera.position.set(3, 2.5, 3);
camera.up = new THREE.Vector3(0, 1, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));
var Grass = [
    '#33462d', //
    '#435c3a', //
    '#4e5e3e', //
    '#53634c', //
    '#53634c', // (duplicate, same as above)
    '#536c46', //
    '#5d6847', //
];
var D = 20
window.angle = 0
window.sunMaxDist = -Infinity;
window.sunMinDist = Infinity
var priorPosition = camera.position.clone();

var sceneRadius = 100
var axisLength = 100;
const P = 3
var actives = [];
const N = Math.floor(sceneRadius * 2 / 12);
var levels = [];
var level = {
	name: 'first level',
	objects: []
}

window.trees = {}
var display = {
	devGridDots: false,
	userBoxFrame: false,
	camera: {
		boxType: 'person'
	}
}
var far = 10000;

const distanceToSunInInches = 588768000000;


function Load() {
	xhr({
		method: 'GET',
		url: '/load',
		load: function() {

		},
		body: JSON.parse(level)
	})
}

window.Load = Load;

function Save() {
	xhr({
		method: 'POST',
		url: '/save',
		load: function() {
			level = JSON.parse(this.response);
		}
	})
}

window.Save = Save;

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

function moveTo(mesh, target, unitsToMove = 1) {

  // Step 1: Calculate the direction vector
  const direction = new THREE.Vector3();
  direction.subVectors(target.position, mesh.position);

  // Step 2: Normalize the direction vector
  direction.normalize();

  // Step 3: Scale the direction vector by the number of units to move
  direction.multiplyScalar(unitsToMove);

  // Step 4: Update the mesh position
  mesh.position.add(direction);
  mesh.position.needsUpdate = true
}

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
imageModal.id = 'image-modal';

function xhr(options = { body: {} }) {
	var x = new XMLHttpRequest();
	x.open(options.method, options.url);
	x.addEventListener('load', options.load);
	x.send(JSON.stringify(options.body));
}


function ShowBoundingBox(object, boxSize) {
  const position = object.position.clone();
  let boundingBox;

  // Check object type
  if (object instanceof THREE.PerspectiveCamera) {
    // For PerspectiveCamera, create a box around its position
    boundingBox = new THREE.Box3().setFromCenterAndSize(position, boxSize);
  } else if (object instanceof THREE.Mesh) {
    // For Mesh object, create a box around its geometry
    object.geometry.computeBoundingBox();
    boundingBox = object.geometry.boundingBox.clone();
    boundingBox.translate(position); // Apply position offset
  } else {
    console.error('Unsupported object type for bounding box visualization.');
    return;
  }

  // Create helper to display the bounding box
  const boxHelper = new THREE.Box3Helper(boundingBox, 0xffff00);
  scene.add(boxHelper);
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

class Ocean {
    constructor() {
        this.radius = sceneRadius;
        this.amplitude = 0.09;
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
        this.oceanMesh.position.set(0,0,0);
        level.objects.push({
            type: 'plane',
            points: null,
            imageId: undefined,
            uuid: this.oceanMesh.uuid
        });
        scene.add(this.oceanMesh);
        scene.grounds.push(this.oceanMesh)
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

              if (x <= D && x >= -D && z <= D && z >= -D) {
                positions[index + 1] = 0

                // Update the height map
                this.heightMap[i][j] = 0
                continue;
              }
              
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

class Creator {
	addChild = false;
	activePolygonVerticesIndex = -1;
	polygonVertices = [];
	uuid = undefined;
  buildings = {
    GenerateRandomLeCorbusierEdifice: function(centroid, ceilingHeight, levels, withPilotis) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = ceilingHeight;
        const baseSize = 10;

        // Generate vertices for levels
        for (let i = 0; i < levels; i++) {
            const height = i * levelHeight;
            vertices.push(
                centroid.x - baseSize, centroid.y + height, centroid.z - baseSize, // Bottom left
                centroid.x + baseSize, centroid.y + height, centroid.z - baseSize, // Bottom right
                centroid.x + baseSize, centroid.y + height, centroid.z + baseSize, // Top right
                centroid.x - baseSize, centroid.y + height, centroid.z + baseSize, // Top left
                centroid.x - baseSize, centroid.y + height + ceilingHeight, centroid.z - baseSize, // Upper Bottom left
                centroid.x + baseSize, centroid.y + height + ceilingHeight, centroid.z - baseSize, // Upper Bottom right
                centroid.x + baseSize, centroid.y + height + ceilingHeight, centroid.z + baseSize, // Upper Top right
                centroid.x - baseSize, centroid.y + height + ceilingHeight, centroid.z + baseSize  // Upper Top left
            );
        }

        // Generate indices for faces
        for (let i = 0; i < levels; i++) {
            const offset = i * 8;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7,
                offset + 4, offset + 5, offset + 6,
                offset + 4, offset + 6, offset + 7
            );
        }

        // Add vertices and indices for pilotis if applicable
        if (withPilotis) {
            const pilotisHeight = ceilingHeight / 2;
            for (let i = 0; i < 4; i++) {
                const x = (i % 2 === 0 ? -baseSize + 1 : baseSize - 1);
                const z = (i < 2 ? -baseSize + 1 : baseSize - 1);
                vertices.push(
                    centroid.x + x, centroid.y, centroid.z + z,
                    centroid.x + x, centroid.y + pilotisHeight, centroid.z + z
                );
            }

            const pilotisOffset = levels * 8;
            for (let i = 0; i < 4; i++) {
                indices.push(
                    pilotisOffset + i * 2, pilotisOffset + i * 2 + 1, pilotisOffset + ((i + 1) % 4) * 2 + 1,
                    pilotisOffset + i * 2, pilotisOffset + ((i + 1) % 4) * 2 + 1, pilotisOffset + ((i + 1) % 4) * 2
                );
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x8b8b8b, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomZahaHadidEdifice: function(centroid, maxHeight, numberOfWaves) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const waveHeight = maxHeight / numberOfWaves;
        const baseSize = 10;
        const segments = 32;

        for (let i = 0; i <= numberOfWaves; i++) {
            const height = i * waveHeight;
            const radius = baseSize * (1 + 0.5 * Math.sin(i * Math.PI / numberOfWaves));

            for (let j = 0; j < segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                vertices.push(centroid.x + x, centroid.y + height, centroid.z + z);
            }
        }

        for (let i = 0; i < numberOfWaves; i++) {
            for (let j = 0; j < segments; j++) {
                const first = i * segments + j;
                const second = (i + 1) * segments + j;
                const third = (i + 1) * segments + (j + 1) % segments;
                const fourth = i * segments + (j + 1) % segments;

                indices.push(first, second, third);
                indices.push(first, third, fourth);
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x1E90FF, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomFrankGehryEdifice: function(centroid, maxHeight, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const baseSize = 10;

        for (let i = 0; i < levels; i++) {
            const height = centroid.y + (i * (maxHeight / levels));
            const xOffset = Math.random() * baseSize - (baseSize / 2);
            const zOffset = Math.random() * baseSize - (baseSize / 2);

            vertices.push(
                centroid.x + xOffset - baseSize, height, centroid.z + zOffset - baseSize,
                centroid.x + xOffset + baseSize, height, centroid.z + zOffset - baseSize,
                centroid.x + xOffset + baseSize, height, centroid.z + zOffset + baseSize,
                centroid.x + xOffset - baseSize, height, centroid.z + zOffset + baseSize,
                centroid.x + xOffset - baseSize, height + (maxHeight / levels), centroid.z + zOffset - baseSize,
                centroid.x + xOffset + baseSize, height + (maxHeight / levels), centroid.z + zOffset - baseSize,
                centroid.x + xOffset + baseSize, height + (maxHeight / levels), centroid.z + zOffset + baseSize,
                centroid.x + xOffset - baseSize, height + (maxHeight / levels), centroid.z + zOffset + baseSize
            );

            const offset = i * 8;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7,
                offset + 4, offset + 5, offset + 6,
                offset + 4, offset + 6, offset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x6A5ACD, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomIMPeiEdifice: function(centroid, baseSize, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segmentHeight = height / levels;

        for (let i = 0; i < levels; i++) {
            const levelHeight = centroid.y + i * segmentHeight;
            const currentSize = baseSize * (1 - i / levels);

            vertices.push(
                centroid.x - currentSize, levelHeight, centroid.z - currentSize,
                centroid.x + currentSize, levelHeight, centroid.z - currentSize,
                centroid.x + currentSize, levelHeight, centroid.z + currentSize,
                centroid.x - currentSize, levelHeight, centroid.z + currentSize,
                centroid.x, levelHeight + segmentHeight, centroid.z
            );

            const offset = i * 5;
            indices.push(
                offset, offset + 1, offset + 4,
                offset + 1, offset + 2, offset + 4,
                offset + 2, offset + 3, offset + 4,
                offset + 3, offset, offset + 4,
                offset, offset + 1, offset + 2,
                offset, offset + 2, offset + 3
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x00BFFF, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomTadaoAndoEdifice: function(centroid, length, width, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = height / levels;

        for (let i = 0; i < levels; i++) {
            const baseHeight = centroid.y + i * levelHeight;
            vertices.push(
                centroid.x - length / 2, baseHeight, centroid.z - width / 2,
                centroid.x + length / 2, baseHeight, centroid.z - width / 2,
                centroid.x + length / 2, baseHeight, centroid.z + width / 2,
                centroid.x - length / 2, baseHeight, centroid.z + width / 2,
                centroid.x - length / 2, baseHeight + levelHeight, centroid.z - width / 2,
                centroid.x + length / 2, baseHeight + levelHeight, centroid.z - width / 2,
                centroid.x + length / 2, baseHeight + levelHeight, centroid.z + width / 2,
                centroid.x - length / 2, baseHeight + levelHeight, centroid.z + width / 2
            );

            const offset = i * 8;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7,
                offset + 4, offset + 5, offset + 6,
                offset + 4, offset + 6, offset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x696969, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomRenzoPianoEdifice: function(centroid, width, depth, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = height / levels;

        for (let i = 0; i < levels; i++) {
            const baseHeight = centroid.y + i * levelHeight;

            // Create vertices for the skeletal frame
            vertices.push(
                centroid.x - width / 2, baseHeight, centroid.z - depth / 2,
                centroid.x + width / 2, baseHeight, centroid.z - depth / 2,
                centroid.x + width / 2, baseHeight, centroid.z + depth / 2,
                centroid.x - width / 2, baseHeight, centroid.z + depth / 2,
                centroid.x - width / 2, baseHeight + levelHeight, centroid.z - depth / 2,
                centroid.x + width / 2, baseHeight + levelHeight, centroid.z - depth / 2,
                centroid.x + width / 2, baseHeight + levelHeight, centroid.z + depth / 2,
                centroid.x - width / 2, baseHeight + levelHeight, centroid.z + depth / 2
            );

            const offset = i * 8;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7,
                offset + 4, offset + 5, offset + 6,
                offset + 4, offset + 6, offset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const frameMesh = new THREE.Mesh(geometry, frameMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Create glass panels
        const glassGeometry = new THREE.BoxGeometry(width, height, depth);
        const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEFA, transparent: true, opacity: 0.5 });
        const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
        glassMesh.position.set(centroid.x, centroid.y + height / 2, centroid.z);

        const group = new THREE.Group();
        group.add(frameMesh);
        group.add(glassMesh);

        return group;
    },

    GenerateRandomNormanFosterEdifice: function(centroid, width, depth, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = height / levels;

        for (let i = 0; i < levels; i++) {
            const baseHeight = centroid.y + i * levelHeight;
            const taper = (1 - i / levels) * 0.5;

            vertices.push(
                centroid.x - width * taper / 2, baseHeight, centroid.z - depth * taper / 2,
                centroid.x + width * taper / 2, baseHeight, centroid.z - depth * taper / 2,
                centroid.x + width * taper / 2, baseHeight, centroid.z + depth * taper / 2,
                centroid.x - width * taper / 2, baseHeight, centroid.z + depth * taper / 2,
                centroid.x - width * taper / 2, baseHeight + levelHeight, centroid.z - depth * taper / 2,
                centroid.x + width * taper / 2, baseHeight + levelHeight, centroid.z - depth * taper / 2,
                centroid.x + width * taper / 2, baseHeight + levelHeight, centroid.z + depth * taper / 2,
                centroid.x - width * taper / 2, baseHeight + levelHeight, centroid.z + depth * taper / 2
            );

            const offset = i * 8;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7,
                offset + 4, offset + 5, offset + 6,
                offset + 4, offset + 6, offset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const frameMesh = new THREE.Mesh(geometry, frameMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Create glass panels
        const glassGeometry = new THREE.BoxGeometry(width, height, depth);
        const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.5 });
        const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
        glassMesh.position.set(centroid.x, centroid.y + height / 2, centroid.z);

        const group = new THREE.Group();
        group.add(frameMesh);
        group.add(glassMesh);

        return group;
    },

    GenerateRandomOscarNiemeyerEdifice: function(centroid, baseRadius, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 32;
        const levelHeight = height / levels;

        for (let i = 0; i <= levels; i++) {
            const currentRadius = baseRadius * (1 - i / levels);
            const y = centroid.y + i * levelHeight;

            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                const x = centroid.x + currentRadius * Math.cos(theta);
                const z = centroid.z + currentRadius * Math.sin(theta);
                vertices.push(x, y, z);
            }
        }

        for (let i = 0; i < levels; i++) {
            for (let j = 0; j < segments; j++) {
                const first = i * (segments + 1) + j;
                const second = first + segments + 1;
                const third = first + 1;
                const fourth = second + 1;

                indices.push(first, second, third);
                indices.push(second, fourth, third);
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xFFD700, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomAntoniGaudiEdifice: function(centroid, height, baseRadius, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 32;
        const levelHeight = height / levels;

        for (let i = 0; i <= levels; i++) {
            const currentRadius = baseRadius * (1 - i / levels);
            const y = centroid.y + i * levelHeight;

            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                const twist = (i % 2 === 0) ? Math.sin(theta + (i * 0.5)) : Math.cos(theta + (i * 0.5));
                const x = centroid.x + currentRadius * Math.cos(theta) * (1 + 0.1 * twist);
                const z = centroid.z + currentRadius * Math.sin(theta) * (1 + 0.1 * twist);
                vertices.push(x, y, z);
            }
        }

        for (let i = 0; i < levels; i++) {
            for (let j = 0; j < segments; j++) {
                const first = i * (segments + 1) + j;
                const second = first + segments + 1;
                const third = first + 1;
                const fourth = second + 1;

                indices.push(first, second, third);
                indices.push(second, fourth, third);
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xFF4500, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomEeroSaarinenEdifice: function(centroid, width, depth, height, curvature) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 32;

        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = centroid.x + width * Math.cos(theta) * (1 + curvature * Math.sin(theta));
            const z = centroid.z + depth * Math.sin(theta) * (1 + curvature * Math.cos(theta));
            vertices.push(x, centroid.y, z);
            vertices.push(x, centroid.y + height, z);
        }

        for (let i = 0; i < segments; i++) {
            const first = i * 2;
            const second = first + 1;
            const third = first + 2;
            const fourth = third + 1;

            indices.push(first, third, second);
            indices.push(second, third, fourth);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x8A2BE2, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomRichardMeierEdifice: function(centroid, width, depth, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = height / levels;
        const segments = 10;

        for (let i = 0; i < levels; i++) {
            const baseHeight = centroid.y + i * levelHeight;

            for (let j = 0; j <= segments; j++) {
                for (let k = 0; k <= segments; k++) {
                    const x = centroid.x - width / 2 + (width / segments) * j;
                    const z = centroid.z - depth / 2 + (depth / segments) * k;
                    vertices.push(x, baseHeight, z);
                    vertices.push(x, baseHeight + levelHeight, z);
                }
            }

            const vertOffset = i * (segments + 1) * (segments + 1) * 2;

            for (let j = 0; j < segments; j++) {
                for (let k = 0; k < segments; k++) {
                    const first = vertOffset + (j * (segments + 1) + k) * 2;
                    const second = first + 2;
                    const third = first + (segments + 1) * 2;
                    const fourth = third + 2;

                    indices.push(first, second, fourth);
                    indices.push(first, fourth, third);

                    indices.push(first + 1, second + 1, fourth + 1);
                    indices.push(first + 1, fourth + 1, third + 1);
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    GenerateRandomLouisKahnEdifice: function(centroid, width, depth, height, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = height / levels;

        for (let i = 0; i < levels; i++) {
            const baseHeight = centroid.y + i * levelHeight;
            const offset = (i % 2 === 0) ? 0 : width / 4;

            vertices.push(
                centroid.x - width / 2 + offset, baseHeight, centroid.z - depth / 2,
                centroid.x + width / 2 - offset, baseHeight, centroid.z - depth / 2,
                centroid.x + width / 2 - offset, baseHeight, centroid.z + depth / 2,
                centroid.x - width / 2 + offset, baseHeight, centroid.z + depth / 2,
                centroid.x - width / 2 + offset, baseHeight + levelHeight, centroid.z - depth / 2,
                centroid.x + width / 2 - offset, baseHeight + levelHeight, centroid.z - depth / 2,
                centroid.x + width / 2 - offset, baseHeight + levelHeight, centroid.z + depth / 2,
                centroid.x - width / 2 + offset, baseHeight + levelHeight, centroid.z + depth / 2
            );

            const vertOffset = i * 8;
            indices.push(
                vertOffset, vertOffset + 1, vertOffset + 5,
                vertOffset, vertOffset + 5, vertOffset + 4,
                vertOffset + 1, vertOffset + 2, vertOffset + 6,
                vertOffset + 1, vertOffset + 6, vertOffset + 5,
                vertOffset + 2, vertOffset + 3, vertOffset + 7,
                vertOffset + 2, vertOffset + 7, vertOffset + 6,
                vertOffset + 3, vertOffset, vertOffset + 4,
                vertOffset + 3, vertOffset + 4, vertOffset + 7,
                vertOffset + 4, vertOffset + 5, vertOffset + 6,
                vertOffset + 4, vertOffset + 6, vertOffset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xA9A9A9, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },


    GenerateRandomSantiagoCalatravaEdifice: function(centroid, height, radius, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const segments = 32;
        const levelHeight = height / levels;

        for (let i = 0; i <= levels; i++) {
            const angleOffset = (i % 2 === 0) ? Math.PI / segments : 0;
            const levelRadius = radius * (1 - i / levels);
            const y = centroid.y + i * levelHeight;

            for (let j = 0; j < segments; j++) {
                const theta = (j / segments) * Math.PI * 2 + angleOffset;
                const x = centroid.x + levelRadius * Math.cos(theta);
                const z = centroid.z + levelRadius * Math.sin(theta);
                vertices.push(x, y, z);
            }
        }

        for (let i = 0; i < levels; i++) {
            for (let j = 0; j < segments; j++) {
                const first = i * segments + j;
                const second = first + segments;
                const third = first + 1;
                const fourth = second + 1;

                indices.push(first, second, third % segments + i * segments);
                indices.push(second, fourth % segments + (i + 1) * segments, third % segments + i * segments);
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },
    GenerateRandomMiesVanDerRoheEdifice: function(centroid, ceilingHeight, levels) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = ceilingHeight;
        const baseSize = 10;
        const gridSegments = 4;

        // Generate vertices for levels
        for (let i = 0; i < levels; i++) {
            const height = i * levelHeight;

            for (let j = 0; j <= gridSegments; j++) {
                for (let k = 0; k <= gridSegments; k++) {
                    const x = centroid.x - baseSize + (2 * baseSize / gridSegments) * j;
                    const z = centroid.z - baseSize + (2 * baseSize / gridSegments) * k;
                    vertices.push(x, centroid.y + height, z);
                    vertices.push(x, centroid.y + height + ceilingHeight, z);
                }
            }
        }

        // Generate indices for faces
        for (let i = 0; i < levels; i++) {
            const offset = i * (gridSegments + 1) * (gridSegments + 1) * 2;

            for (let j = 0; j < gridSegments; j++) {
                for (let k = 0; k < gridSegments; k++) {
                    const first = offset + (j * (gridSegments + 1) + k) * 2;
                    const second = first + 2;
                    const third = first + (gridSegments + 1) * 2;
                    const fourth = third + 2;

                    indices.push(first, second, fourth);
                    indices.push(first, fourth, third);

                    indices.push(first + 1, second + 1, fourth + 1);
                    indices.push(first + 1, fourth + 1, third + 1);
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0x333333, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },


    /**
     * @  This function will generate a random building inspired 
     *    by Frank Lloyd Wright's architectural style, known for 
     *    its organic architecture, use of natural materials, 
     *    and integration with the environment.
     */
    GenerateRandomFrankLloydWrightEdifice(centroid, ceilingHeight, levels, withBasement) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const levelHeight = ceilingHeight;
        const baseSize = 10;

        // Generate vertices for levels
        for (let i = 0; i < levels; i++) {
            const height = i * levelHeight;
            vertices.push(
                centroid.x - baseSize, centroid.y + height, centroid.z - baseSize, // Bottom left
                centroid.x + baseSize, centroid.y + height, centroid.z - baseSize, // Bottom right
                centroid.x + baseSize, centroid.y + height, centroid.z + baseSize, // Top right
                centroid.x - baseSize, centroid.y + height, centroid.z + baseSize  // Top left
            );
        }

        // Generate indices for faces
        for (let i = 0; i < levels - 1; i++) {
            const offset = i * 4;
            indices.push(
                offset, offset + 1, offset + 5,
                offset, offset + 5, offset + 4,
                offset + 1, offset + 2, offset + 6,
                offset + 1, offset + 6, offset + 5,
                offset + 2, offset + 3, offset + 7,
                offset + 2, offset + 7, offset + 6,
                offset + 3, offset, offset + 4,
                offset + 3, offset + 4, offset + 7
            );
        }

        // Add vertices and indices for basement if applicable
        if (withBasement) {
            const basementHeight = -ceilingHeight;
            vertices.push(
                centroid.x - baseSize, centroid.y + basementHeight, centroid.z - baseSize, // Bottom left
                centroid.x + baseSize, centroid.y + basementHeight, centroid.z - baseSize, // Bottom right
                centroid.x + baseSize, centroid.y + basementHeight, centroid.z + baseSize, // Top right
                centroid.x - baseSize, centroid.y + basementHeight, centroid.z + baseSize  // Top left
            );

            const basementOffset = levels * 4;
            indices.push(
                basementOffset, basementOffset + 1, basementOffset + 5,
                basementOffset, basementOffset + 5, basementOffset + 4,
                basementOffset + 1, basementOffset + 2, basementOffset + 6,
                basementOffset + 1, basementOffset + 6, basementOffset + 5,
                basementOffset + 2, basementOffset + 3, basementOffset + 7,
                basementOffset + 2, basementOffset + 7, basementOffset + 6,
                basementOffset + 3, basementOffset, basementOffset + 4,
                basementOffset + 3, basementOffset + 4, basementOffset + 7
            );
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ color: 0xffd700, 
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.position.set(centroid.x, centroid.y, centroid.z)

        return mesh;
    }


  }
  leafTexture = new THREE.TextureLoader().load("/image?id=a6ebd1c4-bc15-4c53-bd82-5cf1a4df0501")
  twoByFourTexture = new THREE.TextureLoader().load("/image?id=ca74fa95-77a7-42a6-8fa9-e1458cb8857b")
	ConnectTheDotsWithPolygons() {
		let points = this.polygonVertices[this.activePolygonVerticesIndex];
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    // Add vertices to the array
    points.forEach(p => {
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

      // Compute the bounding box for UV mapping
  	geometry.computeBoundingBox();

    // Create an array for the indices
    const indices = [];

    // Define faces from the vertices (triangulate the this.polygonVertices)
    // Here we'll assume the this.polygonVertices are ordered and form a convex polygon
    for (let i = 1; i < points.length - 1; i++) {
        if (true || Math.random() < 0.5) {
        	indices.push(i - 1, i, i + 1);
        } else {
        	indices.push(0, i, i + 1);
        }
    }

    // Set the indices to the BufferGeometry
    geometry.setIndex(indices);

    // Compute normals for shading
    geometry.computeVertexNormals();


     
    const triangles = [];
		const positions = geometry.attributes.position.array;

		let uuid = undefined;

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

      const vertices = new Float32Array([
        vertex1.x, vertex1.y, vertex1.z,
        vertex2.x, vertex2.y, vertex2.z,
        vertex3.x, vertex3.y, vertex3.z
	    ]);

	    const triangleGeometry = new THREE.BufferGeometry();
	    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
			triangleGeometry.computeVertexNormals();
			triangleGeometry.computeBoundingBox();

		 // Create UV coordinates
	    const uvs = [];
	    points.forEach(p => {
	        uvs.push((p.x - triangleGeometry.boundingBox.min.x) / triangleGeometry.boundingBox.max.x, 
	                 (p.y - triangleGeometry.boundingBox.min.y) / triangleGeometry.boundingBox.max.y);
	    });
	    const uvsArray = new Float32Array(uvs);
	    triangleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvsArray, 2));



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
          scene.grounds.push(triangleMesh);

	    if (!i) {
	    	uuid = triangleMesh.uuid
	    } else {
	    	triangleMesh.uuid = uuid;
	    }

	    level.objects.push({
	    	type: 'triangle',
	    	points: points,
	    	imageId: undefined,
	    	uuid: uuid
	    });

		}


	}

  /**
   * @ This function will generate a random building inspired 
   *   by Le Corbusier’s architectural style, characterized by 
   *   modernist principles, use of pilotis (supports), flat 
   *   roofs, and open floor plans.
   * 
   */



  createCustomBufferGeometry() {
      // Define the vertices for a cube
      const vertices = new Float32Array([
          -1, -1, -1,
           1, -1, -1,
           1,  1, -1,
          -1,  1, -1,
          -1, -1,  1,
           1, -1,  1,
           1,  1,  1,
          -1,  1,  1,
      ]);

      // Define the indices for the cube
      const indices = new Uint16Array([
          0, 1, 2, 2, 3, 0, // front face
          4, 5, 6, 6, 7, 4, // back face
          0, 1, 5, 5, 4, 0, // bottom face
          2, 3, 7, 7, 6, 2, // top face
          0, 3, 7, 7, 4, 0, // left face
          1, 2, 6, 6, 5, 1  // right face
      ]);

      // Create the buffer geometry
      const geometry = new THREE.BufferGeometry();

      // Set the attributes
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      // Compute the normals
      geometry.computeVertexNormals();

      return geometry;
  }

  CREATE_A_TREE(x, y, z) {
    var trunkHeight = randomInRange(7, 50)
    var trunkBaseRadius = trunkHeight < 10 ? randomInRange(.36, .48) : randomInRange(.57, 1.25)
    var rr = randomInRange(.01, .1)
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

     // Create foliage
    var foliageRadius = trunkHeight / randomInRange(4, 7)


    segments = 10
    const sphereGeometry = new THREE.SphereGeometry(foliageRadius, 10, 10);
    let sphereMaterial = new THREE.MeshStandardMaterial({
        color: foliageColor,
        map: this.leafTexture
    });
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.uid = "foliage_" + x + "." + z + "." + y;
    sphere.lights = true;
    sphere.castShadow = true
    sphere.receiveShadow = true
    sphere.position.set(xS, yS - foliageRadius, zS); // Set foliage position
    scene.add(sphere); // Add foliage to the scene
    // window.VolumeHierarchy.push(sphere)

    var {
        array,
        itemSize
    } = sphereGeometry.attributes.position
    for (let i = 0; i < 21; i++) {
        for (var j = 0; j < 21; j++) {
            var vertexIndex = (i * (21 + 1) + j) * itemSize
            var x = array[vertexIndex]
            var z = array[vertexIndex + 1]
            var y = array[vertexIndex + 2]

            
            array[vertexIndex] = randomInRange(x - (foliageRadius * 2.2),     x + foliageRadius * 2.2)
            array[vertexIndex + 1] = randomInRange(y - (foliageRadius * 2.2), y + foliageRadius * 2.2)
            array[vertexIndex + 2] = randomInRange(y - (foliageRadius * 2.2), z + foliageRadius * 2.2)
        }
    }

    const path = new THREE.CatmullRomCurve3(trunkCurve);

    var segments = Math.floor(randomInRange(5, 11))


    var radialSegments = 15


     // Create the tube geometry
    const tubeGeometry = new THREE.TubeGeometry(path, segments, trunkBaseRadius);

 

    var colors = ['#964B00', '#654321', '#CD853F', '#F5F5F5'];

    var foliageColors = Grass.concat(['#00FF00', '#00EE00', '#00DD00', '#00CC00', '#00BB00'])//[0xf0FF00, 0x00FF0f, 0x0fFF00, 0x00FFf0, 0xf0FF0f]
    var foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)]
    var color = colors[Math.floor(Math.random() * colors.length)]
    // Create a material (e.g., MeshBasicMaterial or MeshPhongMaterial)
    const material = new THREE.MeshStandardMaterial({ 
        color,
        map: this.twoByFourTexture
    });

    // Create the mesh
    const tubeMesh = new THREE.Mesh(tubeGeometry, material);
    tubeMesh.castShadow = true
    tubeMesh.lights = true
    tubeMesh.receiveShadow = true
    tubeMesh.position.y -= 2

    tubeMesh.uid = "trunk_" + x + "." + "z" + "." + "y";
    // window.VolumeHierarchy.push(tubeMesh)

    // Add the mesh to the scene
    scene.add(tubeMesh);

    trees[Math.floor(x) + '.' + Math.floor(y) + '.' + Math.floor(z)] = { radius: trunkBaseRadius, trunkHeight }   
  }

  _MakeVerticesWithRandomHorizontalAdjustments(segments, v0, v1, v2, v3, negY = -0.05, posY = 0.09, options) {
      let vertices = [];
      let indices = [];
      let uvs = [];
      let map = {};
      // Create vertices with random vertical adjustments
      for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            let x = (1 - i / segments) * ((1 - j / segments) * v0.x + (j / segments) * v3.x) + 
                    (i / segments) * ((1 - j / segments) * v1.x + (j / segments) * v2.x);
            let z = (1 - i / segments) * ((1 - j / segments) * v0.z + (j / segments) * v3.z) + 
                    (i / segments) * ((1 - j / segments) * v1.z + (j / segments) * v2.z);
            let y = (1 - i / segments) * ((1 - j / segments) * v0.y + (j / segments) * v3.y) + 
                    (i / segments) * ((1 - j / segments) * v1.y + (j / segments) * v2.y);

          
            if (options.repeatingMounds) {
              // Create large, smooth rolling hills or valleys
              let hill1 = Math.sin(x * Math.PI * 0.5) * Math.cos(z * Math.PI * 0.5) * 0.3; // Lower frequency for larger hills/valleys
              let hill2 = Math.sin(x * Math.PI * 0.25) * Math.cos(z * Math.PI * 0.25) * 0.2; // Even lower frequency
              let hill3 = Math.sin(x * Math.PI * 0.125) * Math.cos(z * Math.PI * 0.125) * 0.1; // Very low frequency

              // Combine the hills with different weights
              y += hill1 + hill2 + hill3;
            } else if (options.slightBay) {
              let wave1 = Math.sin((i / segments) * Math.PI * 1.5) * Math.cos((j / segments) * Math.PI * 1.5) * 1.2; // Large wave 1
              let wave2 = Math.sin((i / segments) * Math.PI * 1.0) * Math.cos((j / segments) * Math.PI * 1.0) * 0.15; // Large wave 2
              let wave3 = Math.sin((i / segments) * Math.PI * 0.5) * Math.cos((j / segments) * Math.PI * 0.5) * 0.1; // Large wave 3

              // Combine the waves with different weights to ensure large, smooth transitions
              y += wave1 + wave2 + wave3;

            }

            vertices.push(x, y, z);
            uvs.push(i / segments, j / segments); // Adding UV coordinates
            map[round(x, 1) + '_' + round(z, 1)] = y;

            if (options.withTrees) {
                if (true && Math.random() < 0.01 && Math.random() < 0.01) {
                    this.CREATE_A_TREE(x, y, z);
                }
            }
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

      return {
          vertices,
          indices,
          uvs,
          map
      }
  }

  CreateFlatMeadow(segments, v0, v1, v2, v3) {
      // Initialize arrays to store vertices, indices, and uvs
      let vertices = [];
      let indices = [];
      let uvs = [];

      // Calculate segment size
      const segmentSize = 1 / segments;

      var sectors = segments / segmentSize

      // Create vertices, uvs, and indices
      for (let i = 0; i <= segments; i++) {
          for (let j = 0; j <= segments; j++) {
              // Interpolating between the four corners
              let x = i * segmentSize;
              let y = j * segmentSize;

              let v = new THREE.Vector3();
              v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
              v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
              v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

              // Add some height variation
              let height = Math.sin(x * Math.PI) * Math.sin(y * Math.PI) * Math.random();
              v.z += height;

              vertices.push(v.x, v.y, v.z);
              uvs.push(x, y);

              if (i < segments && j < segments) {
                  // Create indices for two triangles per quad
                  let a = i + j * (segments + 1);
                  let b = (i + 1) + j * (segments + 1);
                  let c = (i + 1) + (j + 1) * (segments + 1);
                  let d = i + (j + 1) * (segments + 1);

                  // Triangle 1
                  indices.push(a, b, d);
                  // Triangle 2
                  indices.push(b, c, d);
              }
          }
      }

      // Creating the map (optional)
      let map = {
          vertices: vertices,
          indices: indices,
          uvs: uvs
      };

      return { vertices, indices, uvs, map };
  }

  CreateMeadow(segments, v0, v1, v2, v3) {
    // Initialize arrays to store vertices, indices, and uvs
    let vertices = [];
    let indices = [];
    let uvs = [];
    var map = {}

    // Calculate segment size
    const segmentSize = 1 / segments;

    const noiseWidth = 100;
    const noiseHeight = 100;
    const perlinNoise = PERLIN.generatePerlinNoise(noiseWidth, noiseHeight);

    // Create vertices, uvs, and indices
    for (let i = 0; i <= segments; i++) {
        for (let j = 0; j <= segments; j++) {
            // Interpolating between the four corners
            let x = i * segmentSize;
            let y = j * segmentSize;

            let v = new THREE.Vector3();
            v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
            v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
            v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

            // Sample Perlin noise
            let noiseX = Math.floor(x * (noiseWidth - 1));
            let noiseY = Math.floor(y * (noiseHeight - 1));
            let height = 0.53 * perlinNoise[noiseY * noiseWidth + noiseX] * 5; // Adjust the multiplier for desired height

            v.y += height;

            vertices.push(v.x, v.y, v.z);
            uvs.push(x, y);
            map[`${round(v.x, 2)}_${round(v.z, 2)}`] = y;

            if (i < segments && j < segments) {
                // Create indices for two triangles per quad
                let a = i + j * (segments + 1);
                let b = (i + 1) + j * (segments + 1);
                let c = (i + 1) + (j + 1) * (segments + 1);
                let d = i + (j + 1) * (segments + 1);

                // Triangle 1
                indices.push(a, b, d);
                // Triangle 2
                indices.push(b, c, d);
            }
        }
    }

    return { vertices, indices, uvs, map };
  }

  CreateValley(segments, v0, v1, v2, v3) {
      // Initialize arrays to store vertices, indices, and uvs
      let vertices = [];
      let indices = [];
      let uvs = [];

      // Calculate segment size
      const segmentSize = 1 / segments;

      // Create vertices, uvs, and indices
      for (let i = 0; i <= segments; i++) {
          for (let j = 0; j <= segments; j++) {
              // Interpolating between the four corners
              let x = i * segmentSize;
              let y = j * segmentSize;

              let v = new THREE.Vector3();
              v.x = (1 - x) * (1 - y) * v0.x + x * (1 - y) * v1.x + x * y * v2.x + (1 - x) * y * v3.x;
              v.y = (1 - x) * (1 - y) * v0.y + x * (1 - y) * v1.y + x * y * v2.y + (1 - x) * y * v3.y;
              v.z = (1 - x) * (1 - y) * v0.z + x * (1 - y) * v1.z + x * y * v2.z + (1 - x) * y * v3.z;

              // Add height variation to create a valley effect
              let distanceFromCenter = Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5));
              let height = Math.cos(distanceFromCenter * Math.PI * 2) * 0.2; // Adjust height for valley depth
              v.z += height;

              vertices.push(v.x, v.y, v.z);
              uvs.push(x, y);

              if (i < segments && j < segments) {
                  // Create indices for two triangles per quad
                  let a = i + j * (segments + 1);
                  let b = (i + 1) + j * (segments + 1);
                  let c = (i + 1) + (j + 1) * (segments + 1);
                  let d = i + (j + 1) * (segments + 1);

                  // Triangle 1
                  indices.push(a, b, d);
                  // Triangle 2
                  indices.push(b, c, d);
              }
          }
      }

      // Creating the map (optional)
      let map = {
          vertices: vertices,
          indices: indices,
          uvs: uvs
      };

      return { vertices, indices, uvs, map };
  }

MakeFlatishGround(segments, options) {
	let points = this.polygonVertices[this.activePolygonVerticesIndex]

    if (points.length == 4) {
        var v0 = points[0];
        var v1 = points[1];
        var v2 = points[2];
        var v3 = points[3];
     
        var { vertices, indices, uvs, map } = this._MakeVerticesWithRandomHorizontalAdjustments(segments, v0, v1, v2, v3, -.3, .3, options);
        // var { vertices, indices, uvs, map } = this.CreateMeadow(segments, v0, v1, v2, v3)

        var planeGeometry = new THREE.BufferGeometry();
        planeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // Adding UVs to geometry
        planeGeometry.setIndex(indices);
        planeGeometry.computeVertexNormals();
        planeGeometry.computeBoundingBox();

        var material = new THREE.MeshStandardMaterial({ 
        	// color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        	// color: 0xffffff,
          color: Grass[Math.floor(Math.random() * Grass.length)],
        	wireframe: true, 
        	side: THREE.DoubleSide 
        });
        var mesh = new THREE.Mesh(planeGeometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = "touchable::plane";
        mesh.terrain = map;

        var keys = Object.keys(map)[0];
        var xz = keys.split("_").map(Number);
        camera.position.y = 0.5 + map[keys];
        camera.position.x = xz[0];
        camera.position.z = xz[1];
        camera.position.needsUpdate = true;

        ShowBoundingBox(mesh, new THREE.Vector3(
          Math.max(v0.x, v1.x, v2.x, v3.x) - Math.min(v0.x, v1.x, v2.x, v3.x),
          Math.max(v0.y, v1.y, v2.y, v3.y) - Math.min(v0.y, v1.y, v2.y, v3.y),
          Math.max(v0.z, v1.z, v2.z, v3.z) - Math.min(v0.z, v1.z, v2.z, v3.z)
        ))

        level.objects.push({
  	    	type: 'plane',
  	    	points: points,
  	    	imageId: undefined,
  	    	uuid: mesh.uuid
  	    });

        scene.add(mesh);
        scene.grounds.push(mesh);
    }
	}

  /**
   * 
   * What's the difference between having a null floor and not being on ground
   * 
   * and having a null floor and not being on ground and isJumping
   */

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
			<div><pre>      
${to.intersectionPoint.x}
${to.intersectionPoint.y}
${to.intersectionPoint.z}
            </pre></div>
		</div>`).join('')
		
		document.getElementById('intersection-points').innerHTML = `
&nbsp;<button onclick="Save()">Save</button>
<pre>   
  floor: ${camera.floor}
  isJumping: ${camera.isJumping}
  on terrain: ${camera.onTerrain}
  in ocean: ${camera.inOcean}

  <ul>
    <li>x: ${round(camera.position.x, 2)}</li> 
    <li>y: ${round(camera.position.y, 2)}</li> 
    <li>z: ${round(camera.position.z, 2)}</li>

    <li>angle: ${angle}</li>

    <li>velocity: 
      <ul>
        <li>y: ${controller.velocity.y}</li>
      </ul>
    </li>
    <li>Gravity: ${controller.gravity}</li>
  </ul>
  </pre>
		`

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
  gravity = -0.029;
  jumpStrength = .2;
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
  ocean = new Ocean();
  terrain = undefined
  Sky = []
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
  	var isIM = e.srcElement;
  	while (isIM && isIM.id !== 'image-modal') isIM = isIM.parentElement;
  	if (isIM) return;

    var isCanvas = e.srcElement;
    while (isCanvas && isCanvas.id !== 'view') isCanvas = isCanvas.parentElement;
    if (isCanvas) isCanvas = true;

  	this.mouse.x = (e.clientX / page.width) * 2 - 1;
  	this.mouse.y = - (e.clientY / page.height) * 2 + 1;
  	this.raycaster.setFromCamera(this.mouse, camera);


    // ==> *
  	const intersects = this.raycaster.intersectObjects(scene.children, true);

  	// (*)
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

  			} else if (isCanvas) {
  				this.creator.uuid = target.uuid;
  				let top = e.clientY;
  				if (e.clientY + 200 > window.innerHeight) {
  					top -= window.innerHeight - e.clientY + 200;
  				}
  				imageModal.innerHTML = '';
  				imageModal.css({
  					position: 'absolute',
  					top: top + 'px',
  					left: e.clientX + 'px',
  					width: '30vw',
  					height: '25vh',
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
    const key = e.key.toUpperCase();
    if (key == 'W') {
        this.w = true;
    } else if (key == 'A') {
        this.a = true;
    } else if (key == 'S') {
        this.s = true;
    } else if (key == 'D') {
        this.d = true;
    } else if (key == ' ') {
        this.space = true;
        camera.floor = null;
        this.velocity.y = this.jumpStrength;

        camera.isJumping  = true;
        camera.inOcean = false;
        camera.onTerrain = false
    } else if (key == 'ARROWUP') {
        this.ArrowUp = true;
    } else if (key == 'ARROWDOWN') {
        this.ArrowDown = true;
    } else if (key == 'ARROWLEFT') {
        this.ArrowLeft = true;
    } else if (key == 'ARROWRIGHT') {
        this.ArrowRight = true;
    } else if (key == 'T') {
    	display.devGridDots = !display.devGridDots;
    	DevGrid(N, display.devGridDots);
    } else if (key == 'Y') {
    	display.userBoxFrame = !display.userBoxFrame;
    }
  }

  unlisten(e) {
    const key = e.key.toUpperCase();
    if (key == 'W') {
        this.w = false;
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
      camera.rotateX(0.35);
    	active = true;
    }
    if (this.ArrowDown) {
      camera.rotateX(-0.35);
    	active = true;
    }
    if (this.ArrowLeft || this.ArrowRight) {
      let quaternionY = new THREE.Quaternion();
      let quaternionX = new THREE.Quaternion();

      if (this.ArrowLeft) {
        quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.45);
      }

      if (this.ArrowRight) {
        quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.45);
      }

      camera.quaternion.multiplyQuaternions(quaternionY, camera.quaternion);
      active = true;
    }

    camera.position.y += this.velocity.y;
    camera.position.needsUpdate = true;
    this.velocity.y += this.gravity;

    if (this.velocity.y < 0) {
      camera.isJumping = false;
    }

    if (camera.floor !== null) {
      if (camera.position.y <= camera.floor + 0.5) {
        this.velocity.y = 0;
        camera.position.y = camera.floor + 0.5;
      }
    } 

    

    // Example usage when camera falls into ocean (assuming seaLevel is known)
    if (camera.inOcean) {
      var seaLevel = this.ocean.getHeightAtPosition(camera.position.x, camera.position.z);
      camera.floor = seaLevel;
      camera.position.y = seaLevel + 0.35;
      camera.isJumping = false;



    } else if (camera.onTerrain && !camera.isJumping) {
      var closestDist = Infinity;
      var closestY = 0;
      var closestKey = '';
      for (var key in this.terrain) {
        var xz = key.split("_").map(Number);
        let dist = Math.sqrt(Math.pow(xz[0] - camera.position.x, 2) + Math.pow(xz[1] - camera.position.z, 2));
        if (dist < closestDist) {
          closestDist = dist;
          closestY = this.terrain[key];
          closestKey = key;
        }
      }
      closestKey = closestKey.split("_").map(Number);
      camera.floor = closestY;
      camera.position.y = camera.floor + 0.5;
      camera.position.needsUpdate = true;
    }

    this.creator.update()

    if (active && imageModal) imageModal.remove();
  }

	touch() {
      camera.floor = null
      var floorFound = false

	    user.touchedObjects = [];

	    this.wS = 0.5;
	    this.aS = 0.45;
	    this.sS = 0.25;
	    this.dS = 0.25;

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
	        ShowBoundingBox(camera, boxSize)
	    }

	    window.intersects = false;
	    display.userBoxFrame = false;

	    let intersectionPoints = [];

      for (var k = 0; k < scene.grounds.length; k++) {
          var o = scene.grounds[k];

          if (o.name == "touchable::plane") {
              if (!camera.isJumping && cameraBoundingBox.intersectsBox(o.geometry.boundingBox)) {
                console.log("plane at foot")
                  let foot = camera.position.clone();
                  foot.y -= 0.5;
                  var closestDist = Infinity;
                  var closestY = 0;
                  var closestKey = '';
                  for (var key in o.terrain) {
                      var xz = key.split("_").map(Number);
                      let dist = Math.sqrt(Math.pow(xz[0] - camera.position.x, 2) + Math.pow(xz[1] - camera.position.z, 2));
                      if (dist < closestDist) {
                          closestDist = dist;
                          closestY = o.terrain[key];
                          closestKey = key;
                      }
                  }
                  closestKey = closestKey.split("_").map(Number);
                  camera.floor = closestY;
                  floorFound = true
                  camera.floorDiff = Math.abs(camera.position.y - camera.floor);
                  camera.inOcean = false;
                  camera.onTerrain = true;
                  this.terrain = o.terrain
                  camera.onStruct = false;
                  camera.position.y = camera.floor + 0.5;
                  camera.position.needsUpdate = true;
                  controller.creator.update();
              }
          } else if (o.triangle && cameraBoundingBox.intersectsTriangle(o.triangle)) {
              camera.inOcean = false
              camera.onTerrain = false;
              this.terrain = undefined
              camera.onStruct = true;


              display.userBoxFrame = true;
              

              setTimeout(function() { display.userBoxFrame = false }, 300);



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
                          intersectionPoint,
                          center: center.addVectors(o.triangle.a, o.triangle.b).add(o.triangle.c).divideScalar(3)
                      });

                      intersectionPoint.x = Math.round(intersectionPoint.x * 1000) / 1000;
                      intersectionPoint.y = Math.round(intersectionPoint.y * 1000) / 1000;
                      intersectionPoint.z = Math.round(intersectionPoint.z * 1000) / 1000;

                      intersectionPoints.push({ 
                          point: intersectionPoint, 
                          normal: o.triangle.normal 
                      });
                  }
              }
          } else if (o.name == "touchable::ocean") {
              var oceanSurfaceY = this.ocean.getHeightAtPosition(camera.position.x, camera.position.y);
              if (cameraBoundingBox.intersectsBox(o.geometry.boundingBox)) {
                camera.isJumping = false;
                camera.floor = oceanSurfaceY;
                floorFound = true;
                // if (camera.inOcean == false) {
                //   createSplashEffect(o, camera.position.x, camera.position.z, 5); // Adjust ripple radius as needed
                // }
                camera.inOcean = true;
                this.terrain = undefined
                camera.onTerrain = false;
                camera.onStruct = false;
                // Trigger splash effect at camera's position with a specific radius
                  
              }
          }
      }

	    // if (intersectionPoints.length) {
	    //     // Find the most relevant intersection point
	    //     let relevantIntersection = intersectionPoints[0];

	    //     if (Math.abs(relevantIntersection.normal.y) > Math.cos(Math.PI / 3)) {
	    //         let thisYFloor = Math.floor(relevantIntersection.point.y * 1000) / 1000;
	    //         camera.floorDiff = Math.abs(thisYFloor - camera.floor);
	    //         camera.floor = thisYFloor;

	    //         if (camera.floorDiff < 0.5) {
      //               // is this needed
      //               // camera.inOcean = false;
	    //             controller.creator.update();
	    //             camera.position.y = thisYFloor + 0.5;
	    //         }
	    //     } else {
	    //         if (this.w) this.wS = 0.0;
	    //         if (this.a) this.aS = 0.0;
	    //         if (this.s) this.sS = 0.0;
	    //         if (this.d) this.dS = 0.0;
	    //     }
	    // }   
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
		<input type="number" id="gravity" value="${controller.gravity}" /><br/>
		<label>Jump Strength<lavel><input type="number" id="jumpStrength" value="${controller.jumpStrength}" /><br/>
    <label>Wave Strength<lavel><input type="number" id="waveStrength" value="${controller.ocean.amplitude}" /><br/>
	</div>`;

	c.appendChild(createOutside);

	document.getElementById('gravity').addEventListener('change', e => controller.gravity = +e.srcElement.value);

	document.getElementById('jumpStrength').addEventListener('change', e => controller.jumpStrength = +e.srcElement.value);

  document.getElementById('waveStrength').addEventListener('change', e => controller.ocean.amplitude = +e.srcElement.value);


	var candidatePoints = document.createElement('section');
	candidatePoints.classList.add('page');
	candidatePoints.classList.add('active');
	candidatePoints.classList.add('generate-polygon');
	candidatePoints.innerHTML = `<div id="touch">
	<pre id="intersection-points"></pre>
		<div class="header"><div>name</div><div>center</div><div>intersection point</div></div>
		<div id="touched-objects">${
			user.touchedObjects.map(to => `<div class="row"><div>${to.name}</div><div>${JSON.stringify(to.center, null, 1)}</div><div></div></div>`).join('')
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
        <button class="generate-polygon" data-function="GenerateRandomFrankLloydWrightEdifice">Frank Lloyd Wright</button>
        <button class="generate-polygon" data-function="GenerateRandomLeCorbusierEdifice">Le Corbusier</button>
        <button class="generate-polygon" data-function="GenerateRandomZahaHadidEdifice">Zaha Hadid</button>
        <button class="generate-polygon" data-function="GenerateRandomMiesVanDerRoheEdifice">Ludwig Mies van der Rohe</button>
        <button class="generate-polygon" data-function="GenerateRandomFrankGehryEdifice">Frank Gehry</button>
        <button class="generate-polygon" data-function="GenerateRandomIMPeiEdifice">I. M. Pei</button>
        <button class="generate-polygon" data-function="GenerateRandomTadaoAndoEdifice">Tadao Ando</button>
        <button class="generate-polygon" data-function="GenerateRandomRenzoPianoEdifice">Renzo Piano</button>
        <button class="generate-polygon" data-function="GenerateRandomNormanFosterEdifice">Norman Foster</button>
        <button class="generate-polygon" data-function="GenerateRandomSantiagoCalatravaEdifice">Santiago Calatrava</button>
        <button class="generate-polygon" data-function="GenerateRandomOscarNiemeyerEdifice">Oscar Niemeyer</button>
        <button class="generate-polygon" data-function="GenerateRandomEeroSaarinenEdifice">Eero Saarinen</button>
        <button class="generate-polygon" data-function="GenerateRandomRichardMeierEdifice">Richard Meier</button>
			</div>`;

		document.getElementById('add-polygon-row').insertAdjacentElement('beforebegin', pg);

    pg.querySelectorAll('.generate-polygon').forEach(function(button) {
      button.addEventListener('click', () => {
        const functionName = button.getAttribute('data-function');
        if (controller.creator.buildings[functionName]) {
            const centroid = controller.creator.polygonVertices[controller.creator.activePolygonVerticesIndex][0];
            const ceilingHeight = 7;
            const levels = 3;
            const withBasement = false;
            var buildingMesh = controller.creator.buildings[functionName](centroid, ceilingHeight, levels, withBasement);
            buildingMesh.position.set(centroid.x, centroid.y, centroid.z)
            scene.add(buildingMesh);
        } else {
            console.error(`Function ${functionName} not found in controller.creator`);
        }
      });
    });

		pg.querySelectorAll('.point-group').forEach(function(pre) {
      pre.addEventListener('click', function(event) {
         controller.creator.selectPointGroup(event)
      });
    })

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

window.controller = Control()

var splashDuration = 15000; // Number of frames or time steps for the splash effect
var splashFrameCount = 0;

function createSplashEffect(ocean, centerX, centerZ, rippleRadius) {
  camera.isSplashing = true;
  var intervalId = setInterval(splash, 1);
  function splash() {
    var positions = ocean.geometry.attributes.position;
    var center = new THREE.Vector2(centerX, centerZ);

    
    for (var i = 0; i < positions.count; i++) {
      var vertexX = positions.getX(i);
      var vertexZ = positions.getZ(i);
      var vertex = new THREE.Vector2(vertexX, vertexZ);
      var distance = center.distanceTo(vertex);

      if (distance <= rippleRadius) {
        var displacement = Math.sin((distance / rippleRadius) * Math.PI) * 1; // Adjust amplitude

        // Apply displacement to vertex position
        positions.setY(i, positions.getY(i) + displacement);
      }
    }


    ocean.geometry.attributes.position.needsUpdate = true;
    splashFrameCount++;

    if (splashFrameCount >= splashDuration) {
      splashFrameCount = 0;
      clearInterval(intervalId);
    }
  }
}



/********|•|***|•|***|•|********/
/********|•|***|•|***|•|********/
/********|•|***|•|***|•|********/
/********|•|***|•|***|•|********/
/********|•|***|•|***|•|********/
/********|•|***|•|***|•|********/
window.devGridDots = [];
var orbitRadius = sceneRadius * 0.88
var domeheight = (sceneRadius * 0.88) / 2
function DevGrid(radius, display) {
	window.devGridDots.forEach(function(dgd) {
		scene.remove(dgd);
		dgd.geometry.dispose();
		dgd.material.dispose();
	});
	window.devGridDots = [];
	if (display) {
		var gridstep = 1
    for (var x = -radius; x < radius; x += gridstep) {
        for (var y = 0; y < P; y += gridstep) {
            for (var z = -radius; z < radius; z += gridstep) {
            	let _x = Math.round(x * 100) / 100; 
            	let _y = Math.round(y * 100) / 100;
            	let _z = Math.round(z * 100) / 100;
                var dot = new THREE.Mesh(
                    new THREE.SphereGeometry(.1, 11, 11),
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
                
                if (x % 2 == 0 && z % 2 !== 0) scene.add(dot);
                devGridDots.push(dot);
            }
        }
    }
	}
}

function Sun() {

  var pointLight = new THREE.DirectionalLight(0xfffefe, 3);
 
  pointLight.castShadow = true;
  var halfSize = sceneRadius * 2;
  pointLight.shadow.camera.left = -halfSize;
  pointLight.shadow.camera.right = halfSize;
  pointLight.shadow.camera.top = sceneRadius;
  pointLight.shadow.camera.bottom = -sceneRadius;


  level.sunlight = pointLight;
  level.sunlight.position.set(0, 20, 0)
  // level.dome = createDome();

  scene.add(pointLight);


  level.sun = new THREE.Mesh(
      new THREE.SphereGeometry(18.5, 100, 100),
      new THREE.MeshBasicMaterial({ color: 0xfffefe })
  );

  level.sun.position.copy(level.sunlight.position);
  // moveTo(level.sun, origin, 50);
  //

  for (var i = 0; i < 1000; i++) {
    var y = randomInRange(sceneRadius, sceneRadius * 3);
    var x = randomInRange(-sceneRadius * 10, sceneRadius * 10)
    var z = randomInRange(-sceneRadius * 10, sceneRadius * 10)


    if (x < sceneRadius && x > -sceneRadius && z < sceneRadius && z > -sceneRadius) {
      y = randomInRange(-100, -50)
    }
    var radius = new THREE.Vector3(x,y,z).distanceTo(origin.position) / (sceneRadius * 3) * randomInRange(1.1, 1.35)
    var star = new THREE.Mesh(new THREE.SphereGeometry(radius, 5, 5), new THREE.MeshBasicMaterial({color:0xffffff}));
    star.position.set(x,y,z)
    
    var dist = star.position.distanceTo(origin.position)
    if (dist > sceneRadius * 2) scene.add(star);
    
  }

  var starLight = new THREE.AmbientLight(0xffffff, .3);
  starLight.position.set(0, 500, 0);
  scene.add(starLight);

  // add one vector in the direction of 0 0 0

	scene.add(level.sun)
}
let cloudParticles = [];

function createSky() {
  const sceneRadius = 1000; // Define scene radius for cloud distribution

  // Create cumulonimbus cloud particles
  for (let i = 0; i < 12; i++) {
    const cloudNodeCount = randomInRange(100, 300); // More particles for cumulonimbus clouds
    const positions = new Float32Array(cloudNodeCount * 3);

    for (let j = 0; j < cloudNodeCount; j++) {
      const x = randomInRange(-50, 50);
      const y = randomInRange(0, 200); // Taller cloud structure
      const z = randomInRange(-50, 50);

      positions[j * 3] = x;
      positions[j * 3 + 1] = y;
      positions[j * 3 + 2] = z;
    }

    const cloudGeometry = new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const cloudMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: randomInRange(20, 100), 
      transparent: true, 
      opacity: 0.8 
    });
    const cloud = new THREE.Points(cloudGeometry, cloudMaterial);
    cloud.castShadow = true;
    cloud.receiveShadow = true;
    cloud.position.set(
      randomInRange(-sceneRadius, sceneRadius),
      randomInRange(50, 200), // Clouds height range
      randomInRange(-sceneRadius, sceneRadius)
    );
    scene.add(cloud);
    cloudParticles.push(cloud);
  }
}





function animateClouds() {
  const cloudSpeed = 1.1; // Adjust the speed as needed
  cloudParticles.forEach(cloud => {
    cloud.position.x += cloudSpeed;
    if (cloud.position.x > sceneRadius) {
      cloud.position.x = -sceneRadius; // Wrap around to the other side
    }
  });
}

function createDome() {
  var gridSize = 100;
  var planeSize = 120; // Adjust this size to your preference
  var radius = sceneRadius * 2; // Adjust this radius for the dome's curvature

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
        color: "white",
        transparent: true,
        opacity: phi > Math.PI ? 0 : 0.5,
        side: THREE.DoubleSide
      });

      var plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.position.set(x, y - sceneRadius * .6, z);
      plane.lookAt(camera.position.x, camera.position.y, camera.position.z);
      // plane.rotation.z = randomInRange(0, Math.PI * 2)

      controller.Sky.push(plane);
      scene.add(plane);
    }
  }
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
	// DevGrid(N, display.devGridDots);
	Sun();
  // createDome()
  // createSky()

  // controller.creator.MakeOcean();

  controller.creator.polygonVertices = [
      [
          { x: -D, y: .1, z: D },
          { x: D, y: 0.1, z: D },
          { x: D, y: 0.1, z: -D },
          { x: -D, y: 0.1, z: -D }
      ]
  ];
  controller.creator.activePolygonVerticesIndex = 0;
  controller.creator.MakeFlatishGround(sceneRadius * 2, { 
    withTrees: true,
    slightBay: true
  });
  controller.creator.activePolygonVerticesIndex = -1;
  controller.creator.polygonVertices = []
  // camera.inOcean = true;

  camera.lookAt(level.sun.position)
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

var count = 1000;
var angle = 0;
var sr = sceneRadius * 2
var day = sceneRadius * .6

function Animate() {
  window.requestAnimationFrame(Animate);

  window.angle = angle;

  controller.activate();
  controller.touch();

  animateClouds()

  // Update sun position based on current angle
  var x = sr * Math.cos(angle);
  var y = sr * Math.sin(angle);
  y -= sceneRadius * .6
  level.sun.position.set(x, y, level.sun.position.z);
  level.sunlight.position.set(x, y, level.sun.position.z);
  level.sunlight.lookAt(0, 0, 0)

  for (var i = 0; i < controller.Sky.length; i++) {
      var distanceToSun = controller.Sky[i].position.distanceTo(level.sun.position);

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
      controller.Sky[i].material.color.copy(color);
      controller.Sky[i].material.needsUpdate = true; // Ensure material update
      // Optionally, adjust material opacity based on intensity for a smoother transition
        
      if (level.sun.position.y > 0) {
        controller.Sky[i].material.opacity = 1
      } else if (distanceToSun > day) {
        controller.Sky[i].material.opacity = intensity * .13;
      }
      // if (distanceToSun > maxDistance) controller.Sky[i].material.opacity = Math.sqrt(opacity, 3);
      // controller.Sky[i].lookAt(camera.position.x, camera.position.y, camera.position.z);
  }

  // Update camera position or controls
  renderer.render(scene, camera);

  if (level.sun.position.y > 0) {
    angle += .003;
  } else {
    angle += .03 * .6;
  }
  
  if (angle > Math.PI * 2) {
    angle = 0;
  }

}



function loadTags() {
	xhr({
		method: "GET",
		url: "/image-tags",
		load: function() {
			var tags = JSON.parse(this.response);
			imageModal.innerHTML = `
			<div class="breadcrumbs">tags</div>
			<div class="tag-grid">
				${
					tags.map(tag => `<button class="tag" data-tag="${tag.name}">(${tag.countOf}) ${tag.name}</button>`).join('')
				}
			</div>
			`;
			document.querySelectorAll('.tag').forEach(function(button) {
				button.addEventListener('click', function() {
					var tag = this.dataset.tag;
					loadImages(tag);
				});
			})
		}
	})
}

window.loadTags = loadTags;

function loadImages(tag) {
	xhr({
		method: "GET",
		url: "/images?tag=" + tag,
		load: function() {
			var tagIds = JSON.parse(this.response);
			imageModal.innerHTML = `
				<div class="breadcrumbs">
					<button onclick="loadTags()">tags</button> > <span>${tag}</span>
				</div>
				<div class="image-grid" data-tag="${tag}">
					${
						tagIds.map(id => `<div style="background:url(/image?id=${id})" data-id="${id}" onclick="applyImage(event)"></div>`).join('')
					}
				</div>`;
			document.querySelectorAll('.tag').forEach(function(button) {
				button.addEventListener('click', function() {
					var tag = this.dataset.id;
					loadImages(tag);
				});
			})
		}
	})
}

window.applyImage = function(event) {
	let imageId = event.srcElement.dataset.id;
	let texture = new THREE.TextureLoader().load("/image?id=" + imageId);
	// texture.wrapS = THREE.RepeatWrapping;
  // texture.wrapT = THREE.RepeatWrapping;
  // texture.repeat.set(5, 5);
	console.log(texture)
	for (var i = 0; i < scene.children.length; i++) {
		if (scene.children[i].uuid == controller.creator.uuid) {
			scene.children[i].material.map = texture;
			scene.children[i].material.needsUpdate = true;
			scene.children[i].material.wireframe = false;
			scene.children[i].material.color.set('white');
		}
	}
	for (var i = 0; i < level.objects.length; i++) {
		if (level.objects[i].uuid == controller.creator.uuid) {
			level.objects[i].imageId = imageId;
		}
	}
}