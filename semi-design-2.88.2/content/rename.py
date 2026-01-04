import os
with open('file.txt') as fileList:
	for file in fileList:
		file=file.replace('\n','')
		file='./'+file
		os.system('mv '+file+' '+file.replace('README','index'))
