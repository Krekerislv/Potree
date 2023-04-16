import { SideBarCloudSplit } from "./SidebarCloudSplit.js";

//================Independent functions=========================

// Method from https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists
async function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }
    
        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });
    
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });    
}

//async function updateVisibleClouds() {}



//================END Independant functions=====================


//=========================MAIN=================================



//=====Elemenet variables============
const btnAddPlane = await waitForElm('#btnAddPlane');
const btnDeletePlane = await waitForElm("#btnRemovePlane");
const btnSplit = await waitForElm("#btnSplit");

const planeChoiceRadioXY = await waitForElm('#XY');
const planeChoiceRadioXZ = await waitForElm('#XZ');
const planeChoiceRadioYZ = await waitForElm('#YZ');

const coordInput = await waitForElm('#coordinateInput');
const planeList = await waitForElm("#splitPlaneList");
const PotreeRenderArea = document.getElementById("potree_render_area");
const hidDwnldBtn = await waitForElm("#potree_download_split_cloud");
const prepareAnim = await waitForElm("#prepare_anim");
const btnViewSplitCloud = await waitForElm("#btnNewCloud");
const btnDwnldSplitCloud = await waitForElm("#btnDwnldCloud");
const btnClear = await waitForElm("#btnClear");


//===================================

//create class object
var sidebarSplit =  new SideBarCloudSplit(cloudPaths[0], btnAddPlane, btnDeletePlane, btnSplit, planeChoiceRadioXY,planeChoiceRadioXZ,planeChoiceRadioYZ,coordInput,planeList,PotreeRenderArea, hidDwnldBtn, prepareAnim, btnViewSplitCloud, btnDwnldSplitCloud, btnClear);

//initialize all listeners
sidebarSplit.initListeners();

//Cloud Selection
		{	
			//initialize cloudSelection list
			let CloudSelection = elToolbar.find('#optCloud');
			for(let option of cloudNames){
				let elOption = $(`<option>${option}</option>`);
				CloudSelection.append(elOption);
			}

			//whenever list value is changed
			let selectedValue;
			let previousSelection = CloudSelection.selectmenu().val();
			const updateCloudSelection = (event, ui) => {
				if (sidebarSplit.getPlanes().length > 0) {
					CloudSelection.selectmenu().val(previousSelection).change();
					CloudSelection.selectmenu("refresh");
					selectedValue = previousSelection;
					alert("Can't change point cloud if planes are added");
					return;
				}
				//get newly selected value
				selectedValue = CloudSelection.selectmenu().val();
				//compare it with point cloud names to find matching cloud
				for(const pointcloud of viewer.scene.pointclouds){
					if (selectedValue.localeCompare(pointcloud.name) == 0) {

						//set matching cloud's visibility
						pointcloud.visible = true;;
						for (let i=0; i<cloudPaths.length; i++) {
							if (cloudPaths[i].split("/").at(-2) === selectedValue) {
								//update cloudPath and csvPath for SideBarCloudSplit class
								sidebarSplit.setCloudPath(cloudPaths[i]);
								break;
							}
						}	
						}else {
							pointcloud.visible = false;
						}
					}
					previousSelection = selectedValue;
			};
			CloudSelection.selectmenu({change: updateCloudSelection});
		}