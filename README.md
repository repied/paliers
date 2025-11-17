# TODO
- fix all links
- make TS work locally
- make TS work on github pages
- make issues for all the ideas
    - TechDiveFrontline
    - plongee plaisir
    - scuba forum
- rewrtie reademe
- write permission to TechDiveFrontline

# Intro

These pages are rendered automatically on git push of the `release` branch by Github at [repied.github.io](http:\\repied.github.io).

# Jekyll
Jekyll is a Ruby Gem, it is a static site generator. It takes text written in your favorite markup language and uses layouts to create a static website.

The readme is not rendered by Jekyll because there is an index.md file. 

## Math in Jekyll

Add to `includes/head.html`
```html
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<script>
  MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']] // Configure les délimiteurs pour l'affichage en ligne
    }
  };
</script>
```
Use
```
Inline $E=mc^2$
```
and equation block
```
$$\sum_{i=0}^n i^2$$
```
If markdown interprets some latex symbol, use divs:
```html
<div>
$$
\frac{\partial L}{\partial w_{ji}} = \frac{\partial E}{\partial y_i} \cdot \sigma'(a_i) \cdot x_j
$$
</div>
```

### In a codespace 
Jekyll is installed in the devcontainer.json image.

### Locally (chromeos ubuntu penguin)
You need to install [Ruby and setup Jekyll](https://jekyllrb.com/docs/installation/ubuntu/) :
```
sudo apt-get install ruby-full build-essential zlib1g-dev
gem install jekyll bundler jekyll-seo-tag
```
Then to use [Jekyll](https://jekyllrb.com/docs/step-by-step/01-setup/) when there is already a Gemfile.
```
bundle config set --local path '~/lib/gems' # need to install in user folder
bundle update
bundle install
```
Then to watch, rebuild, serve and trigger browser livereload:
```
bundle exec jekyll serve --incremental --watch --livereload
```
# Minima jekyll template
Minima is used as a remote theme (i.e. it is fetched during rendering from minima github), but I also have copied locally htmls for _layout and _includes, which could be changed, but have not been changed. Those local ones take precedence to the github versions.

# Adding news posts

New .md files in ./posts named like `2016-05-19-codeblocks-ahoy.md` will rendered as 'post' and  liked in the generated ./_layouts/home.html from ./index.md.

# Adding new page
All .md which are not in ./_posts are generated according to the ./_layouts/page.html
An example is about.md.
Pages are linked in the header, if they are mentioned in _config.yml



# Typescript

# Local dev
Intall Typescript
```
sudo apt update
sudo apt install nodejs npm
sudo npm install -g typescript
```
Use Typescript `tsc -w` to watch and transpile.
