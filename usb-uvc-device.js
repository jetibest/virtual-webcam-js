/*
 
For Android support, we must implement both NV12 and YV12.
These are both yuv420 formats, meaning that color-information is subsampled in horizontal and vertical direction.

 -> NV12 = 1 Y-plane, 1 UV-plane (interleaved) (v4l2 descr.: Y/CbCr 4:2:0)
 -> YV12 = 1 Y-plane, 1 V-plane, 1 U-plane (a.k.a. YVU420) (v4l2 descr.: Planar YVU 4:2:0)
 
yuyv422 v4l2 descr.: YUYV 4:2:2

V4L2_PIX_FMT_NV12/YUYV/YVU420

GUID for NV12 is: 3231564E-0000-0010-8000-00AA00389B71

#define UVC_GUID_FORMAT_NV12 \
	{ 'N',  'V',  '1',  '2', 0x00, 0x00, 0x10, 0x00, \
	 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71}
#define UVC_GUID_FORMAT_YV12 \
	{ 'Y',  'V',  '1',  '2', 0x00, 0x00, 0x10, 0x00, \
	 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71}

    - https://elixir.bootlin.com/linux/v4.9.12/source/drivers/media/usb/uvc/uvcvideo.h

32 31 56 4E -> 21VN

also see: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/videodev2.h


NV21 is YUV 4:2:0 (I420) -> YUV420/I420, aka YU12 (Planar YUV 4:2:0)

*/


