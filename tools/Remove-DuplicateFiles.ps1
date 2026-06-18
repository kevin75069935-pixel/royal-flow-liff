param(
  [string]$Root = "D:\",
  [string]$ReportPath = ".\duplicate-files-report.csv",
  [string]$LogPath = ".\duplicate-files-scan.log",
  [switch]$Delete,
  [switch]$IncludeHidden,
  [switch]$IncludeSystem,
  [string[]]$ExcludeDirectoryNames = @('$RECYCLE.BIN', 'System Volume Information')
)

$ErrorActionPreference = "Continue"

Add-Type -AssemblyName Microsoft.VisualBasic

function Write-Log {
  param([string]$Message)

  $line = "{0:u} {1}" -f (Get-Date), $Message
  Write-Host $line
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Test-ExcludedPath {
  param([string]$Path)

  foreach ($name in $ExcludeDirectoryNames) {
    if ($Path -like "*\$name\*" -or $Path.TrimEnd('\') -like "*\$name") {
      return $true
    }
  }

  return $false
}

function Get-FileRecords {
  param([string]$StartPath)

  $stack = [System.Collections.Generic.Stack[string]]::new()
  $stack.Push($StartPath)

  while ($stack.Count -gt 0) {
    $dir = $stack.Pop()

    if (Test-ExcludedPath -Path $dir) {
      continue
    }

    try {
      foreach ($subdir in [System.IO.Directory]::EnumerateDirectories($dir)) {
        if (-not (Test-ExcludedPath -Path $subdir)) {
          try {
            $subdirInfo = [System.IO.DirectoryInfo]::new($subdir)
            $isHidden = (($subdirInfo.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0)
            $isSystem = (($subdirInfo.Attributes -band [System.IO.FileAttributes]::System) -ne 0)
            $isReparse = (($subdirInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
            if ($isReparse) {
              continue
            }
            if (-not $IncludeHidden -and $isHidden) {
              continue
            }
            if (-not $IncludeSystem -and $isSystem) {
              continue
            }
            $stack.Push($subdir)
          } catch {}
        }
      }
    } catch {
      continue
    }

    try {
      foreach ($file in [System.IO.Directory]::EnumerateFiles($dir)) {
        try {
          $info = [System.IO.FileInfo]::new($file)
          if (-not $IncludeHidden -and (($info.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0)) {
            continue
          }
          if (-not $IncludeSystem -and (($info.Attributes -band [System.IO.FileAttributes]::System) -ne 0)) {
            continue
          }
          [PSCustomObject]@{
            FullName = $info.FullName
            Length = $info.Length
            LastWriteTimeUtc = $info.LastWriteTimeUtc
          }
        } catch {}
      }
    } catch {}
  }
}

function Get-QuickFingerprint {
  param(
    [string]$Path,
    [Int64]$Length,
    [int]$SampleBytes = 65536
  )

  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = $null
  try {
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    if ($Length -le ($SampleBytes * 2)) {
      $buffer = New-Object byte[] $Length
      $read = $stream.Read($buffer, 0, $buffer.Length)
      $hash = $sha.ComputeHash($buffer, 0, $read)
    } else {
      $buffer = New-Object byte[] ($SampleBytes * 2)
      $first = New-Object byte[] $SampleBytes
      $last = New-Object byte[] $SampleBytes
      $firstRead = $stream.Read($first, 0, $SampleBytes)
      $stream.Seek(-$SampleBytes, [System.IO.SeekOrigin]::End) | Out-Null
      $lastRead = $stream.Read($last, 0, $SampleBytes)
      [Array]::Copy($first, 0, $buffer, 0, $firstRead)
      [Array]::Copy($last, 0, $buffer, $SampleBytes, $lastRead)
      $hash = $sha.ComputeHash($buffer, 0, ($firstRead + $lastRead))
    }
    return [System.BitConverter]::ToString($hash).Replace("-", "")
  } finally {
    if ($stream) {
      $stream.Dispose()
    }
    $sha.Dispose()
  }
}

if (Test-Path -LiteralPath $LogPath) {
  Remove-Item -LiteralPath $LogPath -Force
}

Write-Log "Scanning file sizes under $Root ..."
$bySize = @{}
$fileCount = 0
foreach ($record in Get-FileRecords -StartPath $Root) {
  $fileCount++
  if (-not $bySize.ContainsKey($record.Length)) {
    $bySize[$record.Length] = [System.Collections.Generic.List[object]]::new()
  }
  $bySize[$record.Length].Add($record)
  if (($fileCount % 5000) -eq 0) {
    Write-Log "Scanned $fileCount files ..."
  }
}

$candidateGroups = @($bySize.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 })
$candidateCount = ($candidateGroups | ForEach-Object { $_.Value.Count } | Measure-Object -Sum).Sum
Write-Log "Files scanned: $fileCount"
Write-Log "Candidate files with matching sizes: $candidateCount"

$fingerprintRows = [System.Collections.Generic.List[object]]::new()
$fingerprintedCount = 0
foreach ($group in $candidateGroups) {
  foreach ($file in $group.Value) {
    try {
      $fingerprintRows.Add([PSCustomObject]@{
        Fingerprint = (Get-QuickFingerprint -Path $file.FullName -Length $file.Length)
        Length = $file.Length
        LastWriteTimeUtc = $file.LastWriteTimeUtc
        FullName = $file.FullName
      })
      $fingerprintedCount++
      if (($fingerprintedCount % 5000) -eq 0) {
        Write-Log "Fingerprinted $fingerprintedCount / $candidateCount candidate files ..."
      }
    } catch {}
  }
}

$fingerprintGroups = @($fingerprintRows | Group-Object Length,Fingerprint | Where-Object { $_.Count -gt 1 })
$fullHashCandidateCount = ($fingerprintGroups | ForEach-Object { $_.Group.Count } | Measure-Object -Sum).Sum
Write-Log "Files needing full SHA256 after fingerprint: $fullHashCandidateCount"

$hashRows = [System.Collections.Generic.List[object]]::new()
$hashedCount = 0
foreach ($group in $fingerprintGroups) {
  foreach ($file in $group.Group) {
    try {
      $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256 -ErrorAction Stop
      $hashRows.Add([PSCustomObject]@{
        Hash = $hash.Hash
        Length = $file.Length
        LastWriteTimeUtc = $file.LastWriteTimeUtc
        FullName = $file.FullName
      })
      $hashedCount++
      if (($hashedCount % 1000) -eq 0) {
        Write-Log "Full hashed $hashedCount / $fullHashCandidateCount files ..."
      }
    } catch {}
  }
}

$duplicates = $hashRows |
  Group-Object Hash |
  Where-Object { $_.Count -gt 1 } |
  ForEach-Object {
    $index = 0
    foreach ($item in ($_.Group | Sort-Object FullName)) {
      $index++
      [PSCustomObject]@{
        Hash = $_.Name
        GroupCount = $_.Count
        KeepSuggested = ($index -eq 1)
        Length = [Int64]$item.Length
        LastWriteTimeUtc = $item.LastWriteTimeUtc
        FullName = $item.FullName
      }
    }
  }

$duplicates | Export-Csv -LiteralPath $ReportPath -NoTypeInformation -Encoding UTF8

$removable = @($duplicates | Where-Object { -not $_.KeepSuggested })
$removableBytes = ($removable | Measure-Object Length -Sum).Sum
Write-Log "Duplicate groups: $(@($duplicates | Group-Object Hash).Count)"
Write-Log "Removable duplicate copies: $($removable.Count)"
Write-Log "Potential space recovered: $removableBytes bytes"
Write-Log "Report: $(Resolve-Path -LiteralPath $ReportPath)"

if ($Delete) {
  foreach ($file in $removable) {
    try {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
        $file.FullName,
        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
      )
      Write-Log "Recycled: $($file.FullName)"
    } catch {
      Write-Log "Could not recycle: $($file.FullName)"
    }
  }
}
