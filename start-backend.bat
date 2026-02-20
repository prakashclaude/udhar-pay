@echo off
echo Starting UDHAR-Pay Backend Server...
cd server
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo.
echo Server is starting...
echo API will be available at http://localhost:5000
echo.
echo For Testing:
echo - Login/Register OTP is fixed to: 1234
echo.
npm start
pause