module.exports = {
    create: function(options)
    {
        const STANDARD_DEVICE_REQUEST = {
            GET_STATUS: 0x00,                // wValue = 0, wIndex = 0, wLength = 2, data = device status
            CLEAR_FEATURE: 0x01,             // wValue = feature selector, wIndex = 0, wLength = 0, data = null
            SET_FEATURE: 0x03,               // wValue = feature selector, wIndex = 0, wLength = 0, data = null
            SET_ADDRESS: 0x05,               // wValue = device address, wIndex = 0, wLength = 0, data = null
            GET_DESCRIPTOR: 0x06,            // wValue = descriptor type and index, wIndex = 0 or language ID, wLength = descriptor length, data = descriptor
            SET_DESCRIPTOR: 0x07,            // wValue = descriptor type and index, wIndex = 0 or language ID, wLength = descriptor length, data = descriptor
            GET_CONFIGURATION: 0x08,         // wValue = 0, wIndex = 0, wLength = 1, data = configuration value
            SET_CONFIGURATION: 0x09          // wValue = configuration value, wIndex = 0, wLength = 0, data = null
        };
        const STANDARD_INTERFACE_REQUEST = {
            GET_STATUS: 0x00,                // wValue = 0, wIndex = interface, wLength = 2, data = interface status
            CLEAR_FEATURE: 0x01,             // wValue = feature selector, wIndex = interface, wLength = 0, data = null
            SET_FEATURE: 0x03,               // wValue = feature selector, wIndex = interface, wLength = 0, data = null
            GET_INTERFACE: 0x0a,             // wValue = 0, wIndex = interface, wLength = 1, data = alternative interface
            SET_INTERFACE: 0x0b              // wValue = alternative setting, wIndex = interface, wLength = 0, data = null
        };
        const STANDARD_ENDPOINT_REQUEST = {
            GET_STATUS: 0x00,                // wValue = 0, wIndex = endpoint, wLength = 2, data = endpoint status
            CLEAR_FEATURE: 0x00,             // wValue = feature selector, wIndex = endpoint, wLength = 0, data = null
            SET_FEATURE: 0x03,               // wValue = feature selector, wIndex = endpoint, wLength = 0, data = null
            SYNCH_FRAME: 0x12                // wValue = 0, wIndex = endpoint, wLength = 2, data = framenumber
        };
        const VIDEO_CLASS_REQUEST = {
            RC_UNDEFINED: 0x00,
            SET_CUR: 0x01,
            SET_CUR_ALL: 0x11,
            GET_CUR: 0x81,
            GET_MIN: 0x82,
            GET_MAX: 0x83,
            GET_RES: 0x84,
            GET_LEN: 0x85,
            GET_INFO: 0x86,
            GET_DEF: 0x87,
            GET_CUR_ALL: 0x91,
            GET_MIN_ALL: 0x92,
            GET_MAX_ALL: 0x93,
            GET_RES_ALL: 0x94,
            GET_DEF_ALL: 0x97
        };
        
        const DESCRIPTOR_TYPE = {
            DEVICE: 0x01,
            CONFIGURATION: 0x02,
            STRING: 0x03,
            INTERFACE: 0x04,
            ENDPOINT: 0x05,
            DEVICE_QUALIFIER: 0x06,
            OTHER_SPEED_CONFIGURATION: 0x07,
            INTERFACE_POWER: 0x08,
            OTG: 0x09,
            DEBUG: 0x0a,
            INTERFACE_ASSOCIATION: 0x0b,
            CS_UNDEFINED: 0x20,
            CS_DEVICE: 0x21,
            CS_CONFIGURATION: 0x22,
            CS_STRING: 0x23,
            CS_INTERFACE: 0x24,
            CS_ENDPOINT: 0x25
        };
        
        const DESCRIPTOR_SUB_TYPE = {
            VC_DESCRIPTOR_UNDEFINED: 0x00,
            VC_HEADER: 0x01,
            VC_INPUT_TERMINAL: 0x02,
            VC_OUTPUT_TERMINAL: 0x03,
            VC_SELECTOR_UNIT: 0x04,
            VC_PROCESSING_UNIT: 0x05,
            VC_EXTENSION_UNIT: 0x06,
            VC_ENCODING_UNIT: 0x07,
            
            VS_UNDEFINED: 0x00,
            VS_INPUT_HEADER: 0x01,
            VS_OUTPUT_HEADER: 0x02,
            VS_STILL_IMAGE_FRAME: 0x03,
            VS_FORMAT_UNCOMPRESSED: 0x04,
            VS_FRAME_UNCOMPRESSED: 0x05,
            VS_FORMAT_MJPEG: 0x06,
            VS_FRAME_MJPEG: 0x07,
            VS_FORMAT_MPEG2TS: 0x0a,
            VS_FORMAT_DV: 0x0c,
            VS_COLORFORMAT: 0x0d,
            VS_FORMAT_FRAME_BASED: 0x10,
            VS_FRAME_FRAME_BASED: 0x11,
            VS_FORMAT_STREAM_BASED: 0x12,
            VS_FORMAT_H264: 0x13,
            VS_FRAME_H264: 0x14,
            VS_FORMAT_H264_SIMULCAST: 0x15,
            VS_FORMAT_VP8: 0x16,
            VS_FRAME_VP8: 0x17,
            VS_FORMAT_VP8_SIMULCAST: 0x18,
            
            EP_UNDEFINED: 0x00,
            EP_GENERAL: 0x01,
            EP_ENDPOINT: 0x02,
            EP_INTERRUPT: 0x03
        };
        
        const FUNCTION_CLASS = {
            CC_VIDEO: 0x0e
        };
        
        const FUNCTION_SUB_CLASS = {
            SC_UNDEFINED: 0x00,
            SC_VIDEOCONTROL: 0x01,
            SC_VIDEOSTREAMING: 0x02,
            SC_VIDEO_INTERFACE_COLLECTION: 0x03
        };
        
        const FUNCTION_PROTOCOL = {
            PC_PROTOCOL_UNDEFINED: 0x00,
            PC_PROTOCOL_15: 0x01
        };
        
        const TERMINAL_TYPE = {
            TT_VENDOR_SPECIFIC: 0x0100,
            TT_STREAMING: 0x0101,
            
            ITT_VENDOR_SPECIFIC: 0x0200,
            ITT_CAMERA: 0x0201,
            ITT_MEDIA_TRANSPORT_INPUT: 0x0202,
            
            OTT_VENDOR_SPECIFIC: 0x0300,
            OTT_DISPLAY: 0x0301,
            OTT_MEDIA_TRANSPORT_OUTPUT: 0x0302,
            
            EXTERNAL_VENDOR_SPECIFIC: 0x0400,
            COMPOSITE_CONNECTOR: 0x0401,
            SVIDEO_CONNECTOR: 0x0402,
            COMPONENT_CONNECTOR: 0x0403
        };
        
        const LANGID = {
            EN_US: 0x0409
        };
        
        const BITMASK_REQUEST_TYPE = {
            DATA_PHASE_TRANSFER_DIRECTION: {
                HOST_TO_DEVICE: 0,
                DEVICE_TO_HOST: 1
            },
            TYPE: {
                STANDARD: 0,
                CLASS: 1,
                VENDOR: 2
            },
            RECIPIENT: {
                DEVICE: 0,
                INTERFACE: 1,
                ENDPOINT: 2,
                OTHER: 3
            }
        };
        
        Buffer.prototype.reverse = function reverse(offset, length)
        {
            // swap from BE to LE, or LE to BE for an individual field in the buffer
            offset = offset || 0;
            length = typeof length !== 'number' ? this.length : length;
            
            var tmp = Buffer.from(this);
            for(var i=0;i<length;++i)
            {
                tmp.writeUInt8(this.readUInt8(offset + length - 1 - i), offset + i);
            }
            return tmp;
        };
        
        Buffer.fromUIntBE = function fromUIntBE(value, byte_count)
        {
            var limit = Math.pow(2, 8 * byte_count); // to support signed input values
            var b = Buffer.alloc(byte_count || 1);
            b.writeUIntBE((value + limit) % limit, 0, byte_count || 1);
            return b;
        };
        Buffer.fromUIntLE = function fromUIntLE(value, byte_count)
        {
            var limit = Math.pow(2, 8 * byte_count); // to support signed input values
            var b = Buffer.alloc(byte_count || 1);
            b.writeUIntLE((value + limit) % limit, 0, byte_count || 1);
            return b;
        };
        
        var self = {};
        
        // read from stdin
        // grab frames
        // put new frame in framebuffer
        // then after whole frame is received
        // put frame in framebuffer that is not currently in use
        // if frame has been sent, remove it, so it won't be sent again
        self.setFrame = function(buffer)
        {
            self.framebuffer = buffer;
            
            // it is possible that a framebuffer was set, but we were not fast enough to consume it
            // in that case, the frame will be ignored/dropped
            // that is why the function is called setFrame, and not writeFrame
            // the framebuffer is set atomically, and may or may not be read
            // it is not queued into a buffer
        };
        self.onframeread = null; // one event listener may be set
        
        self.framebuffer = null;
        self.readNextFrameData = (function()
        {
            var index = -1;
            var offset = 0;
            var length = 0;
            var framebuffer = null;
            var epoch_s = 0;
            
            return function(n)
            {
                // try to consume a new frame if available
                if(length === 0)
                {
                    if(self.framebuffer !== null)
                    {
                        // move buffer to local variable, so that it cannot be changed anymore, and is marked as read
                        framebuffer = self.framebuffer;
                        self.framebuffer = null;
                        
                        // update values
                        ++index;
                        offset = 0;
                        length = framebuffer.length;
                        epoch_s = Date.now() * 0.001;
                        
                        // console.log('started reading: ' + length + ' at ' + Math.floor(epoch_s) + ' frame: ' + index);
                        
                        // emit event that frame is consumed for reading
                        if(typeof self.onframeread === 'function')
                        {
                            self.onframeread({
                                state: 0, // 0 = started reading frame
                                length: length,
                                epoch_s: epoch_s,
                                frameIndex: index
                            });
                        }
                    }
                    else
                    {
                        epoch_s = Date.now() * 0.001;
                    }
                }
                
                // grab next piece of frame in framebuffer
                var result = {
                    buffer: null,
                    isEOF: false,
                    epoch_s: epoch_s,
                    frameIndex: index
                };
                
                if(length === 0)
                {
                    result.buffer = Buffer.alloc(0);
                    result.isEOF = true;
                }
                else if(offset + n >= length)
                {
                    result.buffer = framebuffer.slice(offset);
                    result.isEOF = true; // mark as last partial buffer of this frame
                    
                    // console.log('finished reading: ' + length + ' at ' + Math.floor(epoch_s) + ' frame: ' + index);
                    
                    // emit onframeread event
                    if(typeof self.onframeread === 'function')
                    {
                        self.onframeread({
                            state: 1, // 1 = finished reading frame
                            length: length,
                            epoch_s: epoch_s,
                            frameIndex: index
                        });
                    }
                    
                    // end of frame
                    length = 0;
                }
                else
                {
                    result.buffer = framebuffer.slice(offset, offset += n);
                }
                
                return result;
            };
        })();
        
        self.wrapURB = function(bufs)
        {
            if(!bufs) bufs = Buffer.from([]); // empty URB data buffer
            if(!Array.isArray(bufs)) bufs = [bufs]; // ensure it is wrapped in an array
            
            var count = 0;
            for(var j=0;j<bufs.length;++j)
            {
                var buf = bufs[j];
                
                count += buf.length;
            }
            
            var packet = Buffer.alloc(8 + count);
            var i = 0;
            
            // URB setup bytes (8 bytes)
            Buffer.from([
                0, 0, 0, 0,
                0, 0, 0, 0
            ]).copy(packet, i);
            i += 8;
            
            for(var j=0;j<bufs.length;++j)
            {
                var buf = bufs[j];
                
                buf.copy(packet, i);
                i += buf.length;
            }
            
            return packet;
        };
        
        self.wrapFields = function(fields, maxLen)
        {
            var packets = [];
            
            if(!fields) fields = [];
            
            var count = 0;
            
            for(var j=0;j<fields.length;++j)
            {
                var f = fields[j];
                var v;
                
                if(typeof f === 'string')
                {
                    v = fields[++j];
                }
                else if(typeof f === 'object')
                {
                    v = f.value;
                }
                else if(typeof f === 'number')
                {
                    v = f;
                }
                else
                {
                    continue;
                }
                
                var packet = null;
                
                if(typeof v === 'number')
                {
                    packet = Buffer.alloc(1);
                    packet.writeUInt8(v);
                }
                else if(typeof v === 'string')
                {
                    packet = Buffer.alloc(v.length);
                    packet.write(v);
                }
                else if(v.copy)
                {
                    // v is a buffer
                    packet = v;
                }
                else if(v.type === 'Buffer')
                {
                    packet = Buffer.from(v.data);
                }
                else if(v)
                {
                    packet = Buffer.alloc(v.length);
                    packet.writeUIntLE(v.value, 0, v.length);
                }
                
                if(packet !== null)
                {
                    // check if this packet will exceed maxLen for the total packets buffer length
                    if(typeof maxLen === 'number' && count + packet.length > maxLen)
                    {
                        if(count < maxLen)
                        {
                            // pad remainder with zero-filled buffer
                            packets.push(Buffer.alloc(maxLen - count));
                        }
                        break;
                    }
                    else
                    {
                        packets.push(packet);
                        count += packet.length;
                    }
                }
            }
            
            return Buffer.concat(packets);
        };
        
        self.wrapMap = function(map, maxLen)
        {
            // desc._fields = ['bmHint', 'bFormatIndex', 'dwFrameInterval', ..., 'bMaxVersion'];
            // desc._sizes = [2, 1, 1, 4, 2, 2, 2, 2, 2, 4, 4, 4, 1, 1, 1, 1];
            if(typeof map === 'number')
            {
                return Buffer.fromUIntLE(map, maxLen);
            }
            else if(Array.isArray(map))
            {
                return self.wrapFields(map, maxLen);
            }
            else if(map._fields)
            {
                var packets = [];
                var count = 0;
                
                for(var i=0;i<map._fields.length;++i)
                {
                    var f = map._fields[i];
                    var v = map[f];
                    var packet = null;
                    
                    if(typeof v === 'number')
                    {
                        var c = map._sizes ? map._sizes[i] : (f.startsWith('w') ? 2 : f.startsWith('dw') ? 4 : 1);
                        packet = Buffer.alloc(c);
                        packet.writeUIntLE(v, 0, c);
                    }
                    else if(typeof v === 'string')
                    {
                        packet = Buffer.alloc(v.length);
                        packet.write(v);
                    }
                    else if(v.copy)
                    {
                        packet = v;
                    }
                    else if(v.type === 'Buffer')
                    {
                        packet = Buffer.from(v.data);
                    }
                    else if(v)
                    {
                        packet = Buffer.alloc(v.length);
                        packet.writeUIntLE(v.value, 0, v.length);
                    }
                    
                    if(packet !== null)
                    {
                        // check if this packet will exceed maxLen for the total packets buffer length
                        if(typeof maxLen === 'number' && count + packet.length > maxLen)
                        {
                            if(count < maxLen)
                            {
                                // pad remainder with zero-filled buffer
                                packets.push(Buffer.alloc(maxLen - count));
                            }
                            break;
                        }
                        else
                        {
                            packets.push(packet);
                            count += packet.length;
                        }
                    }
                }
                
                return Buffer.concat(packets);
            }
            else
            {
                // map may be: {type: 'Buffer', data: [...]} or Buffer instance
                return Buffer.from(map);
            }
        };
        
        self.wrapDescriptor = function(options)
        {
            var packet = Buffer.alloc(options.bLength);
            var i = 0;
            
            // bLength
            packet.writeUInt8(options.bLength, i);
            i += 1;
            
            // bDescriptorType
            packet.writeUInt8(options.bDescriptorType, i);
            i += 1;
            
            self.wrapFields(options.fields).copy(packet, i);
            
            return packet;
        };
        
        self.createStringDescriptor = function(strval)
        {
            var strbuf = typeof strval === 'string' ? Buffer.from(strval, 'utf16le') : strval;
            var desclen = 2 + strbuf.length;
            return self.wrapDescriptor({
                bLength: desclen,
                bDescriptorType: DESCRIPTOR_TYPE.STRING,
                fields: [
                    'utf16le', strbuf
                ]
            });
        };
        
        self.setMapValues = function(basemap, key, buf)
        {
            var map = basemap[key];
            
            if(typeof map === 'number')
            {
                basemap[key] = buf.readUIntLE(0, buf.length);
            }
            else if(map && (map.copy || map.type === 'Buffer'))
            {
                basemap[key] = Buffer.from(buf); // copy buffer
            }
            else if(map && map._fields)
            {
                var b_i = 0;
                
                for(var i=0;i<map._fields.length;++i)
                {
                    var f = map._fields[i];
                    var v = map[f];
                    
                    if(typeof v === 'number')
                    {
                        var c = map._sizes ? map._sizes[i] : (f.startsWith('w') ? 2 : f.startsWith('dw') ? 4 : 1);
                        
                        if(b_i + c > buf.length)
                        {
                            break; // end of buffer reached, before end of datastructure, perhaps partial structure from earlier protocol version
                        }
                        
                        map[f] = buf.readUIntLE(b_i, c);
                        b_i += c;
                    }
                    else if(v.copy)
                    {
                        if(b_i + v.length > buf.length)
                        {
                            break; // end of buffer reached, before end of datastructure, perhaps partial structure from earlier protocol version
                        }
                        
                        map[f] = buf.slice(b_i, b_i += v.length);
                    }
                    else if(v.type === 'Buffer') // after JSON.stringify/parse this is what becomes of the Buffer object: {type: 'Buffer', data: [...]}
                    {
                        v = Buffer.from(v.data);
                        
                        if(b_i + v.length > buf.length)
                        {
                            break; // end of buffer reached, before end of datastructure, perhaps partial structure from earlier protocol version
                        }
                        
                        map[f] = buf.slice(b_i, b_i += v.length);
                    }
                    else if(v)
                    {
                        if(b_i + v.length > buf.length)
                        {
                            break; // end of buffer reached, before end of datastructure, perhaps partial structure from earlier protocol version
                        }
                        
                        v.value = buf.readUIntLE(b_i, v.length);
                        b_i += v.length;
                    }
                }
            }
            // else: map does not exist, log?
        };
        
        const VIDEO_CLASS_REQUEST_NAMES = {
            '81': 'cur',
            '82': 'min',
            '83': 'max',
            '84': 'res',
            '85': 'len',
            '86': 'info', 
            '87': 'def'
        };
        
        /*
        34 = 4
        33 = 3
        32 = 2
        31 = 1
        30 = 0
        
        GH
        I = 0x49
        J = 0x4a
        K = 0x4b
        L = 0x4c
        M = 0x4d
        N = 0x4e
        */
        
        const UVC_GUID_FORMAT = {
            'nv21':    Buffer.from('4934323000001000800000aa00389b71', 'hex'),
            'nv12':    Buffer.from('4e56313200001000800000aa00389b71', 'hex'),
            'yv12':    Buffer.from('5956313200001000800000aa00389b71', 'hex'),
            'yuyv422': Buffer.from('5955593200001000800000aa00389b71', 'hex')
        };
        
        var idVendorBuffer = Buffer.from(options.idVendor = (options.idVendor || '13d3').replace(/^0x/gi, ''), 'hex');
        var idProductBuffer = Buffer.from(options.idProduct = (options.idProduct || '56a2').replace(/^0x/gi, ''), 'hex');
        var bcdDeviceBuffer = Buffer.from('1704', 'hex');
        var dwClockFrequencyBuffer = Buffer.fromUIntLE(0x00e4e1c0, 4);
        
        self.properties = {
            uvcVersion: 0x0100, // certain changes must be made in the implementation to accomodate the new version
            idVendor: idVendorBuffer, // 0x13d3, 0x1d6b
            idProduct: idProductBuffer, // 0x56a2, 0x0102
            bcdDevice: bcdDeviceBuffer, // 0x1704, 0x0010
            dwClockFrequency: dwClockFrequencyBuffer, // 15MHz
            bDeviceClass: Buffer.from('ef', 'hex'),
            bDeviceSubClass: Buffer.from('02', 'hex'),
            bDeviceProtocol: Buffer.from('01', 'hex'),
            bConfigurationValue: Buffer.from('01', 'hex'),
            bNumConfigurations: Buffer.from('01', 'hex'),
            bNumInterfaces: Buffer.from('02', 'hex'),
            strings: [
                Buffer.fromUIntLE(LANGID.EN_US, 2), // wLANGID[0]
                'USB2.0 HD UVC WebCam',
                '0x0001',
                'Azurewave',
                'USB Camera',
                'USB2.0 HD UVC WebCam',
                '???',
                'Realtek Extended Controls Unit'
            ],
            classInterfaceMap: { // [wIndex][wValue][info|cur|def|min|max|res]
                '0100': {
                    '0001': {
                        // set by cheese: 0100 02 06 15160500 0000 0000 0000 0000 0000 00000000 00000000 (LE)
                        // original: 0100 02 06 15160500 0000 0000 0000 0000 2000 00600900 000c0000 (LE)
                        // returned by uvc cam in ffmpeg: 010002061516050000000000000000002000 00600900 000c0000
                        // returned by us in ffmpeg:      000001011516050000000000000000002000 00201c00 000c0000
                        'def': {
                            _fields: ['bmHint', 'bFormatIndex', 'bFrameIndex', 'dwFrameInterval', 'wKeyFrameRate', 'wPFrameRate', 'wCompQuality', 'wCompWindowSize', 'wDelay', 'dwMaxVideoFrameSize', 'dwMaxPayloadTransferSize', 'dwClockFrequency', 'bmFramingInfo', 'bPreferredVersion', 'bMinVersion', 'bMaxVersion'],
                            _sizes: [2, 1, 1, 4, 2, 2, 2, 2, 2, 4, 4, 4, 1, 1, 1, 1],
                            bmHint: Buffer.fromUIntLE(0x0000, 2),
                            bFormatIndex: 1,
                            bFrameIndex: 1, // this is the index of our resolution/fps combination
                            dwFrameInterval: options.framerate ? Math.round(10000000/options.framerate) : 333333,
                            wKeyFrameRate: 0,
                            wPFrameRate: 0,
                            wCompQuality: 0,
                            wCompWindowSize: 0,
                            wDelay: 32,
                            dwMaxVideoFrameSize: options.frameLength || (1920 * 1080 * 2), // 614400
                            dwMaxPayloadTransferSize: 3072,
                            // from here, is only if higher usb version spec >= 0x0110:
                            dwClockFrequency: 0,
                            bmFramingInfo: 0,
                            bPreferredVersion: 0,
                            bMinVersion: 0,
                            bMaxVersion: 0
                        }
                    },
                    '0002': {
                        'def': {
                            // set by cheese: 0100 02 06 1516050 0000 0000 0000 0000 0200 000600900 000c0000 (LE)
                            _fields: ['bmHint', 'bFormatIndex', 'bFrameIndex', 'dwFrameInterval', 'wKeyFrameRate', 'wPFrameRate', 'wCompQuality', 'wCompWindowSize', 'wDelay', 'dwMaxVideoFrameSize', 'dwMaxPayloadTransferSize', 'dwClockFrequency', 'bmFramingInfo', 'bPreferredVersion', 'bMinVersion', 'bMaxVersion'],
                            _sizes: [2, 1, 1, 4, 2, 2, 2, 2, 2, 4, 4, 4, 1, 1, 1, 1],
                            bmHint: Buffer.fromUIntLE(0x0001, 2),
                            bFormatIndex: 1, // 2
                            bFrameIndex: 1, // 6
                            dwFrameInterval: options.framerate ? Math.round(10000000/options.framerate) : 333333,
                            wKeyFrameRate: 0,
                            wPFrameRate: 0,
                            wCompQuality: 0,
                            wCompWindowSize: 0,
                            wDelay: 32,
                            dwMaxVideoFrameSize: options.frameLength || (1920 * 1080 * 2), // 1843200,
                            dwMaxPayloadTransferSize: 3072,
                            // from here, is only if higher usb version spec >= 0x0110:
                            dwClockFrequency: 0,
                            bmFramingInfo: 0,
                            bPreferredVersion: 0,
                            bMinVersion: 0,
                            bMaxVersion: 0
                        }
                    }
                },
                // info bitmask: b0=supports GET, b1=supports SET, b2=disabled due to automatic mode, b3=autoupdate control, b4=async control, b5=disabled due to incompatibility with commit state, b6-7=reserved
                '0001': { // CAMERA_TERMINAL_CONTROL (camera input terminal)
                    '0002': { // CT_AE_MODE_CONTROL "exposure_auto", set to aperture priority mode (3)
                        'info': Buffer.from([0b00000011]),
                        'def': 0b00001000, // bAutoExposureMode: b0=manual mode, b1=auto mode, b2=manual exposure time and auto iris, b3=auto exposure time and manual iris, b4-7=reserved
                        'res': 0b00001001,
                        'cur': 0b00001000
                    },
                    '0003': { // CT_AE_PRIORITY_CONTROL "exposure_auto_priority"
                        'info': Buffer.from([0b00000011]),
                        'def': 0, // 0 is constant framerate, 1 is dynamic framerate
                        'cur': 1
                    },
                    '0004': { // CT_EXPOSURE_TIME_ABSOLUTE_CONTROL "exposure_absolute"
                        'info': Buffer.from([0b00001111]),
                        // 'def': 1660, // 1660 is 166ms (10000 = 1s, 1 = 0.1ms)
                        // 'cur': 1660
                        'def': 166,
                        'min': 50,
                        'max': 10000,
                        'res': 1,
                        'cur': 166
                    }
                },
                '0002': { // PROCESSING_UNIT_CONTROL, see: Table A-13: Processing Unit Control Selectors (processing unit)
                    '0001': { // PU_BACKLIGHT_COMPENSATION_CONTROL "backlight_compensation"
                        'info': Buffer.from([0b00000011]),
                        'def': 0,
                        'min': 0,
                        'max': 1,
                        'res': 1,
                        'cur': 0
                    },
                    '0002': { // PU_BRIGHTNESS_CONTROL ? "brightness"
                        'info': Buffer.from([0b00000011]),
                        'def': 0,
                        'min': -64, // -64
                        'max': 64,
                        'res': 1,
                        'cur': 0
                    },
                    '0003': { // PU_CONTRAST_CONTROL ? "contrast"
                        'info': Buffer.from([0b00000011]),
                        'def': 50,
                        'min': 0,
                        'max': 100,
                        'res': 1,
                        'cur': 50
                    },
                    '0004': { // PU_GAIN_CONTROL "gain"
                        'info': Buffer.from([0b00000011]),
                        'def': 0,
                        'min': 0,
                        'max': 100,
                        'res': 1,
                        'cur': 0
                    },
                    '0005': { // PU_POWER_LINE_FREQUENCY_CONTROL "power_line_frequency"
                        'info': Buffer.from([0b00000011]),
                        'def': 2,
                        'min': 0,
                        'max': 2,
                        'cur': 2
                    },
                    '0006': { // PU_HUE_CONTROL "hue"
                        'info': Buffer.from([0b00000011]),
                        'def': 0,
                        'min': -180,
                        'max': 180,
                        'res': 1,
                        'cur': 0
                    },
                    '0007': { // PU_SATURATION_CONTROL "saturation"
                        'info': Buffer.from([0b00000011]),
                        'def': 64,
                        'min': 0,
                        'max': 100,
                        'res': 1,
                        'cur': 64
                    },
                    '0008': { // PU_SHARPNESS_CONTROL "sharpness"
                        'info': Buffer.from([0b00000011]),
                        'def': 50,
                        'min': 0,
                        'max': 100,
                        'res': 1,
                        'cur': 50
                    },
                    '0009': { // PU_GAMMA_CONTROL "gamma"
                        'info': Buffer.from([0b00000011]),
                        'def': 100,
                        'min': 72,
                        'max': 500,
                        'res': 1,
                        'cur': 100
                    },
                    '000a': { // PU_WHITE_BALANCE_TEMPERATURE_CONTROL "white_balance_temperature"
                        'info': Buffer.from([0b00001111]),
                        'def': 4600,
                        'min': 2800,
                        'max': 6500,
                        'res': 10,
                        'cur': 4600
                    },
                    '000b': { // PU_WHITE_BALANCE_TEMPERATURE_AUTO_CONTROL "white_balance_temperature_auto"
                        'info': Buffer.from([0b00000011]),
                        'def': 1,
                        'min': 1,
                        'max': 1,
                        'res': 1,
                        'cur': 1
                    }
                }
            },
            deviceDescriptor: {
                bLength: 0x12,
                bDescriptorType: DESCRIPTOR_TYPE.DEVICE,
                fields: [
                    'bcdUSB', Buffer.fromUIntLE(0x0200, 2),
                    'bDeviceClass', 0xef, // miscellaneous device class
                    'bDeviceSubClass', 0x02, // common class
                    'bDeviceProtocol', 0x01, // interface association descriptor
                    'bMaxPacketSize0', 64,
                    'idVendor', Buffer.from(idVendorBuffer).reverse(),
                    'idProduct', Buffer.from(idProductBuffer).reverse(),
                    'bcdDevice', Buffer.from(bcdDeviceBuffer).reverse(),
                    'iManufacturer', 0x03,
                    'iProduct', 0x01,
                    'iSerialNumber', 0x02,
                    'bNumConfigurations', 1
                ]
            },
            configurationDescriptorArray: [
                // Configuration descriptor
                {
                    bLength: 9,
                    bDescriptorType: DESCRIPTOR_TYPE.CONFIGURATION,
                    fields: [
                        'wTotalLength', Buffer.fromUIntLE(
                            9 + // CONFIGURATION
                            8 + // INTERFACE_ASSOCIATION
                            
                            9 + // INTERFACE
                            13 + // CS_INTERFACE: VC_HEADER
                            18 + // CS_INTERFACE: VC_INPUT_TERMINAL
                            12 + // CS_INTERFACE: VC_PROCESSING_UNIT
                            9 + // CS_INTERFACE: VC_OUTPUT_TERMINAL
                            7 + // ENDPOINT
                            
                            5 + // CS_ENDPOINT: EP_INTERRUPT
                            
                            9 + // INTERFACE
                            14 + // CS_INTERFACE: VS_INPUT_HEADER
                            (options.pixelFormat === 'mjpeg' ? 11 : 27) + // CS_INTERFACE: VS_FORMAT_MJPEG/UNCOMPRESSED
                            30 + // CS_INTERFACE: VS_FRAME_MJPEG/UNCOMPRESSED
                            22 + // CS_INTERFACE: VS_STILL_IMAGE_FRAME
                            6 + // CS_INTERFACE: VS_COLORFORMAT
                            9 +
                            7 // ENDPOINT
                                , 2), // 516 // 735 bytes for configuration (0x02df)
                        'bNumInterfaces', 2, // 2
                        'bConfigurationValue', 1,
                        'iConfiguration', 4,
                        'bmAttributes', 0b10000000, // 0x80
                        'bMaxPower', 250
                    ]
                },
                // Interface Association Descriptor
                {
                    bLength: 8,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE_ASSOCIATION,
                    fields: [
                        'bFirstInterface', 0, // interface number of the VideoControl interface that is associated with this function
                        'bInterfaceCount', 2, // 0x02 // bNumInterfaces? // number of contiguous Video interfaces that are associated with this function
                        'bFunctionClass', FUNCTION_CLASS.CC_VIDEO,
                        'bFunctionSubClass', FUNCTION_SUB_CLASS.SC_VIDEO_INTERFACE_COLLECTION,
                        'bFunctionProtocol', FUNCTION_PROTOCOL.PC_PROTOCOL_UNDEFINED,
                        'Ifunction', 5 // must match iInterface field of Standard VC Interface Descriptor
                    ]
                },
                
                
                // ---------- START OF INTERFACE 0 ----------
                
                // Standard VC Interface Descriptor
                {
                    bLength: 9,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        'bInterfaceNumber', 0,
                        'bAlternateSetting', 0,
                        'bNumEndpoints', 1,
                        'bInterfaceClass', FUNCTION_CLASS.CC_VIDEO,
                        'bInterfaceSubClass', FUNCTION_SUB_CLASS.SC_VIDEOCONTROL,
                        'bInterfaceProtocol', FUNCTION_PROTOCOL.PC_PROTOCOL_15,
                        'iInterface', 5 // index of String descriptor, must match iFunction field of the Standard Video Interface Collection IAD
                    ]
                },
                // Class-Specific VC Interface Descriptor
                {
                    bLength: 13,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VC_HEADER,
                        'bcdUVC', Buffer.fromUIntLE(0x0100, 2), // VC specification version
                        'wTotalLength', Buffer.fromUIntLE(
                            13 + // CS_INTERFACE: VC_HEADER
                            18 + // CS_INTERFACE: VC_INPUT_TERMINAL
                            12 + // CS_INTERFACE: VC_PROCESSING_UNIT
                            9    // CS_INTERFACE: VC_OUTPUT_TERMINAL
                            , 2), // 107, ength of all terminal and unit descriptors (incl. this vc_header)
                        'dwClockFrequency', dwClockFrequencyBuffer, // =15000000 = 15MHz
                        'bInCollection', 1, // number of streaming interfaces
                        'baInterfaceNr(1)', 1 // VideoStreaming interface 1 belongs to this VideoControl interface
                    ]
                },
                // Input Terminal Descriptor (Camera)
                {
                    bLength: 18,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VC_INPUT_TERMINAL,
                        'bTerminalID', 1,
                        'wTerminalType', Buffer.fromUIntLE(0x0201, 2),
                        'bAssocTerminal', 0, // always 0, no association
                        'iTerminal', 0,
                        'wObjectiveFocalLengthMin', Buffer.fromUIntLE(0x0000, 2),
                        'wObjectiveFocalLengthMax', Buffer.fromUIntLE(0x0000, 2),
                        'wOcularFocalLength', Buffer.fromUIntLE(0x0000, 2),
                        'bControlSize', 3, // number of bytes of the bmControls
                        'bmControls', Buffer.fromUIntLE(0x00000e, 3) // =14, supported controls
                    ]
                },
                // Processing unit descriptor
                {
                    bLength: 12,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VC_PROCESSING_UNIT,
                        'bUnitID', 2,
                        'bSourceID', 1,
                        'wMaxMultiplier', Buffer.fromUIntLE(0x0000, 2),
                        'bControlSize', 0x03, // 0x02, 0x7f 0x15 0x00
                        'bmControls', Buffer.fromUIntLE(0b000000000000011101111111, 3),
                        // 0=brightness
                        // 1=contrast
                        // 2=hue
                        // 3=saturation
                        // 4=sharpness
                        // 5=gamma
                        // 6=white balance temperature
                        // 7=white balance component
                        // 8=backlight compensation
                        // 9=gain
                        // 10=power line frequency
                        // 11=hue, auto
                        // 12=white balance temperature, auto
                        // 13=white balance component, auto
                        // 14=digital multiplier
                        // 15=digital multiplier limit
                        // 16=analog video standard
                        // 17=analog video lock status
                        // 18=contrast, auto
                        // 19..23=reserved, always zero
                        'iProcessing', 0x00,
                        'bmVideoStandards', 0x00
                    ]
                },
                // Output Terminal Descriptor
                {
                    bLength: 9,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VC_OUTPUT_TERMINAL,
                        'bTerminalID', 3, // 3
                        'wTerminalType', Buffer.fromUIntLE(TERMINAL_TYPE.TT_STREAMING, 2), // =TT_STREAMING
                        'bAssocTerminal', 0, // always 0, no association
                        'bSourceID', 2,// 6,
                        'iTerminal', 0
                    ]
                },
                // Interrupt Endpoint
                {
                    bLength: 7,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        'bEndpointAddress', 0x83, // 8=IN, 3=output terminal
                        'bmAttributes', 0x03, // isochronous transfer type, or asynchronous synchronization type
                        'wMaxPacketSize', Buffer.fromUIntLE(0x0010, 2), // max packet size of 16 bytes
                        'bInterval', 6 // one frame interval
                    ]
                },
                // Class-specific Interrupt Endpoint Descriptor: 0x25 (CS_ENDPOINT), 0x03 (EP_INTERRUPT), 0x1000 (16 bytes wMaxTransferSize status packet)
                {
                    bLength: 5,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_ENDPOINT,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.EP_INTERRUPT,
                        'wMaxTransferSize', Buffer.fromUIntLE(0x0010, 2) // 16 bytes
                    ]
                },
                
                // ------- END OF INTERFACE 0 ----------
                
                
                // ---------- START OF INTERFACE 1 -----------
                
                // Standard VS Interface Descriptor: 00 index of bAlternateSetting, 00 for bNumEndpoints
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        'bInterfaceNumber', 1, // index of this interface
                        'bAlternateSetting', 0, // index of this alternate setting
                        'bNumEndpoints', 0,
                        'bInterfaceClass', FUNCTION_CLASS.CC_VIDEO,
                        'bInterfaceSubClass', FUNCTION_SUB_CLASS.SC_VIDEOSTREAMING,
                        'bInterfaceProtocol', FUNCTION_PROTOCOL.PC_PROTOCOL_15,
                        'iInterface', 5 // index of String descriptor, must match iFunction field of the Standard Video Interface Collection IAD
                        // Buffer.from('0100000e020000', 'hex')
                    ]
                },
                {
                    bLength: 0x0e,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_INPUT_HEADER,
                        'bNumFormats', 1, // number of formats following
                        'wTotalLength', Buffer.fromUIntLE(
                            0x0e + // CS_INTERFACE: VS_INPUT_HEADER
                            (options.pixelFormat === 'mjpeg' ? 0x0b : 0x1b) + // CS_INTERFACE: VS_FORMAT_MJPEG/UNCOMPRESSED
                            0x1e + // CS_INTERFACE: VS_FRAME_MJPEG/UNCOMPRESSED
                            0x16 + // CS_INTERFACE: VS_STILL_IMAGE_FRAME
                            0x06   // CS_INTERFACE: VS_COLORFORMAT
                            , 2), // 107, total size of class-specific VS interface descriptors
                        'bEndpointAddress', 0x81, // address of endpoint for video data (input terminal)
                        'bmInfo', 0, // no dynamic format change supported
                        'bTerminalLink', 3, // reference to output terminal
                        'bStillCaptureMethod', 1, // 2 // device supports still image capture method 1
                        'bTriggerSupport', 1,
                        'bTriggerUsage', 0,
                        'bControlSize', 1, // size of following bmaControls in bytes
                        'bmaControls', 0 // no specific VS controls supported
                    ]
                },
                options.pixelFormat === 'mjpeg'
                ? {
                    bLength: 0x0b,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_FORMAT_MJPEG, // 0x05, this is not exactly the format descriptor yet, see bNumFrameDescriptors
                        'bFormatIndex', 1, // 1-based index of this format descriptor
                        'bNumFrameDescriptors', 1,
                        'bmFlags', 0,
                        'bDefaultFrameIndex', 1,
                        'bAspectRatioX', 0,// 0x02, // depends on options.width and options.height
                        'bAspectRatioY', 0,// 0x7f,
                        'bmInterlaceFlags', 0, // 0x15, bitmap: d0=interlaced stream or variable (1=yes), d1=fields per frame (0=2fields,1=1field), d2=field 1 first (1=yes), d3=reserved, d5..4=field pattern (00=field 1 only, 01=field 2 only, 10=regular pattern of fields 1 and 2, 11=random pattern of fields 1 and 2), d7..6=reserved
                        'bCopyProtect', 0
                    ]
                }
                : { // DESCRIPTOR_SUB_TYPE.VS_FRAME_UNCOMPRESSED
                    bLength: 0x1b,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE, // CS_INTERFACE
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_FORMAT_UNCOMPRESSED, // 0x04= VS_FORMAT_UNCOMPRESSED
                        'bFormatIndex', 1, // was actually 0x02
                        'bNumFrameDescriptors', 1, // number of frame descriptors following
                        'guidFormat', UVC_GUID_FORMAT[options.pixelFormat], // GUID for YUY2 (=yuyv422), 16 bytes
                        'bBitsPerPixel', Math.floor(8 * options.frameLength / (options.width * options.height)),// 16,
                        'bDefaultFrameIndex', 1,
                        'bAspectRatioX', 0,
                        'bAspectRatioY', 0,
                        'bmInterlaceFlags', 0,
                        'bCopyProtect', 0
                    ]
                },
                options.pixelFormat === 'mjpeg'
                ? {
                    bLength: 0x1e, // default is 38, could be more or less if custom bFrameIntervalType
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_FRAME_MJPEG,
                        'bFrameIndex', 1,
                        'bmCapabilities', 0,
                        'wWidth', Buffer.fromUIntLE(options.width || 1920, 2),
                        'wHeight', Buffer.fromUIntLE(options.height || 1080, 2),
                        'dwMinBitRate', Buffer.fromUIntLE((options.framerate * 8 * options.frameLength * 0.001) || (8 * 1920 * 1080 * 2), 4), // typical bitrate is 0.01->0.04 or so
                        'dwMaxBitRate', Buffer.fromUIntLE((options.framerate * 8 * options.frameLength * 0.10) || (80 * 1920 * 1080 * 2), 4),
                        'dwMaxVideoFrameBufferSize', Buffer.fromUIntLE(3 * options.frameLength || (1920 * 1080 * 2), 4),
                        'dwDefaultFrameInterval', Buffer.fromUIntLE(100000000 / options.framerate, 4), // originally 1000000 (=10fps?)
                        'bFrameIntervalType', 1,
                        'dwFrameInterval(1)', Buffer.fromUIntLE(10000000 / options.framerate, 4) // minimum interval
                    ]
                }
                : {
                    bLength: 0x1e,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_FRAME_UNCOMPRESSED, // = VS_FRAME_UNCOMPRESSED
                        'bFrameIndex', 1, // 2
                        'bmCapabilities', 0,
                        'wWidth', Buffer.fromUIntLE(options.width || 1920, 2),
                        'wHeight', Buffer.fromUIntLE(options.height || 1080, 2),
                        'dwMinBitRate', Buffer.fromUIntLE((options.framerate * 8 * options.frameLength) || (8 * 1920 * 1080 * 2), 4),
                        'dwMaxBitRate', Buffer.fromUIntLE((options.framerate * 8 * options.frameLength) || (80 * 1920 * 1080 * 2), 4),
                        'dwMaxVideoFrameBufferSize', Buffer.fromUIntLE(options.frameLength || (1920 * 1080 * 2), 4),
                        'dwDefaultFrameInterval', Buffer.fromUIntLE(100000000 / options.framerate, 4), // originally 1000000 (=10fps?)
                        'bFrameIntervalType', 1,
                        'dwFrameInterval(1)', Buffer.fromUIntLE(10000000 / options.framerate, 4) // minimum interval
                    ]
                },
                // Class-specific Still Image Frame Descriptor, (length != 0x0f), 0x24-0x03 CS_INTERFACE-VS_STILL_IMAGE_FRAME, 1280x720, 160x120
                {
                    bLength: 0x16,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_STILL_IMAGE_FRAME,
                        'bEndpointAddress', 0,
                        'bNumImageSizePatterns', 4,
                        'wWidth', Buffer.fromUIntLE(1280, 2),
                        'wHeight', Buffer.fromUIntLE(720, 2),
                        'wWidth', Buffer.fromUIntLE(160, 2),
                        'wHeight', Buffer.fromUIntLE(120, 2),
                        'wWidth', Buffer.fromUIntLE(320, 2),
                        'wHeight', Buffer.fromUIntLE(240, 2),
                        'wWidth', Buffer.fromUIntLE(640, 2),
                        'wHeight', Buffer.fromUIntLE(480, 2),
                        'bNumCompressionPtn', 0 // if 1, then also supply bCompression 0-100 in next field
                    ]
                },
                // Class-specific Color Matching Descriptor
                {
                    bLength: 0x06,
                    bDescriptorType: DESCRIPTOR_TYPE.CS_INTERFACE,
                    fields: [
                        'bDescriptorSubType', DESCRIPTOR_SUB_TYPE.VS_COLORFORMAT,
                        'bColorPrimaries', 1,
                        'bTransferCharacteristics', 1,
                        'bMatrixCoefficients', 4
                    ]
                },
                
                
                // 01 index of bAlternateSetting, in Standard VS Interface Descriptor
                {
                    bLength: 9,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        'bInterfaceNumber', 1,
                        'bAlternateSetting', 1, // 5
                        'bNumEndpoints', 1,
                        'bInterfaceClass', FUNCTION_CLASS.CC_VIDEO,
                        'bInterfaceSubClass', FUNCTION_SUB_CLASS.SC_VIDEOSTREAMING,
                        'bInterfaceProtocol', FUNCTION_PROTOCOL.PC_PROTOCOL_15,
                        'iInterface', 0 // unused
                    ]
                },
                // 3072 bytes
                {
                    bLength: 7,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        'bEndpointAddress', 0x81, // 8=IN, 1=input terminal
                        'bmAttributes', 0x05, // isochronous transfer type, or asynchronous synchronization type
                        'wMaxPacketSize', Buffer.fromUIntLE(0x0c00, 2), // max packet size of 3072 bytes
                        'bInterval', 1 // one frame interval
                    ]
                }
                //,
                /*
                // 01 index of bAlternateSetting, in Standard VS Interface Descriptor
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0101010e020000', 'hex')
                    ]
                },
                // 128 bytes (0x81 bEndpointAddress) wMaxPacketSize in Standard VS Isochronous Video Data Endpoint Descriptor
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105800001', 'hex')
                    ]
                },
                // 02 index of bAlternateSetting
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0102010e020000', 'hex')
                    ]
                },
                // 512 bytes
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105000201', 'hex')
                    ]
                },
                // 03 index of bAlternateSetting
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0103010e020000', 'hex')
                    ]
                },
                // 1024 bytes
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105000401', 'hex')
                    ]
                },
                // 04
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0104010e020000', 'hex')
                    ]
                },
                // 2816 bytes
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105000b01', 'hex')
                    ]
                },*/
                // 05
                /*{
                    bLength: 9,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        'bInterfaceNumber', 0,
                        'bAlternateSetting', 0, // 5
                        'bNumEndpoints', 1,
                        'bInterfaceClass', FUNCTION_CLASS.CC_VIDEO,
                        'bInterfaceSubClass', FUNCTION_SUB_CLASS.SC_VIDEOSTREAMING,
                        'bInterfaceProtocol', FUNCTION_PROTOCOL.PC_PROTOCOL_15,
                        'iInterface', 0 // unuse
                    ]
                },
                // 3072 bytes
                {
                    bLength: 7,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        'bEndpointAddress', 0x81,
                        'bmAttributes', 0x05, // isochronous transfer type, or asynchronous synchronization type
                        'wMaxPacketSize', Buffer.fromUIntLE(0x0c00, 2), // max packet size of 3072 bytes
                        'bInterval', 1 // one frame interval
                    ]
                } */ /*,
                // 06
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0106010e020000', 'hex')
                    ]
                },
                // 4992 bytes
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105801301', 'hex')
                    ]
                },
                // 07
                {
                    bLength: 0x09,
                    bDescriptorType: DESCRIPTOR_TYPE.INTERFACE,
                    fields: [
                        '',
                        Buffer.from('0107010e020000', 'hex')
                    ]
                },
                // 5120 bytes
                {
                    bLength: 0x07,
                    bDescriptorType: DESCRIPTOR_TYPE.ENDPOINT,
                    fields: [
                        '',
                        Buffer.from('8105001401', 'hex')
                    ]
                }*/
            ]
        };
        
        // automatically fill in 'cur' values based on 'def', where they are missing:
        (function()
        {
            for(var _k1 in self.properties.classInterfaceMap)
            {
                var m1 = self.properties.classInterfaceMap[_k1];
                for(var _k2 in m1)
                {
                    var m2 = m1[_k2];
                    if(m2 && m2.def)
                    {
                        // copy object, not same reference (note: Buffer will be automatically transformed into: {type: 'Buffer', data: [...]})
                        
                        if(!('cur' in m2)) m2.cur = JSON.parse(JSON.stringify(m2.def));
                        if(!('min' in m2)) m2.min = JSON.parse(JSON.stringify(m2.def));
                        if(!('max' in m2)) m2.max = JSON.parse(JSON.stringify(m2.def));
                    }
                }
            }
        })();
        
        var first = true;
        var clock = 0;
        var subClock = 0;
        var startFrame = 0;
        self.parse = function(urbData, options)
        {
            options = options || {};
            
            // it is asking for a status on the endpoint, I'm sure.
            
            if(options.direction === 1 && options.endpointNumber === 1 && options.numberOfPackets > 0)
            {
                // this means, we must return a frame from the camera (uncompressed yuv):
                
                // derive wMaxPacketSize chosen by host (device allows several options in configuration descriptors):
                var bytesPerMicroframe = options.transferBufferLength / options.numberOfPackets; // cheese =3072, ffmpeg =128
                var isoPacketsPerFrame = Math.pow(2, 4 - options.interval); // 1->8, 2->4, 3->2, 4->1... cheese =8, ffmpeg =8
                
                var payloads = [];
                var payloadDescriptor = Buffer.alloc(16 * options.numberOfPackets);
                var endOfFrame = false;
                var frameIndex = 0;
                
                var t0 = Date.now()/1000.0 * self.properties.dwClockFrequency.readInt32LE();
                
                // 0.125ms per packet = 1875 units of the clock
                
                for(var i=0;i<options.numberOfPackets;++i)
                {
                    // eoh and scr and pts should be 1
                    var bitHeaderField = 0b10001100; // EOH 7, ERR 6, STI 5, RESERVED 4, SCR 3, PTS 2, EOF 1, FID 0
                    
                    var payloadHeader = Buffer.alloc(12);
                    
                    var payloadDataObj = self.readNextFrameData(endOfFrame ? 0 : bytesPerMicroframe - payloadHeader.length);
                    var payloadData = payloadDataObj.buffer;
                    
                    if(frameIndex === 0)
                    {
                        frameIndex = payloadDataObj.frameIndex; // always guaranteed to be the same for the rest of the loop
                    }
                    
                    if(frameIndex % 2 === 0)
                    {
                        bitHeaderField = bitHeaderField | (1 << 0); // set FID-bit to 1, to toggle between even and odd frames
                    }
                    
                    if(payloadDataObj.isEOF)
                    {
                        bitHeaderField = bitHeaderField | (1 << 1); // set bit 0 (EOF-bit) to 1, marking the end of payload data frame
                        
                        // we must cancel sending a new frame here, because we can only send one start_frame back for the usb/ip packet
                        // we cannot send multiple frames in one time
                        endOfFrame = true;
                    }
                    
                    // 1875 * 32 = 60000
                    // 60000 is exactly what passes between epoch_s * dwClockFrequency between each new frame
                    // 
                    
                    // set length of this header
                    payloadHeader.writeUInt8(payloadHeader.length);
                    // set bit header field (BHF[0])
                    payloadHeader.writeUInt8(bitHeaderField, 1); // EOH, ERR, STI, RESERVED, SCR, PTS, EOF, FID
                    // set PTS presentation timestamp (in same units as dwClockFrequency, 15MHz):
                    Buffer.fromUIntLE(Math.floor(payloadDataObj.epoch_s * self.properties.dwClockFrequency.readInt32LE()) % 4294967296, 4).copy(payloadHeader, 2); // the same value for every frame
                    // set SCR source clock reference:
                    //Buffer.fromUIntLE(Math.floor(subClock = (subClock + 1875) % 4294967296), 4).copy(payloadHeader, 6); // increments of 1875 per packet?
                    Buffer.fromUIntLE(Math.floor((t0 + i * 1875) % 4294967296), 4).copy(payloadHeader, 6);
                    Buffer.fromUIntLE(Math.floor(clock = (clock + 1/8) % 65536), 2).copy(payloadHeader, 10); // increment 1 every 8 packets
                    
                    // add to payload
                    payloads.push(payloadHeader);
                    payloads.push(payloadData);
                    
                    // if(i === 0) console.log(frameIndex + ': PTS = ' + Math.floor(payloadDataObj.epoch_s * self.properties.dwClockFrequency) % 4294967296 + ', SCR = ' + Math.floor(t0 + i*1875)%Math.pow(2, 32) + ', ' + Math.floor(clock));
                    
                    /*if(i === 0)
                    {
                        console.log(payloadHeader.toString('hex'));
                        console.log('...');
                    }
                    else if(i + 1 === options.numberOfPackets)
                    {
                        console.log(payloadHeader.toString('hex'));
                    }*/
                    
                    // incoming columns are: index? packetsize 0 maximumsize?
                    // outgoing columns are: index? packetsize? actual bytes? offset?=0
                    var row = 16 * i; // 4 columns of 4 bytes = 16 bytes per row
                    payloadDescriptor.writeUInt32BE(bytesPerMicroframe * i, row + 0); // index?
                    payloadDescriptor.writeUInt32BE(bytesPerMicroframe, row + 4); // max bytes per payload header+data?
                    payloadDescriptor.writeUInt32BE(payloadHeader.length + payloadData.length, row + 8); // actual bytes per payload header+data
                    payloadDescriptor.writeUInt32BE(0, 0);//row + 12); // offset?
                }
                
                // payloadDescriptor is always at the end of payloads, and excludes the length of transferbuffer
                return {
                    type: 'PayloadDataBuffer',
                    data: self.wrapURB([
                        Buffer.concat(payloads)
                    ]),
                    payloadDescriptor: payloadDescriptor,
                    numberOfPackets: options.numberOfPackets,
                    startFrame: startFrame += options.numberOfPackets
                };
                
                
            }
            else if(urbData && urbData.length >= 8)
            {
                // parse urbData:
                var i = 0;
                var bmRequestType = urbData.slice(i, i+=1).readUInt8(); // bitmask D0..4, D5..6, D7:
                var bmRequestType_dataPhaseTransferDirection = (bmRequestType & 0b10000000) * 2 / 256; // 0 = Host to Device, 1 = Device to Host
                var bmRequestType_type = (bmRequestType & 0b01100000) * 4 / 128; // 0 = Standard, 1 = Class, 2 = Vendor, 3 = Reserved
                var bmRequestType_recipient = (bmRequestType & 0b00011111) * 32 / 32; // 0 = Device, 1 = Interface, 2 = Endpoint, 3 = Other, 4..31 = Reserved
                var bRequest = urbData.slice(i, i+=1).readUInt8(); // any of STANDARD_DEVICE_REQUEST values, ...
                var wValue = urbData.slice(i, i+=2).readUInt16LE();
                var wIndex = urbData.slice(i, i+=2).readUInt16LE();
                var wLength = urbData.slice(i, i+=2).readUInt16LE(); // is max reply byte count
                
                // Write descriptor
                if(bmRequestType_dataPhaseTransferDirection === BITMASK_REQUEST_TYPE.DATA_PHASE_TRANSFER_DIRECTION.HOST_TO_DEVICE) // 0
                {
                    if(bmRequestType_type === BITMASK_REQUEST_TYPE.TYPE.STANDARD) // 0
                    {
                        if(bmRequestType_recipient === BITMASK_REQUEST_TYPE.RECIPIENT.DEVICE) // 0
                        {
                            if(bRequest === STANDARD_DEVICE_REQUEST.SET_CONFIGURATION)
                            {
                                // handle: 00 09 01 00 0000 0000
                                // Host to Device, Standard, Device
                                // wValue = 0x0001 (derived from LE value)
                                
                                // console.log('set device configuration: ' + wValue + ', ' + wIndex + ', ' + wLength);
                                
                                // maybe we need to set a state, that we want to set configuration for future URB of the device at index 1?
                            }
                            else if(bRequest !== 0)
                            {
                                // 000000010000142c00010002000000010000000300000200000000100000000000000000000000040000000000000000
                                // what to do with this, it asks for 16 bytes
                                // it sends to interrupt endpoint, maybe just checking at interval of 4ms, to see if there is anything we need to send back
                                
                                console.log('unknown HOST_TO_DEVICE STANDARD_DEVICE_REQUEST: ' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                            }
                        }
                        else if(bmRequestType_recipient === BITMASK_REQUEST_TYPE.RECIPIENT.INTERFACE) // 1
                        {
                            if(bRequest === STANDARD_INTERFACE_REQUEST.SET_INTERFACE)
                            {
                                // cheese set: 010b070001000000, wValue=7, wIndex=1, wLength=0, bRequest = 0x0b (=11)
                                
                                // console.log('set interface configuration: ' + wValue + ', ' + wIndex + ', ' + wLength);
                            }
                            else
                            {
                                console.log('unknown HOST_TO_DEVICE STANDARD_INTERFACE_REQUEST: ' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                            }
                        }
                        else
                        {
                            console.log('unknown HOST_TO_DEVICE recipient (standard): ' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                        }
                    }
                    else if(bmRequestType_type === BITMASK_REQUEST_TYPE.TYPE.CLASS) // 1
                    {
                        if(bmRequestType_recipient === BITMASK_REQUEST_TYPE.RECIPIENT.INTERFACE) // 1
                        {
                            if(bRequest === VIDEO_CLASS_REQUEST.SET_CUR) // 1
                            {
                                // but in this case, because URB_DIR_MASK is maybe not set, it will not actually send the buffer, only the URB setup maybe
                                // return self.wrapURB(Buffer.alloc(wLength));
                                
                                var valuesData = urbData.slice(i, i+=wLength);
                                
                                var map_0 = self.properties.classInterfaceMap[Buffer.fromUIntLE(wIndex, 2).toString('hex')];
                                if(map_0)
                                {
                                    var map_1 = map_0[Buffer.fromUIntLE(wValue, 2).toString('hex')];
                                    
                                    if(map_1)
                                    {
                                        var map_2 = map_1['cur'];
                                        
                                        // 0100020615160500000000000000000000000000000000000000
                                        
                                        // set map values (the main purpose here)
                                        self.setMapValues(map_1, 'cur', valuesData);
                                        
                                        // return newly set values, although usually the data will be cut off by the usb/ip protocol, because it shouldn't send back
                                        return self.wrapURB(self.wrapMap(map_1['cur'], wLength));
                                    }
                                }
                            }
                            else
                            {
                                console.log('unknown HOST_TO_DEVICE interface VIDEO_CLASS_REQUEST: ' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                            }
                        }
                        else
                        {
                            console.log('unknown HOST_TO_DEVICE recipient (class): ' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                        }
                    }
                    else
                    {
                        console.log('unknown HOST_TO_DEVICE type: ' + bmRequestType_type + ', recipient=' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                    }
                }
                else if(bmRequestType_dataPhaseTransferDirection === BITMASK_REQUEST_TYPE.DATA_PHASE_TRANSFER_DIRECTION.DEVICE_TO_HOST) // 1
                {
                    if(bmRequestType_type === BITMASK_REQUEST_TYPE.TYPE.STANDARD) // 0
                    {
                        if(bmRequestType_recipient === BITMASK_REQUEST_TYPE.RECIPIENT.DEVICE) // 0
                        {
                            if(bRequest === STANDARD_DEVICE_REQUEST.GET_STATUS)
                            {
                                // console.log('unknown GET_STATUS');
                                
                                // return zero-filled array of wLength
                                return self.wrapURB(Buffer.alloc(wLength));
                            }
                            else if(bRequest === STANDARD_DEVICE_REQUEST.GET_DESCRIPTOR) // 6
                            {
                                var descriptorType = (wValue & 0xff00) / 256;
                                var descriptorIndex = (wValue & 0x00ff);
                                var descriptorLanguage = wIndex;
                                var descriptorLength = wLength;
                                
                                // console.log('get device descriptor: ' + descriptorType + ', ' + descriptorIndex + ', ' + descriptorLength);
                                
                                if(descriptorType === DESCRIPTOR_TYPE.DEVICE)
                                {
                                    if(descriptorLength >= 0x12) // =18
                                    {
                                        // create descriptor in self.properties.deviceDescriptor with the following map:
                                        
                                        var d = self.wrapDescriptor(self.properties.deviceDescriptor);
                                        var u = self.wrapURB(d);
                                        
                                        // console.log('going to return descriptor of: ' + d.length + ' and urb of: ' + u.length);
                                        
                                        return u;
                                    }
                                }
                                else if(descriptorType === DESCRIPTOR_TYPE.CONFIGURATION)
                                {
                                    // create descriptors in self.properties.configurationDescriptorArray
                                    // the first one, should be of length 9, and indicate the total length of the whole array in bytes
                                    // which is what we return the first time
                                    // and then later, we return the whole array including the first one
                                    // but what if descriptorLength is 255, then we send strings, but is there not any other indicator for this?
                                    // maybe descriptorLanguage or descriptorIndex is different?
                                    
                                    if(descriptorLength === 0x09) // =9
                                    {
                                        return self.wrapURB(self.wrapDescriptor(self.properties.configurationDescriptorArray[0]));
                                    }
                                    // wValue = 0x0200, wIndex = 0x0000, request = 0x06
                                    else if(descriptorLength === self.properties.configurationDescriptorArray[0].fields[1].readUInt16LE()) // =735
                                    {
                                        // reply to urbData:
                                        var descriptors = [];
                                        for(var j=0;j<self.properties.configurationDescriptorArray.length;++j)
                                        {
                                            var desc = self.properties.configurationDescriptorArray[j];
                                            
                                            if(Buffer.isBuffer(desc))
                                            {
                                                descriptors.push(desc);
                                            }
                                            else
                                            {
                                                descriptors.push(self.wrapDescriptor(desc));
                                            }
                                        }
                                        return self.wrapURB(descriptors);
                                    }
                                }
                                else if(descriptorType === DESCRIPTOR_TYPE.STRING)
                                {
                                    // reply to urbData: 80 06 01 03 0904 ff00
                                    return self.wrapURB(self.createStringDescriptor(self.properties.strings[descriptorIndex] || ''));
                                }
                                else
                                {
                                    console.log('unknown in get_descriptor DESCRIPTOR_TYPE: ' + descriptorType + ' for ' + descriptorIndex + ', ' + descriptorLanguage + ', ' + descriptorLength);
                                }
                            }
                            else
                            {
                                console.log('unknown STANDARD_DEVICE_REQUEST: ' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                            }
                        }
                        else
                        {
                            console.log('unknown recipient (standard): ' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                        }
                    }
                    else if(bmRequestType_type === BITMASK_REQUEST_TYPE.TYPE.CLASS) // 1
                    {
                        if(bmRequestType_recipient === BITMASK_REQUEST_TYPE.RECIPIENT.INTERFACE) // 1
                        {
                            // bRequest === VIDEO_CLASS_REQUEST.GET_INFO, GET_CUR, GET_DEF, etc.
                            
                            var map_0 = self.properties.classInterfaceMap[Buffer.fromUIntLE(wIndex, 2).toString('hex')];
                            if(map_0)
                            {
                                var map_1 = map_0[Buffer.fromUIntLE(wValue, 2).toString('hex')];
                                
                                if(map_1)
                                {
                                    var name = VIDEO_CLASS_REQUEST_NAMES[Buffer.fromUIntBE(bRequest, 1).toString('hex')];
                                    if(name in map_1)
                                    {
                                        var map_2 = map_1[name];
                                        
                                        // console.log('getting ' + name + ' of classInterfaceMap[' + Buffer.fromUIntLE(wIndex, 2).toString('hex') + '][' + Buffer.fromUIntLE(wValue, 2).toString('hex') + ']: ' + JSON.stringify(map_2));
                                        
                                        return self.wrapURB(self.wrapMap(map_2, wLength));
                                    }
                                    else
                                    {
                                        console.log('unknown map_2 for get-request of classInterfaceMap[' + Buffer.fromUIntLE(wIndex, 2).toString('hex') + '][' + Buffer.fromUIntLE(wValue, 2).toString('hex') + ']: ' + bRequest + ' (= ' + Buffer.fromUIntBE(bRequest, 1).toString('hex') + ')');
                                    }
                                }
                                else
                                {
                                    console.log('unknown map_1 for get-request of classInterfaceMap[' + Buffer.fromUIntLE(wIndex, 2).toString('hex') + ']: ' + wValue + ' (= ' + Buffer.fromUIntLE(wValue, 2).toString('hex') + ')');
                                }
                            }
                            else
                            {
                                console.log('unknown map_0 for get-request of classInterfaceMap: ' + wIndex + ' (= ' + Buffer.fromUIntLE(wIndex, 2).toString('hex') + ')');
                            }
                        }
                        else
                        {
                            console.log('unknown recipient (class): ' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                        }
                    }
                    else
                    {
                        console.log('unknown type: ' + bmRequestType_type + ' for recipient=' + bmRequestType_recipient + ', request=' + bRequest + ' for ' + wValue + ', ' + wIndex + ', ' + wLength);
                    }
                }
            }
            
            // return zero-filled 8 bytes URB setup ctrl data for empty URB data:
            return self.wrapURB();
        };
        
        return self;
    }
};
