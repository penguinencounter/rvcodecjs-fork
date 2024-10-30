mkdir -p public
cp -r core public
cp -r web-ui/* public
sed -i -e 's/\.\.\/core\//\.\/core\//g' ./public/main.js
sed -i -e 's/\.\.\/core\//\.\/core\//g' ./public/completion.js
