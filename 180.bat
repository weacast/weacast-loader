gdal_translate -a_ullr -360.125 90.125 -0.125 -90.125 0 0_shifted 
gdalbuildvrt 0.vrt 0 0_shifted
gdal_translate 0.vrt 0_180.vrt -projwin -180.125 90.125 179.875 -90.125 -of VRT
gdalwarp -overwrite -ot Float32 -wo NUM_THREADS=6 -wo SOURCE_EXTRA=100 0_180.vrt 0_180.tif 
