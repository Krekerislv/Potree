const btnsView = document.querySelectorAll('[id^="btn_view"]')
var btnsViewJSON = {};
var pcJSON = {};

function updateJSON() {
	viewer.scene.pointclouds.forEach( pc => {
		pcJSON[pc.name] = pc.visible;
	});
}

btnsView.forEach(btn => {
	btnsViewJSON[btn.id] = btn;
});


function getCloudName(btn) {
	let tmp = btn.id.split("_")[2].split("-");
	let i = tmp[0];
	let j = tmp[1];
	let cloudName = j ? "cloud_"+i+"_"+j : "cloud_"+i;
	return [cloudName, i, j];
}

function setBtnState(btn, vis) {
	if (vis) {
		if (!btn.innerHTML.includes("slash")) return false;
		btn.innerHTML='<i class="bi bi-eye-fill"></i>';
		btn.style.opacity = 1;
	} else {
		if (btn.innerHTML.includes("slash")) return false;
		btn.innerHTML='<i class="bi bi-eye-slash-fill"></i>';
		btn.style.opacity = .5;
	}
	return true;
}

function changeState(btn) {
	if (btn.innerHTML.includes("slash")) {
		btn.innerHTML='<i class="bi bi-eye-fill"></i>';
		btn.style.opacity = 1;
	} else {
		btn.innerHTML='<i class="bi bi-eye-slash-fill"></i>';
		btn.style.opacity = .5;
	}
}
function toggleCloud(btn) {
	let tmp = getCloudName(btn);
	let cloudName = tmp[0];
	let j = tmp[2];
	for (let pc of viewer.scene.pointclouds) {
		if (!j) {
			if (pc.name.includes(cloudName)) {
				pc.visible = arguments[1] != undefined ? arguments[1] : !pc.visible;
			}	
		}else {
			if (pc.name == cloudName) {
				pc.visible = arguments[1] != undefined ? arguments[1] : !pc.visible;
			}
		}
	}
}

function getMasterBtn(btn) {
	let tmp = btn.id.split("_")[2].split("-");
	let i = tmp[0];

	if (tmp.length == 1) return btn;

	return btnsViewJSON["btn_view_"+i];
}

function checkAllStates(btn) {
	let masterBtn = getMasterBtn(btn);
	if (btn.innerHTML.includes("slash")) {

		let tmp = btn.id.split("_")[2].split("-");
		let i = tmp[0];
		let flag = true;

		btnsView.forEach(buttn => {
			if (buttn.id.split("_")[2].split("-")[0] == i && buttn.id != masterBtn.id) {
				if (buttn.innerHTML != btn.innerHTML) {
					flag = false;
				}
			}
		});
		if (flag){
			masterBtn.innerHTML = btn.innerHTML;
			masterBtn.style.opacity = btn.style.opacity;
		}
	} else {
		setBtnState(masterBtn, true);
	}

}

function getBtnState(btn) {
	if (btn.innerHTML.includes("slash")) {
		return false;
	}
	return true;
}


btnsView.forEach(btn => {
	if (btn == getMasterBtn(btn)) {
		btn.addEventListener("click", () => {
			changeState(btn);
			toggleCloud(btn, getBtnState(btn));
		});
	} else {
		btn.addEventListener("click", () => {
			toggleCloud(btn);
		});	
	}

});

function updateButtons() {
	btnsView.forEach(btn => {
		if (btn != getMasterBtn(btn)) {
			setBtnState(btn, pcJSON[getCloudName(btn)[0]]);
			checkAllStates(btn);
		}
		
	});
}

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

const observer = new MutationObserver(() => {
	updateJSON();
	updateButtons();
});
const target = await waitForElm("#jstree_scene");
observer.observe(target, { attributes: true, childList: true, subtree: true });
