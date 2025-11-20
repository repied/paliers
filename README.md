# Paliers

`paliers` is a tool to compute and display scuba diving desaturation plans.
It's a client-side html + css + javascript webpage. No database, no server required. 
<div style="text-align: center;">
    <img src="./media/toool_screenshot.png" alt="Profil simple" width="500" />
</div>

# Usage

The tool is available at [https://repied.github.io/paliers/](https://repied.github.io/paliers/).
It can also be downloaded locally and opened in the browser.

# Contribute

The tool is composed of:
- `index.html`: main file to open in the browser
- `src/ts/`: typescript files for the calculations and interactivity. Compiled to `.js` files by `tsc`
- `src/css/`: stylesheet
- `docs/`: markdown files explaining the algorithm. Markdown files are compiled to `html` by `Jekyll`
- `media/`: documents, images, whitepapers referenced in the docs
- `tests/`: unit test for the typescript
- `_config.yml`: Jekyll config
- `_includes/` and `_layouts/`: part of Minima theme used by Jekyll 

The `ts` code is packaged according to `package.json`.

## Build in CI

The tool is tested, built (`.ts` and `.md`) and deployed to Github pages on a push of the `main` branch. See github action config in `./github/*.yml`.

## Build locally

Instructions for a linux system.

### Jekyll

Install [Ruby and Jekyll](https://jekyllrb.com/docs/installation/ubuntu/):
```
sudo apt update
sudo apt install ruby-full build-essential zlib1g-dev
gem install jekyll bundler jekyll-seo-tag
```
Setup [Jekyll](https://jekyllrb.com/docs/step-by-step/01-setup/):
```
bundle config set --local path '~/lib/gems' # need to install in user folder
bundle update
bundle install
```

Then, to build and serve locally:
```
bundle exec jekyll serve --incremental --watch --livereload
```

### Typescript
Install typescript
```
sudo apt update
sudo apt install nodejs npm
sudo npm install -g typescript
```

Then, to build to watch and transpile using `tsconfig.json`:
```
tsc -w
```

## Test locally
Install package dependencies (`jest`...):
```
npm install
```
Run all tests:
```
npm test
```
Run tests with coverage (optional):
```
npm test -- --coverage
```


## Build in Codespace

Codespace setup is defined by `.devcontainer/devcontainer.json`.
