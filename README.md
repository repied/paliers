# Paliers

`paliers` is a client-side tool to compute and display scuba diving desaturation plans. It's built with HTML, CSS, and TypeScript, and requires no server-side components.

<div style="text-align: center;">
    <img src="./media/toool_screenshot.png" alt="Paliers tool screenshot" width="500" />
</div>

## How it Works

The tool implements the **Bühlmann ZHL-16C model** with Gradient Factors (GF) to calculate a safe decompression profile. It simulates the absorption and release of Nitrogen across 16 tissue compartments during a dive, ensuring that the partial pressure of the gas in each compartment stays within a safe limit. This limit is defined by a "corridor" between a low and high Gradient Factor.

For a more detailed explanation, see the [full algorithm description](./docs/algorithm_en.md).

## Usage

The tool is available online at [https://repied.github.io/paliers/](https://repied.github.io/paliers/).

It can also be downloaded and run locally by opening the `index.html` file in your web browser.

## Local Development Setup

To contribute to `paliers`, you'll need to set up the development environment for both TypeScript and Jekyll (for the documentation).

### Prerequisites

- [Node.js and npm](https://nodejs.org/en/download/)
- [Ruby and Bundler](https://jekyllrb.com/docs/installation/)

### Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/repied/paliers.git
    cd paliers
    ```

2.  **Install project dependencies:**
    ```bash
    npm install
    bundle install
    ```

### Running the Development Servers

-   **TypeScript:**
    To compile the TypeScript code and watch for changes, run:
    ```bash
    npm run watch
    ```

-   **Jekyll:**
    To build the documentation and serve it locally, run:
    ```bash
    bundle exec jekyll serve --livereload
    ```

-   **All-in-one:**
    To build the TypeScript and serve the entire application, run:
    ```bash
    npm start
    ```
    This will serve the application at `http://localhost:8080`.

### Running Tests

To run the unit tests, use the following command:
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
