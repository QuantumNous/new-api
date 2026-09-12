#!/bin/bash

set -e

help() {
    cat <<- EOF
Usage: TAG=tag $0

Creates git tags for public Go packages.

VARIABLES:
  TAG        git tag, for example, v1.0.0
EOF
    exit 0
}

if [ -z "$TAG" ]
then
    printf "TAG env var is required\n\n";
    help
fi

if ! grep -Fq "\"${TAG#v}\"" version.go
then
    printf "version.go does not contain ${TAG#v}\n"
    exit 1
fi

PACKAGE_DIRS=$(find . -mindepth 2 -type f -name 'go.mod' -exec dirname {} \; \
  | grep -E -v "example|internal" \
  | sed 's/^\.\///' \
  | sort)

git tag ${TAG}
git push origin ${TAG}

for dir in $PACKAGE_DIRS
do
    printf "tagging ${dir}/${TAG}\n"
    git tag ${dir}/${TAG}
    git push origin ${dir}/${TAG}
done
