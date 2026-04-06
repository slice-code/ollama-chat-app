const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Get system device information
 * CPU, RAM, Storage, GPU, System Info
 */

function getDeviceInfo() {
  try {
    return {
      system: getSystemInfo(),
      cpu: getCpuInfo(),
      memory: getMemoryInfo(),
      storage: getStorageInfo(),
      gpu: getGpuInfo()
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return { error: error.message };
  }
}

function getSystemInfo() {
  return {
    os: process.platform,
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: Math.floor(os.uptime()),
    uptimeFormatted: formatUptime(os.uptime())
  };
}

function getCpuInfo() {
  const cpus = os.cpus();
  const totalCores = cpus.length;
  
  // Calculate average CPU usage
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  
  const idlePercent = 100 - ~~(100 * !(totalTick / totalIdle));
  const usage = Math.max(0, idlePercent);
  
  return {
    cores: totalCores,
    model: cpus[0]?.model || 'Unknown',
    speed: cpus[0]?.speed || 0,
    usage: usage.toFixed(2) + '%'
  };
}

function getMemoryInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usagePercent = (usedMem / totalMem * 100).toFixed(2);
  
  return {
    total: formatBytes(totalMem),
    used: formatBytes(usedMem),
    free: formatBytes(freeMem),
    usage: usagePercent + '%'
  };
}

function getStorageInfo() {
  try {
    // Try to get storage info for root partition
    let output;
    
    if (process.platform === 'linux' || process.platform === 'darwin') {
      output = execSync('df -B1 / | tail -1').toString();
      const parts = output.trim().split(/\s+/);
      
      if (parts.length >= 4) {
        const total = parseInt(parts[1]);
        const used = parseInt(parts[2]);
        const available = parseInt(parts[3]);
        const usagePercent = (used / total * 100).toFixed(2);
        
        return {
          total: formatBytes(total),
          used: formatBytes(used),
          available: formatBytes(available),
          usage: usagePercent + '%'
        };
      }
    } else if (process.platform === 'win32') {
      // Windows
      output = execSync('wmic logicaldisk get size,freespace').toString();
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        if (parts.length >= 2) {
          const total = parseInt(parts[0]);
          const free = parseInt(parts[1]);
          const used = total - free;
          const usagePercent = (used / total * 100).toFixed(2);
          
          return {
            total: formatBytes(total),
            used: formatBytes(used),
            available: formatBytes(free),
            usage: usagePercent + '%'
          };
        }
      }
    }
  } catch (error) {
    console.error('Error getting storage info:', error.message);
  }
  
  return { error: 'Unable to get storage info' };
}

function getGpuInfo() {
  try {
    let gpu = { type: 'Not detected' };
    
    if (process.platform === 'linux') {
      try {
        const lspcOutput = execSync('lspci | grep -i vga').toString('utf-8').trim();
        if (lspcOutput) {
          gpu.type = lspcOutput.split(':').pop().trim();
        }
      } catch (e) {
        // lspci not available
      }
      
      // Try nvidia-smi
      try {
        const nvidiaOutput = execSync('nvidia-smi --query-gpu=name,memory.total,utilization.gpu --format=csv,noheader', { timeout: 2000 }).toString().trim();
        if (nvidiaOutput) {
          const [name, memory, usage] = nvidiaOutput.split(',').map(s => s.trim());
          gpu = {
            type: 'NVIDIA: ' + name,
            memory: memory,
            usage: usage
          };
        }
      } catch (e) {
        // nvidia-smi not available
      }
    } else if (process.platform === 'darwin') {
      // macOS
      try {
        const systemProfiler = execSync('system_profiler SPDisplaysDataType 2>/dev/null | grep -i "chipset model"').toString().trim();
        if (systemProfiler) {
          gpu.type = systemProfiler.split(':')[1]?.trim() || 'Apple GPU';
        }
      } catch (e) {
        gpu.type = 'Apple Silicon (likely)';
      }
    } else if (process.platform === 'win32') {
      try {
        const wmic = execSync('wmic path win32_videocontroller get name').toString().trim();
        const lines = wmic.split('\n');
        if (lines.length > 1) {
          gpu.type = lines[1].trim();
        }
      } catch (e) {
        // wmic failed
      }
    }
    
    return gpu;
  } catch (error) {
    console.error('Error getting GPU info:', error.message);
    return { error: 'Unable to get GPU info' };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  let result = [];
  if (days > 0) result.push(`${days}d`);
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  
  return result.join(' ') || '< 1 minute';
}

module.exports = {
  getDeviceInfo,
  getSystemInfo,
  getCpuInfo,
  getMemoryInfo,
  getStorageInfo,
  getGpuInfo
};
