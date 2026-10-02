# libcudaprod.so : MATPROD 形式の EusLisp モジュール (load-library で読む)
#   計算本体は ../CUDA/$(ARCHDIR)/libcudamlp.so  (先に cd ../CUDA; make)
ARCHDIR ?= $(shell uname -m | sed 's/aarch64/LinuxARM/; s/x86_64/Linux64/')
MACHINE  = $(shell uname -m)
ifeq ($(MACHINE),aarch64)
ARCHFLAGS = -Daarch64 -DARM -Darmv8
else
ARCHFLAGS = -Dx86_64
endif
CUDAMLP = $(abspath ../CUDA/$(ARCHDIR))
CFLAGS  = -O2 -fPIC -w -DLinux -D_REENTRANT -DGCC -DGCC3 -DTHREADED -DPTHREAD -D$(ARCHDIR) \
          $(ARCHFLAGS) -falign-functions=8 -I$(EUSDIR)/include
TARGET  = $(ARCHDIR)/libcudaprod.so

all: $(TARGET)

$(ARCHDIR)/cudaprod.o: src/cudaprod.c
	mkdir -p $(ARCHDIR)
	gcc $(CFLAGS) -DCOMPILE_LIB -c $< -o $@

$(TARGET): $(ARCHDIR)/cudaprod.o $(CUDAMLP)/libcudamlp.so
	gcc -shared -o $@ $< $(EUSDIR)/$(ARCHDIR)/lib/libeusx.so -L$(CUDAMLP) -lcudamlp -Wl,-rpath,$(CUDAMLP)

clean:
	rm -f $(TARGET) $(ARCHDIR)/cudaprod.o
