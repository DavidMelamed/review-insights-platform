# Contributing to Review Insights

We love your input! We want to make contributing to Review Insights as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub
We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [GitHub Flow](https://guides.github.com/introduction/flow/index.html)
Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License
In short, when you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issues](https://github.com/review-insights/platform/issues)
We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/review-insights/platform/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Process

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL
- Redis
- Docker (optional)

### Getting Started

1. Fork and clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/review-insights-platform.git
cd review-insights-platform
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development servers
```bash
pnpm dev
```

### Code Style

- We use ESLint and Prettier for code formatting
- Run `pnpm lint` to check code style
- Run `pnpm format` to auto-format code
- TypeScript is required for all new code
- Follow the existing patterns in the codebase

### Testing

- Write tests for all new features
- Run tests with `pnpm test`
- Ensure 80%+ code coverage for new code
- Integration tests are preferred over unit tests

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add predictive analytics for churn detection
fix: resolve race condition in review collection
docs: update API documentation for webhooks
```

### Pull Request Process

1. Update the README.md with details of changes to the interface
2. Update the CHANGELOG.md with your changes
3. Increase version numbers following [SemVer](http://semver.org/)
4. The PR will be merged once you have approval from maintainers

## Community

- Join our [Discord](https://discord.gg/reviewinsights)
- Follow us on [Twitter](https://twitter.com/reviewinsights)
- Read our [blog](https://reviewinsights.ai/blog)

## License
By contributing, you agree that your contributions will be licensed under its MIT License.