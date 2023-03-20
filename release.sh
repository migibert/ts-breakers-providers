#!/bin/bash

version=$1

root=$(pwd)
directories=$(ls -d */)
for dir in $directories; do
    cd $dir
    npm version $version
    cd $root
done;

git add .
git commit -m "Release ${version}"
git tag -a "v${version}" -m "Release v${version}"
git push --follow-tags
