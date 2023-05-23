const path = require('path');
const gulp = require('gulp');
const exec = require('child_process').exec;

const fs = require("fs");
const fsp = fs.promises;
const concat = require('gulp-concat');
const {watch} = gulp;
const ini = require("ini");

const {createExamplesPage} = require("./src/tools/create_potree_page");
const {createGithubPage} = require("./src/tools/create_github_page");
const {createIconsPage} = require("./src/tools/create_icons_page");

const {PythonShell} = require("python-shell");
const cheerio = require("cheerio");

//======read config.ini file==============
var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'))

config.pointClouds.pointclouds_dir = path.normalize(config.pointClouds.pointclouds_dir);
config.pointClouds.split_pointclouds_dir = path.normalize(config.pointClouds.split_pointclouds_dir);
if (config.PythonEnv.python_path != "auto") config.PythonEnv.python_path = path.normalize(config.PythonEnv.python_path);

if (config.pointClouds.pointclouds_dir.slice(-1) != "/") config.pointClouds.pointclouds_dir += '/';
if (config.pointClouds.split_pointclouds_dir.slice(-1) != "/") config.pointClouds.split_pointclouds_dir += '/';

//create directories if they do no exist:
if (!fs.existsSync(config.pointClouds.pointclouds_dir)) fs.mkdirSync(config.pointClouds.pointclouds_dir);
if (!fs.existsSync(config.pointClouds.split_pointclouds_dir)) fs.mkdirSync(config.pointClouds.split_pointclouds_dir);
//===================================

//setup pointclouds path in index.html
console.log("Updating index.html");
let index_html = cheerio.load(fs.readFileSync("./index.html", "utf-8"));
index_html("#cloud_vars_script").attr("src", config.pointClouds.pointclouds_dir + "cloud_vars.js" );
fs.writeFileSync("./index.html", index_html.html(), "utf-8");

let paths = {
	laslaz: [
		"build/workers/laslaz-worker.js",
		"build/workers/lasdecoder-worker.js",
	],
	html: [
		"src/viewer/potree.css",
		"src/viewer/sidebar.html",
		"src/viewer/profile.html"
	],
	resources: [
		"resources/**/*"
	]
};

let workers = {
	"LASLAZWorker": [
		"libs/plasio/workers/laz-perf.js",
		"libs/plasio/workers/laz-loader-worker.js"
	],
	"LASDecoderWorker": [
		"src/workers/LASDecoderWorker.js"
	],
	"EptLaszipDecoderWorker": [
		"src/workers/EptLaszipDecoderWorker.js"
	],
	"EptBinaryDecoderWorker": [
		"libs/ept/ParseBuffer.js",
		"src/workers/EptBinaryDecoderWorker.js"
	],
	"EptZstandardDecoderWorker": [
		"src/workers/EptZstandardDecoder_preamble.js",
		'libs/zstd-codec/bundle.js',
		"libs/ept/ParseBuffer.js",
		"src/workers/EptZstandardDecoderWorker.js"
	]
};

// these libs are lazily loaded
// in order for the lazy loader to find them, independent of the path of the html file,
// we package them together with potree
let lazyLibs = {
	"geopackage": "libs/geopackage",
	"sql.js": "libs/sql.js"
};

let shaders = [
	"src/materials/shaders/pointcloud.vs",
	"src/materials/shaders/pointcloud.fs",
	"src/materials/shaders/pointcloud_sm.vs",
	"src/materials/shaders/pointcloud_sm.fs",
	"src/materials/shaders/normalize.vs",
	"src/materials/shaders/normalize.fs",
	"src/materials/shaders/normalize_and_edl.fs",
	"src/materials/shaders/edl.vs",
	"src/materials/shaders/edl.fs",
	"src/materials/shaders/blur.vs",
	"src/materials/shaders/blur.fs",
];

gulp.task('examples_page', async function(done) {
	await Promise.all([
		createExamplesPage(),
		createGithubPage(),
	]);

	done();
});

gulp.task('icons_viewer', async function(done) {
	await createIconsPage();

	done();

});


gulp.task("workers", async function(done){

	for(let workerName of Object.keys(workers)){

		gulp.src(workers[workerName])
			.pipe(concat(`${workerName}.js`))
			.pipe(gulp.dest('build/potree/workers'));
	}

	done();
});

gulp.task("lazylibs", async function(done){

	for(let libname of Object.keys(lazyLibs)){

		const libpath = lazyLibs[libname];

		gulp.src([`${libpath}/**/*`])
			.pipe(gulp.dest(`build/potree/lazylibs/${libname}`));
	}

	done();
});

gulp.task("shaders", async function(){

	const components = [
		"let Shaders = {};"
	];

	for(let file of shaders){
		const filename = path.basename(file);

		const content = await fsp.readFile(file);

		const prep = `Shaders["${filename}"] = \`${content}\``;

		components.push(prep);
	}

	components.push("export {Shaders};");

	const content = components.join("\n\n");

	const targetPath = `./build/shaders/shaders.js`;

	if(!fs.existsSync("build/shaders")){
		fs.mkdirSync("build/shaders");
	}
	fs.writeFileSync(targetPath, content, {flag: "w"});
});

gulp.task('build', 
	gulp.series(
		gulp.parallel("workers", "lazylibs", "shaders", "icons_viewer", "examples_page"),
		async function(done){
			gulp.src(paths.html).pipe(gulp.dest('build/potree'));

			gulp.src(paths.resources).pipe(gulp.dest('build/potree/resources'));

			gulp.src(["LICENSE"]).pipe(gulp.dest('build/potree'));

			done();
		}
	)
);

