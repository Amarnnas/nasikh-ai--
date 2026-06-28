try {
    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $scanner = $deviceManager.DeviceInfos | Where-Object { $_.Type -eq 2 } | Select-Object -First 1
    if ($scanner) {
        Write-Output "OK|$($scanner.Properties('Name').Value)"
    } else {
        Write-Output "NO_SCANNER"
    }
}
catch {
    Write-Output "ERROR|$($_.Exception.Message)"
}
