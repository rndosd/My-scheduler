# 스크립트 실행 중 오류가 발생하면 즉시 중단시킵니다.
$ErrorActionPreference = "Stop"

# 1. 커밋 메시지를 스크립트의 첫 번째 인자로 받습니다.
#    만약 인자가 없으면 "chore: auto-deploy"라는 기본 메시지를 사용합니다.
$commitMessage = if ($args.Count -gt 0) { $args[0] } else { "chore: auto-deploy" }

# 2. Git 명령어들을 순서대로 실행합니다.
Write-Host ">> 1. Staging all changes..." -ForegroundColor Green
git add .

Write-Host ">> 2. Committing with message: $commitMessage" -ForegroundColor Green
git commit -m "$commitMessage"

Write-Host ">> 3. Pushing to remote repository..." -ForegroundColor Green
git push

# 3. Firebase 배포를 실행합니다.
Write-Host ">> 4. Deploying functions to Firebase..." -ForegroundColor Yellow
firebase deploy --only functions

Write-Host "✅ Deployment script finished successfully!" -ForegroundColor Cyan