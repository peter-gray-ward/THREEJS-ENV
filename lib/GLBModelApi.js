export class GLBModelApi {
    constructor(model) {
        this.model = model;

        // Cache references to key parts of the hierarchy for quicker access
        this.hips = this.getObjectByName('mixamorigHips');
        this.spine = this.getObjectByName('mixamorigSpine');
        this.leftShoulder = this.getObjectByName('mixamorigLeftShoulder');
        this.rightShoulder = this.getObjectByName('mixamorigRightShoulder');
        this.leftArm = this.getObjectByName('mixamorigLeftArm');
        this.rightArm = this.getObjectByName('mixamorigRightArm');
        this.leftHand = this.getObjectByName('mixamorigLeftHand');
        this.rightHand = this.getObjectByName('mixamorigRightHand');
        this.leftLeg = this.getObjectByName('mixamorigLeftLeg');
        this.rightLeg = this.getObjectByName('mixamorigRightLeg');
        this.leftFoot = this.getObjectByName('mixamorigLeftFoot');
        this.rightFoot = this.getObjectByName('mixamorigRightFoot');
        // Add other parts as needed
    }

	getObjectByName(name) {
	    function Traverse(name, node) {
	        // Check if the current node's name matches the target name
	        if (node.name === name) {
	            return node;
	        }

	        // If the node has children, recursively search each child
	        if (node.children) {
		        for (let child of node.children) {
		            const found = Traverse(name, child);
		            if (found) {
		                return found; // Return immediately if found
		            }
		        }
		    }

	        // If the object isn't found in this branch, return null
	        return null;
	    }

	    // Start the traversal from the root node (this.model)
	    return Traverse(name, this.model.scene);
	}


    // Rotate hips
    rotateHips(rotation) {
        if (this.hips) {
            this.hips.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Bend spine
    bendSpine(rotation) {
        if (this.spine) {
            this.spine.rotation.x += rotation.x;
            this.spine.rotation.y += rotation.y;
            this.spine.rotation.z += rotation.z;
        }
    }

    // Rotate shoulders
    rotateLeftShoulder(rotation) {
        if (this.leftShoulder) {
            this.leftShoulder.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightShoulder(rotation) {
        if (this.rightShoulder) {
            this.rightShoulder.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Rotate arms
    rotateLeftArm(rotation) {
        if (this.leftArm) {
            this.leftArm.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightArm(rotation) {
        if (this.rightArm) {
            this.rightArm.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Rotate hands
    rotateLeftHand(rotation) {
        if (this.leftHand) {
            this.leftHand.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightHand(rotation) {
        if (this.rightHand) {
            this.rightHand.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Translate hand positions
    translateLeftHand(position) {
        if (this.leftHand) {
            this.leftHand.position.set(position.x, position.y, position.z);
        }
    }

    translateRightHand(position) {
        if (this.rightHand) {
            this.rightHand.position.set(position.x, position.y, position.z);
        }
    }

    // Bend waist (hips)
    bendWaist(rotation) {
        if (this.hips) {
            this.hips.rotation.x += rotation.x;
            this.hips.rotation.y += rotation.y;
            this.hips.rotation.z += rotation.z;
        }
    }

    // Rotate legs
    rotateLeftLeg(rotation) {
        if (this.leftLeg) {
            this.leftLeg.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightLeg(rotation) {
        if (this.rightLeg) {
            this.rightLeg.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Rotate feet
    rotateLeftFoot(rotation) {
        if (this.leftFoot) {
            this.leftFoot.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightFoot(rotation) {
        if (this.rightFoot) {
            this.rightFoot.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    // Example of additional fine-grained control
    rotateLeftHandFinger(fingerName, rotation) {
        const finger = this.model.getObjectByName(`mixamorigLeftHand${fingerName}`);
        if (finger) {
            finger.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }

    rotateRightHandFinger(fingerName, rotation) {
        const finger = this.model.getObjectByName(`mixamorigRightHand${fingerName}`);
        if (finger) {
            finger.rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }
}