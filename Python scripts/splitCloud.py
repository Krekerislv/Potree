'''
This python script:
	1) reads octree
	2) splits cloud into n parts
	3) converts new clouds to Potree
    4) generates an html file for split cloud viewing
    5) returns directory of html

Argument: JSON containing cloud name, split axis and split points

	metadata = {
		splitAxis: X or Y or Z
        splitPoints: array of coordinates. first and last indicate minimum and maximum cloud values
        metadataPath: path of metadata.json for cloud that's being split
		clientID: id of client
    }

'''
try:
	import subprocess
	import sys
	import json
	import os
	import time
	from posixpath import join
	import laspy
	import numpy as np
	import pandas as pd
	import bs4
	import configparser
except Exception as e:
	print(["Error", "Importing Python libraries failed"])
	raise e

#this metadata refers to the one recieved from client (contains split axis, splitpoints, cloud metadata path and clientID)
metadata = None

clientID = None
cloud_metadata_path = None

cloudName = None

potreeConverterPath = None
LASpath = None
zipFilesDir = None
potreeCloudDirs = None
potreeHTMLDirs = None

csvFilesDir = None


def log(data):
	print(["LOG", f"{data}"])

def makeDir(orgDir, flag, sep):
	if flag:
		orgDir = os.path.normpath(orgDir)
		orgDir += "1"
		if os.path.exists(orgDir):
			split_dir = orgDir.split(sep)
			i = 1
			while os.path.exists(orgDir):
				split_dir[-1] = str(i)
				orgDir = sep.join(split_dir)
				i += 1
	else:
		orgDir = os.path.normpath(orgDir)
		if os.path.exists(orgDir):
			i = 1
			head, tail = os.path.split(orgDir)
			
			while os.path.exists(orgDir):
				orgDir = os.path.join(head, tail+"_{}".format(i))
				i+=1
	os.makedirs(orgDir)
	return orgDir
	
def genFilePath(orgFile):
	if os.path.isfile(orgFile):
		base, ext = os.path.splitext(orgFile)
		k=1
		while os.path.isfile(orgFile):
			orgFile = base + "_{}".format(str(k)) + ext
			k += 1
	return orgFile

# a method to init config and metadata
def initConfiguration(sysArg):
	global metadata, clientID, cloud_metadata_path, cloudName, potreeConverterPath, LASpath, zipFilesDir, potreeCloudDirs, potreeHTMLDirs, csvFilesDir
	
	# LOAD VARIABLES FROM CONFIG.INI =================
	try:
		config = configparser.ConfigParser()
		config.read('config.ini', encoding="utf-8")

		potreeConverterPath = config.get("PotreeConverter", "path").rstrip("\r\n")
		if not os.path.isfile(potreeConverterPath):
			print(["Error", "PotreeConverter path is invalid!"])
			raise Exception("Invalid PotreeConverter path")

		LASpath = config.get("pointClouds", "las_file_dir").rstrip("\r\n")
		zipFilesDir = config.get("pointClouds", "zip_files_dir").rstrip("\r\n")
		potreeCloudDirs = config.get("pointClouds", "potree_clouds_dir").rstrip("\r\n")
		potreeHTMLDirs = config.get("pointClouds", "split_cloud_viewer_html_dir").rstrip("\r\n")
		csvFilesDir = config.get("pointClouds", "csv_files_dir").rstrip("\r\n")
	except Exception as e:
		print(["Error", "Couldn't open config.ini or invalid variable name!"])
		raise e
	#============================================================================

	# LOAD VARIABLES FROM METADATA
	try:
		metadata = json.loads(sysArg)
		clientID = metadata["clientID"]
		cloud_metadata_path = os.path.normpath(metadata["metadataPath"])
		cloudName = cloud_metadata_path.split(os.sep)[-2]
	except Exception as e:
		print(["Error", "Loading cloud metadata failed"])
		raise e

