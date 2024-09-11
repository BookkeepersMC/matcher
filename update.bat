@echo off

echo Please enter the current MC version:
set /p "old="

echo Please enter the new MC version:
set /p "new="

deno task setup "%old%" "%new%"
cd book/%old%
./gradlew mapPerVersionMappingsJar
cd ../../
cd book/%new%
./gradlew mapPerVersionMappingsJar
./gradlew dropInvalidMappings
@rem git add . && git commit -m "$new"
cd ../../
deno task match "%old%" "%new%"
cd book/%new%
./gradlew dropInvalidMappings
./gradlew generatePackageInfoMappings build javadocJar
@rem git add . && git commit -m "match $old to $new"
@rem git push
rm -rf book/