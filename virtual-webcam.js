const net = require('net');
const fs = require('fs');
const child_process = require('child_process');
const events = require('events');
const os = require('os');

const usb_uvc_device = require('./usb-uvc-device.js');
const usbip_socket = require('./usbip-socket.js');
const modprobe = require('./modprobe.js');

/*
try to use:
#define WEBCAM_VENDOR_ID		0x1d6b	// Linux Foundation
#define WEBCAM_PRODUCT_ID		0x0102	// Webcam A/V gadget
#define WEBCAM_DEVICE_BCD		0x0010	// 0.10
for generic definition
    
    
ffmpeg -y -f v4l2 -framerate 30 -input_format yuyv422 -video_size 640x480 -use_wallclock_as_timestamps 1 -i /dev/video2 -c:v rawvideo -r 30 -f rawvideo pipe:1 | ffplay -framerate 30 -video_size 640x480 -pixel_format yuyv422 -f rawvideo pipe:0 2>/dev/null',
*/

var usage = function()
{
    return [
        'Usage:',
        '    Screen-grab as input (x11grab):',
        '    ' + process.argv[0] + ' ' + process.argv[1] + ' --framerate 1 :0.0+0,0',
        '',
        '    if without --loopback, attach manually:',
        '    sudo modprobe vhci-hcd', // v4l2loopback, usbmon, libcomposite, dwc2, dummy_hcd
        '    sudo usbip --tcp-port 3241 attach -r 127.0.0.1 -b 1-1',
        '    sudo usbip --tcp-port 3241 detach -p 00',
        '',
        'Testing:',
        '    ffplay /dev/video2', 
        '',
        '',
        ''
    ].join(os.EOL);
};

var help = function()
{
    return usage();
};

var parse_options = function(args, map)
{
    args = args || [];
    map = map || {};
    
    var options = {};
    
    for(var i=0;i<args.length;++i)
    {
        var opt = args[i];
        
        if(opt === '--' || !opt.startsWith('-'))
        {
            break; // explicit '--', or no more options
        }
        else
        {
            if(opt in map)
            {
                var skip = map[opt];
                
                // turn -h into --help
                if(typeof skip === 'string')
                {
                    opt = skip;
                    skip = map[skip];
                }
                
                // turn --some-option into someOption
                var key = opt.replace(/^-+/g, '').replace(/[-]([a-z])/gi, function($0, $1){return $1.toUpperCase();});
                
                // set option (optionally with a given value)
                options[key] = skip && ++i < args.length && args[i] || true;
            }
            else
            {
                throw new Error('Unrecognized option (' + opt + '). If not an option, add -- before the option: "--" "' + opt + '"');
            }
        }
    }
    
    // _args are the default options that come after the explicitly flagged options, usually an input filename or a command name
    options._args = args.slice(i);
    
    return options;
};

