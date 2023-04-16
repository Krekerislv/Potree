import * as THREE from "../three.js/build/three.module.js";
import "../Socket.IO/socket.io.min.js";


//====================================CLASS SideBar====================================
export class SideBarCloudSplit {
   #initFlagPlanes = false;
   #allowPlaneSelect = true;
   #invisPlaneXY;
   #invisPlaneXZ;
   #invisPlaneYZ;

   #metadata;
   #planes = [];
   #tempPlane;
   #planeChoice;
   #cloudPathChange = false;
   
   #raycaster = new THREE.Raycaster();
   #mouseMovement = new THREE.Vector2();

   #selectedPlane;
   #allowSelectedPlanePlace = true;

   #cloudPath;
   #btnAddPlane;
   #btnDeletePlane;
   #btnSplit;
   #planeChoiceRadioXY;
   #planeChoiceRadioXZ;
   #planeChoiceRadioYZ;
   #coordInput;
   #planeList;
   #PotreeRenderArea;
   #hidDwnldBtn;
   #btnViewSplitCloud;
   #btnDwnldSplitCloud;
   #btnClear;
   #prepareAnim;
   #genericRepeater;
   #dwnldLink;
   socket = io();

    constructor(cloudPath, btnAddPlane, btnDeletePlane, btnSplit, planeChoiceRadioXY, planeChoiceRadioXZ,
	planeChoiceRadioYZ, coordInput, planeList, PotreeRenderArea, hidDwnldBtn, prepareAnim,
	btnViewSplitCloud, btnDwnldSplitCloud, btnClear) {
        this.#cloudPath = cloudPath;
        this.#btnAddPlane = btnAddPlane;
        this.#btnDeletePlane = btnDeletePlane;
        this.#btnSplit = btnSplit;
        this.#planeChoiceRadioXY = planeChoiceRadioXY;
        this.#planeChoiceRadioXZ = planeChoiceRadioXZ;
        this.#planeChoiceRadioYZ = planeChoiceRadioYZ;
        this.#coordInput = coordInput;
        this.#planeList = planeList;
        this.#PotreeRenderArea = PotreeRenderArea;
        this.#hidDwnldBtn = hidDwnldBtn;
        this.#prepareAnim = prepareAnim;
		this.#btnViewSplitCloud = btnViewSplitCloud;
		this.#btnDwnldSplitCloud = btnDwnldSplitCloud;
		this.#btnClear = btnClear;

        //Methods
        this.getSplitAxis = this.getSplitAxis.bind(this);
        this.getPlaneChoice = this.getPlaneChoice.bind(this);
        this.getSplitAxisPos = this.getSplitAxisPos.bind(this);
        this.setPlaneChoice = this.setPlaneChoice.bind(this);
		this.lockDwnldBtn = this.lockDwnldBtn.bind(this);
		this.unlockDwnldBtn = this.unlockDwnldBtn.bind(this);
        this.lockPlaneChoice = this.lockPlaneChoice.bind(this);
        this.lockSplitCloudBtn = this.lockSplitCloudBtn.bind(this);
        this.unlockSplitCloudBtn = this.unlockSplitCloudBtn.bind(this);
        this.unlockPlaneChoice = this.unlockPlaneChoice.bind(this);
        this.toggleCoordFieldLock = this.toggleCoordFieldLock.bind(this);
        this.unlockAddBtn = this.unlockAddBtn.bind(this);
        this.lockAddBtn = this.lockAddBtn.bind(this);
        this.initCoordField = this.initCoordField.bind(this);
        this.orderPlaneList = this.orderPlaneList.bind(this);
        this.updatePlaneList = this.updatePlaneList.bind(this);
        this.initListeners = this.initListeners.bind(this);

        this.addPlane = this.addPlane.bind(this);
        this.deletePlane = this.deletePlane.bind(this);

        this.toggleSelectPlane = this.toggleSelectPlane.bind(this);
        this.mouseChange = this.mouseChange.bind(this);
        this.dragPlane = this.dragPlane.bind(this);

        this.initInvisiblePlanes = this.initInvisiblePlanes.bind(this);

        this.splitCloud = this.splitCloud.bind(this);
        this.clearAll = this.clearAll.bind(this);
		this.downloadCloud = this.downloadCloud.bind(this);

		this.togglePrepareAnim = this.togglePrepareAnim.bind(this);
    }

