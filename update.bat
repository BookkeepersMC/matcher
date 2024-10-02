@echo off
setlocal

:: Prompt for the current MC version
set /p old="Please enter the current MC version: "

:: Prompt for the new MC version
set /p new="Please enter the new MC version: "

:: Run the setup task
deno task setup "%old%" "%new%"

:: Process the old version
cd book\%old%
call gradlew mapPerVersionMappingsJar

:: Move back to the root directory
cd ..\..

:: Process the new version
cd book\%new%
call gradlew mapPerVersionMappingsJar
call gradlew dropInvalidMappings
git add . 
git commit -m "%new%"

:: Move back to the root directory
cd ..\..

:: Match versions
deno task match "%old%" "%new%"

:: Process the new version again
cd book\%new%
call gradlew dropInvalidMappings
call gradlew generatePackageInfoMappings build javadocJar || exit /b 1
git add . 
git commit -m "match %old% to %new%"
git push

:: Move back to the root directory
cd ..\..

:: Clean up
rd /s /q book

endlocal