(async function main()
{
    var options = parse_options(process.argv.slice(2), {
        '-h': '--help',
        '-p': '--port',
        '-l': '--loopback',
        '--port': 1,
        '--host': 1,
        '--width': 1,
        '--height': 1,
        '--format': 1,
        '--framerate': 1,
        '--loopback': 0,
        '--id-vendor': 1,
        '--id-product': 1,
        '--help': 0
    });
    
    if(options.help)
    {
        console.log(await help());
        return;
    }
    
    await modprobe('vhci-hcd');
    
    var host = options.host = options.host || '127.0.0.1';
    var port = options.port = options.port || '3241';
    var frameWidth = options.width = parseInt(options.width) || 640;
    var frameHeight = options.height = parseInt(options.height) || 480;
    var pixelFormat = format = options.format = options.pixelFormat = options.format || 'yuyv422';
    var frameLength = frameWidth * frameHeight;
    if(pixelFormat === 'yuyv422')
    {
        // colors are only subsampled horizontally
        // 16 bits per pixel, because 4x8 + 2x8 + 2x8 = 64 bits per 4 pixels
        frameLength = 16 * frameWidth * frameHeight / 8;
    }
    else if(pixelFormat === 'nv12')
    {
        // colors are subsampled horizontally and vertically
        // 12 bits per pixel, because 4x8 + 8 + 8 = 48 bits per 4 pixels
        frameLength = 12 * frameWidth * frameHeight / 8;
    }
    else if(pixelFormat === 'yv12')
    {
        // colors are subsampled horizontally and vertically
        // 12 bits per pixel, because 4x8 + 8 + 8 = 48 bits per 4 pixels
        frameLength = 12 * frameWidth * frameHeight / 8;
    }
    else if(pixelFormat === 'nv21')
    {
        // colors are subsampled horizontally and vertically
        // 12 bits per pixel
        frameLength = 12 * frameWidth * frameHeight / 8;
    }
    var framerate = options.framerate = options.framerate || options.rate || options.fps || 30;
    
    options.frameLength = frameLength;
    
    // console.log('format = ' + options.pixelFormat + ', resolution = ' + options.width + 'x' + options.height + ', framelength = ' + options.frameLength + ' bytes');
    
    var source = new events();
    source.stream = process.stdin;
    
    // TODO: this won't work, what if we want to pass pipe:0 through ffmpeg to convert it?
    // ffmpeg would have to automatically detect and convert the format
    // so we need to set some raw or ffmpeg input-mode
    
    var inputfile = options._args.length > 0 ? options._args[0] : 'pipe:0';
    
    if(/pipe:[0-9]+/g.test(inputfile))
    {
        var fd = parseInt(inputfile.substring(5));
        
        console.log('Reading from filedescriptor ' + fd + '...');
        
        source.stream = fs.createReadStream('', {
            fd: fd
        });
    }
    else
    {
        // create process to read from file or /dev/video.. (default using ffmpeg, otherwise we may add option for --gstreamer, etc)
        var cmd = [
            'ffmpeg',
            '-i', inputfile,
            '-c:v', 'rawvideo',
            '-pix_fmt', pixelFormat,
            '-s', frameWidth + 'x' + frameHeight,
            '-framerate', ''+ framerate,
            '-f', 'rawvideo',
            'pipe:1'
        ];
        
        if(pixelFormat === 'yv12')
        {
            // make compatible pixelformat for ffmpeg (ffmpeg does not recognize yv12):
            cmd[6] = 'yuv420p';
            cmd.splice(7, 0, '-vf', 'shuffleplanes=0:2:1');
        }
        else if(pixelFormat === 'mjpeg')
        {
            cmd[4] = 'mjpeg';
            cmd[12] = 'mjpeg';
            cmd.splice(5, 2); // remove pix_fmt, this does not apply to mjpeg
        }
        
        // if regex matches screen-grab coordinates, such as: ':0.0+0,0', then:
        if(/:[0-9.,+-]+/gi.test(inputfile))
        {
            // add x11grab type:
            cmd.splice(1, 0, '-f', 'x11grab');
        }
        
        // we could implement a lazy stream, where only if a device is attached, it will start this command, and close if no subscribers to the stream
        
        console.log('Source using: ' + cmd.join(' '));
        
        var cp = child_process.spawn(cmd[0], cmd.slice(1));
        cp.stderr.on('data', function(){}); // consume but ignore stderr
        cp.on('close', function(exit_code)
        {
            if(exit_code !== 0)
            {
                console.log('Source process (' + cmd.join(' ') + ') closed with non-zero exit code (' + exit_code + ').');
            }
        });
        
        source.stream = cp.stdout;
    }
    
    // we may need an additional converter ffmpeg process
    // that converts to several pixelformats
    // otherwise we can just provide one single format and resolution to choose from in our webcam, that is fine too for now
    
    // pass source data to uvcdev as frames
    var queue = [];
    var queueLength = 0;
    var queueSearchIndex = 0;
    var queueSearchOffset = 0;
    var checkQueue = function()
    {
        if(format === 'mjpeg')
        {
            // dynamic frame based on start/end markers ffd8 and ffd9
            var frameStart = -1;
            var frameEnd = -1;
            
            // instead of starting from the start again every time, remember which part of queue we already looked through
            while(queueSearchIndex < queue.length)
            {
                var buf = queue[queueSearchIndex++];
                
                for(var i=0;i+1<buf.length;++i)
                {
                    if(buf[i] === 0xff)
                    {
                        if(buf[i+1] === 0xd8)
                        {
                            frameStart = queueSearchOffset + i;
                        }
                        else if(buf[i+1] === 0xd9)
                        {
                            // ignore frameEnd if there is no frameStart
                            if(frameStart !== -1)
                            {
                                // frameEnd should include 0xff,0xd9
                                frameEnd = queueSearchOffset + i+1 + 1;
                                break;
                            }
                        }
                    }
                }
                
                queueSearchOffset += buf.length;
            }
            
            if(frameEnd !== -1 && frameStart < frameEnd)
            {
                var buf = Buffer.concat(queue);
                
                queue = [];
                queueLength = 0;
                queueSearchIndex = 0;
                queueSearchOffset = 0;
                
                var framedata = buf.slice(frameStart, frameEnd);
                if(buf.length > framedata.length)
                {
                    var remainder = buf.slice(framedata.length);
                    queue.push(remainder);
                    queueLength += remainder.length;
                }
                
                source.emit('frame', framedata);
            }
        }
        else
        {
            // fixed length frame:
            
            while(queueLength >= frameLength)
            {
                var buf = Buffer.concat(queue);
                
                queue = [];
                queueLength = 0;
                
                var framedata = buf.slice(0, frameLength);
                if(buf.length > frameLength)
                {
                    var remainder = buf.slice(frameLength);
                    queue.push(remainder);
                    queueLength += remainder.length;
                }
                
                source.emit('frame', framedata);
            }
        }
    };
    source.stream.on('data', function(buf)
    {
        queue.push(buf);
        queueLength += buf.length;
        
        checkQueue();
    });
    source.stream.on('error', function(err)
    {
        console.log('Source (' + inputfile + ') error:');
        if(/pipe:[0-9]+/g.test(inputfile))
        {
            if(err && err.code === 'ENOENT')
            {
                console.log('File descriptor is closed, do not forget to open ' + inputfile + ' and/or write something to it.');
            }
            else
            {
                console.log(err);
            }
        }
        else
        {
            console.log(err);
        }
    });
    source.stream.on('close', function()
    {
        console.log('Source (' + inputfile + ') closed. Exiting.');
        process.exit(0);
    });
    
    // start server
    var server = net.createServer(function(socket)
    {
        console.log('New device connected at ' + (socket.remoteFamily === 'IPv6' ? '[' + socket.remoteAddress + ']' : socket.remoteAddress) + ':' + socket.remotePort);
        
        // create a local uvcdev instance, so that even though the source is the same, we may set different options per device
        var uvcdev = usb_uvc_device.create(options);
        
        // input data to UVC-device
        source.on('frame', function(framebuffer)
        {
            uvcdev.setFrame(framebuffer);
        });
        
        var usbip = usbip_socket.create({}, uvcdev);
        
        // pipe data between socket and usbip
        usbip.on('data', function(buf)
        {
            if(!buf || buf === true) return;
            
            socket.write(buf);
        });
        socket.on('data', function(buf)
        {
            usbip.parse(buf);
        });
        
        socket.on('error', function(e)
        {
            console.log('socket error: ');
            console.log(e);
            
            process.exit(1);
        });
        socket.on('close', function(e)
        {
            console.log('Connection at ' + (socket.remoteFamily === 'IPv6' ? '[' + socket.remoteAddress + ']' : socket.remoteAddress) + ':' + socket.remotePort + ' was closed.');
        });
    });
    server.on('listening', function()
    {
        console.log('USB/IP server listening at ' + host + ':' + port);
        console.log('');
        
        console.log(usage());
    });
    server.on('error', function(err)
    {
        console.log('Failed to start USB/IP server at ' + host + ':' + port + ' (' + err.code + ')');
    });
    server.listen(parseInt(port), host);
    
    // auto-connect locally if options indicate this:
    if(options.loopback)
    {
        server.once('listening', function()
        {
            console.log('Attaching device locally (--loopback, -l).');
            
            var cmd = [
                'usbip',
                '--tcp-port', port,
                'attach',
                '-r', host,
                '-b', '1-1'
            ];
            
            var cp = child_process.spawn(cmd[0], cmd.slice(1));
            cp.stdout.on('data', function(){}); // consume but ignore
            cp.stderr.on('data', function(){}); // consume but ignore
            cp.on('close', function(exit_code)
            {
                if(exit_code !== 0)
                {
                    console.log('Failed to attach device locally (--loopback, -l).');
                    console.log('Command exited with non-zero exitcode (' + exit_code + '): ' + cmd.join(' '));
                }
            });
        });
    }
})();