def updateClientCloudMap():
	map = {}
	dirsClient = os.listdir(potreeCloudDirs)
	dirsZIP = os.listdir(zipFilesDir)
	for clID in dirsClient:
		if os.path.exists(os.path.join(potreeCloudDirs, clID)):
			map[clID] = {}
			map[clID]["clouds"] = {}
			map[clID]["zips"] = {}

			cloud_dirs = os.listdir(os.path.join(potreeCloudDirs, clID))
			for j, cloud_name in enumerate(cloud_dirs, start=1):
				map[clID]["clouds"][cloud_name] = {}
				cloud_parts = os.listdir(os.path.join(potreeCloudDirs, clID, cloud_name))

				for k, part in enumerate(cloud_parts, start=1):
					map[clID]["clouds"][cloud_name][f"part_{j}_{k}"] = join(part, "metadata.json")
		
			if clID in dirsZIP:
				zip_files = os.listdir(os.path.join(zipFilesDir, clID))
				for zip in zip_files:
					if os.path.splitext(zip)[1] == ".zip":
						cloud_name = os.path.split(zip)[-1]
						map[clID]["zips"][cloud_name] = zip
	
	json_file = open(os.path.join("src","client_clouds_map.json"), "w")
	json_file.write(json.dumps(map, indent=2))
	json_file.close()
	
	return map

def setupCloudSelection(canvas): #TODO sets up list and links for buttons(all of them, see test.py__
	
	c_c_map = updateClientCloudMap()
	clouds = c_c_map[clientID]["clouds"]
	zips = c_c_map[clientID]["zips"]
	
			

	div_tag_html = canvas.find("div", {"id":"cloud_selection_list_container"})
	div_tag_html.clear()
	div_tag = '<ul class="cloud_selector">\n'

	for i, cloud in enumerate(clouds, start=1):
		div_tag += '\t<li class="cloud_selector">\n\t\t{}'.format(cloud)
		div_tag += '\n\t\t<div class="cloud_selector">\n\t\t\t<button id="btn_view_{}" class="cloud_selector"><i class="bi bi-eye-fill"></i></button>\n'.format(i)
		div_tag += '\t\t\t<button class="cloud_selector" id="btn-dnwld-{}"><i class="bi bi-cloud-download-fill"></i></button>\n'.format(i)
		div_tag += '\t\t</div>\n\t\t<ul class="cloud_selector">'
		for j, part in enumerate(clouds[cloud], start=1):
			div_tag += '\n\t\t\t<li class="cloud_selector">\n\t\t\t\tpart {}'.format(str(i)+"."+str(j))
			div_tag += '\n\t\t\t\t<div class="cloud_selector">\n\t\t\t\t\t<button class="cloud_selector" id="btn_view_{}-{}"><i class="bi bi-eye-fill"></i></button>\n'.format(i, j)
			div_tag += '\t\t\t\t\t<button class="cloud_selector" id="btn_dnwld_{}-{}"><i class="bi bi-cloud-download-fill"></i></button>\n'.format(i,j)
			div_tag += '\t\t\t\t</div>\n\t\t\t</li>\n'

		div_tag += '\t\t</ul>\n'

	div_tag += '\n\t</li>\n</ul>\n'

	tmp = bs4.BeautifulSoup(div_tag, features="html.parser")
	tmp.encode_contents(formatter="html")
	div_tag_html.append(tmp)

	return canvas, c_c_map

def readOctree(metadataPath):
	octreePath = metadataPath.replace("metadata.json","octree.bin")

	with open(metadataPath, 'r') as f:
		metadata = json.load(f) #opens actual metadata of cloud
	offset = metadata["offset"]
	scale = metadata["scale"]
	numPoints = metadata["points"]


	#get BytesPerPoint from metadata
	bytesPerPoint = 0
	for attribute in metadata["attributes"]:
		bytesPerPoint += attribute["size"]


	#read file as binary
	data = np.fromfile(octreePath, dtype='byte')

	#reshape array so each row represents 1 point
	data = np.reshape(data, (numPoints, bytesPerPoint))

	#take first 12 columns (each 4 cols represent 1 int32)
	xyz_int32 = data[:, :12].view(dtype=np.int32) #0-11
	classification_uint8 = data[: , 16].view(dtype=np.uint8) #17th column
	#this gives an array of shape (numPoints,3)


	X = np.around(xyz_int32[:,0] * scale[0] + offset[0], decimals=2)
	Y = np.around(xyz_int32[:,1] * scale[1] + offset[1], decimals=2)
	Z = np.around(xyz_int32[:,2] * scale[2] + offset[2], decimals=2)
	c = classification_uint8
	

	cloud = np.column_stack((X, Y, Z, c))

	return cloud

