#!/bin/bash

echo "Please enter the current MC version:"
read -r old

echo "Please enter the new MC version:"
read -r new

deno task setup "$old" "$new"
cd book/$old
./gradlew mapPerVersionMappingsJar
cd ../../
cd book/$new
./gradlew mapPerVersionMappingsJar
./gradlew dropInvalidMappings
git add . && git commit -m "$new"
cd ../../
deno task match "$old" "$new"
cd book/$new
./gradlew dropInvalidMappings
./gradlew generatePackageInfoMappings build javadocJar
git add . && git commit -m "match $old to $new"
git push
rm -rf book/
