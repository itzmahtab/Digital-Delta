$body = @{username='admin';otp='123456'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method POST -Body $body -ContentType 'application/json'