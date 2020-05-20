SRC_FILES := $(shell find src -name '*.ts')

all: lib lib/bundle.js lib/index.es5.js

lib: $(SRC_FILES) node_modules tsconfig.json
	./node_modules/.bin/tsc -p tsconfig.json --outDir lib
	touch lib

lib/bundle.js: $(SRC_FILES) node_modules tsconfig.json
	./node_modules/.bin/browserify -e src/index-bundle.js -p tsify -s AnchorLink \
	| ./node_modules/.bin/exorcist lib/bundle.js.map > lib/bundle.js

lib/index.es5.js: $(SRC_FILES) node_modules tsconfig.json
	./node_modules/.bin/browserify --debug -e src/index-bundle.js -p tsify \
		-s AnchorLink --node --no-bundle-external \
	| ./node_modules/.bin/exorcist lib/index.es5.js.map > lib/index.es5.js

.PHONY: update-abi-types
update-abi-types: node_modules
	./node_modules/.bin/ts-node -e "import data from './src/link-abi-data'; console.log(JSON.stringify(data))" \
	| ./node_modules/.bin/eosio-abi2ts -e >src/link-abi.d.ts.tmp && mv src/link-abi.d.ts.tmp src/link-abi.d.ts

.PHONY: lint
lint: node_modules
	NODE_ENV=test ./node_modules/.bin/tslint -p tsconfig.json -c tslint.json -t stylish --fix

docs: $(SRC_FILES) node_modules
	./node_modules/.bin/typedoc \
		--mode file --stripInternal \
		--excludeNotExported --excludePrivate --excludeProtected \
		--name "Anchor Link" --readme none \
		--out docs \
		src/index.ts

.PHONY: deploy-site
deploy-site: docs
	cp -r ./examples ./docs/examples/
	./node_modules/.bin/gh-pages -d docs

node_modules:
	yarn install --non-interactive --frozen-lockfile

.PHONY: clean
clean:
	rm -rf lib/ docs/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
