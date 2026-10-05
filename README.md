# mnist in euslisp with blas

# Installation:

(1) install ROS-O  
    follow https://ros.packages.techfak.net/
	
(2) install roseus  
    sudo apt install ros-one-roseus

(3) setup  
    make

# Execution:

    roseus nn.l  

    $ (test-mnist-batch 200)  
    $ (test-mnist-test)  
    $ (test-mnist-train)  

# CUDA (GPU) version

    (cd CUDA; make) && (cd CUDAPROD; make)
    roseus nn-cuda.l

    $ (test-mnist-batch-cuda 200)                 ;; train on GPU (FP64, weights and data resident on GPU)
    $ (test-mnist-batch-cuda 200 :precision 32)   ;; FP32
    $ (test-mnist-batch-lisp 200 :dgemm :cuda)    ;; nn.l loop as is, only dgemm on GPU
    $ (test-mnist-cuda-test)                      ;; test mlp/mnist-mlp-19.l on GPU

    irteusgl bench-cuda.l                         ;; compare EusLisp-CUDA connection methods

Connection methods (see docs/mnist_cuda.pptx):
- A: defforeign + C shared library (cudalib.l, CUDA/src/cudamlp.cu)
- B: EusLisp C extension module like MATPROD (CUDAPROD/src/cudaprod.c)
- C: defforeign libcublas.so directly (cuda-direct.l)
- D: separate Python/PyTorch process via piped-fork (cuda-ipc.l, ipc/torch_server.py)

# CNN version

    (cd CUDA; make)
    roseus nn-cnn.l

    $ (test-mnist-cnn *cnn-net*)                 ;; CNN (conv5x5 20 - pool - conv5x5 50 - pool - fc500 - fc10), GPU FP32
    $ (test-mnist-cnn *lenet5-net*)              ;; LeNet-5 like CNN
    $ (test-mnist-cnn *mlp-net* :params :nnl)    ;; without CNN (same MLP and initial weights as nn.l)
    $ (test-mnist-cnn *cnn-net* :device :cpu)    ;; CPU (OpenMP + OpenBLAS)
    $ (bench-mnist-cnn)                          ;; comparison (see docs/mnist_cnn.pptx)

# Smartphone (browser) version

    python3 phone/make_data.py                     # data, weights and ONNX models from the EusLisp results
    cd phone/site && python3 -m http.server 8000   # open http://<this PC>:8000/ on a phone in the same LAN

The page runs the MLP and CNN with hand-written JavaScript and TensorFlow.js
(WASM / WebGL / WebGPU / CPU) and measures inference and training time.
phone/onnx/*.onnx can be used from apps (ONNX Runtime Mobile, Core ML via coremltools).
See docs/mnist_phone.pptx.

# Mac and iPhone version

    make -C ios mac && ios/build/mac/mnistbench           # Mac: C++ + Accelerate, GPU (MPSGraph), Core ML
    make -C ios project DEVELOPMENT_TEAM=<team id>        # iPhone app (XcodeGen), then build/run in Xcode

The same benchmark code (ios/MNISTBench) runs on Mac and iPhone. See docs/mnist_mac_iphone.pptx.

# EusView (robot viewer) -- moved to kxreus

The EusView apps (iPhone / Mac / Android / desktop, jskeus and kxreus robots, BVH, whole-body QP) and
their slides were in eusview/ and docs/eusview.pptx of this branch. They were moved to kxreus/eusview
(GitHub inabajsk/kxreus, eusview/ and eusview/docs/) on 2026-10-06.
