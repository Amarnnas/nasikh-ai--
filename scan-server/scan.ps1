param([string]$OutputPath)

try {
    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $deviceInfo = @($deviceManager.DeviceInfos) | Where-Object { $_.Type -in @(1,2,3) } | Select-Object -First 1

    if ($null -eq $deviceInfo) {
        Write-Output "ERROR:No scanner device found"
        exit 1
    }

    Write-Output "DEBUG:Device=$($deviceInfo.Properties('Name').Value) Type=$($deviceInfo.Type)"
    $device = $deviceInfo.Connect()
    $item = $device.Items(1)

    # Try to set resolution (might fail on type 1 devices)
    try { $item.Properties("6010").Value = 200 } catch {}
    try { $item.Properties("6011").Value = 200 } catch {}

    # Try JPEG format first, fallback to BMP if fails
    $formats = @(
        "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}",  # wiaFormatJPEG
        "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}",  # wiaFormatBMP
        "{00000000-0000-0000-0000-000000000000}"    # Default/any
    )

    $image = $null
    foreach ($fmt in $formats) {
        try {
            if ($fmt -eq "{00000000-0000-0000-0000-000000000000}") {
                # Try without format argument (let WIA decide)
                $image = $item.Transfer()
            } else {
                $image = $item.Transfer($fmt)
            }
            if ($image) { break }
        } catch {
            Write-Output "DEBUG:Format $fmt failed: $($_.Exception.Message)"
            continue
        }
    }

    if ($null -eq $image) {
        Write-Output "ERROR:Could not transfer image from device"
        exit 1
    }

    # Ensure output has .jpg extension
    if (-not ($OutputPath.EndsWith('.jpg') -or $OutputPath.EndsWith('.bmp') -or $OutputPath.EndsWith('.png'))) {
        $OutputPath = "$OutputPath.jpg"
    }

    $image.SaveFile($OutputPath)
    Write-Output $OutputPath
}
catch {
    $err = $_.Exception.Message -replace "`r`n", " " -replace "`n", " "
    Write-Output "ERROR:$err"
    exit 1
}
