build:
	npm run build:unminified

build_mini:
	npm run build:minified

lint:
	npm run lint:code

build_and_stage:
	( \
		make build_mini && \
		git add dist \
	)

push:
	git push --follow-tags

bump_major:
	( \
		npm version major -m "Build latest version %s"  && \
		make push \
	)

bump_minor:
	( \
		npm version minor -m "Build latest version %s" && \
		make push \
	)

bump_patch:
	( \
		npm version patch -m "Build latest version %s" && \
		make push \
	)
