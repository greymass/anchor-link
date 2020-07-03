PATH  := $(PATH):$(PWD)/node_modules/.bin
SHELL := env PATH=$(PATH) /bin/bash
SRC_FILES := $(shell find src -name '*.ts')
LIB_FILES := lib/index.js lib/index.m.js lib/index.esm.js

all: $(LIB_FILES) lib/bundle.js

lib:
	mkdir lib

.NOTPARALLEL:
$(LIB_FILES): $(SRC_FILES) lib node_modules tsconfig.json
	microbundle -f modern,es
	microbundle -f cjs -i src/index-bundle.ts

lib/bundle.js: $(SRC_FILES) lib node_modules tsconfig.json
	microbundle -f umd --no-pkg-main --name AnchorLink --external none \
		-i src/index-bundle.ts -o lib/bundle.js

.PHONY: test
test: node_modules
	@mocha -u tdd -r ts-node/register --extension ts test/*.ts --grep '$(grep)'

.PHONY: coverage
coverage: node_modules
	@nyc --reporter=html mocha -u tdd -r ts-node/register --extension ts test/*.ts -R nyan && open coverage/index.html

.PHONY: lint
lint: node_modules
	@eslint src --ext .ts --fix

.PHONY: ci-test
ci-test: node_modules
	@nyc --reporter=text mocha -u tdd -r ts-node/register --extension ts test/*.ts -R list

.PHONY: ci-lint
ci-lint: node_modules
	@eslint src --ext .ts --max-warnings 0 --format unix && echo "Ok"

node_modules:
	yarn install --non-interactive --frozen-lockfile --ignore-scripts

.PHONY: clean
clean:
	rm -rf lib/ coverage/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
