.PHONY: build

build:
	docker build -t recap/pea-server .

run: build
	docker run -d recap/pea-server

