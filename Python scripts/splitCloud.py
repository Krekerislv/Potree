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
    }

'''

import subprocess
import sys
import json
import os
from posixpath import join
import laspy
import numpy as np
import pandas as pd
import bs4
import configparser


#this metadata refers to the one recieved from client (contains split axis, splitpoints, cloud metadata path)
metadata = None

cloud_metadata_path = None

cloudName = None

potreeConverterPath = None
potreeCloudDirs = None

csvFilesDir = None


def log(data, type="LOG"):
	# This is done so later when js is converting this to array object,
	# the apostrophe doesn't confuse JSON.parse()
	data = data.replace("'", "′")

	# Printing the data sends it to Node.js python-shell
	# type is used to identify log, error etc.
	print([type, data], flush=True)

# Generate a path name with number
def genPath(path, sep="_"):
	path = os.path.normpath(path)
	i = 1

	head, tail = os.path.split(path)

	firstIterFlag = True
	while os.path.exists(path) or firstIterFlag:
		firstIterFlag = False
		path = os.path.join(head, tail + sep + "{}".format(i))
		i+=1

	return path

# Makes numbered directory
def makeDir(orgDir, sep="_"):
	orgDir = genPath(orgDir, sep=sep)
	os.makedirs(orgDir)
	return orgDir
	
# a method to init config and metadata
def initConfiguration(sysArg):
	global metadata, cloud_metadata_path, cloudName, potreeConverterPath, potreeCloudDirs, csvFilesDir
	
	# LOAD VARIABLES FROM CONFIG.INI =================
	try:
		config = configparser.ConfigParser()
		config.read('config.ini', encoding="utf-8")

		potreeConverterPath = config.get("PotreeConverter", "path").rstrip("\r\n")
		if not os.path.isfile(potreeConverterPath):
			log("PotreeConverter path is invalid!", type="Error")
			raise Exception("Invalid PotreeConverter path")

		potreeCloudDirs = config.get("pointClouds", "split_pointclouds_dir").rstrip("\r\n")
		csvFilesDir = config.get("pointClouds", "csv_files_dir").rstrip("\r\n")
	except Exception as e:
		log("Couldn't open config.ini or invalid variable name!", type="Error")
		raise e
	#============================================================================

	# LOAD VARIABLES FROM METADATA
	try:
		metadata = json.loads(sysArg)
		cloud_metadata_path = os.path.normpath(metadata["metadataPath"])
		cloudName = cloud_metadata_path.split(os.sep)[-2]
	except Exception as e:
		log("Loading cloud metadata failed", type="Error")
		raise e

def updateClientCloudMap():
	map = {}
	
	for cloud in os.listdir(potreeCloudDirs):
		if os.path.isdir(os.path.join(potreeCloudDirs, cloud)):
			cloud_dirs = os.listdir(os.path.join(potreeCloudDirs, cloud))
			map[cloud] = {}
			for j, cloud_name in enumerate(cloud_dirs, start=1):
				map[cloud][f"part_{j}"] = join(cloud_name, "metadata.json")
	
	json_file = open(os.path.join("src","client_clouds_map.json"), "w")
	json_file.write(json.dumps(map, indent=2))
	json_file.close()
	
	return map

def setupCloudSelection(canvas):
	
	clouds = updateClientCloudMap()
	
	div_tag_html = canvas.find("div", {"id":"cloud_selection_list_container"})
	div_tag_html.clear()
	div_tag = '<ul class="cloud_selector">\n'

	for i, cloud in enumerate(clouds, start=1):
		div_tag += '\t<li class="cloud_selector">\n\t\t{}'.format(cloud)
		div_tag += '\n\t\t<div class="cloud_selector">\n\t\t\t<button id="btn_view_{}" class="cloud_selector"><i class="bi bi-eye-fill"></i></button>\n'.format(i)
		div_tag += '\t\t</div>\n\t\t<ul class="cloud_selector">'
		for j in range(1, len(clouds[cloud])+1, 1):
			div_tag += '\n\t\t\t<li class="cloud_selector">\n\t\t\t\tpart {}'.format(str(i)+"."+str(j))
			div_tag += '\n\t\t\t\t<div class="cloud_selector">\n\t\t\t\t\t<button class="cloud_selector" id="btn_view_{}-{}"><i class="bi bi-eye-fill"></i></button>\n'.format(i, j)
			div_tag += '\t\t\t\t</div>\n\t\t\t</li>\n'

		div_tag += '\t\t</ul>\n'

	div_tag += '\n\t</li>\n</ul>\n'

	tmp = bs4.BeautifulSoup(div_tag, features="html.parser")
	tmp.encode_contents(formatter="html")
	div_tag_html.append(tmp)

	return canvas, clouds

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

def saveSplitCloud(DFs, cloudName):
	dir = makeDir(os.path.join(csvFilesDir, cloudName))
	for i, df in enumerate(DFs, start=1):
		path = os.path.join(dir, cloudName + f"_pt_{i}.csv")
		df.to_csv(path, sep=',', header=False, index=False)
	return dir

def PandaToLas(DFs, cloudName):
	lasPaths = []

	if not os.path.exists("tmp_las_files"):
		os.mkdir("tmp_las_files")

	#Convert every DF file to LAS
	for i, df in enumerate(DFs, start=1):
		cloud_np = df.to_numpy()

		#initialize las header 
		header = laspy.LasHeader(point_format=6, version="1.4")
		header.offsets = np.min(cloud_np[:,[0,1,2]], axis=0)
		header.scales = np.array([0.01, 0.01, 0.01])

		#crate las file
		las = laspy.LasData(header)

		las.x = cloud_np[:, 0]
		las.y = cloud_np[:, 1]
		las.z = cloud_np[:, 2]
		las.classification = cloud_np[:, 3].astype(int)

		#write las file
		tmpLasFilePath = os.path.join("tmp_las_files", cloudName + "_" +str(i))+ ".las"
		las.write(tmpLasFilePath)

		lasPaths.append(tmpLasFilePath)
	return lasPaths

def LasToPotree(lasPaths, potreeConverterPath):

	outputFolder = makeDir( os.path.join(potreeCloudDirs, cloudName))
	potreeCloudPaths = []

	for lasFile in lasPaths:
		folderName = os.path.splitext(os.path.basename(lasFile))[0]
		potreeCloudPaths.append(os.path.join(outputFolder, folderName))
		command = [potreeConverterPath, lasFile, "-o", os.path.join(outputFolder, folderName)]
		
		subprocess.call(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

		if not os.path.exists(os.path.join(outputFolder, folderName)):
			log("PotreeConverter failed", type="Error")
			raise Exception("PotreeConverter failed!")
		expectedFiles = ["hierarchy.bin", "metadata.json", "octree.bin"]
		for file in expectedFiles:
			if not os.path.isfile(os.path.join(outputFolder, folderName, file)):
				log("PotreeConverter failed", type="Error")
				raise Exception("PotreeConverter failed!")
		
		os.remove(lasFile)
	os.rmdir("tmp_las_files")
	return potreeCloudPaths
	
def generateHTML():	
	with open(os.path.join("src","canvas.html")) as htmlFile:
		html_txt = htmlFile.read()
		canvas = bs4.BeautifulSoup(html_txt)
	script_tag = canvas.find("script", {"id":"cloud_paths_names"})
	script_tag_listeners = canvas.find("script", {"id":"cloud_selection_list_listeners"})
	script_tag.clear()

	canvas, clouds = setupCloudSelection(canvas)
	#generate js to be inserted:
	js = "var cloudPaths = [];\nvar cloudNames = [];\n"
	

	tmpDepthStr = ""
	p = os.path.join(potreeCloudDirs)
	for i in range(len(p.split(os.sep))):
		tmpDepthStr += "../"
	#using join from posixpath so slashes are correct for JS
	for i, cloud in enumerate(clouds, start=1):
		for j, part in enumerate(clouds[cloud], start=1):
			js += "cloudPaths.push(\"{}\");\n".format(join(tmpDepthStr, potreeCloudDirs, cloud, clouds[cloud][part]))
			js += "cloudNames.push(\"cloud_{}_{}\");\n\n".format(i,j)

	script_tag_listeners["src"] = join(tmpDepthStr, "libs", "other", "cloud_selection_list.js")
	script_tag.insert(1,js)

	htmlFile.close()

	outputPath = os.path.join(potreeCloudDirs)
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
		log("Loading cloud points from octree.bin failed", type="Error")
		raise e

	#split points into multiple dataframes
	try:
		DFs = splitCloud(cloud, metadata)
	except Exception as e:
		log("Splitting cloud failed", type="Error")
		raise e

	#Convert DFs to LAS files
	try:
		lasPathsArr = PandaToLas(DFs, cloudName)
	except Exception as e:
		log("Converting Pandas dataframes to LAS files failed", type="Error")
		raise e


	#Convert LAS to Potree using PotreeConverter
	try:
		potreeCloudPaths = LasToPotree(lasPathsArr, potreeConverterPath)
	except Exception as e:
		log("Converting LAS files to Potree failed", type="Error")
		raise e

	#generate HTML
	try:
		link = generateHTML()
	except Exception as e:
		log("Generating HTML document failed", type="Error")
		raise e
	
	#return link to NodeJS
	log(link, type="link")

	# Save split cloud in a directory after client has recieved the link
	try:
		dir = saveSplitCloud(DFs, cloudName)
		log(dir, type="csv_dir")
		
	except Exception as e:
		log("Couldn't save split cloud", type="Error")
		raise e