gulp.task("pack", async function(){
	exec('rollup -c', function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);
	});
});

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

gulp.task("initCloudDirs", async function() {
	//whenever server starts or pointclouds directory changes
	//update cloud_vars.js
	var cloud_vars = "var cloudPaths = [];\n\n";
	//read content of pointclouds
	var dirs = fs.readdirSync(config.pointClouds.pointclouds_dir);
	console.log("Updating cloud_vars.js");

	for (let dir of dirs) {
		if (fs.lstatSync(config.pointClouds.pointclouds_dir + dir).isDirectory()) { //is directory and not file
			let dirContent = fs.readdirSync(config.pointClouds.pointclouds_dir + dir);
			if (dirContent.includes("metadata.json") && dirContent.includes("octree.bin") && dirContent.includes("hierarchy.bin")) {
				cloud_vars += "cloudPaths.push(\"" + config.pointClouds.pointclouds_dir + dir + "/metadata.json\");\n";
			}
		}
	}
	fs.writeFileSync(config.pointClouds.pointclouds_dir + "cloud_vars.js", cloud_vars);
});

//webserver
gulp.task("webserver", gulp.series(async function() {
	
	let options_pc_dir = {
		ignoreInitial:false,
		ignored:[config.pointClouds.pointclouds_dir + "cloud_vars.js","readme.txt"] //otherwise it goes into infinite loop
	};

	watch(config.pointClouds.pointclouds_dir , options_pc_dir, gulp.series("initCloudDirs"));

	io.on("connection", (socket) => {
		console.log(`Client connected`);

		socket.on('disconnect', () => {
    		console.log(`Client disconnected`);
		});
		socket.on("SplitBtnClick", (metadata) => {
			
			console.log(`Client requested cloud splitting.`);

			/* ================EXECUTE PYTHON CODE ===========================
				options: scriptPath - specify python script path
				args: arguments to be passed to python

				pyshell - runs python script,
				pyshell.on('message'... listens for print() from python

				
				.io.to...emit -> lets client side know that "splitCloudPython" event has happened
				value is passed over to client side
			*/
			let options = {
				scriptPath: ".", // Set Py script path to server root folder
				args: [metadata],
				env: {
					PYTHONIOENCODING: 'UTF-8' // set UTF-8 encoding
				}
			}

			// If specified in config, change Python path
			if (config.PythonEnv.python_path != 'auto') {
				options.pythonPath = config.PythonEnv.python_path;
			}

			// Start Python script
			const pyshell_split = new PythonShell('./Python scripts/splitCloud.py', options);

			// Whenever something is printed from Python
			pyshell_split.on('message', (message) => {
				let type;
				let value;
				try {
					// Create an array from message
					let messages = JSON.parse(message.replace(/'/g, '"'));
					type = messages[0];
					value = messages[1];

				} catch (err) {
					console.log("*******************Node Error START*******************\n\n\n");
					console.log(err);
					console.log("\n\n\n*********************Node Error END*******************");
				}
				
				if (type == "link") {
					console.log(`Successfully generated link: ${value}`);
					io.to(socket.id).emit("splitCloudPython", value)
				}
				else if (type == "csv_dir") {
					console.log(`Split cloud saved successfully: ${value}`);
				}
				else if (type == "LOG"){
					console.log(`PYTHON LOG: ${value}`);
				}
				else if (type == "Error") {
					console.log(`Error: ${value}`);
				}
			});

			pyshell_split.end((err, code, signal) => {
				if (err) {
					console.log("Python script failed!");
					io.to(socket.id).emit("splitCloudPython", "Fail");
					console.log(`*******************Python Error START*******************\n\n\n${err.stack}\n\n\n*********************Python Error END*******************`)
				} else {
					io.to(socket.id).emit("Py_split_success");
					console.log("Python script finished successfully!");
				}
			});
			/* ================END EXECUTE PYTHON CODE =======================*/
		});
	});

	/* ===========which directories client requires ========================*/
	const dirNeededByUser = [
		'build',
		'docs',
		'libs',
		'resources'
	];

	//add directories from config.ini:
	dirNeededByUser.push(config.pointClouds.pointclouds_dir);
	dirNeededByUser.push(config.pointClouds.split_pointclouds_dir);
	//dirNeededByUser.push(config.pointClouds.split_cloud_viewer_html_dir);
	
	dirNeededByUser.forEach((dir) => {
		const fullPath = path.join(__dirname, dir);
		app.use("/" + dir, express.static(fullPath));
	});
	/* ===========END which directories client requires ====================*/


	// Route for the homepage
	app.get('/', (req, res) => {
	  res.sendFile(__dirname + '/index.html');
	});

	// Start the server
	const port = 1234;
	const host = "0.0.0.0";
	httpServer.listen(port, host, () => {
		  console.log(`Server started on ${host}:${port}`);
	});
	
}));

gulp.task('watch', gulp.parallel("build", "pack", "webserver", async function() {//

	let watchlist = [
		'src/**/*.js',
		'src/**/**/*.js',
		'src/**/*.css',
		'src/**/*.html',
		'src/**/*.vs',
		'src/**/*.fs',
		'resources/**/*',
		'examples//**/*.json',
		'!resources/icons/index.html',
	];
	
	watch(watchlist, gulp.series("build", "pack"));

}));