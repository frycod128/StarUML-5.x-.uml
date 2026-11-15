<#
    Open a .uml in classic StarUML 5 and report whether the document really loaded.

    A file can pass every static check and still fail here - that is the whole
    point of this script. Typical outcomes:

      LOADED       the target title, no modal dialog, and a visible document tab
      ERROR        an error dialog appeared
      NO-DOCUMENT  New Project dialog, empty main window, or no document tab

    IMPORTANT: this helper closes every running StarUML process before starting
    a fresh instance. Obtain explicit user authorization first, and run only one
    check at a time. Parallel checks kill each other and can report stale results.
    -AuthorizeCloseAll is required as a deliberate acknowledgement.

    Usage:
      pwsh -File open_check.ps1 -File .\model.uml -AuthorizeCloseAll
      pwsh -File open_check.ps1 -File .\model.uml -Seconds 40 -KeepOpen -AuthorizeCloseAll
      pwsh -File open_check.ps1 -File .\model.uml -DismissNewProjectDialog -AuthorizeCloseAll
      pwsh -File open_check.ps1 -File .\model.uml -Screenshot .\open-check.png -AuthorizeCloseAll

    -DismissNewProjectDialog is opt-in. Without it, the startup New Project
    dialog is a failed live-open gate even if the title already names the file.

    Exit code: 0 LOADED, 1 ERROR, 2 NO-DOCUMENT, 3 not authorized,
               4 another open check is already running.
#>
param(
    [Parameter(Mandatory = $true)][string]$File,
    [int]$Seconds = 30,
    [switch]$KeepOpen,
    [switch]$DismissNewProjectDialog,
    [string]$Screenshot = '',
    [switch]$AuthorizeCloseAll,
    [string]$StarUmlExe = ''
)

$ErrorActionPreference = 'Stop'

if (-not $AuthorizeCloseAll) {
    Write-Output 'NOT AUTHORIZED: this check closes every running StarUML instance.'
    Write-Output 'Ask the user before rerunning with -AuthorizeCloseAll.'
    exit 3
}

$checkMutex = [System.Threading.Mutex]::new($false, 'Local\StarUML-XPD-OpenCheck')
if (-not $checkMutex.WaitOne(0)) {
    Write-Output 'BUSY: another StarUML open check is already running.'
    Write-Output 'Run checks sequentially; parallel checks interfere with each other.'
    $checkMutex.Dispose()
    exit 4
}

