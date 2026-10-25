@{
  "action" = "activate"
  "orderId" = "MI-20260830-0002"
} | ConvertTo-Json | % {
  $body = $_
  $response = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/orders" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

  $data = $response.Content | ConvertFrom-Json

  Write-Host "Status: $($response.StatusCode)"
  Write-Host ""
  Write-Host "Activation Result:"
  Write-Host ""
  if ($data.order) {
    Write-Host "Order ID: $($data.order.orderId)"
    Write-Host "Status: $($data.order.status)"
    Write-Host "Approved At: $($data.order.approvedAt)"
    Write-Host "Activated At: $($data.order.activatedAt)"
    Write-Host "Activation Date: $($data.order.activationDate)"
    Write-Host "Activation Time: $($data.order.activationTime)"
    Write-Host "Expiry At: $($data.order.expiryAt)"
    Write-Host "Expiry Date: $($data.order.expiryDate)"
    Write-Host "Expiry Time: $($data.order.expiryTime)"
    Write-Host "Reminder At: $($data.order.reminderAt)"
    Write-Host "Reminder Date: $($data.order.reminderDate)"
    Write-Host "Reminder Time: $($data.order.reminderTime)"
    Write-Host "Reminder Status: $($data.order.reminderStatus)"
    Write-Host "Duration Days: $($data.order.durationDays)"
  }
  else {
    $data | ConvertTo-Json -Depth 10
  }
}
