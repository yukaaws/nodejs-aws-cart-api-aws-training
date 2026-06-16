rmdir /s /q dist 2>nul
rmdir /s /q cart-service-cdk\cdk.out 2>nul
npm run build
cd cart-service-cdk
cdk deploy
