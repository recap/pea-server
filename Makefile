.PHONY: build

build:
	docker build -t recap/pea-server:v0.1 .

run: build
	docker run -d recap/pea-server:v0.1

