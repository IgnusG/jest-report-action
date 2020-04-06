build:
	npm run build:unminified

build_mini:
	npm run build:minified

lint:
	npm run lint:code

build_and_push:
	( \
		make build && \
		git add dist && \
		git commit --amend --no-edit --no-verify && \
		git push --follow-tags \
	)

bump_major:
	( \
		npm version major -m "Build latest version %s" && \
		make build_and_push \
	)

bump_minor:
	( \
		npm version minor -m "Build latest version %s" && \
		make build_and_push \
	)

bump_patch:
	( \
		npm version patch -m "Build latest version %s" && \
		make build_and_push \
	)