def splitCloud(cloud, metadata):
	#remove duplicates in case 2 or more planes match
	metadata["splitPoints"] = set(metadata["splitPoints"])
	#and convert it back to list for easy indexing
	metadata["splitPoints"] = list(metadata["splitPoints"])
	#actions above are acceptable because splitPoints only contains few elements

	#ensure metadata splitpoints are sorted correctly
	metadata["splitPoints"].sort()	

	#splitAxis -> index
	splitAxisIndex = None
	if metadata["splitAxis"] == "X":
		splitAxisIndex = 0
	elif metadata["splitAxis"] == "Y":
		splitAxisIndex = 1
	elif metadata["splitAxis"] == "Z":
		splitAxisIndex = 2

	#determine how many output files are there gonna be
	# -2 because splitPoints contain min and max values of cloud
	# +1 because 1 plane splits into 2 parts
	outputFileCount = len(metadata["splitPoints"]) -2 + 1

	data = pd.DataFrame(cloud)

	#init output files
	outputDFs = []
	#fileNames = []
	for i in range(outputFileCount, 0, -1):
	# since splitPoints is sorted
		data = data[ data[splitAxisIndex] <= metadata["splitPoints"][i] ]
		outputDFs.append(data[ data[splitAxisIndex] > metadata["splitPoints"][i-1]  ])

	return outputDFs #contains panda data frames: each df represent split part of cloud 

def saveToZip(outputDFs, cloudName, outputZipDir):
	#initialize file path:
	filesPath = os.path.join(outputZipDir, metadata["clientID"])
	if not os.path.exists(filesPath):
		os.makedirs(filesPath)
	

	filesPath = filesPath.replace("\\","/")
	zipPath = genFilePath(os.path.join(filesPath, cloudName + ".zip"))
	zipPath = zipPath.replace("\\","/")
	
	from zipfile import ZipFile
	with ZipFile(zipPath, 'w') as zipper:

		for i, df in enumerate(outputDFs, start=1):
			df = df.astype({3:'int'}) #convert classification column to int
			zipper.writestr("part_"+str(i)+".csv", df.to_csv(header=False, index=False))
	
	zipper.close()

	return zipPath

def PandaToLas(DFs, cloudName, clientID, lasPath):
	lasPaths = []

	tmpLasPath = makeDir( os.path.join(lasPath, clientID, "las"), False, None)

	#Convert every DF file to LAS
	for i, df in enumerate(DFs, start=1):
		cloud_np = df.to_numpy()

		#initialize las header 
		header = laspy.LasHeader(point_format=6)#, version="1.4")
		
		header.offsets = np.min(cloud_np[:,[0,1,2]], axis=0)
		header.scales = np.array([0.01, 0.01, 0.01])
		#header.

		#crate las file
		las = laspy.LasData(header)

		las.x = cloud_np[:, 0]
		las.y = cloud_np[:, 1]
		las.z = cloud_np[:, 2]
		las.classification = cloud_np[:, 3].astype(int)


		#write las file
		tmpLasFilePath = os.path.join(tmpLasPath, cloudName + "_" +str(i))+ ".las"
		las.write(tmpLasFilePath)

		lasPaths.append(tmpLasFilePath)
	return lasPaths

