# libcudamlp.so : CUDA (cuBLAS) backend for nn.l  (see ../cudalib.l)
CUDA_HOME ?= /usr/local/cuda
NVCC      ?= $(CUDA_HOME)/bin/nvcc
# GPU arch: DGX Spark (GB10) = sm_121.  override e.g. make CUDA_ARCH=sm_86
CUDA_ARCH ?= $(shell nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>/dev/null | head -1 | sed 's/\.//; s/^/sm_/')
ifeq ($(CUDA_ARCH),)
CUDA_ARCH = sm_121
endif
ARCHDIR   ?= $(shell uname -m | sed 's/aarch64/LinuxARM/; s/x86_64/Linux64/')
# OpenBLAS (ILP64) for the CPU reference engine (cpumlp_*)
BLASDIR   ?= $(firstword $(wildcard /usr/lib/$(shell uname -m)-linux-gnu/openblas64-pthread /usr/lib/$(shell uname -m)-linux-gnu/openblas64))

TARGET = $(ARCHDIR)/libcudamlp.so
CNNTARGET = $(ARCHDIR)/libcudacnn.so

all: $(TARGET) $(CNNTARGET)

$(TARGET): src/cudamlp.cu
	mkdir -p $(ARCHDIR)
	$(NVCC) -O3 -std=c++17 -arch=$(CUDA_ARCH) -shared -Xcompiler -fPIC -o $@ $< \
	  -L$(CUDA_HOME)/lib64 -lcublas -lcudart -L$(BLASDIR) -lblas64 \
	  -Xlinker -rpath=$(CUDA_HOME)/lib64 -Xlinker -rpath=$(BLASDIR)

# CNN エンジン (GPU / CPU 両用. CPU 側は OpenMP + OpenBLAS)
$(CNNTARGET): src/cudacnn.cu
	mkdir -p $(ARCHDIR)
	$(NVCC) -O3 -std=c++17 -arch=$(CUDA_ARCH) --extended-lambda -shared -Xcompiler -fPIC -Xcompiler -fopenmp -o $@ $< \
	  -L$(CUDA_HOME)/lib64 -lcublas -lcudart -L$(BLASDIR) -lblas64 -lgomp \
	  -Xlinker -rpath=$(CUDA_HOME)/lib64 -Xlinker -rpath=$(BLASDIR)

clean:
	rm -f $(TARGET) $(CNNTARGET)
