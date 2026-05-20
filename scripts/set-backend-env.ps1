param(
    [string]$ResourceGroup = "Smart-Knowledge-Base",
    [string]$ContainerAppName = "smart-knowledge-base-backend",
    [string]$EnvFilePath = "backend\SmartKB\.env"
)

if (-not (Test-Path $EnvFilePath)) {
    throw "Env file not found: $EnvFilePath"
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI (az) not found. Install Azure CLI and run: az login"
}

$lines = Get-Content -Path $EnvFilePath
$envPairs = @()

foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0) { continue }
    if ($trimmed.StartsWith("#")) { continue }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1)

    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    if ($key.Length -gt 0) {
        $envPairs += "$key=$value"
    }
}

if ($envPairs.Count -eq 0) {
    throw "No environment variables found in $EnvFilePath"
}

Write-Host "Setting $($envPairs.Count) env vars on container app '$ContainerAppName' in resource group '$ResourceGroup'..."

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --set-env-vars @envPairs

Write-Host "Done. You may need to restart the container app if changes do not take effect immediately."
