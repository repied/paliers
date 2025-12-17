# Paliers

`paliers` is a client-side tool to compute and display scuba diving desaturation plans. It's built with HTML, CSS, and TypeScript, and requires no server-side components.

<div style="text-align: center;">
    <img width="500" alt="image" src="https://github.com/user-attachments/assets/1fd2d1a3-67d4-46a8-8eae-8a6aed89692b" />
</div>

It is focused on the impact of Gradient Factors.

## How it Works

The tool implements the **Bühlmann ZHL-16C model** with Gradient Factors (GF) to calculate a safe decompression profile. It simulates the absorption and release of gaz across 16 tissue compartments during a dive, ensuring that the partial pressure of the gas in each compartment stays within a safe limit. This safety limit is defined by 2 parameters: the low and high Gradient Factor. Resulting dive plans are plotted with Plotly. 

## Usage

The tool is available online at [https://repied.github.io/paliers/](https://repied.github.io/paliers/).
It can also be downloaded and run locally.

# Contribution

The tool is automatically tested, built and deployed to Github pages on a push of the `main` branch. See github action config in `./github/*.yml`.
- Jekyll builds documentation *.md to html
- `npm run build` compiles Typescript code *.ts to javascript (see `package.json`)

To contribute to `paliers`, you'll need to set up the development environment for both TypeScript and Jekyll. This can be done on a local linux machine, or by using a devcontainer setup.

## Local devcontainer or Codespace
The devcontainer is defined in `.devcontainer/devcontainer.json`. It can be build and run locally using a combination of Docker and Visual Studio Code.

Otherwise you can start a Github Codespace from the Github repo, or from Visual Studio Code. This codespace will build the devcontainer from the file.

## Local Development Setup

This part describes how to manually build a development environment on a linux machine.

- Update 
```
sudo apt update
```
- [Ruby and Bundler](https://jekyllrb.com/docs/installation/)
```
sudo apt install ruby-full build-essential zlib1g-dev
gem install jekyll bundler jekyll-seo-tag
```
- [Jekyll](https://jekyllrb.com/docs/step-by-step/01-setup/):
```
bundle config set --local path '~/lib/gems' # need to install in user folder
bundle update
bundle install
```

- [Node.js and npm](https://nodejs.org/en/download/)
```
sudo apt install nodejs npm
sudo npm install -g typescript http-server
```

## Building
- Install the package and its dependencies
```
npm install
```

- Jekyll: to build and serve locally:
```
bundle exec jekyll serve --incremental --watch --livereload
```

- Typescript: watch and rebuild after changes
```
npm run watch
``` 

## Serving during devleopement
```
npm run serve
```

## Testing
Run all tests: `npm test`.

Run tests with coverage (optional): `npm test --coverage`.

Open coverage report with, for instance, `http-server ./coverage`

## Debuging in vscode
- `npm build`
- place breakpoints in a `js\*.js` file
- `npm serve`
- use vscode `Launch Edge`
- then you can debug in vscode
