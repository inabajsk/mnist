# MNIST 計測 (Mac と iPhone)
#   make mac        Mac のコマンドライン版 build/mac/mnistbench を作る
#   make project    iPhone アプリの Xcode プロジェクト (MNISTBench.xcodeproj) を XcodeGen で作る
SRC  = MNISTBench
RES  = ../phone/site
OUT  = build/mac
XCODEGEN ?= xcodegen

PKGS = $(foreach k,MLP CNN,$(foreach b,1 100,$(OUT)/Resources/MNIST$(k)_P$(b).mlmodelc))

mac: $(OUT)/mnistbench $(OUT)/Resources/MNISTMLP.mlmodelc $(OUT)/Resources/MNISTCNN.mlmodelc $(PKGS)
	cp $(RES)/mnist_test.gz.txt $(RES)/mnist_train6k.gz.txt $(RES)/mlp_w.gz.txt $(RES)/cnn_w.gz.txt $(OUT)/Resources/

$(OUT)/cpucnn.o: $(SRC)/Engine/cpucnn.cpp $(SRC)/Engine/cpucnn.h
	mkdir -p $(OUT)
	clang++ -O3 -std=c++17 -c $< -o $@

$(OUT)/mnistbench: $(OUT)/cpucnn.o $(SRC)/Shared/Bench.swift $(SRC)/Shared/GPUNet.swift $(SRC)/Mac/main.swift
	swiftc -O -import-objc-header $(SRC)/Shared/Bridging.h $(SRC)/Shared/Bench.swift $(SRC)/Shared/GPUNet.swift $(SRC)/Mac/main.swift $(OUT)/cpucnn.o \
	  -framework Accelerate -framework CoreML -framework Metal -framework MetalPerformanceShaders -framework MetalPerformanceShadersGraph -lc++ -o $@

$(OUT)/Resources/%.mlmodelc: models/%.mlmodel
	mkdir -p $(OUT)/Resources
	xcrun coremlcompiler compile $< $(OUT)/Resources/ >/dev/null

project:
	DEVELOPMENT_TEAM=$(DEVELOPMENT_TEAM) $(XCODEGEN) generate --spec project.yml

$(OUT)/Resources/%.mlmodelc: models/%.mlpackage
	mkdir -p $(OUT)/Resources
	xcrun coremlcompiler compile $< $(OUT)/Resources/ >/dev/null

clean:
	rm -rf build
.PHONY: mac project clean
