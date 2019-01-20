#!/bin/sh

mkdir -p ./logs

# https://serverfault.com/questions/445118/rotating-logs-generated-by-a-process-that-logs-to-stdin
node /usr/bin/ts-node ./src/server.ts | multilog t s1048576 n5 ./logs  &
