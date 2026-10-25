$ErrorActionPreference = 'Continue'

$body = @{
  action = 'activate'
  orderId = 'MI-20260830-0002'
} | ConvertTo-Json

Write-Host "Request body:"
Write-Host $body
Write-Host ""

try {
  $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/admin/orders' `
    -Method POST `
    -ContentType 'application/json' `
    -Body $body `
    -ErrorAction Stop

  Write-Host "Success! Status: $($response.StatusCode)"
  $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
} catch {
  Write-Host "Error Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
  Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red

  # Try to read response body
  try {
    $streamReader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $errorBody = $streamReader.ReadToEnd()
    Write-Host "Response Body:" -ForegroundColor Red
    Write-Host $errorBody
    $streamReader.Close()
  } catch {}
}
