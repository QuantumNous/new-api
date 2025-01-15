#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")

case `uname` in
    *CYGWIN*|*MINGW*|*MSYS*) basedir=`cygpath -w "$basedir"`;;
esac

if [ -x "$basedir/node" ]; then
  exec "$basedir/node"  "$basedir/../@babel/parser/bin/babel-parser.js" "$@"
else 
  exec node  "$basedir/../@babel/parser/bin/babel-parser.js" "$@"
fi
