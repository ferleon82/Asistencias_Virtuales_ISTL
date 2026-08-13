# Keeps the Render backend warm and logs each request.
$BackendUrl = 'https://istl-asistencia-backend.onrender.com/health'
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDirectory 'mantener-render-activo.log'
$Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

try {
    $response = Invoke-WebRequest -Uri $BackendUrl -Method Get -TimeoutSec 120 -UseBasicParsing

    if ($response.StatusCode -eq 200) {
        Add-Content -Path $LogFile -Value "$Timestamp - OK - Backend available"
    }
    else {
        Add-Content -Path $LogFile -Value "$Timestamp - ERROR - Backend returned HTTP $($response.StatusCode)"
    }
}
catch {
    $message = $_.Exception.Message.Replace([Environment]::NewLine, ' ')
    Add-Content -Path $LogFile -Value "$Timestamp - ERROR - Backend connection failed: $message"
}