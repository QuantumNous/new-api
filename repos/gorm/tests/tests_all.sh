#!/bin/bash -e

dialects=("sqlite" "mysql" "postgres" "sqlserver" "tidb")

if [[ $(pwd) == *"gorm/tests"* ]]; then
  cd ..
fi

if [ -d tests ]
then
  cd tests
  go get -u -t ./...
  go mod download
  go mod tidy
  cd ..
fi

# SqlServer for Mac M1
if [[ -z $GITHUB_ACTION ]]; then
  if [ -d tests ]
  then
    cd tests
    if [[ $(uname -a) == *" arm64" ]]; then
      MSSQL_IMAGE=mcr.microsoft.com/azure-sql-edge docker-compose start || true
      go install github.com/microsoft/go-sqlcmd/cmd/sqlcmd@latest || true
      SQLCMDPASSWORD=LoremIpsum86 sqlcmd -U sa -S localhost:9930 -Q "IF DB_ID('gorm') IS NULL CREATE DATABASE gorm" > /dev/null || true
      SQLCMDPASSWORD=LoremIpsum86 sqlcmd -U sa -S localhost:9930 -Q "IF SUSER_ID (N'gorm') IS NULL CREATE LOGIN gorm WITH PASSWORD = 'LoremIpsum86';" > /dev/null || true
      SQLCMDPASSWORD=LoremIpsum86 sqlcmd -U sa -S localhost:9930 -Q "IF USER_ID (N'gorm') IS NULL CREATE USER gorm FROM LOGIN gorm; ALTER SERVER ROLE sysadmin ADD MEMBER [gorm];" > /dev/null || true
    else
      docker-compose start
    fi
    cd ..
  fi
fi


for dialect in "${dialects[@]}" ; do
  if [ "$GORM_DIALECT" = "" ] || [ "$GORM_DIALECT" = "${dialect}" ]
  then
    echo "testing ${dialect}..."

    if [ "$GORM_VERBOSE" = "" ]
    then
      GORM_DIALECT=${dialect} go test -race -count=1 ./...
      if [ -d tests ]
      then
        cd tests
        GORM_DIALECT=${dialect} go test -race -count=1 ./...
        cd ..
      fi
    else
      GORM_DIALECT=${dialect} go test -race -count=1 -v ./...
      if [ -d tests ]
      then
        cd tests
        GORM_DIALECT=${dialect} go test -race -count=1 -v ./...
        cd ..
      fi
    fi
  fi
done