def LasToPotree(lasPaths, clientID, potreeConverterPath):

	outputFolder = makeDir( os.path.join(potreeCloudDirs, clientID, cloudName+"_"), True, "_")
	potreeCloudPaths = []

	for lasFile in lasPaths:
		folderName = os.path.splitext(os.path.basename(lasFile))[0]
		potreeCloudPaths.append(os.path.join(outputFolder, folderName))
		command = [potreeConverterPath, lasFile, "-o", os.path.join(outputFolder, folderName)]
		
		subprocess.call(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

		if not os.path.exists(os.path.join(outputFolder, folderName)):
			print(["Error", "PotreeConverter failed"])
			raise Exception("PotreeConverter failed!")
		expectedFiles = ["hierarchy.bin", "metadata.json", "octree.bin"]
		for file in expectedFiles:
			if not os.path.isfile(os.path.join(outputFolder, folderName, file)):
				print(["Error", "PotreeConverter failed"])
				raise Exception("PotreeConverter failed!")

	return potreeCloudPaths
	
def generateHTML(clientID):
	clientClouds = os.listdir(os.path.join(potreeCloudDirs, clientID))
	
	with open(os.path.join("src","canvas.html")) as htmlFile:
		html_txt = htmlFile.read()
		canvas = bs4.BeautifulSoup(html_txt)
	script_tag = canvas.find("script", {"id":"cloud_paths_names"})
	script_tag_listeners = canvas.find("script", {"id":"cloud_selection_list_listeners"})
	script_tag.clear()

	canvas, c_c_map = setupCloudSelection(canvas)
	#generate js to be inserted:
	js = "var cloudPaths = [];\nvar cloudNames = [];\n"
	
	clouds = c_c_map[clientID]["clouds"]

	tmpDepthStr = ""
	p = os.path.join(potreeHTMLDirs, clientID)
	for i in range(len(p.split(os.sep))):
		tmpDepthStr += "../"
	#using join from posixpath so slashes are correct for JS
	for i, cloud in enumerate(clouds, start=1):
		for j, part in enumerate(clouds[cloud], start=1):
			js += "cloudPaths.push(\"{}\");\n".format(join(tmpDepthStr, potreeCloudDirs, clientID, cloud, clouds[cloud][part]))
			js += "cloudNames.push(\"cloud_{}_{}\");\n\n".format(i,j)

	script_tag_listeners["src"] = join(tmpDepthStr, "libs", "other", "cloud_selection_list.js")
	script_tag.insert(1,js)

	htmlFile.close()

	outputPath = os.path.join(potreeHTMLDirs, clientID)
	if not os.path.exists(outputPath):
		os.makedirs(outputPath)
	outputFile = os.path.join(outputPath,"viewer.html")
	with open(outputFile, "w", encoding='utf-8') as file:
		file.write(str(canvas))
	file.close()

	return outputFile


if __name__ == "__main__":
	#initialize undefined variables to be changed later

	cloud = None
	DFs = None
	lasPathsArr = None
	potreeCloudPaths = None
	link = None

	#initialize common variables
	initConfiguration(sys.argv[1]) 

	#read octree
	try:
		cloud = readOctree(cloud_metadata_path)
	except Exception as e:
		print("Error")
		print("Loading cloud points from octree.bin failed")
		raise e

	#split points into multiple dataframes
	try:
		DFs = splitCloud(cloud, metadata)
	except Exception as e:
		print(["Error", "Splitting cloud failed"])
		raise e

	#Convert DFs to LAS files
	try:
		lasPathsArr = PandaToLas(DFs, cloudName, clientID, LASpath)
	except Exception as e:
		print(["Error", "Converting Pandas dataframes to LAS files failed"])
		raise e


	#Convert LAS to Potree using PotreeConverter
	try:
		potreeCloudPaths = LasToPotree(lasPathsArr, clientID, potreeConverterPath)
	except Exception as e:
		print(["Error", "Converting LAS files to Potree failed"])
		raise e

	#generate HTML
	try:
		link = generateHTML(clientID)
	except Exception as e:
		print(["Error", "Generating HTML document failed"])
		raise e

	#return link to NodeJS
	print(["Success!", link])