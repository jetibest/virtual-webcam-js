const os = require('os');
const fs = require('fs');
const child_process = require('child_process');

// automatically load a kernel module if not already loaded (see /proc/modules)
module.exports = async function(kernelModuleName)
{
    return new Promise(function(resolve)
    {
        // check if module is loaded
        if(fs.readFileSync('/proc/modules', 'ascii').split('\n').filter(ln => ln.split(' ')[0] === kernelModuleName).length > 0)
        {
            // module is already loaded, nothing to do
            resolve(true);
        }
        else
        {
            // automatically load now, execute: sudo modprobe [kernel-module-name]
            var debug = [];
            var cp = child_process.spawn('modprobe', [kernelModuleName]);
            cp.stdout.on('data', function(buf)
            {
                debug.push(buf);
            });
            cp.stderr.on('data', function(buf)
            {
                debug.push(buf);
            });
            cp.on('close', function(exit_code)
            {
                if(exit_code !== 0)
                {
                    throw new Error(
                        [
                            'Could not load ' + kernelModuleName + ' kernel module (' + exit_code + '):',
                            Buffer.concat(debug).toString(),
                            'Try to manually execute:',
                            '    [sudo] modprobe ' + kernelModuleName,
                            ''
                        ].join(os.EOL)
                    );
                }
                else
                {
                    resolve(true);
                }
            });
        }
    });
};