/* for debugging, usage: parseURB('somehexstringincludingURBsetup')
 * 
var parseURB = function(urbData)
{
    if(typeof urbData === 'string') urbData = Buffer.from(urbData, 'hex');
    var i = 0;
    var bmRequestType = urbData.slice(i, i+=1).readUInt8(); // bitmask D0..4, D5..6, D7:
    var bmRequestType_dataPhaseTransferDirection = (bmRequestType & 0b10000000) * 2 / 256; // 0 = Host to Device, 1 = Device to Host
    var bmRequestType_type = (bmRequestType & 0b01100000) * 4 / 128; // 0 = Standard, 1 = Class, 2 = Vendor, 3 = Reserved
    var bmRequestType_recipient = (bmRequestType & 0b00011111) * 32 / 32; // 0 = Device, 1 = Interface, 2 = Endpoint, 3 = Other, 4..31 = Reserved
    var bRequest = urbData.slice(i, i+=1).readUInt8(); // any of STANDARD_DEVICE_REQUEST values, ...
    var wValue = urbData.slice(i, i+=2).readUInt16LE();
    var wIndex = urbData.slice(i, i+=2).readUInt16LE();
    var wLength = urbData.slice(i, i+=2).readUInt16LE(); // is max reply byte count
    
    return {
        direction: bmRequestType_dataPhaseTransferDirection,
        type: bmRequestType_type,
        recipient: bmRequestType_recipient,
        request: bRequest + ' (0x' + Buffer.from([bRequest]).toString('hex') + ')',
        wValue: '0x' + Buffer.fromUIntBE(wValue, 2).toString('hex'),
        wIndex: '0x' + Buffer.fromUIntBE(wIndex, 2).toString('hex'),
        wLength: wLength,
        data: urbData.slice(i).toString('hex')
    };
};


*/
