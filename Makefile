SRC_FILES := $(shell find src -name '*.ts')

all: lib

lib: $(SRC_FILES) node_modules tsconfig.json
	./node_modules/.bin/tsc -p tsconfig.json --outDir lib
	touch lib

.PHONY: update-abi-types
update-abi-types: node_modules lib
	node -p "JSON.stringify(require('./lib/link-abi-data.js').default)" \
		| ./node_modules/.bin/eosio-abi2ts -e >src/link-abi.d.ts

.PHONY: lint
lint: node_modules
	NODE_ENV=test ./node_modules/.bin/tslint -p tsconfig.json -c tslint.json -t stylish --fix

.PHONY: test
test: node_modules
	./node_modules/.bin/mocha --require ts-node/register test/*.ts --grep '$(grep)'

node_modules:
	yarn install --non-interactive --frozen-lockfile

.PHONY: clean
clean:
	rm -rf lib/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