function Find-StarUml {
    param([string]$Explicit)
    if ($Explicit -and (Test-Path -LiteralPath $Explicit)) { return (Resolve-Path -LiteralPath $Explicit).Path }
    if ($env:STARUML_HOME) {
        $candidate = Join-Path $env:STARUML_HOME 'StarUML.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files', 'D:\Program Files', 'C:\Program Files (x86)', 'D:\Program Files (x86)')) {
        if (-not $root) { continue }
        $candidate = Join-Path $root 'StarUML\StarUML.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'StarUML.exe not found; pass -StarUmlExe or set STARUML_HOME.'
}

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class StarUmlWindows {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder s, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hWnd, StringBuilder s, int max);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr hWnd, uint msg, IntPtr wp, IntPtr lp);

    [StructLayout(LayoutKind.Sequential)]
    public struct Rect {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class WindowSnapshot {
        public IntPtr Handle;
        public string ClassName;
        public string Title;
        public bool Visible;
    }

    private static WindowSnapshot Snapshot(IntPtr h) {
        var title = new StringBuilder(1024);
        GetWindowTextW(h, title, title.Capacity);
        var class_name = new StringBuilder(256);
        GetClassNameW(h, class_name, class_name.Capacity);
        return new WindowSnapshot {
            Handle = h,
            ClassName = class_name.ToString(),
            Title = title.ToString(),
            Visible = IsWindowVisible(h)
        };
    }

    public static List<WindowSnapshot> TopLevel(uint pid) {
        var list = new List<WindowSnapshot>();
        EnumWindows(delegate(IntPtr h, IntPtr p) {
            uint owner; GetWindowThreadProcessId(h, out owner);
            if (owner == pid) list.Add(Snapshot(h));
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static List<WindowSnapshot> Descendants(IntPtr parent) {
        var list = new List<WindowSnapshot>();
        EnumChildWindows(parent, delegate(IntPtr h, IntPtr p) {
            list.Add(Snapshot(h));
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
'@

if (-not ('StarUmlWindows' -as [type])) { Add-Type -TypeDefinition $src -Language CSharp }

try {
    $exe = Find-StarUml -Explicit $StarUmlExe
    $target = (Resolve-Path -LiteralPath $File).Path
    $leaf = [IO.Path]::GetFileName($target)

    Get-Process -Name StarUML -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 800
    Start-Process -FilePath $exe `
        -WorkingDirectory (Split-Path -Parent $exe) `
        -ArgumentList ('"' + $target + '"')

    $verdict = 'NO-DOCUMENT'
    $title = ''
    $documentTab = ''
    $lastWindows = @()
    $dismissedNewProject = $false
    for ($i = 1; $i -le $Seconds; $i++) {
        Start-Sleep -Seconds 1
        $proc = Get-Process -Name StarUML -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $proc) {
            Write-Output 'StarUML exited before opening the file (crash?).'
            $verdict = 'ERROR'
            break
        }

        $windows = [StarUmlWindows]::TopLevel([uint32]$proc.Id) |
            Where-Object { $_.Visible }
        $lastWindows = $windows
        $loadedWindow = $windows |
            Where-Object {
                $_.ClassName -eq 'TMainForm' -and
                $_.Title -like 'StarUML - *' -and
                $_.Title.IndexOf($leaf, [StringComparison]::OrdinalIgnoreCase) -ge 0
            } |
            Select-Object -First 1
        $errorWindow = $windows |
            Where-Object {
                $_.ClassName -eq 'TMessageForm' -and
                $_.Title -match '错误|Error|violation|invalid'
            } |
            Select-Object -First 1
        $newProjectWindow = $windows |
            Where-Object { $_.ClassName -eq 'TNewProjectForm' } |
            Select-Object -First 1

        if ($errorWindow) {
            $verdict = 'ERROR'
            $title = $errorWindow.Title
            break
        }

        if ($newProjectWindow) {
            if ($DismissNewProjectDialog -and -not $dismissedNewProject) {
                $cancel = [StarUmlWindows]::Descendants($newProjectWindow.Handle) |
                    Where-Object {
                        $_.ClassName -eq 'TButton' -and
                        $_.Title -match '取消|Cancel'
                    } |
                    Select-Object -First 1
                if ($cancel) {
                    [void][StarUmlWindows]::SendMessageW(
                        $cancel.Handle,
                        0x00F5,
                        [IntPtr]::Zero,
                        [IntPtr]::Zero
                    )
                    $dismissedNewProject = $true
                    continue
                }
            }
            $verdict = 'NO-DOCUMENT'
            $title = $newProjectWindow.Title
            break
        }

        if ($loadedWindow) {
            $title = $loadedWindow.Title
            $documentTabWindow = [StarUmlWindows]::Descendants($loadedWindow.Handle) |
                Where-Object {
                    $_.ClassName -eq 'TdxTabSheet' -and
                    -not [string]::IsNullOrWhiteSpace($_.Title) -and
                    $_.Title -notmatch '^Main$'
                } |
                Select-Object -First 1
            if ($documentTabWindow) {
                $documentTab = $documentTabWindow.Title
                $verdict = 'LOADED'
                break
            }
        }
    }

    $screenshotPath = ''
    if ($verdict -eq 'LOADED' -and $Screenshot -and $loadedWindow) {
        Add-Type -AssemblyName System.Drawing
        $screenshotPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(
            $Screenshot
        )
        $rect = New-Object StarUmlWindows+Rect
        if ([StarUmlWindows]::GetWindowRect($loadedWindow.Handle, [ref]$rect)) {
            $width = $rect.Right - $rect.Left
            $height = $rect.Bottom - $rect.Top
            if ($width -gt 0 -and $height -gt 0) {
                $bitmap = New-Object System.Drawing.Bitmap($width, $height)
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                $deviceContext = $graphics.GetHdc()
                [void][StarUmlWindows]::PrintWindow(
                    $loadedWindow.Handle,
                    $deviceContext,
                    2
                )
                $graphics.ReleaseHdc($deviceContext)
                $graphics.Dispose()
                $bitmap.Save(
                    $screenshotPath,
                    [System.Drawing.Imaging.ImageFormat]::Png
                )
                $bitmap.Dispose()
            }
        }
    }

    if (-not $KeepOpen) {
        Get-Process -Name StarUML -ErrorAction SilentlyContinue | Stop-Process -Force
    }

    Write-Output ("{0}: {1}" -f $verdict, $target)
    if ($title) { Write-Output ("  window: " + $title) }
    if ($documentTab) { Write-Output ("  document tab: " + $documentTab) }
    if ($screenshotPath) { Write-Output ("  screenshot: " + $screenshotPath) }
    if ($verdict -eq 'LOADED') {
        Write-Output '  Programmatic gate passed; still verify the expected named diagram and model tree visually.'
    }
    if ($verdict -eq 'ERROR') {
        Write-Output '  Treat this as a failed load. An error dialog can coexist with the requested filename in the main title.'
    }
    if ($verdict -eq 'NO-DOCUMENT') {
        if ($lastWindows.Count -gt 0) {
            $windowSummary = $lastWindows |
                ForEach-Object { "$($_.ClassName): $($_.Title)" }
            Write-Output ("  visible windows: " + ($windowSummary -join ' | '))
        }
        if ($title -and $lastWindows.ClassName -contains 'TNewProjectForm') {
            Write-Output '  The startup New Project dialog is blocking the file. Cancel it or rerun with -DismissNewProjectDialog.'
        }
        Write-Output '  The app stayed on an empty window. This is a failed load.'
        Write-Output '  First copy the same bytes to an ASCII basename such as model_check.uml'
        Write-Output '  and retry before changing otherwise valid XPD XML.'
    }

    switch ($verdict) {
        'LOADED' { exit 0 }
        'ERROR' { exit 1 }
        default { exit 2 }
    }
}
finally {
    try { $checkMutex.ReleaseMutex() } catch {}
    $checkMutex.Dispose()
}
