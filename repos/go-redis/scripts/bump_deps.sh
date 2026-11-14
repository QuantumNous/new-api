PACKAGE_DIRS=$(find . -mindepth 2 -type f -name 'go.mod' -exec dirname {} \; \
  | sed 's/^\.\///' \
  | sort)

for dir in $PACKAGE_DIRS
do
    printf "${dir}: go get -d && go mod tidy\n"
    (cd ./${dir} && go get -d && go mod tidy)
done
