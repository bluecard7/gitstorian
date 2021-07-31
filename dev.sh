#!/bin/bash
./run-server.sh $1 &
[ $? -eq 1 ] && exit 1
pwd
cd next-ui
npm run dev
