try {
    $deviceManager = New-Object -ComObject WIA.DeviceManager

    # Check all device types (1=camera, 2=scanner, 3=video)
    $devices = @($deviceManager.DeviceInfos)
    foreach ($type in @(1,2,3)) {
        $match = $devices | Where-Object { $_.Type -eq $type } | Select-Object -First 1
        if ($match) {
            $name = $match.Properties('Name').Value
            Write-Output "OK|$type|$name"
            exit 0
        }
    }

    # Debug: list all devices
    if ($devices.Length -eq 0) {
        Write-Output "NO_DEVICES"
    } else {
        $names = @()
        foreach ($d in $devices) {
            try { $names += "$($d.Type):$($d.Properties('Name').Value)" } catch { $names += "$($d.Type):unknown" }
        }
        Write-Output "NO_SCANNER|$($names -join ', ')"
    }
}
catch {
    Write-Output "COM_ERROR|$($_.Exception.Message)"
    # Fallback: check via CIM
    try {
        $cim = Get-CimInstance -Namespace root/Windows/Devices -ClassName ScannerDevice | Select-Object -First 1
        if ($cim) {
            Write-Output "OK|0|$($cim.Name)"
        } else {
            Write-Output "NO_SCANNER"
        }
    }
    catch {
        Write-Output "NO_SCANNER"
    }
}
