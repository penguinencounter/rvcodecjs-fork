#!/bin/bash
# public directory to serve as web root
mkdir -p public
cp -r core public
# web-ui files at root of directory
cp -r web-ui/* public
# change js file paths according to changed folder structure
sed -i -e 's/\.\.\/core\//\.\/core\//g' ./public/main.js
sed -i -e 's/\.\.\/core\//\.\/core\//g' ./public/completion.js
