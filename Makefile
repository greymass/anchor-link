SRC_FILES := $(shell find src -name '*.ts')

lib: ${SRC_FILES} package.json tsconfig.json node_modules rollup.config.js
	@./node_modules/.bin/rollup -c && touch lib

.PHONY: test
test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ./node_modules/.bin/mocha -u tdd -r ts-node/register --extension ts test/*.ts --grep '$(grep)'

.PHONY: coverage
coverage: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ./node_modules/.bin/nyc --reporter=html ./node_modules/.bin/mocha -u tdd -r ts-node/register --extension ts test/*.ts -R nyan && open coverage/index.html

.PHONY: lint
lint: node_modules
	@./node_modules/.bin/eslint src --ext .ts --fix

.PHONY: ci-test
ci-test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ./node_modules/.bin/nyc --reporter=text ./node_modules/.bin/mocha -u tdd -r ts-node/register --extension ts test/*.ts -R list

.PHONY: ci-lint
ci-lint: node_modules
	@./node_modules/.bin/eslint src --ext .ts --max-warnings 0 --format unix && echo "Ok"

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
	yarn install --non-interactive --frozen-lockfile --ignore-scripts

.PHONY: clean
clean:
	rm -rf lib/ coverage/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
