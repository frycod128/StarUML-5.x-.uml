<#
    Open a .uml in classic StarUML 5 and report whether the document really loaded.

    A file can pass every static check and still fail here - that is the whole
    point of this script. Typical outcomes:

      LOADED       title bar shows "StarUML - <file>"
      ERROR        a modal dialog is up (access violation / invalid value / ...)
      NO-DOCUMENT  the app started but never opened the file (empty window)

    Usage:
      pwsh -File open_check.ps1 -File .\model.uml
      pwsh -File open_check.ps1 -File .\model.uml -Seconds 40 -KeepOpen

    Exit code: 0 LOADED, 1 ERROR, 2 NO-DOCUMENT.
#>
param(
    [Parameter(Mandatory = $true)][string]$File,
    [int]$Seconds = 30,
    [switch]$KeepOpen,
    [string]$StarUmlExe = ''
)

$ErrorActionPreference = 'Stop'

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
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder s, int max);

    public static List<string> Titles(uint pid) {
        var list = new List<string>();
        EnumWindows(delegate(IntPtr h, IntPtr p) {
            uint owner; GetWindowThreadProcessId(h, out owner);
            if (owner != pid || !IsWindowVisible(h)) return true;
            var text = new StringBuilder(512);
            GetWindowTextW(h, text, 512);
            if (text.Length > 0) list.Add(text.ToString());
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
'@

if (-not ('StarUmlWindows' -as [type])) { Add-Type -TypeDefinition $src -Language CSharp }

$exe = Find-StarUml -Explicit $StarUmlExe
$target = (Resolve-Path -LiteralPath $File).Path

Get-Process -Name StarUML -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800
Start-Process -FilePath $exe -ArgumentList ('"' + $target + '"')

$verdict = 'NO-DOCUMENT'
$title = ''
$lastTitles = @()
for ($i = 1; $i -le $Seconds; $i++) {
    Start-Sleep -Seconds 1
    $proc = Get-Process -Name StarUML -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $proc) {
        Write-Output 'StarUML exited before opening the file (crash?).'
        $verdict = 'ERROR'
        break
    }

    $titles = [StarUmlWindows]::Titles([uint32]$proc.Id)
    $lastTitles = $titles
    $loaded = $titles | Where-Object { $_ -like 'StarUML - *' } | Select-Object -First 1
    $dialog = $titles | Where-Object { $_ -match '错误|Error|violation|invalid' } | Select-Object -First 1

    if ($dialog) { $verdict = 'ERROR'; $title = $dialog; break }
    if ($loaded) { $verdict = 'LOADED'; $title = $loaded; break }
}

if (-not $KeepOpen) {
    Get-Process -Name StarUML -ErrorAction SilentlyContinue | Stop-Process -Force
}

Write-Output ("{0}: {1}" -f $verdict, $target)
if ($title) { Write-Output ("  window: " + $title) }
if ($verdict -eq 'NO-DOCUMENT') {
    if ($lastTitles.Count -gt 0) {
        Write-Output ("  visible windows: " + ($lastTitles -join ' | '))
    }
    Write-Output '  The app stayed on an empty window. Content and file name can both do this;'
    Write-Output '  try renaming the file (avoid names ending with 用例图.uml) before blaming the XML.'
}

switch ($verdict) {
    'LOADED' { exit 0 }
    'ERROR' { exit 1 }
    default { exit 2 }
}
