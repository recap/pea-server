.PHONY: build

build:
	docker build -t recap/pea-server:v0.1 .

run: build
	docker run -d -ip 172.17.0.3 recap/pea-server:v0.1

run-dev: build
	docker run -d -ip 172.17.0.4 recap/pea-server:v0.1

