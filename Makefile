build:
	npm run build:unminified

build_mini:
	npm run build:minified

lint:
	npm run lint:code

build_and_commit:
	( \
		make build_mini && \
		git add dist && \
		git commit --no-verify -m "Build Source" \
	)

push:
	git push --follow-tags

bump_major:
	( \
		make build_and_commit && \
		npm version major -m "Build latest version %s"  && \
		make push \
	)

bump_minor:
	( \
		make build_and_commit && \
		npm version minor -m "Build latest version %s" && \
		make push \
	)

bump_patch:
	( \
		make build_and_commit && \
		npm version patch -m "Build latest version %s" && \
		make push \
	)