    setCloudPath(cloudPath) {
        this.#cloudPath = cloudPath;
        this.#cloudPathChange = true;
    }

    getPlanes() {
        return this.#planes;
    }

    getSplitAxis(){
        if (this.#planeChoice == "XY") return "Z";
        if (this.#planeChoice == "XZ") return "Y";
        if (this.#planeChoice == "YZ") return "X";
    }
    
    getPlaneChoice() {
        return this.#planeChoice;
    }

    getSplitAxisPos(plane) {
        if (this.getSplitAxis() == "X") return plane.position.x;
        if (this.getSplitAxis() == "Y") return plane.position.y;
        if (this.getSplitAxis() == "Z") return plane.position.z;
    }

    setPlaneChoice() {
        this.#planeChoice = document.querySelector('input[name="planeChoice"]:checked').value;
        this.initCoordField();
        this.unlockAddBtn();
    }
	lockDwnldBtn() {
		document.getElementById("btnDwnldCloud_btn").disabled = true;
	}
	unlockDwnldBtn() {
		document.getElementById("btnDwnldCloud_btn").disabled = false;
	}
    lockPlaneChoice() {
        this.#planeChoiceRadioXY.disabled = true;
        this.#planeChoiceRadioXZ.disabled = true;
        this.#planeChoiceRadioYZ.disabled = true;
    }
    lockSplitCloudBtn() {
        this.#btnSplit.disabled = true;
    }
    unlockSplitCloudBtn() {
        this.#btnSplit.disabled = false;
    }

    unlockPlaneChoice() {
        this.#planeChoiceRadioXY.disabled = false;
        this.#planeChoiceRadioXZ.disabled = false;
        this.#planeChoiceRadioYZ.disabled = false;
    }
    toggleCoordFieldLock() {
        this.#coordInput.readOnly = !this.#coordInput.readOnly;
    }

    unlockAddBtn() {
        this.#btnAddPlane.disabled = false;
    }
    lockAddBtn() {
        this.#btnAddPlane.disabled = true;
    }

    unlockDelBtn() {
        this.#btnDeletePlane.disabled = false;
    }
    lockDelBtn() {
        this.#btnDeletePlane.disabled = true;
    }

    async initCoordField() {
        if (this.#metadata == null || this.#cloudPathChange) {
            let response = await fetch(this.#cloudPath);
            this.#metadata = await response.json();
            this.#cloudPathChange = false;
        }


        this.#coordInput.style.display = "inline";
        this.#coordInput.style.width = "30%";
        this.#coordInput.readOnly = false;
        
        let tmp;
        if (this.#planeChoice == "XY"){
            tmp = 'Z: ';
            this.#coordInput.value = Math.round( ( (this.#metadata.attributes[0].min[2] + this.#metadata.attributes[0].max[2])/2) *100 ) /100;
        }
        if (this.#planeChoice == "XZ") {
            tmp = 'Y: ';
            this.#coordInput.value = Math.round( ( (this.#metadata.attributes[0].min[1] + this.#metadata.attributes[0].max[1])/2) *100 ) /100;
        }
        if (this.#planeChoice == "YZ"){
            tmp = 'X: ';
        
            this.#coordInput.value = Math.round( ( (this.#metadata.attributes[0].min[0] + this.#metadata.attributes[0].max[0])/2) *100 ) /100;
        }

        document.getElementById("coordLabel").innerHTML = tmp;

        if (this.#tempPlane != null){
            viewer.scene.scene.remove(this.#tempPlane);
            this.#tempPlane = null;
        }
    }
    orderPlaneList() {
        if (this.getSplitAxis() == "X") this.#planes.sort(function(a, b){return a.position.x - b.position.x});
        if (this.getSplitAxis() == "Y") this.#planes.sort(function(a, b){return a.position.y - b.position.y});
        if (this.getSplitAxis() == "Z") this.#planes.sort(function(a, b){return a.position.z - b.position.z});
    }
    updatePlaneList() {
        this.orderPlaneList();

        this.#planeList.innerHTML = ""; //notīra
        for (let i=0; i<this.#planes.length; i++) {
            let pos = Math.round(this.getSplitAxisPos(this.#planes[i])*100)/100;
            if (Number.isInteger(pos)) pos = pos + ".00"; //thank u, javascript
            this.#planeList.innerHTML += '<li id="planeList' + i + '"> Plane ' + i + '&emsp;' + this.getSplitAxis() + ': ' + pos + '</li>';// + '&emsp;<button name='+n+' id="btnDelPlaneList' + n + '">Delete</button> </li>';
        }
    }

    toggleSelectPlane(event) {
        if (!this.#allowPlaneSelect) {
            return;
        }
        if (this.#selectedPlane) { //ja objekts jau ir atlasīts, tad, nospiežot peli, tas tiek atmests
            if (!this.#allowSelectedPlanePlace) {
				var n = 0;
				var repeater = setInterval( () => {
					if (this.#selectedPlane.material.color.getHexString() == "ffff00" ){
						this.#selectedPlane.material.color.setHex(0xff0000);
					} else {
						this.#selectedPlane.material.color.setHex(0xffff00);
					}
					n++;
					if (n > 3) clearInterval(repeater);
				}, 100);
			
				console.log("Can't add plane at the edge of cloud");

			} else {
				this.#coordInput.readOnly = false;
				this.#selectedPlane.material.color.setHex(0xff2b2b);
				this.#selectedPlane = null;
				//selectedForMove = false;
				this.lockDelBtn();
			}
			return;
        }
        
    
        //render area ir atkarīgs no tā, vai ir aktivizēts sidebar
        let sidebarWidth;
        if (this.#PotreeRenderArea.style.left == "0px") { //sidebar nav aktivizēts
            sidebarWidth = 0;
        } else {
            sidebarWidth = document.getElementById("potree_menu").offsetWidth; //jeb 300px
        }
        const pointer = new THREE.Vector2();
        pointer.x = ( (event.clientX - sidebarWidth) / this.#PotreeRenderArea.offsetWidth ) * 2 - 1;
        pointer.y = - ( event.clientY / this.#PotreeRenderArea.offsetHeight) * 2 + 1;
    
        this.#raycaster.setFromCamera(pointer, viewer.scene.getActiveCamera());
    
        const found = this.#raycaster.intersectObjects(this.#planes);

        if ((found.length > 0) && found[0].object.userData.draggable) {
            this.unlockDelBtn();
            this.#coordInput.readOnly = true;
            this.#selectedPlane  = found[0].object;
            this.#selectedPlane.material.color.setHex(0xffff00);
        } 
    }

    mouseChange(event) {
        let sidebarWidth; //if else izgūts no Potree.js jeb source faila
        if (this.#PotreeRenderArea.style.left == "0px") { //sidebar nav aktivizēts
            sidebarWidth = 0;
        } else {
            sidebarWidth = document.getElementById("potree_menu").offsetWidth;
        }
    
    
        this.#mouseMovement.x = ( (event.clientX - sidebarWidth) / this.#PotreeRenderArea.offsetWidth ) * 2 - 1;
	    this.#mouseMovement.y = - ( event.clientY / this.#PotreeRenderArea.offsetHeight) * 2 + 1;
        this.dragPlane();
    }

    dragPlane() {
        if (this.#selectedPlane == null) {
            return; //no plane selected
        }
        //metada is already set
        let minX, maxX, minY, maxY, minZ, maxZ;
        minX = this.#metadata.attributes[0].min[0];
        minY = this.#metadata.attributes[0].min[1];
        minZ = this.#metadata.attributes[0].min[2];
        maxX = this.#metadata.attributes[0].max[0];
        maxY = this.#metadata.attributes[0].max[1];
        maxZ = this.#metadata.attributes[0].max[2];

        this.#raycaster.setFromCamera(this.#mouseMovement, viewer.scene.getActiveCamera());
        let tempArr = [];
        tempArr.push(this.#invisPlaneXY);
        tempArr.push(this.#invisPlaneXZ);
        tempArr.push(this.#invisPlaneYZ);
        const found = this.#raycaster.intersectObjects(tempArr, true);
        if (found.length > 0) {
            for (let i =0; i<found.length; i++) {

                if (this.getSplitAxis() == "X" && ((found[i].object.userData.type == "XY"))) {// || (found[i].object.userData.type == "XZ") )){
                    let flagA = (found[i].point.x <= maxX);
                    let flagB = (found[i].point.x >= minX);
                    if (flagA && flagB) {
                        this.#selectedPlane.position.x = found[i].point.x;    
                    } else if (!flagA) {
                        this.#selectedPlane.position.x = maxX;
                    } else if (!flagB) {
                        this.#selectedPlane.position.x = minX;
                    }
                    this.#coordInput.value = Math.round(this.#selectedPlane.position.x*100)/100;
                }
                
                if (this.getSplitAxis() == "Y" && ((found[i].object.userData.type == "XY"))) {// ||  (found[i].object.userData.type == "YZ"))){
                    let flagA = (found[i].point.y <= maxY);
                    let flagB = (found[i].point.y >= minY);
                    if (flagA && flagB) {
                        this.#selectedPlane.position.y = found[i].point.y;    
                    } else if (!flagA) {
                        this.#selectedPlane.position.y = maxY;
                    } else if (!flagB) {
                        this.#selectedPlane.position.y = minY;
                    }
                    this.#coordInput.value = Math.round(this.#selectedPlane.position.y*100)/100;
                }

                if ((this.getSplitAxis() == "Z") && ((found[i].object.userData.type == "YZ"))) {// || (found[i].object.userData.type == "XZ") ) ) {
                    let flagA = (found[i].point.z <= maxZ);
                    let flagB = (found[i].point.z >= minZ);
                    if (flagA && flagB) {
                        this.#selectedPlane.position.z = found[i].point.z;    
                    } else if (!flagA) {
                        this.#selectedPlane.position.z = maxZ;
                    } else if (!flagB) {
                        this.#selectedPlane.position.z = minZ;
                    }
                    this.#coordInput.value = Math.round(this.#selectedPlane.position.z*100)/100;
                }
                
            }

			//prevent planes being added at the edge of cloud
			if (this.getSplitAxis() == "X") {
				let X = this.#selectedPlane.position.x;
				if (X >= maxX || X <= minX) {
					this.#allowSelectedPlanePlace = false;
				} else {
					this.#allowSelectedPlanePlace = true;
				}
			}
			if (this.getSplitAxis() == "Y") {
				let Y = this.#selectedPlane.position.y;
				if (Y >= maxY || Y <= minY) {
					this.#allowSelectedPlanePlace = false;
				} else {
					this.#allowSelectedPlanePlace = true;
				}
			}
			if (this.getSplitAxis() == "Z") {
				let Z = this.#selectedPlane.position.z;
				if (Z >= maxZ || Z <= minZ) {
					this.#allowSelectedPlanePlace = false;
				} else {
					this.#allowSelectedPlanePlace = true;
				}
			}

        }


        this.updatePlaneList();
    }

    async addPlane() {
        this.lockPlaneChoice();
        this.unlockSplitCloudBtn();
		this.#btnClear.disabled = false;
        if (!this.#initFlagPlanes) {
            this.initInvisiblePlanes();
            this.#initFlagPlanes = true;
        }


        //since its possible that a different cloud has been selected:
        if (this.#metadata == null || this.#cloudPathChange) {
            let response = await fetch(this.#cloudPath);
            this.#metadata = await response.json();
            this.#cloudPathChange = false;
        }
        

        let minX, maxX, minY, maxY, minZ, maxZ;
        minX = this.#metadata.attributes[0].min[0];
        minY = this.#metadata.attributes[0].min[1];
        minZ = this.#metadata.attributes[0].min[2];
        maxX = this.#metadata.attributes[0].max[0];
        maxY = this.#metadata.attributes[0].max[1];
        maxZ = this.#metadata.attributes[0].max[2];
    
    
        let material = new THREE.MeshBasicMaterial( {color: 0xff2b2b, transparent:true,opacity: .7, side:THREE.DoubleSide} );
    
    
        let X, Y, Z;
        let geometry;
        let rotation;
		let addFlag = true;
    
        if (this.#planeChoice == "XY") {
            X = (minX + maxX) / 2;
            Y = (minY + maxY) / 2;
            Z = parseFloat(this.#coordInput.value);
            geometry = new THREE.PlaneGeometry( maxX-minX, maxY-minY );
            rotation = new THREE.Vector3(0,0,0);
			if (Z >= maxZ || Z <= minZ) addFlag = false;
        } else if (this.#planeChoice == "XZ") {
            X = (minX + maxX) / 2;
            Y = parseFloat(this.#coordInput.value);
            Z = (minZ + maxZ) / 2;
            geometry = new THREE.PlaneGeometry( maxX-minX, maxZ-minZ );
            rotation = new THREE.Vector3(Math.PI / 2, 0, 0);
			if (Y >= maxY || Y <= minY) addFlag = false;
        } else if (this.#planeChoice == "YZ") {
            X = parseFloat(this.#coordInput.value);
            Y = (minY + maxY) / 2;
            Z = (minZ + maxZ) / 2;
            geometry = new THREE.PlaneGeometry( maxZ-minZ, maxY-minY );;
            rotation = new THREE.Vector3(0, Math.PI / 2, 0);

			if (X >= maxX || X <= minX) addFlag = false;

        }
		if (addFlag) { //prevents planes from being added at the very end
			this.#tempPlane = new THREE.Mesh( geometry, material );
			this.#tempPlane.position.set(X, Y, Z);
			this.#tempPlane.rotation.set(rotation.x, rotation.y, rotation.z);
			viewer.scene.scene.add(this.#tempPlane);
		
			this.#tempPlane.userData.draggable = true;

			this.#planes.push(this.#tempPlane);


			this.updatePlaneList();
		} else {
			alert("Can't add plane at the edge of cloud");
		}
    }

    deletePlane() {
        this.lockDelBtn();
        viewer.scene.scene.remove(this.#selectedPlane);
        //remove object from #planes[]
        this.#planes[this.#planes.indexOf(this.#selectedPlane)] = undefined;

        this.orderPlaneList(); //undefined element will be last in array
        this.#planes.pop(); //therefore it can be popped
        this.updatePlaneList();
        if (this.#planes.length == 0) {
            this.unlockPlaneChoice();
            this.lockSplitCloudBtn();
			this.#btnClear.disabled = true;
        }
    }

    async initInvisiblePlanes() {
    
        let minX, maxX, minY, maxY, minZ, maxZ;
        minX = this.#metadata.attributes[0].min[0];
        minY = this.#metadata.attributes[0].min[1];
        minZ = this.#metadata.attributes[0].min[2];
        maxX = this.#metadata.attributes[0].max[0];
        maxY = this.#metadata.attributes[0].max[1];
        maxZ = this.#metadata.attributes[0].max[2];
        
        let material = new THREE.MeshBasicMaterial( {side:THREE.DoubleSide} );
        let X, Y, Z;
        let geometry;
        let rotation;
        let k = 1000; //cik reizes neredzamās plaknes ir lielākas par mākoni
    
        X = (minX + maxX) / 2;
        Y = (minY + maxY) / 2;
        Z = (minZ + maxZ) / 2;
    
        //XY plane:
        geometry = new THREE.PlaneGeometry( k*(maxX-minX), k*(maxY-minY) );
        this.#invisPlaneXY = new THREE.Mesh( geometry, material );
        this.#invisPlaneXY.position.set(X, Y, Z);
        viewer.scene.scene.add(this.#invisPlaneXY);
        this.#invisPlaneXY.visible = false;
        this.#invisPlaneXY.userData.type = "XY";
    
        //XZ plane:
        geometry = new THREE.PlaneGeometry( k*(maxX-minX), k*(maxZ-minZ) );
        rotation = new THREE.Vector3(Math.PI / 2, 0, 0);
        this.#invisPlaneXZ = new THREE.Mesh( geometry, material );
        this.#invisPlaneXZ.position.set(X, Y, Z);
        this.#invisPlaneXZ.rotation.set(rotation.x, rotation.y, rotation.z);
        viewer.scene.scene.add(this.#invisPlaneXZ);
        this.#invisPlaneXZ.visible = false;
        this.#invisPlaneXZ.userData.type = "XZ";
    
        //YZ plane:
        geometry = new THREE.PlaneGeometry( k*(maxZ-minZ), k*(maxY-minY) );
        rotation = new THREE.Vector3(0, Math.PI / 2, 0);
        this.#invisPlaneYZ = new THREE.Mesh( geometry, material );
        this.#invisPlaneYZ.position.set(X, Y, Z);
        this.#invisPlaneYZ.rotation.set(rotation.x, rotation.y, rotation.z);
        viewer.scene.scene.add(this.#invisPlaneYZ);
        this.#invisPlaneYZ.visible = false;
        this.#invisPlaneYZ.userData.type = "YZ";
    }

	togglePrepareAnim(txt, sw) { //sw - on/off - true/false
		this.#prepareAnim.innerHTML = txt;

		if (sw) {
			this.#prepareAnim.style.display = "inline";
			let n = 0;
		 	this.#genericRepeater = setInterval( () => {
				this.#prepareAnim.innerHTML += ".";
				n++;
				if (n > 3) {
					n=0;
					this.#prepareAnim.innerHTML = txt;
				}
			}, 200);
		} else {
			try {
				this.#prepareAnim.style.display = "none";
				clearInterval(this.#genericRepeater);
				this.#genericRepeater = null;
			} catch {
				//do nothing
			}
			
		}
	}

    splitCloud() {
		this.togglePrepareAnim("Splitting cloud", true);
		this.lockSplitCloudBtn();
        this.lockAddBtn();
        this.#coordInput.readOnly = true;
        this.#allowPlaneSelect = false;
		this.#btnDwnldSplitCloud.style.display = "none";
		this.#btnViewSplitCloud.style.display = "none";
        
		let minX, maxX, minY, maxY, minZ, maxZ;
        minX = this.#metadata.attributes[0].min[0];
        minY = this.#metadata.attributes[0].min[1];
        minZ = this.#metadata.attributes[0].min[2];
        maxX = this.#metadata.attributes[0].max[0];
        maxY = this.#metadata.attributes[0].max[1];
        maxZ = this.#metadata.attributes[0].max[2];

		let splitCoords = [];
        for (let i=-1; i <= this.#planes.length; i++) {
			if (i == -1) {
				if (this.getSplitAxis() == "X") splitCoords.push(minX);
            	if (this.getSplitAxis() == "Y") splitCoords.push(minY);
            	if (this.getSplitAxis() == "Z") splitCoords.push(minZ);
			} else if (i == this.#planes.length) {
				if (this.getSplitAxis() == "X") splitCoords.push(maxX);
            	if (this.getSplitAxis() == "Y") splitCoords.push(maxY);
            	if (this.getSplitAxis() == "Z") splitCoords.push(maxZ);
			} else {
            	if (this.getSplitAxis() == "X") splitCoords.push(this.#planes[i].position.x);
            	if (this.getSplitAxis() == "Y") splitCoords.push(this.#planes[i].position.y);
            	if (this.getSplitAxis() == "Z") splitCoords.push(this.#planes[i].position.z);
			}
        }
	
		let planesMetadata = {
			splitAxis: this.getSplitAxis(),
			splitPoints: splitCoords,
			metadataPath: this.#cloudPath,
			clientID: this.socket.id

		};

		let planesMetadataString = JSON.stringify(planesMetadata);

		//this lets backend know that "SplitBtnClick" event has been executed.
		//planesMetadataString is also sent over to backend
		this.socket.emit("SplitBtnClick", planesMetadataString);
		
		this.socket.connect();

		//this listens for backend event "pyDone"
		//that takes place when python code has finished
		//message is argument recieved from backend
		this.socket.on("pyDone", (htmlLink) => {
			if (htmlLink == "Fail") {
				alert("Something went wrong. Please try again!");
				this.unlockSplitCloudBtn();
        		this.unlockAddBtn();
        		this.#coordInput.readOnly = false;
        		this.#allowPlaneSelect = true;
			} else {
				//Process python output here
				this.#btnViewSplitCloud.style.display = "inline"; //setups button
				this.#btnDwnldSplitCloud.style.display = "inline";
				this.#btnViewSplitCloud.setAttribute("href", window.location.href + htmlLink);
			}
			this.togglePrepareAnim("Splitting cloud", false);
			this.#dwnldLink = undefined;
		});

    }

	downloadCloud() {
		console.log("Preparing archive of csv files...");
		this.lockDwnldBtn();

		if (this.#dwnldLink) { //if download link is already generated
			this.#hidDwnldBtn.click();
			this.unlockDwnldBtn();
			return;
		}


		//let user know that stuff is happening even tho nothing seems to be happening :D
		this.togglePrepareAnim("Preparing zip file", true);



		let minX, maxX, minY, maxY, minZ, maxZ;
        minX = this.#metadata.attributes[0].min[0];
        minY = this.#metadata.attributes[0].min[1];
        minZ = this.#metadata.attributes[0].min[2];
        maxX = this.#metadata.attributes[0].max[0];
        maxY = this.#metadata.attributes[0].max[1];
        maxZ = this.#metadata.attributes[0].max[2];

		let splitCoords = [];
        for (let i=-1; i <= this.#planes.length; i++) {
			if (i == -1) {
				if (this.getSplitAxis() == "X") splitCoords.push(minX);
            	if (this.getSplitAxis() == "Y") splitCoords.push(minY);
            	if (this.getSplitAxis() == "Z") splitCoords.push(minZ);
			} else if (i == this.#planes.length) {
				if (this.getSplitAxis() == "X") splitCoords.push(maxX);
            	if (this.getSplitAxis() == "Y") splitCoords.push(maxY);
            	if (this.getSplitAxis() == "Z") splitCoords.push(maxZ);
			} else {
            	if (this.getSplitAxis() == "X") splitCoords.push(this.#planes[i].position.x);
            	if (this.getSplitAxis() == "Y") splitCoords.push(this.#planes[i].position.y);
            	if (this.getSplitAxis() == "Z") splitCoords.push(this.#planes[i].position.z);
			}
        }

		let planesMetadata = {
			splitAxis: this.getSplitAxis(),
			splitPoints: splitCoords,
			metadataPath: this.#cloudPath,
			clientID: this.socket.id

		};
		let planesMetadataString = JSON.stringify(planesMetadata);

		this.socket.emit("splitDwnldClick", planesMetadataString);

		this.socket.once("pyDone_dwnld", (link) =>{
			console.log("recieved message from back-end");
			if (link == "Fail") {
				this.#btnDwnldSplitCloud.disabled = false;
				alert("Something went wrong. Please try again!");
				this.unlockDwnldBtn();
			} else {
				console.log("File prepared, start download...");
				this.#hidDwnldBtn.setAttribute("href", link);
				this.#hidDwnldBtn.setAttribute("download", link.split("/").pop());
				this.#hidDwnldBtn.click();
				this.#dwnldLink = link;
				this.unlockDwnldBtn();
				//this.clearAll();
			}
			this.togglePrepareAnim("Preparing zip file", false);

		});


	}


    clearAll() {
        for (let i=0; i < this.#planes.length; i++) {
            viewer.scene.scene.remove(this.#planes[i]);
        }
        this.#planes.length = 0;
        this.#planeChoiceRadioXY.checked = false;
        this.#planeChoiceRadioXZ.checked = false;
        this.#planeChoiceRadioYZ.checked = false;
        this.updatePlaneList();
        this.unlockPlaneChoice();
        this.lockAddBtn();
        this.lockDelBtn();
        this.lockSplitCloudBtn();
        this.#coordInput.style.display = "none";
        document.getElementById("coordLabel").innerHTML = "";
        this.#coordInput.value = null;
        this.#allowPlaneSelect = true;
		this.#btnClear.disabled = true;
		this.#dwnldLink = undefined;

		this.togglePrepareAnim("Preparing zip file", false);
		this.togglePrepareAnim("Splitting cloud", false);
    }

    initListeners() {
        //====Event Listeners================
        this.#btnAddPlane.addEventListener("click", this.addPlane);
        this.#btnDeletePlane.addEventListener("click",this.deletePlane);
        this.#btnSplit.addEventListener("click",this.splitCloud);

        this.#planeChoiceRadioXY.addEventListener("click", this.setPlaneChoice);
        this.#planeChoiceRadioXZ.addEventListener("click", this.setPlaneChoice);
        this.#planeChoiceRadioYZ.addEventListener("click", this.setPlaneChoice);

        this.#PotreeRenderArea.addEventListener("click", this.toggleSelectPlane);
        this.#PotreeRenderArea.addEventListener('mousemove', this.mouseChange);

		this.#btnDwnldSplitCloud.addEventListener("click", this.downloadCloud);
		this.#btnClear.addEventListener("click", this.clearAll);


        //===================================
    }

}
//====================================END CLASS SideBar=================================
