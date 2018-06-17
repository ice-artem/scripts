def read_or create():
	filename = 'this_file_not_exist'
	try:
	    with open(filename) as f:
		return f.read
	except FileNotFoundError:
	    with open(filename, 'w') as f:
		pass
