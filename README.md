# virtual-webcam-js
Virtual USB-webcam (UVC compliant) using NodeJS and USB/IP for Linux.

Warning, this software is a prototype, check out the source code before using.

## Example: x11grab

Create a local virtual USB-webcam device, using FFMpeg's x11grab functionality to record the screen:

    node virtual-webcam.js --loopback --width 1920 --height 1080 --format yuyv422 --framerate 30 --id-vendor 1d6b --id-product 0102 ':0.0+0,0'

Now a new /dev/video device is available, check details using:

    v4l2-ctl --list-ctrls-menus --list-formats-ext -d /dev/videoX

View sample output using:

    ffplay /dev/videoX
