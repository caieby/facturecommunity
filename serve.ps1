# Minimal static file server that mimics Netlify's behavior for local testing.
# Uses a raw TcpListener (not HttpListener) since HttpListener requires admin
# rights to bind broadly on Windows — TcpListener does not.
#   - Serves files from this script's directory
#   - Applies rewrite rules from _redirects dynamically (prefix + "*" match, "200" = rewrite not redirect)
#   - Falls back to /404.html for unmatched paths, if present

$root = $PSScriptRoot
$port = 8080

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

function Get-Redirects {
  $path = Join-Path $root '_redirects'
  $rules = @()
  if (Test-Path $path) {
    Get-Content $path | ForEach-Object {
      $line = $_.Trim()
      if ($line -and -not $line.StartsWith('#')) {
        $parts = $line -split '\s+'
        if ($parts.Length -ge 2) {
          $rules += [PSCustomObject]@{ From = $parts[0]; To = $parts[1] }
        }
      }
    }
  }
  return $rules
}

function Resolve-RequestPath {
  param([string]$urlPath, [array]$redirectRules)

  foreach ($rule in $redirectRules) {
    if ($rule.From.EndsWith('/*')) {
      $prefix = $rule.From.Substring(0, $rule.From.Length - 1)
      if ($urlPath.StartsWith($prefix)) {
        return $rule.To
      }
    } elseif ($rule.From -eq $urlPath) {
      return $rule.To
    }
  }

  return $urlPath
}

function Handle-Client {
  param($client)

  try {
    $stream = $client.GetStream()
    # Without a read timeout, an idle/speculative connection (browsers open
    # these routinely) that never sends a request blocks ReadLine() forever —
    # and since the accept loop is single-threaded, that freezes every other
    # page/asset trying to load at the same time. Bound the wait instead.
    $stream.ReadTimeout = 3000
    $reader = New-Object System.IO.StreamReader($stream)

    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); return }

    # Drain headers (we don't need them for a static file server)
    while (($headerLine = $reader.ReadLine()) -and $headerLine -ne '') {}

    $requestParts = $requestLine -split ' '
    $rawPath = if ($requestParts.Length -ge 2) { $requestParts[1] } else { '/' }
    $urlPath = [System.Uri]::UnescapeDataString(($rawPath -split '\?')[0])
    if ($urlPath -eq '/') { $urlPath = '/index.html' }

    # Netlify (and any correct static-host rewrite) only falls back to a
    # _redirects rewrite when no real file exists at the exact requested
    # path — a request for a real file like /social/posts/view.js must be
    # served as-is, never rewritten just because it shares a prefix with a
    # rewrite rule.
    $directPath = Join-Path $root ($urlPath.TrimStart('/'))

    if (Test-Path $directPath -PathType Leaf) {
      $filePath = $directPath
    } else {
      $redirects = Get-Redirects
      $resolvedPath = Resolve-RequestPath -urlPath $urlPath -redirectRules $redirects
      $filePath = Join-Path $root ($resolvedPath.TrimStart('/'))

      if (Test-Path $filePath -PathType Container) {
        $filePath = Join-Path $filePath 'index.html'
      }
    }

    $statusLine = 'HTTP/1.1 200 OK'

    if (-not (Test-Path $filePath -PathType Leaf)) {
      $notFoundPath = Join-Path $root '404.html'
      if (Test-Path $notFoundPath) {
        $filePath = $notFoundPath
        $statusLine = 'HTTP/1.1 404 Not Found'
      } else {
        $statusLine = 'HTTP/1.1 404 Not Found'
        $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $header = "$statusLine`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
        $client.Close()
        return
      }
    }

    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }

    $bodyBytes = [System.IO.File]::ReadAllBytes($filePath)
    $header = "$statusLine`r`nContent-Type: $contentType`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)

    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    $stream.Flush()
    $client.Close()
  } catch {
    try { $client.Close() } catch {}
  }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Output "Serving $root on port $port"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    Handle-Client -client $client
  }
} finally {
  $listener.Stop()
}
