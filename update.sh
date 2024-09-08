#!/bin/bash

echo "Please enter the current MC version:"
read -r old

echo "Please enter the new MC version:"
read -r new

alias mappingsDir='cd book/$new'
alias oldMappingsDir='cd book/$old'
alias rootDirFromMappingsDir='cd ../../'
alias drop='./gradlew dropInvalidMappings'
alias mapJar='./gradlew mapPerVersionMappingsJar'

deno task setup "$old" "$new"
oldMappingsDir
mapJar
rootDirFromMappingsDir
mappingsDir
mapJar
drop
git add . && git commit -m "$new"
rootDirFromMappingsDir
deno task match "$old" "$new"
mappingsDir
drop
./gradlew generatePackageInfoMappings build javadocJar
git add . && git commit -m "match $old to $new"
git push