build:
	npm run build:unminified

build_mini:
	npm run build:minified

lint:
	npm run lint:code

bump_major:
	( \
		npm version major -m "Build latest version %s" && \
		make build && \
		git add dist && \
		git commit --amend --no-edit \
	)

bump_minor:
	( \
		npm version minor -m "Build latest version %s" && \
		make build && \
		git add dist && \
		git commit --amend --no-edit \
	)

bump_patch:
	( \
		npm version patch -m "Build latest version %s" && \
		make build && \
		git add dist && \
		git commit --amend --no-edit \
	)
