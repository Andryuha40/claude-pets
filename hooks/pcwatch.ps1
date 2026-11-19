# Samples the computer every few seconds and prints one line per sample:
#   pc <cpu %> <used MB> <total MB> <disk %>
# Runs without a console window (typeperf refuses to), through the Windows
# performance counters (PDH) by their English names, so a localized Windows
# reads them too. Started once per session by the tikinson-pet mod.
param([int]$Every = 5)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TikPdh {
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)]
  public static extern int PdhOpenQuery(IntPtr source, IntPtr user, out IntPtr query);
  [DllImport("pdh.dll", CharSet = CharSet.Unicode)]
  public static extern int PdhAddEnglishCounter(IntPtr query, string path, IntPtr user, out IntPtr counter);
  [DllImport("pdh.dll")]
  public static extern int PdhCollectQueryData(IntPtr query);
  [StructLayout(LayoutKind.Sequential)]
  public struct Value { public uint Status; public double Double; }
  [DllImport("pdh.dll")]
  public static extern int PdhGetFormattedCounterValue(IntPtr counter, uint format, IntPtr type, out Value value);
  [StructLayout(LayoutKind.Sequential)]
  public class Mem {
    public uint Length = 64; public uint Load; public ulong Total; public ulong Avail;
    public ulong TotalPage; public ulong AvailPage; public ulong TotalVirtual; public ulong AvailVirtual; public ulong Extended;
  }
  [DllImport("kernel32.dll")]
  public static extern bool GlobalMemoryStatusEx([In, Out] Mem mem);
  public static double Read(IntPtr counter) {
    Value v; return PdhGetFormattedCounterValue(counter, 0x8200, IntPtr.Zero, out v) == 0 ? v.Double : -1;
  }
}
'@

$q = [IntPtr]::Zero; $cpu = [IntPtr]::Zero; $disk = [IntPtr]::Zero
[void][TikPdh]::PdhOpenQuery([IntPtr]::Zero, [IntPtr]::Zero, [ref]$q)
[void][TikPdh]::PdhAddEnglishCounter($q, '\Processor(_Total)\% Processor Time', [IntPtr]::Zero, [ref]$cpu)
[void][TikPdh]::PdhAddEnglishCounter($q, '\PhysicalDisk(_Total)\% Idle Time', [IntPtr]::Zero, [ref]$disk)
[void][TikPdh]::PdhCollectQueryData($q)
$mem = New-Object TikPdh+Mem

while ($true) {
  Start-Sleep -Seconds $Every
  [void][TikPdh]::PdhCollectQueryData($q)
  [void][TikPdh]::GlobalMemoryStatusEx($mem)
  $totalMb = [math]::Round($mem.Total / 1MB)
  $usedMb = [math]::Round(($mem.Total - $mem.Avail) / 1MB)
  # Busy = 100 - idle: '% Disk Time' overshoots 100 and drops out on an idle disk.
  $idle = [TikPdh]::Read($disk)
  $busy = if ($idle -ge 0) { [math]::Max(0, [math]::Min(100, 100 - $idle)) } else { 0 }
  $line = 'pc {0:F0} {1} {2} {3:F0}' -f [TikPdh]::Read($cpu), $usedMb, $totalMb, $busy
  [Console]::Out.WriteLine($line.Replace(',', '.'))
  [Console]::Out.Flush()
}
