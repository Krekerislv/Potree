try:
	import sys
	import splitCloud as sc
except Exception as e:
	print(["Error", "Importing Python libraries!"])
	raise e

if __name__ == "__main__":
	
	#init variables
	sc.initConfiguration(sys.argv[1])

	cloud = None
	DFs = None
	zipLink = None
	
	try:
		cloud = sc.readOctree(sc.cloud_metadata_path)
	except Exception as e:
		print(["Error", "Loading cloud points from octree.bin failed"])
		raise e

	try:
		DFs = sc.splitCloud(cloud, sc.metadata)
	except Exception as e:
		print(["Error", "Splitting cloud failed"])
		raise e

	try:
		zipLink = sc.saveToZip(DFs, sc.cloudName, sc.zipFilesDir)
	except Exception as e:
		print(["Error", "Generating zip archive failed"])
		raise e
	
	#return result to NodeJS
	print(["Success!",zipLink])