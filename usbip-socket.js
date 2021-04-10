const events = require('events');

module.exports = {
    create: function(options, usbCommunicator)
    {
        var OP_REQ_IMPORT_HEX = '8003';
        var OP_REP_IMPORT_HEX = '0003';
        
        var USBIP_CMD_SUBMIT_UINT32 = 1;
        var USBIP_CMD_UNLINK_UINT32 = 2;
        var USBIP_RET_SUBMIT_UINT32 = 3;
        var USBIP_RET_UNLINK_UINT32 = 4;
        
        var USBIP_VERSION_HEX = '0111';
        
        var STATE_NONE = 0;
        var STATE_ATTACHED = 1;
        
        var self = new events();
        
        self.state = STATE_NONE;
        self.busId = '';
        self.queue = [];
        self.sendMap = {};
        
        var printUSBIPFrame = function(urb)
        {
            var urbData = urb.slice(0, 48);
            var i = 0;
            var sb = [];
            
            sb.push('cmd=' + urbData.readUInt32BE(i, i+=4));
            sb.push('seqnum=' + urbData.readUInt32BE(i, i+=4));
            sb.push('devid=' + urbData.readUInt32BE(i, i+=4));
            sb.push('direction=' + urbData.readUInt32BE(i, i+=4));
            sb.push('endpoint=' + urbData.readUInt32BE(i, i+=4));
            sb.push('status=' + urbData.readUInt32BE(i, i+=4));
            sb.push('URBDataLength=' + urbData.readUInt32BE(i, i+=4));
            sb.push('startFrame=' + urbData.readUInt32BE(i, i+=4));
            sb.push('numberOfPackets=' + urbData.readUInt32BE(i, i+=4));
            sb.push('errorCount=' + urbData.readUInt32BE(i, i+=4));
            sb.push('URBSetupHeader=' + urbData.slice(i, i+=8).toString('hex'));
            
            return sb.join(', ');
        };
        
        self.cancel_send = function(options)
        {
            options = options || {};
            
            var t = self.sendMap[options.seqnum];
            if(t)
            {
                clearTimeout(t);
                
                delete self.sendMap[options.seqnum];
            }
        };
        self.try_send = function(buf, options)
        {
            options = options || {};
            
            if(!options.interval)
            {
                if(typeof buf === 'function')
                {
                    self.emit('data', buf());
                }
                else
                {
                    self.emit('data', buf);
                }
            }
            else
            {
                var t = self.sendMap[options.seqnum];
                if(t)
                {
                    clearTimeout(t);
                }
                
                t = setTimeout(function()
                {
                    if(typeof buf === 'function')
                    {
                        self.emit('data', buf());
                    }
                    else
                    {
                        self.emit('data', buf);
                    }
                    
                    delete self.sendMap[options.seqnum];
                }, self.interval_ms || self.interval);
                
                self.sendMap[options.seqnum] = t;
            }
        };        
        
        self.wrap = function(obj, options)
        {
            if(options.type === USBIP_CMD_SUBMIT_UINT32 || options.type === USBIP_CMD_UNLINK_UINT32)
            {
                var extra = [];
                var extraLength = 0;
                
                var urbData = obj;
                
                if(urbData && urbData.type === 'PayloadDataBuffer')
                {
                    extra.push(urbData.payloadDescriptor);
                    extraLength += urbData.payloadDescriptor.length;
                    urbData = urbData.data;
                }
                
                if(!urbData) urbData = Buffer.alloc(0);
                
                // len is calculated before urbData may be updated by transferFlags
                // this can never be larger than transferBufferLength, but we cannot use that field, because URB data may very well be smaller
                var len = Math.max(0, urbData.length - 8);
                
                if(options.transferFlags && !options.transferFlags.URB_DIR_MASK)
                {
                    // do not send the URB data, only setup (or just zero-filled?)
                    urbData = urbData.slice(0, 8);
                }
                
                var packet = Buffer.alloc(10 * 4 + urbData.length + extraLength);
                var i = 0;
                
                // command code
                packet.writeUInt32BE(options.commandCode, i);
                i += 4;
                
                // seqnum
                packet.writeUInt32BE(options.seqnum, i);
                i += 4;
                
                // devid
                packet.writeUInt32BE(0, i);
                i += 4;
                
                // direction
                packet.writeUInt32BE(0, i);
                i += 4;
                
                // endpoint number (0..15)
                packet.writeUInt32BE(0, i);
                i += 4;
                
                // status, zero for OK
                packet.writeUInt32BE(options.status || 0, i);
                i += 4;
                
                // number of URB data bytes (min 8 setup bytes)
                packet.writeUInt32BE(len, i);
                i += 4;
                
                if(obj && obj.type === 'PayloadDataBuffer')
                {
                    // start frame (only if sending packets, increment previous start frame by 1 (actually +4096 or +8192 etc), why?, no idea
                    packet.writeUInt32BE(obj.startFrame, i);
                    i += 4;
                    
                    // number of ISO packets
                    packet.writeUInt32BE(obj.numberOfPackets, i);
                    i += 4;
                }
                else
                {
                    // start frame (only if sending packets, increment previous start frame by 1 (actually +4096 or +8192 etc), why?, no idea
                    packet.writeUInt32BE(0, i);
                    i += 4;
                    
                    // number of ISO packets
                    packet.writeUInt32BE(0, i);
                    i += 4;
                }
                
                // error count
                packet.writeUInt32BE(0, i);
                i += 4;
                
                // URB data
                urbData.copy(packet, i);
                i += urbData.length;
                
                // Extra data (not part of payloadtransferlength) (i.e. payloaddatabuffer footer):
                Buffer.concat(extra).copy(packet, i);
                i += extraLength;
                
                // console.log('sending USB/IP frame: ' + printUSBIPFrame(packet));
                
                return packet;
            }
            else
            {
                return null;
            }
        };
        
        self.compose = function(commandCodeHex)
        {
            if(commandCodeHex === OP_REP_IMPORT_HEX)
            {
                var packets = [];
                
                {
                    var packet = Buffer.alloc(8);
                    var i = 0;
                    
                    // USBIP version number (may also be 0110, 0111, etc):
                    Buffer.from(USBIP_VERSION_HEX, 'hex').copy(packet, i);
                    i += 2;
                    
                    // Reply code:
                    Buffer.from(OP_REP_IMPORT_HEX, 'hex').copy(packet, i);
                    i += 2;
                    
                    // Status: 0 is OK, 1 is error
                    packet.writeUInt32BE(0, i);
                    i += 4;
                    
                    packets.push(packet);
                }
                
                {
                    var packet = Buffer.alloc(312);
                    var i = 0;
                    
                    // Path
                    Buffer.from('/sys/devices/pci0000:00/0000:00:' + self.busId.replace(/[^0-9]+/g, '') + '.0/usb1/' + self.busId, 'utf8').copy(packet, i);
                    i += 256;
                    
                    // BusID
                    Buffer.from(self.busId, 'utf8').copy(packet, i);
                    i += 32;
                    
                    // BusNum
                    packet.writeUint32BE(1, i);
                    i += 4;
                    
                    // DevNum
                    packet.writeUint32BE(2, i);
                    i += 4;
                    
                    // Speed
                    packet.writeUint32BE(3, i);
                    i += 4;
                    
                    // idVendor
                    usbCommunicator.properties.idVendor.copy(packet, i);
                    i += 2;
                    
                    // idProduct
                    usbCommunicator.properties.idProduct.copy(packet, i);
                    i += 2;
                    
                    // bcdDevice
                    usbCommunicator.properties.bcdDevice.copy(packet, i);
                    i += 2;
                    
                    // bDeviceClass
                    packet.writeUInt8(usbCommunicator.properties.bDeviceClass.readUInt8(), i);
                    i += 1;
                    
                    // bDeviceSubClass
                    packet.writeUInt8(usbCommunicator.properties.bDeviceSubClass.readUInt8(), i);
                    i += 1;
                    
                    // bDeviceProtocol
                    packet.writeUInt8(usbCommunicator.properties.bDeviceProtocol.readUInt8(), i);
                    i += 1;
                    
                    // bConfigurationValue
                    packet.writeUInt8(usbCommunicator.properties.bConfigurationValue.readUInt8(), i);
                    i += 1;
                    
                    // bNumConfigurations
                    packet.writeUInt8(usbCommunicator.properties.bNumConfigurations.readUInt8(), i);
                    i += 1;
                    
                    // bNumInterfaces
                    packet.writeUInt8(usbCommunicator.properties.bNumInterfaces.readUInt8(), i);
                    i += 1;
                    
                    // should be: 01010102
                    // actual: 01000100
                    
                    packets.push(packet);
                }
                
                return Buffer.concat(packets);
            }
        };
        
        self.parse = function(buf)
        {
            if(buf) self.queue.push(buf);
            
            var buffer = Buffer.concat(self.queue);
            var i = 0;
            
            if(self.state === STATE_NONE)
            {
                if(buffer.length < i+4) return null; // not enough data
                
                var usbipVersion = buffer.slice(i, i+=2).toString('hex'); // e.g. 0x0100 for version v1.0.0
                var commandCodeHex = buffer.slice(i, i+=2).toString('hex'); // e.g. 0x8003 for OP_REQ_IMPORT
                
                if(commandCodeHex === OP_REQ_IMPORT_HEX)
                {
                    if(buffer.length < i+36) return null; // not enough data
                    
                    var status = buffer.slice(i, i+=4); // unused
                    var busId = buffer.slice(i, i+=32).toString('utf8').replace(/\x00.*$/gi, ''); // busid, strip trailing null characters
                    
                    self.busId = busId;
                    
                    self.state = STATE_ATTACHED;
                    
                    self.queue = []; // clear the buffer queue after parsing is complete
                    
                    self.try_send(function()
                    {
                        return self.compose(OP_REP_IMPORT_HEX);
                    });
                }
                else
                {
                    console.error('USB/IP protocol error: Invalid command. Version = 0x' + usbipVersion + ', Command code = 0x' + commandCodeHex + '.');
                    console.error('  for hex-buffer: ' + buffer.toString('hex'));
                    process.exit(1);
                }
            }
            else if(self.state === STATE_ATTACHED)
            {
                if(buffer.length < i+4) return null; // not enough data
                
                var command = buffer.slice(i, i+=4).readUInt32BE();
                
                if(command === USBIP_CMD_SUBMIT_UINT32)
                {
                    // submit an URB:
                    var seqnum = buffer.slice(i, i+=4).readUInt32BE(); // sequence number of the URB to submit
                    var devid = buffer.slice(i, i+=4).readUInt32BE(); // devid
                    var direction = buffer.slice(i, i+=4).readUInt32BE(); // direction: 0 (USBIP_DIR_OUT), 1 (USBIP_DIR_IN)
                    var endpointNumber = buffer.slice(i, i+=4).readUInt32BE(); // endpoint number
                    var transferFlags = buffer.slice(i, i+=4).readUInt32BE(); // transfer flags
                    var transferBufferLength = buffer.slice(i, i+=4).readUInt32BE(); // transfer buffer length
                    var startFrame = buffer.slice(i, i+=4).readUInt32BE(); // specify the selected frame to transmit an ISO frame, ignored if URB_ISO_ASAP is specified at transfer_flags
                    var numberOfPackets = buffer.slice(i, i+=4).readUInt32BE(); // number of ISO packets
                    var interval = buffer.slice(i, i+=4).readUInt32BE(); // maximum time for the request on the server-side host controller
                    var urbDataSetup = buffer.slice(i, i+=8); // is always 8 bytes of URB setup data
                    
                    var urbData = urbDataSetup;
                    var urbDataLength = 0;
                    if(direction === 0)
                    {
                        urbDataLength += transferBufferLength;
                    }
                    if(numberOfPackets > 0)
                    {
                        urbDataLength += numberOfPackets * 16; // 512 trailing bytes
                    }
                    if(urbDataLength > 0)
                    {
                        urbData = Buffer.concat([urbData, buffer.slice(i, i+=urbDataLength)]);
                    }
                    
                    var transferFlags_urbShortNotOk = (transferFlags & (1 << 0)) !== 0;
                    var transferFlags_urbIsoAsap = (transferFlags & (1 << 1)) !== 0;
                    var transferFlags_urbNoTransferDmaMap = (transferFlags & (1 << 2)) !== 0;
                    var transferFlags_urbZeroPacket = (transferFlags & (1 << 6)) !== 0;
                    var transferFlags_urbNoInterrupt = (transferFlags & (1 << 7)) !== 0;
                    var transferFlags_urbFreeBuffer = (transferFlags & (1 << 8)) !== 0;
                    var transferFlags_urbDirMask = (transferFlags & (1 << 9)) !== 0;
                    
                    var packetOptions = {
                        commandCode: USBIP_RET_SUBMIT_UINT32,
                        type: USBIP_CMD_SUBMIT_UINT32,
                        seqnum: seqnum,
                        devid: devid,
                        direction: direction,
                        endpointNumber: endpointNumber,
                        transferFlags: {
                            URB_SHORT_NOT_OK: transferFlags_urbShortNotOk,
                            URB_ISO_ASAP: transferFlags_urbIsoAsap,
                            URB_NO_TRANSFER_DMA_MAP: transferFlags_urbNoTransferDmaMap,
                            URB_ZERO_PACKET: transferFlags_urbZeroPacket,
                            URB_NO_INTERRUPT: transferFlags_urbNoInterrupt,
                            URB_FREE_BUFFER: transferFlags_urbFreeBuffer,
                            URB_DIR_MASK: transferFlags_urbDirMask
                        },
                        transferBufferLength: transferBufferLength,
                        startFrame: startFrame,
                        numberOfPackets: numberOfPackets,
                        interval: interval
                    };
                    
                    self.queue = []; // clear the buffer queue after parsing is complete
                    
                    // if interval is defined, we should wait interval ms, in order to come up with a reply
                    // then, if later we receive unlink request, we cancel the interval timer
                    // interval timer must be mapped to the seqnum
                    
                    // if endpointNumber === 0
                    self.try_send(function()
                    {
                        return self.wrap(usbCommunicator.parse(urbData, packetOptions), packetOptions);
                    }, packetOptions);
                }
                else if(command === USBIP_CMD_UNLINK_UINT32)
                {
                    // reply to unlinking an URB:
                    var seqnum = buffer.slice(i, i+=4).readUInt32BE(); // sequence number of the URB to submit
                    var devid = buffer.slice(i, i+=4).readUInt32BE(); // devid
                    var direction = buffer.slice(i, i+=4).readUInt32BE(); // direction: 0 (USBIP_DIR_OUT), 1 (USBIP_DIR_IN)
                    var endpointNumber = buffer.slice(i, i+=4).readUInt32BE(); // endpoint number
                    var unlinkSeqnum = buffer.slice(i, i+=4).readUInt32BE(); // seqnum to unlink
                    
                    // packet is at least 48, increment the i regardless (dummy slice)
                    buffer.slice(i, i+=24); // zero-filled data
                    
                    // take action to remove previous unlinkSeqnum from handling
                    self.cancel_send({seqnum: unlinkSeqnum});
                    
                    var packetOptions = {
                        commandCode: USBIP_RET_UNLINK_UINT32,
                        type: USBIP_CMD_UNLINK_UINT32,
                        seqnum: seqnum,
                        status: 0xffffff98 // = -103
                    };
                    
                    self.queue = []; // clear the buffer queue after parsing is complete
                    
                    self.try_send(function()
                    {
                        return self.wrap(usbCommunicator.parse(null, packetOptions), packetOptions);
                        
                    }, packetOptions);
                }
                else if(command === USBIP_RET_SUBMIT_UINT32)
                {
                    // unlink an URB (delete):
                    console.error('USB/IP protocol error: Command not implemented. Version = 0x' + usbipVersion + ', Command = USBIP_RET_SUBMIT.');
                    console.error('  for hex-buffer: ' + buffer.toString('hex'));
                    process.exit(1);
                }
                else if(command === USBIP_RET_UNLINK_UINT32)
                {
                    // reply for an unlink URB command:
                    console.error('USB/IP protocol error: Command not implemented. Version = 0x' + usbipVersion + ', Command = USBIP_RET_UNLINK.');
                    console.error('  for hex-buffer: ' + buffer.toString('hex'));
                    process.exit(1);
                }
                else
                {
                    console.error('USB/IP protocol warning: Unrecognized command. Version = 0x' + usbipVersion + ', Command code = 0x' + Buffer.from([command]).toString('hex') + '.');
                    console.error('  for hex-buffer: ' + buffer.toString('hex'));
                    
                    self.queue = []; // clear the buffer queue after parsing is complete
                    
                    //process.exit(1); -> warning only
                }
            }
            
            if(i > 0 && i < buffer.length)
            {
                var remainder = buffer.slice(i);
                
                self.queue.push(remainder);
                
                if(self.queue.length)
                {
                    // console.log('Read only from ' + i + ' of buffer ' + buffer.length + ' still process: ' + remainder.toString('hex') + ' in queue ('+ self.queue.length + ')');
                    self.parse(null);
                }
            }
        };
        
        return self;
    }
};
