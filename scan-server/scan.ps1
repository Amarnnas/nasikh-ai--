param([string]$OutputPath)

try {
    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $deviceInfo = $deviceManager.DeviceInfos | Where-Object { $_.Type -eq 2 } | Select-Object -First 1

    if ($null -eq $deviceInfo) {
        Write-Output "ERROR:No scanner device found"
        exit 1
    }

    $device = $deviceInfo.Connect()
    $item = $device.Items(1)

    $item.Properties("6010").Value = 300
    $item.Properties("6011").Value = 300
    $imageFormat = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
    $image = $item.Transfer($imageFormat)
    $image.SaveFile($OutputPath)
    Write-Output $OutputPath
}
catch {
    Write-Output "ERROR:$($_.Exception.Message)"
    exit 1
}
