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
