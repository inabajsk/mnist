source ~/.bashrc
source /opt/ros/one/setup.bash
source ~/ros1_ws/devel/setup.bash
cd MATPROD
make
cd ../mlp
gunzip *.gz
cd ..


